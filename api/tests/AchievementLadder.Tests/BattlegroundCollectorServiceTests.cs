using System.Text.Json;
using BattlegroundCollector;
using Tauri.Core.Infrastructure;

namespace AchievementLadder.Tests;

public sealed class BattlegroundCollectorServiceTests
{
    [Fact]
    public async Task ExecuteAsync_AppendsOnlyNewRankedFullResponses()
    {
        var testRoot = Path.Combine(
            Path.GetTempPath(),
            $"battleground-collector-tests-{Guid.NewGuid():N}"
        );
        var projectRoot = Path.Combine(testRoot, "BattlegroundCollector");
        var frontendSrc = Path.Combine(testRoot, "frontend", "src");
        Directory.CreateDirectory(projectRoot);
        Directory.CreateDirectory(frontendSrc);

        try
        {
            var ratedOutputPath = Path.Combine(frontendSrc, "rated-battlegrounds.json");
            await File.WriteAllTextAsync(
                ratedOutputPath,
                """
                [
                  {
                    "matchid": 100,
                    "isranked": true,
                    "sentinel": "existing"
                  }
                ]
                """
            );

            var apiClient = new MatchSequenceApiClient(
                new Dictionary<int, TauriApiResponseResult>
                {
                    [100] = Success(MatchJson(100, "Warsong Gulch", isRanked: true, "duplicate")),
                    [101] = Success(MatchJson(101, "Warsong Gulch", isRanked: false, "unranked")),
                    [102] = Success(
                        MatchJson(102, "Warsong Gulch", isRanked: true, "complete-response")
                    ),
                    [103] = Success(
                        MatchJson(103, "Blade's Edge Arena", isRanked: true, "rated-arena")
                    ),
                }
            );
            var collector = new BattlegroundCollectorService(
                projectRoot,
                testRoot,
                frontendSrc,
                apiClient
            );
            var options = new BattlegroundCollectorOptions(
                100,
                "[EN] Evermoon",
                "Evermoon",
                null,
                null
            );

            var result = await collector.ExecuteAsync(options, CancellationToken.None);

            Assert.Equal(1, result.NewRatedBattlegroundCount);
            Assert.Equal(2, result.TotalRatedBattlegroundCount);
            Assert.Equal(ratedOutputPath, result.RatedOutputPath);

            using var output = JsonDocument.Parse(await File.ReadAllTextAsync(ratedOutputPath));
            var matches = output.RootElement.EnumerateArray().ToList();
            Assert.Equal(
                [100, 102],
                matches.Select(match => match.GetProperty("matchid").GetInt32())
            );
            Assert.Equal("existing", matches[0].GetProperty("sentinel").GetString());
            Assert.Equal("complete-response", matches[1].GetProperty("sentinel").GetString());
            Assert.True(matches[1].GetProperty("nested").GetProperty("preserved").GetBoolean());
        }
        finally
        {
            if (Directory.Exists(testRoot))
            {
                Directory.Delete(testRoot, recursive: true);
            }
        }
    }

    [Fact]
    public async Task ExecuteAsync_KeepsTheLatestScanThatAddedRatedMatchesInTheState()
    {
        var testRoot = Path.Combine(
            Path.GetTempPath(),
            $"battleground-collector-tests-{Guid.NewGuid():N}"
        );
        var projectRoot = Path.Combine(testRoot, "BattlegroundCollector");
        var frontendSrc = Path.Combine(testRoot, "frontend", "src");
        Directory.CreateDirectory(projectRoot);
        Directory.CreateDirectory(frontendSrc);

        try
        {
            var statePath = Path.Combine(frontendSrc, "battleground-collector-state.json");
            await File.WriteAllTextAsync(
                statePath,
                """
                {
                  "nextMatchId": 200,
                  "apiRealm": "[EN] Evermoon",
                  "displayRealm": "Evermoon",
                  "lastScanUtc": "2026-10-26T23:10:45+00:00",
                  "lastStopReason": "Response did not contain complete battleground details.",
                  "lastAddedCount": 3,
                  "lastAddedMatchId": 199
                }
                """
            );
            var apiClient = new MatchSequenceApiClient(
                new Dictionary<int, TauriApiResponseResult>
                {
                    [200] = Success(MatchJson(200, "Warsong Gulch", isRanked: true, "first")),
                    [201] = Success(MatchJson(201, "Twin Peaks", isRanked: false, "unranked")),
                    [202] = Success(MatchJson(202, "Twin Peaks", isRanked: true, "second")),
                }
            );
            var collector = new BattlegroundCollectorService(
                projectRoot,
                testRoot,
                frontendSrc,
                apiClient
            );
            var options = new BattlegroundCollectorOptions(
                null,
                "[EN] Evermoon",
                "Evermoon",
                null,
                null
            );

            await collector.ExecuteAsync(options, CancellationToken.None);
            var afterNewMatches = await ReadStateAsync(statePath);

            Assert.Equal(
                new DateTimeOffset(2026, 10, 26, 23, 10, 45, TimeSpan.Zero),
                afterNewMatches.NewRatedMatchesSince
            );
            Assert.Equal([200, 202], afterNewMatches.NewRatedMatchIds!);
            Assert.Equal(203, afterNewMatches.NextMatchId);

            await collector.ExecuteAsync(options, CancellationToken.None);
            var afterQuietScan = await ReadStateAsync(statePath);

            Assert.True(afterQuietScan.LastScanUtc >= afterNewMatches.LastScanUtc);
            Assert.Equal(afterNewMatches.NewRatedMatchesSince, afterQuietScan.NewRatedMatchesSince);
            Assert.Equal([200, 202], afterQuietScan.NewRatedMatchIds!);
        }
        finally
        {
            if (Directory.Exists(testRoot))
            {
                Directory.Delete(testRoot, recursive: true);
            }
        }
    }

    private static async Task<BattlegroundCollectorState> ReadStateAsync(string statePath) =>
        JsonSerializer.Deserialize<BattlegroundCollectorState>(
            await File.ReadAllTextAsync(statePath),
            new JsonSerializerOptions(JsonSerializerDefaults.Web)
        )!;

    private static string MatchJson(int matchId, string mapName, bool isRanked, string sentinel) =>
        $$"""
            {
              "matchid": {{matchId}},
              "mapname": "{{mapName}}",
              "starttime": 1789700000,
              "length": 600000,
              "isranked": {{isRanked.ToString().ToLowerInvariant()}},
              "sentinel": "{{sentinel}}",
              "nested": { "preserved": true },
              "members": []
            }
            """;

    private static TauriApiResponseResult Success(string json) =>
        TauriApiResponseResult.Success(JsonDocument.Parse(json).RootElement.Clone());

    private sealed class MatchSequenceApiClient(
        IReadOnlyDictionary<int, TauriApiResponseResult> responses
    ) : ITauriApiClient
    {
        public Task<TauriApiResponseResult> FetchResponseElementAsync(
            string endpoint,
            object parameters,
            string requestLabel,
            CancellationToken cancellationToken
        )
        {
            cancellationToken.ThrowIfCancellationRequested();
            Assert.Equal("pvp-match", endpoint);

            var parametersJson = JsonSerializer.SerializeToElement(parameters);
            var matchId = int.Parse(parametersJson.GetProperty("matchid").GetString()!);
            return Task.FromResult(
                responses.TryGetValue(matchId, out var response)
                    ? response
                    : TauriApiResponseResult.Failure("End of fake match sequence.")
            );
        }
    }
}
