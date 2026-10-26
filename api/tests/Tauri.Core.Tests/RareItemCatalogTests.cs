using Tauri.Core.Infrastructure;
using Tauri.Core.Models;

namespace Tauri.Core.Tests;

public sealed class RareItemCatalogTests
{
    [Fact]
    public void Load_ParsesNamesAndIdsUsingLastDash()
    {
        var directory = Directory.CreateTempSubdirectory();
        try
        {
            var path = Path.Combine(directory.FullName, "rare-items.txt");
            File.WriteAllText(path, "The Plague Bearer - 22818\nA Name-With-Dashes - 23075\n");

            var items = RareItemCatalog.Load(path);

            Assert.Equal(2, items.Count);
            Assert.Equal("The Plague Bearer", items[0].Name);
            Assert.Equal(22818, items[0].Id);
            Assert.Equal("A Name-With-Dashes", items[1].Name);
        }
        finally
        {
            directory.Delete(recursive: true);
        }
    }

    [Fact]
    public void LoadElitePvpItems_ReadsIdsAndNamesOnceEach()
    {
        var items = LoadEliteList(
            """
            {
              "version": 1,
              "seasons": [["malevolent", "Malevolent", "Season 12"]],
              "items": [
                [85046, "malevolent", [6], "Head", "Malevolent Gladiator's Dreadplate Helm"],
                [85086, "malevolent", [6], "Shoulder", "Malevolent Gladiator's Dreadplate Shoulders"],
                [85046, "malevolent", [6], "Head", "Malevolent Gladiator's Dreadplate Helm"]
              ]
            }
            """
        );

        Assert.Equal(
            [
                new RareItemDefinition(85046, "Malevolent Gladiator's Dreadplate Helm"),
                new RareItemDefinition(85086, "Malevolent Gladiator's Dreadplate Shoulders"),
            ],
            items
        );
    }

    [Theory]
    [InlineData("""{"version": 2, "items": []}""")]
    [InlineData("""{"version": 1}""")]
    [InlineData("""{"version": 1, "items": [["85046", "malevolent", [6], "Head", "Helm"]]}""")]
    [InlineData("""{"version": 1, "items": [[85046, "malevolent", [6], "Head"]]}""")]
    [InlineData("""{"version": 1, "items": [[0, "malevolent", [6], "Head", "Helm"]]}""")]
    [InlineData("""{"version": 1, "items": [[85046, "malevolent", [6], "Head", " "]]}""")]
    public void LoadElitePvpItems_RejectsAMalformedList(string json)
    {
        Assert.Throws<FormatException>(() => LoadEliteList(json));
    }

    [Fact]
    public void Combine_KeepsTheFirstListsNameForASharedId()
    {
        var items = RareItemCatalog.Combine(
            [
                new RareItemDefinition(22818, "The Plague Bearer"),
                new RareItemDefinition(51395, "WF Glad elite bow"),
            ],
            [
                new RareItemDefinition(51395, "Wrathful Gladiator's Recurve"),
                new RareItemDefinition(85046, "Helm"),
            ]
        );

        Assert.Equal([22818, 51395, 85046], items.Select(item => item.Id));
        Assert.Equal("WF Glad elite bow", items[1].Name);
    }

    private static IReadOnlyList<RareItemDefinition> LoadEliteList(string json)
    {
        var directory = Directory.CreateTempSubdirectory();
        try
        {
            var path = Path.Combine(directory.FullName, "elite-pvp-items.json");
            File.WriteAllText(path, json);
            return RareItemCatalog.LoadElitePvpItems(path);
        }
        finally
        {
            directory.Delete(recursive: true);
        }
    }
}
