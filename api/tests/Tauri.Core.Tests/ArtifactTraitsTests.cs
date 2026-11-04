using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace Tauri.Core.Tests;

public sealed class ArtifactTraitsTests
{
    [Fact]
    public void Count_SumsThePurchasedRanksOfEveryPower()
    {
        var artifact = Parse(
            """
            {
              "ID": 128827,
              "artifact": {
                "xp": 567495,
                "artifactpowers": [
                  { "purchasedrank": 3, "isfirstbonus": false },
                  { "purchasedrank": 1, "isfirstbonus": true },
                  { "purchasedrank": 0 },
                  { "rank": 4 }
                ]
              }
            }
            """
        );

        Assert.Equal(4, ArtifactTraits.Count(artifact));
    }

    [Theory]
    [InlineData("""{ "ID": 133755 }""")]
    [InlineData("""{ "artifact": [] }""")]
    [InlineData("""{ "artifact": { "artifactpowers": {} } }""")]
    [InlineData("""[]""")]
    public void Count_IsZeroWithoutAListOfPowers(string json)
    {
        Assert.Equal(0, ArtifactTraits.Count(Parse(json)));
    }

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
