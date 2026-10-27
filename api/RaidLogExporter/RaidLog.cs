namespace RaidLogExporter;

public readonly record struct RaidLogKey(string Realm, int LogId);

public sealed record ListedRaidLog(
    RaidLogKey Key,
    string ApiRealm,
    int EncounterId,
    int DifficultyId
);

public sealed record RaidGuild(int Id, string Name, string Realm, int Faction);

public sealed record RaidLogMember(
    string Name,
    string Realm,
    int ClassId,
    int SpecId,
    int Race,
    int Gender,
    string Guild,
    int ItemLevel,
    long DamageDone,
    long HealingDone,
    long AbsorbDone,
    long Overhealing,
    long DamageTaken,
    int Interrupts,
    int Dispels,
    string Talents,
    IReadOnlyList<RaidTrinket> Trinkets
);

public sealed record RaidTrinket(int Id, int ItemLevel, string Name, int Quality, string Icon);

public sealed record RaidTalent(int SpellId, string Name, string Icon);

public sealed record RaidSpecTalents(int SpecId, IReadOnlyList<IReadOnlyList<RaidTalent?>> Tiers);

public sealed record RaidSpellTooltip(
    int SpellId,
    IReadOnlyList<string> Details,
    string Description
);

public sealed record RaidLog(
    RaidLogKey Key,
    int EncounterId,
    int DifficultyId,
    long KilledAt,
    long FightMilliseconds,
    RaidGuild? Guild,
    int Faction,
    int Wipes,
    int Deaths,
    int Resurrects,
    IReadOnlyList<RaidLogMember> Members,
    IReadOnlyList<int> Items
);

public sealed record RaidScanChanges(
    DateTimeOffset PreviousGeneratedAt,
    IReadOnlyList<RaidLogKey> NewLogs
);

public sealed record RaidItem(int Id, string Name, int Quality, string Icon);
