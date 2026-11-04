using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace Tauri.Core.Tests;

public sealed class CharacterSpecializationTests
{
    [Fact]
    public void Active_NamesTheSpecOfTheActiveTalentSlot()
    {
        var sheet = Parse(
            """
            {
              "activeSpec": 2,
              "talents_legion_0": "priest&discipline&cItM",
              "talents_legion_1": "priest&holy&cABc",
              "talents_legion_2": "priest&shadow&cpHz"
            }
            """
        );

        Assert.Equal("Shadow", CharacterSpecialization.Active(sheet));
    }

    [Fact]
    public void Active_CapitalisesEachWordOfAHyphenatedSpec()
    {
        var sheet = Parse(
            """{ "activeSpec": 0, "talents_legion_0": "hunter&beast-mastery&abc" }"""
        );

        Assert.Equal("Beast Mastery", CharacterSpecialization.Active(sheet));
    }

    [Theory]
    [InlineData("""{ "activeSpec": 1 }""")]
    [InlineData("""{ "activeSpec": 3, "talents_legion_3": "" }""")]
    [InlineData("""{ "activeSpec": 0, "talents_legion_0": 5 }""")]
    public void Active_IsEmptyWithoutATalentString(string json)
    {
        Assert.Equal(string.Empty, CharacterSpecialization.Active(Parse(json)));
    }

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
