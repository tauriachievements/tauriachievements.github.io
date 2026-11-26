using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace RatedBgRosterExporter;

public sealed record RatedBgRosterExportResult(
    IReadOnlyList<RosterPlayer> Players,
    IReadOnlyList<RosterPlayer> NotFound,
    IReadOnlyList<string> Warnings,
    string OutputPath
);

public sealed record RosterPlayer(
    string Name,
    string Realm,
    bool Found,
    int Race,
    int Gender,
    int Class,
    string Specialization,
    int? Traits,
    decimal? ItemLevel,
    string? Person = null
)
{
    public static RosterPlayer Missing(RosterCharacter character) =>
        new(
            character.Name,
            character.DisplayRealm,
            false,
            0,
            0,
            0,
            string.Empty,
            null,
            null,
            character.Person
        );
}

public sealed class RatedBgRosterExportService(string outputDirectory, ITauriApiClient apiClient)
{
    public const string FileName = "rated-bg-roster.json";

    private readonly string _outputDirectory = Path.GetFullPath(outputDirectory);

    public async Task<RatedBgRosterExportResult> ExportAsync(
        IReadOnlyList<RosterCharacter> characters,
        DateTimeOffset generatedAt,
        CancellationToken cancellationToken
    )
    {
        ArgumentNullException.ThrowIfNull(characters);

        var reads = await Task.WhenAll(
            characters
                .GroupBy(character => character.Label, StringComparer.OrdinalIgnoreCase)
                .Select(lines => ReadAsync(lines.ToList(), cancellationToken))
        );

        var failed = reads.Where(read => read.Failure is not null).ToList();
        if (failed.Count > 0)
        {
            throw new InvalidOperationException(
                $"Could not export {failed.Count} of {reads.Length} characters, so nothing was written: "
                    + string.Join(", ", failed.Select(read => $"{read.Label} ({read.Failure})"))
            );
        }

        var players = WithArmoryPersons(reads);
        var outputPath = Path.Combine(_outputDirectory, FileName);
        await RatedBgRosterFileWriter.WriteAsync(
            outputPath,
            players,
            generatedAt,
            cancellationToken
        );

        return new RatedBgRosterExportResult(
            players,
            players.Where(player => !player.Found).ToList(),
            reads.SelectMany(read => read.Warnings).ToList(),
            outputPath
        );
    }

    private async Task<CharacterRead> ReadAsync(
        IReadOnlyList<RosterCharacter> lines,
        CancellationToken cancellationToken
    )
    {
        var character = lines[0];
        var label = character.Label;
        var result = await apiClient.FetchResponseElementAsync(
            "character-artifact",
            new { r = character.ApiRealm, n = character.Name },
            $"character artifact for {label}",
            cancellationToken
        );

        if (
            !result.Succeeded
            || result.ResponseElement is not { } response
            || response.ValueKind != JsonValueKind.Object
        )
        {
            return result.ApiErrorCode == TauriApiResponseResult.CharacterNotFoundErrorCode
                ? new CharacterRead(label, [RosterPlayer.Missing(character)], null, [])
                : new CharacterRead(
                    label,
                    [],
                    result.FailureMessage ?? "the API sent no character",
                    []
                );
        }

        var artifacts = CharacterArtifactReader.Read(response);
        var missingSpecs = lines
            .Select(line => line.MainSpec)
            .OfType<string>()
            .Where(mainSpec => WeaponOf(artifacts, mainSpec) is null)
            .ToList();
        if (missingSpecs.Count > 0)
        {
            return new CharacterRead(
                label,
                [],
                $"no {string.Join(" or ", missingSpecs)} artifact: check the spec in {RatedBgRosterList.FileName}",
                []
            );
        }

        var bestSpecialization = string.IsNullOrWhiteSpace(artifacts?.Specialization)
            ? CharacterArtifactReader.ReadActiveSpecialization(response)
            : artifacts.Specialization;
        var name = ReadString(response, "name");
        var players = lines
            .Select(line =>
            {
                var weapon = line.MainSpec is { } mainSpec ? WeaponOf(artifacts, mainSpec) : null;
                return new RosterPlayer(
                    string.IsNullOrWhiteSpace(name) ? character.Name : name.Trim(),
                    character.DisplayRealm,
                    true,
                    ReadInt(response, "race"),
                    ReadInt(response, "gender"),
                    ReadInt(response, "class"),
                    weapon?.Specialization ?? bestSpecialization,
                    weapon?.Traits ?? artifacts?.TraitCount,
                    CharacterResponseMapper.ReadItemLevel(response),
                    line.Person
                );
            })
            .ToList();
        var warnings = (artifacts?.UnknownArtifacts ?? [])
            .Select(unknown =>
                $"Unknown artifact {unknown.ItemId} ({unknown.Name}) on {label}; add it to ArtifactSpecializations in CharacterArtifactReader."
            )
            .ToList();

        return new CharacterRead(label, players, null, warnings);
    }

    private static List<RosterPlayer> WithArmoryPersons(IReadOnlyList<CharacterRead> reads)
    {
        var armoryLabels = reads
            .Where(read => read.Players.Count > 0)
            .ToDictionary(
                read => read.Label,
                read => $"{read.Players[0].Name}-{read.Players[0].Realm}",
                StringComparer.OrdinalIgnoreCase
            );

        return reads
            .SelectMany(read => read.Players)
            .Select(player =>
                player.Person is { } person
                    ? player with
                    {
                        Person = armoryLabels.GetValueOrDefault(person, person),
                    }
                    : player
            )
            .ToList();
    }

    private static ArtifactWeapon? WeaponOf(CharacterArtifacts? artifacts, string specialization) =>
        artifacts?.Weapons.FirstOrDefault(weapon =>
            string.Equals(weapon.Specialization, specialization, StringComparison.OrdinalIgnoreCase)
        );

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

    private sealed record CharacterRead(
        string Label,
        IReadOnlyList<RosterPlayer> Players,
        string? Failure,
        IReadOnlyList<string> Warnings
    );
}
