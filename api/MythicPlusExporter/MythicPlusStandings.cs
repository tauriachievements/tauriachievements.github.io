namespace MythicPlusExporter;

public sealed record MythicPlusStanding(
    string Name,
    string Realm,
    double Score,
    long TimeMilliseconds,
    double? ScoreChange = null,
    long? TimeChangeMilliseconds = null
);

public static class MythicPlusStandings
{
    public static IReadOnlyList<MythicPlusStanding> Build(MythicPlusDataset dataset)
    {
        var playerIndexes = dataset
            .Players.Select((player, index) => (player, index))
            .ToDictionary(entry => (entry.player.Realm, entry.player.Name), entry => entry.index);
        var best = new BestRuns(dataset.Players.Count);

        foreach (var dungeon in dataset.Dungeons)
        {
            best.StartDungeon();
            foreach (var scored in dungeon.Runs)
            {
                foreach (var member in scored.Run.Members)
                {
                    best.Add(
                        playerIndexes[(member.Realm, member.Name)],
                        scored.Score,
                        scored.Run.ClearTimeMilliseconds
                    );
                }
            }
            best.EndDungeon();
        }

        return Totals(
            dataset.Players.Select(player => (player.Realm, player.Name)).ToList(),
            best.Scores,
            best.Times
        );
    }

    internal static IReadOnlyList<MythicPlusStanding> Totals(
        IReadOnlyList<(string Realm, string Name)> players,
        IReadOnlyList<double> scores,
        IReadOnlyList<long> times
    ) =>
        players
            .Select(
                (player, index) =>
                    new MythicPlusStanding(
                        player.Name,
                        player.Realm,
                        RoundScore(scores[index]),
                        times[index]
                    )
            )
            .ToList();

    public static IReadOnlyList<MythicPlusStanding> Compare(
        IReadOnlyList<MythicPlusStanding> current,
        IReadOnlyDictionary<(string Realm, string Name), MythicPlusStanding> previous
    ) =>
        current
            .Select(standing =>
            {
                if (!previous.TryGetValue((standing.Realm, standing.Name), out var old))
                {
                    return standing;
                }

                return standing with
                {
                    ScoreChange = RoundScore(standing.Score - old.Score),
                    TimeChangeMilliseconds = standing.TimeMilliseconds - old.TimeMilliseconds,
                };
            })
            .ToList();

    public static IReadOnlyList<MythicPlusStanding> Departed(
        IReadOnlyList<MythicPlusStanding> current,
        IReadOnlyDictionary<(string Realm, string Name), MythicPlusStanding> previous
    )
    {
        var present = current.Select(standing => (standing.Realm, standing.Name)).ToHashSet();
        return previous.Values.Where(old => !present.Contains((old.Realm, old.Name))).ToList();
    }

    internal static double RoundScore(double score)
    {
        var rounded = Math.Round(score, 1, MidpointRounding.AwayFromZero);
        return rounded == 0 ? 0 : rounded;
    }

    internal sealed class BestRuns(int playerCount)
    {
        private readonly double[] _dungeonScores = new double[playerCount];
        private readonly long[] _dungeonTimes = new long[playerCount];
        private readonly bool[] _played = new bool[playerCount];

        public double[] Scores { get; } = new double[playerCount];
        public long[] Times { get; } = new long[playerCount];

        public void StartDungeon() => Array.Clear(_played);

        public void Add(int playerIndex, double score, long clearTimeMilliseconds)
        {
            if (
                !_played[playerIndex]
                || score > _dungeonScores[playerIndex]
                || (
                    score == _dungeonScores[playerIndex]
                    && clearTimeMilliseconds < _dungeonTimes[playerIndex]
                )
            )
            {
                _played[playerIndex] = true;
                _dungeonScores[playerIndex] = score;
                _dungeonTimes[playerIndex] = clearTimeMilliseconds;
            }
        }

        public void EndDungeon()
        {
            for (var playerIndex = 0; playerIndex < _played.Length; playerIndex++)
            {
                if (_played[playerIndex])
                {
                    Scores[playerIndex] += _dungeonScores[playerIndex];
                    Times[playerIndex] += _dungeonTimes[playerIndex];
                }
            }
        }
    }
}
