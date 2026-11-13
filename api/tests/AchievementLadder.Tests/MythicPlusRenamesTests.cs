using MythicPlusExporter;

namespace AchievementLadder.Tests;

public sealed class MythicPlusRenamesTests
{
    private const string Evermoon = "Evermoon";
    private const int Paladin = 2;
    private const int Human = 1;
    private const int BloodElf = 10;
    private const int Male = 0;
    private const int Female = 1;

    private static readonly long LastRunAsLastguard = new DateTimeOffset(
        2026,
        11,
        13,
        16,
        23,
        51,
        TimeSpan.Zero
    ).ToUnixTimeSeconds();

    [Fact]
    public void Apply_GivesHellsRunsUpToTheRenameBackToLastguard()
    {
        var teammate = Member("Ally", Evermoon, BloodElf, Female);
        var run = Run(LastRunAsLastguard, Member("Héll", Evermoon, BloodElf, Female), teammate);

        var renamed = MythicPlusRenames.Apply(run);

        ChallengeMember[] expected = [Member("Lastguard", Evermoon, Human, Male), teammate];
        Assert.Equal(expected, renamed.Members);
        Assert.Equal(
            (run.KeyLevel, run.ClearTimeMilliseconds, run.CompletedAt),
            (renamed.KeyLevel, renamed.ClearTimeMilliseconds, renamed.CompletedAt)
        );
    }

    [Fact]
    public void Apply_KeepsHellOnRunsFinishedAfterTheRename()
    {
        var run = Run(LastRunAsLastguard + 1, Member("Héll", Evermoon, BloodElf, Female));

        Assert.Equal(run.Members, MythicPlusRenames.Apply(run).Members);
    }

    [Theory]
    [InlineData("Héll", "Tauri")]
    [InlineData("Héllios", Evermoon)]
    public void Apply_KeepsEveryOtherCharacter(string name, string realm)
    {
        var run = Run(LastRunAsLastguard, Member(name, realm, BloodElf, Female));

        Assert.Equal(run.Members, MythicPlusRenames.Apply(run).Members);
    }

    private static ChallengeRun Run(long completedAt, params ChallengeMember[] members) =>
        new(10, 1_500_000, completedAt, [], members);

    private static ChallengeMember Member(string name, string realm, int race, int gender) =>
        new(name, realm, "", Paladin, race, gender, 66, "Protection", "tank");
}
