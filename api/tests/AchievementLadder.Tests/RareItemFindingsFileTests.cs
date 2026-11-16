using System.Text.Json;
using AchievementLadder.Services;
using Tauri.Core.Models;

namespace AchievementLadder.Tests;

public sealed class RareItemFindingsFileTests : IDisposable
{
    private static readonly DateTimeOffset LastNight = new(2026, 11, 15, 1, 30, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Tonight = new(2026, 11, 16, 1, 34, 0, TimeSpan.Zero);

    private readonly string _directory = Path.Combine(
        Path.GetTempPath(),
        $"rare-item-findings-tests-{Guid.NewGuid():N}"
    );

    private string FilePath => Path.Combine(_directory, RareItemFindingsFile.FileName);

    [Fact]
    public async Task WriteAsync_ThenReadAsync_GivesTheSameFindings()
    {
        var findings = Sample();

        await RareItemFindingsFile.WriteAsync(FilePath, findings, CancellationToken.None);
        var read = await RareItemFindingsFile.ReadAsync(FilePath, CancellationToken.None);

        Assert.NotNull(read);
        Assert.Equal(findings.Version, read.Version);
        Assert.Equal(findings.Scans, read.Scans);
        var character = Assert.Single(read.Characters);
        Assert.Equal(findings.Characters[0] with { Items = [] }, character with { Items = [] });
        Assert.Equal(findings.Characters[0].Items, character.Items);
    }

    [Fact]
    public async Task WriteAsync_PutsEachScanAndCharacterOnItsOwnLine()
    {
        await RareItemFindingsFile.WriteAsync(FilePath, Sample(), CancellationToken.None);
        var content = await File.ReadAllTextAsync(FilePath, CancellationToken.None);

        Assert.DoesNotContain('\r', content);
        var lines = content.Split('\n');
        Assert.Equal("{\"version\":1,\"scans\":[", lines[0]);
        Assert.Equal(
            "{\"generatedAt\":\"2026-11-16T01:34:00+00:00\",\"previousGeneratedAt\":\"2026-11-15T01:30:00+00:00\"}],\"characters\":[",
            lines[1]
        );
        Assert.StartsWith(
            "{\"scan\":\"2026-11-16T01:34:00+00:00\",\"name\":\"Ghø\",\"realm\":\"Tauri\"",
            lines[2]
        );
        Assert.Contains("\"isNew\":true", lines[2]);
        Assert.Contains(
            "{\"id\":84434,\"name\":\"Malevolent Gladiator's Leather Helm\"}",
            lines[2]
        );
        Assert.EndsWith("}]}", lines[2]);
        Assert.Equal(3, lines.Length);
    }

    [Fact]
    public async Task ReadAsync_MissingFile_ReturnsNull()
    {
        Assert.Null(await RareItemFindingsFile.ReadAsync(FilePath, CancellationToken.None));
    }

    [Fact]
    public async Task ReadAsync_AnotherVersion_ReturnsNull()
    {
        Directory.CreateDirectory(_directory);
        await File.WriteAllTextAsync(
            FilePath,
            """{"version":2,"scans":[],"characters":[]}""",
            CancellationToken.None
        );

        Assert.Null(await RareItemFindingsFile.ReadAsync(FilePath, CancellationToken.None));
    }

    [Fact]
    public async Task ReadAsync_UnreadableFile_ReturnsNull()
    {
        Directory.CreateDirectory(_directory);
        await File.WriteAllTextAsync(FilePath, "{\"version\":1,", CancellationToken.None);

        Assert.Null(await RareItemFindingsFile.ReadAsync(FilePath, CancellationToken.None));
    }

    private static RareItemFindingsExport Sample() =>
        new(
            RareItemFindings.FormatVersion,
            [new RareItemFindingsScan(Tonight, LastNight)],
            [
                new RareItemFinding(
                    Tonight,
                    "Ghø",
                    "Tauri",
                    4,
                    0,
                    4,
                    "",
                    true,
                    [
                        new RareItemDefinition(84434, "Malevolent Gladiator's Leather Helm"),
                        new RareItemDefinition(22691, "Corrupted Ashbringer"),
                    ]
                ),
            ]
        );

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, recursive: true);
        }
    }
}
