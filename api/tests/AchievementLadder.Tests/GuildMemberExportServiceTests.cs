using System.Collections.Concurrent;
using System.Text.Json;
using GuildAnalysisExporter;
using Tauri.Core.Infrastructure;

namespace AchievementLadder.Tests;

public sealed class GuildMemberExportServiceTests : IDisposable
{
    private readonly string _outputDirectory = Path.Combine(
        Path.GetTempPath(),
        $"guild-member-export-tests-{Guid.NewGuid():N}"
    );

    public void Dispose()
    {
        if (Directory.Exists(_outputDirectory))
        {
            Directory.Delete(_outputDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task ExportAsync_ExportsOnlyLevel110CharactersByTheirCharacterSheet()
    {
        var apiClient = new FakeGuildMemberApiClient(
            ["Delta", "Alpha", "Bravo", "Charlie"],
            new Dictionary<string, int>
            {
                ["Delta"] = 110,
                ["Alpha"] = 110,
                ["Bravo"] = 109,
            }
        );

        var result = await ExportAsync(apiClient);

        Assert.Equal(4, result.ScannedPlayerCount);
        Assert.Equal(2, result.PlayerCount);
        Assert.Equal(
            ["Alpha", "Delta"],
            (await ReadPlayersAsync(result.OutputPath)).Select(player =>
                player.GetProperty("name").GetString()
            )
        );
        Assert.Equal(["Alpha", "Delta"], apiClient.CharactersRequested("character-artifact"));
    }

    [Fact]
    public async Task ExportAsync_NeitherRequestsNorWritesReputation()
    {
        var apiClient = new FakeGuildMemberApiClient(
            ["Alpha"],
            new Dictionary<string, int> { ["Alpha"] = 110 }
        );

        var result = await ExportAsync(apiClient);

        Assert.Empty(apiClient.CharactersRequested("character-reputation"));
        var player = Assert.Single(await ReadPlayersAsync(result.OutputPath));
        Assert.DoesNotContain(
            player.EnumerateObject(),
            property => property.Name.Contains("reputation", StringComparison.OrdinalIgnoreCase)
        );
    }

    [Fact]
    public async Task ExportAsync_WithAMemberList_ScansThoseCharactersAsOneGuildWithoutGuildInfo()
    {
        var apiClient = new FakeGuildMemberApiClient(
            [],
            new Dictionary<string, int>
            {
                ["Xyhopwarlock"] = 110,
                ["Xyhop"] = 110,
                ["Xyhopdk"] = 101,
            }
        );

        var result = await ExportAsync(
            apiClient,
            "Xyhop",
            ["Xyhopwarlock", "Xyhop", "xyhop", " Xyhopdk "]
        );

        Assert.Equal(0, apiClient.GuildInfoRequests);
        Assert.Equal(3, result.ScannedPlayerCount);
        Assert.Equal(2, result.PlayerCount);
        Assert.Equal(Path.Combine(_outputDirectory, "xyhop.json"), result.OutputPath);
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(result.OutputPath));
        var root = document.RootElement;
        Assert.Equal("Xyhop", root.GetProperty("guild").GetProperty("name").GetString());
        Assert.Equal("Evermoon", root.GetProperty("guild").GetProperty("realm").GetString());
        Assert.Equal("Horde", root.GetProperty("guild").GetProperty("faction").GetString());
        var rank = Assert.Single(root.GetProperty("ranks").EnumerateArray());
        Assert.Equal(0, rank.GetProperty("order").GetInt32());
        Assert.Equal("Member", rank.GetProperty("name").GetString());
        var players = root.GetProperty("players").EnumerateArray().ToList();
        Assert.Equal(
            ["Xyhop", "Xyhopwarlock"],
            players.Select(player => player.GetProperty("name").GetString())
        );
        Assert.All(
            players,
            player => Assert.Equal("Member", player.GetProperty("guildRankName").GetString())
        );
    }

    private async Task<GuildMemberExportResult> ExportAsync(
        ITauriApiClient apiClient,
        string guildName = "Test Guild",
        IReadOnlyList<string>? memberNames = null
    )
    {
        using var itemClient = new TauriShootItemClient();
        return await new GuildMemberExportService(
            _outputDirectory,
            apiClient,
            itemClient
        ).ExportAsync("Evermoon", guildName, memberNames, CancellationToken.None);
    }

    private static async Task<IReadOnlyList<JsonElement>> ReadPlayersAsync(string outputPath)
    {
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(outputPath));
        return document
            .RootElement.GetProperty("players")
            .EnumerateArray()
            .Select(player => player.Clone())
            .ToList();
    }

    private sealed class FakeGuildMemberApiClient(
        IReadOnlyList<string> memberNames,
        IReadOnlyDictionary<string, int> levelsBySheet
    ) : ITauriApiClient
    {
        private readonly ConcurrentQueue<(string Endpoint, string Character)> _requests = new();
        private int _guildInfoRequests;

        public int GuildInfoRequests => _guildInfoRequests;

        public IReadOnlyList<string> CharactersRequested(string endpoint) =>
            _requests
                .Where(request => request.Endpoint == endpoint)
                .Select(request => request.Character)
                .ToList();

        public Task<TauriApiResponseResult> FetchResponseElementAsync(
            string endpoint,
            object parameters,
            string requestLabel,
            CancellationToken cancellationToken
        )
        {
            if (endpoint == "guild-info")
            {
                Interlocked.Increment(ref _guildInfoRequests);
                return Task.FromResult(GuildInfo());
            }

            var character = JsonSerializer
                .SerializeToElement(parameters)
                .GetProperty("n")
                .GetString()!;
            _requests.Enqueue((endpoint, character));

            return Task.FromResult(
                endpoint switch
                {
                    "character-sheet" when levelsBySheet.TryGetValue(character, out var level) =>
                        Success(
                            new
                            {
                                level,
                                race = 1,
                                gender = 0,
                                @class = 1,
                                faction_string_class = "Horde",
                            }
                        ),
                    "character-artifact" => Success(new { artifacts = Array.Empty<object>() }),
                    _ => TauriApiResponseResult.Failure("Request timed out."),
                }
            );
        }

        private TauriApiResponseResult GuildInfo()
        {
            var guildList = memberNames
                .Select((name, index) => (name, index))
                .ToDictionary(
                    member => member.index.ToString(),
                    member => new
                    {
                        name = member.name,
                        rank = 1,
                        rank_name = "Member",
                    }
                );
            return Success(new { guildList, faction = 0 });
        }

        private static TauriApiResponseResult Success(object response) =>
            TauriApiResponseResult.Success(JsonSerializer.SerializeToElement(response));
    }
}
