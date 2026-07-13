using System.Collections.Concurrent;
using System.Text.Json;
using Nexa_WinUI.Application;
using Nexa_WinUI.Domain;

namespace Nexa_WinUI.Infrastructure;

/// <summary>Thread-safe in-memory memory store. Replace with a vector database without changing callers.</summary>
public sealed class InMemoryMemoryStore : IMemoryStore
{
    private readonly ConcurrentDictionary<Guid, List<string>> _entries = new();

    public Task RememberAsync(Guid projectId, string text, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(text)) return Task.CompletedTask;
        var entries = _entries.GetOrAdd(projectId, _ => []);
        lock (entries)
        {
            entries.Add(text.Trim());
            if (entries.Count > 500) entries.RemoveRange(0, entries.Count - 500);
        }
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<string>> SearchAsync(Guid projectId, string query, int limit, CancellationToken cancellationToken)
    {
        var terms = query.Split([' ', '　', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (!_entries.TryGetValue(projectId, out var entries)) return Task.FromResult<IReadOnlyList<string>>([]);
        lock (entries)
        {
            var result = entries
                .Select((text, index) => new { text, index, score = terms.Count(term => text.Contains(term, StringComparison.OrdinalIgnoreCase)) })
                .Where(item => item.score > 0)
                .OrderByDescending(item => item.score)
                .ThenByDescending(item => item.index)
                .Take(Math.Clamp(limit, 1, 20))
                .Select(item => item.text)
                .ToArray();
            return Task.FromResult<IReadOnlyList<string>>(result);
        }
    }
}

/// <summary>Project history repository. Its API is deliberately independent of storage technology.</summary>
public sealed class InMemoryProjectRepository : IProjectRepository
{
    private readonly ConcurrentDictionary<Guid, ProjectContext> _projects = new();

    public Task<ProjectContext> GetOrCreateAsync(Guid projectId, NexaMode mode, string? workspacePath, CancellationToken cancellationToken)
    {
        var project = _projects.GetOrAdd(projectId, id => new ProjectContext(id, "New project", mode, workspacePath, []));
        return Task.FromResult(project);
    }

    public Task AppendAsync(Guid projectId, ConversationMessage message, CancellationToken cancellationToken)
    {
        _projects.AddOrUpdate(projectId,
            _ => new ProjectContext(projectId, "New project", NexaMode.Chat, null, [message]),
            (_, current) => current with { Messages = current.Messages.Append(message).TakeLast(200).ToArray() });
        return Task.CompletedTask;
    }
}

/// <summary>In-process diagnostic log. UI or file logging can subscribe without coupling to the pipeline.</summary>
public sealed class InMemoryAgentLog : IAgentLog
{
    private readonly ConcurrentQueue<AgentLogEntry> _entries = new();

    public void Write(string stage, string message, Exception? exception = null)
    {
        _entries.Enqueue(new AgentLogEntry(DateTimeOffset.UtcNow, stage, message, exception));
        while (_entries.Count > 500 && _entries.TryDequeue(out _)) { }
    }

    public IReadOnlyList<AgentLogEntry> Recent(int limit = 200) => _entries.Reverse().Take(limit).Reverse().ToArray();
}

/// <summary>Persists project histories under the current Windows user's local application data folder.</summary>
public sealed class JsonFileProjectRepository : IProjectRepository
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Nexa", "projects");
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public async Task<ProjectContext> GetOrCreateAsync(Guid projectId, NexaMode mode, string? workspacePath, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_directory);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var file = FileFor(projectId);
            if (File.Exists(file))
            {
                await using var read = File.OpenRead(file);
                return await JsonSerializer.DeserializeAsync<ProjectContext>(read, Json, cancellationToken)
                    ?? Create(projectId, mode, workspacePath);
            }
            var project = Create(projectId, mode, workspacePath);
            await SaveAsync(project, cancellationToken);
            return project;
        }
        finally { _gate.Release(); }
    }

    public async Task AppendAsync(Guid projectId, ConversationMessage message, CancellationToken cancellationToken)
    {
        var project = await GetOrCreateAsync(projectId, NexaMode.Chat, null, cancellationToken);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await SaveAsync(project with { Messages = project.Messages.Append(message).TakeLast(200).ToArray() }, cancellationToken);
        }
        finally { _gate.Release(); }
    }

    private static ProjectContext Create(Guid id, NexaMode mode, string? workspacePath) => new(id, "New project", mode, workspacePath, []);
    private string FileFor(Guid id) => Path.Combine(_directory, $"{id:N}.json");
    private async Task SaveAsync(ProjectContext project, CancellationToken token)
    {
        var temporary = FileFor(project.ProjectId) + ".tmp";
        await using (var write = File.Create(temporary)) await JsonSerializer.SerializeAsync(write, project, Json, token);
        File.Move(temporary, FileFor(project.ProjectId), true);
    }
}

/// <summary>Persists simple local memory. The interface permits replacing this with SQLite plus embeddings later.</summary>
public sealed class JsonFileMemoryStore : IMemoryStore
{
    private readonly InMemoryMemoryStore _cache = new();
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _file = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Nexa", "memory.json");
    private bool _loaded;
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public async Task RememberAsync(Guid projectId, string text, CancellationToken cancellationToken)
    {
        await EnsureLoadedAsync(cancellationToken);
        await _cache.RememberAsync(projectId, text, cancellationToken);
        await PersistAsync(projectId, text, cancellationToken);
    }

    public async Task<IReadOnlyList<string>> SearchAsync(Guid projectId, string query, int limit, CancellationToken cancellationToken)
    {
        await EnsureLoadedAsync(cancellationToken);
        return await _cache.SearchAsync(projectId, query, limit, cancellationToken);
    }

    private async Task EnsureLoadedAsync(CancellationToken token)
    {
        if (_loaded) return;
        await _gate.WaitAsync(token);
        try
        {
            if (_loaded) return;
            if (File.Exists(_file))
            {
                await using var read = File.OpenRead(_file);
                var data = await JsonSerializer.DeserializeAsync<Dictionary<Guid, List<string>>>(read, Json, token) ?? [];
                foreach (var (projectId, entries) in data)
                    foreach (var entry in entries) await _cache.RememberAsync(projectId, entry, token);
            }
            _loaded = true;
        }
        finally { _gate.Release(); }
    }

    private async Task PersistAsync(Guid projectId, string text, CancellationToken token)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_file)!);
        await _gate.WaitAsync(token);
        try
        {
            var data = new Dictionary<Guid, List<string>>();
            if (File.Exists(_file))
            {
                await using var read = File.OpenRead(_file);
                data = await JsonSerializer.DeserializeAsync<Dictionary<Guid, List<string>>>(read, Json, token) ?? [];
            }
            data.TryAdd(projectId, []);
            data[projectId].Add(text);
            await using (var write = File.Create(_file + ".tmp"))
            {
                await JsonSerializer.SerializeAsync(write, data, Json, token);
            }
            File.Move(_file + ".tmp", _file, true);
        }
        finally { _gate.Release(); }
    }
}
