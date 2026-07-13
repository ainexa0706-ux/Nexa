using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Nexa_WinUI.Application;
using Nexa_WinUI.Domain;

namespace Nexa_WinUI.Infrastructure;

/// <summary>Single composition root. Swap implementations here, not in view models.</summary>
public static class ServiceRegistration
{
    public static IServiceProvider Build()
    {
        var services = new ServiceCollection();
        services.AddLogging(builder => builder.AddDebug().SetMinimumLevel(LogLevel.Information));
        services.AddSingleton(new HttpClient { BaseAddress = new Uri(Environment.GetEnvironmentVariable("NEXA_OLLAMA_URL") ?? "http://127.0.0.1:11434/") });
        services.AddSingleton(CloudModelOptions.FromEnvironment());

        services.AddSingleton<IMemoryStore, JsonFileMemoryStore>();
        services.AddSingleton<IProjectRepository, JsonFileProjectRepository>();
        services.AddSingleton<IAgentLog, InMemoryAgentLog>();
        services.AddSingleton<IPlanner, RulePlanner>();
        services.AddSingleton<IIntentRouter, KeywordIntentRouter>();
        services.AddSingleton<ICriticAi, HeuristicCriticAi>();

        services.AddSingleton<ITool, CalculatorTool>();
        services.AddSingleton<ITool, FileSystemTool>();
        services.AddSingleton<ITool, TerminalTool>();
        services.AddSingleton<ITool, MemoryTool>();
        services.AddSingleton<ITool, RagTool>();
        services.AddSingleton<ITool>(_ => new ConfiguredIntegrationTool(ToolKind.Python, "Pythonツールは実行ポリシーを設定してから有効化してください。"));
        services.AddSingleton<ITool>(_ => new ConfiguredIntegrationTool(ToolKind.WebSearch, "Web Searchプロバイダーを設定してから有効化してください。"));
        services.AddSingleton<ITool>(_ => new ConfiguredIntegrationTool(ToolKind.Image, "画像生成プロバイダーを設定してから有効化してください。"));
        services.AddSingleton<ToolExecutor>();
        services.AddSingleton<IToolExecutor>(provider => provider.GetRequiredService<ToolExecutor>());
        services.AddSingleton<IExecutor>(provider => provider.GetRequiredService<ToolExecutor>());

        services.AddSingleton<IModelClient, OllamaModelClient>();
        services.AddSingleton<IModelClient, OpenAiCompatibleCloudModelClient>();
        services.AddSingleton<IModelRouter, HybridModelRouter>();
        services.AddSingleton<IAgentOrchestrator, NexaAgentOrchestrator>();
        services.AddSingleton<ViewModels.MainPageViewModel>();
        return services.BuildServiceProvider(validateScopes: true);
    }
}
