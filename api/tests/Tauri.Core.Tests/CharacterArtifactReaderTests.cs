using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace Tauri.Core.Tests;

public sealed class CharacterArtifactReaderTests
{
    [Fact]
    public void Read_CountsThePurchasedRanksOfTheArtifactWithTheMostTraits()
    {
        var artifacts = CharacterArtifactReader.Read(
            Response(
                Artifact(128868, "Light's Wrath", relics: 1, 10, 20),
                Artifact(128827, "Xal'atath, Blade of the Black Empire", relics: 3, 4, 38)
            )
        );

        Assert.NotNull(artifacts);
        Assert.Equal(42, artifacts.TraitCount);
        Assert.Equal(3, artifacts.RelicCount);
        Assert.Equal("Shadow", artifacts.Specialization);
        Assert.Equal("Xal'atath, Blade of the Black Empire", artifacts.Name);
        Assert.Equal(25, artifacts.Knowledge);
    }

    [Fact]
    public void Read_ListsEachSpecsArtifactWithTheMostTraitsFirst()
    {
        var artifacts = CharacterArtifactReader.Read(
            Response(
                Artifact(128825, "T'uure, Beacon of the Naaru", relics: 0, 1),
                Artifact(128868, "Light's Wrath", relics: 1, 30),
                Artifact(128827, "Xal'atath, Blade of the Black Empire", relics: 3, 42)
            )
        );

        Assert.NotNull(artifacts);
        Assert.Equal(
            [
                new ArtifactWeapon("Shadow", "Xal'atath, Blade of the Black Empire", 42),
                new ArtifactWeapon("Discipline", "Light's Wrath", 30),
                new ArtifactWeapon("Holy", "T'uure, Beacon of the Naaru", 1),
            ],
            artifacts.Weapons
        );
    }

    [Fact]
    public void Read_AnArtifactOfNoKnownSpecTakesTheActiveSpecAndIsReported()
    {
        var artifacts = CharacterArtifactReader.Read(
            Response(
                Artifact(999999, "Mystery Blade", relics: 0, 50),
                Artifact(133755, "Underlight Angler", relics: 0, 5)
            )
        );

        Assert.NotNull(artifacts);
        Assert.Equal(50, artifacts.TraitCount);
        Assert.Equal("Holy", artifacts.Specialization);
        Assert.Empty(artifacts.Weapons);
        Assert.Equal([new UnknownArtifact(999999, "Mystery Blade")], artifacts.UnknownArtifacts);
    }

    [Fact]
    public void Read_AnEmptyArtifactListHasNoTraits()
    {
        var artifacts = CharacterArtifactReader.Read(Response());

        Assert.NotNull(artifacts);
        Assert.Equal(0, artifacts.TraitCount);
        Assert.Equal(string.Empty, artifacts.Specialization);
        Assert.Equal(25, artifacts.Knowledge);
    }

    [Fact]
    public void Read_WithoutAnArtifactListReturnsNull()
    {
        Assert.Null(CharacterArtifactReader.Read(Parse("""{ "artifact_knowledge": 25 }""")));
    }

    [Theory]
    [InlineData("""{ "activeSpec": 1, "talents_legion_1": "priest&holy&cABc" }""", "Holy")]
    [InlineData(
        """{ "activeSpec": 0, "talents_legion_0": "hunter&beast-mastery&cpCz" }""",
        "Beast Mastery"
    )]
    [InlineData("""{ "activeSpec": 2 }""", "")]
    public void ReadActiveSpecialization_NamesTheActiveSpecsTalentTree(string json, string expected)
    {
        Assert.Equal(expected, CharacterArtifactReader.ReadActiveSpecialization(Parse(json)));
    }

    private static JsonElement Response(params object[] artifacts) =>
        JsonSerializer.SerializeToElement(
            new
            {
                artifact_knowledge = 25,
                activeSpec = 1,
                talents_legion_1 = "priest&holy&cABc",
                artifacts,
            }
        );

    private static object Artifact(int id, string name, int relics, params int[] ranks) =>
        new
        {
            ID = id,
            name,
            SocketContainedGem = Enumerable.Range(0, relics).Select(_ => new { }).ToArray(),
            artifact = new
            {
                artifactpowers = ranks.Select(rank => new { purchasedrank = rank }).ToArray(),
            },
        };

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
