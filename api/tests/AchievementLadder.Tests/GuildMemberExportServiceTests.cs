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

    private async Task<GuildMemberExportResult> ExportAsync(ITauriApiClient apiClient)
    {
        using var itemClient = new TauriShootItemClient();
        return await new GuildMemberExportService(
            _outputDirectory,
            apiClient,
            itemClient
        ).ExportAsync("Evermoon", "Test Guild", CancellationToken.None);
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
