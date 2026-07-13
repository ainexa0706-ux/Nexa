import assert from "node:assert/strict";
import { createNexaPipeline } from "../nexa-pipeline.mjs";

const chat = createNexaPipeline({
  message: "こんにちは",
  mode: "chat",
  route: { needsCode: false, needsResearch: false },
  intent: { taskKind: "conversation", isTerse: true },
  workspaceReady: true,
  attachmentCount: 0,
  accessLevel: "default",
  requestedModel: "nexa-1.0"
});
assert.deepEqual(chat.toolExecutor.tools, []);
assert.equal(chat.modelRouter.role, "conversation");

const code = createNexaPipeline({
  message: "このフォルダーにLPを作って",
  mode: "code",
  route: { needsCode: true, needsResearch: false },
  intent: { taskKind: "code", isTerse: false },
  workspaceReady: true,
  attachmentCount: 1,
  accessLevel: "full",
  requestedModel: "nexa-2.5"
});
assert.deepEqual(code.toolExecutor.tools, ["memory", "rag", "file-system", "terminal"]);
assert.equal(code.modelRouter.role, "code");
assert.ok(code.critic.checks.includes("code-review"));

console.log("Nexa pipeline tests passed.");
