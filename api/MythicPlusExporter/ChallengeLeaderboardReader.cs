using System.Collections.Concurrent;
using System.Diagnostics;
using Tauri.Core.Infrastructure;

namespace MythicPlusExporter;

public sealed record ChallengeLeaderboards(
    IReadOnlyDictionary<int, IReadOnlyList<ChallengeRun>> RunsByChallengeId,
    IReadOnlyList<string> Failures
);

public sealed class ChallengeLeaderboardReader(
    ITauriApiClient apiClient,
    TextWriter? progress = null,
    int retryRounds = 0,
    TimeSpan retryPause = default
)
{
    private const string IndexEndpoint = "challenge-index";
    private const string LeaderboardEndpoint = "challenge-leaderboard";
    private const int MaxParallelLeaderboards = 4;

    private readonly TextWriter _progress = progress ?? Console.Out;

    public async Task<ChallengeIndex> ReadIndexAsync(
        string realm,
        CancellationToken cancellationToken
    )
    {
        var result = await apiClient.FetchResponseElementAsync(
            IndexEndpoint,
            new { r = realm },
            $"challenge index ({realm})",
            cancellationToken
        );

        if (!result.Succeeded || result.ResponseElement is not { } response)
        {
            throw new InvalidOperationException(
                $"Could not read the challenge index: {result.FailureMessage}"
            );
        }

        var index = ChallengeResponseParser.ParseIndex(response);
        if (index.Maps.Count == 0)
        {
            throw new InvalidOperationException("challenge-index returned no challenge maps.");
        }

        return index with
        {
            Maps = [.. index.Maps.Where(map => MythicPlusCatalog.IsReleased(map.ChallengeId))],
        };
    }

    public async Task<ChallengeLeaderboards> ReadLeaderboardsAsync(
        ChallengeIndex index,
        IReadOnlyList<string> realms,
        CancellationToken cancellationToken
    )
    {
        var runsByChallengeId = new ConcurrentDictionary<int, IReadOnlyList<ChallengeRun>>();
        var failures = await ReadRoundAsync(
            index.Maps,
            realms,
            runsByChallengeId,
            cancellationToken
        );

        for (var round = 1; round <= retryRounds && failures.Count > 0; round++)
        {
            _progress.WriteLine(
                MythicPlusConsoleReport.RetryingLeaderboards(
                    failures.Count,
                    round,
                    retryRounds,
                    retryPause
                )
            );
            await Task.Delay(retryPause, cancellationToken);
            failures = await ReadRoundAsync(
                [.. failures.Select(failure => failure.Map)],
                realms,
                runsByChallengeId,
                cancellationToken
            );
        }

        return new ChallengeLeaderboards(
            runsByChallengeId,
            [.. failures.Select(failure => failure.Message).Order(StringComparer.Ordinal)]
        );
    }

    private async Task<List<(ChallengeMap Map, string Message)>> ReadRoundAsync(
        IReadOnlyList<ChallengeMap> maps,
        IReadOnlyList<string> realms,
        ConcurrentDictionary<int, IReadOnlyList<ChallengeRun>> runsByChallengeId,
        CancellationToken cancellationToken
    )
    {
        var failures = new ConcurrentDictionary<int, string>();
        var progressLock = new Lock();
        var finished = 0;

        await Parallel.ForEachAsync(
            maps,
            new ParallelOptions
            {
                MaxDegreeOfParallelism = MaxParallelLeaderboards,
                CancellationToken = cancellationToken,
            },
            async (map, token) =>
            {
                var started = Stopwatch.GetTimestamp();
                var (runs, failure) = await ReadLeaderboardAsync(map, realms, token);
                var elapsed = Stopwatch.GetElapsedTime(started);

                if (failure is null)
                {
                    runsByChallengeId[map.ChallengeId] = runs;
                }
                else
                {
                    failures[map.ChallengeId] = failure;
                }

                lock (progressLock)
                {
                    finished++;
                    _progress.WriteLine(
                        failure is null
                            ? MythicPlusConsoleReport.LeaderboardRead(
                                finished,
                                maps.Count,
                                map.Name,
                                runs.Count,
                                elapsed
                            )
                            : MythicPlusConsoleReport.LeaderboardFailed(
                                finished,
                                maps.Count,
                                map.Name,
                                elapsed
                            )
                    );
                }
            }
        );

        return
        [
            .. maps.Where(map => failures.ContainsKey(map.ChallengeId))
                .Select(map => (map, failures[map.ChallengeId])),
        ];
    }

    private async Task<(List<ChallengeRun> Runs, string? Failure)> ReadLeaderboardAsync(
        ChallengeMap map,
        IReadOnlyList<string> realms,
        CancellationToken cancellationToken
    )
    {
        var runs = new List<ChallengeRun>();
        foreach (var realm in realms)
        {
            var result = await apiClient.FetchResponseElementAsync(
                LeaderboardEndpoint,
                new { r = realm, id = map.ChallengeId },
                $"{map.Name} ({realm})",
                cancellationToken
            );

            if (!result.Succeeded || result.ResponseElement is not { } response)
            {
                return (runs, $"{map.Name} ({realm}): {result.FailureMessage}");
            }

            runs.AddRange(ChallengeResponseParser.ParseLeaderboard(response));
        }

        return (runs, null);
    }
}
