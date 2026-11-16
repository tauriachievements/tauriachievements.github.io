using Tauri.Core.Models;

namespace AchievementLadder.Services;

public sealed record RareItemFindingsScan(
    DateTimeOffset GeneratedAt,
    DateTimeOffset PreviousGeneratedAt
);

public sealed record RareItemFinding(
    DateTimeOffset Scan,
    string Name,
    string Realm,
    int Race,
    int Gender,
    int Class,
    string Guild,
    bool IsNew,
    IReadOnlyList<RareItemDefinition> Items
);

public sealed record RareItemFindingsExport(
    int Version,
    IReadOnlyList<RareItemFindingsScan> Scans,
    IReadOnlyList<RareItemFinding> Characters
);

public static class RareItemFindings
{
    public const int FormatVersion = 1;

    public const int ScanLimit = 7;

    private static readonly StringComparer KeyComparer = StringComparer.OrdinalIgnoreCase;

    public static IReadOnlyList<CharacterRareItemEntry> KeepUnscannedOwners(
        RareItemExport? previous,
        IReadOnlyList<CharacterRareItemEntry> current,
        IReadOnlyCollection<(string Name, string Realm)> unscanned,
        IReadOnlyDictionary<int, RareItemDefinition> watchedItems
    )
    {
        if (previous is null || unscanned.Count == 0)
        {
            return current;
        }

        var unscannedKeys = unscanned.Select(target => Key(target.Name, target.Realm)).ToHashSet();
        var scannedKeys = current.Select(owner => Key(owner.Name, owner.Realm)).ToHashSet();
        var kept = previous
            .Characters.Where(owner =>
                unscannedKeys.Contains(Key(owner.Name, owner.Realm))
                && !scannedKeys.Contains(Key(owner.Name, owner.Realm))
            )
            .Select(owner =>
                owner with
                {
                    Items = owner
                        .Items.Where(item => watchedItems.ContainsKey(item.Id))
                        .Select(item => watchedItems[item.Id])
                        .ToList(),
                }
            )
            .Where(owner => owner.Items.Count > 0);

        return [.. current, .. kept];
    }

    public static IReadOnlyList<RareItemFinding> Find(
        RareItemExport previous,
        IReadOnlyList<CharacterRareItemEntry> current,
        DateTimeOffset generatedAt
    )
    {
        var previouslyWatched = previous.Items.Select(item => item.Id).ToHashSet();
        var previousOwners = previous
            .Characters.GroupBy(owner => Key(owner.Name, owner.Realm))
            .ToDictionary(
                group => group.Key,
                group => group.SelectMany(owner => owner.Items).Select(item => item.Id).ToHashSet()
            );

        var findings = new List<RareItemFinding>();
        foreach (var owner in current)
        {
            var isNew = !previousOwners.TryGetValue(
                Key(owner.Name, owner.Realm),
                out var previousItems
            );
            var found = owner
                .Items.Where(item =>
                    previouslyWatched.Contains(item.Id)
                    && (previousItems is null || !previousItems.Contains(item.Id))
                )
                .ToList();
            if (found.Count > 0)
            {
                findings.Add(
                    new RareItemFinding(
                        generatedAt,
                        owner.Name,
                        owner.Realm,
                        owner.Race,
                        owner.Gender,
                        owner.Class,
                        owner.Guild,
                        isNew,
                        found
                    )
                );
            }
        }

        return findings
            .OrderBy(finding => finding.Name, KeyComparer)
            .ThenBy(finding => finding.Realm, KeyComparer)
            .ThenBy(finding => finding.Name, StringComparer.Ordinal)
            .ToList();
    }

    public static RareItemFindingsExport Record(
        RareItemFindingsExport? earlier,
        RareItemExport? previous,
        IReadOnlyList<CharacterRareItemEntry> current,
        DateTimeOffset generatedAt
    )
    {
        if (previous is null)
        {
            return earlier ?? new RareItemFindingsExport(FormatVersion, [], []);
        }

        var scans = earlier?.Scans ?? [];
        var keptScans = scans
            .Prepend(new RareItemFindingsScan(generatedAt, previous.GeneratedAt))
            .Take(ScanLimit)
            .ToList();
        var keptScanTimes = keptScans.Select(scan => scan.GeneratedAt).ToHashSet();
        var characters = Find(previous, current, generatedAt)
            .Concat(
                (earlier?.Characters ?? []).Where(finding => keptScanTimes.Contains(finding.Scan))
            )
            .ToList();

        return new RareItemFindingsExport(FormatVersion, keptScans, characters);
    }

    private static string Key(string name, string realm) =>
        $"{name.ToUpperInvariant()}\u0000{realm.ToUpperInvariant()}";
}
