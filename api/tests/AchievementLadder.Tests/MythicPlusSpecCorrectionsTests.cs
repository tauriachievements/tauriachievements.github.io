using MythicPlusExporter;

namespace AchievementLadder.Tests;

public sealed class MythicPlusSpecCorrectionsTests
{
    private const string Evermoon = "Evermoon";
    private const int Warlock = 9;
    private const int DemonHunter = 12;

    private static readonly long DnxVaultRunFinished = new DateTimeOffset(
        2026,
        11,
        15,
        10,
        59,
        58,
        TimeSpan.Zero
    ).ToUnixTimeSeconds();

    [Fact]
    public void Apply_MakesDnxAfflictionOnTheVaultRunOf15November()
    {
        var tank = Tank("Deepthrust");
        var run = Run(DnxVaultRunFinished, tank, Destruction("Dnx", Evermoon));

        var corrected = MythicPlusSpecCorrections.Apply("votw", run);

        ChallengeMember[] expected =
        [
            tank,
            new("Dnx", Evermoon, "deeznuts", Warlock, 8, 0, 265, "Affliction", "dps"),
        ];
        Assert.Equal(expected, corrected.Members);
        Assert.Equal(
            (run.KeyLevel, run.ClearTimeMilliseconds, run.CompletedAt),
            (corrected.KeyLevel, corrected.ClearTimeMilliseconds, corrected.CompletedAt)
        );
    }

    [Theory]
    [InlineData("votw", "Dnx", Evermoon, 1)]
    [InlineData("votw", "Dnx", Evermoon, -1)]
    [InlineData("cos", "Dnx", Evermoon, 0)]
    [InlineData("votw", "Dnx", "Tauri", 0)]
    [InlineData("votw", "Dnxx", Evermoon, 0)]
    public void Apply_KeepsTheSpecTheLeaderboardsGiveEverywhereElse(
        string dungeon,
        string name,
        string realm,
        int secondsAfter
    )
    {
        var run = Run(DnxVaultRunFinished + secondsAfter, Destruction(name, realm));

        Assert.Same(run, MythicPlusSpecCorrections.Apply(dungeon, run));
    }

    private static ChallengeRun Run(long completedAt, params ChallengeMember[] members) =>
        new(15, 1_877_225, completedAt, [], members);

    private static ChallengeMember Destruction(string name, string realm) =>
        new(name, realm, "deeznuts", Warlock, 8, 0, 267, "Destruction", "dps");

    private static ChallengeMember Tank(string name) =>
        new(name, Evermoon, "NFA", DemonHunter, 10, 0, 581, "Vengeance", "tank");
}
