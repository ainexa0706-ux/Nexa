using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Channels;
using Nexa_WinUI.Domain;

namespace Nexa_WinUI.Application;

/// <summary>Fast, deterministic quality gate. A model critic can be added behind the same interface.</summary>
public sealed class HeuristicCriticAi : ICriticAi
{
    public Task<CritiqueResult> ReviewAsync(ChatRequest request, IntentDecision intent, string response, CancellationToken cancellationToken)
    {
        var findings = new List<string>();
        if (response.Length < 12) findings.Add("回答が短すぎます。");
        if (response.Contains("わかりません", StringComparison.Ordinal) && intent.Kind != IntentKind.Question) findings.Add("代替案や次の行動が不足しています。");
        if (intent.Kind == IntentKind.Code && !response.Contains("```", StringComparison.Ordinal) && request.Mode != NexaMode.Chat)
            findings.Add("コード依頼に対する具体的な実装情報が不足しています。");
        return Task.FromResult(new CritiqueResult(findings.Count > 0, string.Join(" ", findings), findings));
    }
}

/// <summary>
/// Coordinates planning, tools, model streaming, critique and persistence. A channel keeps streaming,
/// cancellation and exception handling separate from the UI and makes the class easy to test with fakes.
/// </summary>
public sealed class NexaAgentOrchestrator(
    IPlanner planner,
    IIntentRouter intentRouter,
    IExecutor executor,
    IModelRouter modelRouter,
    ICriticAi critic,
    IMemoryStore memory,
    IProjectRepository projects,
    IAgentLog log) : IAgentOrchestrator
{
    public async IAsyncEnumerable<AgentStreamEvent> RunAsync(ChatRequest request, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var channel = Channel.CreateUnbounded<AgentStreamEvent>();
        _ = Task.Run(async () =>
        {
            try
            {
                await RunCoreAsync(request, channel.Writer, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                log.Write("Pipeline", "ユーザーが処理を停止しました。");
                await channel.Writer.WriteAsync(new AgentStreamEvent(AgentStreamKind.Completed, "生成を停止しました。", "Cancelled"));
            }
            catch (Exception exception)
            {
                log.Write("Pipeline", "処理に失敗しました。", exception);
                await channel.Writer.WriteAsync(new AgentStreamEvent(AgentStreamKind.Error, "Nexaで処理中にエラーが起きました。設定とログを確認してください。", "Error"));
            }
            finally
            {
                channel.Writer.TryComplete();
            }
        }, CancellationToken.None);

        await foreach (var update in channel.Reader.ReadAllAsync(cancellationToken)) yield return update;
    }

    private async Task RunCoreAsync(ChatRequest request, ChannelWriter<AgentStreamEvent> output, CancellationToken cancellationToken)
    {
        await output.WriteAsync(Status("依頼を確認中"), cancellationToken);
        var project = await projects.GetOrCreateAsync(request.ProjectId, request.Mode, request.WorkspacePath, cancellationToken);
        var intent = await intentRouter.RouteAsync(request, cancellationToken);
        log.Write("Intent Router", $"{intent.Kind} ({intent.Confidence:P0})");

        await output.WriteAsync(Status("実行計画を作成中"), cancellationToken);
        var plan = await planner.CreatePlanAsync(request, intent, cancellationToken);
        var toolResults = request.Mode == NexaMode.Chat
            ? Array.Empty<ToolResult>()
            : (await executor.ExecuteAsync(plan, request, cancellationToken)).ToArray();
        var relevantMemory = await memory.SearchAsync(request.ProjectId, request.Content, 5, cancellationToken);
        var selection = modelRouter.Select(request, intent);
        log.Write("Model Router", $"{selection.Placement}: {selection.Model}");
        await output.WriteAsync(Status($"{selection.Placement}モデルで回答を生成中"), cancellationToken);

        var prompt = BuildPrompt(request, intent, plan, relevantMemory, toolResults);
        var answer = new StringBuilder();
        var modelRequest = new ModelRequest(SystemPrompt(request.Mode), project.Messages.TakeLast(20).ToArray(), prompt, selection.Placement, selection.Model);
        await foreach (var chunk in selection.Client.StreamAsync(modelRequest, cancellationToken))
        {
            if (chunk.Text.Length == 0) continue;
            answer.Append(chunk.Text);
            await output.WriteAsync(new AgentStreamEvent(AgentStreamKind.Token, chunk.Text, "Response"), cancellationToken);
        }

        var finalAnswer = answer.ToString().Trim();
        await output.WriteAsync(Status("回答品質を確認中"), cancellationToken);
        var review = await critic.ReviewAsync(request, intent, finalAnswer, cancellationToken);
        if (review.ShouldRegenerate)
        {
            await output.WriteAsync(Status("回答を補正中"), cancellationToken);
            var improved = new StringBuilder();
            var rewrite = modelRequest with { UserPrompt = $"{prompt}\n\n下書き:\n{finalAnswer}\n\n品質確認: {review.Feedback}\n上の不足だけを補い、完成した回答を最初から書き直してください。" };
            await foreach (var chunk in selection.Client.StreamAsync(rewrite, cancellationToken)) improved.Append(chunk.Text);
            if (improved.Length > 0)
            {
                finalAnswer = improved.ToString().Trim();
                await output.WriteAsync(new AgentStreamEvent(AgentStreamKind.ReplaceResponse, finalAnswer, "Critic AI"), cancellationToken);
            }
        }

        await projects.AppendAsync(request.ProjectId, new ConversationMessage(Guid.NewGuid(), "user", request.Content, DateTimeOffset.UtcNow), cancellationToken);
        await projects.AppendAsync(request.ProjectId, new ConversationMessage(Guid.NewGuid(), "assistant", finalAnswer, DateTimeOffset.UtcNow), cancellationToken);
        await memory.RememberAsync(request.ProjectId, $"User: {request.Content}\nAssistant: {finalAnswer}", cancellationToken);
        log.Write("Response", "回答を保存しました。");
        await output.WriteAsync(new AgentStreamEvent(AgentStreamKind.Completed, finalAnswer, "Response"), cancellationToken);
    }

    private static AgentStreamEvent Status(string text) => new(AgentStreamKind.Status, text, "Nexa");

    private static string SystemPrompt(NexaMode mode) => mode switch
    {
        NexaMode.Chat => "You are Nexa. Answer naturally in the user's language. Chat mode is conversation only: never write files, execute commands, or claim to inspect a workspace.",
        NexaMode.Code => "You are Nexa. Work only inside the user-selected workspace. Explain changes and verification honestly. Never claim a file changed unless a tool confirms it.",
        _ => "You are Nexa. Keep conversation and code operations distinct. Use filesystem or terminal tools only when the plan grants them and a workspace exists."
    };

    private static string BuildPrompt(ChatRequest request, IntentDecision intent, ExecutionPlan plan, IReadOnlyList<string> memories, IReadOnlyList<ToolResult> tools)
    {
        var toolContext = string.Join("\n", tools.Where(result => result.Succeeded).Select(result => $"[{result.Kind}] {result.Content}"));
        var memoryContext = string.Join("\n", memories);
        return $"Intent: {intent.Kind}\nGoal: {plan.Goal}\nRelevant memory:\n{memoryContext}\nTool results:\n{toolContext}\n\nUser request:\n{request.Content}";
    }
}
