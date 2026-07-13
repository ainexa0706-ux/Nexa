namespace Nexa_WinUI.Domain;

/// <summary>Controls which capabilities are available to a conversation.</summary>
public enum NexaMode { Chat, Code, Both }

/// <summary>Describes the request category selected by the intent router.</summary>
public enum IntentKind { Conversation, Question, Code, Math, Search, Image, FileAnalysis, Agent }

/// <summary>Represents the tools that can be granted to an execution plan.</summary>
public enum ToolKind { Calculator, Python, WebSearch, Memory, Rag, FileSystem, Image, Terminal }

/// <summary>Declares where an inference request should run.</summary>
public enum ModelPlacement { Local, Cloud }

/// <summary>Represents a single user or assistant message persisted in a project.</summary>
public sealed record ConversationMessage(Guid Id, string Role, string Content, DateTimeOffset CreatedAt);

/// <summary>Contains a project-scoped conversation and its optional workspace boundary.</summary>
public sealed record ProjectContext(
    Guid ProjectId,
    string Name,
    NexaMode Mode,
    string? WorkspacePath,
    IReadOnlyList<ConversationMessage> Messages);

/// <summary>Input accepted by the orchestration pipeline.</summary>
public sealed record ChatRequest(
    Guid ProjectId,
    string Content,
    NexaMode Mode,
    string? WorkspacePath,
    bool AllowCloud,
    bool AllowTerminal);

/// <summary>Planner output. Tools are explicit, making permissions auditable.</summary>
public sealed record ExecutionPlan(string Goal, IReadOnlyList<PlanStep> Steps);
public sealed record PlanStep(string Title, string Instruction, IReadOnlyList<ToolKind> RequiredTools);

/// <summary>Intent router output used by the model and tool routers.</summary>
public sealed record IntentDecision(IntentKind Kind, double Confidence, string Reason, IReadOnlyList<ToolKind> SuggestedTools);

/// <summary>One tool invocation and its safe, structured result.</summary>
public sealed record ToolCall(ToolKind Kind, string Input, string? WorkspacePath, bool AllowTerminal);
public sealed record ToolResult(ToolKind Kind, bool Succeeded, string Content, IReadOnlyDictionary<string, string>? Metadata = null);

/// <summary>Request passed to either an Ollama or cloud model adapter.</summary>
public sealed record ModelRequest(
    string SystemPrompt,
    IReadOnlyList<ConversationMessage> History,
    string UserPrompt,
    ModelPlacement Placement,
    string Model);
public sealed record ModelStreamChunk(string Text, bool IsFinal = false);

/// <summary>Critic verdict. A rewrite is requested only when it produces a concrete improvement.</summary>
public sealed record CritiqueResult(bool ShouldRegenerate, string Feedback, IReadOnlyList<string> Findings);

/// <summary>Streaming event consumed by the MVVM layer. No infrastructure type leaks into the UI.</summary>
public enum AgentStreamKind { Status, Token, ReplaceResponse, Completed, Error }
public sealed record AgentStreamEvent(AgentStreamKind Kind, string Content, string? Stage = null);

/// <summary>Structured log item for diagnostics, telemetry and test assertions.</summary>
public sealed record AgentLogEntry(DateTimeOffset Timestamp, string Stage, string Message, Exception? Exception = null);
