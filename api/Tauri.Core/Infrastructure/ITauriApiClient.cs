namespace Tauri.Core.Infrastructure;

public interface ITauriApiClient
{
    Task<TauriApiResponseResult> FetchResponseElementAsync(
        string endpoint,
        object parameters,
        string requestLabel,
        CancellationToken cancellationToken
    );
}
