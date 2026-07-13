using System.Data;
using System.Diagnostics;
using Nexa_WinUI.Application;
using Nexa_WinUI.Domain;

namespace Nexa_WinUI.Infrastructure;

/// <summary>Dispatches only tools explicitly requested by the current plan.</summary>
public sealed class ToolExecutor(IEnumerable<ITool> tools) : IToolExecutor, IExecutor
{
    private readonly IReadOnlyDictionary<ToolKind, ITool> _tools = tools.ToDictionary(tool => tool.Kind);

    public async Task<IReadOnlyList<ToolResult>> ExecuteAsync(ExecutionPlan plan, ChatRequest request, CancellationToken cancellationToken)
    {
        var calls = plan.Steps.SelectMany(step => step.RequiredTools).Distinct()
            .Select(kind => new ToolCall(kind, request.Content, request.WorkspacePath, request.AllowTerminal));
        var results = new List<ToolResult>();
        foreach (var call in calls)
        {
            cancellationToken.ThrowIfCancellationRequested();
            results.Add(_tools.TryGetValue(call.Kind, out var tool)
                ? await tool.ExecuteAsync(call, cancellationToken)
                : new ToolResult(call.Kind, false, "このツールは登録されていません。"));
        }
        return results;
    }
}

/// <summary>Evaluates a constrained arithmetic expression without invoking a language model.</summary>
public sealed class CalculatorTool : ITool
{
    public ToolKind Kind => ToolKind.Calculator;
    public Task<ToolResult> ExecuteAsync(ToolCall call, CancellationToken cancellationToken)
    {
        var expression = call.Input.Replace("計算", "", StringComparison.OrdinalIgnoreCase).Trim();
        if (expression.Length == 0 || !System.Text.RegularExpressions.Regex.IsMatch(expression, "^[0-9+\\-*/().,%\\s]+$"))
            return Task.FromResult(new ToolResult(Kind, false, "安全な数式として解釈できませんでした。"));
        try
        {
            var value = new DataTable().Compute(expression, null);
            return Task.FromResult(new ToolResult(Kind, true, Convert.ToString(value) ?? string.Empty));
        }
        catch (Exception exception)
        {
            return Task.FromResult(new ToolResult(Kind, false, "計算に失敗しました。", new Dictionary<string, string> { ["error"] = exception.Message }));
        }
    }
}

/// <summary>Reads workspace data while enforcing the selected folder as a strict boundary.</summary>
public sealed class FileSystemTool : ITool
{
    public ToolKind Kind => ToolKind.FileSystem;
    public Task<ToolResult> ExecuteAsync(ToolCall call, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(call.WorkspacePath) || !Directory.Exists(call.WorkspacePath))
            return Task.FromResult(new ToolResult(Kind, false, "作業フォルダーが選択されていません。"));
        var root = Path.GetFullPath(call.WorkspacePath);
        var files = Directory.EnumerateFiles(root, "*", SearchOption.TopDirectoryOnly)
            .Take(30).Select(Path.GetFileName);
        return Task.FromResult(new ToolResult(Kind, true, string.Join(Environment.NewLine, files), new Dictionary<string, string> { ["workspace"] = root }));
    }
}

/// <summary>Runs a command only when the user grants terminal access and within the selected workspace.</summary>
public sealed class TerminalTool : ITool
{
    public ToolKind Kind => ToolKind.Terminal;
    public async Task<ToolResult> ExecuteAsync(ToolCall call, CancellationToken cancellationToken)
    {
        if (!call.AllowTerminal) return new ToolResult(Kind, false, "ターミナル実行には明示的なアクセス権が必要です。");
        if (string.IsNullOrWhiteSpace(call.WorkspacePath) || !Directory.Exists(call.WorkspacePath)) return new ToolResult(Kind, false, "作業フォルダーが選択されていません。");
        return await RunAsync(call.Input, call.WorkspacePath, cancellationToken);
    }

    private static async Task<ToolResult> RunAsync(string command, string workingDirectory, CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo("cmd.exe", $"/c {command}")
        {
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        using var process = Process.Start(startInfo);
        if (process is null) return new ToolResult(ToolKind.Terminal, false, "プロセスを開始できませんでした。");
        var output = await process.StandardOutput.ReadToEndAsync(cancellationToken);
        var error = await process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);
        return new ToolResult(ToolKind.Terminal, process.ExitCode == 0, output + error, new Dictionary<string, string> { ["exitCode"] = process.ExitCode.ToString() });
    }
}

/// <summary>Exposes project memory as a tool without leaking storage details.</summary>
public sealed class MemoryTool(IMemoryStore memoryStore) : ITool
{
    public ToolKind Kind => ToolKind.Memory;
    public async Task<ToolResult> ExecuteAsync(ToolCall call, CancellationToken cancellationToken)
    {
        var matches = await memoryStore.SearchAsync(Guid.Empty, call.Input, 5, cancellationToken);
        return new ToolResult(Kind, true, string.Join(Environment.NewLine, matches));
    }
}

/// <summary>RAG is an explicit extension point; it currently reuses the local memory index.</summary>
public sealed class RagTool(IMemoryStore memoryStore) : ITool
{
    public ToolKind Kind => ToolKind.Rag;
    public async Task<ToolResult> ExecuteAsync(ToolCall call, CancellationToken cancellationToken)
    {
        var matches = await memoryStore.SearchAsync(Guid.Empty, call.Input, 8, cancellationToken);
        return new ToolResult(Kind, true, string.Join(Environment.NewLine, matches));
    }
}

/// <summary>Unavailable integrations fail explicitly instead of fabricating a web, Python, or image result.</summary>
public sealed class ConfiguredIntegrationTool(ToolKind kind, string setupHint) : ITool
{
    public ToolKind Kind => kind;
    public Task<ToolResult> ExecuteAsync(ToolCall call, CancellationToken cancellationToken) =>
        Task.FromResult(new ToolResult(kind, false, setupHint));
}
