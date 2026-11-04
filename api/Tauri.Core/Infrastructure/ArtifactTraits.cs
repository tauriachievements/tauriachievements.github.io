using System.Text.Json;

namespace Tauri.Core.Infrastructure;

public static class ArtifactTraits
{
    public static int Count(JsonElement artifact)
    {
        if (
            artifact.ValueKind != JsonValueKind.Object
            || !artifact.TryGetProperty("artifact", out var artifactInfo)
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
}
