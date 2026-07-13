using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Nexa_WinUI.Application;
using Nexa_WinUI.Domain;

namespace Nexa_WinUI.ViewModels;

/// <summary>MVVM presentation model. It owns UI state and delegates all work to the orchestrator.</summary>
public partial class MainPageViewModel(IAgentOrchestrator orchestrator) : ObservableObject
{
    private readonly Guid _projectId = Guid.NewGuid();
    private CancellationTokenSource? _generation;

    public ObservableCollection<ChatMessageViewModel> Messages { get; } = [];
    public IReadOnlyList<NexaMode> Modes { get; } = Enum.GetValues<NexaMode>();

    [ObservableProperty] private string _draft = string.Empty;
    [ObservableProperty] private NexaMode _selectedMode = NexaMode.Chat;
    [ObservableProperty] private bool _allowCloud;
    [ObservableProperty] private bool _allowTerminal;
    [ObservableProperty] private string _workspacePath = string.Empty;
    [ObservableProperty] private string _status = "準備完了";
    [ObservableProperty] private bool _isGenerating;

    private bool CanSend() => !IsGenerating && !string.IsNullOrWhiteSpace(Draft);

    [RelayCommand(CanExecute = nameof(CanSend))]
    private async Task SendAsync()
    {
        var prompt = Draft.Trim();
        Draft = string.Empty;
        Messages.Add(new ChatMessageViewModel("あなた", prompt));
        var response = new ChatMessageViewModel("Nexa", string.Empty);
        Messages.Add(response);
        _generation = new CancellationTokenSource();
        IsGenerating = true;
        SendCommand.NotifyCanExecuteChanged();

        try
        {
            var request = new ChatRequest(_projectId, prompt, SelectedMode,
                string.IsNullOrWhiteSpace(WorkspacePath) ? null : WorkspacePath,
                AllowCloud, AllowTerminal);
            await foreach (var update in orchestrator.RunAsync(request, _generation.Token))
            {
                switch (update.Kind)
                {
                    case AgentStreamKind.Status:
                        Status = update.Content;
                        break;
                    case AgentStreamKind.Token:
                        response.Content += update.Content;
                        break;
                    case AgentStreamKind.ReplaceResponse:
                        response.Content = update.Content;
                        break;
                    case AgentStreamKind.Error:
                        response.Content = update.Content;
                        Status = "エラー";
                        break;
                    case AgentStreamKind.Completed:
                        Status = "完了";
                        break;
                }
            }
        }
        finally
        {
            IsGenerating = false;
            _generation.Dispose();
            _generation = null;
            SendCommand.NotifyCanExecuteChanged();
        }
    }

    [RelayCommand]
    private void Cancel() => _generation?.Cancel();

    partial void OnDraftChanged(string value) => SendCommand.NotifyCanExecuteChanged();
}

/// <summary>Small observable message item used by the chat list.</summary>
public partial class ChatMessageViewModel(string role, string content) : ObservableObject
{
    public string Role { get; } = role;
    [ObservableProperty] private string _content = content;
}
