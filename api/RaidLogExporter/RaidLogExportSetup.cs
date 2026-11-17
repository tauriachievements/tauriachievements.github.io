using Tauri.Core.Infrastructure;

namespace RaidLogExporter;

public sealed class RaidLogExportSetup : IDisposable
{
    private readonly TauriShootItemSource _itemSource;
    private readonly TauriShootTalentSource _talentSource;
    private readonly TauriShootSpellTooltipSource _tooltipSource;

    public RaidLogExportSetup(
        string solutionRoot,
        ITauriApiClient apiClient,
        TextWriter? progress = null
    )
    {
        var frontendSrc = ProjectPaths.GetFrontendSrcDirectory(solutionRoot);
        var guildDirectory = PlayerGuildDirectory.Load(Path.Combine(frontendSrc, "Players.csv"));
        InvalidLogs = InvalidRaidLogs.Load(
            Path.Combine(solutionRoot, "AchievementLadder", "Data", InvalidRaidLogs.FileName)
        );

        _itemSource = new TauriShootItemSource();
        _talentSource = new TauriShootTalentSource();
        _tooltipSource = new TauriShootSpellTooltipSource();
        Service = new RaidLogExportService(
            Path.Combine(frontendSrc, RaidLogFileWriter.DataDirectoryName),
            apiClient,
            _itemSource,
            _talentSource,
            _tooltipSource,
            guildDirectory,
            InvalidLogs,
            progress: progress
        );
    }

    public InvalidRaidLogs InvalidLogs { get; }

    public RaidLogExportService Service { get; }

    public void Dispose()
    {
        _itemSource.Dispose();
        _talentSource.Dispose();
        _tooltipSource.Dispose();
    }
}
