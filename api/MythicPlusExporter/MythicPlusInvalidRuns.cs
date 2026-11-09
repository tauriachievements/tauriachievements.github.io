namespace MythicPlusExporter;

public static class MythicPlusInvalidRuns
{
    public const int FromKeyLevel = 17;

    public static readonly DateTimeOffset FixesWentLive = new(
        2026,
        11,
        9,
        13,
        35,
        0,
        TimeSpan.Zero
    );

    private const string BeforeTheFixes = ", before the 9 November fixes";

    private const int Warrior = 1;
    private const int Hunter = 3;
    private const int DeathKnight = 6;
    private const int Warlock = 9;
    private const int Monk = 10;
    private const int DemonHunter = 12;

    private sealed record Rule(
        IReadOnlySet<string>? Dungeons,
        Func<ChallengeMember, bool>? Member,
        string Reason
    );

    private static readonly Rule[] Rules =
    [
        new(
            new HashSet<string> { "brh" },
            member => member.ClassId == DeathKnight,
            "Black Rook Hold +17 or higher with a Death Knight"
        ),
        new(
            new HashSet<string> { "eoa" },
            member => member.ClassId is DemonHunter or Monk or Warlock or Warrior or Hunter,
            "Eye of Azshara +17 or higher with a Demon Hunter, Monk, Warlock, Warrior or Hunter"
        ),
        new(
            new HashSet<string> { "votw", "cos", "dht" },
            member => member.ClassId == Warlock,
            "Vault of the Wardens, Court of Stars or Darkheart Thicket +17 or higher with a Warlock"
        ),
        new(
            null,
            member => member.ClassId == Monk && member.SpecName == "Brewmaster",
            "+17 or higher with a Brewmaster Monk"
        ),
        new(new HashSet<string> { "cos" }, null, "Court of Stars +17 or higher"),
    ];

    public static string? ReasonFor(string dungeonSlug, ChallengeRun run)
    {
        if (run.KeyLevel < FromKeyLevel || run.CompletedAt >= FixesWentLive.ToUnixTimeSeconds())
        {
            return null;
        }

        var broken = Rules.FirstOrDefault(rule =>
            (rule.Dungeons is null || rule.Dungeons.Contains(dungeonSlug))
            && (rule.Member is null || run.Members.Any(rule.Member))
        );
        return broken is null ? null : broken.Reason + BeforeTheFixes;
    }
}
