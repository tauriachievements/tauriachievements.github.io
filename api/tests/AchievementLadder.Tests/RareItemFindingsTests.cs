using AchievementLadder.Services;
using Tauri.Core.Models;

namespace AchievementLadder.Tests;

public sealed class RareItemFindingsTests
{
    private static readonly RareItemDefinition PlagueBearer = new(22818, "The Plague Bearer");
    private static readonly RareItemDefinition Ashbringer = new(22691, "Corrupted Ashbringer");
    private static readonly RareItemDefinition MalevolentHelm = new(
        84434,
        "Malevolent Gladiator's Leather Helm"
    );
    private static readonly RareItemDefinition NewlyWatched = new(
        98162,
        "Tyrannical Gladiator's Tabard"
    );

    private static readonly DateTimeOffset LastNight = new(2026, 11, 15, 1, 30, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Tonight = new(2026, 11, 16, 1, 34, 0, TimeSpan.Zero);

    [Fact]
    public void Find_CharacterMissingFromPreviousScan_IsNewWithAllTheirItems()
    {
        var previous = Export(LastNight, Owner("Known", PlagueBearer));

        var findings = RareItemFindings.Find(
            previous,
            [Owner("Known", PlagueBearer), Owner("Hsbgd", Ashbringer, MalevolentHelm)],
            Tonight
        );

        var finding = Assert.Single(findings);
        Assert.Equal("Hsbgd", finding.Name);
        Assert.True(finding.IsNew);
        Assert.Equal(Tonight, finding.Scan);
        Assert.Equal([Ashbringer, MalevolentHelm], finding.Items);
    }

    [Fact]
    public void Find_KnownOwnerWithNewItems_ListsOnlyTheNewItems()
    {
        var previous = Export(LastNight, Owner("Dynos", PlagueBearer));

        var findings = RareItemFindings.Find(
            previous,
            [Owner("Dynos", PlagueBearer, Ashbringer, MalevolentHelm)],
            Tonight
        );

        var finding = Assert.Single(findings);
        Assert.False(finding.IsNew);
        Assert.Equal([Ashbringer, MalevolentHelm], finding.Items);
    }

    [Fact]
    public void Find_KnownOwnerWithNothingNew_IsNotListed()
    {
        var previous = Export(LastNight, Owner("Steady", PlagueBearer, Ashbringer));

        var findings = RareItemFindings.Find(previous, [Owner("Steady", Ashbringer)], Tonight);

        Assert.Empty(findings);
    }

    [Fact]
    public void Find_MatchesNameAndRealmIgnoringCase()
    {
        var previous = Export(LastNight, Owner("Ghø", PlagueBearer) with { Realm = "TAURI" });

        var findings = RareItemFindings.Find(
            previous,
            [Owner("ghø", PlagueBearer) with { Realm = "Tauri" }],
            Tonight
        );

        Assert.Empty(findings);
    }

    [Fact]
    public void Find_SameNameOnAnotherRealm_IsNew()
    {
        var previous = Export(LastNight, Owner("Twin", PlagueBearer) with { Realm = "Tauri" });

        var findings = RareItemFindings.Find(
            previous,
            [Owner("Twin", PlagueBearer) with { Realm = "Evermoon" }],
            Tonight
        );

        Assert.True(Assert.Single(findings).IsNew);
    }

    [Fact]
    public void Find_ItemsAddedToTheWatchListSinceThePreviousScan_DoNotCount()
    {
        var previous = Export(LastNight, Owner("Known", PlagueBearer));

        var findings = RareItemFindings.Find(
            previous,
            [
                Owner("Known", PlagueBearer, NewlyWatched),
                Owner("Newcomer", NewlyWatched),
                Owner("Mixed", NewlyWatched, Ashbringer),
            ],
            Tonight
        );

        var finding = Assert.Single(findings);
        Assert.Equal("Mixed", finding.Name);
        Assert.Equal([Ashbringer], finding.Items);
    }

    [Fact]
    public void Find_OrdersByNameThenRealm()
    {
        var previous = Export(LastNight);

        var findings = RareItemFindings.Find(
            previous,
            [
                Owner("zed", PlagueBearer),
                Owner("Abe", PlagueBearer) with
                {
                    Realm = "WoD",
                },
                Owner("abe", PlagueBearer) with
                {
                    Realm = "Tauri",
                },
            ],
            Tonight
        );

        Assert.Equal(
            ["abe/Tauri", "Abe/WoD", "zed/Evermoon"],
            findings.Select(finding => $"{finding.Name}/{finding.Realm}")
        );
    }

    [Fact]
    public void Find_CopiesTheCharactersCurrentDetails()
    {
        var previous = Export(LastNight);
        var owner = new CharacterRareItemEntry(
            "Life",
            "Evermoon",
            4,
            1,
            6,
            "Endless",
            [PlagueBearer]
        );

        var finding = Assert.Single(RareItemFindings.Find(previous, [owner], Tonight));

        Assert.Equal(
            new RareItemFinding(Tonight, "Life", "Evermoon", 4, 1, 6, "Endless", true, []),
            finding with
            {
                Items = [],
            }
        );
    }

    [Fact]
    public void Record_AddsTheScanAndItsFindingsFirst()
    {
        var earlierScan = new RareItemFindingsScan(LastNight, LastNight.AddDays(-1));
        var earlierFinding = Finding(LastNight, "Older");
        var earlier = new RareItemFindingsExport(
            RareItemFindings.FormatVersion,
            [earlierScan],
            [earlierFinding]
        );

        var recorded = RareItemFindings.Record(
            earlier,
            Export(LastNight),
            [Owner("Newer", PlagueBearer)],
            Tonight
        );

        Assert.Equal([new RareItemFindingsScan(Tonight, LastNight), earlierScan], recorded.Scans);
        Assert.Equal(["Newer", "Older"], recorded.Characters.Select(finding => finding.Name));
    }

    [Fact]
    public void Record_KeepsAScanThatFoundNothing()
    {
        var recorded = RareItemFindings.Record(
            null,
            Export(LastNight, Owner("Known", PlagueBearer)),
            [Owner("Known", PlagueBearer)],
            Tonight
        );

        Assert.Equal([new RareItemFindingsScan(Tonight, LastNight)], recorded.Scans);
        Assert.Empty(recorded.Characters);
        Assert.Equal(RareItemFindings.FormatVersion, recorded.Version);
    }

    [Fact]
    public void Record_KeepsTheLastSevenScansAndTheirFindings()
    {
        var scans = Enumerable
            .Range(1, RareItemFindings.ScanLimit)
            .Select(daysAgo => new RareItemFindingsScan(
                Tonight.AddDays(-daysAgo),
                Tonight.AddDays(-daysAgo - 1)
            ))
            .ToList();
        var oldest = scans[^1].GeneratedAt;
        var earlier = new RareItemFindingsExport(
            RareItemFindings.FormatVersion,
            scans,
            [Finding(scans[0].GeneratedAt, "Kept"), Finding(oldest, "Dropped")]
        );

        var recorded = RareItemFindings.Record(earlier, Export(LastNight), [], Tonight);

        Assert.Equal(RareItemFindings.ScanLimit, recorded.Scans.Count);
        Assert.Equal(Tonight, recorded.Scans[0].GeneratedAt);
        Assert.DoesNotContain(recorded.Scans, scan => scan.GeneratedAt == oldest);
        Assert.Equal(["Kept"], recorded.Characters.Select(finding => finding.Name));
    }

    [Fact]
    public void Record_WithoutAPreviousScan_KeepsWhatWasThere()
    {
        var earlier = new RareItemFindingsExport(
            RareItemFindings.FormatVersion,
            [new RareItemFindingsScan(LastNight, LastNight.AddDays(-1))],
            [Finding(LastNight, "Older")]
        );

        var recorded = RareItemFindings.Record(
            earlier,
            null,
            [Owner("Anyone", PlagueBearer)],
            Tonight
        );

        Assert.Same(earlier, recorded);
    }

    [Fact]
    public void KeepUnscannedOwners_OwnerWhoseScanFailed_KeepsTheirPreviousItems()
    {
        var watched = Watched(PlagueBearer, Ashbringer);
        var failedOwner = Owner("Emotions", PlagueBearer, Ashbringer);
        var previous = Export(LastNight, failedOwner, Owner("Scanned", PlagueBearer));

        var kept = RareItemFindings.KeepUnscannedOwners(
            previous,
            [Owner("Scanned", PlagueBearer)],
            [("EMOTIONS", "evermoon")],
            watched
        );

        Assert.Equal(["Scanned", "Emotions"], kept.Select(owner => owner.Name));
        Assert.Equal([PlagueBearer, Ashbringer], kept[1].Items);
    }

    [Fact]
    public void KeepUnscannedOwners_OwnerScannedWithoutItems_IsDropped()
    {
        var previous = Export(LastNight, Owner("Sold", PlagueBearer));

        var kept = RareItemFindings.KeepUnscannedOwners(previous, [], [], Watched(PlagueBearer));

        Assert.Empty(kept);
    }

    [Fact]
    public void KeepUnscannedOwners_DropsItemsNoLongerWatched()
    {
        var previous = Export(LastNight, Owner("Failed", PlagueBearer, NewlyWatched));
        var renamed = new RareItemDefinition(PlagueBearer.Id, "The Plague Bearer (renamed)");

        var kept = RareItemFindings.KeepUnscannedOwners(
            previous,
            [],
            [("Failed", "Evermoon")],
            Watched(renamed)
        );

        Assert.Equal([renamed], Assert.Single(kept).Items);
    }

    [Fact]
    public void KeepUnscannedOwners_FailedOwnerWithNoWatchedItemsLeft_IsDropped()
    {
        var previous = Export(LastNight, Owner("Failed", NewlyWatched));

        var kept = RareItemFindings.KeepUnscannedOwners(
            previous,
            [],
            [("Failed", "Evermoon")],
            Watched(PlagueBearer)
        );

        Assert.Empty(kept);
    }

    [Fact]
    public void KeepUnscannedOwners_WithoutAPreviousScan_ReturnsTheScan()
    {
        IReadOnlyList<CharacterRareItemEntry> current = [Owner("Scanned", PlagueBearer)];

        var kept = RareItemFindings.KeepUnscannedOwners(
            null,
            current,
            [("Failed", "Evermoon")],
            Watched(PlagueBearer)
        );

        Assert.Equal(current, kept);
    }

    private static CharacterRareItemEntry Owner(string name, params RareItemDefinition[] items) =>
        new(name, "Evermoon", 1, 0, 1, "", items);

    private static RareItemFinding Finding(DateTimeOffset scan, string name) =>
        new(scan, name, "Evermoon", 1, 0, 1, "", true, [PlagueBearer]);

    private static RareItemExport Export(
        DateTimeOffset generatedAt,
        params CharacterRareItemEntry[] owners
    ) => new(generatedAt, [PlagueBearer, Ashbringer, MalevolentHelm], owners);

    private static IReadOnlyDictionary<int, RareItemDefinition> Watched(
        params RareItemDefinition[] items
    ) => items.ToDictionary(item => item.Id);
}
