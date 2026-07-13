using Microsoft.Extensions.DependencyInjection;
using Microsoft.UI.Xaml.Controls;
using Nexa_WinUI.ViewModels;

namespace Nexa_WinUI;

/// <summary>The view contains no orchestration logic; all behavior lives in its view model.</summary>
public sealed partial class MainPage : Page
{
    public MainPageViewModel ViewModel { get; } = App.Services.GetRequiredService<MainPageViewModel>();

    public MainPage()
    {
        InitializeComponent();
    }
}
