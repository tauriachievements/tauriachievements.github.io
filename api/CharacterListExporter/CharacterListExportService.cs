using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace CharacterListExporter;

public sealed record CharacterListEntry(
    string Name,
    int Class,
    string Spec,
    int Level,
    decimal? ItemLevel,
    int Traits,
    int ArtifactKnowledge,
    bool Campaign,
    int OrderHall
);

public sealed record CharacterListExportResult(
    string Path,
    IReadOnlyList<CharacterListEntry> Characters,
    int PreviousCount
);

public sealed class CharacterListExportService(
    string outputDirectory,
    ITauriApiClient apiClient,
    TimeProvider? timeProvider = null
)
{
    public const string OutputFolder = "character-lists";
    public const string GloriousCampaignAchievementId = "10994";

    private const double MaxShrinkFraction = 0.02;

    private readonly TimeProvider _timeProvider = timeProvider ?? TimeProvider.System;

    public async Task<CharacterListExportResult> ExportAsync(
        CharacterListExporterOptions options,
        CancellationToken cancellationToken
    )
    {
        var reads = await Task.WhenAll(
            options.Names.Select(name =>
                ReadCharacterAsync(options.ApiRealm, name, cancellationToken)
            )
        );

        var problems = reads.Where(read => read.Problem is not null).ToList();
        if (problems.Count > 0)
        {
            throw new InvalidOperationException(
                string.Join(" ", problems.Select(read => $"{read.Name}: {read.Problem}."))
                    + " Nothing was written."
            );
        }

        var characters = reads
            .Select(read => read.Entry!)
            .OrderBy(character => character.Name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(character => character.Name, StringComparer.Ordinal)
            .ToList();
        var path = Path.Combine(outputDirectory, OutputFolder, options.List + ".json");
        var previousCount = ReadPreviousCount(path);
        if (
            !options.AllowShrink
            && previousCount > 0
            && characters.Count < previousCount * (1 - MaxShrinkFraction)
        )
        {
            throw new InvalidOperationException(
                $"The {options.List} list shrank from {previousCount} to {characters.Count} characters. Nothing was written. "
                    + "Pass --allow-shrink if the characters were taken off the list on purpose."
            );
        }

        await CharacterListFileWriter.WriteAsync(
            path,
            options.Realm,
            characters,
            _timeProvider.GetUtcNow(),
            cancellationToken
        );
        return new CharacterListExportResult(path, characters, previousCount);
    }

    private async Task<CharacterRead> ReadCharacterAsync(
        string apiRealm,
        string name,
        CancellationToken cancellationToken
    )
    {
        var sheetTask = FetchAsync("character-sheet", apiRealm, name, cancellationToken);
        var artifactTask = FetchAsync("character-artifact", apiRealm, name, cancellationToken);
        var achievementsTask = FetchAsync(
            "character-achievements",
            apiRealm,
            name,
            cancellationToken
        );
        var sheet = await sheetTask;
        var artifact = await artifactTask;
        var achievements = await achievementsTask;

        if (sheet.ApiErrorCode == TauriApiResponseResult.CharacterNotFoundErrorCode)
        {
            return CharacterRead.Failed(name, "not found on this realm");
        }

        if (ObjectOf(sheet) is not { } sheetResponse)
        {
            return CharacterRead.Failed(
                name,
                $"the character sheet did not load ({sheet.FailureMessage})"
            );
        }

        if (ObjectOf(artifact) is not { } artifactResponse)
        {
            return CharacterRead.Failed(
                name,
                $"the artifacts did not load ({artifact.FailureMessage})"
            );
        }

        if (ObjectOf(achievements) is not { } achievementsResponse)
        {
            return CharacterRead.Failed(
                name,
                $"the achievements did not load ({achievements.FailureMessage})"
            );
        }

        var classId = ReadInt(sheetResponse, "class") ?? 0;
        var spec = CharacterSpecialization.Active(sheetResponse);
        var level = ReadInt(sheetResponse, "level");
        var orderHall = CountEntries(sheetResponse, "talents_classhall");
        var traits = HighestTraitCount(artifactResponse);
        var artifactKnowledge = ReadInt(artifactResponse, "artifact_knowledge");
        var campaign = HasAchievement(achievementsResponse, GloriousCampaignAchievementId);
        if (
            classId <= 0
            || spec.Length == 0
            || level is null
            || orderHall is null
            || traits is null
            || artifactKnowledge is null
            || campaign is null
        )
        {
            return CharacterRead.Failed(name, "a response was missing a field this list needs");
        }

        return new CharacterRead(
            name,
            new CharacterListEntry(
                ReadString(sheetResponse, "name") is { Length: > 0 } apiName ? apiName : name,
                classId,
                spec,
                level.Value,
                CharacterItemLevelCalculator.Calculate(sheetResponse),
                traits.Value,
                artifactKnowledge.Value,
                campaign.Value,
                orderHall.Value
            ),
            null
        );
    }

    private Task<TauriApiResponseResult> FetchAsync(
        string endpoint,
        string apiRealm,
        string name,
        CancellationToken cancellationToken
    ) =>
        apiClient.FetchResponseElementAsync(
            endpoint,
            new { r = apiRealm, n = name },
            $"{endpoint} for '{name}' on {apiRealm}",
            cancellationToken
        );

    private static JsonElement? ObjectOf(TauriApiResponseResult result) =>
        result.Succeeded && result.ResponseElement is { ValueKind: JsonValueKind.Object } response
            ? response
            : null;

    private static int? HighestTraitCount(JsonElement artifactResponse) =>
        artifactResponse.TryGetProperty("artifacts", out var artifacts)
        && artifacts.ValueKind == JsonValueKind.Array
            ? artifacts.EnumerateArray().Select(ArtifactTraits.Count).DefaultIfEmpty(0).Max()
            : null;

    private static bool? HasAchievement(JsonElement achievementsResponse, string achievementId)
    {
        if (!achievementsResponse.TryGetProperty("Achievements", out var earned))
        {
            return null;
        }

        if (earned.ValueKind == JsonValueKind.Object)
        {
            return earned.TryGetProperty(achievementId, out _);
        }

        return earned.ValueKind == JsonValueKind.Array && earned.GetArrayLength() == 0
            ? false
            : null;
    }

    private static int? CountEntries(JsonElement response, string propertyName)
    {
        if (!response.TryGetProperty(propertyName, out var entries))
        {
            return null;
        }

        return entries.ValueKind switch
        {
            JsonValueKind.Array => entries.GetArrayLength(),
            JsonValueKind.Object => entries.EnumerateObject().Count(),
            _ => null,
        };
    }

    private static int? ReadInt(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value)
        && value.ValueKind == JsonValueKind.Number
        && value.TryGetInt32(out var number)
            ? number
            : null;

    private static string ReadString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? string.Empty
            : string.Empty;

    private static int ReadPreviousCount(string path)
    {
        if (!File.Exists(path))
        {
            return 0;
        }

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllBytes(path));
            return
                document.RootElement.TryGetProperty("characters", out var characters)
                && characters.ValueKind == JsonValueKind.Array
                ? characters.GetArrayLength()
                : 0;
        }
        catch (Exception error) when (error is JsonException or IOException)
        {
            return 0;
        }
    }

    private sealed record CharacterRead(string Name, CharacterListEntry? Entry, string? Problem)
    {
        public static CharacterRead Failed(string name, string problem) => new(name, null, problem);
    }
}
