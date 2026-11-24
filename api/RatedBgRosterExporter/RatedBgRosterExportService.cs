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
    decimal? ItemLevel
)
{
    public static RosterPlayer Missing(RosterCharacter character) =>
        new(character.Name, character.DisplayRealm, false, 0, 0, 0, string.Empty, null, null);
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
            characters.Select(character => ReadAsync(character, cancellationToken))
        );

        var failed = reads.Where(read => read.Player is null).ToList();
        if (failed.Count > 0)
        {
            throw new InvalidOperationException(
                $"Could not export {failed.Count} of {characters.Count} characters, so nothing was written: "
                    + string.Join(
                        ", ",
                        failed.Select(read =>
                            $"{read.Character.Name}-{read.Character.DisplayRealm} ({read.Failure})"
                        )
                    )
            );
        }

        var players = reads.Select(read => read.Player!).ToList();
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
        RosterCharacter character,
        CancellationToken cancellationToken
    )
    {
        var label = $"{character.Name}-{character.DisplayRealm}";
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
                ? new CharacterRead(character, RosterPlayer.Missing(character), null, [])
                : new CharacterRead(
                    character,
                    null,
                    result.FailureMessage ?? "the API sent no character",
                    []
                );
        }

        var artifacts = CharacterArtifactReader.Read(response);
        var specialization = string.IsNullOrWhiteSpace(artifacts?.Specialization)
            ? CharacterArtifactReader.ReadActiveSpecialization(response)
            : artifacts.Specialization;
        var traits = artifacts?.TraitCount;

        if (character.MainSpec is { } mainSpec)
        {
            var weapon = artifacts?.Weapons.FirstOrDefault(weapon =>
                string.Equals(weapon.Specialization, mainSpec, StringComparison.OrdinalIgnoreCase)
            );
            if (weapon is null)
            {
                return new CharacterRead(
                    character,
                    null,
                    $"no {mainSpec} artifact: check the spec in {RatedBgRosterList.FileName}",
                    []
                );
            }

            specialization = weapon.Specialization;
            traits = weapon.Traits;
        }

        var name = ReadString(response, "name");

        var player = new RosterPlayer(
            string.IsNullOrWhiteSpace(name) ? character.Name : name.Trim(),
            character.DisplayRealm,
            true,
            ReadInt(response, "race"),
            ReadInt(response, "gender"),
            ReadInt(response, "class"),
            specialization,
            traits,
            CharacterResponseMapper.ReadItemLevel(response)
        );
        var warnings = (artifacts?.UnknownArtifacts ?? [])
            .Select(unknown =>
                $"Unknown artifact {unknown.ItemId} ({unknown.Name}) on {label}; add it to ArtifactSpecializations in CharacterArtifactReader."
            )
            .ToList();

        return new CharacterRead(character, player, null, warnings);
    }

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
        RosterCharacter Character,
        RosterPlayer? Player,
        string? Failure,
        IReadOnlyList<string> Warnings
    );
}
