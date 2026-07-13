using Nexa_WinUI.Domain;

namespace Nexa_WinUI.Application;

public interface IPlanner
{
    Task<ExecutionPlan> CreatePlanAsync(ChatRequest request, IntentDecision intent, CancellationToken cancellationToken);
}

public interface IIntentRouter
{
    Task<IntentDecision> RouteAsync(ChatRequest request, CancellationToken cancellationToken);
}

public interface ITool
{
    ToolKind Kind { get; }
    Task<ToolResult> ExecuteAsync(ToolCall call, CancellationToken cancellationToken);
}

public interface IToolExecutor
{
    Task<IReadOnlyList<ToolResult>> ExecuteAsync(ExecutionPlan plan, ChatRequest request, CancellationToken cancellationToken);
}

public interface IModelClient
{
    string Name { get; }
    ModelPlacement Placement { get; }
    bool IsAvailable { get; }
    IAsyncEnumerable<ModelStreamChunk> StreamAsync(ModelRequest request, CancellationToken cancellationToken);
}

public interface IModelRouter
{
    ModelSelection Select(ChatRequest request, IntentDecision intent);
}

/// <summary>Selected model adapter and the reason for the routing decision.</summary>
public sealed record ModelSelection(IModelClient Client, string Model, ModelPlacement Placement, string Reason);

public interface IExecutor
{
    Task<IReadOnlyList<ToolResult>> ExecuteAsync(ExecutionPlan plan, ChatRequest request, CancellationToken cancellationToken);
}

public interface ICriticAi
{
    Task<CritiqueResult> ReviewAsync(ChatRequest request, IntentDecision intent, string response, CancellationToken cancellationToken);
}

public interface IMemoryStore
{
    Task<IReadOnlyList<string>> SearchAsync(Guid projectId, string query, int limit, CancellationToken cancellationToken);
    Task RememberAsync(Guid projectId, string text, CancellationToken cancellationToken);
}

public interface IProjectRepository
{
    Task<ProjectContext> GetOrCreateAsync(Guid projectId, NexaMode mode, string? workspacePath, CancellationToken cancellationToken);
    Task AppendAsync(Guid projectId, ConversationMessage message, CancellationToken cancellationToken);
}

public interface IAgentLog
{
    void Write(string stage, string message, Exception? exception = null);
    IReadOnlyList<AgentLogEntry> Recent(int limit = 200);
}

public interface IAgentOrchestrator
{
    IAsyncEnumerable<AgentStreamEvent> RunAsync(ChatRequest request, CancellationToken cancellationToken);
}
