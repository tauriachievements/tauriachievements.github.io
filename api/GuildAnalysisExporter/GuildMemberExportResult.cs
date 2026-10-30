namespace GuildAnalysisExporter;

public sealed record GuildMemberExportResult(
    int ScannedPlayerCount,
    int PlayerCount,
    string OutputPath
);
