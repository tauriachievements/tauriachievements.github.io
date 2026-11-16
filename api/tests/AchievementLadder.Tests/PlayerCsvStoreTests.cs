using AchievementLadder.Services;
using Tauri.Core.Models;

namespace AchievementLadder.Tests;

public sealed class PlayerCsvStoreTests : IDisposable
{
    private readonly string _outputDirectory = Path.Combine(
        Path.GetTempPath(),
        $"achievement-ladder-tests-{Guid.NewGuid():N}"
    );

    [Fact]
    public async Task WriteAsync_QuotesCommasQuotesAndNewLines()
    {
        var store = new PlayerCsvStore(_outputDirectory);
        var player = new Player
        {
            Name = "Mage, \"The Great\"",
            Realm = "Evermoon",
            Guild = "First line\nSecond line",
            Faction = "Alliance",
            Level = 110,
            Level10Date = new DateOnly(2019, 4, 2),
            ItemLevel = 883.33m,
        };

        var path = await store.WriteAsync([player], "Players.csv", CancellationToken.None);
        var content = await File.ReadAllTextAsync(path, CancellationToken.None);

        Assert.Contains("\"Mage, \"\"The Great\"\"\"", content);
        Assert.Contains("\"First line\nSecond line\"", content);
        Assert.StartsWith(
            "\"Name\",\"Race\",\"Gender\",\"Class\",\"Level\",\"Realm\",\"Guild\",\"AchievementPoints\",\"HonorableKills\",\"Faction\",\"AppearanceCount\",\"Level10Date\",\"PlayedTime\",\"AchievementsTotal\",\"ilvl\"",
            content
        );
        Assert.Contains(",0,0,0,110,\"Evermoon\",", content);
        Assert.Contains(",\"2019-04-02\",", content);
        Assert.EndsWith(",883.33" + Environment.NewLine, content);
    }

    [Fact]
    public async Task WriteJsonAsync_UsesCamelCasePropertyNames()
    {
        var store = new PlayerCsvStore(_outputDirectory);

        var path = await store.WriteJsonAsync(
            "result.json",
            new { PlayerCount = 3 },
            CancellationToken.None
        );
        var content = await File.ReadAllTextAsync(path, CancellationToken.None);

        Assert.Equal("{\"playerCount\":3}", content);
    }

    [Fact]
    public async Task ReadJsonOrDefaultAsync_ReadsWhatWriteJsonAsyncWrote()
    {
        var store = new PlayerCsvStore(_outputDirectory);
        var generatedAt = new DateTimeOffset(2026, 11, 16, 1, 34, 28, TimeSpan.Zero);
        var item = new RareItemDefinition(22818, "The Plague Bearer");
        await store.WriteJsonAsync(
            "RareItems.json",
            new RareItemExport(
                generatedAt,
                [item],
                [new CharacterRareItemEntry("Ghø", "Tauri", 4, 0, 4, "Guild", [item])]
            ),
            CancellationToken.None
        );

        var read = await store.ReadJsonOrDefaultAsync<RareItemExport>(
            "RareItems.json",
            CancellationToken.None
        );

        Assert.NotNull(read);
        Assert.Equal(generatedAt, read.GeneratedAt);
        Assert.Equal([item], read.Items);
        var owner = Assert.Single(read.Characters);
        Assert.Equal(("Ghø", "Tauri", "Guild"), (owner.Name, owner.Realm, owner.Guild));
        Assert.Equal([item], owner.Items);
    }

    [Fact]
    public async Task ReadJsonOrDefaultAsync_MissingOrUnreadableFile_ReturnsNull()
    {
        var store = new PlayerCsvStore(_outputDirectory);
        await store.WriteTextAsync("broken.json", "{\"generatedAt\":", CancellationToken.None);

        Assert.Null(
            await store.ReadJsonOrDefaultAsync<RareItemExport>(
                "missing.json",
                CancellationToken.None
            )
        );
        Assert.Null(
            await store.ReadJsonOrDefaultAsync<RareItemExport>(
                "broken.json",
                CancellationToken.None
            )
        );
    }

    public void Dispose()
    {
        if (Directory.Exists(_outputDirectory))
        {
            Directory.Delete(_outputDirectory, recursive: true);
        }
    }
}
