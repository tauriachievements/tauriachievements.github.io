using ArenaLadderExporter;
using MythicPlusExporter;
using RaidLogExporter;

namespace QuickUpdate;

public sealed record QuickUpdateExports(
    Func<CancellationToken, Task<MythicPlusExportResult>> MythicPlus,
    Func<CancellationToken, Task<RaidLogExportResult>> RaidLogs,
    Func<CancellationToken, Task<ArenaLadderExportResult>> Arena
);

public sealed record QuickUpdateResults(
    MythicPlusExportResult? MythicPlus,
    RaidLogExportResult? RaidLogs,
    ArenaLadderExportResult? Arena
)
{
    public const int MythicPlusFailed = 2;
    public const int RaidLogsFailed = 4;
    public const int ArenaFailed = 8;
    public const int AllFailed = MythicPlusFailed | RaidLogsFailed | ArenaFailed;

    public int ExitCode =>
        (MythicPlus is null ? MythicPlusFailed : 0)
        | (RaidLogs is null ? RaidLogsFailed : 0)
        | (Arena is null ? ArenaFailed : 0);
}

public sealed class QuickUpdateRun(TextWriter output, TextWriter error)
{
    public async Task<QuickUpdateResults> RunAsync(
        QuickUpdateExports exports,
        CancellationToken cancellationToken
    )
    {
        output.WriteLine(QuickUpdateReport.ReadingMythicPlus);
        output.WriteLine();
        var mythicPlus = await TryAsync("Mythic+", exports.MythicPlus, cancellationToken);
        output.WriteLine();

        output.WriteLine(QuickUpdateReport.ReadingRaidLogs);
        var raidLogs = await TryAsync("Raid log", exports.RaidLogs, cancellationToken);
        output.WriteLine();

        output.WriteLine(QuickUpdateReport.ReadingArena);
        var arena = await TryAsync("Arena ladder", exports.Arena, cancellationToken);
        output.WriteLine();

        return new QuickUpdateResults(mythicPlus, raidLogs, arena);
    }

    private async Task<T?> TryAsync<T>(
        string name,
        Func<CancellationToken, Task<T>> export,
        CancellationToken cancellationToken
    )
        where T : class
    {
        try
        {
            return await export(cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            error.WriteLine($"{name} export failed: {exception.Message}");
            return null;
        }
    }
}
