using System.Diagnostics;
using ArenaLadderExporter;
using MythicPlusExporter;
using RaidLogExporter;
using Tauri.Core.Configuration;
using Tauri.Core.Infrastructure;

namespace QuickUpdate;

internal static class Program
{
    public static async Task<int> Main()
    {
        var projectRoot = ProjectPaths.FindProjectRoot(
            AppContext.BaseDirectory,
            "QuickUpdate.csproj"
        );
        var solutionRoot = ProjectPaths.FindSolutionRoot(projectRoot);
        var frontendSrc = ProjectPaths.GetFrontendSrcDirectory(solutionRoot);

        using var cancellationTokenSource = new CancellationTokenSource();

        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            cancellationTokenSource.Cancel();
        };

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var settings = AppSettings.Load(
                Path.Combine(solutionRoot, "AchievementLadder", "appsettings.json")
            );
            using var apiClient = new TauriApiClient(settings.TauriApi);
            var mythicPlus = new MythicPlusExportService(
                Path.Combine(frontendSrc, MythicPlusFileWriter.DataDirectoryName),
                apiClient
            );
            var arena = new ArenaLadderExportService(frontendSrc, apiClient);

            var results = await new QuickUpdateRun(Console.Out, Console.Error).RunAsync(
                new QuickUpdateExports(
                    token =>
                        mythicPlus.ExportAsync(
                            new MythicPlusExporterOptions(
                                MythicPlusExporterOptions.DefaultRealms,
                                AllowShrink: false
                            ),
                            token
                        ),
                    async token =>
                    {
                        using var raidLogs = new RaidLogExportSetup(
                            solutionRoot,
                            apiClient,
                            TextWriter.Null
                        );
                        return await raidLogs.Service.ExportAsync(
                            new RaidLogExporterOptions(
                                RaidLogExporterOptions.DefaultRealms,
                                Full: false,
                                AllowShrink: false
                            ),
                            token
                        );
                    },
                    token => arena.ExportAsync(new ArenaLadderExporterOptions(false), token)
                ),
                cancellationTokenSource.Token
            );

            foreach (var line in QuickUpdateReport.Summary(results, stopwatch.Elapsed))
            {
                Console.WriteLine(line);
            }

            return results.ExitCode;
        }
        catch (OperationCanceledException)
        {
            Console.Error.WriteLine("Quick update cancelled.");
            return QuickUpdateResults.AllFailed;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Quick update failed: {ex.Message}");
            return QuickUpdateResults.AllFailed;
        }
    }
}
