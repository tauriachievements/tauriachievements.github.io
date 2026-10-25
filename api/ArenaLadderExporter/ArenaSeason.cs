namespace ArenaLadderExporter;

public sealed record ArenaBracket(string Name, int TeamSize)
{
    public string FileName => $"arena-ladder-{Name}.json";
}

public static class ArenaSeason
{
    public const string LadderRealm = "[EN] Evermoon";

    public static readonly DateTimeOffset Start = new(2026, 9, 16, 0, 0, 0, TimeSpan.FromHours(2));

    public static readonly IReadOnlyList<ArenaBracket> Brackets = [new("2v2", 2), new("3v3", 3)];
}
