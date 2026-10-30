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
    private static readonly IReadOnlyDictionary<int, string> ArtifactSpecializations =
        new Dictionary<int, string>
        {
            [120978] = "Retribution",
            [127829] = "Havoc",
            [127830] = "Havoc",
            [127857] = "Arcane",
            [128288] = "Protection",
            [128289] = "Protection",
            [128292] = "Frost",
            [128293] = "Frost",
            [128306] = "Restoration",
            [128402] = "Blood",
            [128403] = "Unholy",
            [128476] = "Subtlety",
            [128479] = "Subtlety",
            [128808] = "Survival",
            [128819] = "Enhancement",
            [128820] = "Fire",
            [128821] = "Guardian",
            [128822] = "Guardian",
            [128823] = "Holy",
            [128825] = "Holy",
            [128826] = "Marksmanship",
            [128827] = "Shadow",
            [128832] = "Vengeance",
            [128858] = "Balance",
            [128859] = "Feral",
            [128860] = "Feral",
            [128861] = "Beast Mastery",
            [128862] = "Frost",
            [128866] = "Protection",
            [128867] = "Protection",
            [128868] = "Discipline",
            [128869] = "Assassination",
            [128870] = "Assassination",
            [128872] = "Outlaw",
            [128873] = "Enhancement",
            [128908] = "Fury",
            [128910] = "Arms",
            [128911] = "Restoration",
            [128934] = "Restoration",
            [128935] = "Elemental",
            [128936] = "Elemental",
            [128937] = "Mistweaver",
            [128938] = "Brewmaster",
            [128940] = "Windwalker",
            [128941] = "Destruction",
            [128942] = "Affliction",
            [128943] = "Demonology",
            [133948] = "Windwalker",
            [133958] = "Shadow",
            [133959] = "Fire",
            [134552] = "Outlaw",
            [134553] = "Fury",
        };

    private const int UnderlightAnglerId = 133755;
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
            || response.ValueKind != JsonValueKind.Object
        )
        {
            return ArtifactResult.Missing;
        }

        if (
            !response.TryGetProperty("artifacts", out var artifacts)
            || artifacts.ValueKind != JsonValueKind.Array
        )
        {
            return ArtifactResult.Missing;
        }

        int? knowledge =
            response.TryGetProperty("artifact_knowledge", out var knowledgeElement)
            && knowledgeElement.TryGetInt32(out var knowledgeLevel)
                ? knowledgeLevel
                : null;

        if (artifacts.GetArrayLength() == 0)
        {
            return new ArtifactResult(true, 0, 0, knowledge, string.Empty, string.Empty, []);
        }

        ArtifactCandidate? bestArtifact = null;
        var weaponsBySpecialization = new Dictionary<string, ArtifactWeaponExport>(
            StringComparer.OrdinalIgnoreCase
        );
        foreach (var artifact in artifacts.EnumerateArray())
        {
            if (artifact.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var candidate = new ArtifactCandidate(
                artifact.TryGetProperty("SocketContainedGem", out var gems)
                && gems.ValueKind == JsonValueKind.Array
                    ? gems.GetArrayLength()
                    : 0,
                ReadArtifactTraitCount(artifact),
                ReadArtifactSpecialization(artifact),
                ReadString(artifact, "name")
            );

            if (bestArtifact is null || candidate.TraitCount > bestArtifact.TraitCount)
            {
                bestArtifact = candidate;
            }

            if (string.IsNullOrWhiteSpace(candidate.Specialization))
            {
                var itemId = ReadInt(artifact, "ID");
                if (itemId != UnderlightAnglerId)
                {
                    Console.WriteLine(
                        $"Unknown artifact {itemId} ({candidate.Name}) on {playerName}; add it to ArtifactSpecializations."
                    );
                }

                continue;
            }

            if (
                !weaponsBySpecialization.TryGetValue(candidate.Specialization, out var known)
                || candidate.TraitCount > known.Traits
            )
            {
                weaponsBySpecialization[candidate.Specialization] = new ArtifactWeaponExport(
                    candidate.Specialization,
                    candidate.Name,
                    candidate.TraitCount
                );
            }
        }

        if (bestArtifact is null)
        {
            return ArtifactResult.Missing;
        }

        return new ArtifactResult(
            true,
            bestArtifact.RelicCount,
            bestArtifact.TraitCount,
            knowledge,
            string.IsNullOrWhiteSpace(bestArtifact.Specialization)
                ? ReadSpecialization(response)
                : bestArtifact.Specialization,
            bestArtifact.Name,
            weaponsBySpecialization
                .Values.OrderByDescending(weapon => weapon.Traits)
                .ThenBy(weapon => weapon.Specialization, StringComparer.Ordinal)
                .ToList()
        );
    }

    private static string ReadArtifactSpecialization(JsonElement artifact)
    {
        foreach (var propertyName in new[] { "specialization", "spec", "treeName" })
        {
            if (
                artifact.TryGetProperty(propertyName, out var specialization)
                && specialization.ValueKind == JsonValueKind.String
                && !string.IsNullOrWhiteSpace(specialization.GetString())
            )
            {
                return specialization.GetString()!.Trim();
            }
        }

        var itemId = ReadInt(artifact, "ID");
        return ArtifactSpecializations.TryGetValue(itemId, out var mappedSpecialization)
            ? mappedSpecialization
            : string.Empty;
    }

    private static int ReadArtifactTraitCount(JsonElement artifact)
    {
        if (
            !artifact.TryGetProperty("artifact", out var artifactInfo)
            || artifactInfo.ValueKind != JsonValueKind.Object
            || !artifactInfo.TryGetProperty("artifactpowers", out var artifactPowers)
            || artifactPowers.ValueKind != JsonValueKind.Array
        )
        {
            return 0;
        }

        var traitCount = 0;
        foreach (var artifactPower in artifactPowers.EnumerateArray())
        {
            if (
                artifactPower.ValueKind == JsonValueKind.Object
                && artifactPower.TryGetProperty("purchasedrank", out var purchasedRank)
                && purchasedRank.TryGetInt32(out var rank)
            )
            {
                traitCount += rank;
            }
        }

        return traitCount;
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
            ReadSpecialization(response),
            ReadLong(response, "played_time"),
            ReadInt(response, "pts"),
            averageItemLevel,
            legendaries
        );
    }

    private static string ReadSpecialization(JsonElement response)
    {
        var activeSpec = ReadInt(response, "activeSpec");
        if (
            !response.TryGetProperty($"talents_legion_{activeSpec}", out var specialization)
            || specialization.ValueKind != JsonValueKind.String
        )
        {
            return string.Empty;
        }

        var parts = (specialization.GetString() ?? string.Empty).Split(
            '&',
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
        );
        if (parts.Length < 2)
        {
            return string.Empty;
        }

        return string.Join(
            ' ',
            parts[1]
                .Split('-', StringSplitOptions.RemoveEmptyEntries)
                .Select(word => char.ToUpperInvariant(word[0]) + word[1..])
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

    private static string ReadString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property)
        && property.ValueKind == JsonValueKind.String
            ? property.GetString() ?? string.Empty
            : string.Empty;

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
        IReadOnlyList<ArtifactWeaponExport> Weapons
    )
    {
        public static ArtifactResult Missing =>
            new(false, 0, 0, null, string.Empty, string.Empty, []);
    }

    private sealed record ArtifactCandidate(
        int RelicCount,
        int TraitCount,
        string Specialization,
        string Name
    );

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
        IReadOnlyList<ArtifactWeaponExport>? Artifacts,
        int? ArtifactKnowledge,
        decimal? ItemLevel,
        IReadOnlyList<LegendaryItem> Legendaries
    );

    private sealed record ArtifactWeaponExport(string Specialization, string Name, int Traits);
}
