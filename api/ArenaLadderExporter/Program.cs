using Tauri.Core.Configuration;
using Tauri.Core.Infrastructure;

namespace ArenaLadderExporter;

internal static class Program
{
    public static async Task<int> Main(string[] args)
    {
        if (
            !ArenaLadderExporterOptions.TryParse(
                args,
                out var options,
                out var errorMessage,
                out var showHelp
            )
        )
        {
            if (!string.IsNullOrWhiteSpace(errorMessage))
            {
                Console.Error.WriteLine(errorMessage);
                Console.Error.WriteLine();
            }

            Console.WriteLine(ArenaLadderExporterOptions.UsageText);
            return showHelp ? 0 : 1;
        }

        var projectRoot = ProjectPaths.FindProjectRoot(
            AppContext.BaseDirectory,
            "ArenaLadderExporter.csproj"
        );
        var solutionRoot = ProjectPaths.FindSolutionRoot(projectRoot);
        var settingsPath = ResolveSettingsPath(projectRoot, solutionRoot);
        var outputDirectory = ProjectPaths.GetFrontendSrcDirectory(solutionRoot);

        using var cancellationTokenSource = new CancellationTokenSource();

        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            cancellationTokenSource.Cancel();
        };

        try
        {
            var settings = AppSettings.Load(settingsPath);
            using var apiClient = new TauriApiClient(settings.TauriApi);
            var exporter = new ArenaLadderExportService(outputDirectory, apiClient);

            Console.WriteLine("Reading the rated arena ladders...");

            var result = await exporter.ExportAsync(options!, cancellationTokenSource.Token);

            Console.WriteLine();
            foreach (var bracket in result.Brackets)
            {
                var change =
                    bracket.PreviousGamesPlayed == 0
                        ? "first export this season"
                        : $"{bracket.GamesPlayed - bracket.PreviousGamesPlayed:+#;-#;0} since last export";
                Console.WriteLine(
                    $"{bracket.Bracket.Name}: {bracket.PlayerCount} players, {bracket.GamesPlayed} games played ({change})"
                );
                if (bracket.SkippedCount > 0)
                {
                    Console.WriteLine(
                        $"  Skipped {bracket.SkippedCount} ladder entries without a name, class, realm or games."
                    );
                }
                Console.WriteLine($"  Output: {bracket.Path}");
            }

            return 0;
        }
        catch (OperationCanceledException)
        {
            Console.Error.WriteLine("Arena ladder export cancelled.");
            return 1;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Arena ladder export failed: {ex.Message}");
            return 1;
        }
    }

    private static string ResolveSettingsPath(string projectRoot, string solutionRoot)
    {
        var sharedSettingsPath = Path.Combine(
            solutionRoot,
            "AchievementLadder",
            "appsettings.json"
        );
        if (File.Exists(sharedSettingsPath))
        {
            return sharedSettingsPath;
        }

        var localSettingsPath = Path.Combine(projectRoot, "appsettings.json");
        if (File.Exists(localSettingsPath))
        {
            return localSettingsPath;
        }

        throw new FileNotFoundException(
            "Could not find appsettings.json in either AchievementLadder or ArenaLadderExporter.",
            sharedSettingsPath
        );
    }
}
