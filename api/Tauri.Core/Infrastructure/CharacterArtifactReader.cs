using System.Text.Json;

namespace Tauri.Core.Infrastructure;

public sealed record ArtifactWeapon(string Specialization, string Name, int Traits);

public sealed record UnknownArtifact(int ItemId, string Name);

public sealed record CharacterArtifacts(
    int? Knowledge,
    int RelicCount,
    int TraitCount,
    string Specialization,
    string Name,
    IReadOnlyList<ArtifactWeapon> Weapons,
    IReadOnlyList<UnknownArtifact> UnknownArtifacts
);

public static class CharacterArtifactReader
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

    public static CharacterArtifacts? Read(JsonElement response)
    {
        if (
            response.ValueKind != JsonValueKind.Object
            || !response.TryGetProperty("artifacts", out var artifacts)
            || artifacts.ValueKind != JsonValueKind.Array
        )
        {
            return null;
        }

        int? knowledge =
            response.TryGetProperty("artifact_knowledge", out var knowledgeElement)
            && knowledgeElement.TryGetInt32(out var knowledgeLevel)
                ? knowledgeLevel
                : null;

        if (artifacts.GetArrayLength() == 0)
        {
            return new CharacterArtifacts(knowledge, 0, 0, string.Empty, string.Empty, [], []);
        }

        ArtifactCandidate? best = null;
        var unknownArtifacts = new List<UnknownArtifact>();
        var weaponsBySpecialization = new Dictionary<string, ArtifactWeapon>(
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
                ReadTraitCount(artifact),
                ReadArtifactSpecialization(artifact),
                ReadString(artifact, "name")
            );

            if (best is null || candidate.TraitCount > best.TraitCount)
            {
                best = candidate;
            }

            if (string.IsNullOrWhiteSpace(candidate.Specialization))
            {
                var itemId = ReadInt(artifact, "ID");
                if (itemId != UnderlightAnglerId)
                {
                    unknownArtifacts.Add(new UnknownArtifact(itemId, candidate.Name));
                }

                continue;
            }

            if (
                !weaponsBySpecialization.TryGetValue(candidate.Specialization, out var known)
                || candidate.TraitCount > known.Traits
            )
            {
                weaponsBySpecialization[candidate.Specialization] = new ArtifactWeapon(
                    candidate.Specialization,
                    candidate.Name,
                    candidate.TraitCount
                );
            }
        }

        if (best is null)
        {
            return null;
        }

        return new CharacterArtifacts(
            knowledge,
            best.RelicCount,
            best.TraitCount,
            string.IsNullOrWhiteSpace(best.Specialization)
                ? ReadActiveSpecialization(response)
                : best.Specialization,
            best.Name,
            weaponsBySpecialization
                .Values.OrderByDescending(weapon => weapon.Traits)
                .ThenBy(weapon => weapon.Specialization, StringComparer.Ordinal)
                .ToList(),
            unknownArtifacts
        );
    }

    public static string ReadActiveSpecialization(JsonElement response)
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

        return ArtifactSpecializations.TryGetValue(ReadInt(artifact, "ID"), out var mapped)
            ? mapped
            : string.Empty;
    }

    private static int ReadTraitCount(JsonElement artifact)
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

    private sealed record ArtifactCandidate(
        int RelicCount,
        int TraitCount,
        string Specialization,
        string Name
    );
}
