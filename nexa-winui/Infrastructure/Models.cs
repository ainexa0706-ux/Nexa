using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Net.Http.Json;
using Nexa_WinUI.Application;
using Nexa_WinUI.Domain;

namespace Nexa_WinUI.Infrastructure;

/// <summary>Real Ollama adapter with newline-delimited streaming support.</summary>
public sealed class OllamaModelClient(HttpClient httpClient) : IModelClient
{
    public string Name => "Ollama";
    public ModelPlacement Placement => ModelPlacement.Local;
    public bool IsAvailable => true;

    public async IAsyncEnumerable<ModelStreamChunk> StreamAsync(ModelRequest request, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var messages = request.History.Select(message => new { role = message.Role, content = message.Content }).ToList();
        messages.Insert(0, new { role = "system", content = request.SystemPrompt });
        messages.Add(new { role = "user", content = request.UserPrompt });
        using var response = await httpClient.PostAsJsonAsync("api/chat", new { model = request.Model, stream = true, messages }, cancellationToken);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);
        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            using var json = JsonDocument.Parse(line);
            var root = json.RootElement;
            var text = root.TryGetProperty("message", out var message) && message.TryGetProperty("content", out var content)
                ? content.GetString() ?? string.Empty : string.Empty;
            yield return new ModelStreamChunk(text, root.TryGetProperty("done", out var done) && done.GetBoolean());
        }
    }
}

/// <summary>OpenAI-compatible cloud adapter. It remains disabled until a server-side key is supplied.</summary>
public sealed class OpenAiCompatibleCloudModelClient(HttpClient httpClient, CloudModelOptions options) : IModelClient
{
    public string Name => "Cloud";
    public ModelPlacement Placement => ModelPlacement.Cloud;
    public bool IsAvailable => !string.IsNullOrWhiteSpace(options.ApiKey) && Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out _);

    public async IAsyncEnumerable<ModelStreamChunk> StreamAsync(ModelRequest request, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        if (!IsAvailable) throw new InvalidOperationException("クラウドモデルは設定されていません。");
        using var message = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(options.BaseUrl), "chat/completions"));
        message.Headers.Authorization = new("Bearer", options.ApiKey);
        message.Content = JsonContent.Create(new
        {
            model = request.Model,
            stream = true,
            messages = request.History.Prepend(new ConversationMessage(Guid.Empty, "system", request.SystemPrompt, DateTimeOffset.UtcNow))
                .Append(new ConversationMessage(Guid.Empty, "user", request.UserPrompt, DateTimeOffset.UtcNow))
                .Select(item => new { role = item.Role, content = item.Content })
        });
        using var response = await httpClient.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);
        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            if (!line.StartsWith("data: ", StringComparison.Ordinal) || line == "data: [DONE]") continue;
            using var json = JsonDocument.Parse(line[6..]);
            var text = json.RootElement.GetProperty("choices")[0].GetProperty("delta").TryGetProperty("content", out var value) ? value.GetString() ?? string.Empty : string.Empty;
            yield return new ModelStreamChunk(text);
        }
        yield return new ModelStreamChunk(string.Empty, true);
    }
}

public sealed record CloudModelOptions(string BaseUrl, string ApiKey, string Model)
{
    public static CloudModelOptions FromEnvironment() => new(
        Environment.GetEnvironmentVariable("NEXA_CLOUD_BASE_URL") ?? "https://openrouter.ai/api/v1/",
        Environment.GetEnvironmentVariable("NEXA_CLOUD_API_KEY") ?? string.Empty,
        Environment.GetEnvironmentVariable("NEXA_CLOUD_MODEL") ?? "openrouter/free");
}

/// <summary>Selects local inference by default; cloud is opt-in and only selected when configured.</summary>
public sealed class HybridModelRouter(IEnumerable<IModelClient> clients, CloudModelOptions cloudOptions) : IModelRouter
{
    private readonly IReadOnlyList<IModelClient> _clients = clients.ToList();
    public ModelSelection Select(ChatRequest request, IntentDecision intent)
    {
        var cloud = _clients.FirstOrDefault(client => client.Placement == ModelPlacement.Cloud && client.IsAvailable);
        if (request.AllowCloud && cloud is not null && intent.Kind is IntentKind.Code or IntentKind.Math or IntentKind.Agent)
            return new ModelSelection(cloud, cloudOptions.Model, ModelPlacement.Cloud, "複雑な依頼でクラウド利用が許可されました。");
        var local = _clients.First(client => client.Placement == ModelPlacement.Local && client.IsAvailable);
        var model = intent.Kind == IntentKind.Code ? "qwen2.5-coder:7b" : "qwen3:8b";
        return new ModelSelection(local, model, ModelPlacement.Local, "ローカルモデルを優先します。");
    }
}
