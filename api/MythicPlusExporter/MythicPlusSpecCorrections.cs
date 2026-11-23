namespace MythicPlusExporter;

public static class MythicPlusSpecCorrections
{
    private const int Affliction = 265;

    private sealed record Correction(
        string Dungeon,
        string Realm,
        string Name,
        DateTimeOffset CompletedAt,
        int SpecId,
        string SpecName,
        string Role
    );

    private static readonly Correction[] Corrections =
    [
        new(
            "votw",
            "Evermoon",
            "Dnx",
            new DateTimeOffset(2026, 11, 15, 10, 59, 58, TimeSpan.Zero),
            Affliction,
            "Affliction",
            "dps"
        ),
    ];

    public static ChallengeRun Apply(string dungeonSlug, ChallengeRun run) =>
        run.Members.Any(member => CorrectionOf(dungeonSlug, run, member) is not null)
            ? run with
            {
                Members = [.. run.Members.Select(member => Correct(dungeonSlug, run, member))],
            }
            : run;

    private static ChallengeMember Correct(
        string dungeonSlug,
        ChallengeRun run,
        ChallengeMember member
    ) =>
        CorrectionOf(dungeonSlug, run, member) is { } correction
            ? member with
            {
                SpecId = correction.SpecId,
                SpecName = correction.SpecName,
                Role = correction.Role,
            }
            : member;

    private static Correction? CorrectionOf(
        string dungeonSlug,
        ChallengeRun run,
        ChallengeMember member
    ) =>
        Array.Find(
            Corrections,
            correction =>
                correction.Dungeon == dungeonSlug
                && correction.Realm == member.Realm
                && correction.Name == member.Name
                && correction.CompletedAt.ToUnixTimeSeconds() == run.CompletedAt
        );
}
