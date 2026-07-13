/**
 * Nexa 3.0 execution-plan builder.
 * This module is deliberately pure: it is easy to test and does not know about
 * HTTP, storage, Ollama, or the UI. The server owns the actual tool adapters.
 */
export function createNexaPipeline({
  message,
  mode,
  route,
  intent,
  workspaceReady,
  attachmentCount,
  accessLevel,
  requestedModel
}) {
  const isChat = mode === "chat";
  const tools = [];
  if (!isChat) {
    tools.push("memory");
    if (attachmentCount > 0) tools.push("rag");
    if (route.needsCode && workspaceReady) tools.push("file-system");
    if (route.needsCode && workspaceReady && accessLevel === "full") tools.push("terminal");
    if (route.needsResearch) tools.push("web-search");
    if (intent?.taskKind === "math") tools.push("calculator");
  }

  const tasks = [
    { id: "understand", title: "要求を整理", priority: 1 },
    ...(tools.length ? [{ id: "tools", title: "必要な情報を取得", priority: 2, tools }] : []),
    { id: "respond", title: "回答を生成", priority: 3 },
    { id: "critic", title: "品質を確認", priority: 4 }
  ];

  return {
    version: "3.0",
    mode,
    route,
    intent,
    planner: {
      goal: String(message || "").slice(0, 500),
      tasks,
      priority: route.needsCode ? "implementation" : route.needsResearch ? "grounded-answer" : "conversation"
    },
    intentRouter: {
      kind: intent?.taskKind || "conversation",
      needsCode: Boolean(route.needsCode),
      needsResearch: Boolean(route.needsResearch),
      confidence: intent?.isTerse ? "inferred" : "explicit"
    },
    toolExecutor: {
      enabled: !isChat,
      tools,
      workspaceBoundary: workspaceReady ? "selected-folder" : "none",
      terminalAllowed: tools.includes("terminal")
    },
    modelRouter: {
      placement: "local-first",
      requestedModel: requestedModel || "auto",
      role: route.needsCode ? "code" : "conversation"
    },
    critic: {
      enabled: true,
      rewriteOnFailure: true,
      checks: route.needsCode ? ["correctness", "workspace-boundary", "code-review"] : ["relevance", "completeness", "overclaim"]
    }
  };
}

export function pipelineSummary(pipeline) {
  return {
    version: pipeline.version,
    mode: pipeline.mode,
    intent: pipeline.intentRouter.kind,
    tools: pipeline.toolExecutor.tools,
    modelRole: pipeline.modelRouter.role,
    critic: pipeline.critic.checks
  };
}
