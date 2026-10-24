using Tauri.Core.Helpers;

namespace RaidLogExporter;

public sealed record InvalidRaidLog(RaidLogKey Key, string Reason);

public sealed class InvalidRaidLogs
{
    public const string FileName = "invalid-raid-logs.txt";

    public static readonly InvalidRaidLogs Empty = new([]);

    private readonly Dictionary<RaidLogKey, string> _reasons;

    public InvalidRaidLogs(IEnumerable<InvalidRaidLog> logs)
    {
        _reasons = [];
        foreach (var log in logs)
        {
            _reasons[log.Key] = log.Reason;
        }
    }

    public int Count => _reasons.Count;

    public IEnumerable<RaidLogKey> Keys => _reasons.Keys;

    public bool Contains(RaidLogKey key) => _reasons.ContainsKey(key);

    public string? Reason(RaidLogKey key) => _reasons.GetValueOrDefault(key);

    public static InvalidRaidLogs Load(string path) =>
        File.Exists(path) ? Parse(File.ReadLines(path)) : Empty;

    public static InvalidRaidLogs Parse(IEnumerable<string> lines)
    {
        var logs = new List<InvalidRaidLog>();
        var lineNumber = 0;
        foreach (var line in lines)
        {
            lineNumber++;
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var fields = line.Trim().Split(' ', 3, StringSplitOptions.RemoveEmptyEntries);
            if (
                fields.Length < 3
                || !CharacterHelpers.TryResolveRealm(fields[0], out _, out var realm)
                || !int.TryParse(fields[1], out var logId)
                || logId <= 0
            )
            {
                throw new FormatException(
                    $"{FileName} line {lineNumber} is not \"<realm> <log id> <reason>\": {line}"
                );
            }

            logs.Add(new InvalidRaidLog(new RaidLogKey(realm, logId), fields[2].Trim()));
        }

        return new InvalidRaidLogs(logs);
    }
}
