using Nexa_WinUI.Domain;

namespace Nexa_WinUI.Application;

/// <summary>Creates small, auditable plans. More advanced planners can replace this through DI.</summary>
public sealed class RulePlanner : IPlanner
{
    public Task<ExecutionPlan> CreatePlanAsync(ChatRequest request, IntentDecision intent, CancellationToken cancellationToken)
    {
        var tools = request.Mode == NexaMode.Chat ? [] : intent.SuggestedTools;
        var steps = new List<PlanStep>
        {
            new("要求を確認", "最新のユーザー依頼を優先し、成功条件を短く整理する。", []),
            new("必要な情報を取得", "必要な場合だけ許可済みツールを使う。", tools),
            new("回答を生成", "ユーザーの言語で、根拠と制約を明確に返す。", [])
        };
        if (request.Mode is NexaMode.Code or NexaMode.Both && intent.Kind == IntentKind.Code)
            steps.Add(new("変更を検証", "ファイル変更後に最小限の検証を実行する。", [ToolKind.FileSystem, ToolKind.Terminal]));
        return Task.FromResult(new ExecutionPlan(request.Content, steps));
    }
}

/// <summary>Fast local intent classification. A model-based router can be added as a decorator later.</summary>
public sealed class KeywordIntentRouter : IIntentRouter
{
    public Task<IntentDecision> RouteAsync(ChatRequest request, CancellationToken cancellationToken)
    {
        var text = request.Content.ToLowerInvariant();
        IntentDecision decision = text switch
        {
            var x when Contains(x, "計算", "足し", "引き", "掛け", "割", "sqrt", "math") || System.Text.RegularExpressions.Regex.IsMatch(x, @"\d+\s*[+\-*/]\s*\d+") => new(IntentKind.Math, .93, "計算語または数式を検出", [ToolKind.Calculator]),
            var x when Contains(x, "検索", "調べ", "最新", "ニュース", "web") => new(IntentKind.Search, .84, "検索語を検出", [ToolKind.WebSearch, ToolKind.Rag]),
            var x when Contains(x, "画像", "イラスト", "image") => new(IntentKind.Image, .90, "画像生成語を検出", [ToolKind.Image]),
            var x when Contains(x, "ファイル", "pdf", "添付", "folder") => new(IntentKind.FileAnalysis, .86, "ファイル解析語を検出", [ToolKind.FileSystem, ToolKind.Rag]),
            var x when Contains(x, "コード", "実装", "バグ", "html", "css", "c#", "python", "api", "修正") => new(IntentKind.Code, .91, "開発語を検出", [ToolKind.FileSystem, ToolKind.Terminal]),
            var x when Contains(x, "エージェント", "自動化", "実行") => new(IntentKind.Agent, .75, "エージェント語を検出", [ToolKind.Memory]),
            var x when text.EndsWith("？") || text.EndsWith("?") => new(IntentKind.Question, .70, "質問形式を検出", [ToolKind.Memory]),
            _ => new(IntentKind.Conversation, .65, "会話として処理", [ToolKind.Memory])
        };
        return Task.FromResult(decision);
    }

    private static bool Contains(string text, params string[] terms) => terms.Any(text.Contains);
}
