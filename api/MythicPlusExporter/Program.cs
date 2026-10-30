using System.Diagnostics;
using Tauri.Core.Configuration;
using Tauri.Core.Infrastructure;

namespace MythicPlusExporter;

internal static class Program
{
    public static async Task<int> Main(string[] args)
    {
        if (
            !MythicPlusExporterOptions.TryParse(
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

            Console.WriteLine(MythicPlusExporterOptions.UsageText);
            return showHelp ? 0 : 1;
        }

        var projectRoot = ProjectPaths.FindProjectRoot(
            AppContext.BaseDirectory,
            "MythicPlusExporter.csproj"
        );
        var solutionRoot = ProjectPaths.FindSolutionRoot(projectRoot);
        var repoRoot = Path.GetFullPath(Path.Combine(solutionRoot, ".."));
        var settingsPath = ResolveSettingsPath(projectRoot, solutionRoot);
        var outputDirectory = Path.Combine(
            ProjectPaths.GetFrontendSrcDirectory(solutionRoot),
            "mythic-plus-data"
        );

        using var cancellationTokenSource = new CancellationTokenSource();

        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            cancellationTokenSource.Cancel();
        };

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var settings = AppSettings.Load(settingsPath);
            using var apiClient = new TauriApiClient(settings.TauriApi);
            var exporter = new MythicPlusExportService(outputDirectory, apiClient);

            Console.WriteLine("Reading the Mythic+ leaderboards...");
            var result = await exporter.ExportAsync(options!, cancellationTokenSource.Token);

            foreach (var line in MythicPlusConsoleReport.Summary(result, repoRoot))
            {
                Console.WriteLine(line);
            }

            Console.WriteLine();
            Console.WriteLine(
                $"Mythic+ export finished in {MythicPlusConsoleReport.Duration(stopwatch.Elapsed)}."
            );
            return 0;
        }
        catch (OperationCanceledException)
        {
            Console.Error.WriteLine();
            Console.Error.WriteLine(
                $"Mythic+ export cancelled after {MythicPlusConsoleReport.Duration(stopwatch.Elapsed)}."
            );
            return 1;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine();
            Console.Error.WriteLine(
                $"Mythic+ export failed after {MythicPlusConsoleReport.Duration(stopwatch.Elapsed)}: {ex.Message}"
            );
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
            "Could not find appsettings.json in either AchievementLadder or MythicPlusExporter.",
            sharedSettingsPath
        );
    }
}
