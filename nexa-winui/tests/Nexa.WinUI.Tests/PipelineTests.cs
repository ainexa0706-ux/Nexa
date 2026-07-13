using Nexa_WinUI.Application;
using Nexa_WinUI.Domain;

namespace Nexa.WinUI.Tests;

/// <summary>Examples of fast tests that do not need Ollama, a workspace, or a UI window.</summary>
public sealed class PipelineTests
{
    [Fact]
    public async Task ChatModePlanner_DoesNotGrantTools()
    {
        var router = new KeywordIntentRouter();
        var planner = new RulePlanner();
        var request = new ChatRequest(Guid.NewGuid(), "コードを直して", NexaMode.Chat, null, false, false);

        var intent = await router.RouteAsync(request, CancellationToken.None);
        var plan = await planner.CreatePlanAsync(request, intent, CancellationToken.None);

        Assert.All(plan.Steps, step => Assert.Empty(step.RequiredTools));
    }

    [Theory]
    [InlineData("1 + 2", IntentKind.Math)]
    [InlineData("このバグを修正して", IntentKind.Code)]
    [InlineData("こんにちは", IntentKind.Conversation)]
    public async Task IntentRouter_ClassifiesCommonRequests(string input, IntentKind expected)
    {
        var router = new KeywordIntentRouter();
        var request = new ChatRequest(Guid.NewGuid(), input, NexaMode.Both, null, false, false);

        var intent = await router.RouteAsync(request, CancellationToken.None);

        Assert.Equal(expected, intent.Kind);
    }

    [Fact]
    public async Task Critic_RequestsRewriteForAnEmptyResponse()
    {
        var critic = new HeuristicCriticAi();
        var request = new ChatRequest(Guid.NewGuid(), "説明して", NexaMode.Chat, null, false, false);
        var intent = new IntentDecision(IntentKind.Question, .9, "test", []);

        var result = await critic.ReviewAsync(request, intent, string.Empty, CancellationToken.None);

        Assert.True(result.ShouldRegenerate);
    }
}
