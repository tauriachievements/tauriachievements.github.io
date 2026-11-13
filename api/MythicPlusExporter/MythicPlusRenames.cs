namespace MythicPlusExporter;

public static class MythicPlusRenames
{
    private const int Human = 1;
    private const int Male = 0;

    private sealed record Rename(
        string Realm,
        string Name,
        string OldName,
        int OldRace,
        int OldGender,
        DateTimeOffset LastRunUnderOldName
    );

    private static readonly Rename[] Renames =
    [
        new(
            "Evermoon",
            "Héll",
            "Lastguard",
            Human,
            Male,
            new DateTimeOffset(2026, 11, 13, 16, 23, 51, TimeSpan.Zero)
        ),
    ];

    public static ChallengeRun Apply(ChallengeRun run) =>
        run.Members.Any(member => RenameOf(run, member) is not null)
            ? run with
            {
                Members = [.. run.Members.Select(member => Restore(run, member))],
            }
            : run;

    private static ChallengeMember Restore(ChallengeRun run, ChallengeMember member) =>
        RenameOf(run, member) is { } rename
            ? member with
            {
                Name = rename.OldName,
                Race = rename.OldRace,
                Gender = rename.OldGender,
            }
            : member;

    private static Rename? RenameOf(ChallengeRun run, ChallengeMember member) =>
        Array.Find(
            Renames,
            rename =>
                rename.Realm == member.Realm
                && rename.Name == member.Name
                && run.CompletedAt <= rename.LastRunUnderOldName.ToUnixTimeSeconds()
        );
}
