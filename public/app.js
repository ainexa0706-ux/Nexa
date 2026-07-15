const CHAT_GOAL = "シンプルチャット";
const MODE_DETAILS = {
  code: {
    label: "コードモード",
    shortLabel: "Code",
    description: "フォルダー内のコードを読み、実装・デバッグ・テスト・変更レビューに集中します。"
  },
  chat: {
    label: "チャットモード",
    shortLabel: "Chat",
    description: "会話、相談、文章作成、画像生成をフォルダーなしですぐ始めます。"
  },
  both: {
    label: "両方",
    shortLabel: "Both",
    description: "会話しながら、必要なときだけコード編集・生成・ドキュメント作成を使います。"
  }
};
const ACCESS_DETAILS = {
  full: { label: "フルアクセス", description: "インターネット、PC上の全ファイル、コマンド、Windows操作を確認なしで許可します。" },
  safety: { label: "危険時に承認", description: "通常操作は進め、安全でない可能性がある操作だけ確認します。" },
  default: { label: "承認を常に求める", description: "外部ファイルの変更、インターネット、コマンド、Windows操作を毎回確認します。" }
};
const MODEL_CHOICES = ["nexa-3.0", "nexa-2.5", "nexa-2.0", "nexa-1.5", "nexa-1.0"];
const MODEL_DEFAULT_CHOICE = "nexa-3.0";
const NEXA_RUNTIME_MIGRATION_KEY = "nexa-runtime-generation";
const NEXA_MODEL_PROFILES = {
  "nexa-3.0": { name: "Nexa3.0", score: 0, specialty: "自動最適化", meta: "計画・ツール・品質確認を統合" },
  auto: { name: "Nexa1.5", score: 0, specialty: "標準", meta: "自動選択" },
  conversation: { name: "Nexa2.0", score: 0, specialty: "高品質", meta: "会話・相談向け" },
  code: { name: "Nexa2.5", score: 0, specialty: "最上位", meta: "コード・推論向け" },
  fast: { name: "Nexa1.0", score: 0, specialty: "高速", meta: "軽量応答向け" },
  "qwen3:4b": { name: "Nexa2.0", score: 0, specialty: "高品質", meta: "推論向け" },
  "qwen2.5:3b": { name: "Nexa1.0", score: 0, specialty: "高速", meta: "軽量応答向け" },
  "llama3.2:3b": { name: "Nexa1.5", score: 0, specialty: "標準", meta: "会話向け" },
  "gemma3:4b": { name: "Nexa1.5", score: 0, specialty: "標準", meta: "画像添付補助向け" },
  "mistral:7b": { name: "Nexa2.0", score: 0, specialty: "高品質", meta: "文章設計向け" },
  "deepseek-coder:6.7b": { name: "Nexa2.5", score: 0, specialty: "最上位", meta: "コード・推論向け" },
  "codellama:7b": { name: "Nexa2.5", score: 0, specialty: "最上位", meta: "コード補助向け" }
};
const NEXA_MODEL_TIERS = [
  { value: "nexa-3.0", label: "Nexa3.0", description: "自動最適化。依頼に合わせて計画・ツール・モデル・品質確認を統合", resolver: "orchestrated" },
  { value: "nexa-2.5", label: "Nexa2.5", description: "最も賢い。コード・推論・長い作業向け", resolver: "best" },
  { value: "nexa-2.0", label: "Nexa2.0", description: "高品質。相談・設計・実装のバランス", resolver: "smart" },
  { value: "nexa-1.5", label: "Nexa1.5", description: "標準。普段使いと軽い開発向け", resolver: "balanced" },
  { value: "nexa-1.0", label: "Nexa1.0", description: "軽量。高速な会話向け", resolver: "fast" }
];
const REASONING_DETAILS = {
  low: { label: "低", description: "短文・軽い相談向け" },
  medium: { label: "中", description: "通常の会話と実装向け" },
  high: { label: "高", description: "曖昧な依頼を補完して進める" },
  "very-high": { label: "非常に高い", description: "短い単語から意図を広く推定する" }
};
const PERFORMANCE_CHOICES = ["標準", "高速"];
const ASSISTANT_DISPLAY_NAME = "Nexa";
const AGENT_DISPLAY_NAMES = {
  chief: "司令塔",
  orchestrator: "司令塔",
  planner: "計画",
  plan: "計画",
  memory: "記憶",
  toolsmith: "ツール",
  toolrouter: "ツール",
  tool: "ツール",
  research: "調査",
  researcher: "調査",
  strategist: "設計",
  sage: "設計",
  secondopinion: "別視点",
  mira: "別視点",
  architect: "推論",
  reasoner: "推論",
  coder: "コード",
  patch: "コード",
  critic: "批評",
  verifier: "検証",
  selfevaluator: "品質",
  vela: "品質",
  security: "安全",
  response: "応答",
  responsegenerator: "応答",
  generator: "生成",
  imagegenerator: "画像生成",
  videogenerator: "動画生成",
  checks: "エラー確認",
  directwrite: "直接保存"
};
const IMAGE_GENERATION_ONLY = true;
const MODE_STORAGE_KEY = "agent-company-last-project-mode";
const MODE_CHIP_META = {
  code: { label: "モード", value: "コード", title: "コードモード" },
  chat: { label: "モード", value: "チャット", title: "チャットモード" },
  both: { label: "モード", value: "両方", title: "両方モード" },
  unset: { label: "モード", value: "選択", title: "モード未選択" }
};

function normalizeStoredModelChoice(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (MODEL_CHOICES.includes(clean)) return clean;
  if (clean === "auto" || clean.includes("3.0")) return "nexa-3.0";
  if (clean === "code" || clean.includes("coder") || clean.includes("deepseek") || clean.includes("codellama")) return "nexa-2.5";
  if (clean === "conversation" || clean.includes("mistral") || clean.includes("qwen3")) return "nexa-2.0";
  if (clean === "auto" || clean.includes("gemma") || clean.includes("llama")) return "nexa-1.5";
  if (clean === "fast" || clean.includes("qwen2.5")) return "nexa-1.0";
  return MODEL_DEFAULT_CHOICE;
}

function initialModelChoice() {
  const stored = localStorage.getItem("agent-company-model-choice");
  if (localStorage.getItem(NEXA_RUNTIME_MIGRATION_KEY) !== "3.0") {
    localStorage.setItem(NEXA_RUNTIME_MIGRATION_KEY, "3.0");
    localStorage.setItem("agent-company-model-choice", "nexa-3.0");
    return "nexa-3.0";
  }
  return normalizeStoredModelChoice(stored);
}

const state = {
  projects: [],
  activeProject: null,
  system: null,
  plugins: [],
  mcp: null,
  codex: null,
  liveAgents: [],
  socialOps: null,
  attachments: [],
  changeCards: new Map(),
  busy: false,
  followLatestMessage: true,
  abortController: null,
  query: "",
  renamingProjectId: "",
  projectMenuId: "",
  folderPanelOpen: false,
  featurePanelOpen: false,
  modelMenuOpen: false,
  generationMode: "",
  modelChoice: initialModelChoice(),
  modelSubmenu: "",
  performanceChoice: PERFORMANCE_CHOICES.includes(localStorage.getItem("agent-company-performance"))
    ? localStorage.getItem("agent-company-performance")
    : "標準",
  reasoningLevel: localStorage.getItem("agent-company-reasoning") || "very-high",
  planMode: localStorage.getItem("agent-company-plan-mode") === "true",
  leftCollapsed: localStorage.getItem("agent-company-left-collapsed") === "true",
  rightCollapsed: localStorage.getItem("agent-company-right-collapsed") === "true",
  account: null,
  accountTab: "login",
  accountKeys: [],
  accountBilling: null,
  accountNewSecret: "",
  accountModalOpen: false,
  authProviders: [],
  accountSetupRequired: false
};

const el = {
  projectName: document.querySelector("#projectName"),
  projectGoal: document.querySelector("#projectGoal"),
  projectStats: document.querySelector("#projectStats"),
  projectList: document.querySelector("#projectList"),
  projectSearch: document.querySelector("#projectSearch"),
  newChatButton: document.querySelector("#newChatButton"),
  messageStream: document.querySelector("#messageStream"),
  composer: document.querySelector("#composer"),
  composerProgress: document.querySelector("#composerProgress"),
  featureButton: document.querySelector("#featureButton"),
  featurePanel: document.querySelector("#featurePanel"),
  modelMenu: document.querySelector("#modelMenu"),
  modelMenuButton: document.querySelector("#modelMenuButton"),
  modelButtonLabel: document.querySelector("#modelButtonLabel"),
  composerModeButton: document.querySelector("#composerModeButton"),
  composerModeLabel: document.querySelector("#composerModeLabel"),
  composerModeValue: document.querySelector("#composerModeValue"),
  leftSidebarToggle: document.querySelector("#leftSidebarToggle"),
  rightSidebarToggle: document.querySelector("#rightSidebarToggle"),
  chatSidebar: document.querySelector("#chatSidebar"),
  workspacePanel: document.querySelector("#workspacePanel"),
  folderButton: document.querySelector("#folderButton"),
  composerFolderButton: document.querySelector("#composerFolderButton"),
  folderPanel: document.querySelector("#folderPanel"),
  folderLabel: document.querySelector("#folderLabel"),
  outputList: document.querySelector("#outputList"),
  sourceList: document.querySelector("#sourceList"),
  modelPerfList: document.querySelector("#modelPerfList"),
  intelligenceList: document.querySelector("#intelligenceList"),
  socialOpsList: document.querySelector("#socialOpsList"),
  agentList: document.querySelector("#agentList"),
  memoryList: document.querySelector("#memoryList"),
  taskList: document.querySelector("#taskList"),
  toolStatusList: document.querySelector("#toolStatusList"),
  safetyList: document.querySelector("#safetyList"),
  finalObjectiveSummary: document.querySelector("#finalObjectiveSummary"),
  finalObjectiveInput: document.querySelector("#finalObjectiveInput"),
  finalObjectiveMeta: document.querySelector("#finalObjectiveMeta"),
  finalObjectiveEdit: document.querySelector("#finalObjectiveEdit"),
  finalObjectiveSave: document.querySelector("#finalObjectiveSave"),
  finalObjectiveCancel: document.querySelector("#finalObjectiveCancel"),
  imageToolButton: document.querySelector("#imageToolButton"),
  fileInput: document.querySelector("#fileInput"),
  attachmentTray: document.querySelector("#attachmentTray"),
  promptInput: document.querySelector("#promptInput"),
  sendButton: document.querySelector("#sendButton"),
  modelLabel: document.querySelector("#modelLabel") || { textContent: "" },
  statusLabel: document.querySelector("#statusLabel") || { textContent: "" },
  workspaceCrumb: document.querySelector("#workspaceCrumb"),
  lockStatus: document.querySelector("#lockStatus"),
  toolbarModel: document.querySelector("#toolbarModel"),
  toolbarPerformance: document.querySelector("#toolbarPerformance"),
  toolbarSafety: document.querySelector("#toolbarSafety"),
  taskTimeline: document.querySelector("#taskTimeline"),
  memoryCount: document.querySelector("#memoryCount"),
  memoryState: document.querySelector("#memoryState"),
  memoryMeter: document.querySelector("#memoryMeter"),
  memoryUsage: document.querySelector("#memoryUsage"),
  pluginCount: document.querySelector("#pluginCount"),
  sidebarStatus: document.querySelector("#sidebarStatus"),
  accountButton: document.querySelector("#accountButton"),
  accountButtonLabel: document.querySelector("#accountButtonLabel"),
  accountModal: document.querySelector("#accountModal"),
  accountModalBackdrop: document.querySelector("#accountModalBackdrop"),
  accountModalClose: document.querySelector("#accountModalClose"),
  accountSignedOut: document.querySelector("#accountSignedOut"),
  accountSignedIn: document.querySelector("#accountSignedIn"),
  accountForm: document.querySelector("#accountForm"),
  accountNameField: document.querySelector("#accountNameField"),
  accountNameInput: document.querySelector("#accountNameInput"),
  accountEmailInput: document.querySelector("#accountEmailInput"),
  accountPasswordInput: document.querySelector("#accountPasswordInput"),
  accountSubmit: document.querySelector("#accountSubmit"),
  googleLoginButton: document.querySelector("#googleLoginButton"),
  googleLoginHint: document.querySelector("#googleLoginHint"),
  accountUserInitial: document.querySelector("#accountUserInitial"),
  accountUserName: document.querySelector("#accountUserName"),
  accountUserMeta: document.querySelector("#accountUserMeta"),
  accountPlanLabel: document.querySelector("#accountPlanLabel"),
  accountBillingLabel: document.querySelector("#accountBillingLabel"),
  accountCreditsLabel: document.querySelector("#accountCreditsLabel"),
  accountCreditsMeta: document.querySelector("#accountCreditsMeta"),
  accountCreditsMeter: document.querySelector("#accountCreditsMeter"),
  accountCheckoutButton: document.querySelector("#accountCheckoutButton"),
  accountCreateKeyButton: document.querySelector("#accountCreateKeyButton"),
  accountNewKey: document.querySelector("#accountNewKey"),
  accountKeyCount: document.querySelector("#accountKeyCount"),
  accountKeyList: document.querySelector("#accountKeyList"),
  accountAdminButton: document.querySelector("#accountAdminButton"),
  accountLogoutButton: document.querySelector("#accountLogoutButton"),
  accountStatus: document.querySelector("#accountStatus")
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: options.body ? { "content-type": "application/json" } : undefined,
    credentials: "same-origin",
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text };
  }
  if (!response.ok) {
    throw new Error(payload.error || payload.message || text || response.statusText);
  }
  return payload;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function timeLabel(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function relativeLabel(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  if (diff < minute) return "今";
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}分`;
  if (diff < day) return `${Math.floor(diff / hour)}時間`;
  if (diff < week) return `${Math.floor(diff / day)}日`;
  if (diff < month) return `${Math.floor(diff / week)}週間`;
  return `${Math.floor(diff / month)}か月`;
}

function shortModel(name) {
  const clean = String(name || "未接続").replace(":latest", "");
  return clean.startsWith("openai:") ? `Cloud ${clean.replace(/^openai:/, "")}` : clean;
}

function normalizedModelKey(value) {
  return shortModel(value).toLowerCase();
}

function modelProfile(value, resolved = "") {
  const tier = modelTier(value || resolved || MODEL_DEFAULT_CHOICE);
  return { name: tier.label, score: "", specialty: "Nexa", meta: tier.description };
}

function modelScoreLabel(value, resolved = "") {
  return modelProfile(value, resolved).name;
}

function modelMetaLabel(value, resolved = "") {
  const tier = modelTier(value);
  const actual = shortModel(resolved || resolveNexaTierModel(value));
  const cloud = String(resolved || resolveNexaTierModel(value)).startsWith("openai:");
  return `${tier.description}${cloud ? " · クラウド品質" : ""} · 実体 ${actual}`;
}

function resolvedModelForChoice(value) {
  return resolveNexaTierModel(value);
}

function modelValueLabel(value) {
  return modelTier(value).label;
}

function installedModelNames() {
  return [
    ...(state.system?.ollama?.models || []),
    ...(state.system?.cloud?.models || [])
  ]
    .map((model) => model?.name || model?.model || "")
    .filter(Boolean);
}

function availableModelChoices() {
  return NEXA_MODEL_TIERS.map((tier) => ({
    value: tier.value,
    label: tier.label,
    meta: modelMetaLabel(tier.value)
  }));
}

function resolvedModelName(mode = projectMode()) {
  return resolveNexaTierModel(state.modelChoice, mode);
}

function modelButtonText() {
  return modelTier(state.modelChoice).label;
}

function setModelChoice(choice) {
  state.modelChoice = normalizeStoredModelChoice(choice);
  localStorage.setItem("agent-company-model-choice", state.modelChoice);
  state.modelSubmenu = "";
  renderTopBar();
  renderWorkspacePanel();
  renderModelMenu();
  setStatus(`モデル: ${modelButtonText()}`);
}

function modelTier(value = state.modelChoice) {
  const clean = normalizeStoredModelChoice(value);
  return NEXA_MODEL_TIERS.find((tier) => tier.value === clean) || NEXA_MODEL_TIERS[NEXA_MODEL_TIERS.length - 1];
}

function resolveNexaTierModel(value = state.modelChoice, mode = projectMode()) {
  const plan = state.system?.plan || {};
  const tier = modelTier(value);
  if (tier.resolver === "orchestrated") {
    return mode === "code"
      ? (plan.code || plan.conversation || plan.fast || "Auto")
      : (plan.conversation || plan.code || plan.fast || "Auto");
  }
  if (tier.resolver === "best") {
    return plan.code || plan.conversation || plan.fast || "Auto";
  }
  if (tier.resolver === "smart") {
    return plan.conversation || plan.code || plan.fast || "Auto";
  }
  if (tier.resolver === "balanced") {
    return mode === "code"
      ? (plan.code || plan.conversation || plan.fast || "Auto")
      : (plan.conversation || plan.fast || plan.code || "Auto");
  }
  return plan.fast || plan.conversation || plan.code || "Auto";
}

function setPerformanceChoice(choice) {
  state.performanceChoice = PERFORMANCE_CHOICES.includes(choice) ? choice : "標準";
  localStorage.setItem("agent-company-performance", state.performanceChoice);
  state.modelSubmenu = "";
  renderTopBar();
  renderModelMenu();
  setStatus(`速度: ${state.performanceChoice}`);
}

function setReasoningLevel(level) {
  state.reasoningLevel = REASONING_DETAILS[level] ? level : "very-high";
  localStorage.setItem("agent-company-reasoning", state.reasoningLevel);
  renderModelMenu();
  setStatus(`推論: ${REASONING_DETAILS[state.reasoningLevel].label}`);
}

function clipPlain(value, limit = 28) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function formatBytes(size = 0) {
  const bytes = Number(size || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function workspaceLabel(path = "", ready = false) {
  if (ready && !path) return "ワークスペース全体";
  return path ? path.split("/").filter(Boolean).pop() || path : "フォルダーを選択";
}

function workspaceReady(project = state.activeProject) {
  return Boolean(project?.workspaceReady);
}

function workspaceScopeText(project = state.activeProject) {
  if (!workspaceReady(project)) return "最初に作業フォルダーを選択してください";
  return `作業フォルダー: ${workspaceLabel(project.workspaceRoot || "", true)}`;
}

function isNewEmptyProject(project = state.activeProject) {
  return Boolean(project && (project.messages || []).length === 0);
}

function projectMode(project = state.activeProject) {
  if (!project) return "";
  const raw = String(project?.mode || "").toLowerCase();
  if (raw === "code" || raw === "chat" || raw === "both") return raw;
  return isNewEmptyProject(project) ? "" : (workspaceReady(project) ? "code" : "chat");
}

function savedProjectMode() {
  const raw = String(localStorage.getItem(MODE_STORAGE_KEY) || "").toLowerCase();
  return MODE_DETAILS[raw] ? raw : "";
}

function rememberProjectMode(mode) {
  if (MODE_DETAILS[mode]) localStorage.setItem(MODE_STORAGE_KEY, mode);
}

function composerModeMeta(project = state.activeProject) {
  return MODE_CHIP_META[projectMode(project)] || MODE_CHIP_META.unset;
}

function updateComposerModeButton() {
  if (!el.composerModeButton) return;
  const mode = projectMode();
  const meta = composerModeMeta();
  el.composerModeButton.classList.remove("is-code", "is-chat", "is-both", "is-unset", "is-open");
  el.composerModeButton.classList.add(`is-${mode || "unset"}`);
  el.composerModeButton.classList.toggle("is-open", state.featurePanelOpen);
  el.composerModeButton.setAttribute("aria-expanded", String(state.featurePanelOpen));
  el.composerModeButton.title = meta.title;
  if (el.composerModeLabel) el.composerModeLabel.textContent = meta.label;
  if (el.composerModeValue) el.composerModeValue.textContent = meta.value;
}

function accessLevel(project = state.activeProject) {
  const raw = String(project?.accessLevel || "default").toLowerCase();
  return ACCESS_DETAILS[raw] ? raw : "default";
}

function runModeForProject(project = state.activeProject) {
  if (state.planMode) return "plan";
  const mode = projectMode(project);
  if (mode === "code") return "code";
  if (mode === "both") return workspaceReady(project) ? "agent" : "ask";
  return "ask";
}

function selectedFolderName(project = state.activeProject) {
  return project?.selectedFolderName || workspaceLabel(project?.workspaceRoot || "", workspaceReady(project));
}

function modeClass(project = state.activeProject) {
  return `mode-${projectMode(project) || "unset"}`;
}

function lineStats(file = {}) {
  const diffLines = String(file.diff || "").split("\n");
  const diffAdditions = diffLines.filter((line) => line.startsWith("+")).length;
  const diffDeletions = diffLines.filter((line) => line.startsWith("-")).length;
  const additions = Math.max(0, Number(file.additions ?? (file.diff ? diffAdditions : file.changedLines ?? 0)));
  const deletions = Math.max(0, Number(file.deletions ?? file.deletedLines ?? file.removedLines ?? diffDeletions));
  return { additions, deletions };
}

function renderDiffPreview(diff = "") {
  const lines = String(diff || "差分情報はありません").split("\n").slice(0, 120);
  return lines.map((line) => {
    const tone = line.startsWith("+") ? "is-add" : line.startsWith("-") ? "is-delete" : "is-context";
    return `<span class="${tone}">${escapeHtml(line || " ")}</span>`;
  }).join("");
}

function memoryItemCount(memory = {}) {
  return (
    (memory.facts || []).length +
    (memory.decisions || []).length +
    (memory.next || []).length +
    (memory.tasks || []).length
  );
}

function agentLabel(agent = {}) {
  const raw = agent.name || agent.title || agent.id || "AI";
  const key = String(agent.id || raw).replace(/[\s_-]+/g, "").toLowerCase();
  return AGENT_DISPLAY_NAMES[key] || raw;
}

function agentStatusText(agent = {}, busy = state.busy) {
  const key = String(agent.id || agent.name || "").replace(/[\s_-]+/g, "").toLowerCase();
  if (agent.error) return "確認が必要";
  if (!busy && /complete|done|ready/i.test(agent.status || "")) return "完了";
  if (!busy) return "待機中";
  if (key.includes("orchestrator") || key.includes("chief")) return "計画を立案中";
  if (key.includes("planner")) return "タスクを分解中";
  if (key.includes("memory")) return "記憶を照合中";
  if (key.includes("tool")) return "ツールを選定中";
  if (key.includes("research")) return "情報源を確認中";
  if (key.includes("strategist")) return "成功条件を設計中";
  if (key.includes("secondopinion")) return "別視点で検証中";
  if (key.includes("reason") || key.includes("architect")) return "方針を検討中";
  if (key.includes("coder") || key.includes("patch")) return "コードを生成中";
  if (key.includes("critic")) return "設計をレビュー中";
  if (key.includes("verifier")) return "テストを検証中";
  if (key.includes("selfevaluator")) return "回答を採点中";
  if (key.includes("security")) return "脆弱性をスキャン中";
  if (key.includes("response")) return "応答を準備中";
  return "実行中";
}

function agentTone(label = "") {
  const key = String(label || "").toLowerCase();
  if (/計画|設計|別視点|planner|strategist|second/.test(key)) return "planner";
  if (/コード|推論|coder|patch|reason|architect/.test(key)) return "coder";
  if (/検証|品質|verifier|self|vela/.test(key)) return "verifier";
  if (/安全|security/.test(key)) return "security";
  if (/応答|response/.test(key)) return "response";
  return "orchestrator";
}

function renderTopBar() {
  const project = state.activeProject;
  const plan = state.system?.plan || {};
  const specs = state.system?.specs || {};
  const codex = state.codex?.codex || project?.codex || {};
  const mode = projectMode(project);
  const access = accessLevel(project);
  const model = shortModel(resolvedModelName(mode));
  const workspace = workspaceLabel(project?.workspaceRoot || "", workspaceReady(project));
  const permissions = codex.permissions || "workspace-write";
  const approvalCount = (codex.approvals || []).filter((approval) => approval.status === "pending").length;

  document.body.classList.remove("mode-unset", "mode-code", "mode-chat", "mode-both");
  document.body.classList.add(modeClass(project));
  document.body.classList.toggle("is-plan-mode", state.planMode);
  if (el.workspaceCrumb) el.workspaceCrumb.textContent = workspace;
  if (el.lockStatus) {
    el.lockStatus.classList.toggle("is-unlocked", !workspaceReady(project));
    el.lockStatus.innerHTML = workspaceReady(project)
      ? `<span aria-hidden="true">🔒</span> ロック中`
      : `<span aria-hidden="true">○</span> 未選択`;
  }
  if (el.toolbarModel) {
    el.toolbarModel.innerHTML = `<span class="toolbar-dot"></span>モデル: ${escapeHtml(modelButtonText())}`;
    el.toolbarModel.setAttribute("role", "button");
    el.toolbarModel.setAttribute("tabindex", "0");
  }
  if (el.modelLabel) el.modelLabel.textContent = modelScoreLabel(state.modelChoice || "auto", model);
  if (el.modelButtonLabel) el.modelButtonLabel.textContent = clipPlain(modelButtonText(), 32);
  updateComposerModeButton();
  if (el.toolbarPerformance) {
    const memory = specs.memoryGb ? `${specs.memoryGb}GB` : "自動検出";
    const reasoning = REASONING_DETAILS[state.reasoningLevel]?.label || "高";
    el.toolbarPerformance.innerHTML = `<span aria-hidden="true">✦</span> パフォーマンス: ${escapeHtml(state.performanceChoice)} · 推論${escapeHtml(reasoning)} · ${escapeHtml(memory)}`;
    el.toolbarPerformance.setAttribute("role", "button");
    el.toolbarPerformance.setAttribute("tabindex", "0");
  }
  if (el.toolbarSafety) {
    const accessLabel = ACCESS_DETAILS[access]?.label || "デフォルト";
    el.toolbarSafety.innerHTML = `<span aria-hidden="true">◈</span> 安全性ゲート: ${approvalCount ? `${approvalCount}件承認待ち` : accessLabel} · ${escapeHtml(permissions)}`;
  }
  renderFeaturePanel();
  renderModelMenu();
}

function renderSidebarVitals(statusText = "") {
  const project = state.activeProject;
  const memory = project?.memory || {};
  const count = memoryItemCount(memory);
  const fileBytes = (project?.files || []).reduce((sum, file) => sum + Number(file.size || 0), 0);
  const usedGb = Math.min(9.8, Math.max(0.1, (count * 38_000 + fileBytes) / 1024 ** 3));
  const ratio = Math.min(100, Math.max(6, (usedGb / 10) * 100));
  const mcpServers = state.mcp?.servers || [];
  const enabledMcp = mcpServers.filter((server) => server.enabled).length;
  const pluginTotal = (state.plugins || []).length + mcpServers.length;
  const pluginReady = (state.plugins || []).length + enabledMcp;
  const ready = state.system?.ollama?.online !== false;

  if (el.memoryCount) el.memoryCount.textContent = String(count || 0);
  if (el.memoryState) el.memoryState.textContent = count ? "長期記憶が有効です" : "会話から記憶を構築します";
  if (el.memoryMeter) el.memoryMeter.style.width = `${ratio}%`;
  if (el.memoryUsage) el.memoryUsage.textContent = `使用量 ${usedGb.toFixed(1)}GB / 10GB`;
  if (el.pluginCount) el.pluginCount.textContent = `${pluginReady}/${pluginTotal || 0}`;
  if (el.sidebarStatus) {
    el.sidebarStatus.classList.toggle("is-offline", !ready);
    const text = statusText || (state.busy ? "実行中" : ready ? "準備完了" : "Ollama未接続");
    const label = el.sidebarStatus.querySelector("span:nth-child(2)");
    if (label) label.textContent = text;
  }
}

function renderTaskTimeline() {
  if (!el.taskTimeline) return;
  const project = state.activeProject;
  const mode = projectMode(project);
  el.taskTimeline.hidden = isNewEmptyProject(project) || mode === "chat" || !mode;
  if (el.taskTimeline.hidden) {
    el.taskTimeline.innerHTML = "";
    return;
  }
  const changes = latestChangeRun(project)?.changes || [];
  const messages = project?.messages || [];
  const steps = ["要件分析", "設計", "実装", "テスト", "ドキュメント"];
  let activeIndex = messages.length ? 1 : 0;
  if (workspaceReady(project)) activeIndex = Math.max(activeIndex, 2);
  if (changes.length) activeIndex = 3;
  if (!state.busy && changes.length) activeIndex = 4;
  if (state.busy && state.liveAgents.some((agent) => ["verifier", "proof"].includes(String(agent.id || agent.name || "").toLowerCase()))) activeIndex = 3;

  el.taskTimeline.innerHTML = steps.map((step, index) => {
    const stateClass = index < activeIndex ? "is-done" : index === activeIndex ? "is-active" : "is-waiting";
    return `
      <span class="timeline-step ${stateClass}">
        <i aria-hidden="true"></i>
        <span>${escapeHtml(step)}</span>
      </span>
    `;
  }).join("");
}

function flattenFolders(nodes = [], level = 0, folders = []) {
  for (const node of nodes) {
    if (node.type !== "directory") continue;
    folders.push({ path: node.path, name: node.name, level });
    flattenFolders(node.children || [], level + 1, folders);
  }
  return folders;
}

function renderWorkspaceFolder() {
  const root = state.activeProject?.workspaceRoot || "";
  const ready = workspaceReady();
  if (!el.folderLabel) return;
  el.folderLabel.textContent = workspaceLabel(root, ready);
  el.folderButton?.classList.toggle("has-folder", ready);
  el.composerFolderButton?.classList.toggle("has-folder", ready);
  renderTopBar();
  renderTaskTimeline();
}

function latestChangeRun(project = state.activeProject) {
  const runs = project?.runs || [];
  const changeIndex = [...runs].map((run, index) => ({ run, index })).reverse()
    .find(({ run }) => Array.isArray(run.changes) && run.changes.length)?.index ?? -1;
  if (changeIndex < 0) return null;

  // A later conversational/choice turn must not resurrect an old change card.
  const superseded = runs.slice(changeIndex + 1).some((run) =>
    ["choice-gate", "multi-agent-chat"].includes(run.type)
  );
  return superseded ? null : runs[changeIndex];
}

function latestRun(project = state.activeProject) {
  return [...(project?.runs || [])].reverse().find((run) => Array.isArray(run.agents) && run.agents.length);
}

function generatedArtifacts(project = state.activeProject) {
  const fromProject = Array.isArray(project?.generated) ? project.generated : [];
  const fromRuns = (project?.runs || []).flatMap((run) => Array.isArray(run.artifacts) ? run.artifacts : []);
  const seen = new Set();
  return [...fromProject, ...fromRuns]
    .filter((artifact) => artifact?.url && (!IMAGE_GENERATION_ONLY || artifact.kind !== "video"))
    .reverse()
    .filter((artifact) => {
      const key = artifact.id || artifact.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function artifactLabel(kind = "image") {
  return kind === "video" ? "動画" : "画像";
}

function artifactIconClass(kind = "image") {
  return kind === "video" ? "workspace-file-icon" : "workspace-image-icon";
}

function renderArtifactCards(artifacts = []) {
  return artifacts.map((artifact) => {
    const isVideo = artifact.kind === "video";
    const isVideoFile = isVideo && /video\/|\.mp4(?:$|\?)|\.webm(?:$|\?)/i.test(`${artifact.mime || ""} ${artifact.url || ""}`);
    const isImageFile = /image\/|\.gif(?:$|\?)|\.png(?:$|\?)|\.webp(?:$|\?)|\.jpe?g(?:$|\?)/i.test(`${artifact.mime || ""} ${artifact.url || ""}`);
    const key = artifact.id || artifact.url;
    const fallbackLabel = "\u9ad8\u54c1\u8cea\u5074";
    const fallbackNote = artifact.fallbackReason
      ? `<span class="artifact-warning">${fallbackLabel}: ${escapeHtml(clipPlain(artifact.fallbackReason, 120))}</span>`
      : "";
    return `
      <figure class="artifact-card is-${escapeHtml(artifact.kind || "image")}">
        <button class="artifact-preview" type="button" data-preview-artifact="${escapeHtml(key)}">
          ${isVideoFile
            ? `<video src="${escapeHtml(artifact.url)}" muted loop playsinline controls preload="metadata"></video>`
            : isImageFile
            ? `<img src="${escapeHtml(artifact.url)}" alt="${escapeHtml(artifact.title || artifactLabel(artifact.kind))}" loading="lazy" />`
            : isVideo
            ? `<iframe src="${escapeHtml(artifact.url)}" title="${escapeHtml(artifact.title || artifactLabel(artifact.kind))}" loading="lazy"></iframe>`
            : `<img src="${escapeHtml(artifact.url)}" alt="${escapeHtml(artifact.title || artifactLabel(artifact.kind))}" loading="lazy" />`}
          ${isVideo ? `<span class="artifact-play" aria-hidden="true"></span>` : ""}
        </button>
        <figcaption>
          <strong>${escapeHtml(artifact.title || artifactLabel(artifact.kind))}</strong>
          <span>${escapeHtml(artifact.provider || (isVideo ? "local-cinematic-video" : "local-cinematic-image"))}${isVideo && artifact.durationSec ? ` / ${escapeHtml(String(artifact.durationSec))}s` : ""}</span>
          ${fallbackNote}
          <button type="button" data-preview-artifact="${escapeHtml(key)}">プレビュー</button>
        </figcaption>
      </figure>
    `;
  }).join("");
}

function renderArtifactOutputItem(artifact) {
  const key = artifact.id || artifact.url;
  return `
    <button class="workspace-item output-item artifact-output" type="button" data-preview-artifact="${escapeHtml(key)}">
      <span class="${escapeHtml(artifactIconClass(artifact.kind))}" aria-hidden="true"></span>
      <span title="${escapeHtml(artifact.title || artifact.prompt || "")}">${escapeHtml(clipPlain(artifact.title || artifact.prompt || artifactLabel(artifact.kind), 34))}</span>
      <small>${escapeHtml(artifact.provider || (artifact.kind === "video" ? "local-cinematic-video" : "local-cinematic-image"))}</small>
    </button>
  `;
}

function findArtifactByKey(key) {
  return generatedArtifacts().find((artifact) => String(artifact.id || artifact.url) === String(key));
}

function showArtifactPreview(artifact) {
  if (!artifact?.url) return;
  let modal = document.querySelector("#artifactPreviewModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "artifactPreviewModal";
    modal.className = "artifact-modal";
    document.body.appendChild(modal);
  }
  const isVideo = artifact.kind === "video";
  const isVideoFile = isVideo && /video\/|\.mp4(?:$|\?)|\.webm(?:$|\?)/i.test(`${artifact.mime || ""} ${artifact.url || ""}`);
  const isImageFile = /image\/|\.gif(?:$|\?)|\.png(?:$|\?)|\.webp(?:$|\?)|\.jpe?g(?:$|\?)/i.test(`${artifact.mime || ""} ${artifact.url || ""}`);
  modal.innerHTML = `
    <div class="artifact-modal-backdrop" data-close-artifact-preview></div>
    <section class="artifact-modal-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(artifact.title || artifactLabel(artifact.kind))}">
      <header>
        <strong>${escapeHtml(artifact.title || artifactLabel(artifact.kind))}</strong>
        <button type="button" data-close-artifact-preview aria-label="閉じる">×</button>
      </header>
      <div class="artifact-modal-preview">
        ${isVideoFile
          ? `<video src="${escapeHtml(artifact.url)}" controls autoplay muted loop playsinline></video>`
          : isImageFile
          ? `<img src="${escapeHtml(artifact.url)}" alt="${escapeHtml(artifact.title || "image preview")}" />`
          : isVideo
          ? `<iframe src="${escapeHtml(artifact.url)}" title="${escapeHtml(artifact.title || "video preview")}"></iframe>`
          : `<img src="${escapeHtml(artifact.url)}" alt="${escapeHtml(artifact.title || "image preview")}" />`}
      </div>
      <footer>
        <span>${escapeHtml(artifact.provider || (isVideo ? "local-cinematic-video" : "local-cinematic-image"))}</span>
        <span>${escapeHtml(artifact.prompt || "")}</span>
      </footer>
    </section>
  `;
  modal.hidden = false;
}

function closeArtifactPreview() {
  const modal = document.querySelector("#artifactPreviewModal");
  if (modal) modal.hidden = true;
}

async function openWorkspaceFilePreview(filePath = "") {
  const projectId = state.activeProject?.id;
  if (!projectId || !filePath) return;
  try {
    const file = await api(`/api/workspace/file?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(filePath)}`);
    showWorkspaceFilePreview(file);
  } catch (error) {
    setStatus(`ファイルを開けませんでした: ${error.message}`);
  }
}

function showWorkspaceFilePreview(file = {}) {
  let modal = document.querySelector("#workspaceFilePreviewModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "workspaceFilePreviewModal";
    modal.className = "artifact-modal file-preview-modal";
    document.body.appendChild(modal);
  }
  const content = file.text
    ? `<pre><code>${escapeHtml(file.content || "")}</code></pre>`
    : `<div class="file-preview-empty">このファイルはテキストプレビューできません。</div>`;
  modal.innerHTML = `
    <div class="artifact-modal-backdrop" data-close-file-preview></div>
    <section class="artifact-modal-card file-preview-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(file.path || "file")}">
      <header>
        <strong>${escapeHtml(file.path || "file")}</strong>
        <button type="button" data-close-file-preview aria-label="閉じる">×</button>
      </header>
      <div class="file-preview-body">${content}</div>
      <footer>
        <span>${escapeHtml(String(file.size || 0))} bytes</span>
        ${file.hash ? `<span>${escapeHtml(file.hash.slice(0, 12))}</span>` : ""}
      </footer>
    </section>
  `;
  modal.hidden = false;
}

function closeWorkspaceFilePreview() {
  const modal = document.querySelector("#workspaceFilePreviewModal");
  if (modal) modal.hidden = true;
}

function accountInitial(user = state.account) {
  const source = user?.name || user?.email || "Nexa";
  return source.trim().charAt(0).toUpperCase() || "N";
}

function accountPlanLabel(planId = "free") {
  return {
    free: "無料",
    plus: "プラス",
    pro: "プロ",
    studio: "スタジオ"
  }[planId] || planId;
}

function accountRoleLabel(role = "user") {
  return role === "admin" ? "管理者" : "ユーザー";
}

function formatNumber(value) {
  return new Intl.NumberFormat("ja-JP").format(Number(value || 0));
}

function renderAccountCredits() {
  const credits = state.accountBilling?.credits || state.account?.credits || null;
  if (!el.accountCreditsLabel || !el.accountCreditsMeta || !el.accountCreditsMeter) return;
  if (!credits) {
    el.accountCreditsLabel.textContent = "未同期";
    el.accountCreditsMeta.textContent = "ログインすると残高を同期します";
    el.accountCreditsMeter.style.width = "0%";
    return;
  }
  if (credits.unlimited) {
    el.accountCreditsLabel.textContent = "無制限";
    el.accountCreditsMeta.textContent = `${formatNumber(credits.used)} クレジット使用済み`;
    el.accountCreditsMeter.style.width = "100%";
    return;
  }
  const total = Math.max(1, Number(credits.total || credits.monthly || 1));
  const remaining = Math.max(0, Number(credits.remaining || 0));
  const used = Math.max(0, Number(credits.used || 0));
  const percent = Math.max(0, Math.min(100, (remaining / total) * 100));
  el.accountCreditsLabel.textContent = `${formatNumber(remaining)} / ${formatNumber(total)}`;
  el.accountCreditsMeta.textContent = `${formatNumber(used)} 使用済み / ${credits.month || ""}`;
  el.accountCreditsMeter.style.width = `${percent}%`;
}

function setAccountStatus(message = "", isError = false) {
  if (!el.accountStatus) return;
  el.accountStatus.textContent = message;
  el.accountStatus.classList.toggle("is-error", Boolean(isError));
}

function renderAccountButton() {
  if (!el.accountButton || !el.accountButtonLabel) return;
  const loggedIn = Boolean(state.account);
  el.accountButton.classList.toggle("is-signed-in", loggedIn);
  el.accountButtonLabel.textContent = loggedIn ? (state.account.name || state.account.email || "アカウント") : "ログイン";
  const avatar = el.accountButton.querySelector(".account-avatar");
  if (avatar) avatar.textContent = loggedIn ? accountInitial() : "N";
}

function renderAccountAuthMode() {
  if (!state.account && state.accountSetupRequired) state.accountTab = "register";
  document.querySelectorAll("[data-account-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.accountTab === state.accountTab);
  });
  const registering = state.accountTab === "register";
  if (el.accountNameField) el.accountNameField.hidden = !registering;
  if (el.accountSubmit) el.accountSubmit.textContent = registering ? "登録して開始" : "ログイン";
  if (el.accountPasswordInput) {
    el.accountPasswordInput.autocomplete = registering ? "new-password" : "current-password";
  }
}

function providerById(id) {
  return (state.authProviders || []).find((provider) => provider.id === id) || null;
}

function runningInElectron() {
  return /Electron/i.test(navigator.userAgent || "");
}

function renderAuthProviders() {
  const google = providerById("google");
  const configured = Boolean(google?.configured);
  if (el.googleLoginButton) {
    el.googleLoginButton.disabled = !configured;
    el.googleLoginButton.classList.toggle("is-disabled", !configured);
  }
  if (el.googleLoginHint) {
    el.googleLoginHint.textContent = configured
      ? "Googleアカウントでログインできます。"
      : "Googleログインはまだ設定されていません。";
  }
}

function renderAccountKeys() {
  if (el.accountKeyList) el.accountKeyList.innerHTML = "";
  if (el.accountKeyCount) el.accountKeyCount.textContent = "0";
}

function renderAccountModal() {
  if (!el.accountModal) return;
  el.accountModal.hidden = !state.accountModalOpen;
  renderAccountButton();
  renderAccountAuthMode();
  renderAuthProviders();

  const loggedIn = Boolean(state.account);
  if (el.accountSignedOut) el.accountSignedOut.hidden = loggedIn;
  if (el.accountSignedIn) el.accountSignedIn.hidden = !loggedIn;
  if (!loggedIn) return;

  const user = state.account;
  const plan = state.accountBilling?.plan || user.plan || "free";
  if (el.accountUserInitial) el.accountUserInitial.textContent = accountInitial(user);
  if (el.accountUserName) el.accountUserName.textContent = user.name || user.email || "Nexaユーザー";
  if (el.accountUserMeta) el.accountUserMeta.textContent = `${user.email || ""} / ${accountRoleLabel(user.role)}`.trim();
  if (el.accountPlanLabel) el.accountPlanLabel.textContent = `${accountPlanLabel(plan)}${user.subscriptionStatus ? ` / ${user.subscriptionStatus}` : ""}`;
  if (el.accountBillingLabel) el.accountBillingLabel.textContent = "プラン変更は課金ページで行えます。";
  renderAccountCredits();
  if (el.accountCheckoutButton) el.accountCheckoutButton.disabled = false;
  if (el.accountAdminButton) el.accountAdminButton.hidden = user.role !== "admin";
  renderAccountKeys();
}

function setAccountModalOpen(open) {
  state.accountModalOpen = Boolean(open);
  renderAccountModal();
  if (open) {
    setFeaturePanelOpen(false);
    setModelMenuOpen(false);
    if (!state.account && state.accountSetupRequired) {
      setAccountStatus("最初のアカウントを作成すると、このPCのNexa管理者になります。");
    }
  }
}

function consumeAccountRedirectStatus() {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get("auth");
  const authError = params.get("auth_error");
  if (!auth && !authError) return null;
  params.delete("auth");
  params.delete("auth_error");
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash || ""}`;
  window.history.replaceState({}, "", nextUrl);
  if (authError) return { message: `Googleログインエラー: ${authError}`, error: true };
  if (auth === "google") return { message: "Googleでログインしました。", error: false };
  return null;
}

async function loadAccountDetails() {
  if (!state.account) return;
  const billing = await Promise.allSettled([api("/api/billing/status")]);
  state.accountBilling = billing[0].status === "fulfilled" ? billing[0].value : null;
  state.accountKeys = [];
  renderAccountModal();
}

async function loadAccount() {
  const me = await api("/api/auth/me");
  state.account = me.user || null;
  if (!state.account && runningInElectron()) window.nexaDesktop?.clearSession?.();
  state.authProviders = me.providers || [];
  state.accountSetupRequired = Boolean(me.setupRequired);
  state.accountBilling = null;
  state.accountKeys = [];
  if (state.account) await loadAccountDetails();
  renderAccountModal();
}

async function handleAccountSubmit(event) {
  event.preventDefault();
  if (!el.accountEmailInput || !el.accountPasswordInput) return;
  setAccountStatus("認証中...");
  if (el.accountSubmit) el.accountSubmit.disabled = true;
  try {
    const path = state.accountTab === "register" ? "/api/auth/register" : "/api/auth/login";
    const result = await api(path, {
      method: "POST",
      body: {
        name: el.accountNameInput?.value || "",
        email: el.accountEmailInput.value,
        password: el.accountPasswordInput.value
      }
    });
    state.account = result.user;
    if (result.desktopSessionToken) await window.nexaDesktop?.saveSession?.(result.desktopSessionToken);
    state.accountNewSecret = "";
    el.accountPasswordInput.value = "";
    setAccountStatus(result.firstUser ? "管理者アカウントを作成しました。" : "ログインしました。");
    await loadAccountDetails();
    renderAccountModal();
  } catch (error) {
    setAccountStatus(error.message, true);
  } finally {
    if (el.accountSubmit) el.accountSubmit.disabled = false;
  }
}

async function createAccountKey() {
  setAccountStatus("このビルドではNexa APIキー機能は削除されています。", true);
}

async function deleteAccountKey() {
  setAccountStatus("このビルドではNexa APIキー機能は削除されています。", true);
}

async function startBillingCheckout() {
  if (!state.account) {
    setAccountStatus("先にログインしてください。", true);
    return;
  }
  window.location.href = "/billing";
}

async function logoutAccount() {
  try {
    await api("/api/auth/logout", { method: "POST", body: {} });
  } catch {
    // Local session may already be gone; clear the UI either way.
  }
  state.account = null;
  await window.nexaDesktop?.clearSession?.();
  state.accountBilling = null;
  state.accountKeys = [];
  state.accountNewSecret = "";
  setAccountStatus("ログアウトしました。もう一度Googleでログインできます。");
  await loadAccount().catch(() => renderAccountModal());
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startDesktopGoogleLogin(google) {
  setAccountStatus("Googleログインをブラウザで開いています...");
  if (el.googleLoginButton) el.googleLoginButton.disabled = true;
  try {
    const started = await api(google.desktopStartUrl || "/api/auth/google/desktop/start", {
      method: "POST",
      body: {}
    });
    if (!started.url || !started.state) throw new Error("desktop_oauth_start_failed");
    window.open(started.url, "_blank", "noopener");
    setAccountStatus("ブラウザでGoogleログインを完了してください。Nexaが自動で続行します。");
    const deadline = Date.now() + 2 * 60 * 1000;
    while (Date.now() < deadline) {
      await wait(1200);
      const result = await api(`/api/auth/google/desktop/poll?state=${encodeURIComponent(started.state)}`);
      if (result.status === "pending") continue;
      if (result.status === "complete") {
        if (result.desktopSessionToken) await window.nexaDesktop?.saveSession?.(result.desktopSessionToken);
        state.account = result.user || null;
        state.accountNewSecret = "";
        setAccountStatus("Googleでログインしました。");
        await loadAccount();
        return;
      }
      throw new Error(result.error || "google_login_failed");
    }
    throw new Error("google_login_timeout");
  } catch (error) {
    setAccountStatus(error.message, true);
  } finally {
    if (el.googleLoginButton) el.googleLoginButton.disabled = false;
    renderAccountModal();
  }
}

function processEventIcon(type = "thinking") {
  return {
    thinking: "◇",
    edit: "✎",
    command: "⌘",
    done: "✓",
    error: "!"
  }[type] || "•";
}

function stableProcessEventIcon(type = "thinking") {
  return {
    thinking: "◇",
    edit: "✎",
    command: "⌘",
    done: "✓",
    error: "!"
  }[type] || "•";
}

function processEventCount(event = {}) {
  const statsCount = Number(event.data?.stats?.count || event.data?.count || 0);
  if (statsCount > 0) return statsCount;
  const detailLines = String(event.detail || "").split("\n").filter((line) => line.trim()).length;
  return Math.max(1, detailLines || 1);
}

function processEventLabel(event = {}) {
  const type = String(event.type || "thinking");
  if (event.title) return event.title;
  if (type === "command") return `${processEventCount(event)} 件の確認を実行`;
  if (type === "edit") return `${processEventCount(event)} 件のファイルを反映`;
  if (type === "done") return event.title || "完了しました";
  if (type === "error") return event.title || "確認が必要です";
  return event.title || "処理中";
}

function renderProcessFileChips(event = {}) {
  const files = Array.isArray(event.data?.files)
    ? event.data.files
    : event.data?.file
    ? [event.data.file]
    : [];
  if (!files.length) return "";
  return `
    <div class="process-files">
      ${files.slice(0, 8).map((file) => `
        <button class="process-file-chip" type="button" data-open-workspace-file="${escapeHtml(file.path || "")}">
          <span>${escapeHtml(file.path || "file")}</span>
          ${file.status ? `<small>${escapeHtml(file.status)}</small>` : ""}
        </button>
      `).join("")}
      ${files.length > 8 ? `<span class="process-file-more">+${escapeHtml(String(files.length - 8))}</span>` : ""}
    </div>
  `;
}

function renderProcessLogRow(event = {}) {
  const detail = String(event.detail || "").trim();
  return `
    <div class="process-row is-${escapeHtml(event.type || "thinking")}">
      <span class="process-icon" aria-hidden="true">${escapeHtml(stableProcessEventIcon(event.type))}</span>
      <div class="process-copy">
        <strong>${escapeHtml(processEventLabel(event))}</strong>
        ${detail ? `<small>${escapeHtml(clipPlain(detail, event.type === "command" ? 220 : 180))}</small>` : ""}
        ${renderProcessFileChips(event)}
      </div>
    </div>
  `;
}

function isBroadcastWorthyProcessEvent(event = {}) {
  const title = String(event.title || "").trim();
  const detail = String(event.detail || "").trim();
  if (event.type === "edit" || event.type === "command" || event.type === "error" || event.type === "done") return true;

  // Keep the feed about observable work. The hidden planning telemetry is
  // still persisted with the run, but it should not drown out the actions the
  // user can actually follow in real time.
  if (/^(?:依頼を受け取る|意図判断AIが処理方針を決定|作業を開始|作業フォルダー(?:を確認|を調査)?|既存ファイルを確認|実装ファイルを設計|保存前にファイル候補を確認|不足している実装を検出|失敗したファイルだけを修正|差分を確認|コマンド(?:を実行|が完了|で問題を検出)|最後の確認が完了|品質確認)$/.test(title)) return true;
  if (/\.[A-Za-z0-9_-]{1,12}\s*を(?:確認|新規作成|編集|削除)しました$/.test(title)) return true;
  return /(?:\.\w{1,8}\b|npm\s|pnpm\s|yarn\s|bytes|変更行|エラー|失敗|確認)/i.test(detail);
}

function renderProcessEvents(events = [], { live = false } = {}) {
  // Chat mode is a clean conversation surface. Development telemetry remains
  // available in code/both mode, but never competes with a normal reply.
  if (projectMode() === "chat") return "";
  const visibleEvents = events.filter(isBroadcastWorthyProcessEvent);
  if (!visibleEvents.length) return "";
  const current = visibleEvents[visibleEvents.length - 1];
  const latestEdit = [...visibleEvents].reverse().find((event) => event.type === "edit" && event.data?.stats);
  const stats = latestEdit?.data?.stats;
  return `
    <section class="process-broadcast ${live ? "is-live" : ""}" aria-label="Nexaの作業状況">
      <div class="process-now">
        <span class="process-live-dot" aria-hidden="true"></span>
        <div>
          <small>${live ? "Nexaが実行中" : "Nexaの作業記録"}</small>
          <strong>${escapeHtml(processEventLabel(current))}</strong>
          ${current.detail ? `<span>${escapeHtml(clipPlain(current.detail, 150))}</span>` : ""}
        </div>
      </div>
      <details class="process-card" ${live ? "open" : ""}>
        <summary>${live ? "いま行っている作業と履歴" : `作業履歴を表示 (${visibleEvents.length})`}</summary>
        <div class="process-feed">
          ${visibleEvents.map(renderProcessLogRow).join("")}
          ${stats ? `
            <div class="process-toast">
              <span>${escapeHtml(String(stats.count))}個のファイルが変更されました</span>
              <b>+${escapeHtml(String(stats.changedLines || 0))}</b>
            </div>
          ` : ""}
        </div>
      </details>
    </section>
  `;
}

function renderChoiceRequest(choiceRequest) {
  if (!choiceRequest?.options?.length) return "";
  return `
    <div class="choice-card" data-choice-request="${escapeHtml(choiceRequest.id || "")}">
      <div class="choice-card-head">
        <strong>${escapeHtml(choiceRequest.title || "選んでください")}</strong>
        ${choiceRequest.body ? `<span>${escapeHtml(choiceRequest.body)}</span>` : ""}
      </div>
      <div class="choice-options">
        ${choiceRequest.options.map((option) => `
          <button class="choice-option" type="button"
            data-choice-action="${escapeHtml(option.action || "send-prompt")}"
            data-choice-option="${escapeHtml(option.id || "")}"
            data-choice-prompt="${escapeHtml(option.prompt || "")}"
            data-choice-mode="${escapeHtml(option.mode || "")}">
            <strong>${escapeHtml(option.label || "選択")}</strong>
            ${option.description ? `<span>${escapeHtml(option.description)}</span>` : ""}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function changeFilesFromProcessEvents(events = []) {
  const summary = [...events].reverse().find((event) =>
    event?.type === "edit" && Array.isArray(event?.data?.files) && event.data.files.length
  );
  if (!summary) return [];
  const byPath = new Map();
  for (const file of summary.data.files) {
    if (!file?.path) continue;
    byPath.set(file.path, file);
  }
  return [...byPath.values()];
}

function renderInlineChangeCard(message = {}) {
  const changes = changeFilesFromProcessEvents(message.processEvents || []);
  if (!changes.length) return "";

  const cardId = `message-${message.id}`;
  state.changeCards.set(cardId, changes);
  const totals = changes.reduce((sum, file) => {
    const stats = lineStats(file);
    sum.additions += stats.additions;
    sum.deletions += stats.deletions;
    return sum;
  }, { additions: 0, deletions: 0 });
  const previewFile = changes[0];
  const previewStats = lineStats(previewFile);

  return `
    <section class="changes-card changes-card--inline" data-change-card="${escapeHtml(cardId)}" aria-label="変更内容">
      <div class="changes-card-head">
        <span class="changes-icon" aria-hidden="true"></span>
        <div>
          <strong>変更を適用しました</strong>
          <small>${changes.length} 件のファイルを変更 <b>+${totals.additions}</b>${totals.deletions ? ` <em>-${totals.deletions}</em>` : ""}</small>
        </div>
        <span class="changes-applied">適用済み</span>
      </div>
      <div class="changes-layout">
        <div class="changes-files">
          ${changes.slice(0, 8).map((file, index) => {
            const stats = lineStats(file);
            return `
              <button class="changes-row ${index === 0 ? "is-selected" : ""}" type="button"
                data-select-change-file="${escapeHtml(cardId)}" data-change-file-index="${index}">
                <span>${escapeHtml(file.path)}</span>
                <small>${file.status === "deleted" ? "削除" : `<b>+${escapeHtml(String(stats.additions))}</b>${stats.deletions ? ` <em>-${escapeHtml(String(stats.deletions))}</em>` : ""}`}</small>
              </button>
            `;
          }).join("")}
          ${changes.length > 8 ? `<span class="changes-file-overflow">+${changes.length - 8} 件</span>` : ""}
        </div>
        <div class="changes-preview">
          <div class="preview-title" data-change-preview-title>${escapeHtml(previewFile.path)} <span>+${escapeHtml(String(previewStats.additions))}</span></div>
          <pre class="diff-preview" data-change-preview><code>${renderDiffPreview(previewFile.diff)}</code></pre>
        </div>
      </div>
      <div class="changes-actions">
        <button type="button" data-review-changes data-change-card="${escapeHtml(cardId)}">すべての変更を確認</button>
        <button class="primary" type="button" data-open-workspace-file="${escapeHtml(previewFile.path)}" data-change-open-file ${previewFile.status === "deleted" ? "disabled" : ""}>レビューする</button>
        <span>選択フォルダーへ反映済み</span>
      </div>
    </section>
  `;
}

function selectChangeCardFile(cardId = "", index = 0) {
  const files = state.changeCards.get(cardId) || [];
  const file = files[Number(index)];
  const card = el.messageStream.querySelector(`[data-change-card="${CSS.escape(cardId)}"]`);
  if (!file || !card) return;
  const stats = lineStats(file);
  card.querySelectorAll("[data-select-change-file]").forEach((row) => {
    row.classList.toggle("is-selected", Number(row.dataset.changeFileIndex) === Number(index));
  });
  const title = card.querySelector("[data-change-preview-title]");
  if (title) title.innerHTML = `${escapeHtml(file.path)} <span>+${escapeHtml(String(stats.additions))}</span>`;
  const preview = card.querySelector("[data-change-preview]");
  if (preview) preview.innerHTML = `<code>${renderDiffPreview(file.diff)}</code>`;
  const review = card.querySelector("[data-change-open-file]");
  if (review) {
    review.dataset.openWorkspaceFile = file.path || "";
    review.disabled = file.status === "deleted";
  }
}

function resolvePendingChoiceRequest() {
  const messages = state.activeProject?.messages || [];
  const pending = [...messages].reverse().find((message) => message.role === "assistant" && message.choiceRequest);
  if (!pending) return;
  delete pending.choiceRequest;
  pending.choiceResolvedAt = new Date().toISOString();
  updateMessage(pending.id, pending.content, pending);
}

function renderMessageExtras(message = {}) {
  return [
    renderInlineChangeCard(message),
    message.artifacts?.length ? `<div class="message-artifacts">${renderArtifactCards(message.artifacts)}</div>` : "",
    message.choiceRequest ? renderChoiceRequest(message.choiceRequest) : "",
    message.attachments?.length ? `<div class="message-attachments">${attachmentChips(message.attachments, false)}</div>` : ""
  ].filter(Boolean).join("");
}

function renderReasoningSummary(message = {}) {
  if (message.role !== "assistant" || !message.reasoningSummary) return "";
  return `
    <details class="reasoning-summary">
      <summary>
        <span class="reasoning-summary-icon" aria-hidden="true">◇</span>
        <span>推論の要約</span>
        <small>クリックして展開</small>
        <span class="reasoning-summary-chevron" aria-hidden="true">›</span>
      </summary>
      <div class="reasoning-summary-body">${escapeHtml(message.reasoningSummary)}</div>
    </details>
  `;
}

function renderLiveIntro(message = {}) {
  if (message.role !== "assistant" || !message.streaming) return "";
  if (projectMode() === "chat") return "";
  return `
    <div class="message-live-intro">
      了解、依頼を受け取りました。必要な修正点を確認して、開発ログに進行を出します。
    </div>
  `;
}

function shouldHideStreamingBodyForProcessLog(message = {}) {
  if (message.role !== "assistant" || !message.streaming) return false;
  const mode = projectMode();
  if (mode === "chat") return false;
  const events = message.processEvents || [];
  return events.some((event) => {
    const text = `${event.type || ""} ${event.title || ""} ${event.detail || ""}`;
    return /edit|command|error|working|progress|ファイル|コード|フォルダー|保存|変更|実装|検証|コマンド|直接/.test(text);
  });
}

function processFinalSummary(message = {}, content = "") {
  const text = String(content || "").trim();
  const events = message.processEvents || [];
  if (!events.length || !/^作業過程\b/.test(text)) return text;
  const edit = [...events].reverse().find((event) => event.type === "edit");
  const error = [...events].reverse().find((event) => event.type === "error");
  if (error) {
    return `処理は完了しましたが、直接書き込みで確認が必要です。\n\n${error.detail || error.title || "保存できる形式が見つかりませんでした。"}`;
  }
  if (!edit) return text.replace(/^作業過程[\s\S]*?(?:\n\n結果|\n\n書き込み結果)/, "まとめ").trim();
  const files = edit.data?.files || [];
  const stats = edit.data?.stats || {};
  const fileLines = files.slice(0, 6).map((file) => `- ${file.status}: ${file.path}`).join("\n");
  const count = Number(stats.count || files.length || 0);
  const changed = Number(stats.changedLines || 0);
  return [
    `完了しました。${count || "指定"}件のファイルを選択フォルダー内へ直接反映しました。`,
    changed ? `変更行: ${changed}` : "",
    fileLines ? `\n変更ファイル:\n${fileLines}` : ""
  ].filter(Boolean).join("\n");
}

function renderMessageBodyContent(message = {}, content = message.content || "") {
  if (shouldHideStreamingBodyForProcessLog(message)) return "";
  return processFinalSummary(message, content);
}

function statusDot(status = "idle") {
  const clean = String(status || "idle").toLowerCase();
  if (clean.includes("error") || clean.includes("fail") || clean.includes("blocked")) return "danger";
  if (clean.includes("running") || clean.includes("返信")) return "live";
  if (clean.includes("complete") || clean.includes("ok") || clean.includes("ready") || clean.includes("loaded")) return "ok";
  return "idle";
}

function renderMiniItem(iconClass, title, meta = "", status = "") {
  return `
    <div class="workspace-item ${status ? `is-${escapeHtml(statusDot(status))}` : ""}">
      <span class="${escapeHtml(iconClass)}" aria-hidden="true"></span>
      <span title="${escapeHtml(title)}">${escapeHtml(clipPlain(title, 34))}</span>
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
    </div>
  `;
}

function renderIntelligenceItems(project, run) {
  const intelligence = run?.intelligence || project?.intelligence || state.system?.intelligence || {};
  const quality = run?.quality || {};
  const before = Number(intelligence.beforeLevel ?? 4.7);
  const after = Number(intelligence.afterLevel ?? 5.6);
  const delta = Number(intelligence.delta ?? (after - before));
  const qualityScore = Number(quality.score ?? intelligence.qualityScore ?? 0);
  const qualityMeta = qualityScore ? `${qualityScore}/100 ${quality.grade || intelligence.qualityGrade || ""}`.trim() : "next answer";
  const caps = Array.isArray(intelligence.capabilities) ? intelligence.capabilities : [];
  const readyCount = caps.filter((cap) => cap.ready).length;
  return [
    renderMiniItem("workspace-model-icon", `Lv${before.toFixed(1)} -> Lv${after.toFixed(1)}`, `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`, "ready"),
    renderMiniItem("workspace-shield-icon", "Nexa品質", qualityMeta, qualityScore >= 82 || !qualityScore ? "ready" : "running"),
    renderMiniItem("workspace-agent-icon", "Nexa深度", intelligence.deepReasoning || intelligence.opusStyleWorkflow ? "active" : "standard", "ready"),
    renderMiniItem("workspace-agent-icon", "Nexa自己評価", quality.revised ? "rewrote answer" : "score + revise", "ready"),
    renderMiniItem("workspace-task-icon", "Nexa機能", caps.length ? `${readyCount}/${caps.length}` : "team", "ready")
  ].join("");
}

function socialPlatformLabel(platform = "") {
  const labels = {
    x: "X",
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    threads: "Threads",
    facebook: "Facebook",
    linkedin: "LinkedIn"
  };
  return labels[String(platform || "").toLowerCase()] || platform || "SNS";
}

function socialStatusLabel(status = "") {
  return {
    queued: "承認待ち",
    approved: "承認済み",
    published: "公開済み",
    canceled: "停止"
  }[String(status || "").toLowerCase()] || "待機中";
}

function socialStatusTone(status = "") {
  return {
    queued: "running",
    approved: "ready",
    published: "ready",
    canceled: "danger"
  }[String(status || "").toLowerCase()] || "idle";
}

function renderSocialOpsItems() {
  if (!el.socialOpsList) return;
  const social = state.socialOps || {};
  const stats = social.stats || {};
  const posts = Array.isArray(social.posts) ? social.posts : [];
  const activePosts = posts.filter((post) => post.status !== "published" && post.status !== "canceled");
  const latest = (activePosts.length ? activePosts : posts).slice(0, 3);
  const summary = [
    renderMiniItem("workspace-social-icon", "キャンペーン", `${stats.campaigns || 0}件`, stats.campaigns ? "ready" : "idle"),
    renderMiniItem("workspace-social-icon", "承認待ち", `${stats.queued || 0}件`, stats.queued ? "running" : "ready"),
    renderMiniItem("workspace-social-icon", "公開済み", `${stats.published || 0}件`, stats.published ? "ready" : "idle")
  ];
  const latestRows = latest.map((post) => `
    <div class="workspace-item social-post-item is-${escapeHtml(statusDot(socialStatusTone(post.status)))}">
      <span class="workspace-social-icon" aria-hidden="true"></span>
      <span title="${escapeHtml(post.content || "")}">${escapeHtml(socialPlatformLabel(post.platform))}: ${escapeHtml(clipPlain(post.content || "", 28))}</span>
      <small>${escapeHtml(socialStatusLabel(post.status))} / ${escapeHtml(relativeLabel(post.scheduledAt || post.updatedAt || post.createdAt))}</small>
      <div class="social-post-actions">
        ${post.status === "queued" ? `<button type="button" data-social-approve="${escapeHtml(post.id)}">承認</button>` : ""}
        ${post.status === "approved" ? `<button type="button" data-social-publish="${escapeHtml(post.id)}">手動公開済み</button>` : ""}
      </div>
    </div>
  `);
  el.socialOpsList.innerHTML = [
    ...summary,
    ...latestRows,
    `<button class="panel-action social-action" type="button" data-social-create>今の入力から運用案を作成</button>`
  ].join("");
}

function renderWorkspacePanel() {
  if (!el.outputList || !el.sourceList) return;
  const project = state.activeProject;
  const mode = projectMode(project);
  const changeRun = latestChangeRun(project);
  const changes = changeRun?.changes || [];
  const artifacts = generatedArtifacts(project);
  const uploads = project?.files || [];
  const run = latestRun(project);
  const runAgents = state.liveAgents.length ? state.liveAgents : (run?.agents || []);
  const memory = project?.memory || {};
  const tasks = memory.tasks || [];
  const plan = state.system?.plan || {};
  const specs = state.system?.specs || {};
  const qualityEngine = state.system?.media?.qualityEngine || {};
  const plugins = state.plugins || [];
  const mcpServers = state.mcp?.servers || [];
  const codex = state.codex?.codex || project?.codex || {};
  const workspaceRoot = workspaceReady(project) ? workspaceLabel(project.workspaceRoot || "", true) : "未選択";
  const outputTitle = document.querySelector(".output-card h2");
  if (outputTitle) outputTitle.textContent = mode === "chat" ? "生成結果" : mode === "both" ? "コード変更 / 生成結果" : "出力";
  renderTopBar();
  renderSidebarVitals();
  renderTaskTimeline();
  renderFinalObjective(project);

  if (el.modelPerfList) {
    el.modelPerfList.innerHTML = [
      renderMiniItem("workspace-model-icon", modelScoreLabel("conversation", plan.conversation || plan.fast || "未接続"), shortModel(plan.conversation || plan.fast || "未接続"), state.system?.ollama?.online ? "ready" : "idle"),
      renderMiniItem("workspace-model-icon", modelScoreLabel("code", plan.code || plan.conversation || "未接続"), shortModel(plan.code || plan.conversation || "未接続"), state.system?.ollama?.online ? "ready" : "idle"),
      renderMiniItem("workspace-chip-icon", `${specs.memoryGb || "?"}GB RAM`, `${specs.cores || specs.cpuCores || "?"} cores`, "ready")
    ].join("");
  }

  if (el.intelligenceList) {
    el.intelligenceList.innerHTML = renderIntelligenceItems(project, run);
  }

  renderSocialOpsItems();

  el.outputList.innerHTML = changes.length
    ? changes.slice(0, 8).map((file) => {
        const { additions, deletions } = lineStats(file);
        return `
        <button class="workspace-item output-item" type="button" data-open-workspace-file="${escapeHtml(file.path)}" ${file.status === "deleted" ? "disabled" : ""}>
          <span class="workspace-file-icon" aria-hidden="true"></span>
          <span title="${escapeHtml(file.path)}">${escapeHtml(clipPlain(file.path, 34))}</span>
          <small>${file.status === "deleted" ? "削除" : `<b>+${escapeHtml(String(additions))}</b>${deletions ? ` <em>-${escapeHtml(String(deletions))}</em>` : ""}`}</small>
        </button>
      `;
      }).join("")
    : artifacts.length
    ? artifacts.slice(0, 8).map(renderArtifactOutputItem).join("")
    : `<div class="workspace-empty">${mode === "chat" ? "まだ生成結果はありません" : "まだ出力はありません"}</div>`;

  el.sourceList.innerHTML = mode === "chat" ? `
    ${renderMiniItem("workspace-image-icon", "画像生成", "プロンプト入力で開始", "ready")}
    ${renderMiniItem("workspace-file-icon", "添付ファイル", String(uploads.length), uploads.length ? "ready" : "idle")}
    ${renderMiniItem("workspace-memory-icon", "会話メモ", String(memoryItemCount(memory)), memoryItemCount(memory) ? "ready" : "idle")}
    ${(uploads.slice(-4).reverse()).map((file) => `
      <div class="workspace-item">
        <span class="workspace-file-icon" aria-hidden="true"></span>
        <span title="${escapeHtml(file.name)}">${escapeHtml(clipPlain(file.name, 30))}</span>
        <small>${escapeHtml(formatBytes(file.size))}</small>
      </div>
    `).join("")}
  ` : `
    ${renderMiniItem(workspaceReady(project) ? "workspace-lock-icon" : "workspace-globe-icon", workspaceRoot, workspaceReady(project) ? "既存コード" : "フォルダー", workspaceReady(project) ? "ready" : "idle")}
    ${renderMiniItem("workspace-file-icon", "ドキュメント", String((project?.memory?.facts || []).length + (project?.memory?.decisions || []).length), "ready")}
    ${renderMiniItem("workspace-globe-icon", "ウェブ検索", state.system?.tools?.web ? "有効" : "待機", state.system?.tools?.web ? "ready" : "idle")}
    ${(uploads.slice(-4).reverse()).map((file) => `
      <div class="workspace-item">
        <span class="workspace-file-icon" aria-hidden="true"></span>
        <span title="${escapeHtml(file.name)}">${escapeHtml(clipPlain(file.name, 30))}</span>
        <small>${escapeHtml(formatBytes(file.size))}</small>
      </div>
    `).join("")}
  `;

  if (el.agentList) {
    const fallbackAgentIds = [
      "orchestrator",
      "planner",
      "memory",
      "toolrouter",
      "reasoner",
      "coder",
      "verifier",
      "security",
      "responsegenerator"
    ];
    const fallbackAgents = fallbackAgentIds.map((id) => ({
      id,
      name: AGENT_DISPLAY_NAMES[id] || "AI",
      status: state.busy ? "running" : "ready",
      model: id === "coder"
        ? shortModel(plan.code || plan.conversation || "")
        : shortModel(plan.fast || plan.conversation || plan.code || "")
    }));
    const agents = runAgents.length ? runAgents : fallbackAgents;
    el.agentList.innerHTML = agents.slice(0, 10).map((agent, index) => {
      const label = agentLabel(agent);
      const status = agentStatusText(agent);
      const elapsed = state.busy ? `${(1.2 + index * 1.35).toFixed(1)}s` : (agent.status || "ready");
      return `
        <div class="agent-row is-${escapeHtml(agentTone(label))} ${agent.error ? "is-danger" : state.busy ? "is-live" : "is-ok"}">
          <span class="agent-avatar" aria-hidden="true">${escapeHtml(label.slice(0, 1))}</span>
          <span class="agent-copy">
            <strong>${escapeHtml(label)}</strong>
            <small><i></i>${escapeHtml(status)}</small>
          </span>
          <time>${escapeHtml(elapsed)}</time>
        </div>
      `;
    }).join("");
  }

  if (el.memoryList) {
    const memoryItems = [
      ...(memory.facts || []).slice(0, 2).map((text) => ({ text, meta: "fact" })),
      ...(memory.decisions || []).slice(0, 2).map((text) => ({ text, meta: "decision" }))
    ];
    el.memoryList.innerHTML = memoryItems.length
      ? memoryItems.map((item) => renderMiniItem("workspace-memory-icon", item.text, item.meta, "ready")).join("")
      : `<div class="workspace-empty">まだ長期記憶はありません</div>`;
  }

  if (el.taskList) {
    el.taskList.innerHTML = tasks.length
      ? tasks.slice(0, 5).map((task) => renderMiniItem("workspace-task-icon", task.text, task.status === "done" ? "done" : "next", task.status === "done" ? "ready" : "running")).join("")
      : `<div class="workspace-empty">次の作業は未登録です</div>`;
  }

  if (el.toolStatusList) {
    const enabledMcp = mcpServers.filter((server) => server.enabled);
    el.toolStatusList.innerHTML = [
      renderMiniItem("workspace-plugin-icon", `${plugins.length} plugins`, plugins.length ? "loaded" : "none", plugins.length ? "ready" : "idle"),
      renderMiniItem("workspace-mcp-icon", `${enabledMcp.length}/${mcpServers.length || 0} MCP`, mcpServers.length ? "registry" : "none", enabledMcp.length ? "ready" : "idle"),
      renderMiniItem("workspace-image-icon", "画像生成", "tool chip", "ready")
    ].join("");
  }

  if (el.safetyList) {
    const permissions = codex.permissions || "workspace-write";
    const approvalCount = (codex.approvals || []).filter((approval) => approval.status === "pending").length;
    el.safetyList.innerHTML = [
      renderMiniItem("workspace-lock-icon", permissions, "permission", permissions === "read-only" ? "idle" : "ready"),
      renderMiniItem("workspace-shield-icon", approvalCount ? `${approvalCount} 件の承認待ち` : "承認待ちなし", "approval gate", approvalCount ? "running" : "ready"),
      renderMiniItem("workspace-shield-icon", workspaceReady(project) ? "作業範囲ロック中" : "フォルダー未選択", "workspace scope", workspaceReady(project) ? "ready" : "idle")
    ].join("");
  }
}

function projectFinalObjective(project = state.activeProject) {
  return String(project?.codex?.goal?.text || "").trim();
}

function renderFinalObjective(project = state.activeProject) {
  if (!el.finalObjectiveSummary || !el.finalObjectiveInput) return;
  const objective = projectFinalObjective(project);
  const editing = !el.finalObjectiveInput.hidden;
  el.finalObjectiveSummary.textContent = objective || "まだ設定されていません。最初の開発依頼から自動設定するか、ここで入力できます。";
  el.finalObjectiveSummary.classList.toggle("is-empty", !objective);
  if (!editing) el.finalObjectiveInput.value = objective;
  const updatedAt = project?.codex?.goal?.updatedAt;
  el.finalObjectiveMeta.textContent = objective
    ? `AIが最初に参照${updatedAt ? ` / ${relativeLabel(updatedAt)}に更新` : ""}`
    : "AIは作業前にここを最初に確認します";
}

function setFinalObjectiveEditing(editing) {
  if (!el.finalObjectiveInput) return;
  el.finalObjectiveInput.hidden = !editing;
  el.finalObjectiveSummary.hidden = editing;
  el.finalObjectiveEdit.hidden = editing;
  el.finalObjectiveSave.hidden = !editing;
  el.finalObjectiveCancel.hidden = !editing;
  if (editing) {
    el.finalObjectiveInput.value = projectFinalObjective();
    el.finalObjectiveInput.focus();
    el.finalObjectiveInput.setSelectionRange(el.finalObjectiveInput.value.length, el.finalObjectiveInput.value.length);
  }
}

async function saveFinalObjective() {
  if (!state.activeProject) return;
  const objective = el.finalObjectiveInput.value.trim();
  el.finalObjectiveSave.disabled = true;
  try {
    await patchActiveProject({ finalObjective: objective }, objective ? "最終目的を保存しました" : "最終目的を解除しました");
    setFinalObjectiveEditing(false);
  } finally {
    el.finalObjectiveSave.disabled = false;
  }
}

function setFolderPanelOpen(open) {
  state.folderPanelOpen = open;
  el.folderPanel.hidden = !open;
  el.folderButton?.classList.toggle("is-open", open);
  el.folderButton?.setAttribute("aria-expanded", String(open));
}

async function renderFolderPanel() {
  el.folderPanel.innerHTML = `<div class="folder-panel-state">読み込み中</div>`;
  setFolderPanelOpen(true);
  const current = state.activeProject?.workspaceRoot || "";
  const ready = workspaceReady();
  el.folderPanel.innerHTML = `
    <div class="folder-panel-header">
      <strong>PCの作業フォルダー</strong>
      <small>Windowsのフォルダー選択で、自分のPC上のプロジェクトを選びます</small>
    </div>
    <button class="folder-option folder-option-primary" type="button" data-pick-local-folder>
      <span class="folder-glyph" aria-hidden="true">□</span>
      <span>自分のPCからフォルダーを選択</span>
      <small>${ready ? escapeHtml(current) : "クリックするとフォルダー選択ダイアログが開きます"}</small>
    </button>
    ${ready ? `
      <div class="folder-panel-current">
        <span>現在の作業フォルダー</span>
        <strong>${escapeHtml(selectedFolderName())}</strong>
        <small>${escapeHtml(current)}</small>
      </div>
    ` : ""}
  `;
}

async function selectWorkspaceFolder(path) {
  if (!state.activeProject) return;
  const folderName = workspaceLabel(path, true);
  const shouldRename =
    isNewEmptyProject() &&
    (projectMode() === "code" || projectMode() === "both") &&
    (!state.activeProject.name || state.activeProject.name === "新しいチャット");
  const data = await api(`/api/projects/${state.activeProject.id}`, {
    method: "PATCH",
    body: {
      workspaceRoot: path,
      selectedFolderPath: path,
      projectType: path ? "folder" : "general",
      ...(shouldRename && folderName ? { name: folderName } : {})
    }
  });
  state.activeProject = data.project;
  const index = state.projects.findIndex((project) => project.id === state.activeProject.id);
  if (index >= 0) state.projects[index] = data.summary || { ...state.projects[index], workspaceRoot: path, workspaceReady: true };
  renderWorkspaceFolder();
  renderWorkspacePanel();
  renderProjectList();
  renderMessages();
  setFolderPanelOpen(false);
  setStatus(`${workspaceLabel(path, true)} を作業フォルダーにしました`);
  el.promptInput.focus();
}

async function pickLocalWorkspaceFolder() {
  if (!state.activeProject) return;
  setFolderPanelOpen(true);
  el.folderPanel.innerHTML = `<div class="folder-panel-state">PCのフォルダー選択を開いています...</div>`;
  setStatus("PCのフォルダーを選択してください");
  try {
    const picked = await api("/api/system/folder-picker", { method: "POST", body: {} });
    if (picked.canceled || !picked.path) {
      setStatus("フォルダー選択をキャンセルしました");
      await renderFolderPanel();
      return;
    }
    await selectWorkspaceFolder(picked.path);
  } catch (error) {
    el.folderPanel.innerHTML = `<div class="folder-panel-state">Folder error: ${escapeHtml(error.message)}</div>`;
    setStatus(`フォルダー選択エラー: ${error.message}`);
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function looksText(file) {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    /\.(csv|css|html|js|json|jsx|md|mjs|py|ts|tsx|txt|xml|yaml|yml)$/i.test(name)
  );
}

async function fileToAttachment(file) {
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`${file.name} is larger than 5 MB`);
  }
  const buffer = await file.arrayBuffer();
  let text = "";
  if (looksText(file)) {
    text = new TextDecoder("utf-8").decode(buffer).slice(0, 9000);
  }
  return {
    id: `local-${globalThis.crypto?.randomUUID?.() || Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    text,
    content: arrayBufferToBase64(buffer)
  };
}

function attachmentChips(attachments = [], removable = false) {
  return attachments
    .map((file, index) => `
      <span class="attachment-chip" title="${escapeHtml(file.name)}">
        <span class="attachment-dot" aria-hidden="true"></span>
        <span>${escapeHtml(clipPlain(file.name, 30))}</span>
        <small>${escapeHtml(formatBytes(file.size))}</small>
        ${removable ? `<button type="button" data-remove-attachment="${index}" aria-label="Remove attachment">×</button>` : ""}
      </span>
    `)
    .join("");
}

function renderAttachments() {
  el.attachmentTray.innerHTML = attachmentChips(state.attachments, true);
}

function setStatus(text) {
  if (!el.statusLabel) return;
  el.statusLabel.textContent = text;
  renderSidebarVitals(text);
}

function autoresize() {
  el.promptInput.style.height = "auto";
  el.promptInput.style.height = `${Math.min(180, el.promptInput.scrollHeight)}px`;
}

function setBusy(isBusy) {
  state.busy = isBusy;
  document.body.classList.toggle("is-busy", isBusy);
  el.promptInput.disabled = isBusy;
  el.featureButton.disabled = false;
  if (el.modelMenuButton) el.modelMenuButton.disabled = false;
  if (el.folderButton) el.folderButton.disabled = isBusy;
  el.fileInput.disabled = isBusy;
  el.composerProgress.hidden = !isBusy;
  el.sendButton.disabled = false;
  el.sendButton.classList.toggle("is-stop", isBusy);
  el.sendButton.setAttribute("aria-label", isBusy ? "停止" : "送信");
  el.sendButton.innerHTML = isBusy ? `<span class="stop-square" aria-hidden="true"></span>` : `<span>送信</span>`;
  setStatus(isBusy ? "返信中" : "待機中");
  renderWorkspacePanel();
  renderFeaturePanel();
  renderModelMenu();
}

function updateGenerationModeUi() {
  if (IMAGE_GENERATION_ONLY && state.generationMode === "video") state.generationMode = "";
  updateComposerModeButton();
  el.imageToolButton?.classList.toggle("is-active", state.generationMode === "image");
  if (!el.promptInput) return;
  if (state.generationMode === "image") {
    el.promptInput.placeholder = "生成したい画像を入力してください...";
  } else {
    el.promptInput.placeholder = "AIに指示を入力してください...";
  }
  renderFeaturePanel();
}

function setGenerationMode(kind) {
  if (IMAGE_GENERATION_ONLY && kind === "video") {
    state.generationMode = "";
    updateGenerationModeUi();
    setStatus("動画生成は外しました。画像生成だけ使えます。");
    el.promptInput.focus();
    return;
  }
  state.generationMode = state.generationMode === kind ? "" : kind;
  updateGenerationModeUi();
  if (state.generationMode === "image") setStatus("画像生成モード: プロンプトを入力して送信してください");
  else setStatus("通常チャットに戻しました");
  el.promptInput.focus();
}

function generationRequestFromMessage(message) {
  const text = String(message || "").trim();
  if (state.generationMode === "image") {
    return { kind: state.generationMode, prompt: text };
  }
  const imageMatch = text.match(/^(画像生成|image generation)\s*[:：]\s*([\s\S]+)$/i);
  if (imageMatch) return { kind: "image", prompt: imageMatch[2].trim() };
  return null;
}

async function runDirectGeneration(kind, prompt, attachments) {
  const cleanKind = "image";
  const label = cleanKind === "video" ? "動画" : "画像";
  setStatus(`${label}生成中`);
  setStatus(`${cleanKind === "video" ? "動画" : "画像"}生成中`);
  const generationStatusLabel = cleanKind === "video" ? "\u52d5\u753b" : "\u753b\u50cf";
  setStatus(`${generationStatusLabel}\u751f\u6210\u4e2d`);
  state.liveAgents = [
    { id: "orchestrator", name: "Nexa", status: "running", model: "local" },
    {
      id: "generator",
      name: "Nexa",
      status: "running",
      model: "local-cinematic-image"
    },
    { id: "verifier", name: "Nexa", status: "running", model: "local" }
  ];
  renderWorkspacePanel();

  const data = await api(`/api/generate/${cleanKind}`, {
    method: "POST",
    body: {
      projectId: state.activeProject.id,
      prompt,
      attachments,
      mode: projectMode(),
      accessLevel: accessLevel(),
      durationSec: undefined
    }
  });

  state.activeProject = data.project;
  if (data.credits) {
    state.accountBilling ||= {};
    state.accountBilling.credits = data.credits;
    if (state.account) state.account.credits = data.credits;
    renderAccountModal();
  }
  const summary = data.summary || data.project;
  const projectIndex = state.projects.findIndex((project) => project.id === summary.id);
  if (projectIndex >= 0) state.projects[projectIndex] = summary;
  else state.projects.unshift(summary);
  state.generationMode = "";
  state.liveAgents = data.assistantMessage?.agents || [];
  updateGenerationModeUi();
  renderProjectHeader();
  renderProjectList();
  renderMessages();
  renderWorkspacePanel();
  setStatus(`${label}を生成しました`);
}

function stopGeneration() {
  if (!state.abortController) return;
  state.abortController.abort();
  setStatus("停止中");
}

function renderFeaturePanel() {
  if (!el.featurePanel) return;
  const mode = projectMode();
  const access = accessLevel();
  const workspace = workspaceReady() ? workspaceLabel(state.activeProject?.workspaceRoot || "", true) : "未選択";
  const generation = state.generationMode || "none";
  const modes = Object.entries(MODE_DETAILS).map(([key, detail]) => `
    <button class="feature-pill ${mode === key ? "is-selected" : ""}" type="button" data-mode-choice="${escapeHtml(key)}">
      <strong>${escapeHtml(detail.label)}</strong>
      <span>${escapeHtml(detail.shortLabel)}</span>
    </button>
  `).join("");
  const accessButtons = Object.entries(ACCESS_DETAILS).map(([key, detail]) => `
    <button class="feature-pill ${access === key ? "is-selected" : ""}" type="button" data-access-choice="${escapeHtml(key)}">
      <strong>${escapeHtml(detail.label)}</strong>
      <span>${key === "full" ? "全ファイル・ネット・Windows" : key === "safety" ? "危険操作だけ確認" : "外部操作は毎回確認"}</span>
    </button>
  `).join("");
  el.featurePanel.innerHTML = `
    <section class="feature-section">
      <span class="feature-section-title">ファイル</span>
      <button class="feature-option" type="button" data-feature="attach">
        <span>+</span>
        <strong>添付</strong>
        <small>画像・PDF・テキストを選択</small>
      </button>
      <button class="feature-option" type="button" data-feature="folder">
        <span>□</span>
        <strong>フォルダーを選択</strong>
        <small>${escapeHtml(workspace)}</small>
      </button>
    </section>
    <section class="feature-section">
      <span class="feature-section-title">モード</span>
      <div class="feature-pill-grid">${modes}</div>
      <button class="feature-option ${state.planMode ? "is-active" : ""}" type="button" data-feature="plan">
        <span>☷</span>
        <strong>プランモード</strong>
        <small>${state.planMode ? "先に方針を整理します" : "必要なら計画から開始"}</small>
      </button>
    </section>
    <section class="feature-section">
      <span class="feature-section-title">生成</span>
      <button class="feature-option ${generation === "image" ? "is-active" : ""}" type="button" data-feature="image">
        <span>◇</span>
        <strong>画像生成</strong>
        <small>Web内でプレビュー</small>
      </button>
    </section>
    <section class="feature-section">
        <span class="feature-section-title">SNS</span>
        <button class="feature-option" type="button" data-feature="social">
          <span>#</span>
          <strong>SNS自動運用</strong>
          <small>X / Instagram / TikTok / YouTube向けに投稿案を作成</small>
        </button>
    </section>
    <section class="feature-section">
      <span class="feature-section-title">アクセス権限</span>
      <div class="feature-pill-grid access-grid">${accessButtons}</div>
    </section>
  `;
}

function renderModelMenu() {
  if (!el.modelMenu) return;
  const reasoning = Object.entries(REASONING_DETAILS).map(([key, detail]) => `
    <button class="model-menu-row ${state.reasoningLevel === key ? "is-selected" : ""}" type="button" data-reasoning-choice="${escapeHtml(key)}">
      <span>${escapeHtml(detail.label)}</span>
    </button>
  `).join("");
  const models = availableModelChoices().map((item) => `
    <button class="model-menu-row compact ${state.modelChoice === item.value ? "is-selected" : ""}" type="button" data-model-choice="${escapeHtml(item.value)}">
      <span>${escapeHtml(item.label)}</span>
    </button>
  `).join("");
  const speeds = PERFORMANCE_CHOICES.map((choice) => `
    <button class="model-menu-row compact ${state.performanceChoice === choice ? "is-selected" : ""}" type="button" data-performance-choice="${escapeHtml(choice)}">
      <span>${escapeHtml(choice)}</span>
    </button>
  `).join("");
  const selectedModel = modelValueLabel(state.modelChoice);
  const submenu = state.modelSubmenu === "models" ? `
    <section class="model-menu-submenu">
      <h3>モデル</h3>
      ${models}
    </section>
  ` : state.modelSubmenu === "speed" ? `
    <section class="model-menu-submenu speed-submenu">
      <h3>速度</h3>
      ${speeds}
    </section>
  ` : "";
  el.modelMenu.innerHTML = `
    <div class="model-menu-main">
      <section>
        <h3>推論</h3>
        ${reasoning}
      </section>
      <section class="model-menu-divider">
        <button class="model-menu-row has-chevron ${state.modelSubmenu === "models" ? "is-open" : ""}" type="button" data-model-panel="models">
          <span>${escapeHtml(selectedModel)}</span>
          <small>›</small>
        </button>
        <button class="model-menu-row has-chevron ${state.modelSubmenu === "speed" ? "is-open" : ""}" type="button" data-model-panel="speed">
          <span>速度</span>
          <small>${escapeHtml(state.performanceChoice)} ›</small>
        </button>
      </section>
    </div>
    ${submenu}
  `;
}

function setFeaturePanelOpen(open) {
  state.featurePanelOpen = open;
  el.featurePanel.hidden = !open;
  el.featureButton.classList.toggle("is-open", open);
  el.featureButton.setAttribute("aria-expanded", String(open));
  updateComposerModeButton();
  if (open) {
    setModelMenuOpen(false);
    renderFeaturePanel();
  }
}

function setModelMenuOpen(open) {
  state.modelMenuOpen = open;
  if (!open) state.modelSubmenu = "";
  if (!el.modelMenu || !el.modelMenuButton) return;
  el.modelMenu.hidden = !open;
  el.modelMenuButton.classList.toggle("is-open", open);
  el.modelMenuButton.setAttribute("aria-expanded", String(open));
  if (open) {
    setFeaturePanelOpen(false);
    state.modelSubmenu = "";
    renderModelMenu();
  }
}

function setPlanMode(enabled) {
  state.planMode = Boolean(enabled);
  localStorage.setItem("agent-company-plan-mode", String(state.planMode));
  renderTopBar();
  setStatus(state.planMode ? "プランモードを有効にしました" : "プランモードを解除しました");
}

function applyLayoutState() {
  document.body.classList.toggle("sidebar-left-collapsed", state.leftCollapsed);
  document.body.classList.toggle("sidebar-right-collapsed", state.rightCollapsed);
  el.leftSidebarToggle?.classList.toggle("is-collapsed", state.leftCollapsed);
  el.rightSidebarToggle?.classList.toggle("is-collapsed", state.rightCollapsed);
  if (el.leftSidebarToggle) {
    el.leftSidebarToggle.setAttribute("aria-label", state.leftCollapsed ? "チャット履歴バーを開く" : "チャット履歴バーを折りたたむ");
    el.leftSidebarToggle.querySelector("span").textContent = state.leftCollapsed ? "›" : "‹";
  }
  if (el.rightSidebarToggle) {
    el.rightSidebarToggle.setAttribute("aria-label", state.rightCollapsed ? "エージェント状況バーを開く" : "エージェント状況バーを折りたたむ");
    el.rightSidebarToggle.querySelector("span").textContent = state.rightCollapsed ? "‹" : "›";
  }
}

function renderProjectHeader() {
  const project = state.activeProject;
  el.projectName.textContent = project?.name || "Chat";
  el.projectGoal.textContent = CHAT_GOAL;
  el.projectStats.textContent = project ? `${project.messages?.length || 0} messages` : "";
  renderTopBar();
  renderSidebarVitals();
  renderTaskTimeline();
}

function projectSubtitle(project) {
  return clipPlain(project.summary || project.next?.[0] || project.goal || "新しい会話", 32);
}

function renderProjectList() {
  const query = state.query.trim().toLowerCase();
  const projects = state.projects.filter((project) => {
    const haystack = `${project.name} ${project.goal} ${project.summary} ${project.workspaceRoot || ""} ${project.mode || ""} ${(project.next || []).join(" ")}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  if (!projects.length) {
    el.projectList.innerHTML = `<div class="sidebar-empty">見つかりません</div>`;
    return;
  }

  const groups = new Map();
  projects.forEach((project) => {
    const isFolderProject = Boolean(project.workspaceReady);
    const groupName = isFolderProject
      ? (project.selectedFolderName || workspaceLabel(project.workspaceRoot, true))
      : "通常チャット";
    const groupKind = isFolderProject ? "folder" : "general";
    const groupKey = `${groupKind}:${groupName}`;
    const updatedAt = new Date(project.updatedAt || 0).getTime() || 0;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        name: groupName,
        kind: groupKind,
        updatedAt,
        projects: []
      });
    }
    const group = groups.get(groupKey);
    group.updatedAt = Math.max(group.updatedAt, updatedAt);
    group.projects.push(project);
  });

  const renderProjectItem = (project) => {
    const isRenaming = state.renamingProjectId === project.id;
    const menuOpen = state.projectMenuId === project.id;
    const projectName = project.name || "New chat";
    const mode = projectMode(project);
    return `
      <div class="project-item ${state.activeProject?.id === project.id ? "is-active" : ""} ${isRenaming ? "is-renaming" : ""} ${menuOpen ? "has-open-menu" : ""}" role="button" tabindex="0" data-project-id="${escapeHtml(project.id)}">
        <span class="project-icon is-${escapeHtml(mode || "unset")}" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M8 4h7l3 3v13H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="M14 4v4h4" /><path d="M9 11h6M9 15h6" /></svg>
        </span>
        <span class="project-copy">
          ${isRenaming
            ? `<input class="rename-input" data-rename-input data-project-id="${escapeHtml(project.id)}" value="${escapeHtml(projectName)}" maxlength="80" aria-label="チャット名" />`
            : `<strong>${escapeHtml(clipPlain(projectName, 26))}</strong>`}
          <small><b>${escapeHtml(MODE_DETAILS[mode]?.shortLabel || "Start")}</b><span>${escapeHtml(projectSubtitle(project))}</span></small>
        </span>
        <span class="project-time">${escapeHtml(relativeLabel(project.updatedAt))}</span>
        <button class="project-menu-button ${menuOpen ? "is-open" : ""}" type="button" data-menu-project-id="${escapeHtml(project.id)}" aria-haspopup="menu" aria-expanded="${menuOpen}" aria-label="&#12513;&#12491;&#12517;&#12540;">
          <span aria-hidden="true">...</span>
        </button>
        ${menuOpen ? `
          <div class="project-action-menu" role="menu">
            <button class="project-menu-item" type="button" role="menuitem" data-menu-action="rename" data-menu-action-project-id="${escapeHtml(project.id)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
              <span>&#12503;&#12525;&#12472;&#12455;&#12463;&#12488;&#21517;&#12434;&#22793;&#26356;</span>
            </button>
            <button class="project-menu-item danger" type="button" role="menuitem" data-menu-action="delete" data-menu-action-project-id="${escapeHtml(project.id)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></svg>
              <span>&#21066;&#38500;&#12377;&#12427;</span>
            </button>
          </div>
        ` : ""}
      </div>
    `;
  };

  el.projectList.innerHTML = [...groups.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((group) => {
      const sortedProjects = group.projects
        .sort((a, b) => (new Date(b.updatedAt || 0).getTime() || 0) - (new Date(a.updatedAt || 0).getTime() || 0));
      return `
        <div class="project-group-title"><span>${escapeHtml(group.name)}</span><small>${escapeHtml(group.kind)}</small></div>
        ${sortedProjects.map(renderProjectItem).join("")}
      `;
    }).join("");
}

function closeProjectMenu() {
  if (!state.projectMenuId) return;
  state.projectMenuId = "";
  renderProjectList();
}

function renderModeCards(project = state.activeProject) {
  const current = projectMode(project);
  return Object.entries(MODE_DETAILS).map(([mode, detail]) => `
    <button class="mode-card ${current === mode ? "is-selected" : ""}" type="button" data-mode-choice="${escapeHtml(mode)}">
      <strong>${escapeHtml(detail.label)}</strong>
      <span>${escapeHtml(detail.description)}</span>
    </button>
  `).join("");
}

function renderAccessCards(project = state.activeProject) {
  const current = accessLevel(project);
  return Object.entries(ACCESS_DETAILS).map(([level, detail]) => `
    <button class="access-card ${current === level ? "is-selected" : ""}" type="button" data-access-choice="${escapeHtml(level)}">
      <strong>${escapeHtml(detail.label)}</strong>
      <span>${escapeHtml(detail.description)}</span>
    </button>
  `).join("");
}

function startModeDescription(project = state.activeProject) {
  const mode = projectMode(project);
  if (!mode) return "最初に作業モードを選んでください。コード作業ならフォルダー、会話ならそのまま開始できます。";
  return MODE_DETAILS[mode]?.description || "";
}

function renderStartScreen() {
  const project = state.activeProject;
  const mode = projectMode(project);
  const needsFolder = mode === "code";
  const canStart = mode && (!needsFolder || workspaceReady(project));
  const requirementText = canStart
    ? "開始できます"
    : mode
      ? "フォルダーを選択してください"
      : "モードを選択してください";
  const folderText = workspaceReady(project)
    ? `${selectedFolderName(project)} を選択中`
    : (needsFolder ? "コードモードではフォルダー選択が必須です" : "フォルダー未選択でも開始できます");
  const empty = document.createElement("div");
  empty.className = "start-screen";
  empty.innerHTML = `
    <div class="start-copy">
      <span>Nexa Workspace</span>
      <strong>今日は何をしますか？</strong>
      <p>${escapeHtml(startModeDescription(project))}</p>
    </div>
    <div class="mode-grid" aria-label="モード選択">
      ${renderModeCards(project)}
    </div>
    <div class="start-control-row">
      <button class="start-folder-button ${workspaceReady(project) ? "has-folder" : ""}" type="button" data-start-folder>
        <span aria-hidden="true">□</span>
        <strong>${escapeHtml(folderText)}</strong>
      </button>
      <span class="start-requirement ${canStart ? "is-ready" : ""}">
        ${escapeHtml(requirementText)}
      </span>
    </div>
    <div class="access-grid" aria-label="アクセス権選択">
      ${renderAccessCards(project)}
    </div>
  `;
  return empty;
}

function renderMessages() {
  el.messageStream.innerHTML = "";
  const messages = state.activeProject?.messages || [];
  state.changeCards.clear();
  document.body.classList.toggle("has-empty-chat", messages.length === 0);
  document.body.classList.toggle("has-active-chat", messages.length > 0);
  if (!messages.length) {
    el.messageStream.append(renderStartScreen());
    return;
  }
  for (const message of messages) appendMessage(message, false);
  if (!messages.some((message) => changeFilesFromProcessEvents(message.processEvents || []).length)) appendChangeCard();
  scrollMessages(true);
}

function appendChangeCard() {
  const run = latestChangeRun();
  const changes = run?.changes || [];
  if (!changes.length) return;
  const totals = changes.reduce((sum, file) => {
    const stats = lineStats(file);
    sum.additions += stats.additions;
    sum.deletions += stats.deletions;
    return sum;
  }, { additions: 0, deletions: 0 });
  const previewFile = changes[0];
  const previewStats = lineStats(previewFile);
  const card = document.createElement("section");
  card.className = "changes-card";
  card.innerHTML = `
    <div class="changes-card-head">
      <span class="changes-icon" aria-hidden="true"></span>
      <div>
        <strong>作業フォルダーを更新しました</strong>
        <small>${changes.length} 個のファイルを直接変更 · +${totals.additions}${totals.deletions ? ` -${totals.deletions}` : ""}</small>
      </div>
      <button type="button" data-review-changes>レビューする</button>
    </div>
    <div class="changes-layout">
      <div class="changes-files">
        ${changes.slice(0, 8).map((file, index) => {
          const stats = lineStats(file);
          return `
            <button class="changes-row ${index === 0 ? "is-selected" : ""}" type="button" data-open-workspace-file="${escapeHtml(file.path)}" ${file.status === "deleted" ? "disabled" : ""}>
              <span>${escapeHtml(file.path)}</span>
              <small>${file.status === "deleted" ? "削除" : `<b>+${escapeHtml(String(stats.additions))}</b>${stats.deletions ? ` <em>-${escapeHtml(String(stats.deletions))}</em>` : ""}`}</small>
            </button>
          `;
        }).join("")}
      </div>
      <div class="changes-preview">
        <div class="preview-title">${escapeHtml(previewFile.path)} <span>+${escapeHtml(String(previewStats.additions))}</span></div>
        <pre class="diff-preview"><code>${renderDiffPreview(previewFile.diff)}</code></pre>
      </div>
    </div>
    <div class="changes-actions">
      <button type="button" data-open-workspace-file="${escapeHtml(previewFile.path)}" ${previewFile.status === "deleted" ? "disabled" : ""}>ファイルを開く</button>
      <span>選択フォルダーに適用済み</span>
    </div>
  `;
  el.messageStream.append(card);
}

function appendMessage(message, scroll = true) {
  const article = document.createElement("article");
  article.className = `message ${message.role === "user" ? "user" : "assistant"}`;
  article.dataset.messageId = message.id;
  const visibleContent = renderMessageBodyContent(message);
  article.innerHTML = `
    <div class="message-meta">
      <strong>${message.role === "user" ? "あなた" : ASSISTANT_DISPLAY_NAME}</strong>
      <small>${timeLabel(message.createdAt || new Date())}</small>
    </div>
    <div class="message-live-slot">${renderLiveIntro(message)}</div>
    <div class="message-process">${message.role === "assistant" ? renderProcessEvents(message.processEvents || [], { live: Boolean(message.streaming) }) : ""}</div>
    <div class="message-reasoning">${renderReasoningSummary(message)}</div>
    <div class="message-body ${visibleContent ? "" : "is-empty"}">${renderMarkdown(visibleContent)}</div>
    <div class="message-extra">${renderMessageExtras(message)}</div>
  `;
  el.messageStream.append(article);
  if (scroll) scrollMessages();
  return article;
}

function updateMessage(messageId, content, message = null) {
  const article = el.messageStream.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (!article) return;
  const renderTarget = message || { content };
  const visibleContent = renderMessageBodyContent(renderTarget, content);
  const live = article.querySelector(".message-live-slot");
  if (live) live.innerHTML = renderLiveIntro(renderTarget);
  const process = article.querySelector(".message-process");
  if (process) process.innerHTML = renderTarget.role === "assistant" ? renderProcessEvents(renderTarget.processEvents || [], { live: Boolean(renderTarget.streaming) }) : "";
  const reasoning = article.querySelector(".message-reasoning");
  if (reasoning) reasoning.innerHTML = renderReasoningSummary(renderTarget);
  const body = article.querySelector(".message-body");
  if (body) {
    body.classList.toggle("is-empty", !visibleContent);
    body.innerHTML = renderMarkdown(visibleContent);
  }
  if (message) {
    const extra = article.querySelector(".message-extra");
    if (extra) extra.innerHTML = renderMessageExtras(message);
  }
  scrollMessages();
}

function isNearMessageBottom() {
  const remaining = el.messageStream.scrollHeight - el.messageStream.scrollTop - el.messageStream.clientHeight;
  return remaining < 72;
}

function scrollMessages(force = false) {
  if (!force && !state.followLatestMessage) return;
  el.messageStream.scrollTop = el.messageStream.scrollHeight;
}

function renderCodeBlock(lang, code) {
  const label = lang || "code";
  return `
    <div class="code-block">
      <div class="code-toolbar">
        <span>${escapeHtml(label)}</span>
        <button type="button" data-copy-code>&#12467;&#12500;&#12540;</button>
      </div>
      <pre data-lang="${escapeHtml(label)}"><code>${escapeHtml(code)}</code></pre>
    </div>
  `;
}

function renderMarkdown(markdown) {
  const text = String(markdown || "");
  const parts = [];
  const fence = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let last = 0;
  let match;
  while ((match = fence.exec(text))) {
    if (match.index > last) parts.push(renderText(text.slice(last, match.index)));
    const lang = match[1] || "text";
    const code = match[2].replace(/\n$/, "");
    parts.push(renderCodeBlock(lang, code));
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(renderText(text.slice(last)));
  return parts.join("");
}

function renderText(value) {
  const blocks = String(value || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) return "";
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((line) => /^[-*]\s+/.test(line.trim()))) {
        return `<ul>${lines
          .map((line) => `<li>${renderInline(line.replace(/^[-*]\s+/, ""))}</li>`)
          .join("")}</ul>`;
      }
      return `<p>${lines.map(renderInline).join("<br>")}</p>`;
    })
    .join("");
}

function renderInline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

async function loadSystem() {
  try {
    state.system = await api("/api/system");
    const model = resolvedModelName(projectMode());
    if (el.modelLabel) el.modelLabel.textContent = modelScoreLabel(state.modelChoice || "auto", model);
    setStatus(state.system.ollama?.online ? "待機中" : "Ollama未接続");
    renderTopBar();
    renderSidebarVitals();
  } catch {
    el.modelLabel.textContent = "未接続";
    setStatus("オフライン");
    renderTopBar();
    renderSidebarVitals();
  }
}

async function loadToolState(projectId = state.activeProject?.id) {
  const [plugins, mcp, codex, social] = await Promise.allSettled([
    api("/api/plugins"),
    api("/api/mcp"),
    projectId ? api(`/api/workspace/codex?projectId=${encodeURIComponent(projectId)}`) : Promise.resolve(null),
    api("/api/social/status")
  ]);
  if (plugins.status === "fulfilled") state.plugins = plugins.value.plugins || [];
  if (mcp.status === "fulfilled") state.mcp = mcp.value;
  if (codex.status === "fulfilled") state.codex = codex.value;
  if (social.status === "fulfilled") state.socialOps = social.value;
  renderWorkspacePanel();
  renderTopBar();
  renderSidebarVitals();
}

async function refreshSocialOps() {
  try {
    state.socialOps = await api("/api/social/status");
  } catch {
    state.socialOps = null;
  }
  renderWorkspacePanel();
}

async function startSocialCampaignFromPrompt() {
  const topic = el.promptInput.value.trim();
  if (!topic) {
    el.promptInput.value = "SNS自動運用: Nexaの新機能をX / Instagram / TikTok / YouTube向けに7日分作って";
    autoresize();
    setStatus("SNS運用の内容を入力してからもう一度押してください");
    el.promptInput.focus();
    return;
  }
  setStatus("SNS運用案を作成中");
  state.liveAgents = [
    { id: "orchestrator", name: "Nexa", status: "running", model: "social" },
    { id: "planner", name: "Nexa", status: "running", model: "calendar" },
    { id: "response", name: "Nexa", status: "running", model: "copy" }
  ];
  renderWorkspacePanel();
  try {
    const result = await api("/api/social/campaigns", {
      method: "POST",
      body: {
        projectId: state.activeProject?.id || "",
        topic,
        platforms: ["x", "instagram", "tiktok", "youtube", "threads"],
        days: 7
      }
    });
    state.socialOps = result.store;
    state.liveAgents = [
      { id: "orchestrator", name: "Nexa", status: "ready", model: "social" },
      { id: "planner", name: "Nexa", status: "ready", model: `${result.posts?.length || 0} posts` },
      { id: "verifier", name: "Nexa", status: "ready", model: "approval queue" }
    ];
    setStatus(`SNS運用案を${result.posts?.length || 0}件作成しました`);
  } catch (error) {
    setStatus(`SNS運用エラー: ${error.message}`);
  }
  renderWorkspacePanel();
}

async function updateSocialPostAction(postId, action) {
  if (!postId || state.busy) return;
  setStatus(action === "publish" ? "SNS投稿を公開済みに記録中" : "SNS投稿を承認中");
  try {
    const result = await api(`/api/social/posts/${encodeURIComponent(postId)}/${action}`, {
      method: "POST",
      body: {}
    });
    state.socialOps = result.store;
    setStatus(action === "publish" ? "SNS投稿を手動公開済みにしました" : "SNS投稿を承認しました");
  } catch (error) {
    setStatus(`SNS操作エラー: ${error.message}`);
  }
  renderWorkspacePanel();
}

async function loadProjects(preferredId = localStorage.getItem("agent-company-project")) {
  const data = await api("/api/projects");
  state.projects = data.projects || [];
  let selected =
    state.projects.find((project) => project.id === preferredId) ||
    state.projects.find((project) => project.name === "Chat" || project.goal === CHAT_GOAL) ||
    state.projects[0];
  if (!selected) {
    const created = await createProject();
    selected = created;
  }
  await selectProject(selected.id);
}

async function createProject() {
  const created = await api("/api/projects", {
    method: "POST",
    body: {
      name: "新しいチャット",
      goal: CHAT_GOAL,
      mode: "",
      accessLevel: "default"
    }
  });
  state.projects = [created.project, ...state.projects.filter((project) => project.id !== created.project.id)];
  renderProjectList();
  return created.project;
}

async function newChat() {
  if (state.busy) return;
  state.query = "";
  state.attachments = [];
  renderAttachments();
  el.projectSearch.value = "";
  const project = await createProject();
  await selectProject(project.id);
  const mode = projectMode(project);
  setStatus(mode ? `${composerModeMeta(project).title}\u3067\u958b\u59cb\u3067\u304d\u307e\u3059` : "\u30e2\u30fc\u30c9\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044");
  el.promptInput.focus();
}

async function selectProject(projectId) {
  const data = await api(`/api/projects/${projectId}`);
  state.projectMenuId = "";
  state.activeProject = data.project;
  rememberProjectMode(projectMode(state.activeProject));
  localStorage.setItem("agent-company-project", projectId);
  renderProjectHeader();
  renderWorkspaceFolder();
  renderWorkspacePanel();
  renderProjectList();
  renderMessages();
  updateComposerModeButton();
  if (window.matchMedia("(max-width: 860px)").matches) {
    state.leftCollapsed = true;
    applyLayoutState();
  }
  loadToolState(projectId).catch(() => {
    renderWorkspacePanel();
  });
}

async function patchActiveProject(patch, statusText = "") {
  if (!state.activeProject) return;
  const data = await api(`/api/projects/${state.activeProject.id}`, {
    method: "PATCH",
    body: patch
  });
  state.activeProject = data.project;
  const index = state.projects.findIndex((project) => project.id === state.activeProject.id);
  if (index >= 0) state.projects[index] = data.summary || { ...state.projects[index], ...patch };
  if (statusText) setStatus(statusText);
  renderProjectHeader();
  renderWorkspaceFolder();
  renderWorkspacePanel();
  renderProjectList();
  renderMessages();
  updateComposerModeButton();
}

async function setProjectMode(mode) {
  const normalized = MODE_DETAILS[mode] ? mode : "";
  rememberProjectMode(normalized);
  await patchActiveProject({ mode: normalized }, `${MODE_DETAILS[normalized]?.label || "\u30e2\u30fc\u30c9"}\u3092\u9078\u629e\u3057\u307e\u3057\u305f`);
  if (normalized === "code" && !workspaceReady()) {
    await renderFolderPanel();
  }
  updateComposerModeButton();
  el.promptInput.focus();
}

async function setProjectAccess(level) {
  const normalized = ACCESS_DETAILS[level] ? level : "default";
  await patchActiveProject({ accessLevel: normalized }, `${ACCESS_DETAILS[normalized].label}にしました`);
  el.promptInput.focus();
}

function startRename(projectId) {
  state.projectMenuId = "";
  state.renamingProjectId = projectId;
  renderProjectList();
  requestAnimationFrame(() => {
    const input = el.projectList.querySelector(`[data-rename-input][data-project-id="${CSS.escape(projectId)}"]`);
    input?.focus();
    input?.select();
  });
}

function cancelRename() {
  if (!state.renamingProjectId) return;
  state.renamingProjectId = "";
  renderProjectList();
}

async function commitRename(projectId, rawName) {
  const project = state.projects.find((item) => item.id === projectId);
  const name = String(rawName || "").trim();
  state.renamingProjectId = "";
  if (!project || !name || name === project.name) {
    renderProjectList();
    return;
  }

  const previousName = project.name;
  project.name = name;
  if (state.activeProject?.id === projectId) {
    state.activeProject.name = name;
    renderProjectHeader();
  }
  renderProjectList();

  try {
    const data = await api(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: { name }
    });
    const updated = data.summary || data.project;
    const index = state.projects.findIndex((item) => item.id === projectId);
    if (index >= 0) state.projects[index] = { ...state.projects[index], ...updated };
    if (state.activeProject?.id === projectId && data.project) {
      state.activeProject = data.project;
      renderProjectHeader();
    }
  } catch (error) {
    project.name = previousName;
    if (state.activeProject?.id === projectId) {
      state.activeProject.name = previousName;
      renderProjectHeader();
    }
    appendMessage({
      id: `rename-${Date.now()}`,
      role: "assistant",
      content: `Rename error: ${error.message}`,
      createdAt: new Date().toISOString()
    });
  } finally {
    renderProjectList();
  }
}

async function deleteChat(projectId) {
  if (state.busy) return;
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  if (!window.confirm(`「${project.name || "Chat"}」を削除しますか？`)) return;

  await api(`/api/projects/${projectId}`, { method: "DELETE" });
  state.projects = state.projects.filter((item) => item.id !== projectId);
  state.renamingProjectId = "";
  state.projectMenuId = "";

  if (state.activeProject?.id === projectId) {
    const nextProject = state.projects[0] || await createProject();
    await selectProject(nextProject.id);
    return;
  }

  renderProjectList();
}

async function readSse(response, handler) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const packets = buffer.split("\n\n");
    buffer = packets.pop() || "";
    for (const packet of packets) {
      const lines = packet.split("\n");
      let event = "message";
      const data = [];
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data.push(line.slice(5).trim());
      }
      if (data.length) handler(event, JSON.parse(data.join("\n")));
    }
  }
}

function isWorkspaceWriteRequest(value = "") {
  const text = String(value || "").toLowerCase();
  return /code|app|api|html|css|javascript|typescript|react|vue|svelte|node|python|bug|fix/.test(text) ||
    /コード|アプリ|サイト|画面|ui|実装|作成|開発|修正|改善|ファイル|書いて|書き換え|追加|直して|バグ|エラー/.test(value);
}

async function sendPrompt(requestOptions = {}) {
  if (state.busy) {
    stopGeneration();
    return;
  }
  let message = el.promptInput.value.trim();
  if (!message && state.attachments.length) message = "添付内容を参考に要点を教えてください。";
  if (!message || !state.activeProject) return;
  resolvePendingChoiceRequest();
  state.followLatestMessage = true;
  const mode = projectMode();
  if (!mode) {
    setStatus("先にモードを選択してください");
    renderMessages();
    el.promptInput.focus();
    return;
  }
  if (mode === "code" && !workspaceReady()) {
    setStatus("コードを書く場所を選べるカードを表示します");
  }
  if (mode === "both" && isWorkspaceWriteRequest(message) && !workspaceReady()) {
    setStatus("フォルダー未選択のため、今回は通常チャットとして開始します");
  }
  const outgoingAttachments = state.attachments.map(({ name, type, size, text, content }) => ({
    name,
    type,
    size,
    text,
    content
  }));
  const generationRequest = generationRequestFromMessage(message);
  if (generationRequest && !generationRequest.prompt) {
    setStatus("生成プロンプトを入力してください");
    el.promptInput.focus();
    return;
  }

  setBusy(true);
  const controller = new AbortController();
  state.abortController = controller;
  state.liveAgents = [];
  if (isNewEmptyProject()) {
    el.messageStream.innerHTML = "";
    document.body.classList.remove("has-empty-chat");
    document.body.classList.add("has-active-chat");
  }
  renderWorkspacePanel();
  el.promptInput.value = "";
  autoresize();

  let assistant = null;
  let streamHadError = false;
  let stopped = false;
  try {
    if (generationRequest) {
      await runDirectGeneration(generationRequest.kind, generationRequest.prompt, outgoingAttachments);
      state.attachments = [];
      renderAttachments();
      return;
    }

    const response = await fetch("/api/chat/simple/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        projectId: state.activeProject.id,
        message,
        attachments: outgoingAttachments,
        mode,
        accessLevel: accessLevel(),
        options: {
          mode: runModeForProject(),
          code: mode !== "chat" && workspaceReady(),
          modelChoice: state.modelChoice,
          performance: state.performanceChoice,
          reasoningLevel: state.reasoningLevel,
          planMode: state.planMode,
          choiceResolution: requestOptions.choiceResolution || null
        }
      })
    });
    if (!response.ok || !response.body) throw new Error(await response.text());

    await readSse(response, (event, payload) => {
      if (event === "system") {
        state.system = payload;
        if (el.modelLabel) el.modelLabel.textContent = modelScoreLabel(state.modelChoice || "auto", resolvedModelName(projectMode()));
        renderWorkspacePanel();
      }
      if (event === "credits") {
        state.accountBilling ||= {};
        state.accountBilling.credits = payload;
        if (state.account) state.account.credits = payload;
        renderAccountModal();
      }
      if (event === "agent") {
        const index = state.liveAgents.findIndex((agent) => agent.id === payload.id);
        const agent = { ...payload, status: payload.status || "running" };
        if (index >= 0) state.liveAgents[index] = agent;
        else state.liveAgents.push(agent);
        renderWorkspacePanel();
      }
      if (event === "user") {
        state.activeProject.messages ||= [];
        state.activeProject.messages.push(payload);
        appendMessage(payload);
        renderProjectHeader();
      }
      if (event === "assistant-start") {
        assistant = { ...payload, streaming: true };
        state.activeProject.messages.push(assistant);
        appendMessage(assistant);
      }
      if (event === "assistant-delta" && assistant) {
        assistant.content += payload.delta;
        updateMessage(assistant.id, assistant.content, assistant);
      }
      if (event === "process" && assistant && payload.messageId === assistant.id) {
        assistant.processEvents ||= [];
        assistant.processEvents.push(payload.event);
        updateMessage(assistant.id, assistant.content, assistant);
      }
      if (event === "assistant-complete") {
        assistant = { ...payload, streaming: false };
        const index = state.activeProject.messages.findIndex((item) => item.id === payload.id);
        if (index >= 0) state.activeProject.messages[index] = assistant;
        updateMessage(payload.id, payload.content, assistant);
        renderProjectHeader();
        renderWorkspacePanel();
      }
      if (event === "project") {
        const index = state.projects.findIndex((project) => project.id === payload.id);
        if (index >= 0) state.projects[index] = payload;
        else state.projects.unshift(payload);
        renderProjectList();
        renderWorkspacePanel();
      }
      if (event === "error") {
        streamHadError = true;
        appendMessage({
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Error: ${payload.error}`,
          createdAt: new Date().toISOString()
        });
      }
    });
    if (!streamHadError) {
      state.attachments = [];
      renderAttachments();
    }
  } catch (error) {
    stopped = error.name === "AbortError" || controller.signal.aborted;
    if (stopped) {
      if (assistant) {
        assistant.content = assistant.content || "停止しました。";
        updateMessage(assistant.id, assistant.content, assistant);
      }
      return;
    }
    appendMessage({
      id: `error-${Date.now()}`,
      role: "assistant",
      content: `Error: ${error.message}`,
      createdAt: new Date().toISOString()
    });
  } finally {
    state.abortController = null;
    setBusy(false);
    if (!state.busy) state.liveAgents = [];
    if (!stopped) await loadProjects(state.activeProject.id);
    el.promptInput.focus();
  }
}

el.newChatButton.addEventListener("click", () => {
  newChat().catch((error) => {
    setStatus(error.message);
  });
});

el.projectSearch.addEventListener("input", () => {
  state.query = el.projectSearch.value;
  renderProjectList();
});

el.projectList.addEventListener("click", (event) => {
  const menuButton = event.target.closest("[data-menu-project-id]");
  if (menuButton) {
    event.stopPropagation();
    state.projectMenuId = state.projectMenuId === menuButton.dataset.menuProjectId ? "" : menuButton.dataset.menuProjectId;
    renderProjectList();
    return;
  }

  const menuAction = event.target.closest("[data-menu-action]");
  if (menuAction) {
    event.stopPropagation();
    const projectId = menuAction.dataset.menuActionProjectId;
    const action = menuAction.dataset.menuAction;
    state.projectMenuId = "";
    if (action === "rename") {
      startRename(projectId);
      return;
    }
    if (action === "delete") {
      deleteChat(projectId).catch((error) => {
        appendMessage({
          id: `delete-${Date.now()}`,
          role: "assistant",
          content: `Delete error: ${error.message}`,
          createdAt: new Date().toISOString()
        });
      });
      return;
    }
  }

  if (event.target.closest("[data-rename-input]")) return;
  const item = event.target.closest(".project-item[data-project-id]");
  if (!item || state.busy) return;
  state.projectMenuId = "";
  selectProject(item.dataset.projectId);
});

el.finalObjectiveEdit?.addEventListener("click", () => setFinalObjectiveEditing(true));
el.finalObjectiveCancel?.addEventListener("click", () => {
  setFinalObjectiveEditing(false);
  renderFinalObjective();
});
el.finalObjectiveSave?.addEventListener("click", () => {
  saveFinalObjective().catch((error) => setStatus(`最終目的を保存できませんでした: ${error.message}`));
});
el.finalObjectiveInput?.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    saveFinalObjective().catch((error) => setStatus(`最終目的を保存できませんでした: ${error.message}`));
  }
  if (event.key === "Escape") {
    event.preventDefault();
    setFinalObjectiveEditing(false);
    renderFinalObjective();
  }
});

el.projectList.addEventListener("focusout", (event) => {
  const input = event.target.closest("[data-rename-input]");
  if (!input) return;
  commitRename(input.dataset.projectId, input.value);
});

el.projectList.addEventListener("keydown", (event) => {
  const input = event.target.closest("[data-rename-input]");
  if (input) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename(input.dataset.projectId, input.value);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
    return;
  }

  if (event.target.closest("button")) return;
  const item = event.target.closest(".project-item[data-project-id]");
  if (!item || state.busy) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    selectProject(item.dataset.projectId);
  }
});

el.featureButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setFeaturePanelOpen(!state.featurePanelOpen);
});

el.composerModeButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  setFeaturePanelOpen(!state.featurePanelOpen);
});

el.folderButton.addEventListener("click", (event) => {
  event.stopPropagation();
  if (state.busy) return;
  pickLocalWorkspaceFolder();
});

el.composerFolderButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  if (state.busy) return;
  pickLocalWorkspaceFolder();
});

el.folderPanel.addEventListener("click", (event) => {
  const picker = event.target.closest("[data-pick-local-folder]");
  if (picker) {
    event.stopPropagation();
    pickLocalWorkspaceFolder();
    return;
  }

  const option = event.target.closest("[data-folder-path]");
  if (!option) return;
  event.stopPropagation();
  selectWorkspaceFolder(option.dataset.folderPath || "").catch((error) => {
    el.folderPanel.innerHTML = `<div class="folder-panel-state">Folder error: ${escapeHtml(error.message)}</div>`;
  });
});

el.messageStream.addEventListener("click", (event) => {
  const changeFile = event.target.closest("[data-select-change-file]");
  if (changeFile) {
    event.preventDefault();
    selectChangeCardFile(changeFile.dataset.selectChangeFile || "", changeFile.dataset.changeFileIndex || "0");
    return;
  }
  const fileButton = event.target.closest("[data-open-workspace-file]");
  if (fileButton) {
    event.preventDefault();
    openWorkspaceFilePreview(fileButton.dataset.openWorkspaceFile || "");
    return;
  }

  const choiceButton = event.target.closest("[data-choice-action]");
  if (choiceButton) {
    resolvePendingChoiceRequest();
    const action = choiceButton.dataset.choiceAction || "send-prompt";
    const prompt = choiceButton.dataset.choicePrompt || "";
    const mode = choiceButton.dataset.choiceMode || "";
    const choiceRequestId = choiceButton.closest("[data-choice-request]")?.dataset.choiceRequest || "";
    const choiceOptionId = choiceButton.dataset.choiceOption || "";
    const choiceResolution = { requestId: choiceRequestId, optionId: choiceOptionId, action };
    if (action === "folder-picker") {
      pickLocalWorkspaceFolder();
      return;
    }
    if (action === "set-mode") {
      Promise.resolve(mode ? setProjectMode(mode) : null)
        .then(() => {
          if (!prompt) return;
          el.promptInput.value = prompt;
          autoresize();
          return sendPrompt({ choiceResolution });
        })
        .catch((error) => setStatus(error.message));
      return;
    }
    if (prompt) {
      el.promptInput.value = prompt;
      autoresize();
      sendPrompt({ choiceResolution });
    }
    return;
  }

  const modeButton = event.target.closest("[data-mode-choice]");
  if (modeButton) {
    setProjectMode(modeButton.dataset.modeChoice).catch((error) => setStatus(error.message));
    return;
  }

  const accessButton = event.target.closest("[data-access-choice]");
  if (accessButton) {
    setProjectAccess(accessButton.dataset.accessChoice).catch((error) => setStatus(error.message));
    return;
  }

  if (event.target.closest("[data-start-folder]")) {
    event.stopPropagation();
    pickLocalWorkspaceFolder();
  }
});

el.messageStream.addEventListener("scroll", () => {
  state.followLatestMessage = isNearMessageBottom();
}, { passive: true });

el.featurePanel.addEventListener("click", (event) => {
  event.stopPropagation();
  const modeButton = event.target.closest("[data-mode-choice]");
  if (modeButton) {
    setFeaturePanelOpen(false);
    setProjectMode(modeButton.dataset.modeChoice).catch((error) => setStatus(error.message));
    return;
  }

  const accessButton = event.target.closest("[data-access-choice]");
  if (accessButton) {
    setProjectAccess(accessButton.dataset.accessChoice).catch((error) => setStatus(error.message));
    return;
  }

  const option = event.target.closest("[data-feature]");
  if (!option) return;
  if (option.dataset.feature === "attach") {
    setFeaturePanelOpen(false);
    el.fileInput.click();
    return;
  }
  if (option.dataset.feature === "folder") {
    setFeaturePanelOpen(false);
    pickLocalWorkspaceFolder();
    return;
  }
  if (option.dataset.feature === "image") {
    setFeaturePanelOpen(false);
    setGenerationMode("image");
    return;
  }
  if (option.dataset.feature === "social") {
    setFeaturePanelOpen(false);
    startSocialCampaignFromPrompt();
    return;
  }
  if (option.dataset.feature === "memory") {
    setFeaturePanelOpen(false);
    el.promptInput.value = el.promptInput.value.trim()
      ? `${el.promptInput.value.trim()}\n長期記憶を参考にして: `
      : "長期記憶を参考にして: ";
    autoresize();
    el.promptInput.focus();
    return;
  }
  if (option.dataset.feature === "plan") {
    setPlanMode(!state.planMode);
    return;
  }
  el.promptInput.focus();
});

el.modelMenuButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  setModelMenuOpen(!state.modelMenuOpen);
});

el.modelMenu?.addEventListener("click", (event) => {
  event.stopPropagation();
  const panelButton = event.target.closest("[data-model-panel]");
  if (panelButton) {
    const panel = panelButton.dataset.modelPanel || "";
    state.modelSubmenu = state.modelSubmenu === panel ? "" : panel;
    renderModelMenu();
    return;
  }
  const modelButton = event.target.closest("[data-model-choice]");
  if (modelButton) {
    setModelChoice(modelButton.dataset.modelChoice);
    setModelMenuOpen(false);
    el.promptInput.focus();
    return;
  }
  const reasoningButton = event.target.closest("[data-reasoning-choice]");
  if (reasoningButton) {
    setReasoningLevel(reasoningButton.dataset.reasoningChoice);
    return;
  }
  const speedButton = event.target.closest("[data-performance-choice]");
  if (speedButton) {
    setPerformanceChoice(speedButton.dataset.performanceChoice);
  }
});

el.leftSidebarToggle?.addEventListener("click", () => {
  state.leftCollapsed = !state.leftCollapsed;
  if (window.matchMedia("(max-width: 860px)").matches && !state.leftCollapsed) state.rightCollapsed = true;
  localStorage.setItem("agent-company-left-collapsed", String(state.leftCollapsed));
  applyLayoutState();
});

el.rightSidebarToggle?.addEventListener("click", () => {
  state.rightCollapsed = !state.rightCollapsed;
  if (window.matchMedia("(max-width: 860px)").matches && !state.rightCollapsed) state.leftCollapsed = true;
  localStorage.setItem("agent-company-right-collapsed", String(state.rightCollapsed));
  applyLayoutState();
});

el.imageToolButton?.addEventListener("click", () => {
  setGenerationMode("image");
});

el.accountButton?.addEventListener("click", () => {
  setAccountModalOpen(true);
  loadAccount().catch((error) => setAccountStatus(error.message, true));
});

el.accountModalBackdrop?.addEventListener("click", () => setAccountModalOpen(false));
el.accountModalClose?.addEventListener("click", () => setAccountModalOpen(false));

document.querySelectorAll("[data-account-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    state.accountTab = button.dataset.accountTab || "login";
    setAccountStatus("");
    renderAccountAuthMode();
  });
});

el.accountForm?.addEventListener("submit", handleAccountSubmit);
el.googleLoginButton?.addEventListener("click", () => {
  const google = providerById("google");
  if (!google?.configured) {
    setAccountStatus("Googleログインはまだ設定されていません。", true);
    return;
  }
  if ((google.desktop && google.desktopStartUrl) || runningInElectron()) {
    startDesktopGoogleLogin({
      ...google,
      desktopStartUrl: google.desktopStartUrl || "/api/auth/google/desktop/start"
    });
    return;
  }
  window.location.href = google.startUrl || "/api/auth/google/start";
});
el.accountCreateKeyButton?.addEventListener("click", createAccountKey);
el.accountCheckoutButton?.addEventListener("click", startBillingCheckout);
el.accountLogoutButton?.addEventListener("click", logoutAccount);
el.accountAdminButton?.addEventListener("click", () => {
  window.location.href = "/admin";
});
el.accountKeyList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-account-key]");
  if (!button) return;
  deleteAccountKey(button.dataset.deleteAccountKey);
});

function showChangesReviewStatus(cardId = "") {
  const changes = state.changeCards.get(cardId) || latestChangeRun()?.changes || [];
  setStatus(changes.length ? `${changes.length}件の変更を確認できます` : "まだ変更はありません");
  document.querySelector(".workspace-panel")?.classList.add("is-highlighted");
  setTimeout(() => document.querySelector(".workspace-panel")?.classList.remove("is-highlighted"), 900);
}

function cycleModelChoice() {
  const index = MODEL_CHOICES.indexOf(state.modelChoice);
  state.modelChoice = MODEL_CHOICES[(index + 1) % MODEL_CHOICES.length];
  localStorage.setItem("agent-company-model-choice", state.modelChoice);
  renderTopBar();
  renderWorkspacePanel();
  setStatus(`モデル選択: ${modelButtonText()}`);
}

function cyclePerformanceChoice() {
  const index = PERFORMANCE_CHOICES.indexOf(state.performanceChoice);
  state.performanceChoice = PERFORMANCE_CHOICES[(index + 1) % PERFORMANCE_CHOICES.length];
  localStorage.setItem("agent-company-performance", state.performanceChoice);
  renderTopBar();
  setStatus(`パフォーマンス: ${state.performanceChoice}`);
}

el.messageStream.addEventListener("click", async (event) => {
  const reviewButton = event.target.closest("[data-review-changes]");
  if (reviewButton) {
    showChangesReviewStatus(reviewButton.dataset.changeCard || "");
    return;
  }

  const button = event.target.closest("[data-copy-code]");
  if (!button) return;
  const code = button.closest(".code-block")?.querySelector("code")?.textContent || "";
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    const previous = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = previous;
    }, 900);
  } catch {
    button.textContent = "Copy failed";
    setTimeout(() => {
      button.textContent = "Copy";
    }, 1200);
  }
});

el.fileInput.addEventListener("change", async () => {
  const files = Array.from(el.fileInput.files || []);
  el.fileInput.value = "";
  if (!files.length) return;
  for (const file of files) {
    try {
      state.attachments.push(await fileToAttachment(file));
    } catch (error) {
      appendMessage({
        id: `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role: "assistant",
        content: `Attachment error: ${error.message}`,
        createdAt: new Date().toISOString()
      });
    }
  }
  renderAttachments();
  el.promptInput.focus();
});

el.attachmentTray.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-attachment]");
  if (!button || state.busy) return;
  const index = Number(button.dataset.removeAttachment);
  if (!Number.isInteger(index)) return;
  state.attachments.splice(index, 1);
  renderAttachments();
  el.promptInput.focus();
});

document.addEventListener("click", (event) => {
  const previewButton = event.target.closest("[data-preview-artifact]");
  if (previewButton) {
    event.preventDefault();
    const artifact = findArtifactByKey(previewButton.dataset.previewArtifact);
    if (artifact) showArtifactPreview(artifact);
    return;
  }
  if (event.target.closest("[data-close-artifact-preview]")) {
    closeArtifactPreview();
    return;
  }
  if (event.target.closest("[data-close-file-preview]")) {
    closeWorkspaceFilePreview();
    return;
  }
  if (event.target.closest("[data-review-changes]")) {
    showChangesReviewStatus();
  }
  const socialCreate = event.target.closest("[data-social-create]");
  if (socialCreate) {
    startSocialCampaignFromPrompt();
    return;
  }
  const socialApprove = event.target.closest("[data-social-approve]");
  if (socialApprove) {
    updateSocialPostAction(socialApprove.dataset.socialApprove, "approve");
    return;
  }
  const socialPublish = event.target.closest("[data-social-publish]");
  if (socialPublish) {
    updateSocialPostAction(socialPublish.dataset.socialPublish, "publish");
    return;
  }
  if (event.target.closest("#toolbarModel") || event.target.closest("#modelLabel")) {
    setModelMenuOpen(true);
  }
  if (event.target.closest("#toolbarPerformance")) {
    setModelMenuOpen(true);
  }
  if (state.featurePanelOpen && !event.target.closest("#featurePanel") && !event.target.closest("#featureButton") && !event.target.closest("#composerModeButton")) {
    setFeaturePanelOpen(false);
  }
  if (state.modelMenuOpen && !event.target.closest("#modelMenu") && !event.target.closest("#modelMenuButton") && !event.target.closest("#toolbarModel") && !event.target.closest("#toolbarPerformance")) {
    setModelMenuOpen(false);
  }
  if (state.folderPanelOpen && !event.target.closest("#folderPanel") && !event.target.closest("#folderButton") && !event.target.closest("#composerFolderButton")) {
    setFolderPanelOpen(false);
  }
  if (state.projectMenuId && !event.target.closest("#projectList")) {
    closeProjectMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.featurePanelOpen) {
    setFeaturePanelOpen(false);
  }
  if (event.key === "Escape" && state.folderPanelOpen) {
    setFolderPanelOpen(false);
  }
  if (event.key === "Escape" && state.modelMenuOpen) {
    setModelMenuOpen(false);
  }
  if (event.key === "Escape" && state.accountModalOpen) {
    setAccountModalOpen(false);
  }
  if (event.key === "Escape") {
    closeArtifactPreview();
    closeWorkspaceFilePreview();
  }
  if (event.key === "Escape" && state.projectMenuId) {
    closeProjectMenu();
  }
});

el.promptInput.addEventListener("input", autoresize);
el.promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendPrompt();
  }
});
el.composer.addEventListener("submit", (event) => {
  event.preventDefault();
  sendPrompt();
});

async function init() {
  if (window.matchMedia("(max-width: 860px)").matches) {
    state.leftCollapsed = true;
    state.rightCollapsed = true;
  }
  applyLayoutState();
  setBusy(false);
  renderFeaturePanel();
  renderModelMenu();
  updateGenerationModeUi();
  renderAttachments();
  renderWorkspaceFolder();
  setFeaturePanelOpen(false);
  setFolderPanelOpen(false);
  const accountRedirect = consumeAccountRedirectStatus();
  renderAccountModal();
  await loadAccount().catch(() => renderAccountModal());
  if (accountRedirect) {
    setAccountModalOpen(true);
    setAccountStatus(accountRedirect.message, accountRedirect.error);
  }
  await loadSystem();
  await loadProjects();
  autoresize();
  el.promptInput.focus();
}

init().catch((error) => {
  setStatus("起動エラー");
  appendMessage({
    id: `boot-${Date.now()}`,
    role: "assistant",
    content: `Boot error: ${error.message}`,
    createdAt: new Date().toISOString()
  });
});
