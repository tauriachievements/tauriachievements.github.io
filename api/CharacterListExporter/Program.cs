using System.Globalization;
using Tauri.Core.Configuration;
using Tauri.Core.Infrastructure;

namespace CharacterListExporter;

internal static class Program
{
    public static async Task<int> Main(string[] args)
    {
        if (
            !CharacterListExporterOptions.TryParse(
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

            Console.WriteLine(CharacterListExporterOptions.UsageText);
            return showHelp ? 0 : 1;
        }

        var projectRoot = ProjectPaths.FindProjectRoot(
            AppContext.BaseDirectory,
            "CharacterListExporter.csproj"
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
            var exporter = new CharacterListExportService(outputDirectory, apiClient);

            Console.WriteLine(
                $"Reading {options!.Names.Count} characters on {options.Realm} for the {options.List} list..."
            );

            var result = await exporter.ExportAsync(options, cancellationTokenSource.Token);

            Console.WriteLine();
            foreach (var character in result.Characters)
            {
                Console.WriteLine(
                    $"  {character.Name, -13} {character.Spec, -14} level {character.Level, 3}  ilvl {Format(character.ItemLevel), 6}  traits {character.Traits, 2}  AK {character.ArtifactKnowledge, 2}  campaign {(character.Campaign ? "done" : "no"), -4}  order hall {character.OrderHall}"
                );
            }

            Console.WriteLine();
            Console.WriteLine(
                result.PreviousCount == 0
                    ? $"{result.Characters.Count} characters, first export of this list."
                    : $"{result.Characters.Count} characters, {result.PreviousCount} in the previous export."
            );
            Console.WriteLine($"Output: {result.Path}");
            return 0;
        }
        catch (OperationCanceledException)
        {
            Console.Error.WriteLine("Character list export cancelled.");
            return 1;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Character list export failed: {ex.Message}");
            return 1;
        }
    }

    private static string Format(decimal? itemLevel) =>
        itemLevel?.ToString("0.##", CultureInfo.InvariantCulture) ?? "-";

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
            "Could not find appsettings.json in either AchievementLadder or CharacterListExporter.",
            sharedSettingsPath
        );
    }
}
