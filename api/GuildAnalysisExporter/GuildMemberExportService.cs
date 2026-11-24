using System.Globalization;
using System.Text;
using System.Text.Json;
using Tauri.Core.Dtos;
using Tauri.Core.Infrastructure;

namespace GuildAnalysisExporter;

public sealed class GuildMemberExportService(
    string outputDirectory,
    ITauriApiClient apiClient,
    TauriShootItemClient itemClient
)
{
    private const int ExportedLevel = 110;

    private readonly string _outputDirectory = Path.GetFullPath(outputDirectory);
    private readonly ITauriApiClient _apiClient = apiClient;
    private readonly TauriShootItemClient _itemClient = itemClient;

    public async Task<GuildMemberExportResult> ExportAsync(
        string realmName,
        string guildName,
        CancellationToken cancellationToken
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(realmName);
        ArgumentException.ThrowIfNullOrWhiteSpace(guildName);

        var apiRealmName = ResolveApiRealmName(realmName);
        var result = await _apiClient.FetchResponseElementAsync(
            "guild-info",
            new { r = apiRealmName, gn = guildName },
            $"guild '{guildName}' on {apiRealmName}",
            cancellationToken
        );

        if (!result.Succeeded || result.ResponseElement is not { } response)
        {
            throw new InvalidOperationException(
                result.FailureMessage ?? $"Could not load guild '{guildName}' on {realmName}."
            );
        }

        if (
            response.ValueKind != JsonValueKind.Object
            || !response.TryGetProperty("guildList", out var guildList)
            || guildList.ValueKind != JsonValueKind.Object
        )
        {
            throw new InvalidDataException("The API response did not contain a guildList object.");
        }

        GuildInfoInner guildInfo;
        try
        {
            guildInfo =
                response.Deserialize<GuildInfoInner>()
                ?? throw new InvalidDataException("The guild response was empty.");
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException("The guild response could not be parsed.", ex);
        }

        var guildMembers = guildInfo
            .guildList.Values.Where(member => !string.IsNullOrWhiteSpace(member.name))
            .GroupBy(member => member.name.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(member => member.name, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var faction = ReadInt(response, "faction") switch
        {
            0 => "Alliance",
            1 => "Horde",
            _ => "Unknown",
        };
        var playerNames = guildMembers.Select(member => member.name.Trim()).ToList();
        var guildRankNames = guildMembers.ToDictionary(
            member => member.name.Trim(),
            member => member.rank_name?.Trim() ?? string.Empty,
            StringComparer.OrdinalIgnoreCase
        );
        var guildRanks = guildMembers
            .GroupBy(member => member.rank)
            .Select(group => new GuildRankExport(
                group.Key,
                group
                    .Select(member => member.rank_name?.Trim())
                    .FirstOrDefault(name => !string.IsNullOrWhiteSpace(name))
                    ?? $"Rank {group.Key}"
            ))
            .OrderBy(rank => rank.Order)
            .ThenBy(rank => rank.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var guildRankOrders = guildMembers.ToDictionary(
            member => member.name.Trim(),
            member => member.rank,
            StringComparer.OrdinalIgnoreCase
        );

        Console.WriteLine($"Loading character sheets for {playerNames.Count} players...");

        var characterResults = new Dictionary<string, CharacterScanResult>(
            StringComparer.OrdinalIgnoreCase
        );
        var processedPlayerCount = 0;

        foreach (var playerName in playerNames)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var details = await LoadLevel110CharacterDetailsAsync(
                apiRealmName,
                playerName,
                cancellationToken
            );
            if (details is { } level110Details)
            {
                var artifact = await LoadArtifactDetailsAsync(
                    apiRealmName,
                    playerName,
                    cancellationToken
                );
                characterResults[playerName] = new CharacterScanResult(artifact, level110Details);
            }

            processedPlayerCount++;
            if (processedPlayerCount % 25 == 0 || processedPlayerCount == playerNames.Count)
            {
                Console.WriteLine(
                    $"Scanned character sheets and artifacts {processedPlayerCount}/{playerNames.Count}"
                );
            }
        }

        var sortedRows = playerNames
            .Where(characterResults.ContainsKey)
            .Select(playerName => new OutputRow(
                playerName,
                guildRankOrders[playerName],
                guildRankNames[playerName],
                characterResults[playerName]
            ))
            .ToList();
        var outputName = MakeFileNamePart(guildName).ToLowerInvariant();
        var outputPath = Path.Combine(_outputDirectory, outputName + ".json");
        await WriteJsonAsync(
            outputPath,
            realmName.Trim(),
            guildName.Trim(),
            faction,
            guildRanks,
            sortedRows,
            cancellationToken
        );

        return new GuildMemberExportResult(playerNames.Count, characterResults.Count, outputPath);
    }

    private async Task<ArtifactResult> LoadArtifactDetailsAsync(
        string realmName,
        string playerName,
        CancellationToken cancellationToken
    )
    {
        var result = await _apiClient.FetchResponseElementAsync(
            "character-artifact",
            new { r = realmName, n = playerName },
            $"character artifact for '{playerName}' on {realmName}",
            cancellationToken
        );

        if (
            !result.Succeeded
            || result.ResponseElement is not { } response
            || CharacterArtifactReader.Read(response) is not { } artifacts
        )
        {
            return ArtifactResult.Missing;
        }

        foreach (var unknown in artifacts.UnknownArtifacts)
        {
            Console.WriteLine(
                $"Unknown artifact {unknown.ItemId} ({unknown.Name}) on {playerName}; add it to ArtifactSpecializations in CharacterArtifactReader."
            );
        }

        return new ArtifactResult(
            true,
            artifacts.RelicCount,
            artifacts.TraitCount,
            artifacts.Knowledge,
            artifacts.Specialization,
            artifacts.Name,
            artifacts.Weapons
        );
    }

    private async Task<CharacterDetailsResult?> LoadLevel110CharacterDetailsAsync(
        string realmName,
        string playerName,
        CancellationToken cancellationToken
    )
    {
        var result = await _apiClient.FetchResponseElementAsync(
            "character-sheet",
            new { r = realmName, n = playerName },
            $"character sheet for '{playerName}' on {realmName}",
            cancellationToken
        );

        if (
            !result.Succeeded
            || result.ResponseElement is not { } response
            || response.ValueKind != JsonValueKind.Object
            || ReadInt(response, "level") != ExportedLevel
        )
        {
            return null;
        }

        var averageItemLevel = CharacterItemLevelCalculator.Calculate(response);
        var legendaryStubs = LegendaryItemParser.ReadEquipped(response);
        var legendaries = new List<LegendaryItem>(legendaryStubs.Count);
        foreach (var legendary in legendaryStubs)
        {
            legendaries.Add(await _itemClient.LoadAsync(legendary, cancellationToken));
        }

        return new CharacterDetailsResult(
            ReadInt(response, "race"),
            ReadInt(response, "gender"),
            ReadInt(response, "class"),
            CharacterArtifactReader.ReadActiveSpecialization(response),
            ReadLong(response, "played_time"),
            ReadInt(response, "pts"),
            averageItemLevel,
            legendaries
        );
    }

    private static long ReadLong(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property)
        && property.TryGetInt64(out var value)
            ? value
            : 0;

    private static int ReadInt(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property)
        && property.TryGetInt32(out var value)
            ? value
            : 0;

    private static string ResolveApiRealmName(string realmName) =>
        realmName.Trim().ToLowerInvariant() switch
        {
            "evermoon" => "[EN] Evermoon",
            "tauri" => "[HU] Tauri WoW Server",
            "wod" => "[HU] Warriors of Darkness",
            _ => realmName.Trim(),
        };

    private static string MakeFileNamePart(string value)
    {
        var invalidCharacters = Path.GetInvalidFileNameChars().ToHashSet();
        var sanitized = new string(
            value
                .Trim()
                .Normalize(NormalizationForm.FormD)
                .Where(character =>
                    CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark
                )
                .Select(character =>
                    invalidCharacters.Contains(character) || char.IsWhiteSpace(character)
                        ? '-'
                        : character
                )
                .ToArray()
        );

        var fileNamePart = sanitized.Trim('-', '.');
        if (string.IsNullOrWhiteSpace(fileNamePart))
        {
            throw new ArgumentException($"'{value}' cannot be used as part of a file name.");
        }

        return fileNamePart;
    }

    private static async Task WriteJsonAsync(
        string outputPath,
        string realmName,
        string guildName,
        string faction,
        IReadOnlyList<GuildRankExport> ranks,
        IReadOnlyList<OutputRow> rows,
        CancellationToken cancellationToken
    )
    {
        var data = new GuildExport(
            GetCentralEuropeanTimestamp(),
            new GuildMetadata(guildName, realmName, faction),
            ranks,
            rows.Select(row => new CharacterExport(
                    row.PlayerName,
                    row.Result.Details.Race,
                    row.Result.Details.Gender,
                    row.Result.Details.Class,
                    row.GuildRankOrder,
                    row.GuildRankName,
                    string.IsNullOrWhiteSpace(row.Result.Artifact.Specialization)
                        ? row.Result.Details.Specialization
                        : row.Result.Artifact.Specialization,
                    row.Result.Details.PlayedTime,
                    row.Result.Details.AchievementPoints,
                    row.Result.Artifact.Found
                    && !string.IsNullOrWhiteSpace(row.Result.Artifact.Name)
                        ? row.Result.Artifact.Name
                        : null,
                    row.Result.Artifact.Found ? row.Result.Artifact.RelicCount : null,
                    row.Result.Artifact.Found ? row.Result.Artifact.TraitCount : null,
                    row.Result.Artifact.Found ? row.Result.Artifact.Weapons : null,
                    row.Result.Artifact.Knowledge,
                    row.Result.Details.ItemLevel,
                    row.Result.Details.Legendaries
                ))
                .ToList()
        );

        await AtomicFile.WriteJsonAsync(
            outputPath,
            data,
            new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true,
            },
            cancellationToken
        );
    }

    private static string GetCentralEuropeanTimestamp()
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById("Central European Standard Time");
        var centralEuropeanTime = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, timeZone);
        return centralEuropeanTime.ToString(
            "yyyy-MM-dd HH:mm:ss 'CET'",
            System.Globalization.CultureInfo.InvariantCulture
        );
    }

    private readonly record struct ArtifactResult(
        bool Found,
        int RelicCount,
        int TraitCount,
        int? Knowledge,
        string Specialization,
        string Name,
        IReadOnlyList<ArtifactWeapon> Weapons
    )
    {
        public static ArtifactResult Missing =>
            new(false, 0, 0, null, string.Empty, string.Empty, []);
    }

    private readonly record struct CharacterDetailsResult(
        int Race,
        int Gender,
        int Class,
        string Specialization,
        long PlayedTime,
        int AchievementPoints,
        decimal? ItemLevel,
        IReadOnlyList<LegendaryItem> Legendaries
    );

    private readonly record struct CharacterScanResult(
        ArtifactResult Artifact,
        CharacterDetailsResult Details
    );

    private sealed record OutputRow(
        string PlayerName,
        int GuildRankOrder,
        string GuildRankName,
        CharacterScanResult Result
    );

    private sealed record GuildExport(
        string Timestamp,
        GuildMetadata Guild,
        IReadOnlyList<GuildRankExport> Ranks,
        IReadOnlyList<CharacterExport> Players
    );

    private sealed record GuildMetadata(string Name, string Realm, string Faction);

    private sealed record GuildRankExport(int Order, string Name);

    private sealed record CharacterExport(
        string Name,
        int Race,
        int Gender,
        int Class,
        int GuildRank,
        string GuildRankName,
        string Specialization,
        long PlayedTime,
        int AchievementPoints,
        string? ArtifactWeapon,
        int? ArtifactRelics,
        int? ArtifactTraits,
        IReadOnlyList<ArtifactWeapon>? Artifacts,
        int? ArtifactKnowledge,
        decimal? ItemLevel,
        IReadOnlyList<LegendaryItem> Legendaries
    );
}
