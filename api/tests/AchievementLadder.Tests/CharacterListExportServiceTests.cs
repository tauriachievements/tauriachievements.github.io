using System.Collections.Concurrent;
using System.Text.Json;
using CharacterListExporter;
using Tauri.Core.Infrastructure;

namespace AchievementLadder.Tests;

public sealed class CharacterListExportServiceTests : IDisposable
{
    private const string Evermoon = "[EN] Evermoon";

    private static readonly DateTimeOffset Now = new(2026, 11, 4, 20, 0, 5, TimeSpan.Zero);

    private readonly string _outputDirectory = Path.Combine(
        Path.GetTempPath(),
        $"character-list-tests-{Guid.NewGuid():N}"
    );

    private string ListPath => Path.Combine(_outputDirectory, "character-lists", "xyhop.json");

    public void Dispose()
    {
        if (Directory.Exists(_outputDirectory))
        {
            Directory.Delete(_outputDirectory, recursive: true);
        }
    }

    [Fact]
    public void TryParse_ReadsTheRealmTheListAndEachNameOnce()
    {
        var parsed = CharacterListExporterOptions.TryParse(
            ["evermoon", "xyhop", "Xyhop", "Xyhopdh", "xyhop", "--allow-shrink"],
            out var options,
            out var errorMessage,
            out var showHelp
        );

        Assert.True(parsed, errorMessage);
        Assert.False(showHelp);
        Assert.Equal("Evermoon", options!.Realm);
        Assert.Equal(Evermoon, options.ApiRealm);
        Assert.Equal("xyhop", options.List);
        Assert.Equal(["Xyhop", "Xyhopdh"], options.Names);
        Assert.True(options.AllowShrink);
    }

    [Theory]
    [InlineData("Narnia", "xyhop", "Xyhop")]
    [InlineData("Evermoon", "../xyhop", "Xyhop")]
    [InlineData("Evermoon", "Xyhop-List", "Xyhop")]
    [InlineData("Evermoon", "xyhop", "--everyone")]
    public void TryParse_RejectsAnUnknownRealmABadListNameOrAnUnknownOption(
        string realm,
        string list,
        string name
    )
    {
        Assert.False(
            CharacterListExporterOptions.TryParse([realm, list, name], out _, out var error, out _)
        );
        Assert.False(string.IsNullOrWhiteSpace(error));
    }

    [Fact]
    public void TryParse_NeedsAtLeastOneCharacter()
    {
        Assert.False(
            CharacterListExporterOptions.TryParse(
                ["Evermoon", "xyhop"],
                out _,
                out var error,
                out _
            )
        );
        Assert.False(string.IsNullOrWhiteSpace(error));
    }

    [Fact]
    public async Task ExportAsync_WritesEachCharacterOnItsOwnLineInNameOrder()
    {
        var apiClient = new FakeCharacterApiClient(
            new() { ["Xyhopwarlock"] = Warlock(), ["xyhop"] = Priest() }
        );

        var result = await ExportAsync(apiClient, ["Xyhopwarlock", "xyhop"]);

        Assert.True(File.Exists(ListPath));
        Assert.Equal(ListPath, result.Path);
        Assert.Equal(0, result.PreviousCount);
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(ListPath));
        var root = document.RootElement;
        Assert.Equal(1, root.GetProperty("version").GetInt32());
        Assert.Equal("Evermoon", root.GetProperty("realm").GetString());
        Assert.Equal("2026-11-04T20:00:05Z", root.GetProperty("generatedAt").GetString());
        var characters = root.GetProperty("characters").EnumerateArray().ToList();
        Assert.Equal(
            ["Xyhop", "Xyhopwarlock"],
            characters.Select(character => character.GetProperty("name").GetString())
        );
        Assert.Equal(
            """{"name":"Xyhop","class":5,"spec":"Shadow","level":110,"itemLevel":873.33,"traits":33,"artifactKnowledge":22,"campaign":true,"orderHall":6}""",
            characters[0].GetRawText()
        );
        Assert.Equal(
            """{"name":"Xyhopwarlock","class":9,"spec":"Affliction","level":101,"itemLevel":700,"traits":0,"artifactKnowledge":0,"campaign":false,"orderHall":0}""",
            characters[1].GetRawText()
        );
        Assert.Equal(3, (await File.ReadAllLinesAsync(ListPath)).Length);
        Assert.All(apiClient.Realms, realm => Assert.Equal(Evermoon, realm));
    }

    [Fact]
    public async Task ExportAsync_WritesNothingWhenACharacterIsNotFound()
    {
        var apiClient = new FakeCharacterApiClient(new() { ["Xyhop"] = Priest() });

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            ExportAsync(apiClient, ["Xyhop", "Xyhoppaladin"])
        );

        Assert.Contains("Xyhoppaladin", error.Message);
        Assert.Contains("not found", error.Message);
        Assert.False(File.Exists(ListPath));
    }

    [Fact]
    public async Task ExportAsync_WritesNothingWhenAnyRequestFails()
    {
        WriteExistingList("Xyhop");
        var before = await File.ReadAllTextAsync(ListPath);
        var apiClient = new FakeCharacterApiClient(
            new() { ["Xyhop"] = Priest() with { Achievements = null } }
        );

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            ExportAsync(apiClient, ["Xyhop"])
        );

        Assert.Contains("Xyhop", error.Message);
        Assert.Equal(before, await File.ReadAllTextAsync(ListPath));
    }

    [Fact]
    public async Task ExportAsync_RefusesAShorterListUnlessAllowed()
    {
        WriteExistingList("Xyhop", "Xyhopwarlock", "Xyhopdh");
        var before = await File.ReadAllTextAsync(ListPath);
        var apiClient = new FakeCharacterApiClient(
            new() { ["Xyhop"] = Priest(), ["Xyhopwarlock"] = Warlock() }
        );

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            ExportAsync(apiClient, ["Xyhop", "Xyhopwarlock"])
        );
        Assert.Contains("--allow-shrink", error.Message);
        Assert.Equal(before, await File.ReadAllTextAsync(ListPath));

        var result = await ExportAsync(apiClient, ["Xyhop", "Xyhopwarlock"], allowShrink: true);

        Assert.Equal(3, result.PreviousCount);
        Assert.Equal(2, result.Characters.Count);
    }

    private Task<CharacterListExportResult> ExportAsync(
        ITauriApiClient apiClient,
        IReadOnlyList<string> names,
        bool allowShrink = false
    ) =>
        new CharacterListExportService(
            _outputDirectory,
            apiClient,
            new FixedTimeProvider(Now)
        ).ExportAsync(
            new CharacterListExporterOptions("Evermoon", Evermoon, "xyhop", names, allowShrink),
            CancellationToken.None
        );

    private void WriteExistingList(params string[] names)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(ListPath)!);
        File.WriteAllText(
            ListPath,
            JsonSerializer.Serialize(
                new
                {
                    version = 1,
                    realm = "Evermoon",
                    generatedAt = "2026-11-03T20:00:00Z",
                    characters = names.Select(name => new { name }),
                }
            )
        );
    }

    private static FakeCharacter Priest() =>
        new(
            """
            {
              "name": "Xyhop",
              "class": 5,
              "level": 110,
              "activeSpec": 2,
              "talents_legion_0": "priest&discipline&a",
              "talents_legion_2": "priest&shadow&b",
              "talents_classhall": [{ "id": 446 }, { "id": 449 }, { "id": 450 }, { "id": 452 }, { "id": 456 }, { "id": 448 }],
              "characterItems": [
                { "InventoryType": 1, "ilevel": 880, "rarity": 4 },
                { "InventoryType": 17, "ilevel": 870, "rarity": 6, "artifact": {} }
              ]
            }
            """,
            """
            {
              "artifact_knowledge": 22,
              "artifacts": [
                { "ID": 128827, "artifact": { "artifactpowers": [{ "purchasedrank": 20 }, { "purchasedrank": 13 }] } },
                { "ID": 128868, "artifact": { "artifactpowers": [{ "purchasedrank": 3 }] } }
              ]
            }
            """,
            """{ "Achievements": { "6": { "name": "Level 10" }, "10994": { "name": "A Glorious Campaign" } } }"""
        );

    private static FakeCharacter Warlock() =>
        new(
            """
            {
              "name": "Xyhopwarlock",
              "class": 9,
              "level": 101,
              "activeSpec": 0,
              "talents_legion_0": "warlock&affliction&c",
              "talents_classhall": [],
              "characterItems": [{ "InventoryType": 1, "ilevel": 700, "rarity": 3 }]
            }
            """,
            """{ "artifact_knowledge": 0, "artifacts": [] }""",
            """{ "Achievements": [] }"""
        );

    private sealed record FakeCharacter(string? Sheet, string? Artifact, string? Achievements);

    private sealed class FakeCharacterApiClient(Dictionary<string, FakeCharacter> characters)
        : ITauriApiClient
    {
        private readonly ConcurrentQueue<string> _realms = new();

        public IReadOnlyCollection<string> Realms => _realms;

        public Task<TauriApiResponseResult> FetchResponseElementAsync(
            string endpoint,
            object parameters,
            string requestLabel,
            CancellationToken cancellationToken
        )
        {
            var request = JsonSerializer.SerializeToElement(parameters);
            _realms.Enqueue(request.GetProperty("r").GetString()!);
            var name = request.GetProperty("n").GetString()!;

            if (!characters.TryGetValue(name, out var character))
            {
                return Task.FromResult(
                    TauriApiResponseResult.Failure(
                        "API returned 400 Bad Request (error 6: character not found)",
                        TauriApiResponseResult.CharacterNotFoundErrorCode
                    )
                );
            }

            var json = endpoint switch
            {
                "character-sheet" => character.Sheet,
                "character-artifact" => character.Artifact,
                "character-achievements" => character.Achievements,
                _ => null,
            };
            return Task.FromResult(
                json is null
                    ? TauriApiResponseResult.Failure("Request timed out after 30 seconds.")
                    : TauriApiResponseResult.Success(JsonDocument.Parse(json).RootElement.Clone())
            );
        }
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
