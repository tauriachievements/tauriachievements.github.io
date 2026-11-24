using System.Collections.Concurrent;
using System.Text.Json;
using RatedBgRosterExporter;
using Tauri.Core.Infrastructure;

namespace AchievementLadder.Tests;

public sealed class RatedBgRosterExportServiceTests : IDisposable
{
    private static readonly DateTimeOffset GeneratedAt = new(2026, 11, 24, 18, 5, 0, TimeSpan.Zero);

    private readonly string _outputDirectory = Path.Combine(
        Path.GetTempPath(),
        $"rated-bg-roster-tests-{Guid.NewGuid():N}"
    );

    public void Dispose()
    {
        if (Directory.Exists(_outputDirectory))
        {
            Directory.Delete(_outputDirectory, recursive: true);
        }
    }

    [Fact]
    public void Parse_ReadsOneNameRealmPerLine()
    {
        var characters = RatedBgRosterList.Parse([
            "# Rated BG players",
            "Xyhop-Evermoon,",
            "",
            "  Morron-tauri  ",
            "Lakmir-WoD",
        ]);

        Assert.Equal(
            [
                new RosterCharacter("Xyhop", "[EN] Evermoon", "Evermoon"),
                new RosterCharacter("Morron", "[HU] Tauri WoW Server", "Tauri"),
                new RosterCharacter("Lakmir", "[HU] Warriors of Darkness", "WoD"),
            ],
            characters
        );
    }

    [Fact]
    public void Parse_RejectsALineThatIsNotNameRealm()
    {
        var error = Assert.Throws<FormatException>(() =>
            RatedBgRosterList.Parse(["Xyhop-Evermoon", "Zowy", "Pesi-Outland"])
        );

        Assert.Contains("Line 2", error.Message);
        Assert.Contains("Line 3", error.Message);
    }

    [Fact]
    public void Parse_RejectsACharacterListedTwice()
    {
        var error = Assert.Throws<FormatException>(() =>
            RatedBgRosterList.Parse(["Xyhop-Evermoon", "Zowy-Evermoon", "xyhop-evermoon"])
        );

        Assert.Contains("Line 3", error.Message);
    }

    [Fact]
    public void Parse_RejectsAListWithNoPlayers()
    {
        Assert.Throws<FormatException>(() => RatedBgRosterList.Parse(["# nobody yet", ""]));
    }

    [Fact]
    public async Task ExportAsync_WritesEachCharactersRaceClassSpecTraitsAndItemLevelInListOrder()
    {
        var apiClient = new FakeArtifactApiClient(
            new Dictionary<string, object>
            {
                ["Xyhop"] = Character(
                    "Xyhop",
                    race: 9,
                    gender: 1,
                    @class: 5,
                    itemLevel: 886,
                    Artifact(128868, 30),
                    Artifact(128827, 4, 38)
                ),
                ["Heaven"] = Character(
                    "Heaven",
                    race: 6,
                    gender: 1,
                    @class: 11,
                    itemLevel: 891,
                    Artifact(128860, 46)
                ),
            }
        );

        var result = await ExportAsync(
            apiClient,
            new RosterCharacter("Xyhop", "[EN] Evermoon", "Evermoon"),
            new RosterCharacter("Heaven", "[HU] Tauri WoW Server", "Tauri")
        );

        var file = await ReadFileAsync(result.OutputPath);
        Assert.Equal(1, file.GetProperty("version").GetInt32());
        Assert.Equal("2026-11-24T18:05:00Z", file.GetProperty("generatedAt").GetString());
        var players = file.GetProperty("players").EnumerateArray().ToList();
        Assert.Equal(
            """{"name":"Xyhop","realm":"Evermoon","race":9,"gender":1,"class":5,"spec":"Shadow","traits":42,"itemLevel":886}""",
            players[0].GetRawText()
        );
        Assert.Equal(
            """{"name":"Heaven","realm":"Tauri","race":6,"gender":1,"class":11,"spec":"Feral","traits":46,"itemLevel":891}""",
            players[1].GetRawText()
        );
        Assert.Equal(
            ["character-artifact", "character-artifact"],
            apiClient.Requests.Select(request => request.Endpoint)
        );
    }

    [Fact]
    public async Task ExportAsync_WritesOnePlayerPerLine()
    {
        var apiClient = new FakeArtifactApiClient(
            new Dictionary<string, object>
            {
                ["Xyhop"] = Character("Xyhop", 9, 1, 5, 886),
                ["Zowy"] = Character("Zowy", 1, 0, 1, 887),
            }
        );

        var result = await ExportAsync(
            apiClient,
            new RosterCharacter("Xyhop", "[EN] Evermoon", "Evermoon"),
            new RosterCharacter("Zowy", "[EN] Evermoon", "Evermoon")
        );

        var lines = (await File.ReadAllTextAsync(result.OutputPath)).Split('\n');
        Assert.StartsWith("{\"name\":\"Xyhop\"", lines[1]);
        Assert.StartsWith("{\"name\":\"Zowy\"", lines[2]);
        Assert.DoesNotContain('\r', await File.ReadAllTextAsync(result.OutputPath));
    }

    [Fact]
    public async Task ExportAsync_NamesTheCharacterAsTheArmorySpellsIt()
    {
        var apiClient = new FakeArtifactApiClient(
            new Dictionary<string, object>
            {
                ["bomboclats"] = Character("Bomboclats", 3, 0, 3, 885),
            }
        );

        var result = await ExportAsync(
            apiClient,
            new RosterCharacter("bomboclats", "[EN] Evermoon", "Evermoon")
        );

        Assert.Equal(
            "Bomboclats",
            (await ReadPlayersAsync(result.OutputPath))[0].GetProperty("name").GetString()
        );
    }

    [Fact]
    public async Task ExportAsync_WithoutAnArtifactTakesTheActiveSpec()
    {
        var apiClient = new FakeArtifactApiClient(
            new Dictionary<string, object> { ["Heaven"] = Character("Heaven", 10, 1, 4, 2) }
        );

        var result = await ExportAsync(
            apiClient,
            new RosterCharacter("Heaven", "[EN] Evermoon", "Evermoon")
        );

        var player = (await ReadPlayersAsync(result.OutputPath))[0];
        Assert.Equal("Subtlety", player.GetProperty("spec").GetString());
        Assert.Equal(0, player.GetProperty("traits").GetInt32());
        Assert.Equal(2, player.GetProperty("itemLevel").GetInt32());
    }

    [Fact]
    public async Task ExportAsync_KeepsACharacterTheArmoryDoesNotFindWithoutDetails()
    {
        var apiClient = new FakeArtifactApiClient(
            new Dictionary<string, object> { ["Xyhop"] = Character("Xyhop", 9, 1, 5, 886) },
            notFound: ["Typo"]
        );

        var result = await ExportAsync(
            apiClient,
            new RosterCharacter("Typo", "[EN] Evermoon", "Evermoon"),
            new RosterCharacter("Xyhop", "[EN] Evermoon", "Evermoon")
        );

        var players = await ReadPlayersAsync(result.OutputPath);
        Assert.Equal(
            """{"name":"Typo","realm":"Evermoon","notFound":true}""",
            players[0].GetRawText()
        );
        Assert.Equal(["Typo"], result.NotFound.Select(player => player.Name));
    }

    [Fact]
    public async Task ExportAsync_WritesNothingWhenACharacterCouldNotBeRead()
    {
        Directory.CreateDirectory(_outputDirectory);
        var outputPath = Path.Combine(_outputDirectory, RatedBgRosterExportService.FileName);
        await File.WriteAllTextAsync(outputPath, "previous");
        var apiClient = new FakeArtifactApiClient(
            new Dictionary<string, object> { ["Xyhop"] = Character("Xyhop", 9, 1, 5, 886) }
        );

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            ExportAsync(
                apiClient,
                new RosterCharacter("Xyhop", "[EN] Evermoon", "Evermoon"),
                new RosterCharacter("Zowy", "[EN] Evermoon", "Evermoon")
            )
        );

        Assert.Contains("Zowy-Evermoon", error.Message);
        Assert.Equal("previous", await File.ReadAllTextAsync(outputPath));
    }

    private Task<RatedBgRosterExportResult> ExportAsync(
        ITauriApiClient apiClient,
        params RosterCharacter[] characters
    ) =>
        new RatedBgRosterExportService(_outputDirectory, apiClient).ExportAsync(
            characters,
            GeneratedAt,
            CancellationToken.None
        );

    private static async Task<JsonElement> ReadFileAsync(string path)
    {
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(path));
        return document.RootElement.Clone();
    }

    private static async Task<IReadOnlyList<JsonElement>> ReadPlayersAsync(string path) =>
        (await ReadFileAsync(path)).GetProperty("players").EnumerateArray().ToList();

    private static object Character(
        string name,
        int race,
        int gender,
        int @class,
        int itemLevel,
        params object[] artifacts
    ) =>
        new
        {
            name,
            race,
            gender,
            @class,
            level = 110,
            avgitemlevel = itemLevel,
            activeSpec = 2,
            talents_legion_2 = "rogue&subtlety",
            artifact_knowledge = 25,
            artifacts,
        };

    private static object Artifact(int id, params int[] ranks) =>
        new
        {
            ID = id,
            name = $"Artifact {id}",
            artifact = new
            {
                artifactpowers = ranks.Select(rank => new { purchasedrank = rank }).ToArray(),
            },
        };

    private sealed class FakeArtifactApiClient(
        IReadOnlyDictionary<string, object> charactersByName,
        IReadOnlyList<string>? notFound = null
    ) : ITauriApiClient
    {
        private readonly ConcurrentQueue<(string Endpoint, string Name)> _requests = new();

        public IReadOnlyList<(string Endpoint, string Name)> Requests => _requests.ToList();

        public Task<TauriApiResponseResult> FetchResponseElementAsync(
            string endpoint,
            object parameters,
            string requestLabel,
            CancellationToken cancellationToken
        )
        {
            var name = JsonSerializer.SerializeToElement(parameters).GetProperty("n").GetString()!;
            _requests.Enqueue((endpoint, name));

            if (
                endpoint == "character-artifact"
                && charactersByName.TryGetValue(name, out var character)
            )
            {
                return Task.FromResult(
                    TauriApiResponseResult.Success(JsonSerializer.SerializeToElement(character))
                );
            }

            return Task.FromResult(
                notFound?.Contains(name) == true
                    ? TauriApiResponseResult.Failure(
                        "character not found",
                        TauriApiResponseResult.CharacterNotFoundErrorCode
                    )
                    : TauriApiResponseResult.Failure("Request timed out.")
            );
        }
    }
}
