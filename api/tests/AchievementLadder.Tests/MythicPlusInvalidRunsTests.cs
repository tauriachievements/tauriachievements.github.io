using MythicPlusExporter;

namespace AchievementLadder.Tests;

public sealed class MythicPlusInvalidRunsTests
{
    private const long BeforeFixes = 1_794_231_299;
    private const long FixesWentLive = 1_794_231_300;

    private const int Warrior = 1;
    private const int Paladin = 2;
    private const int Hunter = 3;
    private const int Rogue = 4;
    private const int DeathKnight = 6;
    private const int Warlock = 9;
    private const int Monk = 10;
    private const int Druid = 11;
    private const int DemonHunter = 12;

    [Theory]
    [InlineData("brh", DeathKnight, "Blood", "Black Rook Hold +17 or higher with a Death Knight")]
    [InlineData(
        "eoa",
        DemonHunter,
        "Havoc",
        "Eye of Azshara +17 or higher with a Demon Hunter, Monk, Warlock, Warrior or Hunter"
    )]
    [InlineData(
        "eoa",
        Monk,
        "Windwalker",
        "Eye of Azshara +17 or higher with a Demon Hunter, Monk, Warlock, Warrior or Hunter"
    )]
    [InlineData(
        "eoa",
        Warlock,
        "Affliction",
        "Eye of Azshara +17 or higher with a Demon Hunter, Monk, Warlock, Warrior or Hunter"
    )]
    [InlineData(
        "eoa",
        Warrior,
        "Fury",
        "Eye of Azshara +17 or higher with a Demon Hunter, Monk, Warlock, Warrior or Hunter"
    )]
    [InlineData(
        "eoa",
        Hunter,
        "Marksmanship",
        "Eye of Azshara +17 or higher with a Demon Hunter, Monk, Warlock, Warrior or Hunter"
    )]
    [InlineData(
        "votw",
        Warlock,
        "Destruction",
        "Vault of the Wardens, Court of Stars or Darkheart Thicket +17 or higher with a Warlock"
    )]
    [InlineData(
        "dht",
        Warlock,
        "Demonology",
        "Vault of the Wardens, Court of Stars or Darkheart Thicket +17 or higher with a Warlock"
    )]
    [InlineData(
        "cos",
        Warlock,
        "Demonology",
        "Vault of the Wardens, Court of Stars or Darkheart Thicket +17 or higher with a Warlock"
    )]
    [InlineData("hov", Monk, "Brewmaster", "+17 or higher with a Brewmaster Monk")]
    [InlineData("brh", Monk, "Brewmaster", "+17 or higher with a Brewmaster Monk")]
    [InlineData("cos", Rogue, "Subtlety", "Court of Stars +17 or higher")]
    public void ReasonFor_NamesTheRuleAPreFixRunAt17OrHigherBreaks(
        string dungeon,
        int classId,
        string spec,
        string rule
    )
    {
        var run = Run(17, BeforeFixes, Member(Paladin, "Protection"), Member(classId, spec));

        Assert.Equal(
            $"{rule}, before the 9 November fixes",
            MythicPlusInvalidRuns.ReasonFor(dungeon, run)
        );
    }

    [Theory]
    [InlineData("brh", Druid, "Guardian")]
    [InlineData("eoa", Rogue, "Outlaw")]
    [InlineData("votw", Hunter, "Survival")]
    [InlineData("hov", Monk, "Windwalker")]
    [InlineData("hov", Warlock, "Affliction")]
    [InlineData("nl", DeathKnight, "Blood")]
    public void ReasonFor_KeepsARunNoRuleCovers(string dungeon, int classId, string spec)
    {
        var run = Run(20, BeforeFixes, Member(classId, spec));

        Assert.Null(MythicPlusInvalidRuns.ReasonFor(dungeon, run));
    }

    [Fact]
    public void ReasonFor_KeepsKeysBelow17()
    {
        var run = Run(16, BeforeFixes, Member(DeathKnight, "Blood"));

        Assert.Null(MythicPlusInvalidRuns.ReasonFor("brh", run));
    }

    [Fact]
    public void ReasonFor_KeepsRunsFinishedOnceTheFixesWentLive()
    {
        Assert.Null(MythicPlusInvalidRuns.ReasonFor("cos", Run(25, FixesWentLive)));
        Assert.Null(
            MythicPlusInvalidRuns.ReasonFor(
                "brh",
                Run(25, FixesWentLive + 3600, Member(DeathKnight, "Blood"))
            )
        );
    }

    [Fact]
    public void ReasonFor_GivesTheFirstRuleARunBreaks()
    {
        var run = Run(18, BeforeFixes, Member(Warlock, "Affliction"), Member(Monk, "Brewmaster"));

        Assert.Equal(
            "Vault of the Wardens, Court of Stars or Darkheart Thicket +17 or higher with a Warlock, before the 9 November fixes",
            MythicPlusInvalidRuns.ReasonFor("cos", run)
        );
    }

    private static ChallengeRun Run(
        int keyLevel,
        long completedAt,
        params ChallengeMember[] members
    ) => new(keyLevel, 1_500_000, completedAt, [], members);

    private static ChallengeMember Member(int classId, string spec) =>
        new(
            $"{spec}{classId}",
            MythicPlusExportServiceTests.Evermoon,
            "",
            classId,
            1,
            0,
            0,
            spec,
            "dps"
        );
}
