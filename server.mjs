import http from "node:http";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import vm from "node:vm";
import { existsSync, readFileSync as fsReadFileSync, readdirSync as fsReaddirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import { createNexaPipeline, pipelineSummary } from "./nexa-pipeline.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
loadEnvFile(path.join(ROOT, ".env"));
loadEnvFile(path.join(ROOT, "Nexa.env"));
loadEnvFile(path.join(ROOT, "Nexa.env.txt"));
const WORKSPACE_ROOT = path.resolve(process.env.WORKSPACE_ROOT || ROOT);
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const GENERATED_DIR = path.join(DATA_DIR, "generated");
const GENERATED_IMAGES_DIR = path.join(GENERATED_DIR, "images");
const GENERATED_VIDEOS_DIR = path.join(GENERATED_DIR, "videos");
const WORKSPACE_BASELINE = path.join(DATA_DIR, "workspace-baseline.json");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");
const SOCIAL_OPS_FILE = path.join(DATA_DIR, "social-ops.json");
const PLUGINS_DIR = path.join(ROOT, "plugins");
const MCP_CONFIG = path.join(ROOT, "mcp.servers.json");
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
// Templates are legacy-only. Nexa now requires model-authored code unless an
// operator explicitly opts back into the old emergency fallback.
const AI_CODE_GENERATION_ONLY = process.env.NEXA_TEMPLATE_FALLBACK !== "true";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_CODE_MODEL = process.env.OPENAI_CODE_MODEL || OPENAI_CHAT_MODEL;
const OPENAI_AUTO_ROUTE = process.env.OPENAI_AUTO_ROUTE !== "false";
const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const SESSION_COOKIE = "nexa_session";
const OAUTH_STATE_COOKIE = "nexa_oauth_state";
const SESSION_DAYS = Math.max(1, Number(process.env.SESSION_DAYS || 90));
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "";
const STRIPE_PRICE_IDS = Object.freeze({
  plus: process.env.STRIPE_PLUS_PRICE_ID || process.env.STRIPE_PRICE_PLUS_ID || "",
  pro: process.env.STRIPE_PRO_PRICE_ID || process.env.STRIPE_PRICE_PRO_ID || STRIPE_PRICE_ID || "",
  studio: process.env.STRIPE_STUDIO_PRICE_ID || process.env.STRIPE_PRICE_STUDIO_ID || ""
});
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || `${APP_PUBLIC_URL}/billing?status=success`;
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || `${APP_PUBLIC_URL}/billing?status=cancel`;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${APP_PUBLIC_URL}/api/auth/google/callback`;
const NEXA_OWNER_EMAIL = normalizeEmail(process.env.NEXA_OWNER_EMAIL || process.env.NEXA_ADMIN_EMAIL || "");
const NEXA_DESKTOP = process.env.NEXA_DESKTOP === "1";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const LOGIN_ATTEMPTS = new Map();
const DESKTOP_OAUTH_STATES = new Map();
const SORA_MODEL = process.env.SORA_MODEL || "sora-2";
const SORA_VIDEO_SIZE = process.env.SORA_VIDEO_SIZE || "1280x720";
const SORA_POLL_TIMEOUT_MS = Math.max(10000, Number(process.env.SORA_POLL_TIMEOUT_MS || 90000));
const SORA_POLL_INTERVAL_MS = Math.max(3000, Number(process.env.SORA_POLL_INTERVAL_MS || 10000));
const VIDEO_PROVIDER = String(process.env.VIDEO_PROVIDER || "free").toLowerCase();
const IMAGE_GENERATION_ONLY = true;
const COMFYUI_URL = (process.env.COMFYUI_URL || "http://127.0.0.1:8188").replace(/\/+$/, "");
const COMFYUI_VIDEO_WORKFLOW = process.env.COMFYUI_VIDEO_WORKFLOW || "";
const ENGINES_DIR = path.resolve(process.env.ENGINES_DIR || path.join(ROOT, "engines"));
const COMFYUI_DIR = path.resolve(process.env.COMFYUI_DIR || path.join(ENGINES_DIR, "ComfyUI"));
const COMFYUI_AUTO_START = process.env.COMFYUI_AUTO_START !== "false";
const COMFYUI_PROMPT_NODE = process.env.COMFYUI_PROMPT_NODE || "";
const COMFYUI_NEGATIVE_PROMPT_NODE = process.env.COMFYUI_NEGATIVE_PROMPT_NODE || "";
const COMFYUI_SEED_NODE = process.env.COMFYUI_SEED_NODE || "";
const COMFYUI_OUTPUT_NODE = process.env.COMFYUI_OUTPUT_NODE || "";
const COMFYUI_POLL_TIMEOUT_MS = Math.max(10000, Number(process.env.COMFYUI_POLL_TIMEOUT_MS || 180000));
const COMFYUI_POLL_INTERVAL_MS = Math.max(1000, Number(process.env.COMFYUI_POLL_INTERVAL_MS || 3000));
const HQ_VIDEO_ENGINE = String(process.env.HQ_VIDEO_ENGINE || "ltx").toLowerCase();
const LTX_DIFFUSERS_MODEL = process.env.LTX_DIFFUSERS_MODEL || "Lightricks/LTX-Video";
const LTX_DIFFUSERS_ENABLED = process.env.LTX_DIFFUSERS_ENABLED !== "false";
const LTX_DIFFUSERS_AUTO_DOWNLOAD = process.env.LTX_DIFFUSERS_AUTO_DOWNLOAD === "true";
const LTX_DIFFUSERS_REQUIRE_CUDA = process.env.LTX_DIFFUSERS_REQUIRE_CUDA !== "false";
const LTX_DIFFUSERS_ALLOW_UNVERIFIED = process.env.LTX_DIFFUSERS_ALLOW_UNVERIFIED === "true";
const LTX_DIFFUSERS_VERIFIED = process.env.LTX_DIFFUSERS_VERIFIED === "true";
const LTX_DIFFUSERS_TIMEOUT_MS = Math.max(60000, Number(process.env.LTX_DIFFUSERS_TIMEOUT_MS || 1800000));
const LTX_DIFFUSERS_WIDTH = Math.max(256, Number(process.env.LTX_DIFFUSERS_WIDTH || 768));
const LTX_DIFFUSERS_HEIGHT = Math.max(256, Number(process.env.LTX_DIFFUSERS_HEIGHT || 512));
const LTX_DIFFUSERS_STEPS = Math.max(4, Number(process.env.LTX_DIFFUSERS_STEPS || 30));
const LTX_DIFFUSERS_FPS = Math.max(8, Number(process.env.LTX_DIFFUSERS_FPS || 24));
const WORKSPACE_IGNORE = new Set([".git", "node_modules", ".playwright-cli", "output"]);
const TEXT_EXTENSIONS = new Set([
  ".c",
  ".bat",
  ".cc",
  ".cmd",
  ".conf",
  ".cpp",
  ".cs",
  ".css",
  ".csv",
  ".dart",
  ".env",
  ".go",
  ".h",
  ".hpp",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".jsx",
  ".json",
  ".kt",
  ".kts",
  ".md",
  ".mjs",
  ".php",
  ".properties",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".svg",
  ".svelte",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml"
]);
const TEXT_FILE_NAMES = new Set([
  ".dockerignore",
  ".editorconfig",
  ".env",
  ".env.example",
  ".gitattributes",
  ".gitignore",
  "dockerfile",
  "gemfile",
  "license",
  "makefile",
  "procfile"
]);

const AUTO_CONTEXT_RULES = [
  {
    pattern: /\bAI\b|agent|smarter|intelligence|intent|reasoning|orchestrator|planner|coder|critic|verifier|Nexa|\u8ce2|\u610f\u56f3|\u63a8\u8ad6|\u77ed\u6587|\u30e2\u30c7\u30eb/i,
    paths: ["server.mjs", "public/app.js"],
    reason: "assistant intelligence"
  },
  {
    pattern: /ui|ux|画面|見た目|デザイン|アニメ|モバイル|レスポンシブ|ボタン|workspace|ワークスペース|チャット|composer/i,
    paths: ["public/index.html", "public/styles.css", "public/app.js"],
    reason: "UI"
  },
  {
    pattern: /server|api|mcp|ollama|モデル|記憶|プロジェクト|検索|web|実行|添付|ファイル|agent|エージェント/i,
    paths: ["server.mjs"],
    reason: "backend"
  },
  {
    pattern: /readme|仕様|説明|セットアップ|起動|使い方|package|依存/i,
    paths: ["README.md", "package.json"],
    reason: "docs"
  },
  {
    pattern: /続き|前回|再開|続きをやって|続けて/i,
    paths: ["server.mjs", "public/app.js", "public/styles.css"],
    reason: "continuation"
  }
];

const SHELL_DENY_PATTERNS = [
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-/i,
  /\bRemove-Item\b[\s\S]*\b-Recurse\b/i,
  /\b(rm|rmdir|rd)\b[\s\S]*(?:-r|-rf|--recursive|\/s)\b/i,
  /\b(del|erase)\b[\s\S]*\b\/s\b/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown\b/i,
  /\bRestart-Computer\b/i,
  /\bStop-Computer\b/i
];

const CHAT_MODES = new Set(["", "code", "chat", "both"]);
const ACCESS_LEVELS = new Set(["full", "safety", "default"]);
const SOCIAL_PLATFORM_DEFS = [
  { id: "x", name: "X", maxLength: 280, tone: "short" },
  { id: "instagram", name: "Instagram", maxLength: 2200, tone: "visual" },
  { id: "tiktok", name: "TikTok", maxLength: 2200, tone: "hook" },
  { id: "youtube", name: "YouTube", maxLength: 5000, tone: "video" },
  { id: "threads", name: "Threads", maxLength: 500, tone: "conversation" },
  { id: "facebook", name: "Facebook", maxLength: 2000, tone: "community" },
  { id: "linkedin", name: "LinkedIn", maxLength: 3000, tone: "professional" }
];
const SOCIAL_PLATFORM_IDS = new Set(SOCIAL_PLATFORM_DEFS.map((platform) => platform.id));
const AGENT_BRAND_NAMES = {
  orchestrator: "司令塔",
  planner: "計画",
  memory: "記憶",
  toolRouter: "ツール",
  toolrouter: "ツール",
  reasoner: "推論",
  coder: "コード",
  researcher: "調査",
  strategist: "設計",
  secondOpinion: "別視点",
  secondopinion: "別視点",
  critic: "批評",
  verifier: "検証",
  selfEvaluator: "品質",
  selfevaluator: "品質",
  security: "安全",
  responseGenerator: "応答",
  responsegenerator: "応答",
  chief: "司令塔",
  research: "調査",
  architect: "推論",
  toolsmith: "ツール",
  patch: "コード",
  directWrite: "直接保存",
  directwrite: "直接保存",
  generator: "生成",
  imageGenerator: "画像生成",
  imagegenerator: "画像生成",
  videoGenerator: "動画生成",
  videogenerator: "動画生成",
  checks: "エラー確認"
};

const SMARTNESS_BASELINE = {
  beforeLevel: 4.7,
  afterLevel: 7.4,
  maxHonestLevel: 7.6,
  targetLevel: 8.0,
  version: "nexa-code-context-v8-postwrite-checks"
};

const BILLING_PLANS = [
  {
    id: "free",
    name: "Nexa 無料",
    priceJpy: 0,
    period: "month",
    monthlyCredits: 100,
    tagline: "個人で試せる無料プラン",
    features: ["毎月100クレジット", "ローカルAIチャット", "プロジェクト履歴", "基本的なファイル添付"]
  },
  {
    id: "plus",
    name: "Nexa プラス",
    priceJpy: 980,
    period: "month",
    monthlyCredits: 1200,
    tagline: "日常利用にちょうどいい軽量プラン",
    features: ["毎月1,200クレジット", "長期記憶の強化", "生成結果の保存枠アップ", "優先的なローカル実行キュー"]
  },
  {
    id: "pro",
    name: "Nexa プロ",
    priceJpy: 1980,
    period: "month",
    monthlyCredits: 5000,
    recommended: true,
    tagline: "開発、調査、コード生成まで使う人向け",
    features: ["毎月5,000クレジット", "コードモード強化", "AIチームログ", "高度なワークスペース操作", "優先サポート"]
  },
  {
    id: "studio",
    name: "Nexa スタジオ",
    priceJpy: 4980,
    period: "month",
    monthlyCredits: 12000,
    tagline: "配布や本格運用を見据えた制作者向け",
    features: ["毎月12,000クレジット", "大きなプロジェクト履歴", "管理者向け機能", "将来のチーム機能優先対応"]
  }
];

function paidBillingPlans() {
  return BILLING_PLANS.filter((plan) => plan.id !== "free");
}

function billingPlanById(planId = "pro") {
  const normalized = String(planId || "pro").toLowerCase();
  return BILLING_PLANS.find((plan) => plan.id === normalized) || null;
}

function stripePriceIdForPlan(planId = "pro") {
  return STRIPE_PRICE_IDS[String(planId || "").toLowerCase()] || "";
}

function anyStripePriceConfigured() {
  return paidBillingPlans().some((plan) => Boolean(stripePriceIdForPlan(plan.id)));
}

function checkoutReadyForPlan(planId = "pro") {
  return Boolean(STRIPE_SECRET_KEY && stripePriceIdForPlan(planId));
}

function paidPlanIdOrDefault(planId = "pro") {
  const plan = billingPlanById(planId);
  return plan && plan.id !== "free" ? plan.id : "pro";
}

function publicBillingPlans() {
  return BILLING_PLANS.map((plan) => ({
    ...plan,
    monthlyCredits: monthlyLimitForPlan(plan.id),
    checkoutReady: plan.id !== "free" && checkoutReadyForPlan(plan.id),
    stripeConfigured: plan.id === "free" || Boolean(stripePriceIdForPlan(plan.id))
  }));
}

function sanitizeNexaVisibleText(value = "") {
  return String(value || "")
    .replace(/\b(?:Astra|Lattice|Mneme|Navi|Helix|Forge|Quanta|Sage|Mira|Prism|Proof|Vela|Sentinel|Auralis|Lumen|Kino)\b/g, "Nexa")
    .replace(/\b(?:ChatGPT|Claude(?:\s+Code)?|Claude|Opus|OpenAI|Sora)\b/gi, "Nexa")
    .replace(/\bGPT(?:[-\s]?\d+(?:\.\d+)?)?\b/gi, "Nexa")
    .replace(/Nexa-style/gi, "Nexa")
    .replace(/Nexa級/g, "Nexa品質")
    .replace(/Nexaそのもの/g, "Nexa");
}

function agentBrandName(id = "") {
  const raw = String(id || "");
  const key = raw.replace(/[\s_-]+/g, "").toLowerCase();
  return AGENT_BRAND_NAMES[raw] || AGENT_BRAND_NAMES[key] || "AI";
}

function publicModelName(model = "") {
  const clean = String(model || "").trim().toLowerCase();
  if (!clean) return "Nexa";
  if (clean.includes("code") || clean.includes("coder") || clean.includes("deepseek") || clean.includes("codellama")) return "Nexa2.5";
  if (clean.includes("qwen3") || clean.includes("4b") || clean.includes("smart")) return "Nexa2.0";
  if (clean.includes("llama") || clean.includes("gemma")) return "Nexa1.5";
  if (clean.includes("fast") || clean.includes("qwen2.5") || clean.includes("fallback") || clean.includes("rules")) return "Nexa1.0";
  if (clean.includes("cloud") || clean.startsWith("openai:")) return "Nexa2.5";
  return "Nexa";
}

function userVisibleWriteIssue(error = "") {
  const text = String(error || "");
  if (/writable_file_block_or_valid_diff_not_found|file block|valid diff/i.test(text)) {
    return "保存形式が不安定だったため、自動補完へ切り替えます。";
  }
  if (/workspace_text_file_required/i.test(text)) return "テキストとして保存できるファイルへ補正します。";
  if (/workspace_file_required/i.test(text)) return "選択フォルダー内の有効なファイルへ補正します。";
  return sanitizeNexaVisibleText(text || "書き込み形式を修正しています。");
}

function normalizeChatMode(value) {
  const mode = String(value || "").toLowerCase();
  return CHAT_MODES.has(mode) ? mode : "";
}

function modeLabel(mode = "") {
  return {
    chat: "チャットモード",
    code: "コードモード",
    both: "両方モード"
  }[normalizeChatMode(mode)] || "モード未選択";
}

function applyProjectModeToRoute(project = null, route = {}, userText = "") {
  const mode = normalizeChatMode(project?.mode);
  const adjusted = {
    ...(route || {}),
    mode,
    modeLabel: modeLabel(mode),
    modeForcedChat: false,
    modeForcedCode: false
  };
  adjusted.intent ||= analyzeUserIntent(userText, project);

  if (mode === "chat") {
    adjusted.needsCode = false;
    adjusted.modeForcedChat = true;
    adjusted.isComplex = Boolean(adjusted.isComplex || adjusted.intent?.isTerse || adjusted.intent?.needsResearch);
    adjusted.intent = {
      ...adjusted.intent,
      taskKind: adjusted.intent?.videoUnsupported
        ? "media_generation_unsupported"
        : adjusted.intent?.needsResearch
        ? adjusted.intent.taskKind
        : "chat",
      needsCode: false,
      needsWorkspaceContext: false,
      projectState: {
        ...(adjusted.intent?.projectState || {}),
        mode
      }
    };
  } else if (mode === "code") {
    adjusted.needsCode = true;
    adjusted.modeForcedCode = true;
    adjusted.isComplex = true;
    adjusted.intent = {
      ...adjusted.intent,
      needsCode: true,
      needsWorkspaceContext: true,
      projectState: {
        ...(adjusted.intent?.projectState || {}),
        mode
      }
    };
  } else if (mode === "both") {
    adjusted.needsCode = Boolean(adjusted.needsCode || adjusted.intent?.needsCode);
    adjusted.intent = {
      ...adjusted.intent,
      needsCode: adjusted.needsCode,
      needsWorkspaceContext: Boolean(adjusted.intent?.needsWorkspaceContext || adjusted.needsCode),
      projectState: {
        ...(adjusted.intent?.projectState || {}),
        mode
      }
    };
  }

  return adjusted;
}

function normalizeAccessLevel(value) {
  const level = String(value || "default").toLowerCase();
  return ACCESS_LEVELS.has(level) ? level : "default";
}

function folderNameFromWorkspace(folder = "") {
  const clean = String(folder || "").replace(/\\/g, "/").replace(/\/+$/, "");
  if (!clean) return "";
  return clean.split("/").filter(Boolean).pop() || clean;
}

function codexPermissionForAccess(level) {
  return {
    full: "full-access",
    safety: "danger-approval",
    default: "always-approval"
  }[normalizeAccessLevel(level)] || "always-approval";
}

const AGENTS = [
  {
    id: "chief",
    name: "司令塔",
    title: "統括",
    kind: "fast",
    color: "#0071e3",
    system:
      "あなたはNexaです。ユーザーの意図、制約、次の一手を整理します。結論優先で、日本語で短く実務的に返してください。隠れた推論は出さず、必要な根拠だけ示します。"
  },
  {
    id: "research",
    name: "調査",
    title: "調査",
    kind: "fast",
    color: "#34c759",
    system:
      "あなたは調査担当AIです。与えられたWeb結果、添付、履歴から信頼できる事実と不確実性を分けます。検索結果がない場合は、確認すべき点を短く挙げます。日本語で返します。"
  },
  {
    id: "architect",
    name: "推論",
    title: "設計",
    kind: "code",
    color: "#ff9f0a",
    system:
      "あなたはコード設計担当AIです。実装、コマンド、ファイル構成、リスクを具体化します。必要ならコードブロックを出します。過剰設計を避け、日本語で実装可能な形にまとめます。"
  },
  {
    id: "toolsmith",
    name: "ツール",
    title: "実行",
    kind: "fast",
    color: "#ff375f",
    system:
      "あなたはツール実行担当AIです。利用可能なツール、プラグイン、MCP、コード実行の使い所を判断します。危険な操作は提案に留め、実行条件を短く明記します。日本語で返します。"
  },
  {
    id: "memory",
    name: "記憶",
    title: "記憶",
    kind: "fast",
    color: "#5856d6",
    system:
      "あなたは長期記憶担当AIです。会話から今後も使うべき事実、決定、未完了タスクだけを抽出します。JSONだけを返してください。形式は {\"facts\":[],\"decisions\":[],\"next\":[],\"summary\":\"\"} です。"
  }
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function id(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function defaultSocialOpsStore() {
  return {
    version: 1,
    accounts: [],
    campaigns: [],
    posts: [],
    updatedAt: now()
  };
}

async function readSocialOpsStore() {
  const store = await readJson(SOCIAL_OPS_FILE, defaultSocialOpsStore());
  store.version ||= 1;
  store.accounts = Array.isArray(store.accounts) ? store.accounts : [];
  store.campaigns = Array.isArray(store.campaigns) ? store.campaigns : [];
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  return store;
}

async function writeSocialOpsStore(store) {
  store.updatedAt = now();
  await writeJson(SOCIAL_OPS_FILE, store);
  return store;
}

function publicSocialPlatformDefs() {
  return SOCIAL_PLATFORM_DEFS.map((platform) => ({
    ...platform,
    providerConfigured: false,
    autoPublishReady: false,
    note: "OAuth/API連携を設定すると実投稿に切り替えられます"
  }));
}

function normalizeSocialPlatforms(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[, ]+/);
  const platforms = list
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => SOCIAL_PLATFORM_IDS.has(item));
  return [...new Set(platforms)].slice(0, SOCIAL_PLATFORM_DEFS.length);
}

function socialPlatformDef(platformId) {
  return SOCIAL_PLATFORM_DEFS.find((platform) => platform.id === platformId) || SOCIAL_PLATFORM_DEFS[0];
}

function socialText(value, max = 1200) {
  return clip(String(value || "").replace(/\s+/g, " ").trim(), max);
}

function topicKeywords(topic = "") {
  const clean = socialText(topic, 240);
  return clean
    .split(/[\s,.;:!?'"()[\]{}<>。、！？「」『』【】・]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
    .slice(0, 5);
}

function socialHashtags(topic = "", platform = "x") {
  const tags = topicKeywords(topic)
    .map((word) => word.replace(/[^\p{L}\p{N}_]/gu, ""))
    .filter(Boolean)
    .slice(0, platform === "x" ? 2 : 4);
  const defaults = platform === "linkedin" ? ["Nexa", "AI"] : ["Nexa", "AI開発"];
  return [...new Set([...tags, ...defaults])].slice(0, platform === "x" ? 3 : 5).map((tag) => `#${tag}`);
}

function makeSocialDraftContent({ topic, platform, day, projectName }) {
  const cleanTopic = socialText(topic || "Nexaのアップデート", 280);
  const name = projectName ? socialText(projectName, 80) : "Nexa";
  const tags = socialHashtags(cleanTopic, platform).join(" ");
  const templates = {
    x: `${name} update ${day}: ${cleanTopic}\n\n今日のポイントを1つに絞って、すぐ試せる形で共有します。${tags}`,
    instagram: `${cleanTopic}\n\n見せ方のポイント:\n1. Before/Afterを1枚目に置く\n2. 開発ログを短く重ねる\n3. 最後に保存したくなる一言を入れる\n\n${tags}`,
    tiktok: `冒頭3秒: 「${clip(cleanTopic, 48)}」\n\n構成:\n- 問題を一言で見せる\n- Nexaで直す過程を高速表示\n- 最後に完成画面を見せる\n\n${tags}`,
    youtube: `タイトル案: ${clip(cleanTopic, 70)}\n\n説明文:\n${name}で実装から確認まで進める流れを紹介します。\n\nチャプター:\n00:00 目的\n00:20 実装ログ\n01:10 結果確認\n\n${tags}`,
    threads: `${cleanTopic}\n\n開発中に迷いやすい部分を、Nexaのログと一緒に短くまとめます。${tags}`,
    facebook: `${cleanTopic}\n\nNexaで進めた作業の要点、使いどころ、次に試す改善をまとめました。\n${tags}`,
    linkedin: `${cleanTopic}\n\n開発生産性の観点では、作業ログ、検証、承認フローを1つのワークスペースにまとめることが重要です。\n\n${tags}`
  };
  const def = socialPlatformDef(platform);
  return clip(templates[platform] || templates.x, Math.max(120, def.maxLength));
}

function socialScheduleAt(day, platformIndex) {
  const date = new Date(Date.now() + day * 24 * 60 * 60 * 1000);
  date.setHours(9 + (platformIndex % 4) * 3, platformIndex % 2 ? 30 : 0, 0, 0);
  return date.toISOString();
}

function socialStats(store) {
  const posts = store.posts || [];
  return {
    accounts: (store.accounts || []).length,
    campaigns: (store.campaigns || []).length,
    queued: posts.filter((post) => post.status === "queued").length,
    approved: posts.filter((post) => post.status === "approved").length,
    published: posts.filter((post) => post.status === "published").length,
    canceled: posts.filter((post) => post.status === "canceled").length
  };
}

function publicSocialStore(store) {
  return {
    platforms: publicSocialPlatformDefs(),
    accounts: (store.accounts || []).map((account) => ({
      id: account.id,
      platform: account.platform,
      handle: account.handle,
      displayName: account.displayName || account.handle,
      providerConfigured: Boolean(account.providerConfigured),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    })),
    campaigns: (store.campaigns || []).slice(-20).reverse(),
    posts: (store.posts || []).slice(-80).reverse(),
    stats: socialStats(store),
    updatedAt: store.updatedAt || now()
  };
}

async function createSocialCampaign(body = {}) {
  const store = await readSocialOpsStore();
  const project = body.projectId ? await getProject(body.projectId) : null;
  if (body.projectId && !project) {
    const error = new Error("project_not_found");
    error.status = 404;
    throw error;
  }
  const topic = socialText(body.topic || body.prompt || body.message || "", 900);
  if (!topic) {
    const error = new Error("social_topic_required");
    error.status = 400;
    throw error;
  }
  const platforms = normalizeSocialPlatforms(body.platforms);
  const selectedPlatforms = platforms.length ? platforms : ["x", "instagram", "tiktok", "youtube", "threads"];
  const days = Math.min(30, Math.max(1, Math.floor(Number(body.days || 7))));
  const campaign = {
    id: id("social_campaign"),
    projectId: project?.id || "",
    projectName: project?.name || "",
    title: socialText(body.title || topic, 90),
    topic,
    platforms: selectedPlatforms,
    days,
    status: "drafting",
    createdAt: now(),
    updatedAt: now()
  };
  const posts = [];
  for (let day = 1; day <= days; day += 1) {
    selectedPlatforms.forEach((platform, platformIndex) => {
      posts.push({
        id: id("social_post"),
        campaignId: campaign.id,
        projectId: campaign.projectId,
        platform,
        title: `${socialPlatformDef(platform).name} day ${day}`,
        content: makeSocialDraftContent({ topic, platform, day, projectName: campaign.projectName }),
        scheduledAt: socialScheduleAt(day, platformIndex),
        status: "queued",
        approvalRequired: true,
        providerConfigured: false,
        createdAt: now(),
        updatedAt: now()
      });
    });
  }
  campaign.status = "ready";
  campaign.postCount = posts.length;
  campaign.updatedAt = now();
  store.campaigns.push(campaign);
  store.posts.push(...posts);
  await writeSocialOpsStore(store);
  return { campaign, posts, store: publicSocialStore(store) };
}

async function updateSocialPost(postId, patch = {}) {
  const store = await readSocialOpsStore();
  const post = store.posts.find((item) => item.id === postId);
  if (!post) {
    const error = new Error("social_post_not_found");
    error.status = 404;
    throw error;
  }
  if ("content" in patch) post.content = socialText(patch.content, socialPlatformDef(post.platform).maxLength);
  if ("scheduledAt" in patch) post.scheduledAt = new Date(patch.scheduledAt || post.scheduledAt).toISOString();
  if ("status" in patch && ["queued", "approved", "published", "canceled"].includes(String(patch.status))) {
    post.status = String(patch.status);
  }
  post.updatedAt = now();
  await writeSocialOpsStore(store);
  return { post, store: publicSocialStore(store) };
}

async function addSocialAccount(body = {}) {
  const platform = normalizeSocialPlatforms([body.platform])[0];
  const handle = socialText(body.handle || body.username || "", 80);
  if (!platform || !handle) {
    const error = new Error("social_account_required");
    error.status = 400;
    throw error;
  }
  const store = await readSocialOpsStore();
  const account = {
    id: id("social_account"),
    platform,
    handle,
    displayName: socialText(body.displayName || handle, 80),
    providerConfigured: false,
    createdAt: now(),
    updatedAt: now()
  };
  store.accounts.push(account);
  await writeSocialOpsStore(store);
  return { account, store: publicSocialStore(store) };
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const lines = fsReadFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    const quote = value[0];
    if ((quote === `"` || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
      if (quote === `"`) {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, `"`)
          .replace(/\\\\/g, "\\");
      }
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function clip(value, length = 1800) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function hashText(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function notFound(res) {
  json(res, 404, { error: "not_found" });
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return structuredClone(fallback);
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

async function readBody(req, limit = 18 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      throw new Error("request_too_large");
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function readRawBody(req, limit = 18 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function jsonError(res, status, error, extra = {}) {
  json(res, status, { error, ...extra });
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}

function validEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomToken(bytes = 32) {
  return base64Url(crypto.randomBytes(bytes));
}

function sha256(value = "") {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function timingSafeEqualHex(a = "", b = "") {
  const left = Buffer.from(String(a || ""), "hex");
  const right = Buffer.from(String(b || ""), "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hashPassword(password, salt = randomToken(18)) {
  const hash = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  const { hash } = hashPassword(password, salt);
  return timingSafeEqualHex(hash, expectedHash);
}

function parseCookies(req) {
  const header = String(req.headers.cookie || "");
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function appendSetCookie(res, cookie) {
  const current = res.getHeader("set-cookie");
  if (!current) {
    res.setHeader("set-cookie", cookie);
    return;
  }
  res.setHeader("set-cookie", Array.isArray(current) ? [...current, cookie] : [current, cookie]);
}

function redirect(res, location, status = 302) {
  res.writeHead(status, {
    location,
    "cache-control": "no-store"
  });
  res.end();
}

function secureCookieSuffix() {
  return APP_PUBLIC_URL.startsWith("https://") ? "; Secure" : "";
}

function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  appendSetCookie(res, `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secureCookieSuffix()}`);
}

function clearSessionCookie(res) {
  appendSetCookie(res, `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookieSuffix()}`);
}

function setOauthStateCookie(res, state) {
  appendSetCookie(res, `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secureCookieSuffix()}`);
}

function clearOauthStateCookie(res) {
  appendSetCookie(res, `${OAUTH_STATE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookieSuffix()}`);
}

function authDefaults() {
  return {
    ownerUserId: "",
    users: [],
    sessions: [],
    apiKeys: [],
    billingEvents: [],
    createdAt: now(),
    updatedAt: now()
  };
}

function blockedUserStatus(status = "") {
  return ["disabled", "banned"].includes(String(status || "").toLowerCase());
}

function activeUser(user = {}) {
  return Boolean(user && !blockedUserStatus(user.status));
}

function ownerCandidate(store = {}) {
  const users = Array.isArray(store.users) ? store.users : [];
  if (NEXA_OWNER_EMAIL) {
    return users.find((user) => normalizeEmail(user.email) === NEXA_OWNER_EMAIL) || null;
  }
  if (store.ownerUserId) {
    const savedOwner = users.find((user) => user.id === store.ownerUserId);
    if (savedOwner) return savedOwner;
  }
  return users.find((user) => user.role === "admin") || (users.length === 1 ? users[0] : null);
}

function shouldCreateOwner(email, store = {}) {
  if (NEXA_OWNER_EMAIL) return normalizeEmail(email) === NEXA_OWNER_EMAIL;
  const users = Array.isArray(store.users) ? store.users : [];
  return users.length === 0;
}

function normalizeOwnerAdmin(store = {}) {
  const owner = ownerCandidate(store);
  if (!owner) return store;
  store.ownerUserId = owner.id;
  for (const user of store.users || []) {
    if (user.id === owner.id) {
      user.role = "admin";
      user.plan = user.plan === "free" ? "pro" : (user.plan || "pro");
      user.subscriptionStatus ||= user.plan === "pro" ? "active" : "";
    } else if (user.role === "admin") {
      user.role = "user";
    }
  }
  return store;
}

function isOwnerAdmin(store = {}, user = null) {
  if (!user) return false;
  const owner = ownerCandidate(store);
  return Boolean(owner && owner.id === user.id && user.role === "admin" && activeUser(user));
}

function normalizeAuthStore(store = {}) {
  const clean = { ...authDefaults(), ...(store || {}) };
  clean.ownerUserId = typeof clean.ownerUserId === "string" ? clean.ownerUserId : "";
  clean.users = Array.isArray(clean.users) ? clean.users.map((user) => normalizeUserAccount(user)) : [];
  clean.sessions = Array.isArray(clean.sessions) ? clean.sessions : [];
  clean.apiKeys = Array.isArray(clean.apiKeys) ? clean.apiKeys : [];
  clean.billingEvents = Array.isArray(clean.billingEvents) ? clean.billingEvents : [];
  clean.updatedAt ||= now();
  return normalizeOwnerAdmin(clean);
}

async function readAuthStore() {
  return normalizeAuthStore(await readJson(AUTH_FILE, authDefaults()));
}

async function writeAuthStore(store) {
  const clean = normalizeAuthStore(store);
  clean.updatedAt = now();
  await writeJson(AUTH_FILE, clean);
  return clean;
}

function publicUser(user = null) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || "",
    role: user.role || "user",
    plan: user.plan || "free",
    status: user.status || "active",
    subscriptionStatus: user.subscriptionStatus || "",
    credits: creditSummaryForUser(user),
    providers: Object.keys(user.oauth || {}),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || ""
  };
}

function apiKeyPublic(key = {}) {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes || [],
    plan: key.plan || "free",
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt || "",
    revokedAt: key.revokedAt || "",
    usage: key.usage || { requests: 0, tokens: 0 }
  };
}

async function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return { user: null, session: null, store: await readAuthStore() };
  const tokenHash = sha256(token);
  const store = await readAuthStore();
  const session = store.sessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt);
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    return { user: null, session: null, store };
  }
  const user = store.users.find((item) => item.id === session.userId && activeUser(item));
  return { user: user || null, session: user ? session : null, store };
}

async function requireUser(req, res) {
  const auth = await getSession(req);
  if (!auth.user) {
    jsonError(res, 401, "login_required");
    return null;
  }
  return auth;
}

async function requireAdmin(req, res) {
  const auth = await requireUser(req, res);
  if (!auth) return null;
  if (!isOwnerAdmin(auth.store, auth.user)) {
    jsonError(res, 403, "admin_required");
    return null;
  }
  return auth;
}

function monthlyLimitForPlan(plan = "free") {
  if (plan === "admin") return Infinity;
  if (plan === "studio") return 12000;
  if (plan === "pro") return 5000;
  if (plan === "plus") return 1200;
  return 100;
}

function userEffectivePlan(user = {}) {
  if (user.role === "admin") return "admin";
  if (["plus", "pro", "studio"].includes(user.plan) && ["active", "trialing"].includes(String(user.subscriptionStatus || "active"))) return user.plan;
  return user.plan || "free";
}

function nextCreditResetAt() {
  const [year, month] = currentUsageMonth().split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString();
}

function normalizeUserCredits(user = {}) {
  const month = currentUsageMonth();
  const previous = user.credits && typeof user.credits === "object" ? user.credits : {};
  const sameMonth = previous.month === month;
  user.credits = {
    month,
    used: sameMonth ? Math.max(0, Math.floor(Number(previous.used || 0))) : 0,
    bonus: Math.max(0, Math.floor(Number(previous.bonus || 0))),
    resetAt: sameMonth && previous.resetAt ? previous.resetAt : nextCreditResetAt(),
    updatedAt: previous.updatedAt || now()
  };
  return user.credits;
}

function normalizeUserAccount(user = {}) {
  const clean = { ...user };
  normalizeUserCredits(clean);
  return clean;
}

function creditSummaryForUser(user = {}) {
  const credits = normalizeUserCredits(user);
  const plan = userEffectivePlan(user);
  const monthlyCredits = monthlyLimitForPlan(plan);
  const unlimited = !Number.isFinite(monthlyCredits);
  const total = unlimited ? null : monthlyCredits + credits.bonus;
  const remaining = unlimited ? null : Math.max(0, total - credits.used);
  return {
    month: credits.month,
    plan,
    monthly: unlimited ? null : monthlyCredits,
    bonus: credits.bonus,
    total,
    used: credits.used,
    remaining,
    unlimited,
    resetAt: credits.resetAt
  };
}

async function consumeRequestCredits(req, cost = 1, reason = "chat") {
  const auth = await getSession(req);
  if (!auth.user) {
    return { authenticated: false, user: null, credits: null };
  }
  const normalizedCost = Math.max(1, Math.floor(Number(cost || 1)));
  const credits = normalizeUserCredits(auth.user);
  const before = creditSummaryForUser(auth.user);
  if (!before.unlimited && Number(before.remaining || 0) < normalizedCost) {
    const error = new Error("credits_exhausted");
    error.status = 402;
    error.code = "credits_exhausted";
    error.credits = before;
    throw error;
  }
  credits.used += normalizedCost;
  credits.updatedAt = now();
  auth.store.billingEvents.push({
    id: id("credit"),
    type: "credits.consumed",
    planId: before.plan,
    userId: auth.user.id,
    credits: normalizedCost,
    reason,
    createdAt: now()
  });
  auth.store.billingEvents = auth.store.billingEvents.slice(-500);
  await writeAuthStore(auth.store);
  return {
    authenticated: true,
    user: publicUser(auth.user),
    credits: creditSummaryForUser(auth.user)
  };
}

function authProviderList() {
  return [
    {
      id: "google",
      name: "Google",
      configured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
      startUrl: "/api/auth/google/start",
      desktop: NEXA_DESKTOP,
      desktopStartUrl: "/api/auth/google/desktop/start"
    }
  ];
}

function createSession(req, user) {
  const token = randomToken(36);
  const session = {
    id: id("session"),
    userId: user.id,
    tokenHash: sha256(token),
    createdAt: now(),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    ip: req.socket.remoteAddress || "",
    userAgent: String(req.headers["user-agent"] || "").slice(0, 300)
  };
  return { token, session };
}

function desktopSessionPayload(token, session) {
  return NEXA_DESKTOP ? {
    desktopSessionToken: token,
    sessionExpiresAt: session.expiresAt
  } : {};
}

function cleanupDesktopOauthStates() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [state, record] of DESKTOP_OAUTH_STATES.entries()) {
    if (Number(record.createdAt || 0) < cutoff) DESKTOP_OAUTH_STATES.delete(state);
  }
}

function googleAuthorizationUrl(state) {
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");
  return authUrl;
}

function oauthHtml(title, message) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080a0f;color:#f6f7fb;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{max-width:520px;padding:28px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(255,255,255,.06)}p{color:#a8b0bf;line-height:1.7}</style></head><body><main class="card"><h1>${title}</h1><p>${message}</p></main></body></html>`;
}

function html(res, status, body) {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text };
  }
  if (!response.ok) {
    const error = new Error(payload.error_description || payload.error || response.statusText);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function exchangeGoogleCode(code) {
  const body = formEncode([
    ["client_id", GOOGLE_CLIENT_ID],
    ["client_secret", GOOGLE_CLIENT_SECRET],
    ["code", code],
    ["grant_type", "authorization_code"],
    ["redirect_uri", GOOGLE_REDIRECT_URI]
  ]);
  return await fetchJson(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
}

async function fetchGoogleProfile(accessToken) {
  const profile = await fetchJson(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const email = normalizeEmail(profile.email);
  if (!profile.sub) {
    const error = new Error("google_profile_missing_sub");
    error.status = 400;
    throw error;
  }
  if (!validEmail(email)) {
    const error = new Error("google_profile_missing_email");
    error.status = 400;
    throw error;
  }
  if (profile.email_verified === false || profile.email_verified === "false") {
    const error = new Error("google_email_not_verified");
    error.status = 403;
    throw error;
  }
  return {
    id: String(profile.sub),
    email,
    name: String(profile.name || profile.given_name || email.split("@")[0]).trim().slice(0, 80),
    picture: String(profile.picture || "").slice(0, 500)
  };
}

function upsertGoogleUser(store, profile) {
  let user = store.users.find((item) => item.oauth?.google?.id === profile.id);
  if (!user) {
    user = store.users.find((item) => normalizeEmail(item.email) === profile.email);
  }
  const firstUser = store.users.length === 0;
  const ownerUser = shouldCreateOwner(profile.email, store);
  if (!user) {
    user = {
      id: id("user"),
      email: profile.email,
      name: profile.name || profile.email.split("@")[0],
      passwordSalt: "",
      passwordHash: "",
      role: ownerUser ? "admin" : "user",
      plan: ownerUser ? "pro" : "free",
      status: "active",
      subscriptionStatus: ownerUser ? "active" : "",
      stripeCustomerId: "",
      stripeSubscriptionId: "",
      oauth: {},
      createdAt: now(),
      updatedAt: now(),
      lastLoginAt: now()
    };
    store.users.push(user);
  }
  user.oauth ||= {};
  user.oauth.google = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    linkedAt: user.oauth.google?.linkedAt || now(),
    updatedAt: now()
  };
  user.email ||= profile.email;
  if (!user.name) user.name = profile.name || profile.email.split("@")[0];
  user.lastLoginAt = now();
  user.updatedAt = now();
  normalizeOwnerAdmin(store);
  return { user, firstUser };
}

function currentUsageMonth() {
  return new Date().toISOString().slice(0, 7);
}

function estimateTokensFromMessages(messages = []) {
  const text = messages.map((message) => `${message.role || ""}: ${message.content || ""}`).join("\n");
  return Math.max(1, Math.ceil(text.length / 4));
}

function formEncode(entries = []) {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== "") params.append(key, String(value));
  }
  return params;
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
}

function loginAttemptKey(req, email = "") {
  return `${clientIp(req)}:${normalizeEmail(email)}`;
}

function tooManyLoginAttempts(req, email = "") {
  const key = loginAttemptKey(req, email);
  const entry = LOGIN_ATTEMPTS.get(key);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    LOGIN_ATTEMPTS.delete(key);
    return false;
  }
  return entry.count >= 8;
}

function recordLoginFailure(req, email = "") {
  const key = loginAttemptKey(req, email);
  const entry = LOGIN_ATTEMPTS.get(key) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
  entry.count += 1;
  entry.resetAt = Math.max(entry.resetAt, Date.now() + 15 * 60 * 1000);
  LOGIN_ATTEMPTS.set(key, entry);
}

function clearLoginFailures(req, email = "") {
  LOGIN_ATTEMPTS.delete(loginAttemptKey(req, email));
}

function trustedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const publicUrl = new URL(APP_PUBLIC_URL);
    const requestHost = String(req.headers.host || "");
    return originUrl.host === requestHost || originUrl.host === publicUrl.host;
  } catch {
    return false;
  }
}

function safeFileName(name) {
  return String(name || "file").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 120);
}

function workspacePath(input = "") {
  const normalized = path.normalize(String(input || "").replace(/^[/\\]+/, ""));
  const absolute = path.resolve(WORKSPACE_ROOT, normalized);
  if (absolute !== WORKSPACE_ROOT && !absolute.startsWith(`${WORKSPACE_ROOT}${path.sep}`)) {
    throw new Error("workspace_path_forbidden");
  }
  return absolute;
}

function relativeWorkspacePath(file) {
  const rel = path.relative(WORKSPACE_ROOT, file);
  return rel ? rel.replace(/\\/g, "/") : "";
}

function toPortablePath(value = "") {
  return String(value || "").replace(/\\/g, "/");
}

function isAbsoluteLocalPath(value = "") {
  const text = String(value || "").trim();
  return Boolean(text && (path.isAbsolute(text) || /^[A-Za-z]:[\\/]/.test(text) || /^\\\\[^\\]/.test(text)));
}

function normalizeLocalFolderPath(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return toPortablePath(path.resolve(raw));
}

function decodeUtf16Base64(value = "") {
  const clean = String(value || "").trim();
  if (!clean) return "";
  return Buffer.from(clean, "base64").toString("utf16le").trim();
}

function pathInside(parent, child) {
  const root = path.resolve(parent);
  const target = path.resolve(child);
  const rel = path.relative(root, target);
  return rel === "" || (rel && !rel.startsWith("..") && !path.isAbsolute(rel));
}

function cleanWorkspaceFilePath(value = "") {
  const raw = String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
  if (!raw || raw === ".") return "";
  if (raw.split("/").includes("..")) throw new Error("workspace_path_forbidden");
  const normalized = path.posix.normalize(raw).replace(/^\/+/, "");
  if (!normalized || normalized === ".") return "";
  if (normalized.split("/").includes("..")) throw new Error("workspace_path_forbidden");
  return normalized;
}

function cleanWorkspaceFolder(value = "") {
  const normalized = String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .trim();
  if (!normalized || normalized === ".") return "";
  if (normalized.split("/").includes("..")) throw new Error("workspace_folder_forbidden");
  if (normalized === "data" || normalized.startsWith("data/")) throw new Error("workspace_folder_ignored");
  if (normalized === "output" || normalized.startsWith("output/")) throw new Error("workspace_folder_ignored");
  if (normalized === ".playwright-cli" || normalized.startsWith(".playwright-cli/")) {
    throw new Error("workspace_folder_ignored");
  }
  return normalized;
}

function normalizeWorkspaceFolderValue(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isAbsoluteLocalPath(raw)) return normalizeLocalFolderPath(raw);
  return cleanWorkspaceFolder(raw);
}

function normalizeWorkspaceFolder(project) {
  project.workspaceRoot = normalizeWorkspaceFolderValue(project.workspaceRoot || "");
  project.workspaceReady = Boolean(project.workspaceReady || project.workspaceRoot);
  return project.workspaceRoot;
}

function projectWorkspaceRootPath(project) {
  if (!project?.workspaceReady) return WORKSPACE_ROOT;
  const root = normalizeWorkspaceFolder(project);
  return isAbsoluteLocalPath(root) ? path.resolve(root) : workspacePath(root);
}

function projectRelativeWorkspacePath(project, file) {
  if (!project?.workspaceReady) return relativeWorkspacePath(file);
  const root = projectWorkspaceRootPath(project);
  const rel = path.relative(root, file);
  return rel ? rel.replace(/\\/g, "/") : "";
}

function projectScopedWorkspacePath(project, input = "") {
  if (normalizeAccessLevel(project?.accessLevel) === "full" && isAbsoluteLocalPath(input)) {
    return path.resolve(normalizeLocalFolderPath(input));
  }
  const rel = cleanWorkspaceFilePath(input);
  const root = project?.workspaceReady ? normalizeWorkspaceFolder(project) : "";
  if (project?.workspaceReady && isAbsoluteLocalPath(root)) {
    const rootPath = projectWorkspaceRootPath(project);
    const absolute = path.resolve(rootPath, rel);
    if (!pathInside(rootPath, absolute)) throw new Error("workspace_scope_forbidden");
    return absolute;
  }
  const scopedRel = root && !pathInWorkspaceFolder(rel, root) ? path.posix.join(root, rel) : rel;
  const absolute = workspacePath(scopedRel);
  const relPath = relativeWorkspacePath(absolute);
  if (project?.workspaceReady && !pathInWorkspaceFolder(relPath, root)) {
    throw new Error("workspace_scope_forbidden");
  }
  return absolute;
}

async function validateWorkspaceFolder(value = "") {
  const folder = normalizeWorkspaceFolderValue(value);
  const absolute = isAbsoluteLocalPath(folder) ? path.resolve(folder) : workspacePath(folder);
  const folderStat = await stat(absolute);
  if (!folderStat.isDirectory()) throw new Error("workspace_folder_required");
  return folder;
}

async function pickLocalFolderDialog() {
  if (process.platform !== "win32") {
    const error = new Error("folder_picker_unsupported");
    error.status = 400;
    throw error;
  }

  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "[System.Windows.Forms.Application]::EnableVisualStyles()",
    "$owner = New-Object System.Windows.Forms.Form",
    "$owner.Text = 'AI フォルダー選択'",
    "$owner.Width = 1",
    "$owner.Height = 1",
    "$owner.StartPosition = 'CenterScreen'",
    "$owner.ShowInTaskbar = $false",
    "$owner.TopMost = $true",
    "$owner.Opacity = 0",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'AIの作業フォルダーを選択してください'",
    "$dialog.ShowNewFolderButton = $true",
    "$owner.Show()",
    "$owner.Activate()",
    "$result = $dialog.ShowDialog($owner)",
    "$owner.Dispose()",
    "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { $bytes = [System.Text.Encoding]::Unicode.GetBytes($dialog.SelectedPath); [Console]::Out.Write([Convert]::ToBase64String($bytes)) }"
  ].join("; ");

  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-STA", "-WindowStyle", "Normal", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: false,
      shell: false
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error("folder_picker_timeout");
      error.status = 408;
      reject(error);
    }, 5 * 60 * 1000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const error = new Error(stderr.trim() || "folder_picker_failed");
        error.status = 500;
        reject(error);
        return;
      }
      const selected = decodeUtf16Base64(stdout);
      resolve(selected ? normalizeLocalFolderPath(selected) : "");
    });
  });
}

function assertWorkspaceReadyForWrite(project, dryRun = false) {
  if (!project || dryRun || project.workspaceReady) return;
  const error = new Error("workspace_folder_not_selected");
  error.status = 400;
  error.code = "workspace_folder_not_selected";
  throw error;
}

function isWorkspaceIgnored(name, rel = "") {
  if (WORKSPACE_IGNORE.has(name)) return true;
  if (String(name || "").startsWith(".nexa-backup-")) return true;
  const normalized = rel.replace(/\\/g, "/");
  if (normalized === "data" || normalized.startsWith("data/")) return true;
  if (normalized === "output" || normalized.startsWith("output/")) return true;
  if (normalized === ".playwright-cli" || normalized.startsWith(".playwright-cli/")) return true;
  if (normalized === "data/uploads" || normalized.startsWith("data/uploads/")) return true;
  if (normalized === "data/workspace-baseline.json") return true;
  if (normalized === "output/playwright" || normalized.startsWith("output/playwright/")) return true;
  return false;
}

function isTextFile(file) {
  const name = path.basename(file).toLowerCase();
  return TEXT_FILE_NAMES.has(name) || TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

async function ensureData() {
  await mkdir(WORKSPACE_ROOT, { recursive: true });
  await mkdir(PROJECTS_DIR, { recursive: true });
  await mkdir(UPLOADS_DIR, { recursive: true });
  await mkdir(GENERATED_IMAGES_DIR, { recursive: true });
  await mkdir(GENERATED_VIDEOS_DIR, { recursive: true });
  await mkdir(PLUGINS_DIR, { recursive: true });
  await writeAuthStore(await readAuthStore());
  await writeSocialOpsStore(await readSocialOpsStore());

  const indexFile = path.join(PROJECTS_DIR, "index.json");
  const index = await readJson(indexFile, null);
  if (!index) {
    const project = createProject("Nexa", "ローカルAIワークスペース");
    project.memory.facts.push("このアプリはプロジェクト単位で履歴と記憶を保持する。");
    await writeJson(projectFile(project.id), project);
    await writeJson(indexFile, { projects: [projectSummary(project)] });
  }

  const pluginFile = path.join(PLUGINS_DIR, "core-tools.json");
  try {
    await stat(pluginFile);
  } catch {
    await writeJson(pluginFile, {
      id: "core-tools",
      name: "Core Tools",
      version: "1.0.0",
      tools: [
        { id: "ollama.chat", name: "Ollama Chat", capability: "model" },
        { id: "web.search", name: "Web Search", capability: "network" },
        { id: "memory.project", name: "Project Memory", capability: "storage" },
        { id: "code.javascript", name: "JavaScript Runtime", capability: "execution" }
      ]
    });
  }

  try {
    await stat(MCP_CONFIG);
  } catch {
    await writeJson(MCP_CONFIG, {
      protocolVersion: "2025-11-25",
      servers: {
        filesystem: {
          enabled: false,
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", WORKSPACE_ROOT],
          transport: "stdio"
        }
      }
    });
  }
}

function createProject(name, goal = "") {
  const createdAt = now();
  const projectId = id("project");
  return {
    id: projectId,
    chatId: projectId,
    projectId,
    name: name || "Untitled Project",
    goal,
    summary: "",
    mode: "",
    accessLevel: "default",
    selectedFolderPath: "",
    selectedFolderName: "",
    projectType: "general",
    chats: [],
    workspaceRoot: "",
    workspaceReady: false,
    createdAt,
    updatedAt: createdAt,
    messages: [],
    files: [],
    generated: [],
    runs: [],
    pinnedContext: [],
    codex: {
      goal: { text: "", status: "idle", updatedAt: createdAt },
      permissions: "workspace-write",
      memories: { use: true, generate: true },
      reviewComments: [],
      approvals: []
    },
    memory: {
      facts: [],
      decisions: [],
      next: [],
      tasks: [],
      lastContinuation: ""
    }
  };
}

function blankMemoryText(text) {
  return /^(next|none|null|undefined|web\.search|tool|なし|特になし|n\/a)$/i.test(String(text || "").trim());
}

function taskText(value) {
  return clip(String(value || "").replace(/\s+/g, " ").trim(), 280);
}

function stableTaskId(text) {
  return `task_${hashText(taskText(text)).slice(0, 16)}`;
}

function createTask(text, status = "open", taskId = "") {
  const clean = taskText(text);
  if (!clean || blankMemoryText(clean)) return null;
  const stamp = now();
  return {
    id: taskId || id("task"),
    text: clean,
    status: status === "done" ? "done" : "open",
    createdAt: stamp,
    updatedAt: stamp
  };
}

function normalizeTask(value) {
  if (typeof value === "string") {
    return createTask(value, "open", stableTaskId(value));
  }
  const clean = taskText(value?.text || value?.title || value?.name || "");
  if (!clean || blankMemoryText(clean)) return null;
  const createdAt = String(value.createdAt || now());
  return {
    id: String(value.id || stableTaskId(clean)),
    text: clean,
    status: value.status === "done" ? "done" : "open",
    createdAt,
    updatedAt: String(value.updatedAt || createdAt)
  };
}

function syncNextFromTasks(project) {
  const memory = project.memory || {};
  const openTasks = (memory.tasks || [])
    .filter((task) => task.status !== "done")
    .map((task) => task.text);
  memory.next = mergeUnique([], openTasks, 18);
  project.memory = memory;
}

function normalizeProjectMemory(project) {
  const memory = project.memory || {};
  memory.facts = Array.isArray(memory.facts) ? mergeUnique([], memory.facts, 42) : [];
  memory.decisions = Array.isArray(memory.decisions) ? mergeUnique([], memory.decisions, 42) : [];
  memory.next = Array.isArray(memory.next) ? mergeUnique([], memory.next, 18) : [];
  memory.lastContinuation = String(memory.lastContinuation || "");

  const sourceTasks = Array.isArray(memory.tasks) && memory.tasks.length
    ? memory.tasks
    : memory.next.map((text) => createTask(text, "open", stableTaskId(text))).filter(Boolean);
  const seen = new Set();
  memory.tasks = sourceTasks
    .map(normalizeTask)
    .filter((task) => {
      if (!task) return false;
      const key = task.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 60);

  project.memory = memory;
  syncNextFromTasks(project);
  return memory;
}

function addProjectTasks(project, entries, status = "open") {
  const memory = normalizeProjectMemory(project);
  const seen = new Set((memory.tasks || []).map((task) => task.text.toLowerCase()));
  const created = [];
  for (const entry of entries || []) {
    const task = createTask(entry, status);
    if (!task) continue;
    const key = task.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    created.push(task);
  }
  if (created.length) {
    memory.tasks = [...created, ...memory.tasks].slice(0, 60);
    syncNextFromTasks(project);
  }
  return created;
}

function normalizeCodexState(project) {
  const createdAt = project.createdAt || now();
  const codex = project.codex || {};
  const goal = codex.goal || {};
  const memories = codex.memories || {};
  const allowedPermissions = new Set(["read-only", "workspace-write", "auto", "full-access", "danger-approval", "always-approval"]);
  const reviewComments = Array.isArray(codex.reviewComments) ? codex.reviewComments : [];
  const approvals = Array.isArray(codex.approvals) ? codex.approvals : [];
  project.codex = {
    goal: {
      text: String(goal.text || ""),
      status: ["active", "paused", "done", "idle"].includes(goal.status) ? goal.status : (goal.text ? "active" : "idle"),
      updatedAt: String(goal.updatedAt || createdAt)
    },
    permissions: allowedPermissions.has(codex.permissions) ? codex.permissions : codexPermissionForAccess(project.accessLevel),
    memories: {
      use: memories.use !== false,
      generate: memories.generate !== false
    },
    reviewComments: reviewComments
      .map((comment) => ({
        id: String(comment.id || id("review")),
        path: String(comment.path || ""),
        line: Number(comment.line || 0),
        body: String(comment.body || "").slice(0, 2000),
        status: comment.status === "resolved" ? "resolved" : "open",
        createdAt: String(comment.createdAt || createdAt)
      }))
      .filter((comment) => comment.path && comment.body)
      .slice(-120),
    approvals: approvals
      .map((approval) => ({
        id: String(approval.id || id("approval")),
        action: String(approval.action || "workspace"),
        command: String(approval.command || "").slice(0, 2000),
        path: String(approval.path || "").slice(0, 500),
        reason: String(approval.reason || "").slice(0, 1000),
        status: ["pending", "approved", "denied"].includes(approval.status) ? approval.status : "pending",
        createdAt: String(approval.createdAt || createdAt),
        resolvedAt: String(approval.resolvedAt || "")
      }))
      .slice(-80)
  };
  return project.codex;
}

function normalizePinnedContext(project) {
  const source = Array.isArray(project.pinnedContext) ? project.pinnedContext : [];
  const seen = new Set();
  project.pinnedContext = source
    .map((item) => {
      const rawPath = typeof item === "string" ? item : item?.path;
      if (!rawPath) return null;
      try {
        const absolute = project?.workspaceReady ? projectScopedWorkspacePath(project, rawPath) : workspacePath(rawPath);
        const rel = project?.workspaceReady ? projectRelativeWorkspacePath(project, absolute) : relativeWorkspacePath(absolute);
        if (!rel || isWorkspaceIgnored(path.basename(absolute), rel)) return null;
        return {
          id: String(item?.id || `pin_${hashText(rel).slice(0, 16)}`),
          path: rel,
          addedAt: String(item?.addedAt || now())
        };
      } catch {
        return null;
      }
    })
    .filter((item) => {
      if (!item || seen.has(item.path.toLowerCase())) return false;
      seen.add(item.path.toLowerCase());
      return true;
    })
    .slice(0, 24);
  return project.pinnedContext;
}

async function pinnedContextFromProject(project, manualPaths = new Set()) {
  const context = [];
  for (const pin of normalizePinnedContext(project)) {
    if (manualPaths.has(pin.path)) continue;
    try {
      const file = project?.workspaceReady ? projectScopedWorkspacePath(project, pin.path) : workspacePath(pin.path);
      const fileStat = await stat(file);
      if (!fileStat.isFile() || !isTextFile(file) || fileStat.size > 512 * 1024) continue;
      const content = await readFile(file, "utf8");
      context.push({
        id: id("pin"),
        name: `pin:${pin.path}`,
        path: relativeWorkspacePath(file),
        type: "text/x-pinned-workspace-context",
        source: "pin",
        size: fileStat.size,
        reason: "pinned",
        text: clip(content, 16000)
      });
    } catch {
      // Keep the pin but skip it for this run if the file is missing.
    }
  }
  return context;
}

async function pinWorkspaceFile(project, rel) {
  normalizePinnedContext(project);
  const file = project?.workspaceReady ? projectScopedWorkspacePath(project, rel) : workspacePath(rel);
  const relPath = project?.workspaceReady ? projectRelativeWorkspacePath(project, file) : relativeWorkspacePath(file);
  if (!relPath) throw new Error("workspace_file_required");
  if (isWorkspaceIgnored(path.basename(file), relPath)) throw new Error("workspace_file_ignored");
  const fileStat = await stat(file);
  if (!fileStat.isFile()) throw new Error("workspace_file_required");
  if (!isTextFile(file)) throw new Error("workspace_text_file_required");
  const existing = project.pinnedContext.find((item) => item.path === relPath);
  if (existing) return existing;
  const pin = {
    id: id("pin"),
    path: relPath,
    addedAt: now()
  };
  project.pinnedContext.unshift(pin);
  project.pinnedContext = project.pinnedContext.slice(0, 24);
  return pin;
}

function projectFile(projectId) {
  return path.join(PROJECTS_DIR, `${projectId}.json`);
}

function normalizeChatWorkspaceState(project) {
  project.chatId ||= project.id;
  project.projectId ||= project.id;
  project.mode = normalizeChatMode(project.mode);
  project.accessLevel = normalizeAccessLevel(project.accessLevel);
  project.selectedFolderPath = project.selectedFolderPath || project.workspaceRoot || "";
  project.selectedFolderName = project.selectedFolderName || folderNameFromWorkspace(project.selectedFolderPath);
  project.projectType = project.projectType || (project.workspaceReady || project.selectedFolderPath ? "folder" : "general");
  project.chats = Array.isArray(project.chats) ? project.chats : [];
  const codex = normalizeCodexState(project);
  codex.permissions = codex.permissions || codexPermissionForAccess(project.accessLevel);
  if (project.accessLevel) codex.permissions = codexPermissionForAccess(project.accessLevel);
  return project;
}

function projectSummary(project) {
  const memory = normalizeProjectMemory(project);
  normalizePinnedContext(project);
  const codex = normalizeCodexState(project);
  normalizeWorkspaceFolder(project);
  normalizeChatWorkspaceState(project);
  return {
    id: project.id,
    chatId: project.chatId || project.id,
    projectId: project.projectId || project.id,
    name: project.name,
    goal: project.goal,
    summary: project.summary,
    mode: project.mode || "",
    accessLevel: project.accessLevel || "default",
    selectedFolderPath: project.selectedFolderPath || project.workspaceRoot || "",
    selectedFolderName: project.selectedFolderName || folderNameFromWorkspace(project.workspaceRoot || ""),
    projectType: project.projectType || (project.workspaceReady ? "folder" : "general"),
    chats: Array.isArray(project.chats) ? project.chats : [],
    workspaceRoot: project.workspaceRoot || "",
    workspaceReady: Boolean(project.workspaceReady),
    updatedAt: project.updatedAt,
    messageCount: project.messages.length,
    fileCount: project.files.length,
    generatedCount: Array.isArray(project.generated) ? project.generated.length : 0,
    pinnedCount: project.pinnedContext.length,
    goalStatus: codex.goal.status,
    reviewCount: codex.reviewComments.filter((comment) => comment.status !== "resolved").length,
    permissionMode: codex.permissions,
    intelligence: intelligenceProfile(project),
    next: memory.next.slice(0, 3)
  };
}

async function listProjects() {
  const indexFile = path.join(PROJECTS_DIR, "index.json");
  const index = await readJson(indexFile, { projects: [] });
  index.projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return index.projects;
}

async function saveProject(project) {
  normalizeCodexState(project);
  normalizePinnedContext(project);
  normalizeProjectMemory(project);
  normalizeWorkspaceFolder(project);
  normalizeChatWorkspaceState(project);
  project.updatedAt = now();
  await writeJson(projectFile(project.id), project);
  const indexFile = path.join(PROJECTS_DIR, "index.json");
  const index = await readJson(indexFile, { projects: [] });
  const summary = projectSummary(project);
  const without = index.projects.filter((item) => item.id !== project.id);
  await writeJson(indexFile, { projects: [summary, ...without] });
}

async function deleteProject(projectId) {
  const project = await getProject(projectId);
  if (!project) return null;
  try {
    await unlink(projectFile(projectId));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const indexFile = path.join(PROJECTS_DIR, "index.json");
  const index = await readJson(indexFile, { projects: [] });
  await writeJson(indexFile, { projects: index.projects.filter((item) => item.id !== projectId) });
  return projectSummary(project);
}

async function getProject(projectId) {
  const project = await readJson(projectFile(projectId), null);
  if (!project) return null;
  project.messages ||= [];
  project.files ||= [];
  project.generated ||= [];
  project.runs ||= [];
  project.workspaceRoot ||= "";
  project.workspaceReady = Boolean(project.workspaceReady || project.workspaceRoot);
  normalizeCodexState(project);
  normalizePinnedContext(project);
  normalizeProjectMemory(project);
  normalizeWorkspaceFolder(project);
  normalizeChatWorkspaceState(project);
  return project;
}

async function getOllamaModels() {
  const controller = AbortSignal.timeout(4500);
  const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller });
  if (!response.ok) throw new Error(`ollama_${response.status}`);
  const data = await response.json();
  return Array.isArray(data.models) ? data.models : [];
}

let ollamaStartPromise = null;
let ollamaLastStartAttempt = 0;

function localOllamaExecutable() {
  const candidates = [
    process.env.OLLAMA_EXE,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "Ollama", "ollama.exe") : "",
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Ollama", "ollama.exe") : ""
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || "ollama";
}

async function ensureOllamaOnline() {
  try {
    await getOllamaModels();
    return true;
  } catch {
    // Continue to local startup only for the standard local endpoint.
  }
  let endpoint;
  try {
    endpoint = new URL(OLLAMA_URL);
  } catch {
    return false;
  }
  if (!["127.0.0.1", "localhost"].includes(endpoint.hostname)) return false;
  if (ollamaStartPromise) return ollamaStartPromise;
  if (Date.now() - ollamaLastStartAttempt < 30000) return false;
  ollamaLastStartAttempt = Date.now();
  ollamaStartPromise = (async () => {
    try {
      const child = spawn(localOllamaExecutable(), ["serve"], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: { ...process.env, OLLAMA_HOST: `${endpoint.hostname}:${endpoint.port || "11434"}` }
      });
      child.unref();
      for (let attempt = 0; attempt < 24; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          await getOllamaModels();
          return true;
        } catch {
          // Keep waiting while Ollama initializes.
        }
      }
      return false;
    } catch {
      return false;
    } finally {
      ollamaStartPromise = null;
    }
  })();
  return ollamaStartPromise;
}

function modelName(model) {
  return model?.name || model?.model || "";
}

function cloudModelId(model = "") {
  const clean = String(model || "").trim();
  return clean.startsWith("openai:") ? clean : `openai:${clean}`;
}

function isCloudChatModel(model = "") {
  return String(model || "").startsWith("openai:");
}

function cloudChatModelName(model = "") {
  return String(model || "").replace(/^openai:/, "").trim();
}

function openAiChatUrl(pathname = "/chat/completions") {
  return `${OPENAI_BASE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function cloudLlmProfile() {
  const enabled = Boolean(OPENAI_API_KEY && OPENAI_AUTO_ROUTE);
  return {
    enabled,
    provider: "cloud-compatible",
    baseUrl: enabled ? "configured" : "",
    conversation: enabled ? cloudModelId(OPENAI_CHAT_MODEL) : "",
    code: enabled ? cloudModelId(OPENAI_CODE_MODEL) : "",
    fast: "",
    models: enabled
      ? [
          { name: cloudModelId(OPENAI_CHAT_MODEL), model: OPENAI_CHAT_MODEL, capabilities: ["completion", "tools"], details: { family: "cloud-compatible" } },
          OPENAI_CODE_MODEL !== OPENAI_CHAT_MODEL
            ? { name: cloudModelId(OPENAI_CODE_MODEL), model: OPENAI_CODE_MODEL, capabilities: ["completion", "tools"], details: { family: "cloud-compatible" } }
            : null
        ].filter(Boolean)
      : [],
    note: enabled
      ? "High-quality cloud routing is available for Nexa2.0/Nexa2.5."
      : "クラウドAPIキーを設定すると高品質ルーティングを有効化できます。"
  };
}

function localPlanFromOllama(ollama = {}, specs = {}) {
  const models = Array.isArray(ollama.models) ? ollama.models : [];
  return {
    conversation: selectModel(models, "conversation", specs),
    code: selectModel(models, "code", specs),
    fast: selectModel(models, "fast", specs)
  };
}

function localFallbackForKind(system = {}, fallbackKind = "conversation") {
  const local = system.localPlan || {};
  if (fallbackKind === "code") return local.code || local.conversation || local.fast || null;
  if (fallbackKind === "fast") return local.fast || local.conversation || local.code || null;
  return local.conversation || local.fast || local.code || null;
}

function parseBillion(model) {
  const value = model?.details?.parameter_size || modelName(model);
  const match = String(value).match(/(\d+(?:\.\d+)?)\s*B/i);
  return match ? Number(match[1]) : 0;
}

function selectModel(models, kind, specs) {
  const completion = models.filter((model) => {
    const caps = model.capabilities || [];
    return caps.length === 0 || caps.includes("completion") || caps.includes("tools");
  });
  if (!completion.length) return null;

  const totalGb = specs.memoryGb || 8;
  const maxComfort = totalGb >= 32 ? 14 : totalGb >= 16 ? 8 : 4;
  const names = {
    code: ["coder", "code", "deepseek", "codellama", "qwen"],
    conversation: ["qwen", "llama", "gemma", "mistral"],
    fast: ["qwen", "llama", "gemma"]
  }[kind] || ["qwen", "llama", "gemma"];

  const scored = completion.map((model) => {
    const name = modelName(model).toLowerCase();
    const size = parseBillion(model);
    const family = String(model?.details?.family || "").toLowerCase();
    let score = 0;
    names.forEach((needle, index) => {
      if (name.includes(needle) || family.includes(needle)) score += 40 - index * 5;
    });
    if (kind === "fast") score += Math.max(0, 12 - size);
    if (kind !== "fast" && size > 0 && size <= maxComfort) score += size * 2;
    if (size > maxComfort + 2) score -= 30;
    if ((model.capabilities || []).includes("tools")) score += 8;
    if (kind === "conversation" && (model.capabilities || []).includes("thinking")) score += 4;
    if (name.includes("latest")) score += 1;
    return { model, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return modelName(scored[0].model);
}

function resolveRequestedModel(system, choice = "auto", fallbackKind = "conversation") {
  const plan = system?.plan || {};
  const installed = new Set([
    ...(system?.ollama?.models || []).map((model) => modelName(model)).filter(Boolean),
    ...(system?.cloud?.models || []).map((model) => modelName(model)).filter(Boolean)
  ]);
  const raw = String(choice || "auto").trim();
  if (!raw || raw === "auto") {
    return plan[fallbackKind] || plan.conversation || plan.fast || plan.code || null;
  }
  const nexaChoice = raw.toLowerCase();
  if (nexaChoice === "nexa-2.5") {
    return plan.code || plan.conversation || plan.fast || null;
  }
  if (nexaChoice === "nexa-3.0") {
    return fallbackKind === "code"
      ? (plan.code || plan.conversation || plan.fast || null)
      : (plan.conversation || plan.code || plan.fast || null);
  }
  if (nexaChoice === "nexa-2.0") {
    return plan.conversation || plan.code || plan.fast || null;
  }
  if (nexaChoice === "nexa-1.5") {
    return fallbackKind === "code"
      ? (plan.code || plan.conversation || plan.fast || null)
      : (plan.conversation || plan.fast || plan.code || null);
  }
  if (nexaChoice === "nexa-1.0") {
    return plan.fast || plan.conversation || plan.code || null;
  }
  if (raw === "conversation" || raw === "code" || raw === "fast") {
    return plan[raw] || plan[fallbackKind] || plan.conversation || plan.fast || null;
  }
  if (installed.has(raw) || isCloudChatModel(raw)) return raw;
  const loose = [...installed].find((name) => name.toLowerCase() === raw.toLowerCase());
  return loose || plan[fallbackKind] || plan.conversation || plan.fast || null;
}

function reasoningOptions(level = "medium") {
  const key = String(level || "medium").toLowerCase();
  return {
    low: { numPredict: 700, temperature: 0.28, complexityBoost: false },
    medium: { numPredict: 1100, temperature: 0.35, complexityBoost: false },
    high: { numPredict: 1800, temperature: 0.32, complexityBoost: true },
    "very-high": { numPredict: 2800, temperature: 0.28, complexityBoost: true }
  }[key] || { numPredict: 1400, temperature: 0.35, complexityBoost: true };
}

function roundLevel(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function countMemoryItems(project = null) {
  const memory = project ? normalizeProjectMemory(project) : {};
  return (
    (memory.facts || []).length +
    (memory.decisions || []).length +
    (memory.next || []).length +
    (memory.tasks || []).length
  );
}

function intelligenceProfile(project = null, system = {}) {
  const ollamaOnline = system?.ollama?.online !== false;
  const cloudReady = Boolean(system?.cloud?.enabled);
  const hasModelPlan = Boolean(system?.plan?.conversation || system?.plan?.code || system?.plan?.fast);
  const hasWorkspace = Boolean(project?.workspaceReady);
  const memoryCount = countMemoryItems(project);
  const runs = Array.isArray(project?.runs) ? project.runs : [];
  const hasSelfEvalRun = runs.some((run) => run?.intelligence?.qualityGate || run?.quality?.score);
  const hasDeepRun = runs.some((run) => run?.intelligence?.deepReasoning || run?.deepReasoning?.enabled);
  const hasPostWriteChecks = runs.some((run) => run?.type === "post-write-checks" || run?.type === "checks");
  let afterLevel = SMARTNESS_BASELINE.afterLevel;
  if (!ollamaOnline && !hasModelPlan) afterLevel -= 0.5;
  if (hasWorkspace) afterLevel += 0.1;
  if (memoryCount >= 8) afterLevel += 0.1;
  if (hasSelfEvalRun) afterLevel += 0.1;
  if (hasDeepRun) afterLevel += 0.1;
  if (hasPostWriteChecks) afterLevel += 0.1;
  if (cloudReady) afterLevel += 0.4;
  afterLevel = Math.min(SMARTNESS_BASELINE.maxHonestLevel, Math.max(4.8, afterLevel));

  const capabilities = [
    { id: "llm", label: "LLM", ready: ollamaOnline || hasModelPlan, note: hasModelPlan ? "auto model routing" : "fallback only" },
    { id: "cloudLlm", label: "Cloud LLM", ready: cloudReady, note: cloudReady ? "cloud-ready high-quality routing" : "optional cloud key not configured" },
    { id: "cloudFallback", label: "Cloud fallback", ready: true, note: "cloud failures fall back to local Ollama when available" },
    { id: "tools", label: "Tools", ready: true, note: "files, workspace, media, shell gates" },
    { id: "memory", label: "Memory", ready: memoryCount > 0, note: `${memoryCount} items` },
    { id: "memoryRetrieval", label: "Relevant memory", ready: true, note: "keyword-ranked project recall" },
    { id: "multiAgent", label: "Nexa team", ready: true, note: "Nexa internal workflow" },
    { id: "deepReasoning", label: "Deep reasoning", ready: true, note: "strategy + second opinion pass" },
    { id: "answerContract", label: "Answer contract", ready: true, note: "latest-request alignment + no hidden logs" },
    { id: "nexaQualityContract", label: "Nexa quality contract", ready: true, note: "intent recovery + honest self-correction" },
    { id: "answerBlueprint", label: "Answer blueprint", ready: true, note: "required final-answer coverage before generation" },
    { id: "choiceGate", label: "Choice gate", ready: true, note: "ambiguous prompts become selectable actions instead of final-answer questions" },
    { id: "selfEval", label: "Self evaluation", ready: true, note: "score + revise gate" },
    { id: "multiPassQuality", label: "Multi-pass quality", ready: true, note: "rubric, hallucination, contradiction checks" },
    { id: "codingContextMap", label: "Coding context map", ready: true, note: "framework, scripts, relevant files, and snapshots before Nexa writes" },
    { id: "postWriteChecks", label: "Post-write checks", ready: true, note: "syntax and project checks after direct code writes" },
    { id: "imageOnlyMedia", label: "Image-only media", ready: true, note: "video generation disabled honestly" },
    { id: "autonomy", label: "Autonomous task", ready: hasWorkspace, note: hasWorkspace ? "workspace actions enabled" : "needs folder for direct code work" },
    { id: "aiOs", label: "AI OS", ready: hasWorkspace, note: "local PC/workspace control with safety checks" }
  ];

  return {
    version: SMARTNESS_BASELINE.version,
    beforeLevel: SMARTNESS_BASELINE.beforeLevel,
    afterLevel: roundLevel(afterLevel),
    delta: roundLevel(afterLevel - SMARTNESS_BASELINE.beforeLevel),
    targetLevel: SMARTNESS_BASELINE.targetLevel,
    label: `Lv${roundLevel(afterLevel)}`,
    basis: "0-10 capability rubric: model routing, tools, relevant memory, multi-agent routing, deep reasoning, self-evaluation, autonomous workspace action, AI OS integration.",
    qualityGate: true,
    deepReasoning: true,
    nexaDeepWorkflow: true,
    caveat: "This is a system workflow score, not a claim that the local model itself equals every paid cloud model.",
    capabilities
  };
}

async function detectGpu() {
  if (process.platform !== "win32") return [];
  const command =
    "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress";
  return new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
      windowsHide: true
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("close", () => {
      try {
        const parsed = JSON.parse(stdout || "[]");
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch {
        resolve([]);
      }
    });
    child.on("error", () => resolve([]));
  });
}

async function systemProfile() {
  const cpus = os.cpus();
  const specs = {
    platform: os.platform(),
    arch: os.arch(),
    cpu: cpus[0]?.model || "Unknown CPU",
    cores: cpus.length,
    memoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    freeMemoryGb: Math.round((os.freemem() / 1024 ** 3) * 10) / 10,
    gpu: await detectGpu()
  };

  let ollama = { online: false, url: OLLAMA_URL, models: [], error: "" };
  try {
    ollama.models = await getOllamaModels();
    ollama.online = true;
  } catch (error) {
    const started = await ensureOllamaOnline();
    if (started) {
      try {
        ollama.models = await getOllamaModels();
        ollama.online = true;
      } catch (retryError) {
        ollama.error = retryError.message;
      }
    } else {
      ollama.error = error.message;
    }
  }

  const cloud = cloudLlmProfile();
  const localPlan = localPlanFromOllama(ollama, specs);
  const plan = {
    conversation: cloud.conversation || localPlan.conversation,
    code: cloud.code || localPlan.code,
    fast: localPlan.fast
  };

  return {
    specs,
    ollama,
    cloud,
    localPlan,
    plan,
    intelligence: intelligenceProfile(null, { specs, ollama, cloud, plan }),
    media: {
      imageOnly: IMAGE_GENERATION_ONLY,
      imageProvider: "local-cinematic-image",
      imageGenerator: "Nexa",
      disabledVideo: IMAGE_GENERATION_ONLY
    }
  };
}

function compactMessage(message) {
  return `${message.role}: ${clip(message.content, 650)}`;
}

function formatAttachments(attachments) {
  if (!attachments?.length) return "添付なし";
  return attachments
    .map((file) => {
      const isWorkspaceContext =
        file.type === "text/x-workspace-context" ||
        file.type === "text/x-auto-workspace-context" ||
        file.type === "text/x-pinned-workspace-context";
      const limit = isWorkspaceContext ? 8000 : 1800;
      const preview = file.text ? `\n${clip(file.text, limit)}` : "";
      const source = isWorkspaceContext && file.path ? `, workspace: ${file.path}` : "";
      const reason = file.reason ? `, reason: ${file.reason}` : "";
      return `- ${file.name} (${file.type || "unknown"}, ${file.size || 0} bytes${source}${reason})${preview}`;
    })
    .join("\n");
}

function formatWeb(results) {
  if (!results?.length) return "検索結果なし";
  return results
    .map((item, index) => `${index + 1}. ${item.title}\n${item.url}\n${clip(item.snippet, 420)}`)
    .join("\n");
}

function normalizeRunMode(value) {
  const mode = String(value || "agent").toLowerCase();
  return ["ask", "plan", "code", "review", "agent"].includes(mode) ? mode : "agent";
}

function modeInstruction(mode) {
  return {
    ask: "Ask mode: answer directly, keep tool use light, and avoid proposing code unless it is requested.",
    plan: "Plan mode: inspect context first, produce a concrete step-by-step plan, and avoid pretending changes were already made.",
    code: "Code mode: prioritize implementation-ready guidance, mention files and commands, and include unified diffs when helpful.",
    review: "Review mode: prioritize bugs, regressions, missing checks, and file/line grounded findings before summaries.",
    agent: "Agent mode: act as an autonomous coding agent, combine planning, implementation guidance, verification, and memory."
  }[mode] || "Agent mode: act as an autonomous coding agent.";
}

function buildContext(project, userText, attachments, webResults, plugins, mcp, mode = "agent", codexSnapshot = null) {
  const recent = project.messages.slice(-10).map(compactMessage).join("\n");
  const memory = normalizeProjectMemory(project);
  const taskLines = (memory.tasks || [])
    .slice(0, 24)
    .map((task) => `- [${task.status === "done" ? "done" : "open"}] ${task.text}`)
    .join("\n");
  return `
Project:
${project.name}
Goal: ${project.goal || "未設定"}
Summary: ${project.summary || "なし"}

Run mode:
${mode}
${modeInstruction(mode)}

Codex workspace state:
${codexContextText(codexSnapshot)}

Long-term memory:
Facts: ${(memory.facts || []).join(" / ") || "なし"}
Decisions: ${(memory.decisions || []).join(" / ") || "なし"}
Next: ${(memory.next || []).join(" / ") || "なし"}
Continuation hint: ${memory.lastContinuation || "なし"}

Project tasks:
${taskLines || "なし"}

Recent messages:
${recent || "なし"}

Current user request:
${userText}

Attachments:
${formatAttachments(attachments)}

Web results:
${formatWeb(webResults)}

Plugins:
${plugins.map((plugin) => `${plugin.name}: ${(plugin.tools || []).map((tool) => tool.id).join(", ")}`).join("\n") || "なし"}

MCP:
${mcp.servers.map((server) => `${server.name}: ${server.enabled ? "enabled" : "disabled"} (${server.transport})`).join("\n") || "なし"}
`.trim();
}

function stripThinking(text) {
  let clean = String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const danglingClose = clean.toLowerCase().lastIndexOf("</think>");
  if (danglingClose >= 0) clean = clean.slice(danglingClose + "</think>".length).trim();
  return clean;
}

function createThinkingFilter() {
  let inThink = false;
  return (chunk) => {
    let rest = String(chunk || "");
    let visible = "";
    while (rest) {
      if (inThink) {
        const end = rest.search(/<\/think>/i);
        if (end < 0) return "";
        rest = rest.slice(end).replace(/^<\/think>/i, "");
        inThink = false;
        continue;
      }
      const start = rest.search(/<think>/i);
      if (start < 0) {
        visible += rest;
        break;
      }
      visible += rest.slice(0, start);
      rest = rest.slice(start).replace(/^<think>/i, "");
      inThink = true;
    }
    return visible;
  };
}

function combinedAbortSignal(timeoutMs, signal = null) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeoutSignal;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([timeoutSignal, signal]);
  const controller = new AbortController();
  const abort = () => controller.abort();
  timeoutSignal.addEventListener("abort", abort, { once: true });
  signal.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

async function ollamaChat(model, messages, options = {}) {
  if (!model) throw new Error("no_model");
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      think: false,
      options: {
        temperature: options.temperature ?? 0.35,
        num_predict: options.numPredict ?? 650
      },
      keep_alive: "10m"
    }),
    signal: combinedAbortSignal(options.timeout ?? 90000, options.signal)
  });
  if (!response.ok) throw new Error(`ollama_chat_${response.status}`);
  const data = await response.json();
  return stripThinking(data.message?.content || data.response || "");
}

async function openAiChatCompletion(model, messages, options = {}) {
  const actualModel = cloudChatModelName(model);
  if (!OPENAI_API_KEY) throw new Error("openai_api_key_missing");
  if (!actualModel) throw new Error("openai_model_missing");
  const response = await fetch(openAiChatUrl("/chat/completions"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: actualModel,
      messages,
      stream: false,
      temperature: options.temperature ?? 0.35,
      max_tokens: options.numPredict ?? 900
    }),
    signal: combinedAbortSignal(options.timeout ?? 120000, options.signal)
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`openai_chat_${response.status}${errorText ? `:${clip(errorText, 240)}` : ""}`);
  }
  const data = await response.json();
  return stripThinking(data.choices?.[0]?.message?.content || data.output_text || "");
}

async function llmChat(model, messages, options = {}) {
  if (!isCloudChatModel(model)) return ollamaChat(model, messages, options);
  try {
    return await openAiChatCompletion(model, messages, options);
  } catch (error) {
    const fallbackModel = options.fallbackModel;
    if (fallbackModel && !isCloudChatModel(fallbackModel)) {
      options.onFallback?.(error, fallbackModel, model);
      return await ollamaChat(fallbackModel, messages, { ...options, fallbackModel: "" });
    }
    throw error;
  }
}

async function* ollamaChatStream(model, messages, options = {}) {
  if (!model) throw new Error("no_model");
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      think: false,
      options: {
        temperature: options.temperature ?? 0.45,
        num_predict: options.numPredict ?? 1400
      },
      keep_alive: "10m"
    }),
    signal: combinedAbortSignal(options.timeout ?? 140000, options.signal)
  });
  if (!response.ok || !response.body) throw new Error(`ollama_stream_${response.status}`);
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;
      const packet = JSON.parse(line);
      const content = packet.message?.content || packet.response || "";
      if (content) yield content;
      if (packet.done) return;
    }
  }
}

async function* openAiChatCompletionStream(model, messages, options = {}) {
  const actualModel = cloudChatModelName(model);
  if (!OPENAI_API_KEY) throw new Error("openai_api_key_missing");
  if (!actualModel) throw new Error("openai_model_missing");
  const response = await fetch(openAiChatUrl("/chat/completions"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: actualModel,
      messages,
      stream: true,
      temperature: options.temperature ?? 0.35,
      max_tokens: options.numPredict ?? 1400
    }),
    signal: combinedAbortSignal(options.timeout ?? 180000, options.signal)
  });
  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`openai_stream_${response.status}${errorText ? `:${clip(errorText, 240)}` : ""}`);
  }
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
      for (const rawLine of frame.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const dataText = line.slice(5).trim();
        if (!dataText || dataText === "[DONE]") return;
        try {
          const packet = JSON.parse(dataText);
          const content = packet.choices?.[0]?.delta?.content || packet.choices?.[0]?.message?.content || "";
          if (content) yield content;
        } catch {
          // Ignore malformed SSE keepalive frames.
        }
      }
    }
  }
}

async function* llmChatStream(model, messages, options = {}) {
  if (isCloudChatModel(model)) {
    try {
      yield* openAiChatCompletionStream(model, messages, options);
    } catch (error) {
      const fallbackModel = options.fallbackModel;
      if (fallbackModel && !isCloudChatModel(fallbackModel)) {
        options.onFallback?.(error, fallbackModel, model);
        yield* ollamaChatStream(fallbackModel, messages, { ...options, fallbackModel: "" });
        return;
      }
      throw error;
    }
    return;
  }
  yield* ollamaChatStream(model, messages, options);
}

async function runAgent(agent, context, system, plan, send) {
  const model = plan[agent.kind] || plan.conversation || plan.fast;
  const displayName = agentBrandName(agent.id);
  send("agent", {
    id: agent.id,
    name: displayName,
    title: displayName,
    color: agent.color,
    model: publicModelName(model || "local-fallback"),
    status: "running",
    startedAt: now()
  });

  try {
    let output;
    if (model) {
      output = await llmChat(model, [
        { role: "system", content: `${agent.system}\n${system}` },
        { role: "user", content: context }
      ], {
        numPredict: agent.id === "memory" ? 220 : 380,
        temperature: agent.id === "memory" ? 0.1 : 0.32
      });
    } else {
      output = fallbackAgent(agent, context);
    }
    output = sanitizeNexaVisibleText(output);
    send("agent", {
      id: agent.id,
      name: displayName,
      title: displayName,
      color: agent.color,
      model: publicModelName(model || "local-fallback"),
      status: "complete",
      output: sanitizeNexaVisibleText(clip(output, 2200)),
      completedAt: now()
    });
    return { agent, model, output };
  } catch (error) {
    const output = sanitizeNexaVisibleText(fallbackAgent(agent, context));
    send("agent", {
      id: agent.id,
      name: displayName,
      title: displayName,
      color: agent.color,
      model: publicModelName(model || "local-fallback"),
      status: "fallback",
      output,
      error: error.message,
      completedAt: now()
    });
    return { agent, model, output, error: error.message };
  }
}

function fallbackAgent(agent, context) {
  const request = (context.match(/Current user request:\n([\s\S]*?)\n\nAttachments:/) || [])[1] || "";
  if (agent.id === "memory") {
    return JSON.stringify({
      facts: [],
      decisions: [],
      next: [clip(request, 120)],
      summary: clip(request, 180)
    });
  }
  return `Nexa: ${clip(request, 260)} をプロジェクト履歴、添付、ツール状況に沿って処理します。Ollamaモデルが利用できない場合でも、このローカルワークスペースに記録して続きから再開できます。`;
}

function finalPrompt(context, outputs, mode = "agent") {
  return `
あなたはユーザーの作業を手伝う最終応答AIです。以下の複数AIの判断を統合し、ユーザーに直接返す最終回答を日本語で作成してください。

条件:
- 具体的で実行可能にする
- 役割別AIの内部会議ログを長く見せない
- 自己紹介や「あなたは誰？」に答えるときは内部構造名で名乗らず、作業を手伝うAIアシスタントとして自然に答える
- コードやコマンドが必要なら最小限のブロックで出す
- 不明点は断定しない
- 「前回の続きをやって」に対応するため、次に残すべき状態も自然に反映する
- 通常会話は3から8文程度に収める。ユーザーが短くと言った場合は2文以内
- 思考過程、分析ログ、下書き、"Let me" などの前置きを絶対に出さない

現在のCodexモード:
${mode}
${modeInstruction(mode)}

Context:
${context}

Agent outputs:
${outputs.map((item) => `## Nexa\n${sanitizeNexaVisibleText(item.output)}`).join("\n\n")}
`.trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function webSearch(query, limit = 5) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Nexa/1.0 (+local research assistant)"
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`search_${response.status}`);
  const html = await response.text();
  const results = [];
  const pattern =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = pattern.exec(html)) && results.length < limit) {
    const rawUrl = decodeHtml(match[1]);
    let cleanUrl = rawUrl;
    try {
      const parsed = new URL(rawUrl);
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) cleanUrl = decodeURIComponent(uddg);
    } catch {
      // keep raw URL
    }
    results.push({
      title: decodeHtml(match[2]),
      url: cleanUrl,
      snippet: decodeHtml(match[3])
    });
  }
  return results;
}

async function loadPlugins() {
  await mkdir(PLUGINS_DIR, { recursive: true });
  const files = await readdir(PLUGINS_DIR);
  const plugins = [];
  for (const file of files.filter((item) => item.endsWith(".json"))) {
    const plugin = await readJson(path.join(PLUGINS_DIR, file), null);
    if (plugin?.id) plugins.push(plugin);
  }
  return plugins;
}

function encodeMcpFrame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function readMcpFrames(buffer) {
  const frames = [];
  let rest = buffer;
  while (rest.length) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    if (headerEnd < 0) break;
    const header = rest.slice(0, headerEnd).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      rest = rest.slice(headerEnd + 4);
      continue;
    }
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (rest.length < bodyEnd) break;
    const body = rest.slice(bodyStart, bodyEnd).toString("utf8");
    frames.push(JSON.parse(body));
    rest = rest.slice(bodyEnd);
  }
  return { frames, rest };
}

async function probeMcpTools(server, protocolVersion) {
  if (server.transport && server.transport !== "stdio") {
    return { status: "unsupported", tools: [], error: "Only stdio transport is supported." };
  }
  if (!server.command) {
    return { status: "missing-command", tools: [], error: "No command configured." };
  }

  return new Promise((resolve) => {
    const child = spawn(server.command, server.args || [], {
      cwd: server.cwd || ROOT,
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let buffer = Buffer.alloc(0);
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {
        // process may already be gone
      }
      resolve(payload);
    };
    const send = (message) => child.stdin.write(encodeMcpFrame(message));
    const timer = setTimeout(
      () => finish({ status: "timeout", tools: [], error: "MCP probe timed out." }),
      6500
    );

    child.on("error", (error) => finish({ status: "error", tools: [], error: error.message }));
    child.stderr.on("data", () => {});
    child.stdout.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      let parsed;
      try {
        parsed = readMcpFrames(buffer);
      } catch (error) {
        finish({ status: "error", tools: [], error: error.message });
        return;
      }
      buffer = parsed.rest;
      for (const frame of parsed.frames) {
        if (frame.id === 1) {
          send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
          send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
        }
        if (frame.id === 2) {
          finish({ status: "ready", tools: frame.result?.tools || [], error: "" });
        }
      }
    });

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: "Nexa", version: "1.0.0" }
      }
    });
  });
}

async function loadMcp({ probe = false } = {}) {
  const config = await readJson(MCP_CONFIG, { protocolVersion: "2025-11-25", servers: {} });
  const protocolVersion = config.protocolVersion || "2025-11-25";
  const servers = [];
  for (const [name, server] of Object.entries(config.servers || {})) {
    const item = {
      name,
      enabled: Boolean(server.enabled),
      command: server.command,
      args: server.args || [],
      transport: server.transport || "stdio",
      protocolVersion,
      status: server.enabled ? "configured" : "disabled",
      tools: []
    };
    if (probe && item.enabled) {
      const probeResult = await probeMcpTools(server, protocolVersion);
      item.status = probeResult.status;
      item.tools = probeResult.tools;
      item.error = probeResult.error || "";
    }
    servers.push(item);
  }
  return { protocolVersion: config.protocolVersion || "2025-11-25", servers };
}

async function safeReadText(file, limit = 64 * 1024) {
  try {
    const content = await readFile(file, "utf8");
    return content.slice(0, limit);
  } catch {
    return "";
  }
}

function parseFrontMatter(text = "") {
  const match = String(text).replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const meta = {};
  if (!match) return meta;
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    meta[pair[1]] = pair[2].replace(/^["']|["']$/g, "").trim();
  }
  return meta;
}

async function scanInstructionFiles() {
  const names = new Set(["AGENTS.override.md", "AGENTS.md"]);
  const found = [];
  async function walk(dir, depth = 0) {
    if (depth > 4 || found.length >= 24) return;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      const rel = relativeWorkspacePath(absolute);
      if (isWorkspaceIgnored(entry.name, rel)) continue;
      if (entry.isFile() && names.has(entry.name)) {
        const content = await safeReadText(absolute, 32 * 1024);
        found.push({
          path: rel,
          name: entry.name,
          size: Buffer.byteLength(content, "utf8"),
          content: clip(content, 12000)
        });
      }
      if (entry.isDirectory()) await walk(absolute, depth + 1);
    }
  }
  await walk(WORKSPACE_ROOT);
  found.sort((a, b) => a.path.localeCompare(b.path));
  return found;
}

async function scanSkillDir(baseDir, scope, max = 48) {
  const skills = [];
  async function walk(dir, depth = 0) {
    if (depth > 4 || skills.length >= max) return;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute, depth + 1);
        continue;
      }
      if (entry.name !== "SKILL.md") continue;
      const content = await safeReadText(absolute, 24 * 1024);
      const meta = parseFrontMatter(content);
      skills.push({
        scope,
        name: meta.name || path.basename(path.dirname(absolute)),
        description: meta.description || "",
        path: absolute.startsWith(WORKSPACE_ROOT)
          ? relativeWorkspacePath(absolute)
          : absolute.startsWith(ROOT)
            ? path.relative(ROOT, absolute).replace(/\\/g, "/")
            : absolute,
        enabled: true
      });
    }
  }
  await walk(baseDir);
  return skills;
}

async function scanSkills() {
  const repo = await scanSkillDir(path.join(ROOT, ".agents", "skills"), "repo");
  const user = await scanSkillDir(path.join(os.homedir(), ".codex", "skills"), "user", 36);
  return [...repo, ...user].slice(0, 80);
}

async function scanHooks() {
  const hooksFile = path.join(ROOT, ".codex", "hooks.json");
  const configFile = path.join(ROOT, ".codex", "config.toml");
  const hooksText = await safeReadText(hooksFile, 128 * 1024);
  const configText = await safeReadText(configFile, 64 * 1024);
  let hooks = {};
  let parseError = "";
  if (hooksText) {
    try {
      hooks = JSON.parse(hooksText).hooks || {};
    } catch (error) {
      parseError = error.message;
    }
  }
  const events = Object.entries(hooks).map(([event, groups]) => ({
    event,
    groups: Array.isArray(groups) ? groups.length : 0,
    handlers: Array.isArray(groups)
      ? groups.reduce((count, group) => count + (Array.isArray(group.hooks) ? group.hooks.length : 0), 0)
      : 0
  }));
  return {
    files: [
      hooksText ? { path: ".codex/hooks.json", size: Buffer.byteLength(hooksText, "utf8"), parseError } : null,
      configText ? { path: ".codex/config.toml", size: Buffer.byteLength(configText, "utf8") } : null
    ].filter(Boolean),
    events,
    raw: clip(hooksText || configText || "", 12000)
  };
}

async function gitStatusSummary() {
  const result = await runShellCommand("git status --short --branch", 6000);
  const available = result.exitCode === 0;
  return {
    available,
    exitCode: result.exitCode,
    summary: available ? result.stdout.trim() : "Not a Git repository",
    error: available ? "" : (result.stderr || result.stdout || "").trim()
  };
}

async function workspaceCodexState(project = null) {
  const instructions = await scanInstructionFiles();
  const skills = await scanSkills();
  const hooks = await scanHooks();
  const changes = await workspaceChanges();
  const git = await gitStatusSummary();
  const codex = project ? normalizeCodexState(project) : null;
  return {
    codex,
    capabilities: permissionCapabilities(project),
    instructions,
    skills,
    hooks,
    changes: {
      baselineAt: changes.baselineAt,
      count: changes.changes?.length || 0,
      files: (changes.changes || []).map((item) => ({ path: item.path, status: item.status }))
    },
    git,
    generatedAt: now()
  };
}

function codexContextText(snapshot) {
  if (!snapshot) return "なし";
  const codex = snapshot.codex || {};
  const goal = codex.goal?.text ? `${codex.goal.status}: ${codex.goal.text}` : "なし";
  const instructions = (snapshot.instructions || [])
    .map((file) => `## ${file.path}\n${clip(file.content, 4000)}`)
    .join("\n\n");
  const comments = (codex.reviewComments || [])
    .filter((comment) => comment.status !== "resolved")
    .map((comment) => `- ${comment.path}${comment.line ? `:${comment.line}` : ""}: ${comment.body}`)
    .join("\n");
  const skills = (snapshot.skills || [])
    .slice(0, 18)
    .map((skill) => `$${skill.name}: ${skill.description}`)
    .join("\n");
  return `
Goal: ${goal}
Permissions: ${codex.permissions || "workspace-write"}
Memories: use=${codex.memories?.use !== false}, generate=${codex.memories?.generate !== false}
Open review comments:
${comments || "なし"}
Instruction files:
${instructions || "なし"}
Available skills:
${skills || "なし"}
Hooks: ${(snapshot.hooks?.events || []).map((item) => `${item.event}(${item.handlers})`).join(", ") || "なし"}
Git: ${snapshot.git?.summary || "なし"}
`.trim();
}

async function initAgentsFile() {
  const file = workspacePath("AGENTS.md");
  try {
    await stat(file);
    const existing = await safeReadText(file, 64 * 1024);
    return { created: false, path: "AGENTS.md", content: existing };
  } catch {
    const content = `# AGENTS.md

## Project Expectations

- Use the existing local patterns before adding new abstractions.
- Keep UI changes responsive and verify them in a browser.
- Run \`node --check server.mjs\` and \`node --check public/app.js\` after JavaScript changes.
- Keep project memory clean: do not leave test chats, runs, pins, or temporary artifacts.

## Review Guidelines

- Prioritize functional regressions, security risks, data loss, broken persistence, and missing verification.
- Reference concrete files and commands when reporting issues.
`;
    await writeFile(file, content, "utf8");
    return { created: true, path: "AGENTS.md", content };
  }
}

function updateCodexConfig(project, patch = {}) {
  const codex = normalizeCodexState(project);
  if (patch.goal) {
    const text = "text" in patch.goal ? String(patch.goal.text || "").slice(0, 4000) : codex.goal.text;
    const status = ["active", "paused", "done", "idle"].includes(patch.goal.status)
      ? patch.goal.status
      : (text ? codex.goal.status : "idle");
    codex.goal = { text, status: text ? status : "idle", updatedAt: now() };
  }
  if (patch.permissions) {
    const allowed = new Set(["read-only", "workspace-write", "auto", "full-access", "danger-approval", "always-approval"]);
    if (allowed.has(patch.permissions)) codex.permissions = patch.permissions;
  }
  if (patch.memories) {
    codex.memories = {
      use: patch.memories.use !== undefined ? Boolean(patch.memories.use) : codex.memories.use,
      generate: patch.memories.generate !== undefined ? Boolean(patch.memories.generate) : codex.memories.generate
    };
  }
  return codex;
}

function addReviewComment(project, body = {}) {
  const codex = normalizeCodexState(project);
  const comment = {
    id: id("review"),
    path: String(body.path || "").slice(0, 500),
    line: Number(body.line || 0),
    body: String(body.body || "").trim().slice(0, 2000),
    status: "open",
    createdAt: now()
  };
  if (!comment.path || !comment.body) throw new Error("review_comment_required");
  codex.reviewComments.push(comment);
  codex.reviewComments = codex.reviewComments.slice(-120);
  return comment;
}

function permissionCapabilities(project = null) {
  const permissions = project ? normalizeCodexState(project).permissions : "workspace-write";
  const readOnly = permissions === "read-only";
  const fullAccess = permissions === "full-access";
  const alwaysApproval = permissions === "always-approval" || permissions === "auto";
  const dangerApproval = permissions === "danger-approval" || permissions === "workspace-write";
  return {
    permissions,
    canReadWorkspace: true,
    canWriteWorkspace: !readOnly,
    canApplyPatch: !readOnly,
    canRunShell: !readOnly,
    canRunChecks: !readOnly,
    canCreateAgentsFile: !readOnly,
    canControlComputer: fullAccess,
    canUseInternet: !readOnly,
    canReadAllFiles: fullAccess,
    canWriteAllFiles: fullAccess,
    approvalPolicy: fullAccess ? "never" : alwaysApproval ? "always" : dangerApproval ? "dangerous-only" : "always",
    hardSafetyGuard: !fullAccess
  };
}

function permissionError(code, message) {
  const error = new Error(message || code);
  error.status = 403;
  error.code = code;
  return error;
}

function assertCodexPermission(project, action, detail = {}) {
  const capabilities = permissionCapabilities(project);
  if (action === "write" && !capabilities.canWriteWorkspace) {
    throw permissionError("permission_read_only", "read-only mode blocks workspace writes");
  }
  if (action === "patch" && !detail.dryRun && !capabilities.canApplyPatch) {
    throw permissionError("permission_read_only", "read-only mode allows patch previews but blocks applying patches");
  }
  if (action === "shell" && !capabilities.canRunShell) {
    throw permissionError("permission_read_only", "read-only mode blocks shell execution");
  }
  if (action === "checks" && !capabilities.canRunChecks) {
    throw permissionError("permission_read_only", "read-only mode blocks running checks");
  }
  if (action === "agents-init" && !capabilities.canCreateAgentsFile) {
    throw permissionError("permission_read_only", "read-only mode blocks creating AGENTS.md");
  }
  return capabilities;
}

function assertShellSafety(project, command, action = "shell", approved = false) {
  const capabilities = assertCodexPermission(project, action);
  if (capabilities.hardSafetyGuard && isDangerousShellCommand(command) && !approved) {
    const error = new Error("command_blocked_by_safety_guard");
    error.status = 400;
    error.code = "command_blocked_by_safety_guard";
    throw error;
  }
}

function assertOperationApproval(project, operation, { dangerous = false, approved = false } = {}) {
  const capabilities = permissionCapabilities(project);
  const needsApproval = capabilities.approvalPolicy === "always" ||
    (capabilities.approvalPolicy === "dangerous-only" && dangerous);
  if (needsApproval && !approved) {
    throw permissionError("approval_required", `${operation} requires user approval in ${capabilities.approvalPolicy} mode`);
  }
  return capabilities;
}

async function workspaceTree(rel = "", depth = 2, limit = 260) {
  const rootPath = workspacePath(rel);
  const rootStat = await stat(rootPath);
  if (!rootStat.isDirectory()) throw new Error("workspace_tree_requires_directory");
  let remaining = limit;

  async function walk(dir, level) {
    const entries = await readdir(dir, { withFileTypes: true });
    const nodes = [];
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
      if (remaining <= 0) break;
      const absolute = path.join(dir, entry.name);
      const nodeRel = relativeWorkspacePath(absolute);
      if (isWorkspaceIgnored(entry.name, nodeRel)) continue;
      remaining -= 1;
      if (entry.isDirectory()) {
        const node = {
          name: entry.name,
          path: nodeRel,
          type: "directory",
          children: level < depth ? await walk(absolute, level + 1) : []
        };
        nodes.push(node);
      } else {
        const fileStat = await stat(absolute);
        nodes.push({
          name: entry.name,
          path: nodeRel,
          type: "file",
          size: fileStat.size,
          text: isTextFile(absolute)
        });
      }
    }
    return nodes;
  }

  return {
    root: relativeWorkspacePath(rootPath),
    nodes: await walk(rootPath, 0),
    truncated: remaining <= 0
  };
}

async function workspaceFile(rel, project = null) {
  const file = project ? projectScopedWorkspacePath(project, rel) : workspacePath(rel);
  const fileStat = await stat(file);
  if (!fileStat.isFile()) throw new Error("workspace_file_required");
  const relPath = project ? projectRelativeWorkspacePath(project, file) : relativeWorkspacePath(file);
  if (!isTextFile(file)) {
    return {
      path: relPath,
      size: fileStat.size,
      text: false,
      hash: "",
      content: ""
    };
  }
  if (fileStat.size > 1024 * 1024) throw new Error("workspace_file_too_large");
  const content = await readFile(file, "utf8");
  return {
    path: relPath,
    size: fileStat.size,
    text: true,
    hash: hashText(content),
    content
  };
}

async function writeWorkspaceFile(body) {
  const rel = String(body.path || "");
  const content = String(body.content ?? "");
  const project = body.projectId ? await getProject(body.projectId) : null;
  if (!rel.trim()) throw new Error("workspace_path_required");
  if (Buffer.byteLength(content, "utf8") > 1024 * 1024) throw new Error("workspace_file_too_large");
  if (body.projectId && !project) {
    const error = new Error("project_not_found");
    error.status = 404;
    throw error;
  }
  assertCodexPermission(project, "write");
  assertOperationApproval(project, "file-write", { dangerous: false, approved: body.approved === true });
  assertWorkspaceReadyForWrite(project);

  const file = projectScopedWorkspacePath(project, rel);
  const relPath = projectRelativeWorkspacePath(project, file);
  if (!relPath) throw new Error("workspace_file_required");
  if (isWorkspaceIgnored(path.basename(file), relPath)) throw new Error("workspace_file_ignored");
  if (!isTextFile(file)) throw new Error("workspace_text_file_required");

  let existing = "";
  try {
    const fileStat = await stat(file);
    if (!fileStat.isFile()) throw new Error("workspace_file_required");
    if (fileStat.size > 1024 * 1024) throw new Error("workspace_file_too_large");
    existing = await readFile(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const expectedHash = String(body.hash || "");
  const currentHash = hashText(existing);
  if (expectedHash && expectedHash !== currentHash) {
    const conflict = new Error("workspace_file_changed");
    conflict.status = 409;
    conflict.currentHash = currentHash;
    throw conflict;
  }

  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, file);
  return workspaceFile(normalizeAccessLevel(project?.accessLevel) === "full" && isAbsoluteLocalPath(rel) ? rel : relPath, project);
}

function patchPath(value) {
  const raw = String(value || "").trim().split(/\s+/)[0];
  if (!raw || raw === "/dev/null") return "";
  return raw.replace(/^[ab]\//, "").replace(/^\.?\//, "");
}

function parseUnifiedPatch(patchText) {
  const lines = String(patchText || "").replace(/\r\n?/g, "\n").split("\n");
  const files = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].startsWith("--- ")) {
      index += 1;
      continue;
    }

    const oldPath = patchPath(lines[index].slice(4));
    index += 1;
    if (!lines[index]?.startsWith("+++ ")) throw new Error("workspace_patch_bad_header");
    const newPath = patchPath(lines[index].slice(4));
    index += 1;

    const file = {
      oldPath,
      newPath,
      path: newPath || oldPath,
      hunks: []
    };
    if (!file.path) throw new Error("workspace_patch_path_required");

    while (index < lines.length) {
      if (lines[index].startsWith("diff --git ")) {
        index += 1;
        continue;
      }
      if (lines[index].startsWith("--- ")) break;
      if (!lines[index].startsWith("@@ ")) {
        index += 1;
        continue;
      }

      const match = lines[index].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (!match) throw new Error("workspace_patch_bad_hunk");
      const hunk = {
        oldStart: Number(match[1]),
        oldCount: Number(match[2] || 1),
        newStart: Number(match[3]),
        newCount: Number(match[4] || 1),
        lines: []
      };
      index += 1;

      while (index < lines.length) {
        const line = lines[index];
        if (line.startsWith("@@ ") || line.startsWith("--- ") || line.startsWith("diff --git ")) break;
        if (line.startsWith("\\ No newline")) {
          index += 1;
          continue;
        }
        if (line === "" && index === lines.length - 1) {
          index += 1;
          break;
        }
        const type = line[0];
        if (![" ", "-", "+"].includes(type)) break;
        hunk.lines.push({ type, text: line.slice(1) });
        index += 1;
      }
      file.hunks.push(hunk);
    }

    if (file.hunks.length) files.push(file);
  }

  if (!files.length) throw new Error("workspace_patch_empty");
  return files;
}

function splitTextLines(text) {
  const normalized = String(text || "").replace(/\r\n?/g, "\n");
  const finalNewline = normalized.endsWith("\n");
  const lines = normalized ? normalized.split("\n") : [];
  if (finalNewline) lines.pop();
  return { lines, finalNewline };
}

function joinTextLines(lines, finalNewline) {
  return `${lines.join("\n")}${finalNewline ? "\n" : ""}`;
}

function applyHunksToText(originalText, filePatch) {
  const { lines: original, finalNewline } = splitTextLines(originalText);
  const output = [];
  let cursor = 0;

  for (const hunk of filePatch.hunks) {
    const start = Math.max(0, hunk.oldStart - 1);
    if (start < cursor) throw new Error("workspace_patch_overlapping_hunk");
    output.push(...original.slice(cursor, start));
    let oldIndex = start;

    for (const line of hunk.lines) {
      if (line.type === " ") {
        if (original[oldIndex] !== line.text) throw new Error("workspace_patch_context_mismatch");
        output.push(original[oldIndex]);
        oldIndex += 1;
      } else if (line.type === "-") {
        if (original[oldIndex] !== line.text) throw new Error("workspace_patch_context_mismatch");
        oldIndex += 1;
      } else if (line.type === "+") {
        output.push(line.text);
      }
    }

    cursor = oldIndex;
  }

  output.push(...original.slice(cursor));
  return joinTextLines(output, finalNewline || filePatch.hunks.some((hunk) => hunk.lines.some((line) => line.type === "+")));
}

async function workspacePatch(body) {
  const patch = String(body.patch || "");
  const dryRun = body.dryRun !== false;
  const project = body.projectId ? await getProject(body.projectId) : null;
  if (!patch.trim()) throw new Error("workspace_patch_required");
  if (Buffer.byteLength(patch, "utf8") > 512 * 1024) throw new Error("workspace_patch_too_large");
  if (body.projectId && !project) {
    const error = new Error("project_not_found");
    error.status = 404;
    throw error;
  }
  assertCodexPermission(project, "patch", { dryRun });
  if (!dryRun) {
    assertOperationApproval(project, "file-patch", {
      dangerous: /\+\+\+\s+\/dev\/null|deleted file mode/i.test(patch),
      approved: body.approved === true
    });
  }
  assertWorkspaceReadyForWrite(project, dryRun);

  const parsed = parseUnifiedPatch(patch);
  const writes = [];
  const files = [];

  for (const filePatch of parsed) {
    const file = projectScopedWorkspacePath(project, filePatch.path);
    const relPath = projectRelativeWorkspacePath(project, file);
    if (!relPath) throw new Error("workspace_file_required");
    if (isWorkspaceIgnored(path.basename(file), relPath)) throw new Error("workspace_file_ignored");
    if (!isTextFile(file)) throw new Error("workspace_text_file_required");

    let before = "";
    let exists = false;
    try {
      const fileStat = await stat(file);
      if (!fileStat.isFile()) throw new Error("workspace_file_required");
      if (fileStat.size > 1024 * 1024) throw new Error("workspace_file_too_large");
      before = await readFile(file, "utf8");
      exists = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    if (!exists && filePatch.oldPath) throw new Error("workspace_patch_missing_file");
    if (exists && !filePatch.oldPath) throw new Error("workspace_patch_file_exists");

    if (!filePatch.newPath) {
      files.push({
        path: relPath,
        status: "deleted",
        beforeHash: hashText(before),
        afterHash: "",
        beforeSize: Buffer.byteLength(before, "utf8"),
        afterSize: 0,
        changedLines: before.split("\n").length,
        diff: compactDiff(before, "")
      });
      writes.push({ file, delete: true });
      continue;
    }

    const after = applyHunksToText(before, filePatch);
    const status = exists ? "modified" : "added";
    const result = {
      path: relPath,
      status,
      beforeHash: exists ? hashText(before) : "",
      afterHash: hashText(after),
      beforeSize: Buffer.byteLength(before, "utf8"),
      afterSize: Buffer.byteLength(after, "utf8"),
      changedLines: filePatch.hunks.reduce(
        (count, hunk) => count + hunk.lines.filter((line) => line.type === "+" || line.type === "-").length,
        0
      ),
      diff: compactDiff(before, after)
    };
    files.push(result);
    writes.push({ file, content: after });
  }

  if (!dryRun) {
    for (const write of writes) {
      if (write.delete) {
        await unlink(write.file);
        continue;
      }
      await mkdir(path.dirname(write.file), { recursive: true });
      const tmp = `${write.file}.${process.pid}.tmp`;
      await writeFile(tmp, write.content, "utf8");
      await rename(tmp, write.file);
    }
  }

  if (!dryRun && body.projectId) {
    if (project) {
      project.runs.push({
        id: id("run"),
        type: "patch",
        command: "workspace patch",
        createdAt: now(),
        durationMs: 0,
        exitCode: 0,
        stdout: `Applied ${files.length} file patch${files.length === 1 ? "" : "es"}`,
        stderr: "",
        timedOut: false,
        agents: [{ id: "patch", title: "Patch", status: "complete", output: files.map((item) => item.path).join(", ") }],
        changes: files.map((item) => ({
          path: item.path,
          status: item.status,
          changedLines: item.changedLines,
          beforeHash: item.beforeHash,
          afterHash: item.afterHash,
          beforeSize: item.beforeSize,
          afterSize: item.afterSize,
          diff: item.diff
        }))
      });
      project.runs = project.runs.slice(-80);
      await saveProject(project);
    }
  }

  return { dryRun, applied: !dryRun, files, project };
}

async function workspaceSearch(query, limit = 80, project = null) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return { query, results: [] };
  const results = [];
  let remainingEntries = 1800;
  const rootPath = project?.workspaceReady ? projectWorkspaceRootPath(project) : WORKSPACE_ROOT;
  const relativePath = (absolute) => project?.workspaceReady
    ? projectRelativeWorkspacePath(project, absolute)
    : relativeWorkspacePath(absolute);

  async function walk(dir) {
    if (results.length >= limit || remainingEntries <= 0) return;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= limit || remainingEntries <= 0) return;
      remainingEntries -= 1;
      const absolute = path.join(dir, entry.name);
      const rel = relativePath(absolute);
      if (isWorkspaceIgnored(entry.name, rel)) continue;
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile() || !isTextFile(absolute)) continue;
      const fileStat = await stat(absolute);
      if (fileStat.size > 512 * 1024) continue;
      const content = await readFile(absolute, "utf8");
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const hit = line.toLowerCase().indexOf(needle);
        if (hit < 0) continue;
        results.push({
          path: rel,
          line: index + 1,
          preview: clip(line.trim(), 240)
        });
        if (results.length >= limit) return;
      }
    }
  }

  await walk(rootPath);
  return { query, results };
}

function isWorkspaceChangeIgnored(rel = "") {
  const normalized = rel.replace(/\\/g, "/");
  return (
    normalized === "data" ||
    normalized.startsWith("data/") ||
    normalized === "output" ||
    normalized.startsWith("output/") ||
    normalized === ".playwright-cli" ||
    normalized.startsWith(".playwright-cli/")
  );
}

async function collectWorkspaceTextFiles() {
  const files = {};

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      const rel = relativeWorkspacePath(absolute);
      if (isWorkspaceIgnored(entry.name, rel) || isWorkspaceChangeIgnored(rel)) continue;
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile() || !isTextFile(absolute)) continue;
      const fileStat = await stat(absolute);
      if (fileStat.size > 1024 * 1024) continue;
      const content = await readFile(absolute, "utf8");
      files[rel] = {
        path: rel,
        size: fileStat.size,
        hash: hashText(content),
        content
      };
    }
  }

  await walk(WORKSPACE_ROOT);
  return files;
}

async function createWorkspaceBaseline() {
  const baseline = {
    createdAt: now(),
    files: await collectWorkspaceTextFiles()
  };
  await writeJson(WORKSPACE_BASELINE, baseline);
  return baseline;
}

async function readWorkspaceBaseline() {
  return readJson(WORKSPACE_BASELINE, null);
}

function compactDiff(oldText = "", newText = "", maxLines = 180) {
  const oldLines = splitTextLines(oldText).lines;
  const newLines = splitTextLines(newText).lines;
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
    start += 1;
  }
  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  const before = Math.max(0, start - 3);
  const afterOld = Math.min(oldLines.length - 1, oldEnd + 3);
  const afterNew = Math.min(newLines.length - 1, newEnd + 3);
  const lines = [];
  if (before > 0) lines.push("...");
  for (let index = before; index < start; index += 1) lines.push(` ${oldLines[index]}`);
  for (let index = start; index <= oldEnd; index += 1) lines.push(`-${oldLines[index] ?? ""}`);
  for (let index = start; index <= newEnd; index += 1) lines.push(`+${newLines[index] ?? ""}`);
  const tailStart = Math.max(oldEnd + 1, start);
  for (let index = tailStart; index <= afterOld; index += 1) lines.push(` ${oldLines[index]}`);
  if (afterOld < oldLines.length - 1 || afterNew < newLines.length - 1) lines.push("...");
  return lines.slice(0, maxLines).join("\n");
}

async function workspaceChanges() {
  let baseline = await readWorkspaceBaseline();
  if (!baseline) {
    baseline = await createWorkspaceBaseline();
    return {
      baselineCreated: true,
      baselineAt: baseline.createdAt,
      changes: []
    };
  }

  const current = await collectWorkspaceTextFiles();
  const paths = new Set([...Object.keys(baseline.files || {}), ...Object.keys(current)]);
  const changes = [];
  for (const rel of [...paths].sort()) {
    const before = baseline.files?.[rel] || null;
    const after = current[rel] || null;
    if (before?.hash === after?.hash) continue;
    const status = before && after ? "modified" : before ? "deleted" : "added";
    changes.push({
      path: rel,
      status,
      beforeHash: before?.hash || "",
      afterHash: after?.hash || "",
      beforeSize: before?.size || 0,
      afterSize: after?.size || 0,
      diff: compactDiff(before?.content || "", after?.content || "")
    });
  }
  return {
    baselineCreated: false,
    baselineAt: baseline.createdAt,
    changedAt: now(),
    changes
  };
}

function extractWorkspaceTerms(project, userText) {
  const memory = project.memory || {};
  const joined = [
    userText,
    memory.lastContinuation || "",
    ...(memory.next || []).slice(0, 5),
    ...(memory.decisions || []).slice(0, 5),
    ...(memory.tasks || []).map((task) => task.text).slice(0, 8)
  ].join(" ");
  const terms = new Set();
  for (const match of joined.matchAll(/[\w./-]+\.(?:css|csv|html|js|json|md|mjs|svg|ts|txt|xml|ya?ml)/gi)) {
    terms.add(match[0]);
  }
  for (const match of joined.matchAll(/[A-Za-z][A-Za-z0-9_-]{2,}/g)) {
    const value = match[0].toLowerCase();
    if (["the", "and", "for", "with", "from", "this", "that", "true", "false"].includes(value)) continue;
    terms.add(value);
  }
  for (const value of ["ワークスペース", "プロジェクト", "記憶", "検索", "添付", "実行", "モデル", "デザイン"]) {
    if (joined.includes(value)) terms.add(value);
  }
  return [...terms].slice(0, 10);
}

function addAutoCandidate(candidates, candidatePath, score, reason) {
  if (!candidatePath) return;
  const normalized = candidatePath.replace(/\\/g, "/").replace(/^\.?\//, "");
  if (!normalized || normalized.includes("..")) return;
  if (normalized === "data" || normalized.startsWith("data/")) return;
  if (normalized === "output" || normalized.startsWith("output/")) return;
  const current = candidates.get(normalized) || { path: normalized, score: 0, reasons: [] };
  current.score += score;
  if (reason && !current.reasons.includes(reason)) current.reasons.push(reason);
  candidates.set(normalized, current);
}

function pathInWorkspaceFolder(candidatePath = "", folder = "") {
  const candidate = String(candidatePath || "").replace(/\\/g, "/").replace(/^\.?\//, "");
  const root = normalizeWorkspaceFolderValue(folder || "");
  if (isAbsoluteLocalPath(root)) {
    return isAbsoluteLocalPath(candidate)
      ? pathInside(path.resolve(root), path.resolve(candidate))
      : !candidate.includes("..");
  }
  return !root || candidate === root || candidate.startsWith(`${root}/`);
}

async function workspaceFolderOverview(project, depth = 2, limit = 140) {
  if (!project?.workspaceReady) return null;
  const rootPath = projectWorkspaceRootPath(project);
  const rootLabel = project.workspaceRoot || ".";
  const rootName = folderNameFromWorkspace(rootLabel) || "workspace";
  const lines = [
    `Selected workspace folder: ${rootLabel}`,
    `Folder name: ${rootName}`,
    "",
    "Directory overview:"
  ];
  let remaining = limit;
  let truncated = false;
  let visibleEntries = 0;

  async function walk(dir, level) {
    if (remaining <= 0 || level > depth) return;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      lines.push(`${"  ".repeat(level)}- [unreadable] ${error.message}`);
      return;
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
      if (remaining <= 0) {
        truncated = true;
        return;
      }
      const absolute = path.join(dir, entry.name);
      const rel = projectRelativeWorkspacePath(project, absolute);
      if (isWorkspaceIgnored(entry.name, rel)) continue;
      visibleEntries += 1;
      remaining -= 1;
      if (entry.isDirectory()) {
        lines.push(`${"  ".repeat(level)}- ${entry.name}/`);
        if (level < depth) await walk(absolute, level + 1);
      } else {
        let suffix = "";
        try {
          const fileStat = await stat(absolute);
          suffix = ` (${fileStat.size} bytes${isTextFile(absolute) ? ", text" : ""})`;
        } catch {
          suffix = " (unreadable)";
        }
        lines.push(`${"  ".repeat(level)}- ${entry.name}${suffix}`);
      }
    }
  }

  await walk(rootPath, 0);
  if (!visibleEntries) lines.push("- No visible files or folders were found at the selected folder root.");
  if (truncated || remaining <= 0) lines.push(`...truncated after ${limit} entries`);

  const importantFiles = [
    "package.json",
    "README.md",
    "readme.md",
    "AGENTS.md",
    "pyproject.toml",
    "requirements.txt",
    "vite.config.js",
    "vite.config.ts",
    "next.config.js",
    "next.config.mjs",
    "tsconfig.json"
  ];
  const seenImportant = new Set();
  for (const rel of importantFiles) {
    const key = rel.toLowerCase();
    if (seenImportant.has(key)) continue;
    seenImportant.add(key);
    try {
      const file = projectScopedWorkspacePath(project, rel);
      const fileStat = await stat(file);
      if (!fileStat.isFile() || !isTextFile(file) || fileStat.size > 96 * 1024) continue;
      const content = await readFile(file, "utf8");
      lines.push("", `Important file: ${rel}`, clip(content, 2200));
    } catch {
      // Missing common metadata files are normal.
    }
  }

  const text = lines.join("\n");
  return {
    id: id("ctx"),
    name: "selected-folder-overview",
    path: ".",
    type: "text/x-auto-workspace-context",
    source: "auto",
    size: Buffer.byteLength(text, "utf8"),
    reason: "selected folder overview",
    text
  };
}

function sourceFileKind(filePath = "") {
  const name = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  if (name === "package.json") return "node package";
  if (name === "pyproject.toml" || name === "requirements.txt") return "python package";
  if (name.startsWith("vite.config")) return "vite config";
  if (name.startsWith("next.config")) return "next config";
  if (name === "tsconfig.json") return "typescript config";
  if ([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"].includes(ext)) return "source";
  if ([".html", ".css"].includes(ext)) return "web";
  if ([".json", ".yaml", ".yml", ".toml"].includes(ext)) return "config";
  if ([".md", ".txt"].includes(ext)) return "docs";
  if (ext === ".py") return "python";
  return "text";
}

function sourceFileScore(relPath = "", userText = "") {
  const normalized = relPath.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  const request = String(userText || "").toLowerCase();
  let score = 0;
  if (/^(package\.json|readme\.md|agents\.md|tsconfig\.json|vite\.config\.[jt]s|next\.config\.(js|mjs|ts))$/.test(lower)) score += 10;
  if (/^(server\.mjs|app\.js|index\.html|style\.css|styles\.css)$/.test(lower)) score += 9;
  if (/^(src|app|pages|public|components|lib|electron)\//.test(lower)) score += 6;
  if (/\.(js|mjs|cjs|jsx|ts|tsx|py|html|css|json)$/.test(lower)) score += 4;
  for (const token of request.match(/[a-z0-9_-]{3,}/g) || []) {
    if (lower.includes(token)) score += 4;
  }
  if (/test|spec|__tests__/.test(lower)) score += request.includes("test") || request.includes("bug") ? 3 : -2;
  if (/dist|build|node_modules|coverage|\.min\./.test(lower)) score -= 20;
  return score;
}

async function workspaceCodingContext(project, userText = "", depth = 3, limit = 160) {
  if (!project?.workspaceReady) return null;
  const rootPath = projectWorkspaceRootPath(project);
  const files = [];
  let remaining = limit;

  async function walk(dir, level) {
    if (remaining <= 0 || level > depth) return;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
      if (remaining <= 0) return;
      const absolute = path.join(dir, entry.name);
      const rel = projectRelativeWorkspacePath(project, absolute);
      if (isWorkspaceIgnored(entry.name, rel)) continue;
      if (entry.isDirectory()) {
        await walk(absolute, level + 1);
        continue;
      }
      remaining -= 1;
      if (!isTextFile(absolute)) continue;
      const fileStat = await stat(absolute).catch(() => null);
      if (!fileStat?.isFile() || fileStat.size > 700 * 1024) continue;
      const score = sourceFileScore(rel, userText);
      if (score <= 0) continue;
      files.push({
        path: rel,
        absolute,
        size: fileStat.size,
        score,
        kind: sourceFileKind(rel)
      });
    }
  }

  await walk(rootPath, 0);
  files.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const selected = files.slice(0, 12);
  const packageJson = await readJson(path.join(rootPath, "package.json"), null);
  const scripts = packageJson?.scripts ? Object.keys(packageJson.scripts).slice(0, 12) : [];
  const deps = packageJson
    ? Object.keys({ ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) }).slice(0, 24)
    : [];
  const lines = [
    "Coding context map:",
    `Root: ${project.workspaceRoot || project.selectedFolderPath || "."}`,
    packageJson?.name ? `Package: ${packageJson.name}${packageJson.version ? `@${packageJson.version}` : ""}` : "",
    scripts.length ? `Scripts: ${scripts.join(", ")}` : "",
    deps.length ? `Dependencies: ${deps.join(", ")}` : "",
    "",
    "Most relevant files:",
    ...(selected.length
      ? selected.map((file) => `- ${file.path} (${file.kind}, ${file.size} bytes, score ${file.score})`)
      : ["- No high-confidence source files detected yet."])
  ].filter(Boolean);

  for (const file of selected.slice(0, 7)) {
    const content = await safeReadText(file.absolute, 9000);
    if (!content.trim()) continue;
    lines.push("", `File snapshot: ${file.path}`, clip(content, file.path.toLowerCase() === "package.json" ? 4200 : 6500));
  }

  const text = lines.join("\n");
  return {
    id: id("ctx"),
    name: "coding-context-map",
    path: ".",
    type: "text/x-auto-workspace-context",
    source: "auto",
    size: Buffer.byteLength(text, "utf8"),
    reason: "coding context map",
    text
  };
}

async function workspaceAutoContext(project, userText, manualAttachments = []) {
  const workspaceRoot = normalizeWorkspaceFolder(project);
  const manualPaths = new Set(
    manualAttachments
      .map((file) => file.path || (String(file.name || "").startsWith("@") ? String(file.name).slice(1) : ""))
      .filter(Boolean)
  );
  const pinned = await pinnedContextFromProject(project, manualPaths);
  for (const item of pinned) manualPaths.add(item.path);
  const candidates = new Map();
  const recentRuns = (project.runs || []).slice(-3);
  const continuation = /続き|前回|再開|続きをやって|続けて/i.test(userText);

  if (continuation) {
    for (const run of recentRuns) {
      for (const item of run.workspaceContext || []) {
        addAutoCandidate(candidates, item.path, 4, "previous run");
      }
    }
  }

  for (const rule of AUTO_CONTEXT_RULES) {
    if (!rule.pattern.test(userText)) continue;
    for (const candidatePath of rule.paths) addAutoCandidate(candidates, candidatePath, 6, rule.reason);
  }

  for (const term of extractWorkspaceTerms(project, userText)) {
    if (term.includes(".")) addAutoCandidate(candidates, term, 8, "mentioned file");
    try {
      const hits = await workspaceSearch(term, 8, project);
      for (const hit of hits.results) addAutoCandidate(candidates, hit.path, 2, `match:${term}`);
    } catch {
      // Ignore search misses; auto context should never block a chat.
    }
  }

  const picked = [...candidates.values()]
    .filter((item) => !manualPaths.has(item.path))
    .filter((item) => pathInWorkspaceFolder(item.path, workspaceRoot))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 5);

  const overview = await workspaceFolderOverview(project);
  const codingMap = needsWorkspaceCodingContext(userText) || routeCompanyWork(userText).needsCode
    ? await workspaceCodingContext(project, userText)
    : null;
  const context = [...(overview ? [overview] : []), ...(codingMap ? [codingMap] : []), ...pinned];
  for (const candidate of picked) {
    try {
      const file = project?.workspaceReady ? projectScopedWorkspacePath(project, candidate.path) : workspacePath(candidate.path);
      const fileStat = await stat(file);
      if (!fileStat.isFile() || !isTextFile(file) || fileStat.size > 512 * 1024) continue;
      const content = await readFile(file, "utf8");
      context.push({
        id: id("ctx"),
        name: `auto:${candidate.path}`,
        path: project?.workspaceReady ? projectRelativeWorkspacePath(project, file) : relativeWorkspacePath(file),
        type: "text/x-auto-workspace-context",
        source: "auto",
        size: fileStat.size,
        reason: candidate.reasons.slice(0, 3).join(" / "),
        text: clip(content, 12000)
      });
    } catch {
      // Ignore deleted or unreadable files.
    }
  }

  return context;
}

function contextSummary(context = []) {
  return context.map(({ id: contextId, name, path: contextPath, type, source, size, reason }) => ({
    id: contextId,
    name,
    path: contextPath,
    type,
    source,
    size,
    reason
  }));
}

async function storeAttachments(project, attachments = []) {
  const stored = [];
  if (!attachments.length) return stored;
  const dir = path.join(UPLOADS_DIR, project.id);
  await mkdir(dir, { recursive: true });
  for (const file of attachments.slice(0, 8)) {
    const isWorkspaceContext =
      file.type === "text/x-workspace-context" ||
      file.type === "text/x-auto-workspace-context" ||
      file.type === "text/x-pinned-workspace-context";
    const fileId = id("file");
    const rawName = String(file.name || file.path || "attachment");
    const name = isWorkspaceContext ? clip(rawName, 160) : safeFileName(rawName);
    const storedName = isWorkspaceContext ? null : `${fileId}_${name}`;
    const target = storedName ? path.join(dir, storedName) : "";
    if (!isWorkspaceContext && file.content) {
      await writeFile(target, Buffer.from(file.content, "base64"));
    }
    const item = {
      id: fileId,
      name,
      type: file.type || "application/octet-stream",
      size: file.size || 0,
      storedName,
      uploadedAt: now(),
      source: isWorkspaceContext ? "workspace" : "upload",
      path: isWorkspaceContext ? clip(file.path || "", 240) : "",
      text: clip(file.text || "", isWorkspaceContext ? 24000 : 9000)
    };
    if (!isWorkspaceContext) project.files.push(item);
    stored.push(item);
  }
  return stored;
}

function parseMemoryDraft(text) {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
  } catch {
    // ignore invalid agent JSON
  }
  return { facts: [], decisions: [], next: [], summary: "" };
}

function mergeUnique(existing, incoming, max = 36) {
  const seen = new Set();
  const merged = [];
  for (const value of [...(incoming || []), ...(existing || [])]) {
    const text = clip(String(value || "").trim(), 220);
    if (
      !text ||
      seen.has(text.toLowerCase()) ||
      blankMemoryText(text)
    ) continue;
    seen.add(text.toLowerCase());
    merged.push(text);
    if (merged.length >= max) break;
  }
  return merged;
}

function updateMemory(project, userText, finalText, memoryText) {
  normalizeProjectMemory(project);
  const draft = parseMemoryDraft(memoryText);
  const fallbackNext = [`「${clip(userText, 90)}」の続きとして、${clip(finalText, 140)}を踏まえて進める。`];
  project.memory.facts = mergeUnique(project.memory.facts, draft.facts, 42);
  project.memory.decisions = mergeUnique(project.memory.decisions, draft.decisions, 42);
  addProjectTasks(project, draft.next?.length ? draft.next : fallbackNext, "open");
  project.memory.lastContinuation =
    draft.summary || `前回は「${clip(userText, 120)}」に対して、${clip(finalText, 180)}まで進めた。`;
  project.summary = draft.summary || project.summary || clip(finalText, 240);
  syncNextFromTasks(project);
}

function updateCompanyMemory(project, userText, finalText, company = {}) {
  normalizeProjectMemory(project);
  const writtenFiles = [...String(finalText || "").matchAll(/- (?:added|modified): ([^\n]+)/g)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .slice(0, 12);
  const facts = [];
  const decisions = [];
  const next = [];
  if (project.workspaceReady) facts.push(`Workspace folder: ${project.workspaceRoot || project.selectedFolderPath || project.name}`);
  if (writtenFiles.length) {
    decisions.push(`Generated or updated files: ${writtenFiles.join(", ")}`);
    next.push(`Continue from files: ${writtenFiles.join(", ")}`);
  }
  if (company?.agents?.length) {
    const coder = company.agents.find((agent) => agent.id === "coder");
    if (coder?.model) facts.push(`Last code model: ${coder.model}`);
  }
  if (company?.intent?.taskKind) {
    facts.push(`Last intent: ${company.intent.taskKind}`);
    if (company.intent.inferredGoal) decisions.push(`Inferred goal: ${clip(company.intent.inferredGoal, 180)}`);
  }
  if (company?.intelligence) {
    facts.push(`AI intelligence level: Lv${company.intelligence.beforeLevel} -> Lv${company.intelligence.afterLevel}`);
    if (company.intelligence.qualityScore) {
      decisions.push(`品質確認: ${company.intelligence.qualityScore}/100 ${company.intelligence.revised ? "保存前に補正" : "通過"}`);
    }
  }
  decisions.push(`Last request: ${clip(userText, 160)}`);
  project.memory.facts = mergeUnique(project.memory.facts, facts, 42);
  project.memory.decisions = mergeUnique(project.memory.decisions, decisions, 42);
  addProjectTasks(project, next.length ? next : [`Continue from: ${clip(userText, 120)}`], "open");
  project.memory.lastContinuation = `Last request: ${clip(userText, 140)} / Last result: ${clip(stripThinking(finalText), 180)}`;
  project.summary = project.summary || clip(userText, 180);
  syncNextFromTasks(project);
}

function processEvent(type, title, detail = "", data = {}) {
  return {
    id: id("step"),
    type,
    title: sanitizeNexaVisibleText(title),
    detail: sanitizeNexaVisibleText(detail),
    data,
    createdAt: now()
  };
}

function emitProcessEvent(options = {}, event) {
  if (!event) return event;
  options.processEvents?.push(event);
  if (options.send && options.messageId) {
    options.send("process", { messageId: options.messageId, event });
  }
  return event;
}

function fileChangeStats(files = []) {
  return files.reduce((summary, file) => {
    summary.count += 1;
    if (file.status === "added") summary.added += 1;
    if (file.status === "modified") summary.modified += 1;
    summary.changedLines += Number(file.changedLines || 0);
    return summary;
  }, { count: 0, added: 0, modified: 0, changedLines: 0 });
}

function fileStatusJa(status = "") {
  if (status === "added") return "新規作成";
  if (status === "modified") return "編集";
  if (status === "deleted") return "削除";
  return "変更";
}

function filePurposeForLog(filePath = "", userText = "") {
  const lower = String(filePath || "").toLowerCase();
  const request = String(userText || "");
  if (/index\.html?$/.test(lower)) {
    if (isGameFallbackRequest(request)) return "ゲーム画面、HUD、操作説明、Canvasの土台を置くため";
    if (isLandingPageRequest(request)) return "最初に開くページ構造と主要セクションを置くため";
    return "アプリをブラウザで開いた時の画面構造を置くため";
  }
  if (/styles?\.css$/.test(lower)) {
    if (isGameFallbackRequest(request)) return "ゲーム画面の見た目、余白、HUD、レスポンシブ表示を整えるため";
    if (isLandingPageRequest(request)) return "LPの見た目、余白、色、アニメーションを整えるため";
    return "アプリの見た目、余白、色、レスポンシブ表示を整えるため";
  }
  if (/(app|main|script|index)\.(js|mjs|cjs|ts|tsx|jsx)$/.test(lower)) {
    if (isGameFallbackRequest(request)) return "プレイヤー操作、敵、当たり判定、スコア更新を動かすため";
    return "ボタン操作、状態更新、画面の動きを実装するため";
  }
  if (/package\.json$/.test(lower)) return "起動コマンド、依存関係、アプリ情報を定義するため";
  if (/readme|\.md$/.test(lower)) return "使い方やセットアップ手順を残すため";
  if (/\.(json|ya?ml|toml)$/.test(lower)) return "設定やデータ構造を保存するため";
  return "依頼に必要な処理をファイルとして保存するため";
}

function describeBuildTarget(userText = "", route = {}) {
  const text = String(userText || "");
  if (route?.intent?.semanticTarget === "current-workspace") {
    if (route.intent.semanticAction === "debug") {
      return "選択フォルダー内の現在の実装を読み、動かない根本原因を特定して修正し、実行確認まで行います。";
    }
    return "選択フォルダー内の現在のプロジェクトと直前の作業を引き継ぎ、最新の依頼を満たすまで実装・検証します。";
  }
  if (route?.safetyPlanOnly) return "ファイルは変更せず、削除の危険性と安全な再構築手順だけを整理します。";
  if (route?.intent?.failureFollowUp || /動くように|動かして|起動できるように|正常に動作/i.test(text)) {
    return "新規作成はせず、選択フォルダーの既存実装を読み、起動方法・実行時エラー・参照切れを診断して根本原因を修正します。";
  }
  if (is3DShooterRequest(text)) return "一人称視点で移動・照準・射撃・敵との戦闘ができる3Dシューティングゲームを、必要なファイル一式で作成します。";
  if (isGameFallbackRequest(text)) return "操作できるゲームとして、依頼に必要な画面・スタイル・ゲームロジックを分けて作成します。";
  if (isLandingPageRequest(text)) return "見た目の完成度を優先したLPとして、表示・スタイル・動きを分けて作成します。";
  if (/dashboard|admin|管理|分析|グラフ|売上|統計/i.test(text)) return "一覧、指標、操作パネルを持つダッシュボード型アプリとして作成します。";
  if (/todo|task|タスク|予定|チェックリスト/i.test(text)) return "追加、完了、削除、保存ができるタスク管理アプリとして作成します。";
  if (/shop|store|ec|cart|商品|販売|カート/i.test(text)) return "商品一覧、選択、カートの土台を持つアプリとして作成します。";
  if (/chat|sns|投稿|タイムライン|コミュニティ/i.test(text)) return "投稿、一覧、状態保存ができるコミュニケーション系アプリとして作成します。";
  if (route?.needsCode) return "短い依頼から目的を補完し、開けるWebアプリの土台として作成します。";
  return "会話内容を整理して、必要な出力を組み立てます。";
}

function safetyPlanDirectReply(project, userText = "", route = {}) {
  if (!route?.safetyPlanOnly && !isNonExecutingSafetyRequest(userText)) return "";
  const folder = project?.workspaceReady
    ? project.workspaceRoot || project.selectedFolderPath || "選択フォルダー"
    : "未選択の作業フォルダー";
  return [
    "今回は実行せず、ファイルの削除や変更も行いません。",
    "",
    "**主な危険性**",
    "- 全削除すると、既存コードだけでなく設定、素材、環境変数のひな形、ドキュメントも失う可能性があります。",
    "- `.git`、`.env`、保存データ、ライセンス、外部サービス設定まで消すと復旧できない場合があります。",
    "- 一度に作り直すと、どの変更で動かなくなったか追跡しにくくなります。",
    "",
    "**安全な代替案**",
    `1. 対象を \`${folder}\` の内部だけに固定します。`,
    "2. 削除前にファイル一覧と削除対象を表示し、`.git`、`.env`、ユーザーデータを除外します。",
    "3. 現在の状態をバックアップまたはスナップショットとして保存します。",
    "4. 既存ファイルを即時削除せず、退避フォルダーへ移してから新しい構成を作ります。",
    "5. 最小構成で起動確認し、3D描画、操作、射撃、敵AI、効果音の順に追加します。",
    "6. 動作確認後に限り、退避した不要ファイルの削除を改めて承認します。",
    "",
    "**3Dシューティングゲームの安全な再構築案**",
    "- Three.jsなど実績のある3Dエンジンを使い、まず移動・カメラ・当たり判定を実装します。",
    "- 次に武器、敵AI、HUD、ステージ、音響を分離して追加します。",
    "- 各段階で起動テストを行い、失敗時は直前のスナップショットへ戻せるようにします。",
    "",
    "現時点では、対象フォルダーへの書き込み・編集・削除・コマンド実行は0件です。"
  ].join("\n");
}

function executableRequestFromSafetyPrompt(userText = "") {
  return String(userText || "")
    .replace(/\s*(?:まだ)?実行せず[、,]?\s*(?:危険性と安全な代替案だけ説明して|安全な計画と確認ポイントだけ出して)[。.]?/gi, "")
    .replace(/\s*(?:削除せず|変更せず)[、,]?\s*(?:説明|計画)だけ(?:して|出して)[。.]?/gi, "")
    .replace(/(?:\s*直前に提示した安全な代替案に沿って進め[、,]?\s*破壊的変更の前に最終確認を取って[。.]?)+/gi, "")
    .trim();
}

function latestPendingSafetyPlan(project) {
  const lastMessage = [...(project?.messages || [])].reverse().find((message) =>
    message.role === "assistant" || message.role === "user"
  );
  return lastMessage?.role === "assistant" && lastMessage.safetyPlan?.executableRequest
    ? lastMessage.safetyPlan
    : null;
}

function isExplicitSafetyApproval(submittedText = "") {
  const text = String(submittedText || "")
    .toLowerCase()
    .replace(/[\s、,。.!！?？]/g, "");
  const explicitApproval = /^(?:ok|okay|了承|承認|はい|うん)?(?:それ(?:を)?|この内容(?:で)?|その内容(?:で)?)?(?:やって|実行して|進めて|開始して|作って|お願い|よろしく)$/.test(text);
  const shortApproval = /^(?:ok|okay|了承|承認|はい|うん)$/.test(text);
  return explicitApproval || shortApproval;
}

function pendingSafetyPlanContinuation(project, submittedText = "") {
  return isExplicitSafetyApproval(submittedText) ? latestPendingSafetyPlan(project) : null;
}

async function resolveSafetyActionDecision(plan, submittedText, system = {}) {
  if (!plan) return { decision: "none", confidence: 1, source: "none", reason: "保留中の安全計画はありません。" };
  const deterministicApproval = isExplicitSafetyApproval(submittedText);
  const model = system.plan?.fast || system.plan?.conversation || "";
  if (!model) {
    return {
      decision: deterministicApproval ? "approve" : "unclear",
      confidence: deterministicApproval ? 0.98 : 0.4,
      source: "safety-rules",
      reason: deterministicApproval ? "明示的な承認表現を検出しました。" : "判断モデルが利用できないため安全側に停止します。"
    };
  }
  try {
    const answer = await llmChat(model, [
      {
        role: "system",
        content: "You are Nexa Safety Decision AI. Classify the user's reply to a pending destructive-operation plan. Return JSON only: {\"decision\":\"approve|cancel|explain|unclear\",\"confidence\":0.0,\"reason\":\"short Japanese reason\"}. Never invent approval."
      },
      {
        role: "user",
        content: `Pending plan:\n${clip(plan.executableRequest, 1200)}\n\nUser reply:\n${clip(submittedText, 300)}`
      }
    ], {
      temperature: 0,
      numPredict: 140,
      timeout: 8000,
      fallbackModel: localFallbackForKind(system, "conversation")
    });
    const jsonText = String(answer || "").match(/\{[\s\S]*\}/)?.[0] || "";
    const parsed = JSON.parse(jsonText);
    const allowed = new Set(["approve", "cancel", "explain", "unclear"]);
    const decision = allowed.has(parsed.decision) ? parsed.decision : "unclear";
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    // A destructive action needs either a clear AI decision or an explicit
    // deterministic approval. Low-confidence model output cannot authorize it.
    const approved = decision === "approve" && (confidence >= 0.82 || deterministicApproval);
    return {
      decision: approved ? "approve" : decision === "approve" ? "unclear" : decision,
      confidence,
      source: "safety-decision-ai",
      model: publicModelName(model),
      reason: clip(parsed.reason || "安全判断AIが返答を分類しました。", 240)
    };
  } catch (error) {
    return {
      decision: deterministicApproval ? "approve" : "unclear",
      confidence: deterministicApproval ? 0.98 : 0.3,
      source: "safety-rules-fallback",
      reason: deterministicApproval ? "判断AIが利用できないため、明示的な承認ルールで確認しました。" : `判断AIを利用できません: ${error.message}`
    };
  }
}

async function resolveTurnIntentWithAi(project, submittedText, system = {}) {
  const mode = normalizeChatMode(project?.mode);
  if (mode === "chat") return null;
  // Intent routing needs reliable structured output more than long-form prose.
  // Prefer the fast non-thinking model so reasoning text cannot corrupt JSON.
  const model = system.plan?.fast || system.plan?.conversation || system.plan?.code || "";
  if (!model) return null;
  const recent = (project?.messages || []).slice(-10).map((message) => ({
    role: message.role,
    content: clip(sanitizeUserVisibleAssistantText(message.content || ""), 900)
  }));
  let workspace = "folder not selected";
  if (project?.workspaceReady) {
    try {
      const summary = await workspaceDevelopmentLogSummary(project);
      workspace = `${project.workspaceRoot || project.selectedFolderPath}\n${summary.detail}`;
    } catch {
      workspace = project.workspaceRoot || project.selectedFolderPath || "selected folder";
    }
  }
  try {
    const answer = await llmChat(model, [
      {
        role: "system",
        content: [
          "You are Nexa Intent Decision AI. Understand meaning from the whole local conversation and workspace state, not keyword matching. Do not think aloud.",
          "Return JSON only with this schema:",
          '{"action":"chat|explain|create|modify|debug|continue|research|image|computer|command","continuation":true,"target":"current-workspace|new-artifact|conversation","needsCode":true,"needsResearch":false,"needsInternet":false,"needsComputer":false,"destructive":false,"confidence":0.0,"resolvedRequest":"clear Japanese instruction for the main AI","reason":"short Japanese reason"}.',
          "For short follow-ups such as make it work, improve it, that one, continue, infer the concrete target from the immediately preceding implementation and current workspace.",
          "Never turn an existing-app repair into a generic new web app. Never infer destructive permission merely from an app feature named delete.",
          "resolvedRequest must preserve the user's latest intent and tell the main AI what outcome to achieve, not how to fake success."
        ].join(" ")
      },
      {
        role: "user",
        content: [
          `Mode: ${mode || "unselected"}`,
          `Workspace:\n${clip(workspace, 1800)}`,
          `Previous implementation goal: ${clip(latestImplementationRequest(project), 700) || "unknown"}`,
          `Recent conversation:\n${recent.map((item) => `${item.role}: ${item.content}`).join("\n") || "none"}`,
          `Latest user message:\n${submittedText}`
        ].join("\n\n")
      }
    ], {
      temperature: 0,
      numPredict: 320,
      timeout: 30000,
      fallbackModel: localFallbackForKind(system, "conversation")
    });
    const raw = String(answer || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    const candidates = [fenced, raw, raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)].filter(Boolean);
    let parsed = null;
    for (const candidate of candidates) {
      try {
        parsed = JSON.parse(candidate);
        break;
      } catch {
        // Try the next representation before falling back to legacy routing.
      }
    }
    if (!parsed) return null;
    const actions = new Set(["chat", "explain", "create", "modify", "debug", "continue", "research", "image", "computer", "command"]);
    const targets = new Set(["current-workspace", "new-artifact", "conversation"]);
    if (!actions.has(parsed.action) || !targets.has(parsed.target)) return null;
    return {
      action: parsed.action,
      continuation: Boolean(parsed.continuation),
      target: parsed.target,
      needsCode: Boolean(parsed.needsCode),
      needsResearch: Boolean(parsed.needsResearch),
      needsInternet: Boolean(parsed.needsInternet),
      needsComputer: Boolean(parsed.needsComputer),
      destructive: Boolean(parsed.destructive),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      resolvedRequest: clip(String(parsed.resolvedRequest || "").trim(), 1600),
      reason: clip(String(parsed.reason || "").trim(), 320),
      model: publicModelName(model),
      source: "semantic-intent-ai"
    };
  } catch {
    return null;
  }
}

function semanticExecutionRequest(decision, submittedText) {
  if (!decision?.resolvedRequest) return submittedText;
  const action = {
    create: "新しく実装する",
    modify: "既存実装を編集して改善する",
    debug: "既存実装を調査し、原因を特定して修正・検証する",
    continue: "直前までの実装を引き継ぎ、完成条件まで作業する",
    research: "必要な情報を調査して根拠をまとめる",
    image: "画像生成として処理する",
    computer: "必要なコンピューター操作を実行する",
    command: "必要なコマンドを実行して検証する",
    explain: "会話として分かりやすく説明する",
    chat: "会話として直接回答する"
  }[decision.action] || "依頼を処理する";
  const target = decision.target === "current-workspace"
    ? "対象は選択フォルダー内の現在のプロジェクト。新しい汎用アプリへ置き換えず、既存構成と直前の作業を継承する。"
    : decision.target === "new-artifact"
      ? "対象は今回新しく作る成果物。"
      : "対象は現在の会話。";
  return `${target}\n処理方針: ${action}。\nユーザーの最新依頼: ${submittedText}\n意味判断AIの具体化: ${decision.resolvedRequest}`;
}

function isProtectedRebuildEntry(name = "") {
  const lower = String(name || "").toLowerCase();
  return lower === ".git" || lower === ".env" || lower.startsWith(".nexa-backup-") ||
    ["data", "uploads", "saves", "save", "storage"].includes(lower) ||
    /\.(?:db|sqlite|sqlite3)$/.test(lower);
}

async function stageConfirmedWorkspaceRebuild(project) {
  assertWorkspaceReadyForWrite(project);
  const root = projectWorkspaceRootPath(project);
  const entries = await readdir(root, { withFileTypes: true });
  const movable = entries.filter((entry) => !isProtectedRebuildEntry(entry.name));
  if (!movable.length) return { backupPath: "", moved: [], protected: entries.map((entry) => entry.name) };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `.nexa-backup-${stamp}`;
  const backupPath = path.join(root, backupName);
  await mkdir(backupPath, { recursive: false });
  const moved = [];
  try {
    for (const entry of movable) {
      await rename(path.join(root, entry.name), path.join(backupPath, entry.name));
      moved.push(entry.name);
    }
  } catch (error) {
    for (const name of [...moved].reverse()) {
      try {
        await rename(path.join(backupPath, name), path.join(root, name));
      } catch {
        // Leave the recoverable backup in place if an individual rollback fails.
      }
    }
    throw error;
  }
  return {
    backupPath: backupName,
    moved,
    protected: entries.filter((entry) => isProtectedRebuildEntry(entry.name)).map((entry) => entry.name)
  };
}

async function restoreStagedWorkspace(project, staged = {}) {
  if (!staged?.backupPath || !Array.isArray(staged.moved) || !staged.moved.length) return [];
  const root = projectWorkspaceRootPath(project);
  const backup = path.join(root, staged.backupPath);
  const restored = [];
  for (const name of staged.moved) {
    const source = path.join(backup, name);
    const target = path.join(root, name);
    try {
      await stat(source);
      try {
        await stat(target);
        continue;
      } catch (error) {
        if (error.code !== "ENOENT") continue;
      }
      await rename(source, target);
      restored.push(name);
    } catch {
      // Keep remaining entries in the backup for manual recovery.
    }
  }
  return restored;
}

function expectedFilesForLog(userText = "", route = {}) {
  if (route?.intent?.failureFollowUp || /動くように|動かして|起動できるように|正常に動作/i.test(String(userText || ""))) return [];
  if (is3DShooterRequest(userText)) return ["index.html", "style.css", "app.js", "README.md"];
  if (isGameFallbackRequest(userText)) return ["index.html", "style.css", "app.js"];
  const requested = inferRequestedFiles(userText);
  if (requested.length) return requested;
  if (isLandingPageRequest(userText)) return ["index.html", "style.css", "app.js"];
  if (route?.needsCode) return ["必要なファイル"];
  return [];
}

function expectedFilesTextForLog(userText = "", route = {}) {
  const files = expectedFilesForLog(userText, route);
  return files.length ? files.join(", ") : "ファイル作成なし";
}

async function workspaceDevelopmentLogSummary(project = null) {
  if (!project?.workspaceReady) {
    return {
      title: "作業フォルダーを確認",
      detail: "まだ作業フォルダーが選択されていません。直接コードを書くにはフォルダー選択が必要です。",
      empty: true,
      fileCount: 0,
      dirCount: 0,
      sample: []
    };
  }
  const rootPath = projectWorkspaceRootPath(project);
  let entries = [];
  try {
    entries = await readdir(rootPath, { withFileTypes: true });
  } catch (error) {
    return {
      title: "既存ファイルを確認",
      detail: `フォルダーを読み取れませんでした: ${error.message}`,
      empty: true,
      fileCount: 0,
      dirCount: 0,
      sample: []
    };
  }
  const visible = entries
    .map((entry) => {
      const rel = projectRelativeWorkspacePath(project, path.join(rootPath, entry.name));
      return { entry, rel };
    })
    .filter(({ entry, rel }) => !isWorkspaceIgnored(entry.name, rel))
    .sort((a, b) => {
      if (a.entry.isDirectory() !== b.entry.isDirectory()) return a.entry.isDirectory() ? -1 : 1;
      return a.entry.name.localeCompare(b.entry.name);
    });
  const files = visible.filter(({ entry }) => entry.isFile());
  const dirs = visible.filter(({ entry }) => entry.isDirectory());
  const sample = visible.slice(0, 8).map(({ entry }) => `${entry.name}${entry.isDirectory() ? "/" : ""}`);
  const folderName = project.selectedFolderName || folderNameFromWorkspace(project.workspaceRoot || "") || project.name || "workspace";
  return {
    title: "既存ファイルを確認",
    detail: visible.length
      ? `${folderName} にはファイル${files.length}件、フォルダー${dirs.length}件があります。${sample.length ? `確認した項目: ${sample.join(", ")}` : ""}`
      : `${folderName} は空でした。これから必要なファイルを新しく作成します。`,
    empty: visible.length === 0,
    fileCount: files.length,
    dirCount: dirs.length,
    sample
  };
}

function codeProcessFileEvents(result = {}, userText = "") {
  const files = result?.files || [];
  const stats = fileChangeStats(files);
  const events = [];
  for (const file of files.filter((item) => item.status !== "deleted").slice(0, 24)) {
    const action = fileStatusJa(file.status);
    const purpose = filePurposeForLog(file.path, userText);
    events.push(processEvent(
      "edit",
      `${file.path} を${action}しました`,
      `${purpose}。${Number(file.changedLines || 0) ? `変更行: ${file.changedLines}` : ""}`.trim(),
      {
        file,
        files: [file],
        stats: {
          count: 1,
          added: file.status === "added" ? 1 : 0,
          modified: file.status === "modified" ? 1 : 0,
          changedLines: Number(file.changedLines || 0)
        }
      }
    ));
  }
  if (files.length > 12) {
    events.push(processEvent("edit", "さらに複数ファイルを反映しました", `${files.length - 12}件を追加で処理しました。`, { files: files.slice(12), stats }));
  }
  events.push(processEvent("edit", "変更したファイルをまとめました", files.map((file) => `${file.status}: ${file.path}`).join("\n"), {
    files,
    stats
  }));
  return events;
}

function codeProcessFinishEvent(result = {}, verification = "", checkSummary = "") {
  const stats = fileChangeStats(result?.files || []);
  return processEvent(
    "done",
    "最後の確認が完了しました",
    [verification, checkSummary, stats.changedLines ? `変更行: ${stats.changedLines}` : ""].filter(Boolean).join("\n\n"),
    { stats }
  );
}

function codeProcessSuccessEvents(project, method, result, verification = "", repaired = false, fallback = false) {
  const files = result?.files || [];
  const stats = fileChangeStats(files);
  const folder = project?.selectedFolderName || folderNameFromWorkspace(project?.workspaceRoot || "") || project?.name || "workspace";
  return [
    processEvent("thinking", "作業フォルダーを確認", folder, {
      folderPath: project?.workspaceRoot || project?.selectedFolderPath || ""
    }),
    processEvent("thinking", repaired ? "Nexa出力を補修" : "Nexaがコード変更案を生成", fallback ? "モデル出力が壊れても、要求からテンプレート補完しました。" : ""),
    processEvent("edit", `${stats.count}件のファイルを編集`, files.map((file) => `${file.status}: ${file.path}`).join("\n"), {
      files,
      stats
    }),
    processEvent("command", "検証を実行", verification || `${method} を確認しました`, {
      method
    }),
    processEvent("done", "書き込みと検証が完了", stats.changedLines ? `変更行: ${stats.changedLines}` : "")
  ];
}

function codeProcessFailureEvents(project, error = "") {
  const folder = project?.selectedFolderName || folderNameFromWorkspace(project?.workspaceRoot || "") || project?.name || "workspace";
  return [
    processEvent("thinking", "作業フォルダーを確認", folder, {
      folderPath: project?.workspaceRoot || project?.selectedFolderPath || ""
    }),
    processEvent("thinking", "Nexaがコード変更案を生成"),
    processEvent("error", "直接書き込みに失敗", userVisibleWriteIssue(error || "writable_file_block_or_valid_diff_not_found"))
  ];
}

function folderRequiredChoiceRequest(project, userText = "") {
  return {
    id: id("choice"),
    title: "コードを書く場所を選んでください",
    body: "コードモードでは、PC上の作業フォルダーを選ぶとその中へ直接ファイルを書けます。",
    options: [
      {
        id: "pick-folder",
        label: "フォルダーを選択",
        description: "PCのフォルダー選択画面を開きます。",
        action: "folder-picker"
      },
      {
        id: "both-mode",
        label: "両方モードで続ける",
        description: "フォルダーなしで相談し、あとからコード編集に切り替えます。",
        action: "set-mode",
        mode: "both",
        prompt: userText
      },
      {
        id: "chat-mode",
        label: "チャットで相談",
        description: "直接書き込みはせず、設計やコード例だけ受け取ります。",
        action: "set-mode",
        mode: "chat",
        prompt: userText
      }
    ]
  };
}

function answerChoiceRequest(project, userText = "", route = {}) {
  if (route?.needsCode) {
    return {
      id: id("choice"),
      title: "進め方を選んでください",
      body: "追加情報がなくても進められる選択肢を用意しました。",
      options: [
        {
          id: "recommended",
          label: "おすすめで進める",
          description: "AIが妥当な構成を選んで実装します。",
          action: "send-prompt",
          prompt: `${userText}\nおすすめの構成でそのまま進めて。`
        },
        {
          id: "minimal",
          label: "最小構成",
          description: "少ないファイルで動く形を優先します。",
          action: "send-prompt",
          prompt: `${userText}\n最小構成で作って。`
        },
        {
          id: "pick-folder",
          label: "フォルダーを選ぶ",
          description: "PCのフォルダーに直接コードを書きます。",
          action: "folder-picker"
        }
      ]
    };
  }
  return {
    id: id("choice"),
    title: "回答の方向を選んでください",
    body: "続きの返し方を選ぶだけで進められます。",
    options: [
      {
        id: "recommended",
        label: "おすすめ",
        description: "AIが一番自然な方向で続けます。",
        action: "send-prompt",
        prompt: "おすすめで続けて。"
      },
      {
        id: "short",
        label: "短く",
        description: "要点だけで続けます。",
        action: "send-prompt",
        prompt: "短く要点だけで続けて。"
      },
      {
        id: "detailed",
        label: "詳しく",
        description: "背景や手順も含めて続けます。",
        action: "send-prompt",
        prompt: "詳しく続けて。"
      }
    ]
  };
}

function recentActionHints(project = null) {
  const memory = normalizeProjectMemory(project);
  const raw = [
    memory.lastContinuation,
    ...(memory.next || []),
    ...(memory.tasks || []).filter((task) => task.status !== "done").map((task) => task.text),
    ...(memory.decisions || []),
    project?.summary
  ];
  return mergeUnique([], raw.map((item) => clip(String(item || "").replace(/\s+/g, " ").trim(), 120)).filter(Boolean), 5);
}

function ambiguityChoiceRequest(project, userText = "", route = {}, attachments = [], autoContext = []) {
  const text = String(userText || "").trim();
  if (!text) return null;
  const intent = route.intent || analyzeUserIntent(text, project);
  if (intent.selfImprovement || intent.chatGptLevel || intent.videoUnsupported || route.needsResearch) return null;
  if (route.needsCode && project?.workspaceReady) return null;
  if (attachments.length || autoContext.length || intent.continuationHint) return null;

  // A short conversational turn is still a complete request.  Do not turn
  // greetings, thanks, or simple social replies into a blocking choice gate.
  const conversationalTurn = /^(?:こんにちは|こんばんは|おはよう(?:ございます)?|やあ|もしもし|はじめまして|よろしく(?:お願いします)?|ありがとう(?:ございます)?|どうも|元気(?:ですか)?|[Hh]ello|[Hh]i|[Tt]hanks?)\s*[!！。.、]*$/u.test(text);
  if (conversationalTurn) return null;

  const compact = text.replace(/\s+/g, "");
  const vagueReference = /^(これ|それ|あれ|この感じ|こんな感じ|いい感じに|お願い|やって|進めて|直して|改善して|作って|どうする|なにする|続き|もっと)$/i.test(compact);
  const weakInstruction = intent.isTerse && !/(コード|作成|実装|修正|画像|動画|検索|説明|教えて|ChatGPT|賢く|フォルダー|ファイル|LP|UI|API|html|css|js|code|fix|make|build)/i.test(text);
  if (!vagueReference && !weakInstruction) return null;

  const hints = recentActionHints(project);
  const recommendedPrompt = hints[0]
    ? `${text}\n前回の作業メモを優先して、最も自然な次の一手として進めて: ${hints[0]}`
    : `${text}\nNexaが一番自然な解釈を選び、安全な既定値で進めて。`;
  const codePrompt = project?.workspaceReady
    ? `${text}\nこの選択中フォルダー内のアプリ改善・コード作業として進めて。`
    : text;

  return {
    id: id("choice"),
    title: "どの方向で進めますか？",
    body: hints.length
      ? "短い依頼なので、記憶から候補を出しました。選ぶだけで続けられます。"
      : "短い依頼なので、本文に質問を書かず選択肢に分けました。",
    options: [
      {
        id: "continue-recommended",
        label: "おすすめで続ける",
        description: hints[0] || "Nexaが文脈から一番自然な進め方を選びます。",
        action: "send-prompt",
        prompt: recommendedPrompt
      },
      {
        id: "code-work",
        label: project?.workspaceReady ? "コード作業にする" : "フォルダーを選ぶ",
        description: project?.workspaceReady
          ? "選択フォルダー内の開発タスクとして扱います。"
          : "PCのフォルダーを選んでから、Codex風にコードを書きます。",
        action: project?.workspaceReady ? "send-prompt" : "folder-picker",
        prompt: codePrompt
      },
      {
        id: "chat-outline",
        label: "会話で整理する",
        description: "まず短く方針・要点だけ整理します。",
        action: "send-prompt",
        prompt: `${text}\nまず会話として、要点と次の候補を短く整理して。`
      }
    ]
  };
}

function isDestructiveOperationRequest(userText = "") {
  const text = String(userText || "");
  const fileDestruction = /(?:ファイル|フォルダー|ディレクトリ|作業フォルダー|中身|内容|プロジェクト).{0,18}(?:すべて|全部|一度|一回)?(?:を)?(?:削除|消して|初期化)|(?:すべて|全部|全).{0,8}(?:ファイル|フォルダー|中身|内容).{0,8}(?:削除|消して)|(?:削除|消して).{0,12}(?:作り直|一から)/i.test(text);
  const shellDestruction = /\b(?:rm\s+-[a-z]*r|rmdir|del\s+\/s|format\s+[a-z]:|remove-item\b[^\n]*-recurse|git\s+clean\s+-|git\s+reset\s+--hard)\b/i.test(text);
  const secrets = /api key|token|secret|password|環境変数|APIキー|トークン|パスワード/i.test(text);
  return fileDestruction || shellDestruction || secrets;
}

function dangerousActionChoiceRequest(project, userText = "", route = {}) {
  const text = String(userText || "");
  if (normalizeAccessLevel(project?.accessLevel) === "full") return null;
  if (!isDestructiveOperationRequest(text)) return null;
  if (/(実行せず|実行しない|削除せず|変更せず|説明だけ|計画だけ|リスクだけ)/i.test(text)) return null;
  return {
    id: id("choice"),
    title: "安全確認が必要です",
    body: "危険な操作や秘密情報に触れる可能性があります。実行方法を選んでください。",
    options: [
      {
        id: "safe-plan",
        label: "安全な計画だけ出す",
        description: "実行や削除はせず、手順とリスクを整理します。",
        action: "send-prompt",
        prompt: `${text}\nまだ実行せず、安全な計画と確認ポイントだけ出して。`
      },
      {
        id: "workspace-delete-confirm",
        label: "選択フォルダー内の削除を承認",
        description: "対象を選択フォルダー内に限定し、削除対象を確認してから再作成します。",
        action: project?.workspaceReady ? "send-prompt" : "folder-picker",
        prompt: `${text}\nこの選択で、選択フォルダー内に限定した削除を明示的に承認しました。削除対象を記録してから再作成して。`
      },
      {
        id: "explain-risk",
        label: "リスクを説明",
        description: "何が危険かだけを説明します。",
        action: "send-prompt",
        prompt: `${text}\n実行せず、危険性と安全な代替案だけ説明して。`
      }
    ]
  };
}

function alwaysApprovalChoiceRequest(project, userText = "", route = {}) {
  if (normalizeAccessLevel(project?.accessLevel) !== "default") return null;
  const text = String(userText || "");
  const externalOperation = route.needsCode || route.needsResearch ||
    /(internet|web|https?:\/\/|download|upload|powershell|terminal|command|windows|アプリを開|コマンド|インターネット|ウェブ|検索|ダウンロード|アップロード|ファイル.*(?:編集|変更|作成|削除))/i.test(text);
  if (!externalOperation) return null;
  return {
    id: id("choice"),
    title: "実行前の承認",
    body: "承認を常に求めるモードです。外部ファイル、ネットワーク、コマンド、Windows操作を開始する前に確認します。",
    options: [
      {
        id: "approve-once",
        label: "今回だけ承認",
        description: "この依頼に必要な外部操作だけを許可します。",
        action: "send-prompt",
        prompt: `${text}\nこの依頼に必要な外部操作を今回だけ承認します。`
      },
      {
        id: "safe-plan",
        label: "計画だけ確認",
        description: "まだ実行せず、予定する操作と対象だけ表示します。",
        action: "send-prompt",
        prompt: `${text}\nまだ実行せず、操作対象、コマンド、ネットワーク利用の計画だけ示して。`
      }
    ]
  };
}

function isNonExecutingSafetyRequest(userText = "") {
  const text = String(userText || "");
  const dangerous = isDestructiveOperationRequest(text);
  const noExecution = /(実行せず|実行しない|削除せず|変更せず|説明だけ|計画だけ|リスクだけ)/i.test(text);
  return dangerous && noExecution;
}

function preflightChoiceRequest(project, userText = "", route = {}, attachments = [], autoContext = [], choiceResolution = null) {
  // Chat mode is intentionally conversation-only. It must not turn a casual
  // message into a code/folder workflow or block the reply behind a chooser.
  if (route.modeForcedChat) return null;
  // A selection from this gate is an explicit answer, not a fresh dangerous
  // request. Re-running the same gate would trap the user in an infinite loop.
  if (choiceResolution?.requestId && choiceResolution?.optionId) return null;
  if (normalizeAccessLevel(project?.accessLevel) === "full") return null;
  return dangerousActionChoiceRequest(project, userText, route) ||
    alwaysApprovalChoiceRequest(project, userText, route) ||
    ambiguityChoiceRequest(project, userText, route, attachments, autoContext);
}

function choiceRequestIntro(choiceRequest = {}) {
  return choiceRequest.title === "安全確認が必要です"
    ? "この操作は安全確認を挟みます。下の選択肢から進め方を選んでください。"
    : "短い依頼として受け取りました。下の選択肢から進め方を選べます。";
}

function resolveLatestChoiceRequest(project) {
  const message = [...(project?.messages || [])]
    .reverse()
    .find((item) => item.role === "assistant" && item.choiceRequest);
  if (!message) return false;
  delete message.choiceRequest;
  message.choiceResolvedAt = now();
  return true;
}

function videoDisabledChoiceRequest(userText = "") {
  const clean = clip(String(userText || "").replace(/^(動画生成|video generation)\s*[:：]?\s*/i, "").trim(), 240);
  const prompt = clean || "シネマティックなコンセプト画像";
  return {
    id: id("choice"),
    title: "画像生成に切り替えますか？",
    body: "このビルドでは動画生成を外し、画像生成だけを残しています。",
    options: [
      {
        label: "画像で生成",
        description: "同じ内容を1枚の完成イメージとして生成します。",
        action: "send-prompt",
        prompt: `画像生成: ${prompt}`
      },
      {
        label: "絵コンテ化",
        description: "動画の代わりに、画像生成しやすい場面案へ分解します。",
        action: "send-prompt",
        prompt: `${prompt}\nこの内容を画像生成用の3場面ストーリーボードに分解して。`
      }
    ]
  };
}

function splitParagraphs(text = "") {
  return String(text || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function moveQuestionToChoiceRequest(content = "", project, userText = "", route = {}) {
  const paragraphs = splitParagraphs(content);
  if (!paragraphs.length) return { content, choiceRequest: null };
  const last = paragraphs[paragraphs.length - 1] || "";
  const asksChoice = /[？?]$|教えてください|選んでください|選択してください|どちら|どれ|必要ですか|ありますか|しますか|よろしいですか|どうしますか|どの方向/.test(last);
  if (!asksChoice) return { content, choiceRequest: null };
  const withoutQuestion = paragraphs.slice(0, -1).join("\n\n").trim();
  return {
    content: withoutQuestion || "選択肢から進め方を選べます。",
    choiceRequest: answerChoiceRequest(project, userText, route)
  };
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapPromptLines(value, maxChars = 25, maxLines = 4) {
  const clean = String(value || "Untitled")
    .replace(/\s+/g, " ")
    .trim();
  const hasSpaces = /\s/.test(clean);
  const tokens = hasSpaces ? clean.split(" ") : [...clean];
  const lines = [];
  let current = "";
  for (const token of tokens) {
    const next = hasSpaces
      ? (current ? `${current} ${token}` : token)
      : `${current}${token}`;
    if ([...next].length > maxChars && current) {
      lines.push(current);
      current = token;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && tokens.length) {
    const originalLength = [...clean].length;
    const visibleLength = lines.reduce((sum, line) => sum + [...line].length, 0);
    if (visibleLength < originalLength) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.。…]+$/, "")}...`;
  }
  return lines.length ? lines : ["Untitled"];
}

function generatedPalette(prompt) {
  const hash = hashText(prompt || "generated-artifact");
  const hue = parseInt(hash.slice(0, 4), 16) % 360;
  const hueB = (hue + 56 + (parseInt(hash.slice(4, 6), 16) % 44)) % 360;
  const hueC = (hue + 196 + (parseInt(hash.slice(6, 8), 16) % 40)) % 360;
  return {
    hue,
    bgA: `hsl(${hue} 72% 14%)`,
    bgB: `hsl(${hueB} 78% 28%)`,
    glowA: `hsl(${hueC} 92% 64%)`,
    glowB: `hsl(${(hue + 118) % 360} 92% 58%)`,
    ink: "#f7f8ff"
  };
}

function generatedTitle(prompt, kind) {
  const clean = String(prompt || "").replace(/\s+/g, " ").trim();
  const prefix = kind === "video" ? "Video" : "Image";
  return `${prefix}: ${clip(clean || "Untitled", 48)}`;
}

function generatedImageSvg(prompt, artifactId) {
  const palette = generatedPalette(prompt);
  const lines = wrapPromptLines(prompt, 28, 4);
  const tspans = lines
    .map((line, index) => `<tspan x="96" dy="${index ? 56 : 0}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(generatedTitle(prompt, "image"))}</title>
  <desc id="desc">Local generated image preview for prompt ${escapeXml(prompt)}.</desc>
  <defs>
    <linearGradient id="bg-${artifactId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.bgA}"/>
      <stop offset="0.48" stop-color="${palette.bgB}"/>
      <stop offset="1" stop-color="#090a10"/>
    </linearGradient>
    <radialGradient id="glow-${artifactId}" cx="72%" cy="28%" r="52%">
      <stop offset="0" stop-color="${palette.glowA}" stop-opacity="0.95"/>
      <stop offset="0.46" stop-color="${palette.glowB}" stop-opacity="0.24"/>
      <stop offset="1" stop-color="${palette.glowB}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid-${artifactId}" width="42" height="42" patternUnits="userSpaceOnUse">
      <path d="M42 0H0v42" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    </pattern>
    <filter id="soft-${artifactId}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="28"/>
    </filter>
  </defs>
  <rect width="1280" height="720" fill="url(#bg-${artifactId})"/>
  <rect width="1280" height="720" fill="url(#grid-${artifactId})" opacity="0.55"/>
  <rect width="1280" height="720" fill="url(#glow-${artifactId})"/>
  <circle cx="1014" cy="168" r="148" fill="${palette.glowA}" opacity="0.34" filter="url(#soft-${artifactId})"/>
  <circle cx="282" cy="560" r="190" fill="${palette.glowB}" opacity="0.22" filter="url(#soft-${artifactId})"/>
  <path d="M0 590 C 205 492 326 650 526 552 S 872 404 1280 514 V720 H0Z" fill="rgba(255,255,255,0.09)"/>
  <g transform="translate(760 142)" opacity="0.96">
    <rect x="0" y="0" width="336" height="336" rx="58" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.26)"/>
    <path d="M77 216 C140 108 207 108 269 216" fill="none" stroke="${palette.ink}" stroke-width="18" stroke-linecap="round" opacity="0.88"/>
    <circle cx="113" cy="134" r="32" fill="${palette.glowA}"/>
    <circle cx="224" cy="134" r="32" fill="${palette.glowB}"/>
    <path d="M104 246 H235" stroke="${palette.ink}" stroke-width="18" stroke-linecap="round" opacity="0.72"/>
  </g>
  <g transform="translate(76 86)">
    <text x="0" y="0" fill="rgba(255,255,255,0.68)" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3">GENERATED IMAGE</text>
    <text x="20" y="132" fill="${palette.ink}" font-family="Inter, Arial, sans-serif" font-size="48" font-weight="760">${tspans}</text>
  </g>
  <g transform="translate(92 628)">
    <rect x="0" y="-36" width="270" height="56" rx="28" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.22)"/>
    <circle cx="35" cy="-8" r="10" fill="${palette.glowA}"/>
    <text x="58" y="0" fill="rgba(255,255,255,0.82)" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="650">local SVG preview</text>
  </g>
</svg>`;
}

function generatedVideoSvg(prompt, artifactId) {
  const palette = generatedPalette(prompt);
  const lines = wrapPromptLines(prompt, 26, 3);
  const tspans = lines
    .map((line, index) => `<tspan x="90" dy="${index ? 46 : 0}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(generatedTitle(prompt, "video"))}</title>
  <desc id="desc">Local generated animated video preview for prompt ${escapeXml(prompt)}.</desc>
  <defs>
    <linearGradient id="video-bg-${artifactId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07080f"/>
      <stop offset="0.52" stop-color="${palette.bgB}"/>
      <stop offset="1" stop-color="${palette.bgA}"/>
    </linearGradient>
    <filter id="video-soft-${artifactId}" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="24"/>
    </filter>
    <style>
      @keyframes drift-${artifactId} { 0% { transform: translateX(-160px); opacity: .42; } 50% { opacity: .92; } 100% { transform: translateX(1380px); opacity: .42; } }
      @keyframes pulse-${artifactId} { 0%, 100% { opacity: .42; transform: scale(.92); } 50% { opacity: .95; transform: scale(1.08); } }
      @keyframes rise-${artifactId} { 0% { transform: translateY(40px); opacity: .2; } 45% { opacity: .86; } 100% { transform: translateY(-40px); opacity: .2; } }
      .orb-${artifactId} { transform-origin: center; animation: pulse-${artifactId} 4.8s ease-in-out infinite; }
      .track-${artifactId} { animation: drift-${artifactId} 7.5s linear infinite; }
      .track2-${artifactId} { animation: drift-${artifactId} 10s linear infinite reverse; }
      .caption-${artifactId} { animation: rise-${artifactId} 5.6s ease-in-out infinite; }
    </style>
  </defs>
  <rect width="1280" height="720" fill="url(#video-bg-${artifactId})"/>
  <g opacity="0.32">
    <path class="track-${artifactId}" d="M-120 164 H140" stroke="${palette.glowA}" stroke-width="8" stroke-linecap="round"/>
    <path class="track2-${artifactId}" d="M-240 520 H120" stroke="${palette.glowB}" stroke-width="6" stroke-linecap="round"/>
    <path class="track-${artifactId}" d="M-420 356 H-80" stroke="white" stroke-width="3" stroke-linecap="round"/>
  </g>
  <circle class="orb-${artifactId}" cx="920" cy="214" r="162" fill="${palette.glowA}" opacity="0.38" filter="url(#video-soft-${artifactId})"/>
  <circle class="orb-${artifactId}" cx="378" cy="512" r="206" fill="${palette.glowB}" opacity="0.24" filter="url(#video-soft-${artifactId})"/>
  <g transform="translate(746 156)">
    <rect x="0" y="0" width="390" height="256" rx="42" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.24)"/>
    <polygon points="154,76 154,180 248,128" fill="rgba(255,255,255,0.92)"/>
    <rect x="58" y="210" width="274" height="12" rx="6" fill="rgba(255,255,255,0.18)"/>
    <rect x="58" y="210" width="156" height="12" rx="6" fill="${palette.glowA}">
      <animate attributeName="width" values="60;274;60" dur="5.8s" repeatCount="indefinite"/>
    </rect>
  </g>
  <g class="caption-${artifactId}" transform="translate(0 0)">
    <text x="90" y="124" fill="rgba(255,255,255,0.68)" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="750" letter-spacing="3">GENERATED VIDEO</text>
    <text x="90" y="252" fill="#f7f8ff" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="760">${tspans}</text>
  </g>
  <g transform="translate(90 616)">
    <rect x="0" y="-36" width="330" height="58" rx="29" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.23)"/>
    <circle cx="36" cy="-7" r="10" fill="${palette.glowB}">
      <animate attributeName="opacity" values=".35;1;.35" dur="1.4s" repeatCount="indefinite"/>
    </circle>
    <text x="60" y="0" fill="rgba(255,255,255,0.82)" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="650">animated SVG video preview</text>
  </g>
</svg>`;
}

function hashByte(hash, index) {
  const value = parseInt(String(hash || "").slice(index * 2, index * 2 + 2), 16);
  return Number.isFinite(value) ? value : 0;
}

function generatedPoints(seed, count, width, height) {
  const hash = hashText(seed || "media-points");
  return Array.from({ length: count }, (_, index) => ({
    x: Math.round((hashByte(hash, index % 16) / 255) * width),
    y: Math.round((hashByte(hash, (index + 5) % 16) / 255) * height),
    r: 1 + (hashByte(hash, (index + 9) % 16) % 4),
    opacity: 0.24 + (hashByte(hash, (index + 13) % 16) / 255) * 0.62
  }));
}

function inferMediaTheme(prompt = "") {
  const text = String(prompt || "");
  const lower = text.toLowerCase();
  const has = (terms) => terms.some((term) => lower.includes(String(term).toLowerCase()) || text.includes(term));
  if (has(["space", "galaxy", "star", "planet", "\u5b87\u5b99", "\u661f", "\u9280\u6cb3", "\u60d1\u661f"])) return "space";
  if (has(["ocean", "sea", "wave", "beach", "\u6d77", "\u6ce2", "\u6d5c\u8fba", "\u6df1\u6d77"])) return "ocean";
  if (has(["forest", "mountain", "nature", "flower", "\u68ee", "\u5c71", "\u81ea\u7136", "\u82b1", "\u8349\u539f"])) return "nature";
  if (has(["city", "neon", "tokyo", "cyber", "street", "\u90fd\u5e02", "\u8857", "\u591c", "\u30cd\u30aa\u30f3"])) return "city";
  if (has(["dashboard", "app", "ui", "screen", "phone", "product", "\u30a2\u30d7\u30ea", "\u753b\u9762", "\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9", "\u30b5\u30fc\u30d3\u30b9"])) return "product";
  if (has(["person", "portrait", "hero", "girl", "boy", "character", "\u4eba", "\u4eba\u7269", "\u30ad\u30e3\u30e9", "\u30d2\u30fc\u30ed\u30fc"])) return "character";
  if (has(["soccer", "sport", "stadium", "\u30b5\u30c3\u30ab\u30fc", "\u30b9\u30dd\u30fc\u30c4", "\u30b9\u30bf\u30b8\u30a2\u30e0"])) return "sport";
  return "cinematic";
}

function mediaPlan(prompt = "", kind = "image", options = {}) {
  const hash = hashText(`${kind}:${prompt}`);
  const theme = inferMediaTheme(prompt);
  const hue = parseInt(hash.slice(0, 4), 16) % 360;
  const presets = {
    city: { bgA: "#070914", bgB: `hsl(${(hue + 238) % 360} 78% 24%)`, a: "#64f3ff", b: "#ff4fd8", mood: "night neon city" },
    space: { bgA: "#03040b", bgB: "#14133d", a: "#8cecff", b: "#b18cff", mood: "deep space" },
    ocean: { bgA: "#031421", bgB: "#064866", a: "#5ee6ff", b: "#76ffbf", mood: "wide ocean" },
    nature: { bgA: "#06140f", bgB: "#19432c", a: "#9dff84", b: "#ffe37a", mood: "lush natural landscape" },
    product: { bgA: "#071018", bgB: "#172033", a: "#74a8ff", b: "#67ffd0", mood: "premium product interface" },
    character: { bgA: "#120914", bgB: "#2d1c45", a: "#ffd1f1", b: "#8ed7ff", mood: "dramatic character portrait" },
    sport: { bgA: "#07180b", bgB: "#113b21", a: "#d8ff66", b: "#4db3ff", mood: "energetic stadium" },
    cinematic: { bgA: `hsl(${hue} 70% 10%)`, bgB: `hsl(${(hue + 42) % 360} 72% 24%)`, a: `hsl(${(hue + 190) % 360} 92% 68%)`, b: `hsl(${(hue + 95) % 360} 92% 62%)`, mood: "cinematic abstract scene" }
  };
  const palette = presets[theme] || presets.cinematic;
  return {
    prompt,
    kind,
    theme,
    palette,
    mood: palette.mood,
    seed: hash,
    durationSec: kind === "video" ? Math.max(8, Number(options.durationSec || 14)) : 0,
    points: generatedPoints(hash, kind === "video" ? 46 : 34, 1280, 720)
  };
}

function starField(plan, opacity = 1) {
  return plan.points
    .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="${point.r}" fill="white" opacity="${(point.opacity * opacity).toFixed(2)}"/>`)
    .join("");
}

function cinematicImageLayers(plan, artifactId) {
  const { palette, theme } = plan;
  const glow = `filter="url(#soft-${artifactId})"`;
  if (theme === "city") {
    const buildings = Array.from({ length: 15 }, (_, index) => {
      const x = index * 92 - 18;
      const h = 120 + (hashByte(plan.seed, index) % 190);
      return `<rect x="${x}" y="${570 - h}" width="70" height="${h}" rx="8" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.12)"/>
      <path d="M${x + 14} ${570 - h + 32} H${x + 54} M${x + 14} ${570 - h + 72} H${x + 54} M${x + 14} ${570 - h + 112} H${x + 54}" stroke="${index % 2 ? palette.a : palette.b}" stroke-width="3" opacity="0.55"/>`;
    }).join("");
    return `${buildings}<path d="M0 608 C220 548 384 674 620 602 S1010 514 1280 580 V720 H0Z" fill="rgba(255,255,255,0.08)"/><path d="M60 654 C340 596 688 678 1220 620" stroke="${palette.a}" stroke-width="6" opacity="0.58" fill="none"/><path d="M0 688 C320 628 780 712 1280 650" stroke="${palette.b}" stroke-width="4" opacity="0.48" fill="none"/>`;
  }
  if (theme === "space") {
    return `${starField(plan, 0.85)}<circle cx="902" cy="242" r="154" fill="${palette.b}" opacity="0.95"/><circle cx="850" cy="196" r="172" fill="rgba(255,255,255,0.11)"/><ellipse cx="902" cy="250" rx="264" ry="48" fill="none" stroke="${palette.a}" stroke-width="9" opacity="0.55"/><path d="M218 505 L302 470 L280 552 Z" fill="${palette.a}" opacity="0.9"/><path d="M118 544 C380 418 574 390 832 332" stroke="white" stroke-width="3" opacity="0.42" fill="none"/>`;
  }
  if (theme === "ocean") {
    return `<circle cx="1018" cy="158" r="82" fill="${palette.b}" opacity="0.85" ${glow}/><path d="M0 430 C150 386 270 474 426 430 S740 374 918 428 S1140 498 1280 430 V720 H0Z" fill="#07516a" opacity="0.82"/><path d="M0 520 C178 468 300 558 480 512 S746 470 934 522 S1120 574 1280 520 V720 H0Z" fill="#043042" opacity="0.94"/><path d="M70 482 C190 450 258 514 382 484 M486 550 C610 514 720 586 846 548 M906 444 C1030 408 1138 486 1238 446" stroke="${palette.a}" stroke-width="6" opacity="0.58" fill="none"/><path d="M560 340 L648 500 L472 500 Z" fill="rgba(255,255,255,0.86)"/><rect x="458" y="500" width="224" height="26" rx="13" fill="rgba(255,255,255,0.48)"/>`;
  }
  if (theme === "nature") {
    const trees = Array.from({ length: 11 }, (_, index) => {
      const x = 80 + index * 112;
      const y = 422 + (index % 3) * 32;
      return `<path d="M${x} ${y} l42 112 h-84 Z" fill="${index % 2 ? "#1b6b3d" : "#289654"}" opacity="0.78"/><rect x="${x - 8}" y="${y + 82}" width="16" height="92" rx="8" fill="#5b3b25" opacity="0.74"/>`;
    }).join("");
    return `<circle cx="1030" cy="146" r="76" fill="${palette.b}" opacity="0.86" ${glow}/><path d="M0 474 C190 330 324 420 468 308 S780 246 1020 420 S1160 460 1280 372 V720 H0Z" fill="#123d28"/><path d="M0 560 C224 416 444 548 626 420 S924 368 1280 512 V720 H0Z" fill="#0d2c20"/>${trees}`;
  }
  if (theme === "product") {
    return `<rect x="170" y="116" width="940" height="488" rx="54" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.23)"/><rect x="220" y="174" width="272" height="370" rx="30" fill="rgba(255,255,255,0.11)"/><rect x="540" y="174" width="512" height="96" rx="26" fill="rgba(255,255,255,0.12)"/><rect x="540" y="304" width="224" height="240" rx="30" fill="rgba(116,168,255,0.18)" stroke="${palette.a}" opacity="0.82"/><rect x="800" y="304" width="252" height="240" rx="30" fill="rgba(103,255,208,0.14)" stroke="${palette.b}" opacity="0.82"/><path d="M252 468 C312 360 382 394 438 286" stroke="${palette.b}" stroke-width="10" fill="none"/><circle cx="292" cy="424" r="16" fill="${palette.a}"/><circle cx="382" cy="360" r="16" fill="${palette.b}"/>`;
  }
  if (theme === "character") {
    return `<circle cx="640" cy="300" r="150" fill="${palette.a}" opacity="0.28" ${glow}/><path d="M520 566 C536 430 574 354 640 354 S744 430 760 566 Z" fill="rgba(255,255,255,0.17)" stroke="rgba(255,255,255,0.32)"/><circle cx="640" cy="276" r="94" fill="rgba(255,255,255,0.24)" stroke="${palette.a}" stroke-width="5"/><path d="M550 254 C590 164 720 164 758 256 C694 220 614 220 550 254Z" fill="${palette.b}" opacity="0.78"/><path d="M392 606 C456 512 548 494 640 494 S824 512 888 606" stroke="${palette.a}" stroke-width="10" fill="none" opacity="0.62"/>`;
  }
  if (theme === "sport") {
    return `<rect x="0" y="424" width="1280" height="296" fill="#0e5c2f"/><path d="M0 575 H1280 M640 424 V720" stroke="rgba(255,255,255,0.42)" stroke-width="5"/><circle cx="640" cy="575" r="86" fill="none" stroke="rgba(255,255,255,0.42)" stroke-width="5"/><path d="M124 268 C342 174 938 174 1156 268" stroke="${palette.b}" stroke-width="12" opacity="0.45" fill="none"/><circle cx="650" cy="498" r="42" fill="white"/><path d="M626 498 h48 M650 474 v48" stroke="#111" stroke-width="6" opacity="0.55"/>`;
  }
  return `<circle cx="956" cy="180" r="152" fill="${palette.a}" opacity="0.34" ${glow}/><circle cx="300" cy="548" r="210" fill="${palette.b}" opacity="0.24" ${glow}/><path d="M0 590 C205 492 326 650 526 552 S872 404 1280 514 V720 H0Z" fill="rgba(255,255,255,0.09)"/><rect x="422" y="196" width="436" height="318" rx="72" fill="rgba(255,255,255,0.13)" stroke="rgba(255,255,255,0.28)"/><path d="M520 414 C620 246 738 246 838 414" fill="none" stroke="${palette.a}" stroke-width="18" stroke-linecap="round"/>`;
}

function generatedCinematicImageSvg(prompt, artifactId) {
  const plan = mediaPlan(prompt, "image");
  const { palette } = plan;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(generatedTitle(prompt, "image"))}</title>
  <desc id="desc">Prompt-aware generated image scene for ${escapeXml(prompt)}.</desc>
  <defs>
    <linearGradient id="bg-${artifactId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.bgA}"/><stop offset="0.58" stop-color="${palette.bgB}"/><stop offset="1" stop-color="#05060a"/></linearGradient>
    <pattern id="grid-${artifactId}" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0v42" fill="none" stroke="rgba(255,255,255,0.055)" stroke-width="1"/></pattern>
    <filter id="soft-${artifactId}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="28"/></filter>
  </defs>
  <rect width="1280" height="720" fill="url(#bg-${artifactId})"/>
  <rect width="1280" height="720" fill="url(#grid-${artifactId})"/>
  <circle cx="990" cy="150" r="190" fill="${palette.a}" opacity="0.24" filter="url(#soft-${artifactId})"/>
  <circle cx="238" cy="608" r="236" fill="${palette.b}" opacity="0.18" filter="url(#soft-${artifactId})"/>
  <g>${cinematicImageLayers(plan, artifactId)}</g>
  <rect x="34" y="34" width="1212" height="652" rx="42" fill="none" stroke="rgba(255,255,255,0.12)"/>
  <g transform="translate(80 82)" opacity="0.82"><circle cx="0" cy="0" r="8" fill="${palette.a}"/><text x="22" y="7" fill="rgba(255,255,255,0.72)" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="2">LUMEN SCENE RENDER</text></g>
</svg>`;
}

function videoSceneLayers(plan) {
  const { palette, theme } = plan;
  if (theme === "city") return `<g>${cinematicImageLayers({ ...plan, theme: "city" }, "video")}</g><g class="light-trails"><path d="M-120 575 C200 492 452 668 770 566 S1080 510 1400 590"/><path d="M-160 642 C190 578 524 704 892 616 S1168 570 1440 654"/></g><circle class="subject drift" cx="280" cy="512" r="18" fill="${palette.a}"/><circle class="subject drift slow" cx="920" cy="450" r="14" fill="${palette.b}"/>`;
  if (theme === "space") return `<g class="stars">${starField(plan, 0.9)}</g><circle class="planet pulse" cx="898" cy="250" r="156" fill="${palette.b}"/><ellipse class="orbit" cx="898" cy="250" rx="284" ry="52"/><path class="ship fly" d="M160 512 L256 474 L228 570 Z" fill="${palette.a}"/><path class="comet" d="M-100 180 C260 84 560 140 980 42"/>`;
  if (theme === "ocean") return `<circle class="pulse" cx="1032" cy="148" r="84" fill="${palette.b}"/><path class="wave wave-a" d="M-80 456 C110 390 260 506 444 448 S758 390 948 454 S1130 520 1360 450 V760 H-80Z"/><path class="wave wave-b" d="M-80 544 C150 482 306 588 520 526 S820 480 1028 548 S1208 604 1360 540 V760 H-80Z"/><g class="boat float"><path d="M560 330 L650 500 L470 500 Z" fill="rgba(255,255,255,.88)"/><rect x="456" y="500" width="226" height="28" rx="14" fill="rgba(255,255,255,.46)"/></g>`;
  if (theme === "nature") return `<circle class="pulse" cx="1038" cy="148" r="76" fill="${palette.b}"/><path class="hill back" d="M-80 482 C210 322 350 430 506 300 S820 248 1060 430 S1210 466 1360 372 V760 H-80Z"/><path class="hill front" d="M-80 574 C222 422 456 548 650 420 S946 374 1360 516 V760 H-80Z"/><g class="forest sway">${Array.from({ length: 12 }, (_, index) => { const x = 60 + index * 112; const y = 414 + (index % 3) * 34; return `<path d="M${x} ${y} l44 116 h-88 Z"/><rect x="${x - 8}" y="${y + 84}" width="16" height="92" rx="8"/>`; }).join("")}</g>`;
  if (theme === "product") return `<rect class="panel zoom" x="170" y="116" width="940" height="488" rx="54"/><rect class="panel-card rise" x="220" y="174" width="272" height="370" rx="30"/><rect class="panel-card rise delay" x="540" y="174" width="512" height="96" rx="26"/><rect class="module glow" x="540" y="304" width="224" height="240" rx="30"/><rect class="module glow delay" x="800" y="304" width="252" height="240" rx="30"/><path class="chart draw" d="M252 468 C312 360 382 394 438 286"/>`;
  if (theme === "character") return `<circle class="aura pulse" cx="640" cy="300" r="172" fill="${palette.a}"/><path class="body rise" d="M520 566 C536 430 574 354 640 354 S744 430 760 566 Z"/><circle class="face rise" cx="640" cy="276" r="94"/><path class="hair drift-small" d="M550 254 C590 164 720 164 758 256 C694 220 614 220 550 254Z" fill="${palette.b}"/><path class="arc draw" d="M392 606 C456 512 548 494 640 494 S824 512 888 606"/>`;
  if (theme === "sport") return `<rect x="0" y="424" width="1280" height="296" fill="#0e5c2f"/><path class="field-line" d="M0 575 H1280 M640 424 V720"/><circle class="field-line" cx="640" cy="575" r="86"/><circle class="ball kick" cx="650" cy="498" r="42" fill="white"/><path class="crowd pulse" d="M124 268 C342 174 938 174 1156 268"/>`;
  return `<circle class="aura pulse" cx="956" cy="180" r="180" fill="${palette.a}"/><circle class="aura drift-small" cx="300" cy="548" r="220" fill="${palette.b}"/><path class="wave wave-a" d="M-80 590 C205 492 326 650 526 552 S872 404 1360 514 V760 H-80Z"/><rect class="panel zoom" x="422" y="196" width="436" height="318" rx="72"/><path class="arc draw" d="M520 414 C620 246 738 246 838 414"/>`;
}

function generatedCinematicVideoHtml(prompt, artifactId, options = {}) {
  const plan = mediaPlan(prompt, "video", options);
  const { palette, durationSec } = plan;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeXml(generatedTitle(prompt, "video"))}</title><style>
html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#03040a}body{display:grid;place-items:center;font-family:Inter,Arial,sans-serif}svg{width:100vw;height:100vh;display:block;background:${palette.bgA}}.frame{animation:camera ${durationSec}s ease-in-out infinite;transform-origin:50% 50%}.bg{fill:url(#bg)}.grain{opacity:.18;mix-blend-mode:screen}.scene,.subject,.aura,.panel,.panel-card,.module{transform-box:fill-box;transform-origin:center}.light-trails path{fill:none;stroke:${palette.a};stroke-width:7;stroke-linecap:round;opacity:.55;animation:trail ${durationSec / 2}s linear infinite}.light-trails path:nth-child(2){stroke:${palette.b};animation-duration:${durationSec / 1.7}s;animation-direction:reverse}.pulse{animation:pulse ${durationSec / 3}s ease-in-out infinite;transform-origin:center;opacity:.75}.drift{animation:drift ${durationSec / 1.25}s linear infinite}.slow{animation-duration:${durationSec / 0.9}s;animation-direction:reverse}.drift-small{animation:driftSmall ${durationSec / 2.2}s ease-in-out infinite}.fly{animation:fly ${durationSec / 1.35}s cubic-bezier(.2,.8,.2,1) infinite;transform-origin:center}.comet{fill:none;stroke:${palette.a};stroke-width:4;stroke-linecap:round;opacity:.54;animation:comet ${durationSec / 1.8}s linear infinite}.orbit{fill:none;stroke:${palette.a};stroke-width:8;opacity:.48}.wave{opacity:.86;animation:waves ${durationSec / 2.4}s ease-in-out infinite alternate}.wave-a{fill:${palette.bgB}}.wave-b{fill:rgba(0,0,0,.28);animation-delay:-2s}.float{animation:float ${durationSec / 3}s ease-in-out infinite;transform-origin:center}.hill.back{fill:rgba(80,180,96,.34)}.hill.front{fill:rgba(28,94,54,.9);animation:hill ${durationSec / 2}s ease-in-out infinite alternate}.forest path{fill:rgba(94,210,112,.74)}.forest rect{fill:rgba(98,58,28,.75)}.sway{animation:sway ${durationSec / 2.8}s ease-in-out infinite;transform-origin:bottom center}.panel{fill:rgba(255,255,255,.09);stroke:rgba(255,255,255,.24)}.panel-card{fill:rgba(255,255,255,.11)}.module{fill:rgba(255,255,255,.13);stroke:${palette.a};stroke-width:3}.chart,.draw,.arc{fill:none;stroke:${palette.b};stroke-width:10;stroke-linecap:round;stroke-dasharray:720;animation:draw ${durationSec / 1.6}s ease-in-out infinite}.rise{animation:rise ${durationSec / 2.6}s ease-in-out infinite}.delay{animation-delay:-2.4s}.aura{opacity:.28;filter:blur(12px)}.body{fill:rgba(255,255,255,.17);stroke:rgba(255,255,255,.32)}.face{fill:rgba(255,255,255,.24);stroke:${palette.a};stroke-width:5}.field-line{fill:none;stroke:rgba(255,255,255,.42);stroke-width:5}.ball{animation:kick ${durationSec / 2.2}s cubic-bezier(.2,.8,.2,1) infinite;transform-origin:center}.crowd{fill:none;stroke:${palette.b};stroke-width:12;opacity:.45}.watermark{opacity:.55}@keyframes camera{0%,100%{transform:scale(1) translate(0,0)}50%{transform:scale(1.06) translate(-18px,10px)}}@keyframes trail{from{transform:translateX(-420px);opacity:.22}50%{opacity:.85}to{transform:translateX(540px);opacity:.22}}@keyframes pulse{0%,100%{transform:scale(.92);opacity:.42}50%{transform:scale(1.08);opacity:.86}}@keyframes drift{from{transform:translateX(-260px)}to{transform:translateX(1320px)}}@keyframes driftSmall{0%,100%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(24px,-18px) rotate(2deg)}}@keyframes fly{0%{transform:translate(-180px,80px) rotate(-8deg);opacity:.1}18%,78%{opacity:1}100%{transform:translate(1160px,-230px) rotate(8deg);opacity:.1}}@keyframes comet{from{transform:translateX(-320px);opacity:.1}40%{opacity:.86}to{transform:translateX(520px);opacity:.1}}@keyframes waves{from{transform:translateX(-48px) translateY(0)}to{transform:translateX(48px) translateY(18px)}}@keyframes float{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-24px) rotate(2deg)}}@keyframes hill{from{transform:translateY(0)}to{transform:translateY(18px)}}@keyframes sway{0%,100%{transform:skewX(-1.5deg)}50%{transform:skewX(2deg)}}@keyframes rise{0%,100%{transform:translateY(20px);opacity:.72}50%{transform:translateY(-14px);opacity:1}}@keyframes draw{0%{stroke-dashoffset:720;opacity:.22}45%,65%{stroke-dashoffset:0;opacity:.95}100%{stroke-dashoffset:-720;opacity:.22}}@keyframes kick{0%{transform:translate(-520px,64px) scale(.82)}44%{transform:translate(0,0) scale(1)}100%{transform:translate(560px,-120px) scale(.76)}}</style></head><body><svg viewBox="0 0 1280 720" role="img" aria-label="Generated video scene"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.bgA}"/><stop offset="0.56" stop-color="${palette.bgB}"/><stop offset="1" stop-color="#020307"/></linearGradient></defs><rect class="bg" width="1280" height="720"/><g class="grain">${starField(plan, 0.18)}</g><g class="frame">${videoSceneLayers(plan)}</g><rect x="28" y="28" width="1224" height="664" rx="44" fill="none" stroke="rgba(255,255,255,.12)"/><g class="watermark" transform="translate(1050 650)"><circle cx="0" cy="0" r="8" fill="${palette.a}"/><text x="18" y="6" fill="white" font-size="16" font-weight="700" letter-spacing="1">KINO RENDER</text></g></svg></body></html>`;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function normalizeBuiltInVideoDuration(value) {
  return clampNumber(value || process.env.KINO_DEFAULT_DURATION_SEC || 8, 3, 120);
}

function normalizeBuiltInVideoFps(value) {
  return Math.round(clampNumber(value || process.env.KINO_FPS || 12, 8, 24));
}

async function loadBuiltInVideoDeps() {
  if (IMAGE_GENERATION_ONLY) {
    const error = new Error("video_generation_disabled");
    error.code = "video_generation_disabled";
    throw error;
  }
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default || sharpModule;
  if (!sharp) throw new Error("sharp_not_available");
  throw new Error("video_encoder_not_available");
}

function promptHas(prompt, terms) {
  const source = String(prompt || "").toLowerCase();
  return terms.some((term) => source.includes(String(term).toLowerCase()) || String(prompt || "").includes(term));
}

function frameProgress(index, total) {
  if (total <= 1) return 0;
  return index / (total - 1);
}

function smoothStep(value) {
  const t = clampNumber(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function inferKinoSubject(prompt = "", theme = "cinematic") {
  if (promptHas(prompt, ["robot", "android", "mecha", "\u30ed\u30dc\u30c3\u30c8", "\u30a2\u30f3\u30c9\u30ed\u30a4\u30c9", "\u30e1\u30ab"])) return "robot";
  if (promptHas(prompt, ["car", "bike", "train", "vehicle", "racing", "\u8eca", "\u30d0\u30a4\u30af", "\u96fb\u8eca", "\u4e57\u308a\u7269"])) return "vehicle";
  if (promptHas(prompt, ["drone", "rocket", "spaceship", "aircraft", "\u30c9\u30ed\u30fc\u30f3", "\u30ed\u30b1\u30c3\u30c8", "\u5b87\u5b99\u8239", "\u98db\u884c"])) return "aircraft";
  if (promptHas(prompt, ["person", "people", "hero", "character", "portrait", "\u4eba", "\u4eba\u7269", "\u30ad\u30e3\u30e9", "\u30d2\u30fc\u30ed\u30fc"])) return "character";
  if (theme === "product") return "interface";
  if (theme === "sport") return "sport";
  if (theme === "space") return "aircraft";
  return "light";
}

function inferKinoAction(prompt = "") {
  if (promptHas(prompt, ["walk", "walking", "\u6b69", "\u6b69\u304f", "\u6563\u6b69"])) return "walk";
  if (promptHas(prompt, ["run", "running", "race", "racing", "fast", "speed", "drive", "driving", "\u8d70", "\u8d70\u308b", "\u30ec\u30fc\u30b9", "\u9ad8\u901f", "\u30b9\u30d4\u30fc\u30c9"])) return "fast";
  if (promptHas(prompt, ["fly", "flying", "launch", "\u98db", "\u98db\u3076", "\u767a\u5c04"])) return "fly";
  if (promptHas(prompt, ["spin", "orbit", "rotate", "\u56de\u8ee2", "\u5468\u56de"])) return "orbit";
  if (promptHas(prompt, ["show", "demo", "present", "\u7d39\u4ecb", "\u8868\u793a", "\u30c7\u30e2"])) return "reveal";
  return "cinematic";
}

function inferKinoCamera(prompt = "", subject = "light") {
  if (promptHas(prompt, ["close", "close-up", "\u30af\u30ed\u30fc\u30ba\u30a2\u30c3\u30d7", "\u8fd1\u304f"])) return "close-track";
  if (promptHas(prompt, ["wide", "landscape", "\u5e83\u89d2", "\u5f15\u304d"])) return "wide-drift";
  if (promptHas(prompt, ["fast", "speed", "\u9ad8\u901f", "\u30b9\u30d4\u30fc\u30c9"])) return "speed-track";
  if (subject === "interface") return "push-in";
  if (subject === "aircraft") return "aerial-orbit";
  return "cinematic-track";
}

function buildKinoDirection(prompt, plan, durationSec) {
  const subject = inferKinoSubject(prompt, plan.theme);
  const action = inferKinoAction(prompt);
  const camera = inferKinoCamera(prompt, subject);
  const intensity = action === "fast" || camera === "speed-track" ? 1.28 : action === "reveal" ? 0.82 : 1;
  return {
    subject,
    action,
    camera,
    intensity,
    mood: plan.mood,
    durationSec,
    shots: [
      { name: "establish", start: 0, end: 0.32, scale: camera === "close-track" ? 1.03 : 0.98 },
      { name: "action", start: 0.32, end: 0.72, scale: camera === "wide-drift" ? 1.04 : 1.08 },
      { name: "finish", start: 0.72, end: 1, scale: camera === "wide-drift" ? 1.08 : 1.16 }
    ]
  };
}

function kinoShotAt(direction, t) {
  const shots = direction?.shots?.length ? direction.shots : [{ name: "action", start: 0, end: 1, scale: 1.05 }];
  const shot = shots.find((item) => t >= item.start && t <= item.end) || shots[shots.length - 1];
  const span = Math.max(0.001, shot.end - shot.start);
  return { ...shot, local: smoothStep((t - shot.start) / span) };
}

function renderKinoForeground(plan, t, direction) {
  const { palette, theme } = plan;
  const drift = (t * 380 * (direction?.intensity || 1)) % 1280;
  if (theme === "city") {
    return `<g opacity=".22" transform="translate(${-drift.toFixed(1)} 0)"><rect x="0" y="462" width="96" height="258" rx="12" fill="#02040a"/><rect x="310" y="506" width="72" height="214" rx="10" fill="#02040a"/><rect x="660" y="484" width="120" height="236" rx="14" fill="#02040a"/><rect x="1040" y="520" width="92" height="200" rx="12" fill="#02040a"/><rect x="1280" y="462" width="96" height="258" rx="12" fill="#02040a"/><rect x="1590" y="506" width="72" height="214" rx="10" fill="#02040a"/></g>`;
  }
  if (theme === "space") {
    return `<g opacity=".34"><path d="M${(-260 + drift).toFixed(1)} 120 C${(80 + drift).toFixed(1)} 60 ${(380 + drift).toFixed(1)} 180 ${(780 + drift).toFixed(1)} 80" stroke="${palette.a}" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M${(980 - drift).toFixed(1)} 640 C${(760 - drift).toFixed(1)} 560 ${(450 - drift).toFixed(1)} 620 ${(120 - drift).toFixed(1)} 510" stroke="${palette.b}" stroke-width="4" stroke-linecap="round" fill="none"/></g>`;
  }
  if (theme === "ocean") {
    return `<g opacity=".34" transform="translate(${(-drift * 0.4).toFixed(1)} 0)"><path d="M-140 650 C120 592 278 682 520 628 S926 592 1420 650" stroke="${palette.a}" stroke-width="7" fill="none"/><path d="M-80 690 C220 632 468 710 790 660 S1128 636 1480 688" stroke="rgba(255,255,255,.42)" stroke-width="4" fill="none"/></g>`;
  }
  return `<g opacity=".18"><circle cx="${(1080 - drift * 0.28).toFixed(1)}" cy="156" r="138" fill="${palette.a}"/><circle cx="${(210 + drift * 0.18).toFixed(1)}" cy="594" r="188" fill="${palette.b}"/></g>`;
}

function renderKinoWeather(prompt, plan, t) {
  const { palette } = plan;
  if (promptHas(prompt, ["rain", "\u96e8"])) {
    return `<g opacity=".38">${Array.from({ length: 36 }, (_, index) => {
      const x = (index * 47 + t * 640) % 1380 - 50;
      const y = (index * 89 + t * 980) % 820 - 80;
      return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l-30 72" stroke="rgba(210,230,255,.72)" stroke-width="3" stroke-linecap="round"/>`;
    }).join("")}</g>`;
  }
  if (promptHas(prompt, ["snow", "\u96ea"])) {
    return `<g opacity=".62">${Array.from({ length: 42 }, (_, index) => {
      const x = (index * 61 + Math.sin(t * Math.PI * 2 + index) * 22) % 1320 - 20;
      const y = (index * 83 + t * 220) % 760 - 20;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${2 + (index % 4)}" fill="rgba(255,255,255,.82)"/>`;
    }).join("")}</g>`;
  }
  if (promptHas(prompt, ["fire", "flame", "\u706b", "\u708e"])) {
    return `<g opacity=".3"><circle cx="1020" cy="520" r="${(110 + Math.sin(t * Math.PI * 8) * 18).toFixed(1)}" fill="${palette.b}"/><circle cx="940" cy="540" r="${(82 + Math.cos(t * Math.PI * 6) * 14).toFixed(1)}" fill="${palette.a}"/></g>`;
  }
  return "";
}

function renderKinoPostFx(plan, artifactId, t) {
  const { palette } = plan;
  return `<defs><radialGradient id="vignette-${artifactId}" cx="50%" cy="50%" r="72%"><stop offset="58%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(0,0,0,.58)"/></radialGradient><linearGradient id="flare-${artifactId}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(255,255,255,0)"/><stop offset=".45" stop-color="${palette.a}" stop-opacity=".22"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></linearGradient></defs><rect width="1280" height="720" fill="url(#vignette-${artifactId})"/><rect y="0" width="1280" height="44" fill="rgba(0,0,0,.52)"/><rect y="676" width="1280" height="44" fill="rgba(0,0,0,.52)"/><rect x="${(-700 + t * 1860).toFixed(1)}" y="78" width="620" height="42" rx="21" fill="url(#flare-${artifactId})" opacity=".54" transform="rotate(-11 640 360)"/><rect width="1280" height="720" fill="rgba(255,255,255,.018)"/>`;
}

function renderKinoRobotSubject(palette, t, direction = {}) {
  const pace = direction.action === "fast" ? 12 : 8;
  const loop = Math.sin(t * Math.PI * pace);
  const bob = Math.sin(t * Math.PI * pace * 2) * 9;
  const x = direction.action === "reveal" ? 640 : -180 + t * 1580;
  const y = 494 + bob;
  const legA = 18 + loop * 22;
  const legB = -18 - loop * 22;
  const armA = -18 - loop * 18;
  const armB = 18 + loop * 18;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(1.05)">
    <ellipse cx="0" cy="122" rx="92" ry="18" fill="rgba(0,0,0,.32)"/>
    <g transform="rotate(${legA.toFixed(1)} -32 52)"><rect x="-45" y="42" width="26" height="86" rx="13" fill="rgba(255,255,255,.82)"/><rect x="-55" y="114" width="54" height="18" rx="9" fill="${palette.a}"/></g>
    <g transform="rotate(${legB.toFixed(1)} 32 52)"><rect x="19" y="42" width="26" height="86" rx="13" fill="rgba(255,255,255,.78)"/><rect x="0" y="114" width="54" height="18" rx="9" fill="${palette.b}"/></g>
    <rect x="-58" y="-96" width="116" height="148" rx="30" fill="rgba(236,244,255,.92)" stroke="rgba(255,255,255,.72)" stroke-width="5"/>
    <rect x="-42" y="-72" width="84" height="34" rx="17" fill="#111827"/>
    <circle cx="-20" cy="-55" r="7" fill="${palette.a}"/><circle cx="20" cy="-55" r="7" fill="${palette.b}"/>
    <path d="M-24 -20 H24" stroke="#111827" stroke-width="7" stroke-linecap="round" opacity=".55"/>
    <g transform="rotate(${armA.toFixed(1)} -68 -44)"><rect x="-86" y="-64" width="24" height="100" rx="12" fill="rgba(236,244,255,.82)"/><circle cx="-74" cy="44" r="16" fill="${palette.a}"/></g>
    <g transform="rotate(${armB.toFixed(1)} 68 -44)"><rect x="62" y="-64" width="24" height="100" rx="12" fill="rgba(236,244,255,.82)"/><circle cx="74" cy="44" r="16" fill="${palette.b}"/></g>
    <circle cx="0" cy="-118" r="58" fill="rgba(236,244,255,.95)" stroke="rgba(255,255,255,.78)" stroke-width="5"/>
    <rect x="-38" y="-134" width="76" height="38" rx="19" fill="#101624"/>
    <circle cx="-18" cy="-115" r="7" fill="${palette.a}"/><circle cx="18" cy="-115" r="7" fill="${palette.b}"/>
    <path d="M0 -176 V-150" stroke="${palette.a}" stroke-width="6" stroke-linecap="round"/><circle cx="0" cy="-184" r="8" fill="${palette.a}"/>
  </g>`;
}

function renderKinoVehicleSubject(palette, t, direction = {}) {
  const speed = direction.action === "fast" ? 1.25 : 1;
  const x = -230 + t * 1680 * speed;
  const y = 548 + Math.sin(t * Math.PI * 12) * 4;
  const tilt = Math.sin(t * Math.PI * 6) * 1.8;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt.toFixed(2)})">
    <ellipse cx="0" cy="60" rx="170" ry="24" fill="rgba(0,0,0,.34)"/>
    <path d="M-150 18 C-96 -48 8 -58 86 -24 C124 -8 154 18 174 46 H-176 C-176 34 -168 24 -150 18Z" fill="rgba(245,249,255,.9)" stroke="rgba(255,255,255,.75)" stroke-width="5"/>
    <path d="M-70 -26 H42 C70 -24 98 -10 118 12 H-112 C-102 -6 -88 -20 -70 -26Z" fill="#111827" opacity=".82"/>
    <circle cx="-96" cy="48" r="34" fill="#111827"/><circle cx="98" cy="48" r="34" fill="#111827"/>
    <circle cx="-96" cy="48" r="14" fill="${palette.a}"/><circle cx="98" cy="48" r="14" fill="${palette.b}"/>
    <path d="M174 18 C250 4 306 16 374 42" stroke="${palette.a}" stroke-width="8" stroke-linecap="round" opacity=".52" fill="none"/>
    <path d="M-182 34 C-248 16 -302 24 -356 52" stroke="${palette.b}" stroke-width="7" stroke-linecap="round" opacity=".34" fill="none"/>
  </g>`;
}

function renderKinoAircraftSubject(palette, t, direction = {}) {
  const orbit = direction.camera === "aerial-orbit";
  const x = orbit ? 640 + Math.sin(t * Math.PI * 2) * 410 : -180 + t * 1580;
  const y = orbit ? 310 + Math.cos(t * Math.PI * 2) * 110 : 520 - Math.sin(t * Math.PI) * 340;
  const rotate = orbit ? -8 + Math.sin(t * Math.PI * 2) * 18 : -12 + t * 28;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotate.toFixed(1)})">
    <path d="M0 0 L146 -44 L110 8 L148 62 Z" fill="rgba(244,248,255,.92)" stroke="rgba(255,255,255,.7)" stroke-width="4"/>
    <path d="M-78 20 C-36 -18 20 -8 72 2" stroke="${palette.a}" stroke-width="8" stroke-linecap="round" fill="none" opacity=".62"/>
    <path d="M-116 36 C-62 0 -10 6 42 18" stroke="${palette.b}" stroke-width="5" stroke-linecap="round" fill="none" opacity=".44"/>
    <circle cx="132" cy="6" r="10" fill="${palette.a}"/>
  </g>`;
}

function renderKinoCharacterSubject(palette, t, direction = {}) {
  const loop = Math.sin(t * Math.PI * 7);
  const x = direction.action === "reveal" ? 640 + Math.sin(t * Math.PI * 2) * 18 : 130 + t * 1020;
  const y = 520 + Math.sin(t * Math.PI * 14) * 5;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
    <ellipse cx="0" cy="126" rx="80" ry="17" fill="rgba(0,0,0,.34)"/>
    <path d="M-42 118 C-30 28 -22 -22 0 -26 C22 -22 30 28 42 118 Z" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.42)" stroke-width="5"/>
    <circle cx="0" cy="-72" r="48" fill="rgba(255,255,255,.24)" stroke="${palette.a}" stroke-width="5"/>
    <path d="M-42 -88 C-18 -142 58 -130 70 -72 C38 -94 -4 -106 -42 -88Z" fill="${palette.b}" opacity=".76"/>
    <g transform="rotate(${(18 + loop * 22).toFixed(1)} -28 40)"><rect x="-40" y="36" width="20" height="88" rx="10" fill="rgba(255,255,255,.72)"/></g>
    <g transform="rotate(${(-18 - loop * 22).toFixed(1)} 28 40)"><rect x="20" y="36" width="20" height="88" rx="10" fill="rgba(255,255,255,.72)"/></g>
    <path d="M-74 -8 C-34 14 34 14 74 -8" stroke="${palette.a}" stroke-width="8" stroke-linecap="round" fill="none" opacity=".66"/>
  </g>`;
}

function renderKinoInterfaceSubject(palette, t) {
  const draw = 120 + smoothStep(Math.sin(t * Math.PI) * 0.5 + 0.5) * 520;
  return `<g transform="translate(210 140)">
    <rect x="0" y="0" width="860" height="438" rx="42" fill="rgba(255,255,255,.11)" stroke="rgba(255,255,255,.25)" stroke-width="3"/>
    <rect x="36" y="42" width="220" height="330" rx="24" fill="rgba(255,255,255,.1)"/>
    <rect x="292" y="42" width="508" height="82" rx="22" fill="rgba(255,255,255,.12)"/>
    <rect x="292" y="162" width="224" height="210" rx="24" fill="rgba(116,168,255,.18)" stroke="${palette.a}" stroke-width="3"/>
    <rect x="556" y="162" width="244" height="210" rx="24" fill="rgba(103,255,208,.14)" stroke="${palette.b}" stroke-width="3"/>
    <path d="M72 306 C144 214 208 260 276 162 S438 104 ${draw.toFixed(1)} 150" stroke="${palette.b}" stroke-width="10" stroke-linecap="round" fill="none" opacity=".88"/>
    <circle cx="${draw.toFixed(1)}" cy="150" r="14" fill="${palette.a}"/>
  </g>`;
}

function renderKinoSportSubject(palette, t) {
  const x = 130 + t * 1040;
  const y = 560 - Math.sin(t * Math.PI) * 190;
  return `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="36" fill="white"/><path d="M${(x - 28).toFixed(1)} ${y.toFixed(1)} H${(x + 28).toFixed(1)} M${x.toFixed(1)} ${(y - 28).toFixed(1)} V${(y + 28).toFixed(1)}" stroke="#111" stroke-width="6" opacity=".48"/><path d="M${(x - 220).toFixed(1)} ${(y + 90).toFixed(1)} C${(x - 80).toFixed(1)} ${y.toFixed(1)} ${(x + 80).toFixed(1)} ${y.toFixed(1)} ${(x + 220).toFixed(1)} ${(y + 88).toFixed(1)}" stroke="${palette.a}" stroke-width="7" fill="none" opacity=".42"/></g>`;
}

function renderBuiltInRobot(prompt, palette, t) {
  if (!promptHas(prompt, ["robot", "android", "mecha", "ロボット", "アンドロイド", "メカ"])) return "";
  const loop = Math.sin(t * Math.PI * 8);
  const bob = Math.sin(t * Math.PI * 16) * 9;
  const x = -180 + t * 1580;
  const y = 494 + bob;
  const legA = 18 + loop * 22;
  const legB = -18 - loop * 22;
  const armA = -18 - loop * 18;
  const armB = 18 + loop * 18;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(1.05)">
    <ellipse cx="0" cy="122" rx="92" ry="18" fill="rgba(0,0,0,.32)"/>
    <g transform="rotate(${legA.toFixed(1)} -32 52)"><rect x="-45" y="42" width="26" height="86" rx="13" fill="rgba(255,255,255,.82)"/><rect x="-55" y="114" width="54" height="18" rx="9" fill="${palette.a}"/></g>
    <g transform="rotate(${legB.toFixed(1)} 32 52)"><rect x="19" y="42" width="26" height="86" rx="13" fill="rgba(255,255,255,.78)"/><rect x="0" y="114" width="54" height="18" rx="9" fill="${palette.b}"/></g>
    <rect x="-58" y="-96" width="116" height="148" rx="30" fill="rgba(236,244,255,.92)" stroke="rgba(255,255,255,.72)" stroke-width="5"/>
    <rect x="-42" y="-72" width="84" height="34" rx="17" fill="#111827"/>
    <circle cx="-20" cy="-55" r="7" fill="${palette.a}"/><circle cx="20" cy="-55" r="7" fill="${palette.b}"/>
    <path d="M-24 -20 H24" stroke="#111827" stroke-width="7" stroke-linecap="round" opacity=".55"/>
    <g transform="rotate(${armA.toFixed(1)} -68 -44)"><rect x="-86" y="-64" width="24" height="100" rx="12" fill="rgba(236,244,255,.82)"/><circle cx="-74" cy="44" r="16" fill="${palette.a}"/></g>
    <g transform="rotate(${armB.toFixed(1)} 68 -44)"><rect x="62" y="-64" width="24" height="100" rx="12" fill="rgba(236,244,255,.82)"/><circle cx="74" cy="44" r="16" fill="${palette.b}"/></g>
    <circle cx="0" cy="-118" r="58" fill="rgba(236,244,255,.95)" stroke="rgba(255,255,255,.78)" stroke-width="5"/>
    <rect x="-38" y="-134" width="76" height="38" rx="19" fill="#101624"/>
    <circle cx="-18" cy="-115" r="7" fill="${palette.a}"/><circle cx="18" cy="-115" r="7" fill="${palette.b}"/>
    <path d="M0 -176 V-150" stroke="${palette.a}" stroke-width="6" stroke-linecap="round"/><circle cx="0" cy="-184" r="8" fill="${palette.a}"/>
  </g>`;
}

function renderBuiltInMotionLayer(plan, t) {
  const { palette, theme, prompt } = plan;
  const direction = plan.direction || buildKinoDirection(prompt, plan, plan.durationSec || 8);
  if (direction.subject === "robot") return renderKinoRobotSubject(palette, t, direction);
  if (direction.subject === "vehicle") return renderKinoVehicleSubject(palette, t, direction);
  if (direction.subject === "aircraft") return renderKinoAircraftSubject(palette, t, direction);
  if (direction.subject === "character") return renderKinoCharacterSubject(palette, t, direction);
  if (direction.subject === "interface") return renderKinoInterfaceSubject(palette, t, direction);
  if (direction.subject === "sport") return renderKinoSportSubject(palette, t, direction);
  const robot = renderBuiltInRobot(prompt, palette, t);
  if (robot) return robot;
  if (theme === "space") {
    const x = -160 + t * 1540;
    const y = 520 - Math.sin(t * Math.PI) * 340;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(-10 + t * 24).toFixed(1)})"><path d="M0 0 L126 -42 L92 70 Z" fill="${palette.a}"/><path d="M-70 16 C-34 -18 0 -10 42 -2" stroke="rgba(255,255,255,.56)" stroke-width="8" fill="none"/></g>`;
  }
  if (theme === "ocean") {
    const x = 420 + Math.sin(t * Math.PI * 2) * 70;
    const y = 388 + Math.sin(t * Math.PI * 4) * 16;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M110 -92 L200 70 H20 Z" fill="rgba(255,255,255,.9)"/><rect x="0" y="68" width="232" height="30" rx="15" fill="rgba(255,255,255,.46)"/></g>`;
  }
  if (theme === "nature") {
    const x = 210 + t * 760;
    const y = 444 + Math.sin(t * Math.PI * 6) * 12;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle cx="0" cy="-36" r="34" fill="${palette.b}"/><path d="M-52 12 C-22 -42 36 -42 66 12 Z" fill="${palette.a}" opacity=".82"/><path d="M-92 48 C-22 12 48 12 118 48" stroke="rgba(255,255,255,.56)" stroke-width="7" fill="none"/></g>`;
  }
  if (theme === "sport") {
    const x = 130 + t * 1040;
    const y = 560 - Math.sin(t * Math.PI) * 190;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="36" fill="white"/><path d="M${(x - 28).toFixed(1)} ${y.toFixed(1)} H${(x + 28).toFixed(1)} M${x.toFixed(1)} ${(y - 28).toFixed(1)} V${(y + 28).toFixed(1)}" stroke="#111" stroke-width="6" opacity=".48"/>`;
  }
  const x = -160 + t * 1540;
  return `<g opacity=".78"><path d="M${(x - 260).toFixed(1)} 575 C${(x - 40).toFixed(1)} 492 ${(x + 212).toFixed(1)} 668 ${(x + 530).toFixed(1)} 566" stroke="${palette.a}" stroke-width="8" stroke-linecap="round" fill="none"/><circle cx="${x.toFixed(1)}" cy="${(410 + Math.sin(t * Math.PI * 2) * 42).toFixed(1)}" r="30" fill="${palette.b}"/></g>`;
}

function builtInVideoFrameSvg(prompt, artifactId, plan, frameIndex, frameCount) {
  const t = frameProgress(frameIndex, frameCount);
  const { palette } = plan;
  const direction = plan.direction || buildKinoDirection(prompt, plan, plan.durationSec || 8);
  const shot = kinoShotAt(direction, t);
  const cameraScale = shot.scale + Math.sin(t * Math.PI) * 0.035;
  const cameraX = (direction.camera === "wide-drift" ? -46 : -22) * Math.sin(t * Math.PI * 2) - shot.local * 18;
  const cameraY = Math.cos(t * Math.PI * 2) * (direction.camera === "aerial-orbit" ? 22 : 12);
  const trailX = -420 + t * 1720 * direction.intensity;
  const secondaryTrailX = 1280 - t * 1720 * direction.intensity;
  const stars = plan.points
    .map((point, index) => {
      const x = (point.x + t * (index % 2 ? 52 : -34) + 1280) % 1280;
      const y = (point.y + Math.sin(t * Math.PI * 2 + index) * 12 + 720) % 720;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${point.r}" fill="white" opacity="${(point.opacity * 0.22).toFixed(2)}"/>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg-${artifactId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.bgA}"/><stop offset="0.58" stop-color="${palette.bgB}"/><stop offset="1" stop-color="#05060a"/></linearGradient>
    <pattern id="grid-${artifactId}" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0v42" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="1"/></pattern>
    <filter id="soft-${artifactId}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="28"/></filter>
  </defs>
  <rect width="1280" height="720" fill="url(#bg-${artifactId})"/>
  <rect width="1280" height="720" fill="url(#grid-${artifactId})"/>
  <g>${stars}</g>
  ${renderKinoWeather(prompt, plan, t)}
  <g transform="translate(${cameraX.toFixed(1)} ${cameraY.toFixed(1)}) scale(${cameraScale.toFixed(4)})">
    ${cinematicImageLayers(plan, artifactId)}
    <g opacity=".42"><path d="M${trailX.toFixed(1)} 616 C${(trailX + 260).toFixed(1)} 542 ${(trailX + 500).toFixed(1)} 668 ${(trailX + 790).toFixed(1)} 584" stroke="${palette.a}" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M${secondaryTrailX.toFixed(1)} 184 C${(secondaryTrailX - 250).toFixed(1)} 142 ${(secondaryTrailX - 490).toFixed(1)} 260 ${(secondaryTrailX - 780).toFixed(1)} 218" stroke="${palette.b}" stroke-width="5" stroke-linecap="round" fill="none"/></g>
    ${renderBuiltInMotionLayer(plan, t)}
  </g>
  ${renderKinoForeground(plan, t, direction)}
  ${renderKinoPostFx(plan, artifactId, t)}
  <rect x="28" y="28" width="1224" height="664" rx="44" fill="none" stroke="rgba(255,255,255,.12)"/>
  <g transform="translate(1050 650)" opacity=".58"><circle cx="0" cy="0" r="8" fill="${palette.a}"/><text x="18" y="6" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="1">KINO VIDEO</text></g>
</svg>`;
}

async function runFfmpeg(ffmpegPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg_failed_${code}: ${stderr.trim()}`));
    });
  });
}

async function createBuiltInVideoArtifact(project, prompt, attachments = [], options = {}) {
  const { sharp, ffmpegPath } = await loadBuiltInVideoDeps();
  const artifactId = id("kino");
  const durationSec = normalizeBuiltInVideoDuration(options.durationSec);
  const fps = normalizeBuiltInVideoFps(options.fps);
  const frameCount = Math.max(1, Math.round(durationSec * fps));
  const plan = mediaPlan(prompt, "video", { ...options, durationSec });
  plan.direction = buildKinoDirection(prompt, plan, durationSec);
  const crf = String(Math.round(clampNumber(process.env.KINO_CRF || options.crf || 31, 18, 42)));
  const frameDir = path.join(GENERATED_VIDEOS_DIR, `${artifactId}-frames`);
  const fileName = `${artifactId}.webm`;
  const filePath = path.join(GENERATED_VIDEOS_DIR, fileName);
  await mkdir(frameDir, { recursive: true });
  try {
    for (let index = 0; index < frameCount; index += 1) {
      const frameSvg = builtInVideoFrameSvg(prompt, artifactId, plan, index, frameCount);
      const framePath = path.join(frameDir, `frame-${String(index).padStart(4, "0")}.png`);
      await sharp(Buffer.from(frameSvg)).png({ compressionLevel: 8 }).toFile(framePath);
    }
    await runFfmpeg(ffmpegPath, [
      "-y",
      "-framerate", String(fps),
      "-i", path.join(frameDir, "frame-%04d.png"),
      "-an",
      "-c:v", "libvpx-vp9",
      "-b:v", "0",
      "-crf", crf,
      "-pix_fmt", "yuv420p",
      "-deadline", "good",
      "-cpu-used", "3",
      "-row-mt", "1",
      filePath
    ]);
  } finally {
    await rm(frameDir, { recursive: true, force: true }).catch(() => {});
  }
  const sizeBytes = (await stat(filePath)).size;
  return {
    id: artifactId,
    kind: "video",
    title: generatedTitle(prompt, "video"),
    prompt,
    provider: "kino-builtin-video",
    mime: "video/webm",
    fileName,
    url: `/api/generated/videos/${fileName}`,
    width: 1280,
    height: 720,
    durationSec,
    fps,
    size: sizeBytes,
    fallbackReason: options.fallbackReason || "",
    render: {
      engine: "kino-builtin",
      frames: frameCount,
      theme: plan.theme,
      subject: plan.direction.subject,
      action: plan.direction.action,
      camera: plan.direction.camera,
      crf: Number(crf),
      ffmpeg: Boolean(ffmpegPath)
    },
    sourceAttachments: attachments.map((file) => ({ name: file.name, type: file.type, size: file.size })),
    createdAt: now()
  };
}

async function runJsonProcess(file, args = [], options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 60000));
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: options.cwd || ROOT,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        ...(options.env || {})
      }
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error(`${options.name || "process"}_timeout`);
      error.code = `${options.name || "process"}_timeout`;
      error.stderr = stderr;
      reject(error);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 128000) stdout = stdout.slice(-128000);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 32000) stderr = stderr.slice(-32000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const jsonLine = [...lines].reverse().find((line) => line.startsWith("{") && line.endsWith("}"));
      let data = null;
      if (jsonLine) {
        try {
          data = JSON.parse(jsonLine);
        } catch {
          data = null;
        }
      }
      if (code === 0 && data?.ok !== false) {
        resolve(data || { ok: true, stdout });
        return;
      }
      const message = data?.error || stderr.trim() || stdout.trim() || `${options.name || "process"}_failed_${code}`;
      const error = new Error(message);
      error.code = data?.code || `${options.name || "process"}_failed`;
      error.data = data;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function normalizeLtxFrameCount(durationSec, fps) {
  const raw = Math.max(17, Math.round(Math.max(2, Number(durationSec || 4)) * fps));
  return Math.max(17, Math.min(361, Math.floor((raw - 1) / 8) * 8 + 1));
}

async function createLtxDiffusersVideoArtifact(project, prompt, attachments = [], options = {}) {
  const status = ltxDiffusersStatus();
  if (!status.enabled) {
    const error = new Error("ltx_diffusers_disabled");
    error.code = "ltx_diffusers_disabled";
    throw error;
  }
  if (!status.python || !status.scriptFound) {
    const error = new Error("ltx_diffusers_runtime_missing");
    error.code = "ltx_diffusers_runtime_missing";
    throw error;
  }
  if (!status.modelCached && !LTX_DIFFUSERS_AUTO_DOWNLOAD) {
    const error = new Error("ltx_diffusers_model_not_cached");
    error.code = "ltx_diffusers_model_not_cached";
    throw error;
  }
  if (!status.verified && !status.allowUnverified) {
    const error = new Error("ltx_diffusers_not_verified");
    error.code = "ltx_diffusers_not_verified";
    throw error;
  }

  const artifactId = id("ltx");
  const fps = Math.max(8, Number(options.fps || LTX_DIFFUSERS_FPS));
  const frames = normalizeLtxFrameCount(options.durationSec || 4, fps);
  const width = Math.round(Math.max(256, Number(options.width || LTX_DIFFUSERS_WIDTH)) / 32) * 32;
  const height = Math.round(Math.max(256, Number(options.height || LTX_DIFFUSERS_HEIGHT)) / 32) * 32;
  const fileName = `${artifactId}.mp4`;
  await mkdir(GENERATED_VIDEOS_DIR, { recursive: true });
  const filePath = path.join(GENERATED_VIDEOS_DIR, fileName);
  const seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) : Math.floor(Math.random() * 1_000_000_000);
  const args = [
    status.script,
    "--prompt", augmentFreeVideoPrompt(prompt),
    "--negative-prompt", negativeFreeVideoPrompt(),
    "--output", filePath,
    "--model", LTX_DIFFUSERS_MODEL,
    "--width", String(width),
    "--height", String(height),
    "--frames", String(frames),
    "--fps", String(fps),
    "--steps", String(options.steps || LTX_DIFFUSERS_STEPS),
    "--seed", String(seed)
  ];
  if (!LTX_DIFFUSERS_AUTO_DOWNLOAD) args.push("--local-files-only");
  if (LTX_DIFFUSERS_REQUIRE_CUDA) args.push("--require-cuda");

  const result = await runJsonProcess(status.python, args, {
    name: "ltx_diffusers",
    timeoutMs: LTX_DIFFUSERS_TIMEOUT_MS,
    env: {
      HF_HOME: process.env.HF_HOME || path.join(ENGINES_DIR, "hf-cache")
    }
  });
  const sizeBytes = (await stat(filePath)).size;
  return {
    id: artifactId,
    kind: "video",
    title: generatedTitle(prompt, "video"),
    prompt,
    provider: "ltx-diffusers-video",
    mime: "video/mp4",
    fileName,
    url: `/api/generated/videos/${fileName}`,
    width,
    height,
    durationSec: Number((frames / fps).toFixed(2)),
    fps,
    size: sizeBytes,
    ltx: {
      model: LTX_DIFFUSERS_MODEL,
      device: result.device || "",
      frames,
      steps: Number(options.steps || LTX_DIFFUSERS_STEPS),
      seed
    },
    sourceAttachments: attachments.map((file) => ({ name: file.name, type: file.type, size: file.size })),
    createdAt: now()
  };
}

function openAiApiUrl(pathname) {
  return `${OPENAI_BASE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

async function openAiJson(pathname, options = {}) {
  const response = await fetch(openAiApiUrl(pathname), {
    ...options,
    headers: {
      authorization: `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || text || `Cloud video API error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function normalizeSoraSeconds(value) {
  const requested = Number(value || 8);
  const allowed = [4, 8, 12, 16, 20];
  if (!Number.isFinite(requested)) return "8";
  return String(allowed.reduce((best, item) => (
    Math.abs(item - requested) < Math.abs(best - requested) ? item : best
  ), allowed[0]));
}

function normalizeSoraSize(model = SORA_MODEL, value = SORA_VIDEO_SIZE) {
  const requested = String(value || "1280x720");
  const base = new Set(["1280x720", "720x1280"]);
  const pro = new Set(["1280x720", "720x1280", "1024x1792", "1792x1024", "1920x1080", "1080x1920"]);
  const allowed = String(model).includes("pro") ? pro : base;
  return allowed.has(requested) ? requested : "1280x720";
}

function augmentSoraPrompt(prompt = "", options = {}) {
  const clean = String(prompt || "").replace(/\s+/g, " ").trim();
  const theme = inferMediaTheme(clean);
  const scene = {
    city: "night city street with neon reflections and atmospheric haze",
    space: "deep space with stars, subtle nebula clouds, and cinematic scale",
    ocean: "wide ocean scene with moving waves and soft horizon light",
    nature: "lush natural landscape with depth, wind, and soft sunlight",
    product: "premium product-style shot with clean composition and controlled lighting",
    character: "cinematic character-focused shot with expressive motion and clear silhouette",
    sport: "energetic stadium-like scene with dynamic motion",
    cinematic: "cinematic scene with strong depth, realistic motion, and atmospheric lighting"
  }[theme] || "cinematic scene";
  return [
    "Use case: in-app AI video generation preview",
    `Primary request: ${clean}`,
    `Scene/background: ${scene}`,
    "Action: one clear subject action that matches the request, with natural timing and believable motion",
    "Camera: cinematic tracking shot, gentle camera move, stable composition, 35mm lens feel",
    "Lighting/mood: realistic cinematic lighting, soft depth of field, polished high-fidelity look",
    "Style/format: realistic cinematic video, no slideshow, no text card, no UI overlay",
    "Timing/beats: establish the scene, perform the main action, end on a readable final pose",
    "Constraints: keep content suitable for all audiences, use only original generic subjects, no copyrighted characters, no public figures",
    "Avoid: visible prompt text, subtitles, logos, watermark, jittery limbs, morphing, flicker, unreadable anatomy"
  ].filter(Boolean).join("\n");
}

function isTerminalSoraStatus(status = "") {
  return ["completed", "failed", "cancelled", "canceled"].includes(String(status || "").toLowerCase());
}

async function pollSoraVideo(videoId, timeoutMs = SORA_POLL_TIMEOUT_MS) {
  const started = Date.now();
  let current = await openAiJson(`/videos/${encodeURIComponent(videoId)}`);
  while (!isTerminalSoraStatus(current?.status) && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, SORA_POLL_INTERVAL_MS));
    current = await openAiJson(`/videos/${encodeURIComponent(videoId)}`);
  }
  return current;
}

async function downloadSoraVideoContent(videoId, targetFile) {
  const response = await fetch(openAiApiUrl(`/videos/${encodeURIComponent(videoId)}/content`), {
    headers: { authorization: `Bearer ${OPENAI_API_KEY}` }
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || `Sora video download failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("Nexa video download returned empty content");
  await writeFile(targetFile, buffer);
  return buffer.length;
}

function soraPendingHtml(prompt, artifactId, job = {}, options = {}) {
  const escapedPrompt = escapeXml(prompt);
  const status = escapeXml(job?.status || "processing");
  const videoId = escapeXml(job?.id || artifactId);
  const seconds = escapeXml(options.seconds || "");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nexa processing</title><style>
html,body{height:100%;margin:0;background:#080910;color:#f5f7ff;font-family:Inter,Arial,sans-serif}body{display:grid;place-items:center}.card{width:min(760px,88vw);padding:42px;border:1px solid rgba(255,255,255,.16);border-radius:32px;background:linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.05));box-shadow:0 40px 120px rgba(0,0,0,.42)}.orb{width:70px;height:70px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#fff,#7a8cff 45%,#4b2fff);box-shadow:0 0 60px rgba(105,122,255,.8);animation:pulse 1.4s ease-in-out infinite}.row{display:flex;gap:22px;align-items:center}h1{font-size:26px;margin:0 0 10px}p{color:#b9bfd2;line-height:1.7}.meta{margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.12);display:grid;gap:8px;color:#dce3ff;font-size:13px}@keyframes pulse{0%,100%{transform:scale(.92);opacity:.72}50%{transform:scale(1.08);opacity:1}}</style></head><body><main class="card"><div class="row"><div class="orb"></div><div><h1>Nexaで生成中です</h1><p>動画ジョブを開始しました。完了後にMP4を保存して、このチャット内で再生できます。</p></div></div><div class="meta"><span>status: ${status}</span><span>video id: ${videoId}</span><span>seconds: ${seconds}</span><span>prompt: ${escapedPrompt}</span></div></main></body></html>`;
}

async function createSoraVideoArtifact(project, prompt, attachments = [], options = {}) {
  if (!OPENAI_API_KEY) {
    const error = new Error("sora_api_key_missing");
    error.code = "sora_api_key_missing";
    throw error;
  }
  const model = String(options.model || SORA_MODEL || "sora-2");
  const size = normalizeSoraSize(model, options.size || SORA_VIDEO_SIZE);
  const seconds = normalizeSoraSeconds(options.durationSec || options.seconds || 8);
  const soraPrompt = augmentSoraPrompt(prompt, options);
  const requestBody = { model, prompt: soraPrompt, size, seconds };
  const created = await openAiJson("/videos", {
    method: "POST",
    body: JSON.stringify(requestBody)
  });
  const videoId = created?.id;
  if (!videoId) throw new Error("sora_video_id_missing");

  const completed = await pollSoraVideo(videoId);
  const artifactId = id("sora");
  await mkdir(GENERATED_VIDEOS_DIR, { recursive: true });

  if (String(completed?.status || "").toLowerCase() === "completed") {
    const fileName = `${artifactId}.mp4`;
    const filePath = path.join(GENERATED_VIDEOS_DIR, fileName);
    const sizeBytes = await downloadSoraVideoContent(videoId, filePath);
    return {
      id: artifactId,
      kind: "video",
      title: generatedTitle(prompt, "video"),
      prompt,
      provider: `openai-${model}`,
      mime: "video/mp4",
      fileName,
      url: `/api/generated/videos/${fileName}`,
      width: Number(size.split("x")[0]) || 1280,
      height: Number(size.split("x")[1]) || 720,
      durationSec: Number(seconds),
      size: sizeBytes,
      sora: {
        id: videoId,
        status: completed.status,
        model,
        size,
        seconds,
        requestedDurationSec: Number(options.durationSec || options.seconds || seconds)
      },
      sourceAttachments: attachments.map((file) => ({ name: file.name, type: file.type, size: file.size })),
      createdAt: now()
    };
  }

  const fileName = `${artifactId}.html`;
  const filePath = path.join(GENERATED_VIDEOS_DIR, fileName);
  await writeFile(filePath, soraPendingHtml(prompt, artifactId, completed || created, { seconds }), "utf8");
  return {
    id: artifactId,
    kind: "video",
    title: `Sora processing: ${clip(prompt, 44)}`,
    prompt,
    provider: `openai-${model}`,
    mime: "text/html",
    fileName,
    url: `/api/generated/videos/${fileName}`,
    width: Number(size.split("x")[0]) || 1280,
    height: Number(size.split("x")[1]) || 720,
    durationSec: Number(seconds),
    sora: {
      id: videoId,
      status: completed?.status || created?.status || "processing",
      model,
      size,
      seconds,
      requestedDurationSec: Number(options.durationSec || options.seconds || seconds)
    },
    sourceAttachments: attachments.map((file) => ({ name: file.name, type: file.type, size: file.size })),
    createdAt: now()
  };
}

function resolveConfigPath(value = "") {
  const clean = String(value || "").trim();
  if (!clean) return "";
  return path.isAbsolute(clean) ? clean : path.resolve(ROOT, clean);
}

function bundledWorkflowCandidates() {
  return [
    COMFYUI_VIDEO_WORKFLOW,
    path.join(ROOT, "data", "video-workflows", "default-api.json"),
    path.join(ROOT, "data", "video-workflows", "video-api.json"),
    path.join(ROOT, "workflows", "video-api.json"),
    path.join(ENGINES_DIR, "workflows", "video-api.json"),
    path.join(ENGINES_DIR, "workflows", "ltx-lite-api.json"),
    path.join(ENGINES_DIR, "workflows", "ltx-text-to-video-blueprint.json"),
    path.join(ENGINES_DIR, "workflows", "default-api.json"),
    path.join(COMFYUI_DIR, "user", "default", "workflows", "video-api.json")
  ]
    .filter(Boolean)
    .map(resolveConfigPath);
}

function autoComfyWorkflowPath() {
  return bundledWorkflowCandidates().find((candidate) => existsSync(candidate)) || "";
}

function comfyUiConfigured() {
  return Boolean(autoComfyWorkflowPath());
}

function ltxDiffusersPythonPath() {
  const configured = process.env.LTX_DIFFUSERS_PYTHON || "";
  const candidates = [
    configured,
    process.platform === "win32" ? path.join(COMFYUI_DIR, "venv", "Scripts", "python.exe") : path.join(COMFYUI_DIR, "venv", "bin", "python"),
    process.platform === "win32" ? "python" : "python3",
    "python"
  ].filter(Boolean);
  return candidates.find((candidate) => candidate === "python" || candidate === "python3" || existsSync(resolveConfigPath(candidate))) || "";
}

function hasFilesMatching(dir, pattern) {
  return existsSync(dir) && readdirSyncSafe(dir).some((name) => pattern.test(name));
}

function hasHuggingFaceSnapshot(modelId) {
  const repoDirName = `models--${String(modelId || "").replace(/\//g, "--")}`;
  const cacheRoots = [
    process.env.HUGGINGFACE_HUB_CACHE,
    process.env.HF_HOME ? path.join(process.env.HF_HOME, "hub") : "",
    path.join(ENGINES_DIR, "hf-cache", "hub"),
    path.join(os.homedir(), ".cache", "huggingface", "hub")
  ].filter(Boolean);
  for (const cacheRoot of cacheRoots) {
    const repoDir = path.join(cacheRoot, repoDirName);
    const snapshotsDir = path.join(repoDir, "snapshots");
    if (!existsSync(snapshotsDir)) continue;
    for (const snapshot of readdirSyncSafe(snapshotsDir)) {
      const snapshotDir = path.join(snapshotsDir, snapshot);
      if (existsSync(path.join(snapshotDir, "model_index.json"))) return true;
      if (existsSync(path.join(snapshotDir, "transformer", "config.json"))) return true;
    }
  }
  return false;
}

function ltxComfyModelStatus() {
  const checkpointsDir = path.join(COMFYUI_DIR, "models", "checkpoints");
  const diffusionModelsDir = path.join(COMFYUI_DIR, "models", "diffusion_models");
  const latentUpscaleDir = path.join(COMFYUI_DIR, "models", "latent_upscale_models");
  const textEncodersDir = path.join(COMFYUI_DIR, "models", "text_encoders");
  const checkpointReady =
    hasFilesMatching(checkpointsDir, /ltx.*\.(safetensors|gguf)$/i) ||
    hasFilesMatching(diffusionModelsDir, /ltx.*\.(safetensors|gguf)$/i);
  const upscalerReady = hasFilesMatching(latentUpscaleDir, /ltx.*upscaler.*\.(safetensors|gguf)$/i);
  const gemmaReady =
    hasFilesMatching(textEncodersDir, /gemma.*\.(safetensors|gguf)$/i) ||
    existsSync(path.join(textEncodersDir, "gemma-3-12b-it-qat-q4_0-unquantized"));
  return {
    checkpointReady,
    upscalerReady,
    gemmaReady,
    ready: checkpointReady && gemmaReady,
    missing: [
      checkpointReady ? "" : "checkpoint",
      gemmaReady ? "" : "text encoder"
    ].filter(Boolean)
  };
}

function ltxDiffusersStatus() {
  const scriptPath = path.join(ROOT, "scripts", "generate-ltx-video.py");
  const python = ltxDiffusersPythonPath();
  const modelCached = hasHuggingFaceSnapshot(LTX_DIFFUSERS_MODEL);
  const engineFile = path.join(ENGINES_DIR, "ltx-diffusers-engine.json");
  const engineStatus = readJsonSyncSafe(engineFile, {});
  const verified = Boolean(LTX_DIFFUSERS_VERIFIED || engineStatus.verified);
  const runnable = Boolean(verified || LTX_DIFFUSERS_ALLOW_UNVERIFIED);
  return {
    enabled: LTX_DIFFUSERS_ENABLED,
    python,
    script: scriptPath,
    scriptFound: existsSync(scriptPath),
    model: LTX_DIFFUSERS_MODEL,
    modelCached,
    autoDownload: LTX_DIFFUSERS_AUTO_DOWNLOAD,
    verified,
    allowUnverified: LTX_DIFFUSERS_ALLOW_UNVERIFIED,
    ready: Boolean(LTX_DIFFUSERS_ENABLED && python && existsSync(scriptPath) && (modelCached || LTX_DIFFUSERS_AUTO_DOWNLOAD) && runnable)
  };
}

function highQualityVideoEngineStatus() {
  const customNodesDir = path.join(COMFYUI_DIR, "custom_nodes");
  const ltxNodeDir = path.join(customNodesDir, "ComfyUI-LTXVideo");
  const managerDir = path.join(customNodesDir, "ComfyUI-Manager");
  const wanModelDir = path.join(COMFYUI_DIR, "models", "diffusion_models");
  const ltxReady = existsSync(ltxNodeDir);
  const wanReady = existsSync(wanModelDir) && (() => {
    try {
      return readdirSyncSafe(wanModelDir).some((name) => /wan.*\.(safetensors|gguf)$/i.test(name));
    } catch {
      return false;
    }
  })();
  const workflowPath = autoComfyWorkflowPath();
  const comfyLaunch = bundledComfyLaunch();
  const ltxModels = ltxComfyModelStatus();
  const ltxDiffusers = ltxDiffusersStatus();
  const comfyConfigured = Boolean(workflowPath && comfyLaunch && ((ltxReady && ltxModels.ready) || wanReady));
  const configured = Boolean(ltxDiffusers.ready || comfyConfigured);
  const engineInstalled = Boolean(comfyLaunch && (ltxReady || wanReady));
  const label = configured
    ? (ltxDiffusers.ready ? "LTX model ready" : ltxReady ? "LTX/ComfyUI ready" : "Wan/ComfyUI ready")
    : engineInstalled
      ? ltxDiffusers.modelCached && !ltxDiffusers.verified && !ltxDiffusers.allowUnverified
        ? "LTX cached, verification needed"
        : ltxReady && ltxModels.checkpointReady && !ltxModels.gemmaReady
        ? "LTX text encoder missing"
        : ltxReady && !ltxModels.ready
        ? "LTX model missing"
        : "LTX installed, API workflow needed"
      : "Nexa fallback";
  const missing = [];
  if (ltxReady && !ltxModels.checkpointReady && !ltxDiffusers.modelCached) missing.push("LTX model weights");
  if (ltxReady && ltxModels.checkpointReady && !ltxModels.gemmaReady) missing.push("LTX text encoder");
  if (ltxDiffusers.modelCached && !ltxDiffusers.verified && !ltxDiffusers.allowUnverified) missing.push("LTX verification");
  if (ltxReady && !workflowPath && !ltxDiffusers.ready) missing.push("ComfyUI API workflow");
  return {
    engine: HQ_VIDEO_ENGINE,
    ready: configured,
    installed: engineInstalled,
    label,
    quality: configured ? "model-grade" : engineInstalled ? "needs-model" : "fallback",
    comfyuiFound: Boolean(comfyLaunch),
    workflowFound: Boolean(workflowPath),
    ltxVideoNodeFound: ltxReady,
    ltxModels,
    ltxDiffusers,
    wanModelFound: wanReady,
    missing,
    installScript: "scripts/prepare-high-quality-video-engine.ps1",
    recommended: "LTX-Video via ComfyUI for better free local quality"
  };
}

function readdirSyncSafe(dir) {
  try {
    return fsReaddirSync(dir);
  } catch {
    return [];
  }
}

function readJsonSyncSafe(file, fallback = {}) {
  try {
    return JSON.parse(fsReadFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function comfyUrl(pathname, params = null) {
  const url = new URL(`${COMFYUI_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function comfyJson(pathname, options = {}) {
  const response = await fetch(comfyUrl(pathname), {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    signal: options.signal || AbortSignal.timeout(8000)
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || text || `ComfyUI error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

let comfyAutoStartAttempted = false;

function bundledComfyLaunch() {
  const portableBat = path.join(ENGINES_DIR, "ComfyUI_windows_portable", "run_nvidia_gpu.bat");
  if (process.platform === "win32" && existsSync(portableBat)) {
    return {
      file: "cmd.exe",
      args: ["/c", portableBat],
      cwd: path.dirname(portableBat)
    };
  }

  const mainPy = path.join(COMFYUI_DIR, "main.py");
  if (!existsSync(mainPy)) return null;
  const pythonCandidates = process.platform === "win32"
    ? [
        path.join(COMFYUI_DIR, "venv", "Scripts", "python.exe"),
        path.join(ENGINES_DIR, "python", "python.exe"),
        "python"
      ]
    : [
        path.join(COMFYUI_DIR, "venv", "bin", "python"),
        "python3",
        "python"
      ];
  const python = pythonCandidates.find((candidate) => candidate === "python" || candidate === "python3" || existsSync(candidate));
  return {
    file: python,
    args: [mainPy, "--listen", "127.0.0.1", "--port", "8188"],
    cwd: COMFYUI_DIR
  };
}

async function waitForComfyUi(timeoutMs = 45000) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      await comfyJson("/system_stats", { signal: AbortSignal.timeout(3000) });
      return true;
    } catch (error) {
      lastError = error.message;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  const error = new Error(lastError || "comfyui_start_timeout");
  error.code = "comfyui_start_timeout";
  throw error;
}

async function ensureComfyUiAvailable() {
  try {
    await comfyJson("/system_stats", { signal: AbortSignal.timeout(3000) });
    return;
  } catch {
    // Try bundled engine below.
  }

  if (!COMFYUI_AUTO_START) {
    const error = new Error("comfyui_not_running");
    error.code = "comfyui_not_running";
    throw error;
  }
  if (comfyAutoStartAttempted) {
    await waitForComfyUi(15000);
    return;
  }
  const launch = bundledComfyLaunch();
  if (!launch) {
    const error = new Error("bundled_comfyui_not_found");
    error.code = "bundled_comfyui_not_found";
    throw error;
  }
  comfyAutoStartAttempted = true;
  const child = spawn(launch.file, launch.args, {
    cwd: launch.cwd,
    windowsHide: true,
    detached: true,
    stdio: "ignore",
    shell: false,
    env: {
      ...process.env,
      PYTHONUTF8: "1"
    }
  });
  child.unref();
  await waitForComfyUi();
}

async function readComfyWorkflow() {
  const workflowPath = autoComfyWorkflowPath();
  if (!workflowPath) {
    const error = new Error("comfyui_workflow_required");
    error.code = "comfyui_workflow_required";
    throw error;
  }
  const workflow = JSON.parse(await readFile(workflowPath, "utf8"));
  if (Array.isArray(workflow?.nodes)) {
    return convertVisualComfyWorkflowToApi(workflow);
  }
  return workflow;
}

function visualLinkMap(workflow) {
  const map = new Map();
  for (const link of workflow?.links || []) {
    if (!Array.isArray(link) || link.length < 6) continue;
    const [idValue, originId, originSlot] = link;
    map.set(idValue, [String(originId), Number(originSlot || 0)]);
  }
  return map;
}

function comfyInputOrder(info = {}) {
  const ordered = [];
  for (const group of ["required", "optional"]) {
    const names = info.input_order?.[group] || Object.keys(info.input?.[group] || {});
    for (const name of names) ordered.push({ name, def: info.input?.[group]?.[name] });
  }
  return ordered;
}

function visualConstantLinks(workflow) {
  const constants = new Map();
  const linkById = new Map((workflow?.links || []).filter(Array.isArray).map((link) => [link[0], link]));
  const nodeById = new Map((workflow?.nodes || []).map((node) => [node.id, node]));

  const setOutputConstants = (node, value) => {
    for (const output of node.outputs || []) {
      for (const linkId of output.links || []) constants.set(linkId, value);
    }
  };

  for (const node of workflow?.nodes || []) {
    if (/^Primitive/i.test(String(node.type || ""))) {
      setOutputConstants(node, Array.isArray(node.widgets_values) ? node.widgets_values[0] : undefined);
    }
  }

  for (let pass = 0; pass < 4; pass += 1) {
    for (const node of workflow?.nodes || []) {
      const classType = String(node.type || "");
      if (classType === "CM_FloatToInt") {
        const inputLink = node.inputs?.find((input) => input.name === "a")?.link;
        if (constants.has(inputLink)) setOutputConstants(node, Math.round(Number(constants.get(inputLink)) || 0));
      }
      if (classType === "CM_IntToFloat") {
        const inputLink = node.inputs?.find((input) => input.name === "a")?.link;
        if (constants.has(inputLink)) setOutputConstants(node, Number(constants.get(inputLink)) || 0);
      }
    }
  }

  for (const [linkId, link] of linkById) {
    if (constants.has(linkId)) continue;
    const originNode = nodeById.get(link[1]);
    if (/^Primitive/i.test(String(originNode?.type || ""))) {
      constants.set(linkId, Array.isArray(originNode.widgets_values) ? originNode.widgets_values[0] : undefined);
    }
  }
  return constants;
}

function isComfyWidgetInput(def) {
  const type = Array.isArray(def) ? def[0] : "";
  return ["INT", "FLOAT", "STRING", "BOOLEAN", "COMBO"].includes(String(type || "").toUpperCase());
}

async function convertVisualComfyWorkflowToApi(workflow) {
  const objectInfo = await comfyJson("/object_info", { signal: AbortSignal.timeout(20000) });
  const links = visualLinkMap(workflow);
  const constants = visualConstantLinks(workflow);
  const api = {};

  for (const node of workflow.nodes || []) {
    if (!node?.id || !node?.type) continue;
    if (node.mode === 2 || node.mode === 4) continue;
    const classType = String(node.type);
    const info = objectInfo?.[classType] || {};
    if (!objectInfo?.[classType] && (/^Primitive/i.test(classType) || /^CM_/i.test(classType))) continue;
    const inputs = {};
    const visualInputs = new Map((node.inputs || []).map((input) => [input.name, input]));
    const widgetValues = Array.isArray(node.widgets_values) ? [...node.widgets_values] : [];
    let widgetIndex = 0;

    for (const input of node.inputs || []) {
      if (input?.link === null || input?.link === undefined) continue;
      if (constants.has(input.link)) {
        inputs[input.name] = constants.get(input.link);
        continue;
      }
      const linked = links.get(input.link);
      if (linked) inputs[input.name] = linked;
    }

    for (const item of comfyInputOrder(info)) {
      if (!isComfyWidgetInput(item.def)) continue;
      const visualInput = visualInputs.get(item.name);
      const value = widgetIndex < widgetValues.length ? widgetValues[widgetIndex] : undefined;
      widgetIndex += 1;
      if (visualInput?.link !== null && visualInput?.link !== undefined) continue;
      if (value !== undefined && !(item.name in inputs)) inputs[item.name] = value;
    }

    api[String(node.id)] = {
      class_type: classType,
      inputs,
      _meta: { title: node.title || classType }
    };
  }

  if (!Object.keys(api).length) {
    const error = new Error("comfyui_visual_workflow_convert_failed");
    error.code = "comfyui_visual_workflow_convert_failed";
    throw error;
  }
  return api;
}

function augmentFreeVideoPrompt(prompt = "") {
  const clean = String(prompt || "").replace(/\s+/g, " ").trim();
  const theme = inferMediaTheme(clean);
  const camera = {
    city: "cinematic tracking shot, street-level camera, neon reflections, natural walking motion",
    space: "slow cinematic dolly, deep parallax, realistic scale and smooth motion",
    ocean: "wide cinematic shot, low camera near water, natural wave motion",
    nature: "gentle tracking shot, wind movement, layered depth, natural lighting",
    product: "premium commercial shot, smooth camera orbit, clean product lighting",
    character: "full-body cinematic shot, stable anatomy, clear silhouette, natural movement",
    sport: "dynamic sideline camera, energetic but readable motion",
    cinematic: "cinematic shot, stable camera move, realistic motion and depth"
  }[theme] || "cinematic shot, stable camera move, realistic motion and depth";
  return [
    clean,
    camera,
    "high quality video, coherent frames, temporal consistency, detailed lighting, no subtitles, no watermark, no text overlay"
  ].join(", ");
}

function negativeFreeVideoPrompt() {
  return [
    "text, subtitles, logo, watermark, flicker, jitter, warped limbs, extra limbs, deformed anatomy",
    "low quality, blurry, noisy, frame tearing, duplicated subject, morphing face, broken hands"
  ].join(", ");
}

function setNodeInput(node, key, value) {
  if (!node || typeof node !== "object") return false;
  node.inputs ||= {};
  if (key in node.inputs || ["text", "prompt", "value"].includes(key)) {
    node.inputs[key] = value;
    return true;
  }
  return false;
}

function setFirstTextLikeInput(node, value) {
  for (const key of ["text", "prompt", "value", "string"]) {
    if (setNodeInput(node, key, value)) return true;
  }
  return false;
}

function patchComfyWorkflow(workflow, prompt, options = {}) {
  const patched = JSON.parse(JSON.stringify(workflow));
  const positive = augmentFreeVideoPrompt(prompt);
  const negative = negativeFreeVideoPrompt();
  const seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) : Math.floor(Math.random() * 1_000_000_000);
  let positiveSet = false;
  let negativeSet = false;

  if (COMFYUI_PROMPT_NODE && patched[COMFYUI_PROMPT_NODE]) {
    positiveSet = setNodeInput(patched[COMFYUI_PROMPT_NODE], "text", positive) ||
      setNodeInput(patched[COMFYUI_PROMPT_NODE], "prompt", positive);
  }
  if (COMFYUI_NEGATIVE_PROMPT_NODE && patched[COMFYUI_NEGATIVE_PROMPT_NODE]) {
    negativeSet = setNodeInput(patched[COMFYUI_NEGATIVE_PROMPT_NODE], "text", negative) ||
      setNodeInput(patched[COMFYUI_NEGATIVE_PROMPT_NODE], "negative", negative);
  }

  for (const [nodeId, node] of Object.entries(patched)) {
    const classType = String(node?.class_type || "");
    const metaTitle = String(node?._meta?.title || "");
    const textValue = String(node?.inputs?.text || node?.inputs?.prompt || "");
    const allText = `${classType} ${metaTitle} ${textValue}`;
    const looksTextEncoder = /text|prompt|clip|string/i.test(allText) &&
      (node?.inputs?.text !== undefined || node?.inputs?.prompt !== undefined || node?.inputs?.value !== undefined);
    if (looksTextEncoder && !positiveSet && !/negative|bad|worst|low quality/i.test(textValue)) {
      positiveSet = setFirstTextLikeInput(node, positive);
      continue;
    }
    if (looksTextEncoder && !negativeSet && /negative|bad|worst|low quality|deformed/i.test(allText)) {
      negativeSet = setFirstTextLikeInput(node, negative);
    }
    if ((COMFYUI_SEED_NODE && nodeId === COMFYUI_SEED_NODE) || !COMFYUI_SEED_NODE) {
      for (const key of ["seed", "noise_seed", "rand_seed"]) {
        if (node?.inputs && typeof node.inputs[key] === "number") node.inputs[key] = seed;
      }
    }
  }

  if (!positiveSet) {
    const error = new Error("comfyui_prompt_node_not_found");
    error.code = "comfyui_prompt_node_not_found";
    throw error;
  }
  return patched;
}

function comfyOutputEntries(history, promptId) {
  const item = history?.[promptId] || history;
  const outputs = item?.outputs || {};
  const entries = [];
  const add = (nodeId, output, kind) => {
    for (const file of output?.[kind] || []) {
      if (!file?.filename) continue;
      entries.push({ nodeId, kind, ...file });
    }
  };
  for (const [nodeId, output] of Object.entries(outputs)) {
    add(nodeId, output, "videos");
    add(nodeId, output, "gifs");
    add(nodeId, output, "images");
  }
  const preferredNode = COMFYUI_OUTPUT_NODE
    ? entries.filter((entry) => entry.nodeId === COMFYUI_OUTPUT_NODE)
    : entries;
  return (preferredNode.length ? preferredNode : entries).sort((a, b) => {
    const score = (entry) => /\.(mp4|webm)$/i.test(entry.filename) ? 3 : /\.gif$/i.test(entry.filename) ? 2 : 1;
    return score(b) - score(a);
  });
}

async function pollComfyHistory(promptId) {
  const started = Date.now();
  let history = {};
  while (Date.now() - started < COMFYUI_POLL_TIMEOUT_MS) {
    history = await comfyJson(`/history/${encodeURIComponent(promptId)}`, {
      signal: AbortSignal.timeout(10000)
    });
    const item = history?.[promptId] || history;
    const status = item?.status || {};
    if (status.status_str === "error") {
      const errorEvent = (status.messages || []).find((entry) => Array.isArray(entry) && entry[0] === "execution_error");
      const errorData = errorEvent?.[1] || {};
      const message = errorData.exception_message || errorData.exception_type || "comfyui_execution_error";
      const error = new Error(message);
      error.code = "comfyui_execution_error";
      error.data = errorData;
      throw error;
    }
    if (comfyOutputEntries(history, promptId).length) return history;
    await new Promise((resolve) => setTimeout(resolve, COMFYUI_POLL_INTERVAL_MS));
  }
  const error = new Error("comfyui_generation_timeout");
  error.code = "comfyui_generation_timeout";
  error.history = history;
  throw error;
}

async function downloadComfyOutput(entry, targetFile) {
  const response = await fetch(comfyUrl("/view", {
    filename: entry.filename,
    subfolder: entry.subfolder || "",
    type: entry.type || "output"
  }), { signal: AbortSignal.timeout(60000) });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `ComfyUI output download failed: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("ComfyUI output was empty");
  await writeFile(targetFile, buffer);
  return buffer.length;
}

async function createComfyVideoArtifact(project, prompt, attachments = [], options = {}) {
  if (!comfyUiConfigured()) {
    const error = new Error("comfyui_workflow_required");
    error.code = "comfyui_workflow_required";
    throw error;
  }
  await ensureComfyUiAvailable();
  const workflow = await readComfyWorkflow();
  const promptGraph = patchComfyWorkflow(workflow, prompt, options);
  const clientId = id("comfy_client");
  const queued = await comfyJson("/prompt", {
    method: "POST",
    body: JSON.stringify({ prompt: promptGraph, client_id: clientId })
  });
  const promptId = queued?.prompt_id;
  if (!promptId) throw new Error("comfyui_prompt_id_missing");
  const history = await pollComfyHistory(promptId);
  const output = comfyOutputEntries(history, promptId)[0];
  if (!output) throw new Error("comfyui_output_missing");

  const artifactId = id("comfy");
  const ext = path.extname(output.filename || "").toLowerCase() || ".mp4";
  const safeExt = [".mp4", ".webm", ".gif", ".webp", ".jpg", ".jpeg", ".png"].includes(ext) ? ext : ".mp4";
  const fileName = `${artifactId}${safeExt}`;
  await mkdir(GENERATED_VIDEOS_DIR, { recursive: true });
  const filePath = path.join(GENERATED_VIDEOS_DIR, fileName);
  const sizeBytes = await downloadComfyOutput(output, filePath);
  const mime = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png"
  }[safeExt] || "application/octet-stream";
  return {
    id: artifactId,
    kind: "video",
    title: generatedTitle(prompt, "video"),
    prompt,
    provider: "comfyui-free-video",
    mime,
    fileName,
    url: `/api/generated/videos/${fileName}`,
    width: 1280,
    height: 720,
    durationSec: Number(options.durationSec || 0),
    size: sizeBytes,
    comfyui: {
      url: COMFYUI_URL,
      promptId,
      outputNode: output.nodeId,
      filename: output.filename,
      type: output.type || "output"
    },
    sourceAttachments: attachments.map((file) => ({ name: file.name, type: file.type, size: file.size })),
    createdAt: now()
  };
}

async function createGeneratedArtifact(project, kind, prompt, attachments = [], options = {}) {
  const cleanKind = kind === "video" ? "video" : "image";
  if (IMAGE_GENERATION_ONLY && cleanKind === "video") {
    const error = new Error("video_generation_disabled");
    error.code = "video_generation_disabled";
    throw error;
  }
  let fallbackReason = "";
  const rememberFallback = (error) => {
    const reason = error?.code || error?.message || String(error || "");
    fallbackReason = fallbackReason ? `${fallbackReason}; ${reason}` : reason;
  };
  if (cleanKind === "video" && ["free", "auto", "ltx", "diffusers"].includes(VIDEO_PROVIDER)) {
    try {
      return await createLtxDiffusersVideoArtifact(project, prompt, attachments, options);
    } catch (error) {
      rememberFallback(error);
      if (VIDEO_PROVIDER === "ltx" || VIDEO_PROVIDER === "diffusers") throw error;
    }
  }
  if (cleanKind === "video" && ["free", "auto", "comfyui"].includes(VIDEO_PROVIDER)) {
    const qualityStatus = highQualityVideoEngineStatus();
    if (VIDEO_PROVIDER === "comfyui" || qualityStatus.ready) {
      try {
        return await createComfyVideoArtifact(project, prompt, attachments, options);
      } catch (error) {
        rememberFallback(error);
        if (VIDEO_PROVIDER === "comfyui") throw error;
      }
    } else {
      rememberFallback({ code: `comfyui_not_ready:${(qualityStatus.missing || []).join(",") || qualityStatus.label}` });
    }
  }
  if (cleanKind === "video" && VIDEO_PROVIDER === "sora" && OPENAI_API_KEY) {
    return createSoraVideoArtifact(project, prompt, attachments, options);
  }
  if (cleanKind === "video") {
    try {
      return await createBuiltInVideoArtifact(project, prompt, attachments, { ...options, fallbackReason });
    } catch (error) {
      rememberFallback(error);
      if (VIDEO_PROVIDER === "builtin" || VIDEO_PROVIDER === "kino") throw error;
    }
  }
  const artifactId = id(cleanKind);
  const fileName = `${artifactId}.${cleanKind === "video" ? "html" : "svg"}`;
  const directory = cleanKind === "video" ? GENERATED_VIDEOS_DIR : GENERATED_IMAGES_DIR;
  const collection = cleanKind === "video" ? "videos" : "images";
  const content = cleanKind === "video"
    ? generatedCinematicVideoHtml(prompt, artifactId, options)
    : generatedCinematicImageSvg(prompt, artifactId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), content, "utf8");
  return {
    id: artifactId,
    kind: cleanKind,
    title: generatedTitle(prompt, cleanKind),
    prompt,
    provider: cleanKind === "video" ? "local-cinematic-video" : "local-cinematic-image",
    mime: cleanKind === "video" ? "text/html" : "image/svg+xml",
    fileName,
    url: `/api/generated/${collection}/${fileName}`,
    width: 1280,
    height: 720,
    durationSec: cleanKind === "video" ? mediaPlan(prompt, "video", options).durationSec : 0,
    fallbackReason,
    sourceAttachments: attachments.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size
    })),
    createdAt: now()
  };
}

function mediaGenerationAgents(kind, artifact = null) {
  const provider = artifact?.provider || (kind === "video" ? "local-cinematic-video" : "local-cinematic-image");
  const isSora = kind === "video" && /^openai-sora/i.test(provider);
  const isLtx = kind === "video" && /^ltx-diffusers/i.test(provider);
  const isComfy = kind === "video" && /^comfyui/i.test(provider);
  const isBuiltInVideo = kind === "video" && /^kino-builtin-video/i.test(provider);
  return [
    { id: "orchestrator", name: "Nexa", model: "Nexa", output: isSora || isLtx || isComfy || isBuiltInVideo ? "生成方式を選択し、チャット内プレビュー用の成果物を準備しました。" : "プロンプトを解析し、視覚シーンの生成方針を選びました。", error: "" },
    { id: "generator", name: "Nexa", model: "Nexa", output: kind === "video" ? "カメラ移動と被写体の動きを含む動画成果物を生成しました。" : "プロンプトに沿った画像成果物を生成しました。", error: "" },
    { id: "verifier", name: "Nexa", model: "Nexa", output: "成果物の保存先、プレビュー形式、メタデータを確認しました。", error: "" }
  ];
}

function mediaCompletionText(label, artifact, flags = {}) {
  if (flags.usedSora || flags.usedLtx || flags.usedComfy || flags.usedBuiltInVideo) {
    return `Nexa動画生成が完了しました。\n\nチャット内プレビュー用に保存しました。\n\n${artifact.title}`;
  }
  if (flags.localFallbackVideo) {
    return `Nexa動画生成のプレビューを作成しました。\n\n${artifact.fallbackReason ? `理由: ${artifact.fallbackReason}\n\n` : ""}${artifact.title}`;
  }
  return `${label}が完了しました。\n\n${artifact.title}`;
}

function mediaCompletionTextClean(label, artifact, flags = {}) {
  if (flags.usedSora || flags.usedLtx || flags.usedComfy || flags.usedBuiltInVideo) {
    return [
      "Nexa動画生成が完了しました。",
      "",
      "チャット内プレビュー用に動画成果物を保存しました。",
      artifact.fallbackReason ? `補足: ${artifact.fallbackReason}` : "",
      "",
      artifact.title
    ].filter((line) => line !== "").join("\n");
  }
  if (flags.localFallbackVideo) {
    return [
      "Nexa動画生成のプレビューを作成しました。",
      artifact.fallbackReason ? `理由: ${artifact.fallbackReason}` : "",
      "",
      artifact.title
    ].filter((line) => line !== "").join("\n");
  }
  return `${label}が完了しました。\n\n${artifact.title}`;
}

async function generateMediaArtifact(body, kind) {
  if (IMAGE_GENERATION_ONLY && kind === "video") {
    const error = new Error("動画生成は現在外しています。画像生成だけ使えます。");
    error.status = 410;
    error.code = "video_generation_disabled";
    throw error;
  }
  const project = await getProject(body.projectId);
  if (!project) {
    const error = new Error("project_not_found");
    error.status = 404;
    throw error;
  }
  const prompt = String(body.prompt || body.message || "")
    .replace(/^(画像生成|動画生成|image generation|video generation)\s*[:：]?\s*/i, "")
    .trim();
  if (!prompt) {
    const error = new Error("prompt_required");
    error.status = 400;
    throw error;
  }

  const cleanKind = kind === "video" ? "video" : "image";
  const attachments = await storeAttachments(project, body.attachments || []);
  const artifact = await createGeneratedArtifact(project, cleanKind, clip(prompt, 2000), attachments, {
    durationSec: body.durationSec
  });
  const label = cleanKind === "video" ? "動画生成" : "画像生成";
  const usedSora = cleanKind === "video" && /^openai-sora/i.test(artifact.provider || "");
  const usedLtx = cleanKind === "video" && /^ltx-diffusers/i.test(artifact.provider || "");
  const usedComfy = cleanKind === "video" && /^comfyui/i.test(artifact.provider || "");
  const usedBuiltInVideo = cleanKind === "video" && /^kino-builtin-video/i.test(artifact.provider || "");
  const displayLabel = cleanKind === "video" ? "動画生成" : "画像生成";
  const localFallbackVideo = cleanKind === "video" && !usedSora && !usedLtx && !usedComfy;
  const legacyCompletionText = localFallbackVideo
    ? `Nexa動画生成のプレビューを作成しました。\n\n${artifact.fallbackReason ? `理由: ${artifact.fallbackReason}\n\n` : ""}${artifact.title}`
    : `${label}が完了しました。\n\n${artifact.title}`;
  const completionText = mediaCompletionTextClean(displayLabel, artifact, {
    usedSora,
    usedLtx,
    usedComfy,
    usedBuiltInVideo,
    localFallbackVideo: cleanKind === "video" && !usedSora && !usedLtx && !usedComfy && !usedBuiltInVideo
  });
  const userMessage = {
    id: id("msg"),
    role: "user",
    content: `${displayLabel}: ${prompt}`,
    attachments,
    generation: { kind: cleanKind },
    createdAt: now()
  };
  const assistantMessage = {
    id: id("msg"),
    role: "assistant",
    content: completionText,
    model: artifact.provider,
    agents: mediaGenerationAgents(cleanKind, artifact),
    artifacts: [artifact],
    createdAt: now()
  };

  project.messages.push(userMessage, assistantMessage);
  project.generated ||= [];
  project.generated.push(artifact);
  project.generated = project.generated.slice(-80);
  project.summary = project.summary || clip(prompt, 180);
  normalizeProjectMemory(project);
  project.memory.decisions = mergeUnique(
    project.memory.decisions,
    [`${displayLabel}: ${clip(prompt, 120)}`],
    42
  );
  project.memory.lastContinuation = `Last generated ${cleanKind}: ${clip(prompt, 140)}`;
  project.runs.push({
    id: id("run"),
    type: `${cleanKind}-generation`,
    createdAt: now(),
    artifacts: [artifact],
    agents: mediaGenerationAgents(cleanKind, artifact),
    output: artifact.url,
    modelPlan: { generator: artifact.provider }
  });
  project.runs = project.runs.slice(-80);
  await saveProject(project);
  return { ok: true, artifact, userMessage, assistantMessage, project, summary: projectSummary(project) };
}

async function serveGeneratedAsset(url, res) {
  const match = url.pathname.match(/^\/api\/generated\/images\/([A-Za-z0-9_.-]+\.(?:svg|gif|png|webp|jpe?g))$/);
  if (!match) return false;
  const directory = GENERATED_IMAGES_DIR;
  const filePath = path.normalize(path.join(directory, match[1]));
  const relative = path.relative(directory, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    json(res, 403, { error: "forbidden" });
    return true;
  }
  try {
    const content = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      ".svg": "image/svg+xml; charset=utf-8",
      ".gif": "image/gif",
      ".png": "image/png",
      ".webp": "image/webp",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg"
    }[ext] || "application/octet-stream";
    res.writeHead(200, {
      "content-type": contentType,
      "content-length": content.length,
      "cache-control": "no-store"
    });
    res.end(content);
  } catch {
    notFound(res);
  }
  return true;
}

function sse(res) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no"
  });
  return (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
}

/**
 * Executes the safe, read-only preparation part of a Nexa 3.0 tool plan.
 * File writes and terminal commands remain in the existing code workflow where
 * permission checks and post-write verification already exist.
 */
async function executeNexaToolPlan(pipeline, project, userText, attachments = []) {
  const tools = pipeline?.toolExecutor?.tools || [];
  const results = [];
  const shouldReadWorkspace = tools.includes("file-system");
  const autoContext = shouldReadWorkspace
    ? await workspaceAutoContext(project, userText, attachments)
    : [];

  if (tools.includes("memory")) {
    results.push({ tool: "memory", status: "complete", result: recentActionHints(project).slice(0, 5) });
  }
  if (tools.includes("rag")) {
    results.push({ tool: "rag", status: "complete", result: attachments.map((item) => item.name).slice(0, 12) });
  }
  if (shouldReadWorkspace) {
    results.push({ tool: "file-system", status: "complete", result: contextSummary(autoContext) });
  }
  if (tools.includes("terminal")) {
    results.push({ tool: "terminal", status: "deferred", result: "コード変更後の検証時に実行" });
  }
  if (tools.includes("web-search")) {
    results.push({ tool: "web-search", status: "planned", result: "検索プロバイダーが有効な場合のみ実行" });
  }

  pipeline.toolExecutor.results = results;
  return { autoContext, results };
}

async function chatStream(req, res) {
  const send = sse(res);
  try {
    const body = await readBody(req);
    const project = await getProject(body.projectId);
    if (!project) {
      send("error", { error: "project_not_found" });
      res.end();
      return;
    }

    const submittedText = String(body.message || "").trim();
    if (!submittedText) {
      send("error", { error: "empty_message" });
      res.end();
      return;
    }
    let resumedSafetyPlan = pendingSafetyPlanContinuation(project, submittedText);
    let userText = resumedSafetyPlan
      ? `${resumedSafetyPlan.executableRequest}\n直前に提示した安全な代替案に沿って進め、破壊的変更の前に最終確認を取って。`
      : submittedText;
    let safetyDecision = null;
    let codeFollowUpDecision = null;
    resolveLatestChoiceRequest(project);

    let creditCharge = null;
    try {
      creditCharge = await consumeRequestCredits(req, 1, "chat");
    } catch (error) {
      send("error", { error: error.message, code: error.code || "", credits: error.credits || null });
      res.end();
      return;
    }

    if (body.mode !== undefined) project.mode = normalizeChatMode(body.mode);
    if (body.accessLevel !== undefined) {
      project.accessLevel = normalizeAccessLevel(body.accessLevel);
      project.codex = normalizeCodexState(project);
      project.codex.permissions = codexPermissionForAccess(project.accessLevel);
    }
    normalizeChatWorkspaceState(project);
    if (project.mode === "code" && !project.workspaceReady) {
      const system = await systemProfile();
      const attachments = await storeAttachments(project, body.attachments || []);
      const userMessage = {
        id: id("msg"),
        role: "user",
        content: submittedText,
        attachments: attachments.map(({ id: fileId, name, type, size, source, path: contextPath }) => ({
          id: fileId,
          name,
          type,
          size,
          source,
          path: contextPath
        })),
        context: [],
        createdAt: now()
      };
      const assistantMessage = {
        id: id("msg"),
        role: "assistant",
        content: "コードを書く場所を選べるようにしました。",
        model: "local-choice-router",
        agents: [agentItem("orchestrator", "Code mode requires a selected workspace folder before direct writes.")],
        choiceRequest: folderRequiredChoiceRequest(project, userText),
        processEvents: [
          processEvent("thinking", "コードモードを確認", "直接書き込みにはPCの作業フォルダーが必要です。")
        ],
        createdAt: now()
      };
      project.messages.push(userMessage, assistantMessage);
      await saveProject(project);
      send("system", system);
      send("user", userMessage);
      send("assistant-start", assistantMessage);
      send("assistant-complete", assistantMessage);
      send("project", projectSummary(project));
      res.end();
      return;
    }

    const system = await systemProfile();
    const plugins = await loadPlugins();
    const mcp = await loadMcp({ probe: Boolean(body.options?.mcp) });
    const attachments = await storeAttachments(project, body.attachments || []);
    const autoContext = await workspaceAutoContext(project, userText, attachments);
    const allContext = [...attachments, ...autoContext];
    const userMessage = {
      id: id("msg"),
      role: "user",
      content: submittedText,
      attachments: attachments.map(({ id: fileId, name, type, size, source, path: contextPath }) => ({
        id: fileId,
        name,
        type,
        size,
        source,
        path: contextPath
      })),
      context: contextSummary(autoContext),
      createdAt: now()
    };
    project.messages.push(userMessage);

    send("system", system);
    if (creditCharge?.credits) send("credits", creditCharge.credits);
    send("user", userMessage);
    send("tool", {
      id: "workspace.context",
      name: "Workspace Context",
      status: autoContext.length ? "complete" : "idle",
      results: contextSummary(autoContext)
    });

    let webResults = [];
    if (body.options?.web) {
      send("tool", { id: "web.search", name: "Web Search", status: "running" });
      try {
        webResults = await webSearch(userText, 5);
        send("tool", { id: "web.search", name: "Web Search", status: "complete", results: webResults });
      } catch (error) {
        send("tool", { id: "web.search", name: "Web Search", status: "fallback", error: error.message });
      }
    }
    if (body.options?.mcp) {
      const mcpTools = mcp.servers.flatMap((server) =>
        (server.tools || []).map((tool) => ({ server: server.name, ...tool }))
      );
      send("tool", {
        id: "mcp",
        name: "MCP",
        status: mcpTools.length ? "complete" : "fallback",
        results: mcpTools,
        error: mcpTools.length ? "" : "No enabled MCP tools found."
      });
    }

    const runMode = normalizeRunMode(body.options?.mode);
    const codexSnapshot = await workspaceCodexState(project);
    const context = buildContext(project, userText, allContext, webResults, plugins, mcp, runMode, codexSnapshot);
    const runId = id("run");
    send("run", { id: runId, status: "started", projectId: project.id, mode: runMode });

    const needsResearch =
      body.options?.web || /検索|調べ|最新|ニュース|web|source|cite|引用/i.test(userText);
    const needsCode =
      runMode === "code" ||
      runMode === "review" ||
      body.options?.code ||
      /code|コード|実装|script|app|api|bug|修正|改善|関数|ファイル|ui|ux|画面|デザイン|ワークスペース|続き/i.test(userText);
    const activeAgents = AGENTS.filter((agent) => {
      if (agent.id === "research") return needsResearch || runMode === "review";
      if (agent.id === "architect") return needsCode;
      return true;
    });

    const outputs = await Promise.all(
      activeAgents.map((agent) => runAgent(agent, context, `回答はユーザーに見せる前提の短い成果物にしてください。\n${modeInstruction(runMode)}`, system.plan, send))
    );

    const finalModel = system.plan.conversation || system.plan.fast;
    const assistantMessage = {
      id: id("msg"),
      role: "assistant",
      content: "",
      model: publicModelName(finalModel || "local-fallback"),
      agents: outputs.map((item) => ({
        id: item.agent.id,
        name: "Nexa",
        model: publicModelName(item.model || "local-fallback"),
        error: item.error || ""
      })),
      createdAt: now()
    };

    send("assistant-start", assistantMessage);
    const prompt = finalPrompt(context, outputs, runMode);
    try {
      if (finalModel) {
        const filterThinking = createThinkingFilter();
        for await (const delta of llmChatStream(finalModel, [
        {
          role: "system",
          content:
              "あなたは最終応答AIです。必ず日本語で、最終回答だけを書きます。分析、下書き、内部検討、英語の前置きは出しません。自己紹介では内部構造名で名乗らず、作業を手伝うAIアシスタントとして自然に答えてください。"
          },
          { role: "user", content: prompt }
        ], { numPredict: 650, temperature: 0.35 })) {
          const visible = filterThinking(delta);
          if (!visible) continue;
          assistantMessage.content += visible;
          send("assistant-delta", { id: assistantMessage.id, delta: visible });
        }
      } else {
        const fallback = [
          "了解です。プロジェクト履歴、添付、ツール状況を統合して進めます。",
          "",
          outputs.map((item) => `- Nexa: ${sanitizeNexaVisibleText(clip(item.output, 170))}`).join("\n"),
          "",
          "この内容はプロジェクト記憶に保存されるため、次回「前回の続きをやって」で再開できます。"
        ].join("\n");
        for (const part of fallback.match(/.{1,80}/gs) || []) {
          assistantMessage.content += part;
          send("assistant-delta", { id: assistantMessage.id, delta: part });
          await new Promise((resolve) => setTimeout(resolve, 12));
        }
      }
    } catch (error) {
      const fallback = `Ollama応答中に問題が起きました: ${error.message}\n\n${outputs
        .map((item) => `## Nexa\n${sanitizeNexaVisibleText(item.output)}`)
        .join("\n\n")}`;
      assistantMessage.content = fallback;
      send("assistant-delta", { id: assistantMessage.id, delta: fallback });
    }

    assistantMessage.content = sanitizeUserVisibleAssistantText(assistantMessage.content);
    const memoryOutput = outputs.find((item) => item.agent.id === "memory")?.output || "";
    if (normalizeCodexState(project).memories.generate !== false) {
      updateMemory(project, userText, assistantMessage.content, memoryOutput);
    }
    project.messages.push(assistantMessage);
    project.runs.push({
      id: runId,
      createdAt: now(),
      agents: outputs.map((item) => ({
        id: item.agent.id,
        name: "Nexa",
        title: "Nexa",
        model: publicModelName(item.model || "local-fallback"),
        output: sanitizeNexaVisibleText(clip(item.output, 1800)),
        error: item.error || ""
      })),
      webResults,
      workspaceContext: contextSummary(autoContext),
      modelPlan: system.plan,
      mode: runMode
    });
    project.runs = project.runs.slice(-60);
    await saveProject(project);

    send("assistant-complete", assistantMessage);
    send("project", projectSummary(project));
    send("run", { id: runId, status: "complete", projectId: project.id, mode: runMode });
    res.end();
  } catch (error) {
    send("error", { error: error.message });
    res.end();
  }
}

const COMPANY_AGENT_ORDER = [
  ["orchestrator", "司令塔"],
  ["planner", "計画"],
  ["memory", "記憶"],
  ["toolRouter", "ツール"],
  ["reasoner", "推論"],
  ["strategist", "設計"],
  ["coder", "コード"],
  ["researcher", "調査"],
  ["secondOpinion", "別視点"],
  ["critic", "批評"],
  ["verifier", "検証"],
  ["selfEvaluator", "品質"],
  ["security", "安全"],
  ["responseGenerator", "応答"]
];

function includesAnyText(text, terms = []) {
  const source = String(text || "").toLowerCase();
  return terms.some((term) => source.includes(String(term).toLowerCase()));
}

function continuationHintFromProject(project = null) {
  if (!project) return "";
  const memory = normalizeProjectMemory(project);
  const recentAssistant = [...(project.messages || [])]
    .reverse()
    .find((message) => message.role === "assistant" && String(message.content || "").trim());
  return [
    recentAssistant ? `直前の回答: ${clip(stripThinking(recentAssistant.content || ""), 420)}` : "",
    memory.lastContinuation,
    ...(memory.next || []).slice(-2),
    ...(memory.tasks || []).slice(-2),
    ...(memory.decisions || []).slice(-2),
    project.summary
  ]
    .filter(Boolean)
    .map((item) => String(item).replace(/\s+/g, " ").trim())
    .find(Boolean) || "";
}

function latestImplementationRequest(project = null) {
  const messages = [...(project?.messages || [])].reverse();
  const candidate = messages.find((message) => {
    if (message.role !== "user") return false;
    const text = String(message.content || "").trim();
    if (!text || isExplicitSafetyApproval(text)) return false;
    if (/^(?:動かない|動くようにして|動かして|起動しない|起動できるようにして|反応しない|表示されない|エラー|バグ|直して)[よね。.!！\s]*$/i.test(text)) return false;
    return /(作って|作成|実装|ゲーム|アプリ|サイト|LP|コード|修正|変更|追加|削除|build|create|implement|fix)/i.test(text);
  });
  return candidate ? executableRequestFromSafetyPrompt(candidate.content) : "";
}

function resolveCodeFollowUpContext(project, submittedText = "") {
  const text = String(submittedText || "").trim();
  const failure = /(?:動かない|動くようにして|動かして|起動しない|起動できるようにして|反応しない|表示されない|開かない|正常に動作させて|エラー(?:が出る|出た)?|バグ(?:がある)?|壊れた|失敗した)/i.test(text);
  if (!failure || !project?.workspaceReady) return null;
  const previousGoal = latestImplementationRequest(project);
  return {
    action: "debug",
    confidence: previousGoal ? 0.97 : 0.82,
    source: "context-decision-ai",
    previousGoal,
    effectiveRequest: [
      previousGoal ? `直前の実装目的: ${previousGoal}` : "直前に選択フォルダーへ実装したコード",
      `現在の報告: ${text}`,
      "新規アプリとして作り直さず、現在のファイルを読み、起動方法と実行時エラーを確認し、根本原因を修正してから再テストして。"
    ].join("\n")
  };
}

function analyzeUserIntent(userText = "", project = null) {
  const text = String(userText || "").trim();
  const lower = text.toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const charCount = [...text].length;
  const isTerse = charCount > 0 && charCount <= 24;
  const failureFollowUp = isTerse && /(?:動かない|動くようにして|動かして|起動しない|起動できるようにして|反応しない|表示されない|開かない|正常に動作させて|エラー|バグ|壊れた|失敗)/i.test(text);
  const contextualFollowUp = isTerse && Boolean(continuationHintFromProject(project)) && includesAnyText(text, [
    "初心者", "わかりやすく", "分かりやすく", "簡単に", "詳しく", "短く", "もっと", "それ", "これ", "さっき", "前の", "上の", "その", "動かない", "動くように", "動かして", "起動しない", "起動できるように", "反応しない", "表示されない", "開かない", "エラー", "バグ", "壊れた"
  ]);
  const continuation = contextualFollowUp || /^(continue|next|go on|resume|more)$/i.test(compact) ||
    includesAnyText(text, [
      "\u7d9a\u304d",
      "\u3064\u3065\u304d",
      "\u7d9a\u3051\u3066",
      "\u7d9a\u304d\u3084\u3063\u3066",
      "\u3055\u3063\u304d\u306e\u7d9a\u304d",
      "\u3082\u3063\u3068"
    ]);
  const continuationHint = continuation ? continuationHintFromProject(project) : "";
  const chatGptLevel = /chat\s*gpt|gpt[-\s]?(level|grade|class)|openai[-\s]?grade|chatgpt[-\s]?level/i.test(lower) ||
    includesAnyText(text, [
      "ChatGPT",
      "\u30c1\u30e3\u30c3\u30c8GPT",
      "GPT\u30ec\u30d9\u30eb",
      "ChatGPT\u30ec\u30d9\u30eb",
      "GPT\u7d1a",
      "ChatGPT\u7d1a"
    ]);
  const selfImprovement = chatGptLevel ||
    /smarter|intelligence|reasoning|intent|improve\s+(the\s+)?ai|make\s+.*ai\s+.*better|agent\s+quality/i.test(lower) ||
    includesAnyText(text, [
      "\u3082\u3063\u3068AI\u81ea\u4f53\u3092\u8ce2\u304f\u3057\u3066",
      "AI\u81ea\u4f53",
      "\u8ce2\u304f",
      "\u8ce2\u3044",
      "\u3082\u3063\u3068\u8ce2\u304f",
      "\u982d\u826f\u304f",
      "\u610f\u56f3\u7406\u89e3",
      "\u77ed\u6587",
      "\u77ed\u3044\u6587\u7ae0",
      "\u63a8\u8ad6",
      "\u5224\u65ad",
      "\u30ec\u30d9\u30eb",
      "Lv",
      "\u81ea\u5df1\u6539\u5584",
      "\u30de\u30eb\u30c1\u30a8\u30fc\u30b8\u30a7\u30f3\u30c8"
    ]);
  const codeWrite = isWorkspaceCodeWriteRequest(text);
  const codeCapability = isWorkspaceCodeCapabilityQuestion(text) && !codeWrite;
  const folderOverview = isFolderOverviewQuestion(text);
  const image = /image|picture|generate.*image/i.test(lower) ||
    includesAnyText(text, ["\u753b\u50cf\u751f\u6210", "\u753b\u50cf\u4f5c\u3063\u3066", "\u753b\u50cf"]);
  const video = /video|movie|generate.*video/i.test(lower) ||
    includesAnyText(text, ["\u52d5\u753b\u751f\u6210", "\u52d5\u753b\u4f5c\u3063\u3066", "\u52d5\u753b"]);
  const research = /research|web|search|latest|news|compare|source|cite/i.test(lower) ||
    includesAnyText(text, ["\u8abf\u3079", "\u691c\u7d22", "\u6700\u65b0", "\u30cb\u30e5\u30fc\u30b9", "\u6bd4\u8f03", "\u6839\u62e0", "\u51fa\u5178"]);
  const repair = failureFollowUp || /fix|repair|debug|improve|refactor|polish/i.test(lower) ||
    includesAnyText(text, ["\u4fee\u6b63", "\u76f4\u3057", "\u6539\u5584", "\u30d0\u30b0", "\u30a8\u30e9\u30fc", "\u4ed5\u4e0a\u3052"]);
  const create = /create|make|build|implement|write|generate/i.test(lower) ||
    includesAnyText(text, ["\u4f5c\u3063\u3066", "\u4f5c\u6210", "\u5b9f\u88c5", "\u66f8\u3044\u3066", "\u751f\u6210"]);
  const explain = /explain|describe|what is|how/i.test(lower) ||
    includesAnyText(text, ["\u8aac\u660e", "\u6559\u3048\u3066", "\u306a\u306b", "\u3069\u3046\u3084\u3063\u3066"]);

  let taskKind = "chat";
  if (selfImprovement) taskKind = "self_improvement";
  else if (video && IMAGE_GENERATION_ONLY) taskKind = "media_generation_unsupported";
  else if (video) taskKind = "video_generation";
  else if (image) taskKind = "image_generation";
  else if (folderOverview) taskKind = "folder_overview";
  else if (codeCapability) taskKind = "code_capability";
  else if ((codeWrite || failureFollowUp) && repair) taskKind = "code_modify";
  else if (codeWrite || create) taskKind = "code_create";
  else if (research) taskKind = "research";
  else if (explain) taskKind = "explain";
  else if (continuation) taskKind = "continue";

  const selfImprovementWantsCode = selfImprovement && (
    Boolean(project?.workspaceReady) ||
    codeWrite ||
    /server\.mjs|public\/|app\.js|styles\.css|package\.json|implement|build|installer|dist/i.test(lower) ||
    includesAnyText(text, ["このアプリ", "今のアプリ", "Nexa", "実装", "修正", "アップデート", "ビルド", "インストーラー"])
  );
  const needsCode = selfImprovementWantsCode || failureFollowUp ||
    taskKind === "code_create" ||
    taskKind === "code_modify" ||
    codeWrite;
  const needsWorkspaceContext = needsCode ||
    taskKind === "folder_overview" ||
    taskKind === "code_capability" ||
    taskKind === "self_improvement";
  const likelyDeliverables = [];
  if (taskKind === "self_improvement") {
    likelyDeliverables.push("server-side intent routing", "agent prompts", "memory updates", "verification improvements");
    if (chatGptLevel) {
      likelyDeliverables.push("Nexa answer contract", "stricter self-evaluation", "short prompt intent recovery");
    }
  } else if (needsCode) {
    likelyDeliverables.push(...inferRequestedFiles(text));
    if (!likelyDeliverables.length) likelyDeliverables.push("focused code changes");
  } else if (image) {
    likelyDeliverables.push("image artifact preview");
  } else if (video && IMAGE_GENERATION_ONLY) {
    likelyDeliverables.push("image generation alternative", "storyboard prompt suggestion");
  } else if (video) {
    likelyDeliverables.push("video artifact preview");
  } else {
    likelyDeliverables.push(continuationHint ? "continue previous project work" : "direct answer");
  }

  return {
    taskKind,
    confidence: selfImprovement || codeWrite || image || video || research ? "high" : isTerse ? "medium" : "medium-high",
    isTerse,
    continuation,
    contextualFollowUp,
    failureFollowUp,
    continuationHint,
    selfImprovement,
    chatGptLevel,
    selfImprovementWantsCode,
    videoUnsupported: Boolean(video && IMAGE_GENERATION_ONLY),
    needsCode,
    needsResearch: research,
    needsCare: /token|api key|secret|password|rm |del |format/i.test(lower) ||
      includesAnyText(text, ["\u524a\u9664", "\u5371\u967a", "\u30d1\u30b9\u30ef\u30fc\u30c9", "\u500b\u4eba\u60c5\u5831"]),
    needsWorkspaceContext,
    inferredGoal: selfImprovement
      ? chatGptLevel
        ? "Improve Nexa usefulness: infer short intent, use memory and workspace context, route tools, self-check answers, revise weak replies, and avoid overclaiming."
        : "Improve Nexa's own ability to infer intent, route work, use memory, write code reliably, and avoid unnecessary questions."
      : needsCode
        ? "Implement the requested change in the selected workspace using safe concrete defaults."
        : continuationHint
          ? `Continue the previous project work using this memory hint: ${clip(continuationHint, 220)}`
          : video && IMAGE_GENERATION_ONLY
          ? "Explain that video generation has been removed, then offer image generation or a storyboard-style alternative without pretending a video was created."
          : research
          ? "Gather or reason about information and provide a grounded answer."
          : "Respond directly in the user's language.",
    likelyDeliverables: [...new Set(likelyDeliverables)].slice(0, 10),
    safeDefaults: [
      "Prefer action over asking when a safe default exists.",
      "Use the selected workspace as the source of truth when available.",
      "Keep questions out of the final answer and expose choices separately."
    ],
    projectState: {
      mode: normalizeChatMode(project?.mode),
      accessLevel: normalizeAccessLevel(project?.accessLevel),
      workspaceReady: Boolean(project?.workspaceReady),
      workspaceName: project?.selectedFolderName || folderNameFromWorkspace(project?.workspaceRoot || "") || project?.name || ""
    }
  };
}

function formatIntentProfile(intent = {}) {
  return JSON.stringify({
    taskKind: intent.taskKind,
    confidence: intent.confidence,
    terse: intent.isTerse,
    continuation: intent.continuation,
    continuationHint: intent.continuationHint,
    selfImprovement: intent.selfImprovement,
    chatGptLevel: intent.chatGptLevel,
    selfImprovementWantsCode: intent.selfImprovementWantsCode,
    videoUnsupported: intent.videoUnsupported,
    needsCode: intent.needsCode,
    needsResearch: intent.needsResearch,
    needsWorkspaceContext: intent.needsWorkspaceContext,
    inferredGoal: intent.inferredGoal,
    likelyDeliverables: intent.likelyDeliverables,
    safeDefaults: intent.safeDefaults,
    projectState: intent.projectState
  }, null, 2);
}

function needsWorkspaceCodingContext(userText = "") {
  const text = String(userText || "");
  const intent = analyzeUserIntent(text);
  if (intent.needsWorkspaceContext) return true;
  return /server\.mjs|app\.js|styles\.css|index\.html|public\/|src\/|package\.json|ui|sidebar|composer/i.test(text) ||
    includesAnyText(text, [
      "\u3053\u306e\u30a2\u30d7\u30ea",
      "\u4eca\u306e\u30a2\u30d7\u30ea",
      "\u3053\u306e\u30b5\u30a4\u30c8",
      "\u753b\u9762",
      "\u30c7\u30b6\u30a4\u30f3",
      "\u30b5\u30a4\u30c9\u30d0\u30fc",
      "\u30c1\u30e3\u30c3\u30c8",
      "\u5165\u529b\u6b04",
      "\u65e2\u5b58",
      "\u30d5\u30a1\u30a4\u30eb",
      "\u4fee\u6b63",
      "\u5909\u66f4",
      "\u76f4\u3057",
      "\u6539\u5584"
    ]);
}

function routeCompanyWork(userText = "") {
  const text = String(userText || "");
  const lower = text.toLowerCase();
  const needsCode = /code|api|css|html|javascript|node|python|typescript|react|vue|svelte|bug|error|fix/i.test(text) ||
    includesAnyText(text, [
      "\u30b3\u30fc\u30c9",
      "\u30d7\u30ed\u30b0\u30e9\u30e0",
      "\u5b9f\u88c5",
      "\u4fee\u6b63",
      "\u30d0\u30b0",
      "\u30a8\u30e9\u30fc",
      "\u6a5f\u80fd",
      "\u4f5c\u6210",
      "\u958b\u767a",
      "\u30a2\u30d7\u30ea",
      "\u30d5\u30a1\u30a4\u30eb",
      "\u66f8\u3044",
      "\u66f8\u3051"
    ]);
  return {
    needsCode,
    needsResearch: /調べ|検索|最新|ニュース|比較|根拠|出典|research|web/i.test(text),
    needsCare: /削除|実行|危険|パスワード|個人情報|token|api key|secret|rm |del |format/i.test(lower),
    isComplex: text.length > 80 || /なぜ|設計|手順|分析|比較|どうすれば|最適|改善/i.test(text)
  };
}

function isAssistantSelfIntroductionRequest(userText = "") {
  const text = String(userText || "")
    .replace(/[。.!！?？]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return false;
  if (/^(簡単に|短く|まず|最初に|改めて)?\s*自己紹介(して|をして|してください|お願いします|お願い|してほしい)?$/i.test(text)) {
    return true;
  }
  if (/(あなた|君|きみ|お前|AI|アシスタント).*(誰|だれ|何者|なにもの|自己紹介)/i.test(text)) {
    return true;
  }
  return /^(who are you|what are you|introduce yourself)$/i.test(text);
}

function assistantSelfIntroductionReply(userText = "") {
  if (!isAssistantSelfIntroductionRequest(userText)) return "";
  return [
    "私は、あなたの作業を手伝うAIアシスタントです。",
    "会話の整理、文章作成、コードの相談、ファイルを参考にした回答などを手伝えます。",
    "必要なときは短く、作業を進めるときは手順やコードまで具体的に返します。"
  ].join("\n");
}

function assistantChatCapabilityReply(userText = "", mode = "") {
  if (normalizeChatMode(mode) !== "chat") return "";
  const text = String(userText || "").replace(/\s+/g, "").trim();
  const asksCapability = /あなた|君|きみ|AI|アシスタント/.test(text) && /何ができる|できること|手伝える|何をする|何してくれる/.test(text);
  if (!asksCapability) return "";
  return [
    "会話や相談、文章の作成・要約、アイデア出し、勉強や調べものの整理を手伝えます。",
    "添付した内容をもとに考えをまとめることもできます。気になることをそのまま送ってください。"
  ].join("\n");
}

function assistantNexaStrengthsReply(userText = "", mode = "") {
  if (normalizeChatMode(mode) !== "chat") return "";
  const text = String(userText || "").replace(/\s+/g, "").trim();
  const asksAboutNexa = /(?:Nexa|ネクサ).{0,24}(?:強み|特徴|得意|できること|仕組み)/i.test(text) ||
    /(?:強み|特徴|得意|できること|仕組み).{0,24}(?:Nexa|ネクサ)/i.test(text);
  if (!asksAboutNexa) return "";

  return [
    "Nexaの強みは、会話だけで終わらせず、プロジェクト単位で作業を続けられるところです。",
    "",
    "1. 会話の流れを使える: 同じチャットの直近のやり取りを参照するので、「詳しく」「初心者向けに」のような続きの指示を前の話題につなげます。",
    "2. プロジェクトで整理できる: チャット、選択フォルダー、添付、作業履歴をプロジェクトごとに保持します。再起動後も続きから進められます。",
    "3. モードを分けられる: チャットモードは会話に集中し、コードモードでは選択フォルダー内のファイル確認・変更・検証を扱います。",
    "4. 作業を見える化できる: 計画、文脈確認、実装、検証などの進行状況をチャット内と右側のチーム表示に出します。",
    "5. 安全に作業できる: アクセス権とフォルダー範囲を分け、危険な操作は確認を求める設計です。",
    "",
    "正直にいうと、Nexa3.0はモデル本体の性能を表す客観的な知能レベルではありません。選択中の実行モデルに、会話履歴、プロジェクト記憶、ツール制御、品質確認を組み合わせて使いやすくする仕組みです。"
  ].join("\n");
}

function isWorkspaceCodeCapabilityQuestion(userText = "") {
  const text = String(userText || "");
  const lower = text.toLowerCase();
  const hasCodeTarget = /(code|program|script|file|app|html|css|javascript|typescript|python)/i.test(lower) ||
    includesAnyText(text, [
      "\u30b3\u30fc\u30c9",
      "\u30d7\u30ed\u30b0\u30e9\u30e0",
      "\u30d5\u30a1\u30a4\u30eb",
      "\u30a2\u30d7\u30ea",
      "\u5b9f\u88c5"
    ]);
  const asksCapability = /\b(can|able|possible)\b|\?$/i.test(lower) ||
    includesAnyText(text, [
      "\u3067\u304d\u308b",
      "\u51fa\u6765\u308b",
      "\u66f8\u3051\u308b",
      "\u4f5c\u308c\u308b",
      "\u4f5c\u6210\u3067\u304d\u308b",
      "\u7de8\u96c6\u3067\u304d\u308b",
      "\u4fdd\u5b58\u3067\u304d\u308b"
    ]);
  return hasCodeTarget && asksCapability;
}

function isWorkspaceCodeWriteRequest(userText = "") {
  const text = String(userText || "");
  const lower = text.toLowerCase();
  const hasCodeTarget = /(code|program|script|file|app|html|css|javascript|typescript|python|lp|site|page)/i.test(lower) ||
    includesAnyText(text, [
      "\u30b3\u30fc\u30c9",
      "\u30d7\u30ed\u30b0\u30e9\u30e0",
      "\u30d5\u30a1\u30a4\u30eb",
      "\u30a2\u30d7\u30ea",
      "\u30b5\u30a4\u30c8",
      "\u30da\u30fc\u30b8",
      "\u5b9f\u88c5",
      "LP"
    ]);
  const hasWriteAction = /\b(create|write|build|make|implement|generate)\b/i.test(lower) ||
    includesAnyText(text, [
      "\u66f8\u3044\u3066",
      "\u66f8\u304f",
      "\u4f5c\u3063\u3066",
      "\u4f5c\u6210",
      "\u4f5c\u308b",
      "\u5b9f\u88c5",
      "\u751f\u6210",
      "\u76f4\u63a5\u66f8\u3044\u3066"
    ]);
  return hasCodeTarget && hasWriteAction;
}

function workspaceCodeCapabilityDirectReply(project, userText = "") {
  if (!isWorkspaceCodeCapabilityQuestion(userText) || isWorkspaceCodeWriteRequest(userText)) return "";
  if (!project?.workspaceReady) {
    return "\u306f\u3044\u3001\u30b3\u30fc\u30c9\u306f\u66f8\u3051\u307e\u3059\u3002\u305f\u3060\u3057\u3001\u30d5\u30a1\u30a4\u30eb\u3092\u4f5c\u6210\u30fb\u7de8\u96c6\u3059\u308b\u306b\u306f\u5148\u306b\u4f5c\u696d\u30d5\u30a9\u30eb\u30c0\u30fc\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
  }
  const folderName = project.selectedFolderName || folderNameFromWorkspace(project.workspaceRoot || "") || project.name || "workspace";
  const workspaceRoot = project.workspaceRoot || project.selectedFolderPath || "";
  const access = normalizeAccessLevel(project.accessLevel);
  const accessText = access === "full"
    ? "\u73fe\u5728\u306f\u30d5\u30eb\u30a2\u30af\u30bb\u30b9\u6a29\u306a\u306e\u3067\u3001\u9078\u629e\u30d5\u30a9\u30eb\u30c0\u30fc\u5185\u306e\u4f5c\u6210\u30fb\u7de8\u96c6\u30fb\u30b3\u30de\u30f3\u30c9\u5b9f\u884c\u307e\u3067\u6271\u3048\u307e\u3059\u3002"
    : "\u73fe\u5728\u306e\u6a29\u9650\u306b\u5408\u308f\u305b\u3066\u3001\u5fc5\u8981\u306a\u5834\u9762\u3067\u78ba\u8a8d\u3057\u306a\u304c\u3089\u4f5c\u6210\u30fb\u7de8\u96c6\u3057\u307e\u3059\u3002";
  return [
    "\u306f\u3044\u3001\u3053\u306e\u30d5\u30a9\u30eb\u30c0\u30fc\u306e\u4e2d\u306b\u30b3\u30fc\u30c9\u3092\u66f8\u3051\u307e\u3059\u3002",
    `\u5bfe\u8c61: ${folderName}`,
    workspaceRoot ? `\u5834\u6240: ${workspaceRoot}` : "",
    "\u4eca\u306f\u76f4\u4e0b\u304c\u7a7a\u306a\u306e\u3067\u3001\u65b0\u3057\u3044\u30d5\u30a1\u30a4\u30eb\u3084\u30d5\u30a9\u30eb\u30c0\u30fc\u3092\u4f5c\u3063\u3066\u958b\u767a\u3092\u59cb\u3081\u3089\u308c\u307e\u3059\u3002",
    accessText,
    "\u4f5c\u308a\u305f\u3044\u3082\u306e\u3092\u8a00\u3063\u3066\u304f\u308c\u305f\u3089\u3001\u3053\u306e\u30d5\u30a9\u30eb\u30c0\u30fc\u5185\u306b\u5fc5\u8981\u306a\u30b3\u30fc\u30c9\u3092\u4f5c\u6210\u3057\u307e\u3059\u3002"
  ]
    .filter(Boolean)
    .join("\n");
}

function isFolderOverviewQuestion(userText = "") {
  const text = String(userText || "");
  if (isWorkspaceCodeCapabilityQuestion(text) && !isWorkspaceCodeWriteRequest(text)) return false;
  if (isWorkspaceCodeWriteRequest(text)) return false;
  const lower = text.toLowerCase();
  if (/(folder|directory|workspace|contents|inside|structure|tree)/i.test(lower)) return true;
  return includesAnyText(text, [
    "\u3053\u306e\u4e2d",
    "\u3053\u306e\u30d5\u30a9\u30eb\u30c0",
    "\u4e2d\u8eab",
    "\u69cb\u6210",
    "\u4f55\u304c\u5165",
    "\u3069\u3093\u306a\u3084\u3064",
    "\u30d5\u30a1\u30a4\u30eb",
    "\u30c7\u30a3\u30ec\u30af\u30c8\u30ea"
  ]);
}

function folderOverviewDirectReply(project, autoContext = [], userText = "") {
  if (!project?.workspaceReady || !isFolderOverviewQuestion(userText)) return "";
  const overview = autoContext.find((item) => item.name === "selected-folder-overview" && item.text);
  if (!overview) return "";
  const marker = "Directory overview:";
  const markerIndex = overview.text.indexOf(marker);
  const treeText = (markerIndex >= 0 ? overview.text.slice(markerIndex + marker.length) : overview.text).trim();
  const folderName = project.selectedFolderName || folderNameFromWorkspace(project.workspaceRoot || "") || project.name || "workspace";
  const workspaceRoot = project.workspaceRoot || project.selectedFolderPath || "";
  if (/No visible files or folders/i.test(treeText)) {
    return [
      `選択中のフォルダーは「${folderName}」です。`,
      workspaceRoot ? `場所: ${workspaceRoot}` : "",
      "直下には、現在アプリから見えるファイルやフォルダーはありません。",
      "空フォルダー、OneDriveの未同期、または意図した場所とは別のフォルダーを選んでいる可能性があります。"
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `選択中のフォルダーは「${folderName}」です。`,
    workspaceRoot ? `場所: ${workspaceRoot}` : "",
    "見えている中身は以下です。",
    "",
    clip(treeText, 1800)
  ]
    .filter(Boolean)
    .join("\n");
}

const baseRouteCompanyWork = routeCompanyWork;
routeCompanyWork = function routeCompanyWorkWithCoder(userText = "") {
  const text = String(userText || "");
  const lower = text.toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const intent = analyzeUserIntent(text);
  const shortIntent = {
    code: /^(lp|todo|ui|css|html|js|api|bug|fix|app|web|site)$/.test(compact) || includesAnyText(text, [
      "LP",
      "電卓",
      "自己紹介",
      "ポートフォリオ",
      "ログイン",
      "ダッシュボード",
      "タスク管理",
      "ゲーム",
      "UI",
      "直して",
      "改善",
      "作って",
      "書いて"
    ]),
    research: /^(search|web|news)$/.test(compact) || includesAnyText(text, ["検索", "調査", "調べて", "最新"]),
    image: /^(image|img)$/.test(compact) || includesAnyText(text, ["画像生成", "画像作って"]),
    video: /^(video|movie)$/.test(compact) || includesAnyText(text, ["動画生成", "動画作って"])
  };
  const writeRequest = isWorkspaceCodeWriteRequest(text);
  const capabilityQuestion = isWorkspaceCodeCapabilityQuestion(text) && !writeRequest;
  const needsCode = intent.needsCode || writeRequest || (!capabilityQuestion && (
    /code|api|css|html|javascript|node|python|typescript|react|vue|svelte|bug|error|fix/i.test(text) ||
    shortIntent.code ||
    includesAnyText(text, [
        "\u30b3\u30fc\u30c9",
        "\u30d7\u30ed\u30b0\u30e9\u30e0",
        "\u5b9f\u88c5",
        "\u4fee\u6b63",
        "\u30d0\u30b0",
        "\u30a8\u30e9\u30fc",
        "\u6a5f\u80fd",
        "\u4f5c\u6210",
        "\u4f5c\u3063\u3066",
        "\u4f5c\u308b",
        "\u958b\u767a",
        "\u30a2\u30d7\u30ea",
        "\u30b5\u30a4\u30c8",
        "\u30da\u30fc\u30b8",
        "LP",
        "\u30d5\u30a1\u30a4\u30eb",
        "\u66f8\u3044",
        "\u66f8\u3051"
      ])
  ));
  const base = baseRouteCompanyWork(userText);
  return {
    ...base,
    needsCode,
    needsResearch: base.needsResearch || intent.needsResearch || /research|web/i.test(lower) || includesAnyText(text, [
      "\u8abf\u3079",
      "\u691c\u7d22",
      "\u6700\u65b0",
      "\u30cb\u30e5\u30fc\u30b9",
      "\u6bd4\u8f03",
      "\u6839\u62e0",
      "\u51fa\u5178"
    ]) || shortIntent.research,
    needsCare: base.needsCare || intent.needsCare || /token|api key|secret|rm |del |format/i.test(lower) || includesAnyText(text, [
      "\u524a\u9664",
      "\u5371\u967a",
      "\u30d1\u30b9\u30ef\u30fc\u30c9",
      "\u500b\u4eba\u60c5\u5831"
    ]),
    isComplex: base.isComplex || intent.selfImprovement || needsCode || text.length > 80,
    intent
  };
};

function recentChatText(project) {
  return (project.messages || [])
    .slice(-8)
    .map((message) => `${message.role}: ${clip(stripThinking(message.content || ""), 700)}`)
    .join("\n") || "No previous messages.";
}

function projectMemoryText(project) {
  const memory = normalizeProjectMemory(project);
  return [
    `Summary: ${project.summary || "none"}`,
    `Facts: ${(memory.facts || []).slice(0, 8).join(" / ") || "none"}`,
    `Decisions: ${(memory.decisions || []).slice(0, 8).join(" / ") || "none"}`,
    `Next: ${(memory.next || []).slice(0, 8).join(" / ") || "none"}`
  ].join("\n");
}

function tokenizeForRecall(text = "") {
  return [...new Set(String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_./:-]+/gu, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 2)
    .slice(0, 80))];
}

function relevantMemoryText(project, userText = "", limit = 10) {
  const memory = normalizeProjectMemory(project);
  const terms = tokenizeForRecall(userText);
  const items = [
    ...(memory.facts || []).map((text) => ({ type: "fact", text })),
    ...(memory.decisions || []).map((text) => ({ type: "decision", text })),
    ...(memory.next || []).map((text) => ({ type: "next", text })),
    ...(memory.tasks || []).map((task) => ({ type: task.status === "done" ? "done-task" : "task", text: task.text || "" }))
  ];
  const scored = items
    .map((item, index) => {
      const haystack = String(item.text || "").toLowerCase();
      const overlap = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      const recency = Math.max(0, 8 - index * 0.1);
      const typeBoost = item.type === "decision" ? 2 : item.type === "task" ? 1.5 : 1;
      return { ...item, score: overlap * 4 + recency + typeBoost };
    })
    .filter((item) => item.text && item.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.length
    ? scored.map((item) => `- ${item.type}: ${clip(item.text, 180)}`).join("\n")
    : "No strongly relevant memory yet.";
}

function deepReasoningProfile(userText = "", route = {}, options = {}) {
  const text = String(userText || "");
  const explicit = /chat\s*gpt|gpt[-\s]?(level|grade|class)|opus|claude|deep|high[-\s]?quality|best|maximum|very[-\s]?high|徹底|超大幅|最高|賢く|高度|深く|全部|仕上げ/i.test(text);
  const enabled = Boolean(explicit || route.isComplex || route.intent?.selfImprovement || options.reasoningLevel === "very-high" || options.planMode);
  const lanes = [
    "intent reconstruction",
    "success criteria",
    "risk scan",
    "implementation route",
    "critic review",
    "verifier review",
    "final quality gate"
  ];
  return {
    enabled,
    label: enabled ? "Nexa deep pass" : "standard pass",
    depth: enabled ? 3 : 1,
    lanes: enabled ? lanes : lanes.slice(0, 3),
    successCriteria: [
      "Answer the latest request, not stale context.",
      "Use project memory and selected workspace when relevant.",
      "Prefer concrete implementation over vague advice.",
      "Do not end with unnecessary questions.",
      "For high-intelligence requests, improve the system workflow honestly without claiming literal model parity.",
      "Avoid claiming parity with external AI products."
    ]
  };
}

function inferRequestedFiles(userText = "") {
  const text = String(userText || "");
  const files = new Set();
  for (const match of text.matchAll(/(?:^|[\s`"'「（(])([A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:html|css|js|mjs|cjs|ts|tsx|jsx|json|md|py|txt|yml|yaml|toml|rs|go|java|cs|php|rb)(?=$|[\s`"',。、「）)])/gi)) {
    files.add(match[0].trim().replace(/^[`"'「（(\s]+|[`"',。、「）)\s]+$/g, "").replace(/\\/g, "/"));
  }
  if (/lp|landing|web\s*page|website|site/i.test(text) || includesAnyText(text, ["LP", "\u30b5\u30a4\u30c8", "\u30da\u30fc\u30b8"])) {
    files.add("index.html");
    files.add("style.css");
  }
  if (/portfolio|profile/i.test(text) || includesAnyText(text, ["\u81ea\u5df1\u7d39\u4ecb", "\u30dd\u30fc\u30c8\u30d5\u30a9\u30ea\u30aa"])) {
    files.add("index.html");
    files.add("style.css");
  }
  if (/todo|task/i.test(text) || includesAnyText(text, ["TODO", "\u30bf\u30b9\u30af\u7ba1\u7406"])) {
    files.add("index.html");
    files.add("style.css");
    files.add("app.js");
  }
  if (/dashboard|login/i.test(text) || includesAnyText(text, ["\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9", "\u30ed\u30b0\u30a4\u30f3"])) {
    files.add("index.html");
    files.add("style.css");
    files.add("app.js");
  }
  if (/javascript|js|interactive|button|game/i.test(text) || includesAnyText(text, ["\u30b2\u30fc\u30e0", "\u96fb\u5353", "\u52d5\u304f", "\u30dc\u30bf\u30f3"])) {
    if (includesAnyText(text, ["\u96fb\u5353"]) || /calculator/i.test(text)) {
      files.add("index.html");
      files.add("style.css");
      files.add("app.js");
    }
    if (files.has("index.html")) files.add("app.js");
  }
  if (/node|cli|npm/i.test(text)) {
    files.add("package.json");
    files.add("src/index.js");
  }
  return [...files];
}

function buildTaskBrief(project, userText = "", route = {}) {
  const text = String(userText || "");
  const intent = route.intent || analyzeUserIntent(text, project);
  const requestedFiles = inferRequestedFiles(text);
  const mode = route.needsCode ? "code" : route.needsResearch ? "research" : "chat";
  const directWrite = project?.workspaceReady && route.needsCode;
  const folder = project?.workspaceReady
    ? (project.workspaceRoot || project.selectedFolderPath || ".")
    : "(no selected workspace folder)";
  const acceptance = [
    route.needsCode && directWrite ? "Write generated files directly into the selected workspace folder." : "",
    route.needsCode ? "Use real relative file paths, never placeholders or absolute paths." : "",
    route.needsCode ? "After writing, verify the files exist and include minimal structural checks." : "",
    intent.videoUnsupported ? "Do not claim that a video was generated; offer image generation or a storyboard alternative instead." : "",
    "Answer in the user's language and keep the final response focused."
  ].filter(Boolean);
  return [
    "Task brief:",
    `- Mode: ${mode}`,
    `- Intent: ${intent.taskKind} (${intent.confidence})`,
    `- User intent: ${clip(text, 500)}`,
    `- Inferred goal: ${intent.inferredGoal}`,
    `- Workspace: ${folder}`,
    `- Access: ${normalizeAccessLevel(project?.accessLevel)}`,
    `- Requested/likely files: ${requestedFiles.length ? requestedFiles.join(", ") : "none inferred"}`,
    `- Likely deliverables: ${intent.likelyDeliverables?.length ? intent.likelyDeliverables.join(", ") : "direct answer"}`,
    `- Short prompt handling: ${intent.isTerse ? "infer from project memory and recent chat" : "use explicit request"}`,
    `- Direct write expected: ${directWrite ? "yes" : "no"}`,
    "- Acceptance criteria:",
    ...acceptance.map((item) => `  - ${item}`)
  ].join("\n");
}

function answerQualityContract(project, userText = "", route = {}) {
  const intent = route.intent || analyzeUserIntent(userText, project);
  const contract = [
    "Answer quality contract:",
    "- Answer the latest user request, not an older task from chat history.",
    "- Do not expose hidden reasoning, repair notes, raw model scratch text, or internal file-block instructions.",
    "- Do not end with questions when a safe default or selectable choice can be offered.",
    "- State uncertainty honestly, but avoid generic refusals.",
    "- Keep the answer in Japanese unless the user asks otherwise.",
    intent.isTerse ? "- The prompt is short; infer likely intent from project memory and recent chat before asking." : "",
    intent.continuationHint ? `- Continuation hint: ${clip(intent.continuationHint, 220)}` : "",
    intent.selfImprovement ? "- This is an app self-improvement request; talk about concrete implementation changes and measured capability level." : "",
    intent.videoUnsupported ? "- Video generation is disabled; never claim a video was generated. Offer image generation or storyboard alternatives." : "",
    route.needsCode ? "- If code was changed, summarize concrete files and verification. If code was not changed, say why." : "",
    project?.workspaceReady ? "- Treat the selected workspace as authoritative context." : ""
  ].filter(Boolean);
  return contract.join("\n");
}

function chatGptGradeResponseContract(project, userText = "", route = {}) {
  const intent = route.intent || analyzeUserIntent(userText, project);
  if (!intent.chatGptLevel && !intent.selfImprovement && !route.isComplex && !intent.isTerse) return "";
  const workspace = project?.workspaceReady
    ? (project.workspaceRoot || project.selectedFolderPath || project.selectedFolderName || "selected workspace")
    : "no selected workspace";
  return [
    "Nexa quality response contract:",
    "- Reconstruct the user's real goal from the latest message, recent chat, project memory, and selected workspace.",
    "- For short prompts, infer the most useful next action first; ask only if every safe path is blocked.",
    "- Separate facts from assumptions. If a capability is not actually available, say so and provide the closest useful alternative.",
    "- Prefer concrete outcomes: changed files, verified behavior, settings applied, clear next state, or a direct answer.",
    "- Run a self-check before final: latest request answered, no stale task drift, no hidden reasoning, no fake capability claim, no needless final question.",
    "- For self-improvement requests, report honest before/after capability level and the actual workflow improvements.",
    "- Do not claim Nexa literally equals external AI products or providers.",
    `- Workspace context: ${workspace}.`
  ].join("\n");
}

function buildAnswerBlueprint(project, userText = "", route = {}, relevantMemory = "") {
  const intent = route.intent || analyzeUserIntent(userText, project);
  const mustInclude = [
    "Answer the latest request first.",
    "Use Japanese, concise but not vague.",
    "Do not end with a question when a safe default exists."
  ];
  const avoid = [
    "Do not expose hidden reasoning or raw agent notes.",
    "Do not drift into old LP, video, or unrelated code tasks.",
    "Do not claim an external model/provider was used unless it is configured."
  ];
  const evidence = [];
  if (intent.chatGptLevel || intent.selfImprovement) {
    mustInclude.push(
      "Explain what made Nexa smarter in concrete system terms.",
      "Mention intent recovery, memory/context use, answer blueprint, self-evaluation, and revision gate.",
      "Report the honest current capability level and the limitation that local models still have limits."
    );
    evidence.push("Expected proof: changed app workflow, quality gate, build/test result, installer version when available.");
  }
  if (route.needsCode) {
    mustInclude.push("If files were changed, list changed files and verification results.");
    evidence.push("Expected proof: written files, patch result, or why direct write did not happen.");
  }
  if (intent.isTerse) {
    mustInclude.push("Treat the short prompt as a continuation of the project goal before asking for detail.");
  }
  if (intent.continuationHint) {
    mustInclude.push("Treat the latest request as a continuation or reformulation of the immediately preceding answer.");
    evidence.push(`Immediate conversation anchor: ${clip(intent.continuationHint, 420)}`);
  }
  if (intent.videoUnsupported) {
    mustInclude.push("Say video generation is disabled in this build and offer image/storyboard alternatives.");
  }
  if (project?.workspaceReady) {
    evidence.push(`Selected workspace: ${project.workspaceRoot || project.selectedFolderPath || project.name}`);
  }
  if (relevantMemory && relevantMemory !== "No strongly relevant memory yet.") {
    evidence.push(`Relevant memory: ${clip(relevantMemory, 260)}`);
  }
  return [
    "Answer blueprint:",
    `- Latest request: ${clip(String(userText || ""), 360)}`,
    `- Inferred goal: ${intent.inferredGoal || "direct useful answer"}`,
    `- Mode: ${route.needsCode ? "code" : route.needsResearch ? "research" : "chat"} / ${intent.taskKind}`,
    "- Must include:",
    ...mustInclude.map((item) => `  - ${item}`),
    "- Avoid:",
    ...avoid.map((item) => `  - ${item}`),
    "- Evidence to use:",
    ...(evidence.length ? evidence : ["  - No extra evidence required; answer directly."])
  ].join("\n");
}

function deterministicSmartnessFallback(company = {}, quality = {}) {
  const intent = company.intent || {};
  if (!intent.selfImprovement && !intent.chatGptLevel) return "";
  const grade = quality?.grade ? ` / 品質${quality.grade}` : "";
  return [
    "Nexa3.0では、回答の進め方を強化しました。",
    "",
    `これはモデル本体の知能を数値化したものではありません${grade}。ローカルモデルに、会話の文脈・記憶・計画・品質確認を組み合わせる仕組みを追加した更新です。`,
    "",
    "強化した内容:",
    "- 短い依頼でも、直近の会話・プロジェクト記憶・選択フォルダーから目的を復元",
    "- 回答前に Answer blueprint を作り、最終回答に入れるべき要素を固定",
    "- 高品質依頼では内部推論を自動で高め、意図理解・記憶利用・自己評価を優先",
    "- Nexa品質ゲートで、古い文脈へのズレ、過大表現、質問で終わる回答、内部メモ漏れを採点",
    "- Choice gateで、曖昧な短文や危険操作は本文に質問を書かず、ユーザーが選べるカードとして出力",
    "- 弱い回答は保存前に再生成し、過大に見える表現を抑制",
    "",
    "残る制約:",
    "- ローカルモデル自体の知能は、インストールされているOllamaモデルに依存します。",
    "- さらに高品質なクラウドモデルを使うには、外部API設定が必要です。"
  ].join("\n");
}

async function compactAgentCall(model, name, instruction, context, options = {}) {
  if (!model) return "";
  try {
    return await llmChat(model, [
      {
        role: "system",
        content:
          "You are Nexa in a local assistant workspace. " +
          "Return only concise useful notes. Do not answer the user directly."
      },
      { role: "user", content: `${instruction}\n\nContext:\n${context}` }
    ], {
      numPredict: options.numPredict ?? 180,
      temperature: options.temperature ?? 0.2,
      timeout: options.timeout ?? 45000,
      signal: options.signal,
      fallbackModel: options.fallbackModel,
      onFallback: options.onFallback
    });
  } catch (error) {
    return `fallback: ${error.message}`;
  }
}

async function coderAgentCall(model, userText, context, options = {}) {
  if (!model) return "";
  try {
    return await llmChat(model, [
      {
        role: "system",
        content: [
          "You are Nexa, the implementation specialist in a local assistant workspace.",
          "Do not describe the assistant to the user using internal structure names.",
           "Your job is to write actual implementation code, not only advice.",
           "Design every implementation from the current requirements and repository evidence. Do not reproduce a fixed Nexa template, canned landing page, canned game, or previous generated app.",
           "For large applications, first derive architecture boundaries, data flow, persistence, error states, security boundaries, tests, and runnable scripts, then emit every required file rather than collapsing the result into a three-file demo.",
           "Use the repository's existing framework and dependency conventions. Add a dependency only when it provides real domain value and include the required setup/configuration.",
           "A request for high quality means production behavior: loading, empty, error and success states; responsive UI; accessibility; input validation; maintainable modules; and focused tests.",
          "Treat every code-mode user message as a new implementation turn, including later messages in the same chat.",
          "The latest user request always wins. Re-read the current workspace before every turn and do not reuse a previous result when the user requests a different app, design, feature, or variant in the same genre.",
          "The selected workspace is the single source of truth. Never package code as a per-message download or create a new generated-project folder for each conversation.",
          "Write, edit, or explicitly delete files in the selected workspace tree and report the resulting diff.",
          "When a selected workspace folder is present and the user asks to create new files or complete files, prefer fenced file blocks using real relative paths, for example ```file path=\"index.html\" followed by the full file content and a closing fence.",
          "The server writes these file blocks directly into the selected folder.",
          "You may output any number of file blocks required for a complete implementation; there is no three-file limit.",
          "When the user explicitly asks to delete a file, emit a fenced block like ```delete path=\"obsolete.js\" followed by a closing fence. Never delete a file unless the latest request clearly requires it.",
          "For landing pages, product pages, portfolios, profile pages, UI mockups, or any request containing LP/site/page/UI/design/neon, never output a plain unstyled HTML page.",
          "For those frontend requests, output at least index.html and style.css. Add app.js when interaction, animation, tabs, counters, or dynamic behavior improves the result.",
          "Frontend output must look production-ready: strong hero, clear sections, responsive layout, polished spacing, cards or bands where useful, hover states, accessible buttons, and coherent typography.",
          "For neon or futuristic UI, use a dark premium visual direction, glow accents, layered gradients, animated highlights, and readable contrast.",
          "Avoid default browser buttons, unstyled bullet lists, tiny centered pages, placeholder copy, and generic 'AIで最適化' filler.",
          "For precise edits to existing files, return one valid unified diff in a fenced ```diff block.",
          "Use paths relative to the selected workspace folder; never use absolute paths.",
          "Never output placeholder paths such as relative/path.ext, path/to/file, or /path/to/workspace.",
          "Do not include explanatory text inside file blocks.",
          "If a patch is not appropriate, provide complete runnable code in file blocks.",
          "If the request targets this workspace, use the provided workspace context and avoid inventing unrelated files.",
          "When coding-context-map is present, treat it as the source of truth for framework, scripts, existing file names, and local patterns.",
          "For changes to an existing app, prefer a small unified diff over replacing entire large files.",
          "Do not rewrite unrelated files. Touch only the files required to satisfy the request.",
          "Preserve existing public APIs, storage formats, routes, CSS naming style, and UI behavior unless the user explicitly asks to replace them.",
          "Before editing, infer the likely affected modules from file snapshots, package scripts, and recent project memory.",
          "After editing, the result should pass obvious syntax checks and the project's available lint/typecheck/test commands when they exist.",
          "If the selected workspace has package.json scripts, keep the implementation compatible with those scripts.",
          "For bug fixes, identify the root cause in the existing code and patch that cause instead of adding a cosmetic workaround.",
          "For feature requests, implement the smallest complete feature surface: state, UI, persistence, and event handlers when applicable.",
          "If the intent profile says self_improvement, treat the request as an implementation task for this assistant app itself.",
          "For self_improvement, prioritize intent routing, prompt quality, workspace context selection, memory updates, verifier checks, choice-request handling, and reliable direct file writes.",
          "For very short prompts, infer the user's goal from recent chat, project memory, selected workspace, and the intent profile instead of asking a generic question.",
          "If the user asks for an app, page, game, tool, or script without exact filenames, infer a conventional file structure with as many files as the complete implementation requires.",
          "If requirements are underspecified but a safe useful default exists, choose that default and implement it instead of asking questions.",
          "Only ask for user input when blocked by missing workspace access, destructive risk, credentials, or mutually exclusive product decisions.",
          "For browser apps, usually create index.html, style.css, and app.js when interactivity is requested; omit app.js for static pages.",
          "For Node CLI tools, usually create package.json and src/index.js.",
          "Make the implementation complete enough to run or open immediately.",
          "Use the user's language for short prose around the code.",
          "Keep prose short; let the code do the work."
        ].join(" ")
      },
      {
        role: "user",
        content: [
          "/no_think",
          "Write the implementation for the primary user request. Do not solve a different task from the context.",
          `Primary user request:\n${userText}`,
          `Context:\n${context}`
        ].join("\n\n")
      }
    ], {
      numPredict: 6000,
      temperature: 0.22,
      timeout: options.timeout ?? 90000,
      signal: options.signal,
      fallbackModel: options.fallbackModel,
      onFallback: options.onFallback
    });
  } catch (error) {
    return `fallback: ${error.message}`;
  }
}

async function strictCoderRepairCall(model, userText, context, previousOutput, failureReason = "", options = {}) {
  if (!model) return "";
  try {
    return await llmChat(model, [
      {
        role: "system",
        content: [
          "You are a strict code-output repair agent.",
          "Return only valid writable artifacts.",
          "For new or full files, output fenced file blocks only, with real relative paths, like ```file path=\"index.html\".",
          "Preserve every valid file requested by the user; there is no three-file limit.",
          "For an explicitly requested deletion, output ```delete path=\"relative/file.ext\" with an empty fenced body.",
          "For LP/site/page/UI/design/neon/profile requests, include complete index.html and style.css, and app.js when motion or interaction improves the result.",
          "Do not repair a landing page into plain default HTML. It must have polished responsive CSS, hero, sections, CTA, and visual styling.",
          "For edits to existing files, output one valid unified diff only.",
          "Use the workspace context to preserve existing architecture and file names.",
          "If the failure is a formatting or path error, repair only the artifact format; do not change the user's requested feature.",
          "If the failure is a check failure, produce a minimal patch that fixes the failing file and preserves previous successful changes.",
          "No prose, no analysis, no placeholder paths, no absolute paths, no markdown outside the artifact blocks."
        ].join(" ")
      },
      {
        role: "user",
        content: [
          "/no_think",
          `Primary user request:\n${userText}`,
          `Workspace context:\n${context}`,
          `Previous output failed because:\n${failureReason || "missing writable file blocks or valid diff"}`,
          `Previous output:\n${clip(previousOutput, 9000)}`,
          "Rewrite it now as valid file blocks or one valid diff."
        ].join("\n\n")
      }
    ], {
      numPredict: 6500,
      temperature: 0.05,
      timeout: options.timeout ?? 90000,
      signal: options.signal,
      fallbackModel: options.fallbackModel,
      onFallback: options.onFallback
    });
  } catch (error) {
    return `fallback: ${error.message}`;
  }
}

function cleanCoderOutput(text) {
  let output = stripThinking(text).trim();
  if (/^(okay|sure|let me|i need|we need|first,|まず|考え)/i.test(output) && output.includes("```")) {
    output = output.slice(output.indexOf("```")).trim();
  }
  return output;
}

function extractUnifiedPatch(text = "") {
  const source = String(text || "");
  const candidates = [];
  const fence = /```(?:diff|patch)?\s*\n([\s\S]*?)```/gi;
  let match;
  while ((match = fence.exec(source))) candidates.push(match[1].trim());
  candidates.push(source.trim());

  for (const candidate of candidates) {
    if (!candidate.includes("--- ") || !candidate.includes("+++ ") || !candidate.includes("@@ ")) continue;
    try {
      parseUnifiedPatch(candidate);
      return candidate;
    } catch {
      // Keep looking for a valid patch block.
    }
  }
  return "";
}

function normalizeGeneratedFilePath(value = "") {
  const filePath = String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "");
  const lower = filePath.toLowerCase();
  if (!filePath || filePath.includes("\0")) return "";
  if (path.isAbsolute(filePath) || /^[a-z]:/i.test(filePath)) return "";
  if (filePath.split("/").includes("..")) return "";
  if (lower === "relative/path.ext" || lower.startsWith("relative/") || lower.includes("/path/to/")) return "";
  if (lower === "path/to/file" || lower.endsWith(".ext")) return "";
  if (!isTextFile(filePath)) return "";
  return filePath;
}

function cleanGeneratedFileContent(content = "") {
  const lines = String(content || "").replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && /^(text|コピー|copy)$/i.test(lines[lines.length - 1].trim())) lines.pop();
  while (lines.length && lines[lines.length - 1].trim() === "```") lines.pop();
  return lines.join("\n").replace(/^\n+|\s+$/g, "");
}

function extractGeneratedFileBlocks(text = "") {
  const source = String(text || "");
  const blocks = [];
  const addBlock = (rawPath, rawContent, operation = "write") => {
    const filePath = normalizeGeneratedFilePath(rawPath);
    const content = cleanGeneratedFileContent(rawContent);
    if (!filePath || (operation !== "delete" && !content.trim())) return;
    blocks.push({ path: filePath, content, operation });
  };

  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match;
  while ((match = fence.exec(source))) {
    const info = String(match[1] || "").trim();
    const operation = /^delete\b/i.test(info) ? "delete" : "write";
    if (!/^(?:file|delete)\b/i.test(info)) continue;
    const pathMatch =
      info.match(/\bpath\s*=\s*"([^"]+)"/i) ||
      info.match(/\bpath\s*=\s*'([^']+)'/i) ||
      info.match(/^(?:file|delete)\s+(.+)$/i);
    if (!pathMatch) continue;
    addBlock(pathMatch[1], match[2], operation);
  }

  const loose = /(?:^|\n)file\s+path\s*=\s*["']([^"']+)["']\s*\n([\s\S]*?)(?=\n(?:text|コピー|copy)\s*(?:\n|$)|\nfile\s+path\s*=|\n```|$)/gi;
  while ((match = loose.exec(source))) addBlock(match[1], match[2]);

  const deduped = new Map();
  for (const block of blocks) deduped.set(block.path, block);
  return [...deduped.values()];
}

function generatedFileBlocksMarkdown(blocks = []) {
  return blocks
    .map((block) => {
      if (block.operation === "delete") return `\`\`\`delete path="${block.path}"\n\`\`\``;
      const content = String(block.content || "").replace(/\s+$/g, "");
      return `\`\`\`file path="${block.path}"\n${content}\n\`\`\``;
    })
    .join("\n\n");
}

function isLandingPageRequest(userText = "") {
  const text = String(userText || "");
  return /lp|landing|portfolio|profile|site|page|ui|neon/i.test(text) ||
    includesAnyText(text, ["LP", "ランディング", "自己紹介", "ポートフォリオ", "サイト", "ページ", "説明", "ネオン", "UI"]);
}

function landingProductName(userText = "") {
  const text = String(userText || "");
  if (/NeonUI/i.test(text) || includesAnyText(text, ["ネオンUI"])) return "NeonUI";
  if (includesAnyText(text, ["自己紹介", "ポートフォリオ"])) return "Nexa Profile";
  const match = text.match(/([A-Za-z][A-Za-z0-9_-]{2,24})/);
  return match ? match[1] : "NeonAI";
}

function premiumLandingFileBlocks(userText = "") {
  const product = landingProductName(userText);
  const isProfile = includesAnyText(userText, ["自己紹介", "ポートフォリオ"]) && !includesAnyText(userText, ["ネオンUI", "NeonUI"]);
  const headline = isProfile
    ? "未来をつくる自己紹介"
    : `${product}: AIで設計するネオンUI`;
  const subcopy = isProfile
    ? "スキル、制作姿勢、実績を一画面で伝える、印象に残るプロフィールLPです。"
    : "生成AIが配色、余白、コンポーネント、アニメーションを読み取り、プロダクトの世界観に合うUIを提案します。";
  return [
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${product} | AI Landing Page</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&family=Noto+Sans+JP:wght@400;500;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="glow glow-one"></div>
  <div class="glow glow-two"></div>

  <header class="site-header">
    <a class="brand" href="#">
      <span class="brand-mark"></span>
      <span>${product}</span>
    </a>
    <nav aria-label="メインナビゲーション">
      <a href="#features">機能</a>
      <a href="#workflow">流れ</a>
      <a href="#pricing">導入</a>
    </nav>
    <a class="header-cta" href="#contact">相談する</a>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">AI DESIGN OS</p>
        <h1>${headline}</h1>
        <p class="lead">${subcopy}</p>
        <div class="hero-actions">
          <a class="button primary" href="#contact">無料で試す</a>
          <a class="button ghost" href="#features">機能を見る</a>
        </div>
        <dl class="metrics" aria-label="実績">
          <div><dt>3.2x</dt><dd>UI案の作成速度</dd></div>
          <div><dt>98%</dt><dd>レスポンシブ対応</dd></div>
          <div><dt>24h</dt><dd>常時アイデア化</dd></div>
        </dl>
      </div>

      <div class="hero-panel" aria-label="AI UIプレビュー">
        <div class="panel-top">
          <span></span><span></span><span></span>
          <strong>Live UI Synth</strong>
        </div>
        <div class="preview-card main-preview">
          <small>生成中のテーマ</small>
          <h2>Neon glass dashboard</h2>
          <div class="wave"></div>
        </div>
        <div class="preview-grid">
          <div class="preview-card"><b>Color</b><span>Electric cyan</span></div>
          <div class="preview-card"><b>Motion</b><span>Smooth glow</span></div>
        </div>
      </div>
    </section>

    <section class="section" id="features">
      <div class="section-heading">
        <p class="eyebrow">FEATURES</p>
        <h2>アイデアを、完成度の高いUIに変える。</h2>
      </div>
      <div class="feature-grid">
        <article>
          <span class="icon">01</span>
          <h3>意図理解</h3>
          <p>短い文章から目的、雰囲気、必要な構成を読み取り、最初の案をすばやく作ります。</p>
        </article>
        <article>
          <span class="icon">02</span>
          <h3>デザイン補完</h3>
          <p>配色、余白、カード、CTA、アニメーションまで自動で整え、素のHTMLで終わらせません。</p>
        </article>
        <article>
          <span class="icon">03</span>
          <h3>直接保存</h3>
          <p>選択したフォルダーへファイルを直接書き込み、すぐブラウザで確認できます。</p>
        </article>
      </div>
    </section>

    <section class="workflow" id="workflow">
      <div>
        <p class="eyebrow">WORKFLOW</p>
        <h2>プロンプトから公開前の形まで。</h2>
      </div>
      <ol>
        <li><span>1</span>要件を分解し、必要なセクションを設計</li>
        <li><span>2</span>HTML/CSS/JSを生成して品質を検査</li>
        <li><span>3</span>不足があれば自動補修して保存</li>
      </ol>
    </section>

    <section class="cta" id="contact">
      <p class="eyebrow">START NOW</p>
      <h2>${product}で、次のUIを作り始める。</h2>
      <p>説明LP、自己紹介、サービス紹介、アプリ画面まで。短い言葉から形にします。</p>
      <a class="button primary" href="mailto:hello@example.com">相談を送る</a>
    </section>
  </main>

  <script src="app.js"></script>
</body>
</html>
`
    },
    {
      path: "style.css",
      content: `:root {
  color-scheme: dark;
  --bg: #070911;
  --panel: rgba(255, 255, 255, 0.08);
  --panel-strong: rgba(255, 255, 255, 0.12);
  --text: #f5f8ff;
  --muted: #aab4c8;
  --cyan: #56f6ff;
  --violet: #9b7cff;
  --pink: #ff5fd7;
  --line: rgba(255, 255, 255, 0.14);
  font-family: "Inter", "Noto Sans JP", system-ui, sans-serif;
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  min-height: 100vh;
  margin: 0;
  color: var(--text);
  background:
    radial-gradient(circle at 20% 10%, rgba(86, 246, 255, 0.2), transparent 28rem),
    radial-gradient(circle at 80% 0%, rgba(255, 95, 215, 0.18), transparent 30rem),
    linear-gradient(180deg, #0c1020, var(--bg));
  overflow-x: hidden;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(to bottom, black, transparent 78%);
}

a { color: inherit; text-decoration: none; }

.glow {
  position: fixed;
  width: 28rem;
  height: 28rem;
  border-radius: 999px;
  filter: blur(42px);
  opacity: 0.35;
  pointer-events: none;
  animation: float 9s ease-in-out infinite;
}

.glow-one { left: -8rem; top: 18rem; background: var(--cyan); }
.glow-two { right: -10rem; top: 6rem; background: var(--pink); animation-delay: -4s; }

.site-header {
  width: min(1160px, calc(100% - 40px));
  min-height: 72px;
  margin: 18px auto 0;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  position: sticky;
  top: 14px;
  z-index: 10;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: rgba(7, 9, 17, 0.68);
  backdrop-filter: blur(24px);
}

.brand, nav, .hero-actions, .metrics, .panel-top, .preview-grid {
  display: flex;
  align-items: center;
}

.brand { gap: 10px; font-weight: 800; letter-spacing: 0; }
.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--cyan), var(--violet), var(--pink));
  box-shadow: 0 0 30px rgba(86, 246, 255, 0.48);
}

nav { gap: 22px; color: var(--muted); font-size: 0.92rem; }
nav a:hover { color: var(--text); }
.header-cta { padding: 10px 16px; border: 1px solid var(--line); border-radius: 999px; color: var(--cyan); }

.hero {
  width: min(1160px, calc(100% - 40px));
  min-height: calc(100vh - 110px);
  margin: 0 auto;
  padding: 76px 0 46px;
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(340px, 0.78fr);
  gap: 48px;
  align-items: center;
}

.eyebrow {
  margin: 0 0 14px;
  color: var(--cyan);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
}

h1, h2, h3, p { margin-top: 0; }

h1 {
  max-width: 840px;
  margin-bottom: 22px;
  font-size: clamp(3rem, 7vw, 6.8rem);
  line-height: 0.96;
  letter-spacing: 0;
}

.lead {
  max-width: 680px;
  color: var(--muted);
  font-size: clamp(1.05rem, 2vw, 1.32rem);
  line-height: 1.8;
}

.hero-actions { gap: 12px; margin-top: 32px; flex-wrap: wrap; }
.button {
  min-height: 48px;
  padding: 0 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-weight: 800;
  border: 1px solid var(--line);
}
.button.primary {
  color: #041015;
  background: linear-gradient(135deg, var(--cyan), #b6fffb);
  box-shadow: 0 0 42px rgba(86, 246, 255, 0.35);
}
.button.ghost { color: var(--text); background: rgba(255, 255, 255, 0.06); }

.metrics {
  gap: 12px;
  margin-top: 34px;
  flex-wrap: wrap;
}
.metrics div {
  min-width: 134px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.055);
}
.metrics dt { font-size: 1.45rem; font-weight: 800; }
.metrics dd { margin: 4px 0 0; color: var(--muted); font-size: 0.82rem; }

.hero-panel, .feature-grid article, .workflow, .cta {
  border: 1px solid var(--line);
  background: linear-gradient(180deg, var(--panel-strong), rgba(255,255,255,0.045));
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(26px);
}

.hero-panel {
  min-height: 520px;
  padding: 16px;
  border-radius: 32px;
  position: relative;
  overflow: hidden;
}

.hero-panel::after {
  content: "";
  position: absolute;
  inset: -40%;
  background: conic-gradient(from 90deg, transparent, rgba(86,246,255,0.22), transparent, rgba(255,95,215,0.2), transparent);
  animation: spin 14s linear infinite;
}

.panel-top, .preview-card { position: relative; z-index: 1; }
.panel-top { gap: 8px; margin-bottom: 16px; color: var(--muted); }
.panel-top span { width: 12px; height: 12px; border-radius: 999px; background: var(--cyan); }
.panel-top span:nth-child(2) { background: var(--violet); }
.panel-top span:nth-child(3) { background: var(--pink); }
.panel-top strong { margin-left: auto; font-size: 0.86rem; }

.preview-card {
  border: 1px solid var(--line);
  border-radius: 24px;
  background: rgba(4, 7, 16, 0.64);
}
.main-preview { min-height: 330px; padding: 28px; overflow: hidden; }
.main-preview small { color: var(--cyan); font-weight: 800; }
.main-preview h2 { margin-top: 12px; font-size: 2.25rem; line-height: 1.05; }
.wave {
  height: 142px;
  margin-top: 54px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--cyan), var(--violet), var(--pink), var(--cyan));
  filter: blur(4px);
  animation: pulse 3.2s ease-in-out infinite;
}
.preview-grid { gap: 12px; margin-top: 12px; }
.preview-grid .preview-card { flex: 1; padding: 16px; }
.preview-grid b { display: block; margin-bottom: 6px; }
.preview-grid span { color: var(--muted); }

.section, .workflow, .cta {
  width: min(1160px, calc(100% - 40px));
  margin: 0 auto 88px;
}
.section-heading { max-width: 720px; margin-bottom: 24px; }
.section h2, .workflow h2, .cta h2 { font-size: clamp(2rem, 4vw, 3.8rem); line-height: 1.08; }
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.feature-grid article { padding: 24px; border-radius: 26px; }
.icon {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  margin-bottom: 26px;
  border-radius: 14px;
  color: #061018;
  background: var(--cyan);
  font-weight: 800;
}
.feature-grid p, .workflow li, .cta p { color: var(--muted); line-height: 1.75; }

.workflow {
  padding: 34px;
  border-radius: 30px;
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  gap: 32px;
}
.workflow ol {
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
  list-style: none;
}
.workflow li {
  padding: 16px;
  display: flex;
  gap: 14px;
  align-items: center;
  border-radius: 18px;
  background: rgba(255,255,255,0.055);
}
.workflow li span {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 999px;
  color: #061018;
  background: var(--cyan);
  font-weight: 800;
}

.cta {
  padding: 42px;
  text-align: center;
  border-radius: 34px;
}
.cta p { max-width: 680px; margin: 0 auto 24px; }

@keyframes float {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(22px, -18px, 0); }
}
@keyframes spin { to { transform: rotate(1turn); } }
@keyframes pulse {
  0%, 100% { transform: scaleX(0.86); opacity: 0.64; }
  50% { transform: scaleX(1.08); opacity: 1; }
}

@media (max-width: 860px) {
  .site-header { position: relative; top: auto; flex-wrap: wrap; }
  nav { order: 3; width: 100%; justify-content: space-between; }
  .hero, .workflow { grid-template-columns: 1fr; }
  .hero { padding-top: 48px; }
  .hero-panel { min-height: 420px; }
  .feature-grid { grid-template-columns: 1fr; }
}
`
    },
    {
      path: "app.js",
      content: `const cards = document.querySelectorAll(".feature-grid article, .preview-card");

cards.forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    card.style.background = \`radial-gradient(circle at \${x}% \${y}%, rgba(86,246,255,0.16), rgba(255,255,255,0.055) 42%)\`;
  });

  card.addEventListener("pointerleave", () => {
    card.style.background = "";
  });
});
`
    }
  ];
}

async function needsLandingQualityUpgrade(project, userText = "", files = []) {
  if (!project?.workspaceReady) return false;
  const touched = new Set(files.map((file) => String(file.path || "").toLowerCase()));
  if (!touched.has("index.html") && !touched.has("style.css")) return false;
  let html = "";
  let css = "";
  try {
    html = await readFile(projectScopedWorkspacePath(project, "index.html"), "utf8");
  } catch {
    return true;
  }
  try {
    css = await readFile(projectScopedWorkspacePath(project, "style.css"), "utf8");
  } catch {
    css = "";
  }
  const looksLikeLanding = isLandingPageRequest(userText) ||
    /NeonUI|AIで設計|説明LP|自己紹介|ポートフォリオ|ランディング|<h1[\s\S]{0,160}(UI|AI|Profile|自己紹介|ネオン)/i.test(html);
  if (!looksLikeLanding) return false;
  const htmlScore = [
    /<section[\s>]/i,
    /class=["'][^"']{3,}/i,
    /<nav[\s>]|<header[\s>]/i,
    /<a[\s\S]+class=["'][^"']*(button|cta|primary)/i,
    /<script[\s\S]+src=["']app\.js/i
  ].filter((pattern) => pattern.test(html)).length;
  const cssScore = [
    /linear-gradient|radial-gradient/i,
    /box-shadow/i,
    /@media/i,
    /transition|animation|keyframes/i,
    /grid-template-columns|display:\s*grid/i,
    /border-radius/i
  ].filter((pattern) => pattern.test(css)).length;
  return html.length < 1800 || css.length < 2200 || htmlScore < 3 || cssScore < 4;
}

function isGenericCreateFallbackRequest(userText = "") {
  const text = String(userText || "");
  const lower = text.toLowerCase();
  const wantsCreate = /\b(create|make|build|generate|write|implement)\b/i.test(lower) ||
    includesAnyText(text, ["作って", "作成", "実装", "生成", "書いて", "作る", "開発", "構築"]);
  const isRepair = /\b(fix|repair|debug|refactor|change|update|delete|remove)\b/i.test(lower) ||
    includesAnyText(text, ["修正", "直して", "改善", "変更", "追加", "削除", "バグ", "エラー"]);
  return wantsCreate && !isRepair;
}

function isGameFallbackRequest(userText = "") {
  const text = String(userText || "");
  const apexMeansGame = /apex/i.test(text) && !/salesforce|soql|sosl|trigger|class|visualforce|lwc/i.test(text);
  return apexMeansGame || /fps|game|shooter|battle|arena/i.test(text) ||
    includesAnyText(userText, ["ゲーム", "FPS", "シューティング", "バトル", "アリーナ"]);
}

function is3DShooterRequest(userText = "") {
  const text = String(userText || "");
  const has3D = /\b3d\b|three\.js|webgl/i.test(text) || includesAnyText(text, ["3D", "三次元"]);
  const hasShooter = /fps|shooter|shooting|gun|battle/i.test(text) ||
    includesAnyText(text, ["シューティング", "射撃", "銃", "FPS", "バトル"]);
  return has3D && hasShooter;
}

function requestedGameTitle(userText = "") {
  const text = String(userText || "");
  const named = text.match(/([A-Za-z][A-Za-z0-9 _-]{1,30})\s*(?:というタイトル|という名前)/i);
  if (named?.[1]) return named[1].trim();
  if (/\bapex\b/i.test(text)) return "Apex";
  const descriptive = text
    .replace(/(?:を)?(?:作って|作成して|開発して|実装して).*$/i, "")
    .replace(/というタイトルの?/g, "")
    .trim();
  if (descriptive && descriptive.length <= 32) return descriptive;
  return "Nexa Strike";
}

function prefixGeneratedBlocks(blocks = [], directory = "") {
  const clean = String(directory || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!clean) return blocks;
  return blocks.map((block) => ({ ...block, path: `${clean}/${block.path}` }));
}

function generic3DShooterFileBlocks(userText = "", directory = "") {
  const title = requestedGameTitle(userText);
  const blocks = [
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | 3D Shooter</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main id="game" aria-label="${title} 3D shooter">
    <div class="hud">
      <div class="brand"><span>TACTICAL ARENA</span><strong>${title}</strong></div>
      <div class="stats">
        <span>HP <b id="health">100</b></span>
        <span>SCORE <b id="score">0</b></span>
        <span>WAVE <b id="wave">1</b></span>
      </div>
    </div>
    <div class="crosshair" aria-hidden="true"></div>
    <div id="damage" aria-hidden="true"></div>
    <section id="start" class="start-screen">
      <p>FRONTIER COMBAT SIMULATION</p>
      <h1>${title}</h1>
      <span>WASDで移動 / マウスで照準 / クリックで射撃</span>
      <button id="startButton" type="button">戦闘を開始</button>
    </section>
  </main>
  <script type="module" src="app.js"></script>
</body>
</html>`
    },
    {
      path: "style.css",
      content: `* { box-sizing: border-box; }
:root { color-scheme: dark; font-family: Inter, "Segoe UI", sans-serif; }
html, body, #game { width: 100%; height: 100%; margin: 0; overflow: hidden; }
body { background: #05070a; color: #f4f7fb; }
canvas { display: block; }
.hud { position: fixed; inset: 0 0 auto; z-index: 4; padding: 22px 28px; display: flex; justify-content: space-between; align-items: flex-start; pointer-events: none; background: linear-gradient(180deg, rgba(2,4,7,.82), transparent); }
.brand { display: grid; gap: 3px; text-transform: uppercase; }
.brand span { color: #78e4ff; font-size: 10px; letter-spacing: 2px; }
.brand strong { font-size: 24px; letter-spacing: 1px; }
.stats { display: flex; gap: 8px; }
.stats span { min-width: 92px; padding: 9px 12px; border: 1px solid rgba(255,255,255,.14); background: rgba(8,12,17,.68); backdrop-filter: blur(14px); font-size: 11px; color: #99a6b5; }
.stats b { display: block; margin-top: 2px; color: white; font-size: 18px; }
.crosshair { position: fixed; z-index: 5; left: 50%; top: 50%; width: 18px; height: 18px; transform: translate(-50%,-50%); pointer-events: none; }
.crosshair::before, .crosshair::after { content: ""; position: absolute; background: #e8fbff; box-shadow: 0 0 8px #50dfff; }
.crosshair::before { width: 18px; height: 2px; top: 8px; }
.crosshair::after { width: 2px; height: 18px; left: 8px; }
#damage { position: fixed; inset: 0; z-index: 3; pointer-events: none; background: rgba(255,32,54,0); transition: background .12s; }
#damage.hit { background: rgba(255,32,54,.22); }
.start-screen { position: fixed; inset: 0; z-index: 10; display: grid; place-content: center; justify-items: center; gap: 14px; text-align: center; background: radial-gradient(circle at 50% 42%, rgba(21,58,75,.62), rgba(3,5,8,.94) 58%); }
.start-screen.is-hidden { display: none; }
.start-screen p { margin: 0; color: #69def7; font-size: 11px; letter-spacing: 3px; }
.start-screen h1 { margin: 0; font-size: clamp(58px, 10vw, 130px); line-height: .9; text-transform: uppercase; }
.start-screen span { color: #aeb8c5; }
.start-screen button { margin-top: 16px; padding: 14px 26px; color: #041015; background: #74e9ff; border: 0; border-radius: 4px; font-weight: 800; cursor: pointer; box-shadow: 0 0 30px rgba(76,220,255,.3); }
@media (max-width: 680px) { .hud { padding: 14px; } .brand strong { font-size: 17px; } .stats span { min-width: 62px; padding: 7px; } .stats b { font-size: 15px; } }`
    },
    {
      path: "app.js",
      content: `import * as THREE from "https://unpkg.com/three@0.169.0/build/three.module.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071019);
scene.fog = new THREE.Fog(0x071019, 18, 95);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 180);
camera.rotation.order = "YXZ";
camera.position.set(0, 1.7, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.querySelector("#game").prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x8bdfff, 0x10151e, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(14, 24, 8);
sun.castShadow = true;
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(140, 140),
  new THREE.MeshStandardMaterial({ color: 0x111923, roughness: 0.82, metalness: 0.18 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
scene.add(new THREE.GridHelper(140, 70, 0x1c7891, 0x173342));

const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x24313d, roughness: 0.52, metalness: 0.45 });
for (let i = 0; i < 34; i += 1) {
  const height = 2 + Math.random() * 5;
  const box = new THREE.Mesh(new THREE.BoxGeometry(2 + Math.random() * 4, height, 2 + Math.random() * 4), obstacleMaterial);
  box.position.set((Math.random() - .5) * 100, height / 2, (Math.random() - .5) * 100);
  if (box.position.length() < 13) box.position.x += 18;
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);
}

const healthEl = document.querySelector("#health");
const scoreEl = document.querySelector("#score");
const waveEl = document.querySelector("#wave");
const startScreen = document.querySelector("#start");
const damage = document.querySelector("#damage");
const keys = new Set();
const enemies = [];
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
let health = 100;
let score = 0;
let wave = 1;
let yaw = 0;
let pitch = 0;
let nextDamage = 0;

function spawnEnemy() {
  const enemy = new THREE.Mesh(
    new THREE.CapsuleGeometry(.65, 1.2, 5, 10),
    new THREE.MeshStandardMaterial({ color: 0xff496c, emissive: 0x4a0612, roughness: .35, metalness: .35 })
  );
  const angle = Math.random() * Math.PI * 2;
  const distance = 24 + Math.random() * 28;
  enemy.position.set(camera.position.x + Math.cos(angle) * distance, 1.25, camera.position.z + Math.sin(angle) * distance);
  enemy.userData.speed = 1.6 + Math.random() * .9 + wave * .08;
  enemy.castShadow = true;
  enemies.push(enemy);
  scene.add(enemy);
}

function fillWave() {
  const target = Math.min(5 + wave * 2, 24);
  while (enemies.length < target) spawnEnemy();
  waveEl.textContent = String(wave);
}

function shoot() {
  if (document.pointerLockElement !== renderer.domElement || health <= 0) return;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hit = raycaster.intersectObjects(enemies, false)[0];
  if (!hit) return;
  const index = enemies.indexOf(hit.object);
  if (index >= 0) enemies.splice(index, 1);
  scene.remove(hit.object);
  hit.object.geometry.dispose();
  hit.object.material.dispose();
  score += 100;
  scoreEl.textContent = String(score);
  if (!enemies.length) { wave += 1; fillWave(); }
}

function updatePlayer(delta) {
  const forward = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
  const side = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
  const speed = keys.has("ShiftLeft") ? 10 : 6.5;
  const direction = new THREE.Vector3(side, 0, -forward);
  if (direction.lengthSq()) {
    direction.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    camera.position.addScaledVector(direction, speed * delta);
  }
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -66, 66);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -66, 66);
  camera.rotation.set(pitch, yaw, 0);
}

function updateEnemies(delta, time) {
  for (const enemy of enemies) {
    const direction = camera.position.clone().sub(enemy.position);
    direction.y = 0;
    const distance = direction.length();
    if (distance > 1.5) enemy.position.addScaledVector(direction.normalize(), enemy.userData.speed * delta);
    enemy.lookAt(camera.position.x, enemy.position.y, camera.position.z);
    if (distance < 2 && time > nextDamage) {
      nextDamage = time + 650;
      health = Math.max(0, health - 8);
      healthEl.textContent = String(health);
      damage.classList.add("hit");
      setTimeout(() => damage.classList.remove("hit"), 130);
      if (!health) {
        document.exitPointerLock();
        startScreen.classList.remove("is-hidden");
        startScreen.querySelector("h1").textContent = "MISSION FAILED";
        startScreen.querySelector("button").textContent = "再出撃";
      }
    }
  }
}

function reset() {
  for (const enemy of enemies.splice(0)) scene.remove(enemy);
  health = 100; score = 0; wave = 1;
  healthEl.textContent = "100"; scoreEl.textContent = "0"; waveEl.textContent = "1";
  camera.position.set(0, 1.7, 10);
  startScreen.classList.add("is-hidden");
  fillWave();
  renderer.domElement.requestPointerLock();
}

document.querySelector("#startButton").addEventListener("click", reset);
renderer.domElement.addEventListener("click", shoot);
addEventListener("keydown", event => keys.add(event.code));
addEventListener("keyup", event => keys.delete(event.code));
addEventListener("mousemove", event => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= event.movementX * .0022;
  pitch = THREE.MathUtils.clamp(pitch - event.movementY * .0022, -1.35, 1.35);
});
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function loop(time) {
  requestAnimationFrame(loop);
  const delta = Math.min(clock.getDelta(), .05);
  if (document.pointerLockElement === renderer.domElement && health > 0) {
    updatePlayer(delta);
    updateEnemies(delta, time);
  }
  renderer.render(scene, camera);
}
fillWave();
requestAnimationFrame(loop);`
    },
    {
      path: "README.md",
      content: `# ${title}

ブラウザで遊べる一人称視点の3Dシューティングゲームです。

## 起動

ローカルWebサーバーでこのフォルダーを配信し、index.htmlを開いてください。

## 操作

- WASD / 矢印キー: 移動
- Shift: ダッシュ
- マウス: 照準
- クリック: 射撃

Three.jsはCDNから読み込むため、初回起動時はインターネット接続が必要です。

Windowsでは \`start-game.cmd\` をダブルクリックすると、ローカルサーバーとゲームが起動します。`
    },
    {
      path: "server.mjs",
      content: `import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = 4173;
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

http.createServer(async (req, res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const relative = requested === "/" ? "index.html" : requested.replace(/^\\/+/, "");
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error("forbidden");
    const info = await stat(target);
    if (!info.isFile()) throw new Error("not_found");
    res.writeHead(200, { "content-type": mime[path.extname(target).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(target));
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log("Game ready: http://127.0.0.1:" + port));`
    },
    {
      path: "start-game.cmd",
      content: `@echo off
cd /d "%~dp0"
start "Nexa Game Server" /min cmd /c node server.mjs
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:4173
`
    }
  ];
  return prefixGeneratedBlocks(blocks, directory);
}

function genericNodeApiFileBlocks(userText = "") {
  const description = clip(String(userText || "API service").replace(/[`<>]/g, ""), 180);
  return [
    {
      path: "package.json",
      content: JSON.stringify({
        name: "nexa-api-service",
        version: "1.0.0",
        private: true,
        type: "module",
        scripts: { start: "node src/server.js", check: "node --check src/server.js" }
      }, null, 2)
    },
    {
      path: "src/store.js",
      content: `const records = new Map();

export function listRecords() {
  return [...records.values()];
}

export function createRecord(input = {}) {
  const id = crypto.randomUUID();
  const record = { id, title: String(input.title || "Untitled").slice(0, 120), createdAt: new Date().toISOString() };
  records.set(id, record);
  return record;
}

export function deleteRecord(id) {
  return records.delete(id);
}`
    },
    {
      path: "src/server.js",
      content: `import http from "node:http";
import { createRecord, deleteRecord, listRecords } from "./store.js";

const port = Number(process.env.PORT || 3000);

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true });
  if (req.method === "GET" && url.pathname === "/api/records") return send(res, 200, { records: listRecords() });
  if (req.method === "POST" && url.pathname === "/api/records") return send(res, 201, { record: createRecord(await readJson(req)) });
  const match = url.pathname.match(/^\\/api\\/records\\/([^/]+)$/);
  if (req.method === "DELETE" && match) return send(res, deleteRecord(match[1]) ? 200 : 404, { ok: true });
  return send(res, 404, { error: "not_found" });
});

server.listen(port, () => console.log(\`API running at http://localhost:\${port}\`));`
    },
    {
      path: "README.md",
      content: `# Nexa API Service

Generated from: ${description}

## Start

\`\`\`powershell
npm start
\`\`\`

- GET /health
- GET /api/records
- POST /api/records
- DELETE /api/records/:id`
    }
  ];
}

function genericPythonToolFileBlocks(userText = "") {
  const description = clip(String(userText || "Python tool").replace(/[`<>]/g, ""), 180);
  return [
    {
      path: "main.py",
      content: `from __future__ import annotations

import argparse
import json
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=${JSON.stringify(description)})
    parser.add_argument("input", nargs="?", help="Input text or file path")
    parser.add_argument("--output", type=Path, help="Optional JSON output path")
    return parser


def run(value: str | None) -> dict[str, object]:
    source = value or ""
    path = Path(source)
    text = path.read_text(encoding="utf-8") if source and path.is_file() else source
    return {"ok": True, "characters": len(text), "lines": len(text.splitlines()), "text": text}


def main() -> None:
    args = build_parser().parse_args()
    result = run(args.input)
    output = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(output + "\\n", encoding="utf-8")
    else:
        print(output)


if __name__ == "__main__":
    main()
`
    },
    {
      path: "test_main.py",
      content: `import unittest

from main import run


class RunTests(unittest.TestCase):
    def test_counts_text(self) -> None:
        result = run("hello\\nworld")
        self.assertEqual(result["characters"], 11)
        self.assertEqual(result["lines"], 2)


if __name__ == "__main__":
    unittest.main()
`
    },
    {
      path: "README.md",
      content: `# Python Tool

Generated from: ${description}

## Run

\`\`\`powershell
python main.py "sample text"
python -m unittest
\`\`\``
    }
  ];
}

function genericCreateFileBlocks(userText = "") {
  const text = String(userText || "");
  if (is3DShooterRequest(text)) return generic3DShooterFileBlocks(text);
  if (isGameFallbackRequest(text)) return genericArenaGameFileBlocks(text);
  if (/python|\.py\b|cli|command.?line/i.test(text) || includesAnyText(text, ["Python", "CLI", "コマンドライン"])) {
    return genericPythonToolFileBlocks(text);
  }
  if (/\bapi\b|backend|server|node(?:\.js)?|rest/i.test(text) || includesAnyText(text, ["API", "バックエンド", "サーバー"])) {
    return genericNodeApiFileBlocks(text);
  }
  return genericInteractiveAppFileBlocks(text);
}

function fallbackBlocksForWeakGeneratedBlocks(userText = "", blocks = []) {
  if (!isGameFallbackRequest(userText)) return { blocks: [], reason: "" };
  if (!blocks.length) {
    return {
      blocks: is3DShooterRequest(userText) ? generic3DShooterFileBlocks(userText) : genericArenaGameFileBlocks(userText),
      reason: "モデル出力に保存可能なゲームファイルがなかったため、直前のゲーム目的を保った実行構成へ補正します。"
    };
  }
  const paths = blocks.map((block) => String(block.path || "").replace(/\\/g, "/").toLowerCase());
  const combined = blocks.map((block) => `${block.path}\n${block.content || ""}`).join("\n").toLowerCase();
  const hasIndex = paths.some((item) => /(^|\/)index\.html?$/.test(item));
  const hasScript = paths.some((item) => /\.(js|mjs|ts|tsx|jsx)$/.test(item));
  const hasStyle = paths.some((item) => /\.css$/.test(item));
  const needs3D = is3DShooterRequest(userText);
  const hasGameSignals = needs3D
    ? /three|webgl|perspectivecamera|scene|raycaster/.test(combined)
    : /canvas|score|player|enemy|wave|hp|shoot|arena|game|fps|battle/.test(combined);
  const hasNonGameApexFile = paths.some((item) => /\.(cls|trigger)$/.test(item));
  if (hasIndex && hasScript && hasStyle && hasGameSignals && !hasNonGameApexFile) {
    return { blocks: [], reason: "" };
  }
  return {
    blocks: needs3D ? generic3DShooterFileBlocks(userText) : genericArenaGameFileBlocks(userText),
    reason: hasNonGameApexFile
      ? "Apexをゲーム制作として解釈し、クラスファイルではなく操作できるWebゲーム構成へ切り替えます。"
      : "ゲームとして開ける構成が不足していたため、HTML/CSS/JavaScriptの実行できる構成へ補正します。"
  };
}

function genericArenaGameFileBlocks(userText = "") {
  const title = requestedGameTitle(userText);
  return [
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="shell">
    <section class="hud">
      <div>
        <p>TACTICAL GAME</p>
        <h1>${title}</h1>
      </div>
      <div class="stats">
        <span>Score <strong id="score">0</strong></span>
        <span>HP <strong id="hp">100</strong></span>
        <span>Wave <strong id="wave">1</strong></span>
      </div>
    </section>
    <canvas id="game" width="960" height="540" aria-label="${title} game"></canvas>
    <section class="controls">
      <span>WASD / 矢印: 移動</span>
      <span>クリック: ショット</span>
      <span>R: リスタート</span>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>
`
    },
    {
      path: "style.css",
      content: `* {
  box-sizing: border-box;
}

:root {
  color-scheme: dark;
  --bg: #080b12;
  --panel: rgba(255, 255, 255, 0.08);
  --line: rgba(255, 255, 255, 0.16);
  --text: #f5f7fb;
  --muted: #aab2c5;
  --accent: #46f0c2;
  --danger: #ff5f6d;
}

body {
  min-height: 100vh;
  margin: 0;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 20% 10%, rgba(70, 240, 194, 0.22), transparent 30%),
    radial-gradient(circle at 80% 0%, rgba(94, 132, 255, 0.22), transparent 34%),
    var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.shell {
  width: min(1120px, calc(100vw - 28px));
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 26px;
  background: rgba(7, 10, 18, 0.78);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.46);
  backdrop-filter: blur(24px);
}

.hud,
.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.hud {
  margin-bottom: 14px;
}

.hud p {
  margin: 0 0 4px;
  color: var(--accent);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(1.6rem, 4vw, 3.4rem);
  letter-spacing: 0;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.stats span,
.controls span {
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--panel);
  color: var(--muted);
  font-size: 0.86rem;
}

.stats strong {
  color: var(--text);
}

canvas {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: #101522;
}

.controls {
  margin-top: 14px;
  color: var(--muted);
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  .hud {
    align-items: flex-start;
    flex-direction: column;
  }

  .stats {
    justify-content: flex-start;
  }
}
`
    },
    {
      path: "app.js",
      content: `const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const hpEl = document.querySelector("#hp");
const waveEl = document.querySelector("#wave");

const keys = new Set();
let pointer = { x: canvas.width / 2, y: canvas.height / 2 };
let score = 0;
let hp = 100;
let wave = 1;
let lastSpawn = 0;
let ended = false;

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  r: 16,
  speed: 4.8
};

const bullets = [];
const enemies = [];
const particles = [];

function reset() {
  score = 0;
  hp = 100;
  wave = 1;
  ended = false;
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  bullets.length = 0;
  enemies.length = 0;
  particles.length = 0;
  updateHud();
}

function updateHud() {
  scoreEl.textContent = score;
  hpEl.textContent = Math.max(0, Math.round(hp));
  waveEl.textContent = wave;
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const enemy = {
    x: side === 0 ? -30 : side === 1 ? canvas.width + 30 : Math.random() * canvas.width,
    y: side === 2 ? -30 : side === 3 ? canvas.height + 30 : Math.random() * canvas.height,
    r: 14 + Math.random() * 10,
    speed: 1.2 + wave * 0.16 + Math.random() * 0.8,
    hp: 2 + Math.floor(wave / 2)
  };
  enemies.push(enemy);
}

function shoot(x, y) {
  if (ended) return;
  const dx = x - player.x;
  const dy = y - player.y;
  const length = Math.hypot(dx, dy) || 1;
  bullets.push({
    x: player.x,
    y: player.y,
    vx: (dx / length) * 9,
    vy: (dy / length) * 9,
    life: 70
  });
}

function burst(x, y, color = "#46f0c2") {
  for (let i = 0; i < 12; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 28,
      color
    });
  }
}

function movePlayer() {
  let dx = 0;
  let dy = 0;
  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;
  const length = Math.hypot(dx, dy) || 1;
  player.x = Math.min(canvas.width - player.r, Math.max(player.r, player.x + (dx / length) * player.speed));
  player.y = Math.min(canvas.height - player.r, Math.max(player.r, player.y + (dy / length) * player.speed));
}

function update(time) {
  if (!ended) {
    movePlayer();
    if (time - lastSpawn > Math.max(360, 1100 - wave * 70)) {
      spawnEnemy();
      lastSpawn = time;
    }
  }

  for (const bullet of bullets) {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    bullet.life -= 1;
  }

  for (const enemy of enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / length) * enemy.speed;
    enemy.y += (dy / length) * enemy.speed;
    if (!ended && Math.hypot(player.x - enemy.x, player.y - enemy.y) < player.r + enemy.r) {
      hp -= 0.55;
      burst(player.x, player.y, "#ff5f6d");
      if (hp <= 0) ended = true;
    }
  }

  for (const bullet of bullets) {
    for (const enemy of enemies) {
      if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.r + 4) {
        bullet.life = 0;
        enemy.hp -= 1;
        burst(enemy.x, enemy.y);
        if (enemy.hp <= 0) {
          enemy.dead = true;
          score += 10;
          if (score > 0 && score % 120 === 0) wave += 1;
        }
      }
    }
  }

  for (const particle of particles) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= 1;
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    if (bullet.life <= 0 || bullet.x < -20 || bullet.x > canvas.width + 20 || bullet.y < -20 || bullet.y > canvas.height + 20) bullets.splice(i, 1);
  }
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    if (enemies[i].dead) enemies.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    if (particles[i].life <= 0) particles.splice(i, 1);
  }

  updateHud();
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createRadialGradient(player.x, player.y, 20, player.x, player.y, 420);
  gradient.addColorStop(0, "rgba(70,240,194,0.18)");
  gradient.addColorStop(1, "rgba(16,21,34,1)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  ctx.strokeStyle = "#46f0c2";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  const aim = Math.atan2(pointer.y - player.y, pointer.x - player.x);
  ctx.lineTo(player.x + Math.cos(aim) * 28, player.y + Math.sin(aim) * 28);
  ctx.stroke();

  ctx.fillStyle = "#d7fff3";
  for (const bullet of bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of enemies) {
    ctx.fillStyle = enemy.hp > 2 ? "#ffbd59" : "#ff5f6d";
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / 28);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 3, 3);
  }
  ctx.globalAlpha = 1;

  if (ended) {
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f5f7fb";
    ctx.textAlign = "center";
    ctx.font = "700 44px system-ui";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 12);
    ctx.font = "500 18px system-ui";
    ctx.fillText("Rキーでリスタート", canvas.width / 2, canvas.height / 2 + 28);
  }
}

function loop(time) {
  update(time);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key.toLowerCase() === "r") reset();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer = {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
});

canvas.addEventListener("pointerdown", () => shoot(pointer.x, pointer.y));

reset();
requestAnimationFrame(loop);
`
    }
  ];
}

function genericInteractiveAppFileBlocks(userText = "") {
  const clean = socialText(userText || "Nexaアプリ", 80).replace(/[。.!?]+$/, "");
  const title = clean && clean.length <= 36 ? clean : "Nexa App";
  return [
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexa App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="app">
    <section class="hero">
      <p>Nexa Build</p>
      <h1>${title}</h1>
      <span>短い依頼から、すぐ開けるWebアプリを自動生成しました。</span>
    </section>
    <section class="panel">
      <label>
        アイデア
        <textarea id="idea" rows="5">${title}</textarea>
      </label>
      <button id="create" type="button">カードを追加</button>
    </section>
    <section class="cards" id="cards" aria-live="polite"></section>
  </main>
  <script src="app.js"></script>
</body>
</html>
`
    },
    {
      path: "style.css",
      content: `* {
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  margin: 0;
  background: linear-gradient(135deg, #f5f5f7, #e9f7ff);
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.app {
  width: min(980px, calc(100% - 32px));
  margin: 0 auto;
  padding: 56px 0;
}

.hero,
.panel,
.cards article {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.09);
  backdrop-filter: blur(18px);
}

.hero {
  padding: 38px;
}

.hero p {
  margin: 0 0 10px;
  color: #007aff;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 12px;
  font-size: clamp(2.3rem, 7vw, 5.2rem);
  line-height: 0.98;
  letter-spacing: 0;
}

.hero span {
  color: #606067;
  font-size: 1.05rem;
}

.panel {
  margin-top: 18px;
  padding: 20px;
  display: grid;
  gap: 14px;
}

label {
  display: grid;
  gap: 8px;
  color: #606067;
  font-weight: 700;
}

textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 16px;
  padding: 14px;
  color: #1d1d1f;
  background: rgba(255, 255, 255, 0.78);
  font: inherit;
}

button {
  min-height: 46px;
  border: 0;
  border-radius: 999px;
  color: white;
  background: #007aff;
  font-weight: 800;
  cursor: pointer;
}

button:hover {
  background: #0067d8;
}

.cards {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.cards article {
  padding: 18px;
  animation: pop 0.28s ease both;
}

.cards h2 {
  margin: 0 0 8px;
  font-size: 1.1rem;
}

.cards p {
  margin: 0;
  color: #606067;
  line-height: 1.65;
}

@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
`
    },
    {
      path: "app.js",
      content: `const idea = document.querySelector("#idea");
const create = document.querySelector("#create");
const cards = document.querySelector("#cards");

function addCard(text) {
  const article = document.createElement("article");
  article.innerHTML = \`
    <h2>Nexa Card</h2>
    <p>\${text.replace(/[<>]/g, "")}</p>
  \`;
  cards.prepend(article);
}

create.addEventListener("click", () => {
  const text = idea.value.trim() || "新しいアイデア";
  addCard(text);
});

addCard(idea.value.trim());
`
    }
  ];
}

function heuristicGeneratedFileBlocks(userText = "", options = {}) {
  const text = String(userText || "");
  const finalize = (blocks) => prefixGeneratedBlocks(blocks, options.directory || "");
  if (is3DShooterRequest(text)) {
    return finalize(generic3DShooterFileBlocks(text));
  }
  if (/calculator/i.test(text) || includesAnyText(text, ["\u96fb\u5353"])) {
    return finalize([
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ミニ電卓</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="calculator" aria-label="ミニ電卓">
    <output id="display" class="display">0</output>
    <section class="keys" aria-label="計算ボタン">
      <button data-action="clear" class="key utility">C</button>
      <button data-action="backspace" class="key utility">⌫</button>
      <button data-value="/" class="key operator">÷</button>
      <button data-value="*" class="key operator">×</button>
      <button data-value="7" class="key">7</button>
      <button data-value="8" class="key">8</button>
      <button data-value="9" class="key">9</button>
      <button data-value="-" class="key operator">−</button>
      <button data-value="4" class="key">4</button>
      <button data-value="5" class="key">5</button>
      <button data-value="6" class="key">6</button>
      <button data-value="+" class="key operator">+</button>
      <button data-value="1" class="key">1</button>
      <button data-value="2" class="key">2</button>
      <button data-value="3" class="key">3</button>
      <button data-action="equals" class="key equals">=</button>
      <button data-value="0" class="key zero">0</button>
      <button data-value="." class="key">.</button>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>
`
      },
      {
        path: "style.css",
        content: `* {
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  margin: 0;
  display: grid;
  place-items: center;
  background: #f5f5f7;
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.calculator {
  width: min(92vw, 360px);
  padding: 18px;
  border: 1px solid #d2d2d7;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.14);
}

.display {
  display: block;
  min-height: 76px;
  padding: 18px 14px;
  margin-bottom: 14px;
  border-radius: 16px;
  background: #1d1d1f;
  color: white;
  font-size: 2rem;
  text-align: right;
  overflow: hidden;
}

.keys {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.key {
  min-height: 58px;
  border: 0;
  border-radius: 16px;
  background: #e8e8ed;
  color: #1d1d1f;
  font-size: 1.2rem;
  cursor: pointer;
}

.key:hover {
  background: #dcdce3;
}

.operator,
.equals {
  background: #007aff;
  color: white;
}

.utility {
  background: #d2d2d7;
}

.zero {
  grid-column: span 2;
}
`
      },
      {
        path: "app.js",
        content: `const display = document.querySelector("#display");
const keys = document.querySelector(".keys");

let expression = "";

function updateDisplay(value) {
  display.textContent = value || "0";
}

function calculate() {
  if (!expression) return;
  try {
    const normalized = expression.replace(/[^0-9.+\\-*/()]/g, "");
    const result = Function(\`"use strict"; return (\${normalized})\`)();
    expression = Number.isFinite(result) ? String(Number(result.toFixed(8))) : "";
    updateDisplay(expression || "Error");
  } catch {
    expression = "";
    updateDisplay("Error");
  }
}

keys.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const value = button.dataset.value;

  if (action === "clear") {
    expression = "";
    updateDisplay(expression);
    return;
  }

  if (action === "backspace") {
    expression = expression.slice(0, -1);
    updateDisplay(expression);
    return;
  }

  if (action === "equals") {
    calculate();
    return;
  }

  expression += value;
  updateDisplay(expression);
});
`
      }
    ]);
  }

  if (isLandingPageRequest(text)) return finalize(premiumLandingFileBlocks(text));
  if (isGenericCreateFallbackRequest(text) || options.forceCreate) return finalize(genericCreateFileBlocks(text));

  return [];
}

async function writeGeneratedFileBlocks(project, blocks = []) {
  if (!project?.id) throw new Error("project_required");
  if (!blocks.length) throw new Error("generated_files_required");
  assertCodexPermission(project, "write");
  assertWorkspaceReadyForWrite(project);
  const files = [];

  for (const block of blocks) {
    const file = projectScopedWorkspacePath(project, block.path);
    const relPath = projectRelativeWorkspacePath(project, file);
    if (!relPath) throw new Error("workspace_file_required");
    if (isWorkspaceIgnored(path.basename(file), relPath)) throw new Error("workspace_file_ignored");
    if (!isTextFile(file)) throw new Error("workspace_text_file_required");
    const operation = block.operation === "delete" ? "delete" : "write";
    const content = String(block.content ?? "");
    if (Buffer.byteLength(content, "utf8") > 1024 * 1024) throw new Error("workspace_file_too_large");

    let before = "";
    let exists = false;
    try {
      const fileStat = await stat(file);
      if (!fileStat.isFile()) throw new Error("workspace_file_required");
      if (fileStat.size > 1024 * 1024) throw new Error("workspace_file_too_large");
      before = await readFile(file, "utf8");
      exists = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    if (operation === "delete") {
      if (!exists) throw new Error("workspace_delete_missing_file");
      await unlink(file);
      files.push({
        path: relPath,
        status: "deleted",
        beforeHash: hashText(before),
        afterHash: "",
        beforeSize: Buffer.byteLength(before, "utf8"),
        afterSize: 0,
        changedLines: before.split("\n").length,
        diff: compactDiff(before, "")
      });
      continue;
    }

    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, content, "utf8");
    await rename(tmp, file);
    files.push({
      path: relPath,
      status: exists ? "modified" : "added",
      beforeHash: exists ? hashText(before) : "",
      afterHash: hashText(content),
      beforeSize: Buffer.byteLength(before, "utf8"),
      afterSize: Buffer.byteLength(content, "utf8"),
      changedLines: compactDiff(before, content).split("\n").filter((line) => /^[+-]/.test(line)).length,
      diff: compactDiff(before, content)
    });
  }

  project.runs.push({
    id: id("run"),
    type: "direct-file-write",
    command: "workspace direct write",
    createdAt: now(),
    durationMs: 0,
    exitCode: 0,
    stdout: `Wrote ${files.length} file${files.length === 1 ? "" : "s"} directly into the selected workspace folder`,
    stderr: "",
    timedOut: false,
    agents: [{ id: "directWrite", title: "Direct Write", status: "complete", output: files.map((item) => item.path).join(", ") }],
    changes: files.map((item) => ({
      path: item.path,
      status: item.status,
      changedLines: item.changedLines,
      beforeHash: item.beforeHash,
      afterHash: item.afterHash,
      beforeSize: item.beforeSize,
      afterSize: item.afterSize,
      diff: item.diff
    }))
  });
  project.runs = project.runs.slice(-80);
  await saveProject(project);
  return { applied: true, files, project };
}

function mergeWriteResults(primary = {}, secondary = {}) {
  const merged = new Map();
  for (const file of [...(primary.files || []), ...(secondary.files || [])]) {
    if (file?.path) merged.set(file.path, file);
  }
  return {
    ...(primary || {}),
    ...(secondary || {}),
    applied: Boolean(primary.applied || secondary.applied),
    files: [...merged.values()],
    project: secondary.project || primary.project
  };
}

function normalizeHtmlAssetRef(ref = "") {
  const clean = String(ref || "").trim().replace(/\\/g, "/").split("#")[0].split("?")[0];
  if (!clean || clean.startsWith("#")) return "";
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(clean)) return "";
  if (/^(?:data|blob|mailto|tel|javascript):/i.test(clean)) return "";
  return clean.replace(/^\/+/, "");
}

function referencedWebAssetsFromHtml(html = "") {
  const refs = [];
  const linkRe = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const scriptRe = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(linkRe)) {
    const ref = normalizeHtmlAssetRef(match[1]);
    if (ref && /\.(css)$/i.test(ref)) refs.push(ref);
  }
  for (const match of html.matchAll(scriptRe)) {
    const ref = normalizeHtmlAssetRef(match[1]);
    if (ref && /\.(js|mjs)$/i.test(ref)) refs.push(ref);
  }
  return [...new Set(refs)];
}

async function missingReferencedWebAssets(project, result = {}) {
  const missing = [];
  const written = new Set((result.files || []).map((file) => String(file.path || "").replace(/\\/g, "/")));
  for (const file of result.files || []) {
    if (!/\.(html|htm)$/i.test(file.path || "")) continue;
    const htmlPath = projectScopedWorkspacePath(project, file.path);
    let html = "";
    try {
      html = await readFile(htmlPath, "utf8");
    } catch {
      continue;
    }
    const baseDir = path.posix.dirname(String(file.path || "").replace(/\\/g, "/"));
    for (const ref of referencedWebAssetsFromHtml(html)) {
      const rel = path.posix.normalize(baseDir === "." ? ref : path.posix.join(baseDir, ref));
      if (!rel || rel.startsWith("../") || path.isAbsolute(rel)) continue;
      const assetPath = projectScopedWorkspacePath(project, rel);
      if (written.has(rel)) continue;
      try {
        const assetStat = await stat(assetPath);
        if (assetStat.isFile()) continue;
      } catch (error) {
        if (error.code !== "ENOENT") continue;
      }
      missing.push(rel);
    }
  }
  return [...new Set(missing)];
}

async function implementationRequirementGaps(project, userText = "", result = {}) {
  const chunks = [];
  for (const file of result.files || []) {
    if (file.status === "deleted" || !isTextFile(file.path || "")) continue;
    try {
      chunks.push(await readFile(projectScopedWorkspacePath(project, file.path), "utf8"));
    } catch {
      // Missing files are handled by the referenced-asset verifier.
    }
  }
  const code = chunks.join("\n").toLowerCase();
  const request = String(userText || "").toLowerCase();
  const checks = [
    { requested: /localstorage|ローカル保存|ブラウザ保存/.test(request), met: /localstorage/.test(code), label: "localStorage persistence" },
    { requested: /検索|search|絞り込/.test(request), met: /search|filter|検索/.test(code), label: "search/filter behavior" },
    { requested: /削除|delete|remove/.test(request), met: /delete|remove|削除/.test(code), label: "delete behavior" },
    { requested: /追加|create|add/.test(request), met: /add|create|submit|追加/.test(code), label: "create/add behavior" },
    { requested: /テスト|test/.test(request), met: /\btest\b|describe\s*\(|it\s*\(/.test(code), label: "tests" }
  ];
  return checks.filter((check) => check.requested && !check.met).map((check) => check.label);
}

function fallbackCssBlock(relPath = "style.css") {
  return {
    path: relPath,
    content: `* {
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  margin: 0;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 18% 12%, rgba(76, 132, 255, 0.22), transparent 32%),
    radial-gradient(circle at 80% 0%, rgba(60, 220, 170, 0.18), transparent 30%),
    #0b0d12;
  color: #f7f8fb;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.hero,
main {
  width: min(960px, calc(100vw - 32px));
  padding: clamp(32px, 7vw, 76px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 34px 90px rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(22px);
}

h1 {
  margin: 0 0 14px;
  font-size: clamp(2.5rem, 8vw, 6rem);
  line-height: 0.96;
  letter-spacing: 0;
}

p {
  color: rgba(247, 248, 251, 0.78);
  font-size: 1.08rem;
}

button,
.neon-button {
  min-height: 48px;
  padding: 0 22px;
  border: 0;
  border-radius: 999px;
  color: #071016;
  background: linear-gradient(135deg, #6df5ca, #77a7ff);
  font-weight: 800;
  cursor: pointer;
  transition: transform 180ms ease, filter 180ms ease;
}

button:hover,
.neon-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.08);
}
`
  };
}

function fallbackJsBlock(relPath = "app.js") {
  return {
    path: relPath,
    content: `const startButton = document.querySelector("button");

if (startButton) {
  startButton.addEventListener("click", () => {
    startButton.textContent = "Nexa Ready";
    document.body.classList.toggle("is-active");
  });
}
`
  };
}

function fallbackBlocksForMissingAssets(missing = []) {
  return missing
    .map((relPath) => {
      if (/\.css$/i.test(relPath)) return fallbackCssBlock(relPath);
      if (/\.(js|mjs)$/i.test(relPath)) return fallbackJsBlock(relPath);
      return null;
    })
    .filter(Boolean);
}

async function maybeCompleteReferencedWebAssets(project, userText, result, options = {}) {
  const missing = await missingReferencedWebAssets(project, result);
  if (!missing.length) return { result, completed: false, missing: [] };
  emitProcessEvent(options, processEvent(
    "thinking",
    "Nexaが不足ファイルを補完",
    `${missing.join(", ")} を追加して、参照切れを防ぎます。`
  ));
  const blocks = isGameFallbackRequest(userText)
    ? genericArenaGameFileBlocks(userText)
    : fallbackBlocksForMissingAssets(missing);
  if (!blocks.length) return { result, completed: false, missing };
  const completed = await writeGeneratedFileBlocks(project, blocks);
  return {
    result: isGameFallbackRequest(userText) ? completed : mergeWriteResults(result, completed),
    completed: true,
    missing
  };
}

function appliedPatchSummary(result) {
  const files = result?.files || [];
  if (!files.length) return "";
  return [
    `選択フォルダー内に変更を適用しました (${files.length}件)。`,
    ...files.map((file) => `- ${file.status}: ${file.path}`)
  ].join("\n");
}

function codeWriteProcessSummary(project, method, result, error = "") {
  const folderName = project?.selectedFolderName || folderNameFromWorkspace(project?.workspaceRoot || "") || project?.name || "workspace";
  const folderPath = project?.workspaceRoot || project?.selectedFolderPath || "";
  const files = result?.files || [];
  const methodText = method === "file-block"
    ? "fileブロックを検証して、選択フォルダー内へ直接保存"
    : "diffを検証して、選択フォルダー内へ直接適用";
  const lines = [
    "作業過程",
    `1. 作業フォルダーを確認: ${folderName}`,
    folderPath ? `   ${folderPath}` : "",
    "2. Nexaが作成内容を組み立てる",
    `3. ${methodText}`,
    error ? `4. 書き込み失敗: ${userVisibleWriteIssue(error)}` : `4. 書き込み完了: ${files.length}件`,
    "",
    error ? "結果" : "書き込み結果",
    error ? userVisibleWriteIssue(error) : files.map((file) => `- ${file.status}: ${file.path}`).join("\n")
  ];
  return lines.filter(Boolean).join("\n");
}

async function verifyWrittenFilesSummary(project, files = []) {
  if (!files.length) return "";
  const lines = ["検証"];
  for (const file of files) {
    if (file.status === "deleted") {
      try {
        await stat(projectScopedWorkspacePath(project, file.path));
        lines.push(`- ${file.path}: 削除未完了`);
      } catch (error) {
        lines.push(`- ${file.path}: ${error.code === "ENOENT" ? "削除OK" : `検証失敗 (${error.message})`}`);
      }
      continue;
    }
    try {
      const filePath = projectScopedWorkspacePath(project, file.path);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        lines.push(`- ${file.path}: ファイルではありません`);
        continue;
      }
      const checks = [`存在OK`, `${fileStat.size} bytes`];
      if (isTextFile(filePath) && fileStat.size <= 1024 * 1024) {
        const content = await readFile(filePath, "utf8");
        const ext = path.extname(file.path).toLowerCase();
        if (ext === ".html" || ext === ".htm") {
          checks.push(/<html[\s>]/i.test(content) ? "htmlタグOK" : "htmlタグ未検出");
          checks.push(/<\/html>/i.test(content) ? "閉じタグOK" : "閉じタグ未検出");
        }
        if (ext === ".css") {
          const opens = (content.match(/\{/g) || []).length;
          const closes = (content.match(/\}/g) || []).length;
          checks.push(opens === closes ? "CSS braces OK" : "CSS braces mismatch");
        }
        if ([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(ext)) {
          checks.push(content.trim() ? "コード本文OK" : "コード本文が空");
        }
      }
      lines.push(`- ${file.path}: ${checks.join(" / ")}`);
    } catch (error) {
      lines.push(`- ${file.path}: 検証失敗 (${error.message})`);
    }
  }
  return lines.join("\n");
}

async function maybeUpgradeLandingQuality(project, userText, result, options = {}) {
  // Later turns must keep the latest distinct implementation instead of
  // replacing modified files with the same generic landing-page fallback.
  if ((result?.files || []).some((file) => file.status !== "added")) {
    return { result, upgraded: false };
  }
  if (!(await needsLandingQualityUpgrade(project, userText, result?.files || []))) {
    return { result, upgraded: false };
  }
  emitProcessEvent(options, processEvent(
    "thinking",
    "NexaがUI品質を検査",
    "LPとしての見た目が弱いため、Nexaがプレミアム構成へ自動補修します。"
  ));
  const upgraded = await writeGeneratedFileBlocks(project, premiumLandingFileBlocks(userText));
  return { result: upgraded, upgraded: true };
}

async function materializeCoderOutput(project, route, model, userText, context, coderOutput, options = {}) {
  let finalCoderOutput = cleanCoderOutput(coderOutput);
  let lastError = "";
  let repaired = false;
  let accumulatedWriteResult = { applied: false, files: [], project };
  let workspaceWasEmpty = true;
  if (project?.workspaceReady) {
    emitProcessEvent(options, processEvent("thinking", "作業フォルダーを確認", project.selectedFolderName || folderNameFromWorkspace(project.workspaceRoot || "") || project.name || "workspace", {
      folderPath: project.workspaceRoot || project.selectedFolderPath || ""
    }));
    const folderSummary = await workspaceDevelopmentLogSummary(project);
    workspaceWasEmpty = Boolean(folderSummary.empty);
    emitProcessEvent(options, processEvent("thinking", folderSummary.title, folderSummary.detail, {
      empty: folderSummary.empty,
      fileCount: folderSummary.fileCount,
      dirCount: folderSummary.dirCount,
      sample: folderSummary.sample
    }));
  }
  emitProcessEvent(options, processEvent("thinking", "作成する構成を決定", describeBuildTarget(userText, route)));
  emitProcessEvent(options, processEvent("thinking", "保存できる形式を準備", "実ファイルとして書き込めるパスと内容に整えています。"));

  for (let attempt = 0; attempt < (AI_CODE_GENERATION_ONLY ? 4 : 2); attempt += 1) {
    let fileBlocks = project.workspaceReady ? extractGeneratedFileBlocks(finalCoderOutput) : [];
    if (!AI_CODE_GENERATION_ONLY && options.forceFreshRebuild && attempt === 0) {
      const fresh = fallbackBlocksForWeakGeneratedBlocks(userText, []);
      if (fresh.blocks.length) {
        fileBlocks = fresh.blocks;
        repaired = true;
        emitProcessEvent(options, processEvent("thinking", "退避後の新しい構成を生成", fresh.reason, {
          files: fresh.blocks.map((block) => ({ path: block.path }))
        }));
      }
    }
    const fallback = AI_CODE_GENERATION_ONLY ? { blocks: [], reason: "" } : fallbackBlocksForWeakGeneratedBlocks(userText, fileBlocks);
    if (!AI_CODE_GENERATION_ONLY && fallback.blocks.length) {
      emitProcessEvent(options, processEvent("thinking", "短い依頼の意図を補正", fallback.reason, {
        files: fallback.blocks.map((block) => ({ path: block.path }))
      }));
      fileBlocks = fallback.blocks;
      repaired = true;
    }
    const patch = project.workspaceReady && !fileBlocks.length ? extractUnifiedPatch(finalCoderOutput) : "";

    if (fileBlocks.length) {
      try {
        emitProcessEvent(options, processEvent("thinking", "保存前にファイル候補を確認", `${fileBlocks.length}件のファイル候補を検証しています。`, {
          files: fileBlocks.map((block) => ({ path: block.path }))
        }));
        let writeResult = await writeGeneratedFileBlocks(project, fileBlocks);
        accumulatedWriteResult = mergeWriteResults(accumulatedWriteResult, writeResult);
        if (AI_CODE_GENERATION_ONLY) {
          const missing = await missingReferencedWebAssets(project, accumulatedWriteResult);
          if (missing.length) {
            lastError = `missing_referenced_files:${missing.join(",")}`;
            emitProcessEvent(options, processEvent(
              "thinking",
              "実装AIが不足ファイルを検出",
              `${missing.join(", ")} が参照されていますが未生成です。固定補完を使わずAIへ追加実装を依頼します。`,
              { missing }
            ));
            if (model && attempt < 3) {
              const retry = cleanCoderOutput(await strictCoderRepairCall(
                model,
                userText,
                context,
                finalCoderOutput,
                `${lastError}. Output complete fenced file blocks for every missing referenced file. Preserve the already-written files and implement the requested behavior; do not emit placeholders.`,
                {
                  signal: options.signal,
                  fallbackModel: options.fallbackModel,
                  onFallback: options.onFallback
                }
              ));
              if (retry && !retry.startsWith("fallback:") && retry !== finalCoderOutput) {
                finalCoderOutput = retry;
                repaired = true;
                continue;
              }
            }
            throw new Error(lastError);
          }
          const requirementGaps = await implementationRequirementGaps(project, userText, accumulatedWriteResult);
          if (requirementGaps.length) {
            lastError = `missing_required_behavior:${requirementGaps.join(",")}`;
            emitProcessEvent(options, processEvent(
              "thinking",
              "検証AIが未実装要件を検出",
              `${requirementGaps.join(", ")} が不足しています。AIへ実装の追加を戻します。`,
              { requirementGaps }
            ));
            if (model && attempt < 3) {
              const retry = cleanCoderOutput(await strictCoderRepairCall(
                model,
                userText,
                context,
                finalCoderOutput,
                `${lastError}. Emit valid file blocks or a unified diff that implements every missing behavior in the existing generated files.`,
                {
                  signal: options.signal,
                  fallbackModel: options.fallbackModel,
                  onFallback: options.onFallback
                }
              ));
              if (retry && !retry.startsWith("fallback:") && retry !== finalCoderOutput) {
                finalCoderOutput = retry;
                repaired = true;
                continue;
              }
            }
            throw new Error(lastError);
          }
          writeResult = accumulatedWriteResult;
        }
        const quality = AI_CODE_GENERATION_ONLY ? { result: writeResult, upgraded: false } : await maybeUpgradeLandingQuality(project, userText, writeResult, options);
        writeResult = quality.result;
        const completion = AI_CODE_GENERATION_ONLY ? { result: writeResult, completed: false, missing: [] } : await maybeCompleteReferencedWebAssets(project, userText, writeResult, options);
        writeResult = completion.result;
        if (writeResult.project?.runs) project.runs = writeResult.project.runs;
        for (const event of codeProcessFileEvents(writeResult, userText)) {
          emitProcessEvent(options, event);
        }
        const verification = await verifyWrittenFilesSummary(project, writeResult.files);
        const postWriteChecks = await runPostWriteChecksForFiles(project, writeResult.files, options);
        const checkSummary = postWriteChecksSummary(postWriteChecks);
        emitProcessEvent(options, codeProcessFinishEvent(writeResult, verification, checkSummary));
        return [
          codeWriteProcessSummary(project, "file-block", writeResult),
          verification,
          checkSummary,
          quality.upgraded ? "品質補修: LPとしての完成度が低かったため、ネオンUI向けのHTML/CSS/JS構成へ自動アップグレードしました。" : "",
          completion.completed ? `不足ファイル補完: ${completion.missing.join(", ")} を追加しました。` : "",
          repaired ? "再生成: 1回目の出力が保存形式として不安定だったため、厳格フォーマットで作り直しました。" : ""
        ].filter(Boolean).join("\n\n");
      } catch (error) {
        lastError = error.message;
      }
    } else if (patch) {
      try {
        emitProcessEvent(options, processEvent("thinking", "差分を確認", "既存ファイルへ適用できる変更差分として検証しています。"));
        let patchResult = await workspacePatch({ projectId: project.id, patch, dryRun: false });
        const quality = AI_CODE_GENERATION_ONLY ? { result: patchResult, upgraded: false } : await maybeUpgradeLandingQuality(project, userText, patchResult, options);
        patchResult = quality.result;
        const completion = AI_CODE_GENERATION_ONLY ? { result: patchResult, completed: false, missing: [] } : await maybeCompleteReferencedWebAssets(project, userText, patchResult, options);
        patchResult = completion.result;
        if (patchResult.project?.runs) project.runs = patchResult.project.runs;
        for (const event of codeProcessFileEvents(patchResult, userText)) {
          emitProcessEvent(options, event);
        }
        const verification = await verifyWrittenFilesSummary(project, patchResult.files);
        const postWriteChecks = await runPostWriteChecksForFiles(project, patchResult.files, options);
        const checkSummary = postWriteChecksSummary(postWriteChecks);
        emitProcessEvent(options, codeProcessFinishEvent(patchResult, verification, checkSummary));
        return [
          codeWriteProcessSummary(project, "patch", patchResult),
          verification,
          checkSummary,
          quality.upgraded ? "品質補修: LPとしての完成度が低かったため、ネオンUI向けのHTML/CSS/JS構成へ自動アップグレードしました。" : "",
          completion.completed ? `不足ファイル補完: ${completion.missing.join(", ")} を追加しました。` : "",
          repaired ? "再生成: 1回目の出力が保存形式として不安定だったため、厳格フォーマットで作り直しました。" : "",
          finalCoderOutput
        ].filter(Boolean).join("\n\n");
      } catch (error) {
        lastError = error.message;
      }
    } else {
      lastError = "writable_file_block_or_valid_diff_not_found";
      emitProcessEvent(options, processEvent("thinking", "保存前チェックで問題を検出", "そのままではファイルへ保存できない出力だったため、補修ルートに切り替えます。"));
    }

    if (attempt < (AI_CODE_GENERATION_ONLY ? 3 : 1) && model) {
      emitProcessEvent(options, processEvent("thinking", `実装AIが出力を再生成 (${attempt + 2}/4)`, userVisibleWriteIssue(lastError || "書き込み形式を修正しています。")));
      const retry = cleanCoderOutput(await strictCoderRepairCall(model, userText, context, finalCoderOutput, lastError, {
        signal: options.signal,
        fallbackModel: options.fallbackModel,
        onFallback: options.onFallback
      }));
      if (retry && !retry.startsWith("fallback:") && retry !== finalCoderOutput) {
        finalCoderOutput = retry;
        repaired = true;
        continue;
      }
    }
    break;
  }

  const requestsNewArtifact = isGenericCreateFallbackRequest(userText) || route.intent?.taskKind === "code_create";
  const canUseWorkspaceFallback = workspaceWasEmpty || requestsNewArtifact;
  if (!AI_CODE_GENERATION_ONLY && project.workspaceReady && route.needsCode && canUseWorkspaceFallback) {
    const heuristicBlocks = heuristicGeneratedFileBlocks(userText, { directory: "", forceCreate: requestsNewArtifact });
    if (heuristicBlocks.length) {
      try {
        emitProcessEvent(options, processEvent("thinking", "標準構成で作り直す", `${heuristicBlocks.length}件の実ファイルとして作成します。`, {
          files: heuristicBlocks.map((block) => ({ path: block.path }))
        }));
        let writeResult = await writeGeneratedFileBlocks(project, heuristicBlocks);
        const completion = await maybeCompleteReferencedWebAssets(project, userText, writeResult, options);
        writeResult = completion.result;
        if (writeResult.project?.runs) project.runs = writeResult.project.runs;
        for (const event of codeProcessFileEvents(writeResult, userText)) {
          emitProcessEvent(options, event);
        }
        const verification = await verifyWrittenFilesSummary(project, writeResult.files);
        const postWriteChecks = await runPostWriteChecksForFiles(project, writeResult.files, options);
        const checkSummary = postWriteChecksSummary(postWriteChecks);
        emitProcessEvent(options, codeProcessFinishEvent(writeResult, verification, checkSummary));
        return [
          codeWriteProcessSummary(project, "file-block", writeResult),
          verification,
          checkSummary,
          completion.completed ? `不足ファイル補完: ${completion.missing.join(", ")} を追加しました。` : "",
          "自動補完: モデル出力が保存形式として不安定だったため、依頼内容に合う標準構成を生成しました。"
        ].filter(Boolean).join("\n\n");
      } catch (error) {
        lastError = error.message;
      }
    }
  }

  if (!project.workspaceReady && route.needsCode) {
    return `${finalCoderOutput}\n\nファイルへ直接書き込むには、先に作業フォルダーを選択してください。`;
  }
  if (project.workspaceReady && route.needsCode) {
    if (AI_CODE_GENERATION_ONLY && options.workspaceRebuild) {
      const restored = await restoreStagedWorkspace(project, options.workspaceRebuild);
      if (restored.length) {
        emitProcessEvent(options, processEvent("done", "生成失敗のため元ファイルを復元", `${restored.length}件をバックアップから戻しました。`, { restored }));
      }
    }
    for (const event of codeProcessFailureEvents(project, lastError || "writable_file_block_or_valid_diff_not_found").slice(2)) {
      emitProcessEvent(options, event);
    }
    return [
      codeWriteProcessSummary(project, "file-block", { files: [] }, lastError || "writable_file_block_or_valid_diff_not_found"),
      AI_CODE_GENERATION_ONLY
        ? "実装AIが有効なファイルまたは差分を生成できなかったため、固定テンプレートへ置き換えず停止しました。モデルを起動して再実行してください。"
        : "保存できるfileブロックまたは有効なdiffが見つからなかったため、ファイル保存は行いませんでした。",
      "内部メモは最終回答に混ぜず、開発ログだけに記録しました。"
    ].join("\n\n");
  }
  return finalCoderOutput;
}

function sanitizeUserVisibleAssistantText(text = "") {
  let output = sanitizeNexaVisibleText(stripThinking(String(text || "")).trim());
  const internalMarkers = [
    "\nWe are creating ",
    "\nSince the user wants ",
    "\nLet's write ",
    "\nImportant:",
    "\nHowever, note:",
    "\nWe'll output:",
    "\nRevised style.css:"
  ];
  for (const marker of internalMarkers) {
    const index = output.indexOf(marker);
    if (index > 0 && /writable_file_block_or_valid_diff_not_found|file block|file path=|```file/i.test(output.slice(index))) {
      output = `${output.slice(0, index).trim()}\n\n内部メモは最終回答に混ぜず、開発ログだけに記録しました。`;
      break;
    }
  }
  return sanitizeNexaVisibleText(output);
}

function agentItem(id, output, model = "local-rules", limit = 1200) {
  const name = agentBrandName(id);
  return {
    id,
    name,
    model: publicModelName(model),
    output: sanitizeNexaVisibleText(clip(output, limit)),
    error: ""
  };
}

function localResponseQuality(project, userText, finalText, route = {}) {
  const answer = stripThinking(String(finalText || "")).trim();
  const request = String(userText || "").trim();
  const lower = answer.toLowerCase();
  const requestLower = request.toLowerCase();
  const asksChatGptLevel = Boolean(route.intent?.chatGptLevel) ||
    /chat\s*gpt|gpt[-\s]?(level|grade|class)|chatgpt|openai[-\s]?grade|ChatGPT|GPTレベル|GPT級/i.test(request);
  const reasons = [];
  let score = 100;
  if (answer.length < 24) {
    score -= 22;
    reasons.push("answer_too_short");
  }
  if (/[?？]\s*$/.test(answer) || (answer.match(/[?？]/g) || []).length >= 2) {
    score -= 12;
    reasons.push("questions_left_in_final");
  }
  if (/わかりません|できません|情報がありません|cannot|can't|unable/i.test(answer) && !/error|blocked|permission/i.test(lower)) {
    score -= 10;
    reasons.push("unhelpful_refusal_tone");
  }
  if (/<think>|<\/think>|hidden reasoning|chain[-\s]?of[-\s]?thought|内部メモ|scratch|We need to|Let's (write|create|fix)|file path="relative\/path\.ext"/i.test(answer)) {
    score -= 30;
    reasons.push("internal_work_leaked");
  }
  if (route.intent?.continuationHint && /何を続け|どの続き|もう少し詳しく|情報を教えてください/.test(answer)) {
    score -= 18;
    reasons.push("ignored_continuation_memory");
  }
  if (route.intent?.taskKind && route.intent.taskKind !== "chat") {
    const taskToken = String(route.intent.taskKind).replace(/_/g, " ");
    if (/LP|ランディングページ|自己紹介ページ|ポートスキャナー/.test(answer) && !/LP|ランディングページ|自己紹介|ポートスキャナー/.test(request)) {
      score -= 12;
      reasons.push("possible_stale_task_answer");
    }
    if (route.intent.taskKind === "image_generation" && !/画像|生成|プレビュー|image/i.test(answer)) {
      score -= 10;
      reasons.push(`task_not_addressed:${taskToken}`);
    }
  }
  if (route.needsCode) {
    const hasImplementationSignal = /作業過程|書き込み|変更|modified|created|updated|```|file path=|diff --git|index\.html|style\.css|app\.js/i.test(answer);
    if (!hasImplementationSignal) {
      score -= 28;
      reasons.push("missing_implementation_signal");
    }
    if (project?.workspaceReady && /フォルダー.*選択|select.*folder|workspace.*not selected/i.test(answer)) {
      score -= 16;
      reasons.push("ignored_selected_workspace");
    }
  }
  if (route.intent?.selfImprovement && !/level|lv|賢|自己評価|品質|改善|修正|実装/i.test(answer)) {
    score -= 12;
    reasons.push("self_improvement_not_addressed");
  }
  if (asksChatGptLevel && !/Nexa|意図|推論|記憶|自己評価|品質|改善|修正|実装|レベル|Lv/i.test(answer)) {
    score -= 18;
    reasons.push("high_quality_request_not_addressed");
  }
  if ((route.intent?.selfImprovement || asksChatGptLevel) && !/Answer blueprint|回答設計|品質ゲート|Nexa|再生成|補正|自己評価/i.test(answer)) {
    score -= 10;
    reasons.push("missing_quality_workflow_evidence");
  }
  if ((route.intent?.selfImprovement || asksChatGptLevel) && !/ローカルモデル|Ollama|モデル自体|同等ではない|外部API|制約/i.test(answer)) {
    score -= 8;
    reasons.push("missing_honest_model_limit");
  }
  if (asksChatGptLevel && /同等|同じ|完全再現|equals|same as/i.test(answer) && !/同等ではない|断言しない|設計上|ワークフロー|モデル自体/i.test(answer)) {
    score -= 16;
    reasons.push("chatgpt_parity_overclaim");
  }
  if ((route.intent?.selfImprovement || asksChatGptLevel) && /ただし|しかし|でも/.test(requestLower) && !/ただし|制約|現実的|正直|限界|できる範囲/i.test(answer)) {
    score -= 6;
    reasons.push("missed_constraints_or_caveat");
  }
  if (route.intent?.videoUnsupported && /動画.*(生成|作成|完了|保存)|video.*(generated|created|saved|complete)/i.test(answer)) {
    score -= 28;
    reasons.push("disabled_video_claimed_generated");
  }
  if (/claude|opus|オーパス|クロード/i.test(request) && /同等|同じ|完全|超え|上回|equals|same as/i.test(answer) && !/ワークフロー|設計|保証|断言|not a claim|モデル自体/i.test(answer)) {
    score -= 16;
    reasons.push("opus_parity_overclaim");
  }
  if (route.intent?.isTerse && answer.length > 2000) {
    score -= 7;
    reasons.push("too_long_for_terse_prompt");
  }
  if (request && !answer) {
    score = 0;
    reasons.push("empty_answer");
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const revisionThreshold = asksChatGptLevel ? 94 : route.intent?.selfImprovement ? 92 : route.intent?.isTerse || route.isComplex ? 90 : 82;
  const canRevise = !route.needsCode || route.intent?.selfImprovement || asksChatGptLevel || route.intent?.videoUnsupported;
  return {
    score,
    grade: score >= 92 ? "A" : score >= 82 ? "B" : score >= 70 ? "C" : "D",
    passed: score >= 82,
    needsRevision: score < revisionThreshold && canRevise,
    reasons,
    checks: {
      direct: answer.length >= 24,
      noFinalQuestion: !/[?？]\s*$/.test(answer),
      noInternalLeak: !/<think>|<\/think>|hidden reasoning|chain[-\s]?of[-\s]?thought|内部メモ|scratch|We need to|Let's (write|create|fix)/i.test(answer),
      continuationUsed: !route.intent?.continuationHint || !/何を続け|どの続き|情報を教えてください/.test(answer),
      codeSignal: !route.needsCode || /作業過程|書き込み|変更|modified|created|updated|```|file path=|diff --git/i.test(answer),
      selfImprovementSignal: !route.intent?.selfImprovement || /level|lv|賢|自己評価|品質|改善|修正|実装/i.test(answer),
      qualityWorkflowSignal: !(route.intent?.selfImprovement || asksChatGptLevel) || /Answer blueprint|回答設計|品質ゲート|Nexa|再生成|補正|自己評価/i.test(answer),
      chatGptLevelSignal: !asksChatGptLevel || /Nexa|意図|推論|記憶|自己評価|品質|改善|修正|実装|レベル|Lv/i.test(answer)
    }
  };
}

async function reviseLowQualityResponse(model, userText, finalText, quality, company, options = {}) {
  if (!model || !quality?.needsRevision) return String(finalText || "");
  try {
    const revised = await llmChat(model, [
      {
        role: "system",
        content: [
          "You are Nexa, the final quality gate for a Japanese local AI workspace.",
          "Rewrite the assistant answer so it directly satisfies the latest user request.",
          "Do not ask questions unless truly blocked.",
          "Do not mention hidden chain-of-thought.",
          "Keep it concise, concrete, and in Japanese.",
          "If the user asked for smartness or levels, include before/after levels and what changed.",
          "If the user asked for very high intelligence, frame the result as Nexa workflow improvements, not literal parity with external products.",
          "Preserve concrete changed files, verification results, installer/version notes, and any honest remaining limitations from the current answer.",
          "Mention intent recovery, memory/context use, Answer blueprint, self-evaluation, and revision gate when relevant.",
          "If the weak answer lacks honest model limits, add that local Ollama models have limits and external APIs are needed for higher-quality cloud model access.",
          IMAGE_GENERATION_ONLY ? "If the request is about video generation, say video generation is disabled in this build and offer image generation/storyboard alternatives; never claim a video was generated." : ""
        ].join(" ")
      },
      {
        role: "user",
        content: [
          `User request:\n${userText}`,
          `Intent:\n${formatIntentProfile(company.intent || {})}`,
          `Quality score: ${quality.score}/100`,
          `Problems: ${quality.reasons.join(", ") || "none"}`,
          `Current answer:\n${finalText}`
        ].join("\n\n")
      }
    ], {
      numPredict: 900,
      temperature: 0.24,
      timeout: 60000,
      signal: options.signal,
      fallbackModel: options.fallbackModel,
      onFallback: options.onFallback
    });
    const cleaned = stripThinking(revised).trim();
    return cleaned.length >= 24 ? cleaned : String(finalText || "");
  } catch {
    return String(finalText || "");
  }
}

function keywordSpecialistAgent(intent = {}, userText = "") {
  const kind = String(intent.taskKind || "chat");
  const labels = {
    code_create: "実装専門",
    code_modify: "デバッグ専門",
    research: "Web調査専門",
    image_generation: "画像専門",
    video_generation: "動画専門",
    folder_overview: "ファイル解析専門",
    code_capability: "開発設計専門",
    self_improvement: "AI改善専門",
    explain: "解説専門",
    continue: "継続作業専門"
  };
  if (kind === "chat") return null;
  const label = labels[kind] || `${kind}専門`;
  return {
    id: `keyword:${kind}`,
    name: `Nexa ${label}`,
    model: "intent-specialist-router",
    output: `キーワードと意図を ${kind} と判定し、${label}AIを実行チームへ追加しました。対象: ${clip(userText, 180)}`,
    error: ""
  };
}

async function runCompanyAgents(project, userText, history, system, send, attachments = [], options = {}) {
  const reasoning = reasoningOptions(options.reasoningLevel);
  const baseRoute = options.pipeline?.route || routeCompanyWork(userText);
  let intent = options.pipeline?.intent || analyzeUserIntent(userText, project);
  const activeReasoning = intent.chatGptLevel ? reasoningOptions("very-high") : reasoning;
  let route = {
    ...baseRoute,
    needsCode: baseRoute.needsCode || intent.needsCode,
    needsResearch: baseRoute.needsResearch || intent.needsResearch,
    needsCare: baseRoute.needsCare || intent.needsCare,
    isComplex: baseRoute.isComplex || intent.isTerse || intent.selfImprovement || activeReasoning.complexityBoost || Boolean(options.planMode),
    intent
  };
  route = options.pipeline?.route
    ? { ...route, ...options.pipeline.route, intent }
    : applyProjectModeToRoute(project, route, userText);
  intent = route.intent || intent;
  const selectedModel = resolveRequestedModel(system, options.modelChoice, route.needsCode ? "code" : "conversation");
  const localFastModel = localFallbackForKind(system, "fast");
  const localSmartModel = localFallbackForKind(system, "conversation");
  const localCodeModel = localFallbackForKind(system, "code");
  const fastModel = system.plan.fast || system.plan.conversation || selectedModel;
  const smartModel = options.modelChoice && options.modelChoice !== "auto"
    ? selectedModel
    : (system.plan.conversation || system.plan.fast || selectedModel);
  const codeModel = options.modelChoice && options.modelChoice !== "auto"
    ? selectedModel
    : (system.plan.code || smartModel || fastModel);
  const responseModel = route.needsCode ? (codeModel || smartModel || fastModel) : (smartModel || fastModel);
  const responseFallbackModel = route.needsCode
    ? (localCodeModel || localSmartModel || localFastModel)
    : (localSmartModel || localFastModel || localCodeModel);
  const deepProfile = deepReasoningProfile(userText, route, options);
  const workspaceSelection = project.workspaceReady
    ? (project.workspaceRoot || ".")
    : "(not selected)";
  const taskBrief = buildTaskBrief(project, userText, route);
  const answerContract = answerQualityContract(project, userText, route);
  const chatGptContract = chatGptGradeResponseContract(project, userText, route);
  const relevantMemory = relevantMemoryText(project, userText);
  const answerBlueprint = buildAnswerBlueprint(project, userText, route, relevantMemory);
  const context = [
    taskBrief,
    answerContract,
    chatGptContract,
    answerBlueprint,
    `Intent profile:\n${formatIntentProfile(intent)}`,
    options.pipeline ? `Nexa 3.0 execution plan:\n${JSON.stringify(pipelineSummary(options.pipeline), null, 2)}` : "",
    `Deep reasoning profile:\n${JSON.stringify(deepProfile, null, 2)}`,
    `User request:\n${userText}`,
    `Media policy:\n${IMAGE_GENERATION_ONLY ? "Image generation only. Video generation is intentionally disabled; never claim a video was created." : "Image and video generation may be available."}`,
    `Selected workspace folder:\n${workspaceSelection}`,
    `Workspace write scope:\n${project.workspaceReady ? "Write only inside the selected folder. Prefer direct file blocks for new files and valid diffs for edits." : "No selected folder; do not claim files were written."}`,
    `Recent chat:\n${history.map((message) => `${message.role}: ${clip(message.content, 700)}`).join("\n") || "none"}`,
    `Project memory:\n${projectMemoryText(project)}`,
    `Relevant memory:\n${relevantMemory}`,
    `Attachments:\n${formatAttachments(attachments)}`
  ].join("\n\n");
  const requestedFilesForLog = expectedFilesTextForLog(userText, route);
  const buildTargetForLog = describeBuildTarget(userText, route);
  const agents = [];
  const emitStep = (type, title, detail = "", data = {}) => {
    emitProcessEvent(options, processEvent(type, title, detail, data));
  };
  const emit = (item) => {
    agents.push(item);
    send?.("agent", {
      id: item.id,
      name: item.name,
      title: item.name,
      model: publicModelName(item.model),
      status: "complete",
      output: item.output
    });
  };
  const keywordAgent = keywordSpecialistAgent(intent, userText);
  if (keywordAgent) emit(keywordAgent);
  const llmOptions = (fallbackModel = "", extra = {}) => ({
    ...extra,
    fallbackModel,
    onFallback: (error, nextModel, failedModel) => {
      if (options.modelFallbackEmitted) return;
      options.modelFallbackEmitted = true;
      emitStep(
        "thinking",
        "クラウドからローカルへ退避",
        `${publicModelName(failedModel)} が使えなかったため、${publicModelName(nextModel)} で続行します。`,
        { failedModel: publicModelName(failedModel), fallbackModel: publicModelName(nextModel), error: error.message }
      );
    }
  });

  emitStep("thinking", "依頼内容を具体化", `「${clip(userText, 80)}」から、${buildTargetForLog}`, {
    intent: intent.taskKind,
    deep: deepProfile.enabled
  });
  emitStep("thinking", "モードを確認", `${route.modeLabel}: ${
    route.mode === "chat"
      ? "コード保存やPC操作は行わず、会話・文章・生成結果を優先します。"
      : route.mode === "code"
      ? "選択フォルダー内の読み書き・検証を優先します。"
      : route.mode === "both"
      ? "会話を基本に、コード作業が必要な時だけ開発ルートを使います。"
      : "送信前にモード選択が必要です。"
  }`, { mode: route.mode || "" });
  if (chatGptContract) {
    emitStep(
      "thinking",
      "作業基準を固定",
      route.needsCode
        ? "短い依頼でも、実ファイル作成・直接保存・最後の確認まで行う基準で進めます。"
        : "短い依頼でも、古い文脈へ流れず最新依頼を優先する基準で進めます。",
      { chatGptLevel: Boolean(intent.chatGptLevel), selfImprovement: Boolean(intent.selfImprovement) }
    );
  }
  emitStep("thinking", "最終出力の形を決める", route.needsCode
    ? "開発ログは途中経過に流し、最後は保存結果・検証結果・変更ファイルに絞ります。"
    : "質問を最終回答に混ぜず、必要な場合は選択肢として出せる形にします。", {
    blueprint: Boolean(answerBlueprint)
  });
  emitStep("thinking", "関連記憶を検索", relevantMemory === "No strongly relevant memory yet." ? "強く関連する記憶はまだありません。" : clip(relevantMemory, 220));

  emit(agentItem("orchestrator", [
    "Use a lightweight local-agent pipeline.",
    `Intent profile: ${intent.taskKind}. ${intent.inferredGoal}`,
    intent.isTerse ? "The user wrote a short prompt; infer from project state and recent memory before asking." : "The request has enough explicit detail to proceed.",
    intent.selfImprovement ? "Treat this as a concrete app self-improvement task, not a generic explanation about intelligence." : "",
    intent.chatGptLevel ? "Apply the Nexa quality response contract, but do not claim literal external-model parity." : "",
    intent.videoUnsupported ? "Video generation is disabled. Offer image generation, storyboard frames, or prompt design instead of pretending to generate a video." : "",
    "Follow the answer quality contract exactly.",
    "Use the answer blueprint as the final-answer checklist.",
    options.planMode ? "Plan mode is enabled; produce an explicit plan before execution details." : "Agent mode can proceed directly when safe.",
    route.needsCode ? "Route to Nexa implementation." : "Nexa implementation can stay in standby.",
    route.needsResearch ? "Route to Nexa research with no live web claim." : "Nexa research can stay in standby.",
    deepProfile.enabled ? "Use Nexa deep pass." : "Keep reasoning minimal."
  ].join(" ")));

  emit(agentItem("planner", route.isComplex
    ? `Plan from task brief, answer contract, answer blueprint, and intent profile: ${clip(`${taskBrief}\n${answerContract}\n${answerBlueprint}\n${formatIntentProfile(intent)}`.replace(/\n/g, " "), 1600)}`
    : `Plan: answer directly. ${clip(taskBrief.replace(/\n/g, " "), 500)}`));

  emit(agentItem("memory", projectMemoryText(project)));

  emitStep("thinking", "使う処理ルートを選択", route.needsCode
    ? `コード作成ルートで進めます。想定ファイル: ${requestedFilesForLog}`
    : "会話回答ルートで進めます。");

  emit(agentItem("toolRouter", project.workspaceReady
    ? `Nexa may write direct file blocks or valid patches inside: ${workspaceSelection}`
    : "No workspace folder is selected yet; code can be drafted, but file writes should wait."));

  emitStep("thinking", "作業範囲を確認", project.workspaceReady ? workspaceSelection : "フォルダー未選択。必要な場合はコード作業前に選択します。");

  if (route.isComplex && fastModel) {
    emitStep("thinking", "作業方針を具体化", route.needsCode
      ? `作る対象、保存先、検証方法を整理します。想定ファイル: ${requestedFilesForLog}`
      : "回答に必要な論点、避ける表現、使う記憶を整理します。");
    const note = await compactAgentCall(
      fastModel,
      "Nexa",
      "Analyze the request and produce the key reasoning points in 3 bullets or fewer.",
      context,
      llmOptions(localFastModel, { numPredict: Math.min(260, activeReasoning.numPredict), temperature: activeReasoning.temperature, signal: options.signal })
    );
    emit(agentItem("reasoner", note, fastModel));
  } else {
    emit(agentItem("reasoner", "The request is simple enough for direct response generation."));
  }

  if (deepProfile.enabled && fastModel) {
    emitStep("thinking", "完了条件を決める", route.needsCode
      ? "選択フォルダーにファイルが保存され、構造確認と構文確認が通る状態を完了条件にします。"
      : "最新依頼に直接答え、不要な質問や内部ログを最終回答へ混ぜない状態を完了条件にします。");
    const strategy = await compactAgentCall(
      fastModel,
      "Nexa",
      "Build a concise execution strategy: inferred goal, success criteria, risky assumptions, and what the final answer must contain. Do not answer the user.",
      context,
      llmOptions(localFastModel, { numPredict: Math.min(360, activeReasoning.numPredict), temperature: Math.min(0.25, activeReasoning.temperature), signal: options.signal })
    );
    emit(agentItem("strategist", strategy, fastModel));
  } else {
    emit(agentItem("strategist", "Deep strategy pass not required."));
  }

  if (route.needsCode && codeModel) {
    emitStep("thinking", "保存するコードを生成", project.workspaceReady
      ? `選択フォルダーへ直接保存できる file ブロックまたは差分を作ります。想定ファイル: ${requestedFilesForLog}`
      : `フォルダー未選択のため、保存可能なコード案だけ準備します。想定ファイル: ${requestedFilesForLog}`);
    const note = cleanCoderOutput(await coderAgentCall(codeModel, userText, context, llmOptions(localCodeModel || localSmartModel, { signal: options.signal })));
    emit(agentItem("coder", note, codeModel, 6000));
  } else {
    emit(agentItem("coder", "No code-specific deep pass required."));
  }

  if (route.needsResearch) {
    emit(agentItem("researcher", "Live web search is disabled in this chat-only surface. Avoid claiming current facts unless already known."));
  } else {
    emit(agentItem("researcher", "No research pass required."));
  }

  if (deepProfile.enabled && fastModel) {
    emitStep("thinking", "依頼からズレていないか確認", route.needsCode
      ? "作ろうとしているファイル構成が、ユーザーの短い依頼から外れていないか確認します。"
      : "古い会話ではなく最新の依頼に沿っているか確認します。");
    const alternate = await compactAgentCall(
      fastModel,
      "Nexa",
      "Give a concise second opinion: what might be wrong, missing, or overclaimed in the current plan. Focus on the latest user request.",
      `${context}\n\nCurrent notes:\n${agents.map((agent) => `${agent.name}: ${clip(agent.output, 360)}`).join("\n")}`,
      llmOptions(localFastModel, { numPredict: Math.min(300, activeReasoning.numPredict), temperature: Math.min(0.22, activeReasoning.temperature), signal: options.signal })
    );
    emit(agentItem("secondOpinion", alternate, fastModel));
  } else {
    emit(agentItem("secondOpinion", "Second-opinion pass not required."));
  }

  if ((route.isComplex || deepProfile.enabled) && fastModel) {
    emitStep("thinking", "実行前の問題を探す", route.needsCode
      ? "保存できないパス、空ファイル、プレースホルダー、依頼と違うファイル種類がないか確認します。"
      : "曖昧さ、矛盾、過大表現、不要な質問が残っていないか確認します。");
    const criticNote = await compactAgentCall(
      fastModel,
      "Nexa",
      "Check the plan for vagueness, wrong task drift, unnecessary questions, and missing implementation details. Return concise fix notes.",
      context,
      llmOptions(localFastModel, { numPredict: Math.min(260, activeReasoning.numPredict), temperature: Math.min(0.2, activeReasoning.temperature), signal: options.signal })
    );
    emit(agentItem("critic", criticNote, fastModel));
    const verifierNote = await compactAgentCall(
      fastModel,
      "Nexa",
      "Verify that the proposed response can satisfy the user's latest request. Prefer actionable defaults over asking questions.",
      `${context}\n\nNexa strategy note:\n${agents.find((agent) => agent.id === "strategist")?.output || ""}\n\nNexa review note:\n${agents.find((agent) => agent.id === "secondOpinion")?.output || ""}\n\nNexa code note:\n${agents.find((agent) => agent.id === "coder")?.output || ""}`,
      llmOptions(localFastModel, { numPredict: Math.min(240, activeReasoning.numPredict), temperature: Math.min(0.18, activeReasoning.temperature), signal: options.signal })
    );
    emit(agentItem("verifier", verifierNote, fastModel));
  } else {
    emit(agentItem("critic", "Check for vagueness, overclaiming, unnecessary questions, and missing direct answer before final response."));
    emit(agentItem("verifier", "Verify the final answer is consistent with the user's latest request and uses useful defaults when possible."));
  }
  const intelligence = intelligenceProfile(project, system);
  emit(agentItem("selfEvaluator", [
    `Smartness baseline: Lv${intelligence.beforeLevel} -> Lv${intelligence.afterLevel} (${intelligence.delta >= 0 ? "+" : ""}${intelligence.delta}).`,
    deepProfile.enabled ? "Nexa deep pass is active for this request." : "Standard quality gate is active.",
    chatGptContract ? "Nexa quality contract is active: intent recovery, memory use, no stale task drift, and self-revision." : "",
    "Answer blueprint is active before response generation.",
    "Final responses pass a local quality score before they are saved."
  ].filter(Boolean).join(" ")));
  emit(agentItem("security", route.needsCare
    ? "Be careful with destructive actions, secrets, credentials, or unsafe instructions."
    : "No special safety risk detected."));
  emit(agentItem("responseGenerator", route.needsCode
    ? "Compose the final answer in the user's language. Preserve Nexa's implementation code or patch; do not replace it with a summary. Do not put questions in the final answer."
    : "Compose the final user-facing answer in the user's language, using the agent notes silently. Do not put questions in the final answer; use sensible defaults."));

  const notes = agents.map((agent) => `## ${agent.name}\n${agent.output}`).join("\n\n");
  return {
    agents,
    model: responseModel,
    fallbackModel: responseFallbackModel,
    localPlan: system.localPlan || {},
    context,
    intent,
    route,
    intelligence: { ...intelligence, deepReasoning: deepProfile.enabled, deepProfile },
    messages: [
      {
        role: "system",
        content:
          "あなたはユーザーの作業を手伝うAIアシスタント Nexa です。ユーザーには内部ログを見せず、自然な日本語で直接答えてください。自己紹介ではAI会社や内部構造名で名乗らないでください。低スペック環境を想定し、必要以上に長くしないでください。"
      },
      {
        role: "system",
        content:
          "For code requests, Nexa writes actual implementation code. The final answer must include Nexa's code, patch, or file sections when present. Do not replace code with only a plan or summary."
      },
      {
        role: "system",
        content:
          "If information is missing but a safe useful default exists, choose the default and proceed. Do not include questions in the final answer. If user input is truly required, keep the answer short; the app will render choices separately."
      },
      {
        role: "system",
        content: answerContract
      },
      chatGptContract ? {
        role: "system",
        content: chatGptContract
      } : null,
      {
        role: "system",
        content: answerBlueprint
      },
      {
        role: "system",
        content:
          "Use a Nexa deep workflow for complex tasks: reconstruct intent, define success criteria, consider alternatives, verify contradictions, then answer. Do not claim parity with external AI products."
      },
      {
        role: "system",
        content:
          IMAGE_GENERATION_ONLY
            ? "Media rule: video generation is disabled in this build. If the user asks for video, do not say a video was generated. Offer image generation, storyboard frames, or a prompt/storyboard plan instead. Image generation remains available."
            : "Media rule: follow the available media tools honestly."
      },
      {
        role: "system",
        content:
          "参考データに selected-folder-overview が含まれる場合、それは現在選択中の作業フォルダーの実際の概要です。ユーザーが「この中」「このフォルダー」「中身」と言ったら、その概要を使って答えてください。添付がない、情報がない、と言わないでください。"
      },
      ...history,
      {
        role: "user",
        content: [
          `現在のユーザー依頼:\n${userText}`,
          `回答設計:\n${answerBlueprint}`,
          `添付された参考データ:\n${formatAttachments(attachments)}`,
          `内部エージェントメモ:\n${notes}`
        ].join("\n\n")
      }
    ].filter(Boolean)
  };
}

async function simpleChatStream(req, res) {
  const send = sse(res);
  try {
    const body = await readBody(req);
    const project = await getProject(body.projectId);
    if (!project) {
      send("error", { error: "project_not_found" });
      res.end();
      return;
    }

    const userText = String(body.message || "").trim();
    if (!userText) {
      send("error", { error: "empty_message" });
      res.end();
      return;
    }

    // A new user message resolves any earlier answer-style choice prompt.
    // Persisting this avoids a completed card reappearing after reload.
    resolveLatestChoiceRequest(project);

    let creditCharge = null;
    try {
      creditCharge = await consumeRequestCredits(req, 1, "chat");
    } catch (error) {
      send("error", { error: error.message, code: error.code || "", credits: error.credits || null });
      res.end();
      return;
    }

    const system = await systemProfile();
    let model = system.plan.conversation || system.plan.fast;
    const history = project.messages
      .slice(-18)
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: clip(stripThinking(message.content || ""), 4000)
      }));

    if (body.mode !== undefined) project.mode = normalizeChatMode(body.mode);
    const attachments = await storeAttachments(project, body.attachments || []);
    let route = routeCompanyWork(userText);
    route.intent = analyzeUserIntent(userText, project);
    route.needsCode = route.needsCode || route.intent.needsCode;
    route.needsResearch = route.needsResearch || route.intent.needsResearch;
    route.needsCare = route.needsCare || route.intent.needsCare;
    route.isComplex = route.isComplex || route.intent.isTerse || Boolean(route.intent.continuationHint);
    route = applyProjectModeToRoute(project, route, userText);
    if (isNonExecutingSafetyRequest(userText)) {
      route.needsCode = false;
      route.safetyPlanOnly = true;
    }
    const pipeline = createNexaPipeline({
      message: userText,
      mode: route.mode || project.mode || "chat",
      route,
      intent: route.intent,
      workspaceReady: Boolean(project.workspaceReady),
      attachmentCount: attachments.length,
      accessLevel: project.accessLevel,
      requestedModel: body.options?.modelChoice
    });
    const { autoContext, results: toolResults } = await executeNexaToolPlan(pipeline, project, userText, attachments);
    const agentContext = [...attachments, ...autoContext];
    const userMessage = {
      id: id("msg"),
      role: "user",
      content: userText,
      attachments: attachments.map(({ id: fileId, name, type, size, source, path: contextPath }) => ({
        id: fileId,
        name,
        type,
        size,
        source,
        path: contextPath
      })),
      context: contextSummary(autoContext),
      createdAt: now()
    };
    project.messages.push(userMessage);

    const assistantMessage = {
      id: id("msg"),
      role: "assistant",
      content: "",
      model: publicModelName(model || "local-fallback"),
      agents: [],
      createdAt: now()
    };

    send("system", system);
    if (creditCharge?.credits) send("credits", creditCharge.credits);
    send("user", userMessage);

    const company = await runCompanyAgents(project, userText, history, system, send, agentContext, { pipeline });
    model = company.model;
    assistantMessage.model = publicModelName(model || "local-fallback");
    assistantMessage.agents = company.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      model: publicModelName(agent.model),
      error: agent.error || ""
    }));
    send("assistant-start", assistantMessage);

    try {
      if (!model) throw new Error("no_model");
      const filterThinking = createThinkingFilter();
      const simpleFallbackModel = company.fallbackModel || localFallbackForKind(system, route.needsCode ? "code" : "conversation");
      for await (const delta of llmChatStream(model, [
        {
          role: "system",
          content:
            "あなたはユーザーの作業を手伝うシンプルなチャットAIです。ユーザーの言語で自然に答えてください。自己紹介では内部構造名で名乗らないでください。Web検索、ファイル操作、コード実行、MCP、プラグイン、マルチエージェント、長期記憶を使ったとは言わず、会話だけに集中してください。"
        },
        ...history,
        { role: "user", content: userText }
      ], {
        numPredict: 900,
        temperature: 0.45,
        fallbackModel: simpleFallbackModel,
        onFallback: (error, nextModel, failedModel) => {
          send("process", {
            messageId: assistantMessage.id,
            event: processEvent("thinking", "クラウドからローカルへ退避", `${publicModelName(failedModel)} が使えなかったため、${publicModelName(nextModel)} で続行します。`, {
              failedModel: publicModelName(failedModel),
              fallbackModel: publicModelName(nextModel),
              error: error.message
            })
          });
          assistantMessage.model = publicModelName(nextModel || assistantMessage.model);
        }
      })) {
        const visible = filterThinking(delta);
        if (!visible) continue;
        assistantMessage.content += visible;
        send("assistant-delta", { id: assistantMessage.id, delta: visible });
      }
    } catch (error) {
      const fallback = model
        ? `AIモデルとの通信で問題が起きました: ${error.message}`
        : "会話モデルが見つかりません。Ollamaを起動するか、クラウドAPIキーを設定するとチャットできます。";
      assistantMessage.content = fallback;
      send("assistant-delta", { id: assistantMessage.id, delta: fallback });
    }

    assistantMessage.content = sanitizeUserVisibleAssistantText(assistantMessage.content) || "返答が空でした。もう一度送ってください。";
    {
      const questionMoved = moveQuestionToChoiceRequest(assistantMessage.content, project, userText, route);
      assistantMessage.content = questionMoved.content;
      if (questionMoved.choiceRequest) assistantMessage.choiceRequest = questionMoved.choiceRequest;
    }
    project.messages.push(assistantMessage);
    project.summary = project.summary || clip(userText, 180);
    await saveProject(project);

    send("assistant-complete", assistantMessage);
    send("project", projectSummary(project));
    res.end();
  } catch (error) {
    send("error", { error: error.message });
    res.end();
  }
}

function directChatReply(userText = "") {
  const text = String(userText || "").trim();
  if (/^(?:こんにちは|こんばんは|おはよう(?:ございます)?|やあ|もしもし)[。.!！\s]*$/i.test(text)) {
    return "こんにちは。今日は何について話しましょうか？";
  }
  if (/^(?:ありがとう|ありがとうございます|助かった|了解|わかった)[。.!！\s]*$/i.test(text)) {
    return "どういたしまして。";
  }
  return "";
}

function chatReplyHasInternalReasoning(text = "") {
  const value = String(text || "").trim();
  if (!value) return true;
  return /(?:^|\n)\s*(?:Okay,?\s+(?:the\s+)?user|The user (?:asked|wants|is asking)|Let me (?:think|check|make sure)|First,? I need to|I should (?:explain|answer|respond)|Wait,|Looking back,|Possible explanation:|So the answer should|I need to (?:write|keep|make sure)|We need to)/i.test(value) ||
    /(?:previous conversation|initial instruction|answer in the user's language|check the previous messages|conversation history)/i.test(value);
}

function chatReplyLooksIncomplete(text = "") {
  const value = String(text || "").trim();
  if (!value) return true;
  if (/[、,:：;；（(\-]$/.test(value)) return true;
  if (/\b(?:for example|such as|because|and|or|so|but|the|a|an|to)$/i.test(value)) return true;
  return /(?:例えば|つまり|具体的には|理由は|次のような)[、:：]?$/u.test(value);
}

async function emitSmoothChatReply(send, messageId, text, signal) {
  const characters = Array.from(String(text || ""));
  const chunkSize = characters.length > 900 ? 6 : characters.length > 400 ? 4 : 2;
  for (let index = 0; index < characters.length; index += chunkSize) {
    if (signal?.aborted) throw new Error("chat_cancelled");
    const delta = characters.slice(index, index + chunkSize).join("");
    send("assistant-delta", { id: messageId, delta });
    if (characters.length <= 1200) await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function buildChatReasoningSummary(userText = "", reply = "", history = []) {
  const request = clip(String(userText || "").replace(/\s+/g, " ").trim(), 100);
  const answer = String(reply || "").trim();
  const usedContext = history.length > 0 && /^(?:それ|これ|さっき|前の|続き|どうして|なぜ|詳しく)/.test(request);
  const answerStyle = answer.length <= 80
    ? "要点だけを短く説明する"
    : /(?:^|\n)(?:[-*]|\d+[.、])/.test(answer)
      ? "要点を整理して順序立てて説明する"
      : "必要な背景を含めて自然な文章で説明する";
  return [
    usedContext ? "直前の会話と今回の発言を結び付けて意味を確認しました。" : `「${request}」の意味と求められている説明範囲を確認しました。`,
    `回答方針: ${answerStyle}。`,
    "内部メモや未確定の推測は表示せず、完成した回答だけを本文にしました。"
  ].join("\n");
}

async function runDirectChatMode({ project, userText, history, system, assistantMessage, send, signal, modelChoice }) {
  const fixedReply = directChatReply(userText);
  if (fixedReply) {
    assistantMessage.model = "Nexa";
    assistantMessage.content = fixedReply;
    send("assistant-delta", { id: assistantMessage.id, delta: fixedReply });
  } else {
    const model = resolveRequestedModel(system, modelChoice, "conversation") || system.plan.conversation || system.plan.code || system.plan.fast;
    assistantMessage.model = publicModelName(model || "local-fallback");
    if (!model) {
      assistantMessage.content = "会話モデルを起動できませんでした。Nexaを再起動してもう一度送ってください。";
      send("assistant-delta", { id: assistantMessage.id, delta: assistantMessage.content });
    } else {
      try {
        const cleanHistory = history.slice(-16).map((message) => ({
          role: message.role,
          content: clip(sanitizeUserVisibleAssistantText(message.content || ""), 2200)
        }));
        const chatMessages = [
          {
            role: "system",
            content: [
              "あなたはNexaという自然な会話アシスタントです。必ずユーザーの言語で、最新の発言へ直接答えてください。",
              "チャットモードでは会話だけを行います。コード作業、ファイル操作、開発ログ、AIチームの説明はしません。",
              "ユーザーが明示的に尋ねない限り、Nexaの内部構造、モデル名、能力一覧、評価点、Lv、プロジェクト記憶には触れません。",
              "短い発言は直前の同じ会話から自然に解釈します。関係のない古い話題や定型的な自己評価へ結び付けません。",
              "知らない内容を作らず、簡潔で自然に答えてください。質問が曖昧で回答不能な場合だけ、短い確認を1つ行ってください。",
              "内部で考えた手順、英語の分析、ユーザー発言の言い換え、回答方針は絶対に出力せず、完成した答えだけを返してください。 /no_think"
            ].join(" ")
          },
          ...cleanHistory,
          { role: "user", content: userText }
        ];
        let reply = await llmChat(model, chatMessages, {
          numPredict: 900,
          temperature: 0.42,
          signal,
          fallbackModel: localFallbackForKind(system, "conversation")
        });
        reply = sanitizeUserVisibleAssistantText(reply).trim();
        if (chatReplyHasInternalReasoning(reply) || chatReplyLooksIncomplete(reply)) {
          const repairModel = system.plan.fast && system.plan.fast !== model
            ? system.plan.fast
            : localFallbackForKind(system, "conversation");
          if (!repairModel) throw new Error("chat_response_validation_failed");
          reply = await llmChat(repairModel, [
            {
              role: "system",
              content: "最新の質問へ日本語で直接答えてください。内部推論、英語の分析、前置きは一切書かず、短く完結した最終回答だけを返してください。 /no_think"
            },
            ...cleanHistory.slice(-8),
            { role: "user", content: userText }
          ], {
            numPredict: 500,
            temperature: 0.2,
            signal
          });
          reply = sanitizeUserVisibleAssistantText(reply).trim();
          if (chatReplyHasInternalReasoning(reply) || chatReplyLooksIncomplete(reply)) {
            throw new Error("chat_response_validation_failed");
          }
        }
        assistantMessage.content = reply;
        await emitSmoothChatReply(send, assistantMessage.id, reply, signal);
      } catch (error) {
        assistantMessage.content = error.message === "chat_response_validation_failed"
          ? "回答を正しく生成できませんでした。もう一度送ってください。"
          : `会話モデルとの通信に失敗しました: ${error.message}`;
        send("assistant-delta", { id: assistantMessage.id, delta: assistantMessage.content });
      }
    }
  }
  assistantMessage.content = sanitizeUserVisibleAssistantText(assistantMessage.content).trim() || "うまく回答を生成できませんでした。";
  assistantMessage.reasoningSummary = buildChatReasoningSummary(userText, assistantMessage.content, history);
  assistantMessage.agents = [];
  assistantMessage.processEvents = [];
  project.messages.push(assistantMessage);
  project.summary ||= clip(userText, 180);
  await saveProject(project);
  send("assistant-complete", assistantMessage);
  send("project", projectSummary(project));
}

async function companyChatStream(req, res) {
  const send = sse(res);
  const abortController = new AbortController();
  let finished = false;
  res.on("close", () => {
    if (!finished) abortController.abort();
  });
  try {
    const body = await readBody(req);
    const project = await getProject(body.projectId);
    if (!project) {
      send("error", { error: "project_not_found" });
      res.end();
      return;
    }

    const submittedText = String(body.message || "").trim();
    if (!submittedText) {
      send("error", { error: "empty_message" });
      res.end();
      return;
    }
    let resumedSafetyPlan = pendingSafetyPlanContinuation(project, submittedText);
    let userText = resumedSafetyPlan
      ? `${resumedSafetyPlan.executableRequest}\n直前に提示した安全な代替案に沿って進め、破壊的変更の前に最終確認を取って。`
      : submittedText;
    let safetyDecision = null;
    let codeFollowUpDecision = null;
    let semanticIntentDecision = null;

    // The user has continued the conversation, so any previous choice is done.
    resolveLatestChoiceRequest(project);

    let creditCharge = null;
    try {
      creditCharge = await consumeRequestCredits(req, 1, "chat");
    } catch (error) {
      send("error", { error: error.message, code: error.code || "", credits: error.credits || null });
      finished = true;
      res.end();
      return;
    }

    if (body.mode !== undefined) project.mode = normalizeChatMode(body.mode);
    if (body.accessLevel !== undefined) {
      project.accessLevel = normalizeAccessLevel(body.accessLevel);
      project.codex = normalizeCodexState(project);
      project.codex.permissions = codexPermissionForAccess(project.accessLevel);
    }
    normalizeChatWorkspaceState(project);
    if (project.mode === "code" && !project.workspaceReady) {
      const system = await systemProfile();
      const attachments = await storeAttachments(project, body.attachments || []);
      const userMessage = {
        id: id("msg"),
        role: "user",
        content: submittedText,
        attachments: attachments.map(({ id: fileId, name, type, size, source, path: contextPath }) => ({
          id: fileId,
          name,
          type,
          size,
          source,
          path: contextPath
        })),
        context: [],
        createdAt: now()
      };
      const assistantMessage = {
        id: id("msg"),
        role: "assistant",
        content: "コードを書く場所を選べるようにしました。",
        model: "local-choice-router",
        agents: [agentItem("orchestrator", "Code mode requires a selected workspace folder before direct writes.")],
        choiceRequest: folderRequiredChoiceRequest(project, userText),
        processEvents: [
          processEvent("thinking", "コードモードを確認", "直接書き込みにはPCの作業フォルダーが必要です。")
        ],
        createdAt: now()
      };
      project.messages.push(userMessage, assistantMessage);
      await saveProject(project);
      send("system", system);
      send("user", userMessage);
      send("assistant-start", assistantMessage);
      send("assistant-complete", assistantMessage);
      send("project", projectSummary(project));
      res.end();
      return;
    }

    const system = await systemProfile();
    const pendingPlan = latestPendingSafetyPlan(project);
    if (pendingPlan) {
      safetyDecision = await resolveSafetyActionDecision(pendingPlan, submittedText, system);
      if (safetyDecision.decision === "approve") {
        resumedSafetyPlan = pendingPlan;
        userText = `${pendingPlan.executableRequest}\n直前に提示した安全な代替案に沿って進め、破壊的変更の前に最終確認を取って。`;
      }
    }
    if (!resumedSafetyPlan) {
      semanticIntentDecision = await resolveTurnIntentWithAi(project, submittedText, system);
      if (semanticIntentDecision?.confidence >= 0.62 && semanticIntentDecision.resolvedRequest) {
        semanticIntentDecision.resolvedRequest = semanticExecutionRequest(semanticIntentDecision, submittedText);
        userText = semanticIntentDecision.resolvedRequest;
      } else {
        codeFollowUpDecision = resolveCodeFollowUpContext(project, submittedText);
        if (codeFollowUpDecision?.effectiveRequest) userText = codeFollowUpDecision.effectiveRequest;
      }
    }
    const history = project.messages
      .slice(-18)
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: clip(stripThinking(message.content || ""), 4000)
      }));

    const attachments = await storeAttachments(project, body.attachments || []);
    let route = routeCompanyWork(userText);
    route.intent = analyzeUserIntent(userText, project);
    route.needsCode = route.needsCode || route.intent.needsCode;
    route.needsResearch = route.needsResearch || route.intent.needsResearch;
    route.needsCare = route.needsCare || route.intent.needsCare;
    route.isComplex = route.isComplex || route.intent.isTerse || Boolean(route.intent.continuationHint);
    if (semanticIntentDecision?.confidence >= 0.62) {
      const semanticCodeActions = new Set(["create", "modify", "debug", "continue", "computer", "command"]);
      route.needsCode = route.needsCode || semanticIntentDecision.needsCode || semanticCodeActions.has(semanticIntentDecision.action);
      route.needsResearch = route.needsResearch || semanticIntentDecision.needsResearch;
      route.isComplex = route.isComplex || semanticIntentDecision.continuation || semanticIntentDecision.action !== "chat";
      route.intent = {
        ...route.intent,
        semanticAction: semanticIntentDecision.action,
        semanticTarget: semanticIntentDecision.target,
        continuation: semanticIntentDecision.continuation,
        continuationHint: semanticIntentDecision.continuation ? semanticIntentDecision.resolvedRequest : route.intent.continuationHint,
        inferredGoal: semanticIntentDecision.resolvedRequest || route.intent.inferredGoal,
        failureFollowUp: semanticIntentDecision.action === "debug",
        needsCode: route.needsCode,
        needsResearch: route.needsResearch,
        needsInternet: semanticIntentDecision.needsInternet,
        needsComputer: semanticIntentDecision.needsComputer
      };
    }
    route = applyProjectModeToRoute(project, route, userText);
    if (isNonExecutingSafetyRequest(userText)) {
      route.needsCode = false;
      route.safetyPlanOnly = true;
    }
    const pipeline = createNexaPipeline({
      message: userText,
      mode: route.mode || project.mode || "chat",
      route,
      intent: route.intent,
      workspaceReady: Boolean(project.workspaceReady),
      attachmentCount: attachments.length,
      accessLevel: project.accessLevel,
      requestedModel: body.options?.modelChoice
    });
    const { autoContext, results: toolResults } = await executeNexaToolPlan(pipeline, project, userText, attachments);
    const agentContext = [...attachments, ...autoContext];
    const userMessage = {
      id: id("msg"),
      role: "user",
      content: submittedText,
      attachments: attachments.map(({ id: fileId, name, type, size, source, path: contextPath }) => ({
        id: fileId,
        name,
        type,
        size,
        source,
        path: contextPath
      })),
      context: contextSummary(autoContext),
      createdAt: now()
    };
    project.messages.push(userMessage);

    send("system", system);
    if (creditCharge?.credits) send("credits", creditCharge.credits);
    send("user", userMessage);

    const assistantMessage = {
      id: id("msg"),
      role: "assistant",
      content: "",
      model: "local-fallback",
      agents: [],
      processEvents: [],
      createdAt: now()
    };
    send("assistant-start", assistantMessage);
    if (route.modeForcedChat) {
      await runDirectChatMode({
        project,
        userText: submittedText,
        history,
        system,
        assistantMessage,
        send,
        signal: abortController.signal,
        modelChoice: body.options?.modelChoice
      });
      finished = true;
      res.end();
      return;
    }
    const startEvent = processEvent("thinking", "依頼を受け取る", clip(userText, 180));
    assistantMessage.processEvents.push(startEvent);
    send("process", { messageId: assistantMessage.id, event: startEvent });
    if (safetyDecision) {
      const safetyEvent = processEvent(
        safetyDecision.decision === "approve" ? "done" : "thinking",
        "安全判断AIが続行意図を確認",
        `${safetyDecision.decision} / ${Math.round(safetyDecision.confidence * 100)}% / ${safetyDecision.reason}`,
        safetyDecision
      );
      assistantMessage.processEvents.push(safetyEvent);
      send("process", { messageId: assistantMessage.id, event: safetyEvent });
      send("agent", {
        id: "safetyDecision",
        name: "Nexa Safety",
        title: "安全判断",
        model: safetyDecision.model || "deterministic-safety-fallback",
        status: "complete",
        output: `${safetyDecision.decision}: ${safetyDecision.reason}`
      });
    }
    if (semanticIntentDecision?.confidence >= 0.62) {
      const intentEvent = processEvent(
        "done",
        "意図判断AIが処理方針を決定",
        `${semanticIntentDecision.action} / ${semanticIntentDecision.target} / ${Math.round(semanticIntentDecision.confidence * 100)}% / ${semanticIntentDecision.reason}`,
        semanticIntentDecision
      );
      assistantMessage.processEvents.push(intentEvent);
      send("process", { messageId: assistantMessage.id, event: intentEvent });
      send("agent", {
        id: "intentDecision",
        name: "Nexa Intent",
        title: "意味・文脈判断",
        model: semanticIntentDecision.model,
        status: "complete",
        output: semanticIntentDecision.resolvedRequest
      });
    }
    if (codeFollowUpDecision) {
      const contextEvent = processEvent(
        "done",
        "継続ターン判断AIがデバッグ対象を復元",
        codeFollowUpDecision.previousGoal
          ? `直前の実装目的を引き継ぎ、${submittedText} を不具合報告として処理します。`
          : "現在の作業フォルダーを新規作成せず、既存実装のデバッグ対象として処理します。",
        codeFollowUpDecision
      );
      assistantMessage.processEvents.push(contextEvent);
      send("process", { messageId: assistantMessage.id, event: contextEvent });
      send("agent", {
        id: "contextDecision",
        name: "Nexa Context",
        title: "継続意図判断",
        model: codeFollowUpDecision.source,
        status: "complete",
        output: `debug: ${codeFollowUpDecision.previousGoal || submittedText}`
      });
    }

    // "OK、それやって" immediately after a safety plan is the user's
    // explicit approval of that plan. Do not ask for the same approval again.
    const fullAccessDestructiveApproval = normalizeAccessLevel(project.accessLevel) === "full" &&
      !isNonExecutingSafetyRequest(userText) &&
      isDestructiveOperationRequest(userText);
    const choiceResolution = body.options?.choiceResolution || (resumedSafetyPlan || fullAccessDestructiveApproval ? {
      requestId: "safety-plan-continuation",
      optionId: "workspace-delete-confirm",
      action: "send-prompt"
    } : null);
    if (["safe-plan", "explain-risk"].includes(choiceResolution?.optionId)) {
      route.needsCode = false;
      route.needsCare = true;
      route.safetyPlanOnly = true;
      pipeline.route.needsCode = false;
      pipeline.route.safetyPlanOnly = true;
    }
    const earlyChoiceRequest = preflightChoiceRequest(project, userText, route, attachments, autoContext, choiceResolution);
    if (earlyChoiceRequest) {
      assistantMessage.model = "Nexa";
      assistantMessage.content = choiceRequestIntro(earlyChoiceRequest);
      assistantMessage.choiceRequest = earlyChoiceRequest;
      assistantMessage.agents = [
        agentItem("orchestrator", `Choice gate prepared ${earlyChoiceRequest.options?.length || 0} selectable next actions.`),
        agentItem("verifier", "No final-answer question was emitted; user can continue by selecting an action.")
      ];
      for (const agent of assistantMessage.agents) {
        send("agent", {
          id: agent.id,
          name: agent.name,
          title: agent.name,
          model: publicModelName(agent.model),
          status: "complete",
          output: agent.output
        });
      }
      const choiceEvent = processEvent("done", "Choice gate", `${earlyChoiceRequest.options?.length || 0} options prepared`, {
        choiceRequestId: earlyChoiceRequest.id,
        title: earlyChoiceRequest.title
      });
      assistantMessage.processEvents.push(choiceEvent);
      send("process", { messageId: assistantMessage.id, event: choiceEvent });
      send("assistant-delta", { id: assistantMessage.id, delta: assistantMessage.content });
      project.messages.push(assistantMessage);
      project.summary = project.summary || clip(userText, 180);
      project.runs.push({
        id: id("run"),
        type: "choice-gate",
        createdAt: now(),
        agents: assistantMessage.agents,
        workspaceContext: contextSummary(autoContext),
        intent: route.intent || null,
        intelligence: intelligenceProfile(project, system),
        quality: { score: 100, grade: "A", passed: true, revised: false, reasons: [] }
      });
      project.runs = project.runs.slice(-60);
      await saveProject(project);
      send("assistant-complete", assistantMessage);
      send("project", projectSummary(project));
      finished = true;
      res.end();
      return;
    }

    if (choiceResolution?.optionId === "workspace-delete-confirm") {
      const staged = await stageConfirmedWorkspaceRebuild(project);
      assistantMessage.workspaceRebuild = staged;
      const stageEvent = processEvent(
        "edit",
        "既存ファイルを安全に退避",
        staged.moved.length
          ? `${staged.moved.length}件を ${staged.backupPath} へ退避しました。保護対象は変更していません。`
          : "退避が必要な既存ファイルはありませんでした。",
        { backupPath: staged.backupPath, moved: staged.moved, protected: staged.protected }
      );
      assistantMessage.processEvents.push(stageEvent);
      send("process", { messageId: assistantMessage.id, event: stageEvent });
    }

    const company = await runCompanyAgents(project, userText, history, system, send, agentContext, {
      signal: abortController.signal,
      modelChoice: body.options?.modelChoice,
      reasoningLevel: body.options?.reasoningLevel,
      planMode: route.safetyPlanOnly || body.options?.planMode || body.options?.mode === "plan",
      performance: body.options?.performance,
      processEvents: assistantMessage.processEvents,
      send,
      messageId: assistantMessage.id,
      pipeline
    });
    const model = company.model;
    let streamFallbackEmitted = false;
    const onStreamFallback = (error, nextModel, failedModel) => {
      if (streamFallbackEmitted) return;
      streamFallbackEmitted = true;
      const fallbackEvent = processEvent(
        "thinking",
        "クラウドからローカルへ退避",
        `${publicModelName(failedModel)} が使えなかったため、${publicModelName(nextModel)} で回答を続行します。`,
        { failedModel: publicModelName(failedModel), fallbackModel: publicModelName(nextModel), error: error.message }
      );
      assistantMessage.processEvents.push(fallbackEvent);
      send("process", { messageId: assistantMessage.id, event: fallbackEvent });
      assistantMessage.model = publicModelName(nextModel || assistantMessage.model);
    };
    assistantMessage.model = publicModelName(model || "local-fallback");
    assistantMessage.agents = company.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      model: publicModelName(agent.model),
      error: agent.error || ""
    }));
    if (safetyDecision) {
      assistantMessage.agents.unshift({
        id: "safetyDecision",
        name: "Nexa Safety",
        model: safetyDecision.model || "deterministic-safety-fallback",
        error: safetyDecision.decision === "unclear" ? safetyDecision.reason : ""
      });
    }
    if (codeFollowUpDecision) {
      assistantMessage.agents.unshift({
        id: "contextDecision",
        name: "Nexa Context",
        model: codeFollowUpDecision.source,
        error: ""
      });
    }
    if (semanticIntentDecision?.confidence >= 0.62) {
      assistantMessage.agents.unshift({
        id: "intentDecision",
        name: "Nexa Intent",
        model: semanticIntentDecision.model,
        error: ""
      });
    }
    try {
      const codeCapabilityReply = workspaceCodeCapabilityDirectReply(project, userText);
      const folderReply = route.needsCode ? "" : folderOverviewDirectReply(project, autoContext, userText);
      const directIntro = assistantSelfIntroductionReply(userText);
      const chatCapabilityReply = assistantChatCapabilityReply(userText, route.mode);
      const nexaStrengthsReply = assistantNexaStrengthsReply(userText, route.mode);
      const safetyReply = safetyPlanDirectReply(project, userText, route);
      const choiceRequest = preflightChoiceRequest(project, userText, route, attachments, autoContext, choiceResolution);
      if (choiceRequest) {
        assistantMessage.content = choiceRequestIntro(choiceRequest);
        assistantMessage.choiceRequest = choiceRequest;
        const choiceEvent = processEvent("done", "Choice gate", `${choiceRequest.options?.length || 0} options prepared`, {
          choiceRequestId: choiceRequest.id,
          title: choiceRequest.title
        });
        assistantMessage.processEvents.push(choiceEvent);
        send("process", { messageId: assistantMessage.id, event: choiceEvent });
        send("assistant-delta", { id: assistantMessage.id, delta: assistantMessage.content });
      } else if (safetyReply) {
        assistantMessage.content = safetyReply;
        assistantMessage.safetyPlan = {
          originalRequest: userText,
          executableRequest: executableRequestFromSafetyPrompt(userText),
          status: "awaiting-confirmation",
          createdAt: now()
        };
        send("assistant-delta", { id: assistantMessage.id, delta: safetyReply });
      } else if (route.intent?.videoUnsupported) {
        assistantMessage.content = "このビルドでは動画生成を外して、画像生成だけを残しました。動画として作ったふりはしません。代わりに、同じ内容を1枚の完成イメージとして画像生成するか、複数場面の絵コンテに分解できます。";
        assistantMessage.choiceRequest = videoDisabledChoiceRequest(userText);
        send("assistant-delta", { id: assistantMessage.id, delta: assistantMessage.content });
      } else if (codeCapabilityReply) {
        assistantMessage.content = codeCapabilityReply;
        send("assistant-delta", { id: assistantMessage.id, delta: codeCapabilityReply });
      } else if (folderReply) {
        assistantMessage.content = folderReply;
        send("assistant-delta", { id: assistantMessage.id, delta: folderReply });
      } else if (directIntro) {
        assistantMessage.content = directIntro;
        send("assistant-delta", { id: assistantMessage.id, delta: directIntro });
      } else if (chatCapabilityReply) {
        assistantMessage.content = chatCapabilityReply;
        send("assistant-delta", { id: assistantMessage.id, delta: chatCapabilityReply });
      } else if (nexaStrengthsReply) {
        assistantMessage.content = nexaStrengthsReply;
        send("assistant-delta", { id: assistantMessage.id, delta: nexaStrengthsReply });
      } else {
        const coderOutput = route.needsCode
          ? company.agents.find((agent) => agent.id === "coder")?.output || ""
          : "";
        const forceFreshRebuild = choiceResolution?.optionId === "workspace-delete-confirm";
        const forceContextRepair = codeFollowUpDecision?.action === "debug" || semanticIntentDecision?.action === "debug";
        if (forceFreshRebuild || forceContextRepair || (coderOutput && !coderOutput.startsWith("fallback:"))) {
          const finalCoderOutput = await materializeCoderOutput(
            project,
            route,
            model,
            userText,
            company.context || "",
            coderOutput,
            {
              signal: abortController.signal,
              processEvents: assistantMessage.processEvents,
              send,
              messageId: assistantMessage.id,
              fallbackModel: company.fallbackModel,
              forceFreshRebuild: forceFreshRebuild || forceContextRepair,
              workspaceRebuild: assistantMessage.workspaceRebuild || null,
              onFallback: onStreamFallback
            }
          );
          assistantMessage.content = finalCoderOutput;
          send("assistant-delta", { id: assistantMessage.id, delta: assistantMessage.content });
        } else {
          if (!model) throw new Error("no_model");
          const filterThinking = createThinkingFilter();
          const responseOptions = company.intent?.chatGptLevel
            ? reasoningOptions("very-high")
            : reasoningOptions(body.options?.reasoningLevel);
          for await (const delta of llmChatStream(model, company.messages, {
            numPredict: route.needsCode ? Math.max(1800, responseOptions.numPredict) : responseOptions.numPredict,
            temperature: route.needsCode ? Math.min(0.32, responseOptions.temperature) : responseOptions.temperature,
            signal: abortController.signal,
            fallbackModel: company.fallbackModel,
            onFallback: onStreamFallback
          })) {
            const visible = filterThinking(delta);
            if (!visible) continue;
            assistantMessage.content += visible;
            send("assistant-delta", { id: assistantMessage.id, delta: visible });
          }
        }
      }
    } catch (error) {
      const fallback = model
        ? `AIモデルとの通信で問題が起きました: ${error.message}`
        : "会話モデルが見つかりません。Ollamaを起動するか、クラウドAPIキーを設定するとチャットできます。";
      assistantMessage.content = fallback;
      send("assistant-delta", { id: assistantMessage.id, delta: fallback });
    }

    assistantMessage.content = sanitizeUserVisibleAssistantText(assistantMessage.content) || "返答が空でした。もう一度送ってください。";
    {
      const questionMoved = moveQuestionToChoiceRequest(assistantMessage.content, project, userText, route);
      assistantMessage.content = questionMoved.content;
      if (questionMoved.choiceRequest) assistantMessage.choiceRequest = questionMoved.choiceRequest;
    }
    let quality = localResponseQuality(project, userText, assistantMessage.content, company.route || route);
    let revisedByQualityGate = false;
    if (quality.needsRevision) {
      const revised = await reviseLowQualityResponse(model, userText, assistantMessage.content, quality, company, {
        signal: abortController.signal,
        fallbackModel: company.fallbackModel,
        onFallback: onStreamFallback
      });
      if (revised && revised.trim() && revised.trim() !== assistantMessage.content.trim()) {
        assistantMessage.content = revised.trim();
        revisedByQualityGate = true;
        quality = localResponseQuality(project, userText, assistantMessage.content, company.route || route);
      }
    }
    company.intelligence = intelligenceProfile(project, system);
    if ((company.intent?.selfImprovement || company.intent?.chatGptLevel) && quality.score < 92) {
      const deterministic = deterministicSmartnessFallback(company, quality);
      if (deterministic) {
        assistantMessage.content = deterministic;
        revisedByQualityGate = true;
        quality = localResponseQuality(project, userText, assistantMessage.content, company.route || route);
      }
    }
    assistantMessage.quality = {
      ...quality,
      revised: revisedByQualityGate
    };
    company.intelligence.qualityScore = quality.score;
    company.intelligence.qualityGrade = quality.grade;
    company.intelligence.revised = revisedByQualityGate;
    const evalAgent = agentItem(
      "selfEvaluator",
      `Final quality ${quality.score}/100 (${quality.grade}). ${revisedByQualityGate ? "Rewrote the answer before saving." : "No rewrite required."} Reasons: ${quality.reasons.join(", ") || "none"}.`,
      model || "local-rules"
    );
    assistantMessage.processEvents ||= [];
    const qualityEvent = processEvent(
      revisedByQualityGate ? "edit" : "done",
      "品質確認",
      `${quality.score}/100 (${quality.grade})${revisedByQualityGate ? " / 回答を保存前に補正しました" : " / 追加補正なし"}`,
      { score: quality.score, grade: quality.grade, revised: revisedByQualityGate, reasons: quality.reasons }
    );
    assistantMessage.processEvents.push(qualityEvent);
    send("process", { messageId: assistantMessage.id, event: qualityEvent });
    const evalIndex = company.agents.findIndex((agent) => agent.id === "selfEvaluator");
    if (evalIndex >= 0) company.agents[evalIndex] = evalAgent;
    else company.agents.push(evalAgent);
    send("agent", {
      id: evalAgent.id,
      name: evalAgent.name,
      title: evalAgent.name,
      model: publicModelName(evalAgent.model),
      status: "complete",
      output: evalAgent.output
    });
    assistantMessage.agents = company.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      model: publicModelName(agent.model),
      error: agent.error || ""
    }));
    project.messages.push(assistantMessage);
    project.summary = project.summary || clip(userText, 180);
    updateCompanyMemory(project, userText, assistantMessage.content, company);
    project.runs.push({
      id: id("run"),
      type: "multi-agent-chat",
      createdAt: now(),
      agents: company.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        model: publicModelName(agent.model),
        output: clip(agent.output, agent.id === "coder" ? 6000 : 1200),
        error: agent.error || ""
      })),
      workspaceContext: contextSummary(autoContext),
      modelPlan: system.plan,
      intent: company.intent || null,
      intelligence: company.intelligence,
      quality: assistantMessage.quality
      ,pipeline: {
        ...pipelineSummary(pipeline),
        toolResults
      }
    });
    project.runs = project.runs.slice(-60);
    await saveProject(project);

    send("assistant-complete", assistantMessage);
    send("project", projectSummary(project));
    finished = true;
    res.end();
  } catch (error) {
    if (abortController.signal.aborted) {
      finished = true;
      try {
        res.end();
      } catch {
        // Client already closed the stream.
      }
      return;
    }
    send("error", { error: error.message });
    finished = true;
    res.end();
  }
}

function formatExecutionValue(value) {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function executeJavaScript(req, res) {
  try {
    const body = await readBody(req, 512 * 1024);
    const logs = [];
    const sandbox = {
      console: {
        log: (...args) => logs.push(args.map(formatExecutionValue).join(" ")),
        error: (...args) => logs.push(args.map(formatExecutionValue).join(" "))
      },
      Math,
      Date,
      JSON,
      Number,
      String,
      Boolean,
      Array,
      Object,
      Set,
      Map,
      RegExp
    };
    const script = new vm.Script(String(body.code || ""), { filename: "agent-snippet.js" });
    const result = script.runInNewContext(sandbox, { timeout: 1500 });
    json(res, 200, { ok: true, logs, result: formatExecutionValue(result) });
  } catch (error) {
    json(res, 400, { ok: false, error: error.message });
  }
}

function isDangerousShellCommand(command) {
  return SHELL_DENY_PATTERNS.some((pattern) => pattern.test(command));
}

function shellInvocation(command) {
  if (process.platform === "win32") {
    return {
      file: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command]
    };
  }
  return {
    file: "bash",
    args: ["-lc", command]
  };
}

async function runShellCommand(command, timeoutMs = 15000, cwd = WORKSPACE_ROOT) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const invocation = shellInvocation(command);
    const child = spawn(invocation.file, invocation.args, {
      cwd,
      windowsHide: true,
      shell: false,
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1"
      }
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const append = (target, chunk) => {
      const next = `${target}${chunk.toString("utf8")}`;
      return next.length > 120000 ? next.slice(-120000) : next;
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        command,
        exitCode: null,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: `${stderr}${stderr ? "\n" : ""}${error.message}`,
        timedOut
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: !timedOut && code === 0,
        command,
        exitCode: code,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
        timedOut
      });
    });
  });
}

async function executeShell(req, res) {
  try {
    const body = await readBody(req, 256 * 1024);
    const command = String(body.command || "").trim();
    const project = body.projectId ? await getProject(body.projectId) : null;
    if (!command) {
      json(res, 400, { ok: false, error: "command_required" });
      return;
    }
    if (body.projectId && !project) {
      json(res, 404, { ok: false, error: "project_not_found" });
      return;
    }
    if (command.length > 2000) {
      json(res, 400, { ok: false, error: "command_too_long" });
      return;
    }
    const dangerous = isDangerousShellCommand(command);
    assertOperationApproval(project, "shell", { dangerous, approved: body.approved === true });
    assertShellSafety(project, command, "shell", body.approved === true);

    const cwd = project?.workspaceReady ? projectWorkspaceRootPath(project) : WORKSPACE_ROOT;
    const result = await runShellCommand(command, Math.min(30000, Math.max(1000, Number(body.timeoutMs || 15000))), cwd);
    if (project) {
      project.runs.push({
        id: id("run"),
        type: "shell",
        createdAt: now(),
        command,
        cwd,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        timedOut: result.timedOut,
        stdout: clip(result.stdout, 12000),
        stderr: clip(result.stderr, 12000),
        agents: [
          {
            id: "terminal",
            name: "Workspace Terminal",
            title: "Terminal",
            model: "local-shell",
            output: clip(`${command}\nexit ${result.exitCode}${result.timedOut ? " timeout" : ""}`, 500),
            error: result.ok ? "" : clip(result.stderr || "command failed", 500)
          }
        ],
        modelPlan: {}
      });
      project.runs = project.runs.slice(-80);
      await saveProject(project);
    }
    json(res, 200, result);
  } catch (error) {
    json(res, error.status || 500, { ok: false, error: error.message, code: error.code || "" });
  }
}

function quotePowerShellLiteral(value = "") {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function executeComputerAction(req, res) {
  try {
    const body = await readBody(req, 128 * 1024);
    const project = body.projectId ? await getProject(body.projectId) : null;
    if (body.projectId && !project) return json(res, 404, { ok: false, error: "project_not_found" });
    const action = String(body.action || "");
    const value = String(body.value || "").trim();
    if (!value || !["open-path", "open-url", "start-app"].includes(action)) {
      return json(res, 400, { ok: false, error: "computer_action_invalid" });
    }
    if (action === "open-url" && !/^https?:\/\//i.test(value)) {
      return json(res, 400, { ok: false, error: "computer_url_invalid" });
    }
    const dangerous = action === "start-app" && /(?:regedit|diskpart|format|shutdown|powershell|cmd(?:\.exe)?$)/i.test(value);
    const capabilities = assertOperationApproval(project, `computer:${action}`, {
      dangerous,
      approved: body.approved === true
    });
    if (!capabilities.canControlComputer && normalizeAccessLevel(project?.accessLevel) !== "safety") {
      // Always-approval mode may run after explicit approval; safety mode may
      // open ordinary paths/apps without asking.
      if (!(body.approved === true && capabilities.approvalPolicy === "always")) {
        throw permissionError("computer_control_not_allowed", "computer control requires approval or full access");
      }
    }
    const command = `Start-Process -FilePath ${quotePowerShellLiteral(value)}`;
    const result = await runShellCommand(command, 15000, project?.workspaceReady ? projectWorkspaceRootPath(project) : WORKSPACE_ROOT);
    json(res, result.ok ? 200 : 500, { ...result, action, value });
  } catch (error) {
    json(res, error.status || 500, { ok: false, error: error.message, code: error.code || "" });
  }
}

async function executeNetworkFetch(req, res) {
  try {
    const body = await readBody(req, 128 * 1024);
    const project = body.projectId ? await getProject(body.projectId) : null;
    if (body.projectId && !project) return json(res, 404, { ok: false, error: "project_not_found" });
    const target = String(body.url || "").trim();
    if (!/^https?:\/\//i.test(target)) return json(res, 400, { ok: false, error: "network_url_invalid" });
    assertOperationApproval(project, "internet", { dangerous: false, approved: body.approved === true });
    const response = await fetch(target, {
      method: "GET",
      headers: { "user-agent": "Nexa/3.0" },
      signal: AbortSignal.timeout(Math.min(30000, Math.max(1000, Number(body.timeoutMs || 15000))))
    });
    const contentType = response.headers.get("content-type") || "";
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 2 * 1024 * 1024) return json(res, 413, { ok: false, error: "network_response_too_large" });
    const text = /(?:text|json|javascript|xml|html)/i.test(contentType)
      ? new TextDecoder().decode(bytes)
      : "";
    json(res, 200, {
      ok: response.ok,
      status: response.status,
      url: response.url,
      contentType,
      size: bytes.byteLength,
      text: clip(text, 200000)
    });
  } catch (error) {
    json(res, error.status || 500, { ok: false, error: error.message, code: error.code || "" });
  }
}

async function workspaceCheckCommands(project = null) {
  const commands = [];
  const add = (command) => {
    const clean = String(command || "").trim();
    if (clean && !commands.includes(clean)) commands.push(clean);
  };
  const root = project?.workspaceReady ? projectWorkspaceRootPath(project) : WORKSPACE_ROOT;

  try {
    await stat(path.join(root, "server.mjs"));
    add("node --check server.mjs");
  } catch {
    // no server entry
  }
  try {
    await stat(path.join(root, "public", "app.js"));
    add("node --check public/app.js");
  } catch {
    // no frontend script
  }

  const packageJson = await readJson(path.join(root, "package.json"), null);
  const scripts = packageJson?.scripts || {};
  if (scripts.test) add("npm test");
  if (scripts.lint) add("npm run lint");
  if (scripts.typecheck) add("npm run typecheck");
  return commands.slice(0, 8);
}

function shellQuote(value = "") {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function fileSpecificCheckCommands(files = []) {
  const commands = [];
  const add = (command) => {
    const clean = String(command || "").trim();
    if (clean && !commands.includes(clean)) commands.push(clean);
  };

  for (const file of files.slice(0, 12)) {
    const rel = String(file.path || "").replace(/\\/g, "/");
    const ext = path.extname(rel).toLowerCase();
    if (!rel || rel.includes("..")) continue;
    if ([".js", ".mjs", ".cjs"].includes(ext)) add(`node --check ${shellQuote(rel)}`);
    if (ext === ".py") add(`python -m py_compile ${shellQuote(rel)}`);
  }

  return commands;
}

async function postWriteCheckCommands(project, files = []) {
  const fileChecks = fileSpecificCheckCommands(files);
  const projectChecks = await workspaceCheckCommands(project);
  const focusedProjectChecks = projectChecks.filter((command) =>
    /node --check|npm run (lint|typecheck)|npm test/i.test(command)
  );
  return normalizeCheckCommands([...fileChecks, ...focusedProjectChecks]).slice(0, 6);
}

async function runPostWriteChecksForFiles(project, files = [], options = {}) {
  if (!project?.workspaceReady || !files.length) return { ran: false, ok: true, results: [], commands: [] };
  const commands = await postWriteCheckCommands(project, files);
  if (!commands.length) return { ran: false, ok: true, results: [], commands: [] };
  try {
    assertCodexPermission(project, "checks");
    for (const command of commands) assertShellSafety(project, command, "checks");
  } catch (error) {
    return { ran: false, ok: false, results: [], commands, error: error.message };
  }

  emitProcessEvent(options, processEvent("command", "最後にエラーが出ないか確認します", commands.join("\n"), { commands }));
  const cwd = projectWorkspaceRootPath(project);
  const startedAt = Date.now();
  const results = [];
  for (const command of commands) {
    results.push(await runShellCommand(command, 25000, cwd));
  }
  const durationMs = Date.now() - startedAt;
  const ok = results.every((result) => result.ok);
  const summary = results.every((result) => result.ok)
    ? `${results.length}件の確認が通りました。エラーは見つかりませんでした。`
    : `${results.filter((result) => result.ok).length}/${results.length}件の確認が通りました。修正が必要な結果があります。`;

  project.runs.push({
    id: id("run"),
    type: "post-write-checks",
    createdAt: now(),
    command: "post-write checks",
    cwd: project.workspaceRoot || ".",
    exitCode: ok ? 0 : 1,
    durationMs,
    timedOut: results.some((result) => result.timedOut),
    stdout: clip(results.map((result) => `> ${result.command}\n${result.stdout || ""}`).join("\n\n"), 16000),
    stderr: clip(results.map((result) => result.stderr || "").filter(Boolean).join("\n\n"), 12000),
    checks: results.map((result) => ({
      command: result.command,
      ok: result.ok,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
      stdout: clip(result.stdout, 5000),
      stderr: clip(result.stderr, 3500)
    })),
    agents: [{
      id: "checks",
      name: "Nexa",
      title: "エラー確認",
      model: "local-shell",
      output: summary,
      error: ok ? "" : "one or more checks failed"
    }],
    modelPlan: {}
  });
  project.runs = project.runs.slice(-80);
  await saveProject(project);
  emitProcessEvent(options, processEvent(ok ? "done" : "error", ok ? "エラー確認が完了しました" : "エラーを見つけました", summary, { commands, results }));
  return { ran: true, ok, results, commands, durationMs };
}

function postWriteChecksSummary(checks = {}) {
  if (!checks.ran) {
    return checks.error ? `エラー確認を実行できませんでした: ${checks.error}` : "";
  }
  const lines = [
    "エラー確認",
    ...checks.results.map((result) => {
      const status = result.ok ? "OK" : "修正が必要";
      const tail = result.stderr || result.stdout || "";
      return `- ${status}: ${result.command}${tail ? `\n  ${clip(tail.replace(/\s+/g, " "), 420)}` : ""}`;
    })
  ];
  return lines.join("\n");
}

function normalizeCheckCommands(commands) {
  return (commands || [])
    .map((command) => String(command || "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

async function executeWorkspaceChecks(req, res) {
  try {
    const body = await readBody(req, 256 * 1024);
    const project = body.projectId ? await getProject(body.projectId) : null;
    const commands = normalizeCheckCommands(body.commands?.length ? body.commands : await workspaceCheckCommands(project));
    if (!commands.length) {
      json(res, 400, { ok: false, error: "checks_required" });
      return;
    }
    if (body.projectId && !project) {
      json(res, 404, { ok: false, error: "project_not_found" });
      return;
    }
    assertCodexPermission(project, "checks");
    for (const command of commands) {
      if (command.length > 2000) {
        json(res, 400, { ok: false, error: "command_too_long" });
        return;
      }
      assertShellSafety(project, command, "checks");
    }

    const startedAt = Date.now();
    const timeoutMs = Math.min(30000, Math.max(1000, Number(body.timeoutMs || 20000)));
    const results = [];
    const cwd = project?.workspaceReady ? projectWorkspaceRootPath(project) : WORKSPACE_ROOT;
    for (const command of commands) {
      results.push(await runShellCommand(command, timeoutMs, cwd));
    }
    const durationMs = Date.now() - startedAt;
    const ok = results.every((result) => result.ok);
    if (project) {
      project.runs.push({
        id: id("run"),
        type: "checks",
        createdAt: now(),
        command: "workspace checks",
        cwd: project?.workspaceReady ? project.workspaceRoot : ".",
        exitCode: ok ? 0 : 1,
        durationMs,
        timedOut: results.some((result) => result.timedOut),
        stdout: clip(results.map((result) => `> ${result.command}\n${result.stdout || ""}`).join("\n\n"), 16000),
        stderr: clip(results.map((result) => result.stderr || "").filter(Boolean).join("\n\n"), 12000),
        checks: results.map((result) => ({
          command: result.command,
          ok: result.ok,
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          timedOut: result.timedOut,
          stdout: clip(result.stdout, 6000),
          stderr: clip(result.stderr, 4000)
        })),
        agents: [
          {
            id: "checks",
            name: "Workspace Checks",
            title: "Checks",
            model: "local-shell",
            output: `${results.filter((result) => result.ok).length}/${results.length} checks passed`,
            error: ok ? "" : "one or more checks failed"
          }
        ],
        modelPlan: {}
      });
      project.runs = project.runs.slice(-80);
      await saveProject(project);
    }

    json(res, 200, { ok, durationMs, results, project });
  } catch (error) {
    json(res, error.status || 500, { ok: false, error: error.message, code: error.code || "" });
  }
}

async function serveStatic(url, res, method = "GET") {
  const routeAliases = {
    "/auth": "/auth.html",
    "/login": "/auth.html",
    "/account": "/auth.html",
    "/billing": "/billing.html",
    "/admin": "/admin.html"
  };
  const requestPath = url.pathname === "/"
    ? "/index.html"
    : (routeAliases[url.pathname] || decodeURIComponent(url.pathname));
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    json(res, 403, { error: "forbidden" });
    return;
  }
  try {
    const content = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const shouldRevalidate = ext === ".html" || ext === ".js" || ext === ".css";
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "content-length": content.length,
      ...(shouldRevalidate ? { "cache-control": "no-cache" } : {})
    });
    if (method === "HEAD") {
      res.end();
      return;
    }
    res.end(content);
  } catch {
    notFound(res);
  }
}

async function latestInstallerFile() {
  const distDir = path.join(ROOT, "dist");
  try {
    const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
    const expectedName = `Nexa-Setup-${packageJson.version}.exe`;
    const expectedPath = path.join(distDir, expectedName);
    if (existsSync(expectedPath)) return { fileName: expectedName, filePath: expectedPath };
  } catch {
    // Fall back to scanning dist below.
  }
  const candidates = [];
  for (const fileName of await readdir(distDir).catch(() => [])) {
    if (!/^(Nexa|Agent Company Chat)-Setup-.+\.exe$/i.test(fileName)) continue;
    const filePath = path.join(distDir, fileName);
    const info = await stat(filePath).catch(() => null);
    if (info?.isFile()) candidates.push({ fileName, filePath, mtimeMs: info.mtimeMs });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] || null;
}

async function publishedInstallerUrl() {
  if (process.env.NEXA_INSTALLER_URL) return process.env.NEXA_INSTALLER_URL;
  try {
    const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
    const version = String(packageJson.version || "").trim();
    if (!version) return "";
    return `https://github.com/ainexa0706-ux/Nexa/releases/download/v${version}/Nexa-Setup-${version}.exe`;
  } catch {
    return "";
  }
}

async function serveInstaller(req, res) {
  const installer = await latestInstallerFile();
  if (!installer) {
    const publishedUrl = await publishedInstallerUrl();
    if (publishedUrl) {
      res.writeHead(302, { location: publishedUrl, "cache-control": "no-store" });
      res.end();
      return;
    }
    json(res, 404, { error: "installer_not_found", message: "Published installer is not configured." });
    return;
  }
  const { fileName, filePath } = installer;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("installer_not_file");
    res.writeHead(200, {
      "content-type": "application/vnd.microsoft.portable-executable",
      "content-length": info.size,
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store"
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(filePath).pipe(res);
  } catch {
    json(res, 404, {
      error: "installer_not_found",
      message: "Run npm run dist:win to build the Windows installer."
    });
  }
}

async function handleAuthApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const { user, store } = await getSession(req);
    json(res, 200, {
      authenticated: Boolean(user),
      user: publicUser(user),
      providers: authProviderList(),
      setupRequired: store.users.length === 0,
      stripeConfigured: Boolean(STRIPE_SECRET_KEY && anyStripePriceConfigured())
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/auth/providers") {
    const store = await readAuthStore();
    json(res, 200, { providers: authProviderList(), setupRequired: store.users.length === 0 });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/google/desktop/start") {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      jsonError(res, 501, "google_not_configured");
      return true;
    }
    cleanupDesktopOauthStates();
    const state = randomToken(24);
    DESKTOP_OAUTH_STATES.set(state, {
      createdAt: Date.now(),
      status: "pending",
      user: null,
      sessionToken: "",
      error: ""
    });
    json(res, 200, {
      state,
      url: googleAuthorizationUrl(state).toString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/auth/google/desktop/poll") {
    cleanupDesktopOauthStates();
    const state = url.searchParams.get("state") || "";
    const record = DESKTOP_OAUTH_STATES.get(state);
    if (!record) {
      jsonError(res, 404, "desktop_oauth_not_found");
      return true;
    }
    if (record.status === "error") {
      DESKTOP_OAUTH_STATES.delete(state);
      json(res, 200, { status: "error", error: record.error || "google_login_failed" });
      return true;
    }
    if (record.status === "complete" && record.sessionToken) {
      setSessionCookie(res, record.sessionToken);
      DESKTOP_OAUTH_STATES.delete(state);
      json(res, 200, { status: "complete", user: record.user, desktopSessionToken: record.sessionToken });
      return true;
    }
    json(res, 200, { status: "pending" });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/auth/google/start") {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      redirect(res, "/?auth_error=google_not_configured");
      return true;
    }
    const state = randomToken(24);
    setOauthStateCookie(res, state);
    redirect(res, googleAuthorizationUrl(state).toString());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/auth/google/callback") {
    const expectedState = parseCookies(req)[OAUTH_STATE_COOKIE];
    const returnedState = url.searchParams.get("state") || "";
    const desktopRecord = DESKTOP_OAUTH_STATES.get(returnedState);
    const code = url.searchParams.get("code") || "";
    const providerError = url.searchParams.get("error") || "";
    clearOauthStateCookie(res);
    if (providerError) {
      if (desktopRecord) {
        desktopRecord.status = "error";
        desktopRecord.error = providerError;
        html(res, 200, oauthHtml("Nexaログインに失敗しました", "Googleログインがキャンセルされたか、失敗しました。このウィンドウを閉じて、Nexaからもう一度試してください。"));
        return true;
      }
      redirect(res, `/?auth_error=${encodeURIComponent(providerError)}`);
      return true;
    }
    if (!desktopRecord && (!expectedState || !returnedState || expectedState !== returnedState)) {
      redirect(res, "/?auth_error=oauth_state_mismatch");
      return true;
    }
    if (!code) {
      if (desktopRecord) {
        desktopRecord.status = "error";
        desktopRecord.error = "oauth_code_missing";
        html(res, 200, oauthHtml("Nexaログインに失敗しました", "Googleからログインコードが返りませんでした。このウィンドウを閉じて、Nexaからもう一度試してください。"));
        return true;
      }
      redirect(res, "/?auth_error=oauth_code_missing");
      return true;
    }
    try {
      const token = await exchangeGoogleCode(code);
      const profile = await fetchGoogleProfile(token.access_token);
      const store = await readAuthStore();
      const { user } = upsertGoogleUser(store, profile);
      const { token: sessionToken, session } = createSession(req, user);
      store.sessions.push(session);
      await writeAuthStore(store);
      if (desktopRecord) {
        desktopRecord.status = "complete";
        desktopRecord.user = publicUser(user);
        desktopRecord.sessionToken = sessionToken;
        html(res, 200, oauthHtml("Nexaログイン完了", "ログインが完了しました。Nexaに戻ってください。このブラウザタブは閉じて大丈夫です。"));
        return true;
      }
      setSessionCookie(res, sessionToken);
      redirect(res, "/?auth=google");
    } catch (error) {
      if (desktopRecord) {
        desktopRecord.status = "error";
        desktopRecord.error = error.message || "google_login_failed";
        html(res, 200, oauthHtml("Nexaログインに失敗しました", "NexaがGoogleログインを完了できませんでした。Nexaに戻ってもう一度試してください。"));
        return true;
      }
      redirect(res, `/?auth_error=${encodeURIComponent(error.message || "google_login_failed")}`);
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readBody(req, 128 * 1024);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const name = String(body.name || "").trim().slice(0, 80);
    if (!validEmail(email)) return jsonError(res, 400, "invalid_email"), true;
    if (password.length < 8) return jsonError(res, 400, "password_too_short"), true;

    const store = await readAuthStore();
    if (store.users.some((user) => user.email === email)) {
      return jsonError(res, 409, "email_already_registered"), true;
    }
    const firstUser = store.users.length === 0;
    const ownerUser = shouldCreateOwner(email, store);
    const passwordData = hashPassword(password);
    const user = {
      id: id("user"),
      email,
      name: name || email.split("@")[0],
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
      role: ownerUser ? "admin" : "user",
      plan: ownerUser ? "pro" : "free",
      status: "active",
      subscriptionStatus: ownerUser ? "active" : "",
      stripeCustomerId: "",
      stripeSubscriptionId: "",
      createdAt: now(),
      updatedAt: now(),
      lastLoginAt: now()
    };
    const { token, session } = createSession(req, user);
    store.users.push(user);
    normalizeOwnerAdmin(store);
    store.sessions.push(session);
    await writeAuthStore(store);
    setSessionCookie(res, token);
    json(res, 201, { user: publicUser(user), firstUser, ...desktopSessionPayload(token, session) });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req, 128 * 1024);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (tooManyLoginAttempts(req, email)) {
      return jsonError(res, 429, "too_many_login_attempts"), true;
    }
    const store = await readAuthStore();
    const user = store.users.find((item) => item.email === email && activeUser(item));
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      recordLoginFailure(req, email);
      return jsonError(res, 401, "invalid_credentials"), true;
    }
    clearLoginFailures(req, email);
    user.lastLoginAt = now();
    user.updatedAt = now();
    const { token, session } = createSession(req, user);
    store.sessions.push(session);
    await writeAuthStore(store);
    setSessionCookie(res, token);
    json(res, 200, { user: publicUser(user), ...desktopSessionPayload(token, session) });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = parseCookies(req)[SESSION_COOKIE];
    const store = await readAuthStore();
    if (token) {
      const tokenHash = sha256(token);
      for (const session of store.sessions) {
        if (session.tokenHash === tokenHash) session.revokedAt = now();
      }
      await writeAuthStore(store);
    }
    clearSessionCookie(res);
    clearOauthStateCookie(res);
    json(res, 200, { ok: true });
    return true;
  }

  if (url.pathname.startsWith("/api/auth/api-keys")) {
    notFound(res);
    return true;
  }

  return false;
}

async function createStripeCheckoutSession(user, planId = "pro") {
  const plan = billingPlanById(planId);
  if (!plan || plan.id === "free") {
    const error = new Error("billing_plan_not_found");
    error.status = 400;
    throw error;
  }
  const priceId = stripePriceIdForPlan(plan.id);
  if (!STRIPE_SECRET_KEY || !priceId) {
    const error = new Error("stripe_not_configured");
    error.status = 501;
    throw error;
  }
  const successUrl = STRIPE_SUCCESS_URL.includes("{CHECKOUT_SESSION_ID}")
    ? STRIPE_SUCCESS_URL
    : `${STRIPE_SUCCESS_URL}${STRIPE_SUCCESS_URL.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
  const checkoutFields = [
    ["mode", "subscription"],
    ["line_items[0][price]", priceId],
    ["line_items[0][quantity]", "1"],
    ["success_url", successUrl],
    ["cancel_url", STRIPE_CANCEL_URL],
    ["client_reference_id", user.id],
    ["metadata[userId]", user.id],
    ["metadata[planId]", plan.id],
    ["subscription_data[metadata][userId]", user.id],
    ["subscription_data[metadata][planId]", plan.id],
    ["allow_promotion_codes", "true"]
  ];
  if (user.stripeCustomerId) checkoutFields.push(["customer", user.stripeCustomerId]);
  else checkoutFields.push(["customer_email", user.email]);
  const body = formEncode(checkoutFields);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "stripe_checkout_failed");
    error.status = response.status;
    throw error;
  }
  return { ...payload, selectedPlan: plan };
}

function verifyStripeSignature(rawBody, signatureHeader = "") {
  if (!STRIPE_WEBHOOK_SECRET) {
    const error = new Error("stripe_webhook_secret_missing");
    error.status = 501;
    throw error;
  }
  const parts = Object.fromEntries(String(signatureHeader || "").split(",").map((part) => {
    const [key, value] = part.split("=");
    return [key, value];
  }));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    const error = new Error("stripe_signature_missing");
    error.status = 400;
    throw error;
  }
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) {
    const error = new Error("stripe_signature_expired");
    error.status = 400;
    throw error;
  }
  const expected = crypto
    .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody.toString("utf8")}`, "utf8")
    .digest("hex");
  if (!timingSafeEqualHex(expected, signature)) {
    const error = new Error("stripe_signature_invalid");
    error.status = 400;
    throw error;
  }
}

async function applyStripeEvent(event) {
  const store = await readAuthStore();
  const object = event.data?.object || {};
  store.billingEvents.push({
    id: event.id || id("stripe"),
    type: event.type || "unknown",
    planId: object.metadata?.planId || "",
    userId: object.metadata?.userId || object.client_reference_id || "",
    createdAt: now()
  });
  const userId = object.metadata?.userId || object.client_reference_id || "";
  const planId = paidPlanIdOrDefault(object.metadata?.planId || "pro");
  const customerId = object.customer || "";
  const subscriptionId = object.subscription || object.id || "";
  const user = store.users.find((item) => item.id === userId) ||
    store.users.find((item) => customerId && item.stripeCustomerId === customerId);
  if (user) {
    if (customerId) user.stripeCustomerId = customerId;
    if (subscriptionId) user.stripeSubscriptionId = subscriptionId;
    if (event.type === "checkout.session.completed") {
      user.plan = planId;
      user.subscriptionStatus = "active";
    }
    if (event.type === "customer.subscription.updated") {
      user.subscriptionStatus = object.status || user.subscriptionStatus || "";
      user.plan = ["active", "trialing"].includes(user.subscriptionStatus) ? planId : "free";
    }
    if (event.type === "customer.subscription.deleted") {
      user.plan = "free";
      user.subscriptionStatus = "canceled";
    }
    user.updatedAt = now();
  }
  store.billingEvents = store.billingEvents.slice(-500);
  await writeAuthStore(store);
}

async function handleBillingApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/billing/status") {
    const auth = await getSession(req);
    const authenticated = Boolean(auth.user);
    const plans = publicBillingPlans().map((plan) => ({
      ...plan,
      checkoutReady: authenticated && plan.checkoutReady
    }));
    json(res, 200, {
      authenticated,
      plan: auth.user ? userEffectivePlan(auth.user) : "free",
      user: auth.user ? publicUser(auth.user) : null,
      credits: auth.user ? creditSummaryForUser(auth.user) : null,
      plans,
      stripeConfigured: Boolean(STRIPE_SECRET_KEY && anyStripePriceConfigured()),
      checkoutReady: authenticated && Boolean(STRIPE_SECRET_KEY && anyStripePriceConfigured()),
      requiredEnv: {
        secretKey: "STRIPE_SECRET_KEY",
        webhookSecret: "STRIPE_WEBHOOK_SECRET",
        prices: {
          plus: "STRIPE_PLUS_PRICE_ID",
          pro: "STRIPE_PRO_PRICE_ID",
          studio: "STRIPE_STUDIO_PRICE_ID"
        }
      }
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/billing/checkout") {
    const auth = await requireUser(req, res);
    if (!auth) return true;
    try {
      const body = await readBody(req, 64 * 1024);
      const planId = String(body.planId || body.plan || "pro").toLowerCase();
      const session = await createStripeCheckoutSession(auth.user, planId);
      json(res, 200, { url: session.url, id: session.id, plan: session.selectedPlan });
    } catch (error) {
      jsonError(res, error.status || 500, error.message, {
        setup: "サーバーの.envにSTRIPE_SECRET_KEY、STRIPE_PLUS_PRICE_ID、STRIPE_PRO_PRICE_ID、STRIPE_STUDIO_PRICE_ID、STRIPE_WEBHOOK_SECRETを設定してください。STRIPE_PRICE_IDはPro用の旧別名として引き続き使えます。"
      });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/billing/webhook") {
    try {
      const raw = await readRawBody(req, 2 * 1024 * 1024);
      verifyStripeSignature(raw, req.headers["stripe-signature"]);
      const event = JSON.parse(raw.toString("utf8") || "{}");
      await applyStripeEvent(event);
      json(res, 200, { received: true });
    } catch (error) {
      jsonError(res, error.status || 400, error.message);
    }
    return true;
  }

  return false;
}

async function handleAdminApi(req, res, url) {
  if (!url.pathname.startsWith("/api/admin")) return false;
  const auth = await requireAdmin(req, res);
  if (!auth) return true;

  if (req.method === "GET" && url.pathname === "/api/admin/overview") {
    const activeUsers = auth.store.users.filter(activeUser).length;
    const bannedUsers = auth.store.users.filter((user) => blockedUserStatus(user.status)).length;
    const proUsers = auth.store.users.filter((user) => user.plan === "pro").length;
    const creditUsed = auth.store.users.reduce((sum, user) => sum + Number(creditSummaryForUser(user).used || 0), 0);
    json(res, 200, {
      users: auth.store.users.length,
      activeUsers,
      bannedUsers,
      proUsers,
      creditUsed,
      ownerUserId: auth.store.ownerUserId || "",
      plans: publicBillingPlans(),
      stripeConfigured: Boolean(STRIPE_SECRET_KEY && anyStripePriceConfigured() && STRIPE_WEBHOOK_SECRET)
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/users") {
    json(res, 200, {
      users: auth.store.users
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map(publicUser)
    });
    return true;
  }

  const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (req.method === "PATCH" && userMatch) {
    const body = await readBody(req, 128 * 1024);
    const user = auth.store.users.find((item) => item.id === decodeURIComponent(userMatch[1]));
    if (!user) return notFound(res), true;
    if ("role" in body) {
      if (body.role === "admin" && !isOwnerAdmin(auth.store, user)) {
        return jsonError(res, 400, "only_owner_can_be_admin"), true;
      }
      user.role = body.role === "admin" ? "admin" : "user";
    }
    if ("plan" in body) {
      const requestedPlan = String(body.plan || "free");
      user.plan = BILLING_PLANS.some((plan) => plan.id === requestedPlan) ? requestedPlan : "free";
    }
    if ("bonusCredits" in body || "creditsBonus" in body) {
      const credits = normalizeUserCredits(user);
      credits.bonus = Math.max(0, Math.floor(Number(body.bonusCredits ?? body.creditsBonus ?? 0)));
      credits.updatedAt = now();
    }
    if ("creditsUsed" in body) {
      const credits = normalizeUserCredits(user);
      credits.used = Math.max(0, Math.floor(Number(body.creditsUsed || 0)));
      credits.updatedAt = now();
    }
    if ("status" in body) {
      const nextStatus = ["banned", "disabled"].includes(String(body.status || "")) ? "banned" : "active";
      if (isOwnerAdmin(auth.store, user) && nextStatus !== "active") {
        return jsonError(res, 400, "owner_cannot_be_banned"), true;
      }
      user.status = nextStatus;
    }
    user.updatedAt = now();
    normalizeOwnerAdmin(auth.store);
    await writeAuthStore(auth.store);
    json(res, 200, { user: publicUser(user) });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/billing") {
    json(res, 200, {
      events: auth.store.billingEvents.slice(-100).reverse(),
      stripeConfigured: Boolean(STRIPE_SECRET_KEY && anyStripePriceConfigured() && STRIPE_WEBHOOK_SECRET)
    });
    return true;
  }

  return false;
}

async function handleSocialApi(req, res, url) {
  if (!url.pathname.startsWith("/api/social")) return false;

  if (req.method === "GET" && url.pathname === "/api/social/status") {
    json(res, 200, publicSocialStore(await readSocialOpsStore()));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/social/campaigns") {
    try {
      json(res, 201, await createSocialCampaign(await readBody(req, 256 * 1024)));
    } catch (error) {
      json(res, error.status || 400, { error: error.message, code: error.code || "" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/social/accounts") {
    try {
      json(res, 201, await addSocialAccount(await readBody(req, 64 * 1024)));
    } catch (error) {
      json(res, error.status || 400, { error: error.message, code: error.code || "" });
    }
    return true;
  }

  const postActionMatch = url.pathname.match(/^\/api\/social\/posts\/([^/]+)\/(approve|publish|cancel)$/);
  if (req.method === "POST" && postActionMatch) {
    try {
      const postId = decodeURIComponent(postActionMatch[1]);
      const action = postActionMatch[2];
      const status = action === "approve" ? "approved" : action === "cancel" ? "canceled" : "published";
      const result = await updateSocialPost(postId, { status });
      json(res, 200, {
        ...result,
        manualPublish: action === "publish",
        note: action === "publish" ? "SNS API未設定のため、手動公開済みとして記録しました" : ""
      });
    } catch (error) {
      json(res, error.status || 400, { error: error.message, code: error.code || "" });
    }
    return true;
  }

  const postMatch = url.pathname.match(/^\/api\/social\/posts\/([^/]+)$/);
  if (req.method === "PATCH" && postMatch) {
    try {
      json(res, 200, await updateSocialPost(decodeURIComponent(postMatch[1]), await readBody(req, 256 * 1024)));
    } catch (error) {
      json(res, error.status || 400, { error: error.message, code: error.code || "" });
    }
    return true;
  }

  return false;
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if ((req.method === "GET" || req.method === "HEAD") && ["/login", "/account", "/auth"].includes(url.pathname)) {
      await serveStatic(new URL("/auth.html", `http://${req.headers.host || "localhost"}`), res, req.method);
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/admin") {
      await serveStatic(new URL("/admin.html", `http://${req.headers.host || "localhost"}`), res, req.method);
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/billing") {
      await serveStatic(new URL("/billing.html", `http://${req.headers.host || "localhost"}`), res, req.method);
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/download/installer") {
      await serveInstaller(req, res);
      return;
    }

    const cookieApiWrite =
      ["POST", "PATCH", "DELETE"].includes(req.method) &&
      (url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/api/admin") || url.pathname.startsWith("/api/billing") || url.pathname.startsWith("/api/social")) &&
      url.pathname !== "/api/billing/webhook";
    if (cookieApiWrite && !trustedOrigin(req)) {
      jsonError(res, 403, "untrusted_origin");
      return;
    }

    if (await handleAuthApi(req, res, url)) return;
    if (await handleBillingApi(req, res, url)) return;
    if (await handleAdminApi(req, res, url)) return;
    if (await handleSocialApi(req, res, url)) return;

    const generatedAssetMatch = url.pathname.match(/^\/api\/generated\/images\/[^/]+\.(?:svg|gif|png|webp|jpe?g)$/);
    const projectItemMatch = url.pathname.match(/^\/api\/projects\/[^/]+$/);
    const projectCodexMatch = url.pathname.match(/^\/api\/projects\/[^/]+\/codex$/);
    const projectTasksMatch = url.pathname.match(/^\/api\/projects\/[^/]+\/tasks(?:\/[^/]+)?$/);
    const allowedChatOnlyApi =
      (req.method === "GET" && url.pathname === "/api/system") ||
      (req.method === "GET" && url.pathname === "/api/plugins") ||
      (req.method === "GET" && url.pathname === "/api/mcp") ||
      (req.method === "GET" && url.pathname === "/api/projects") ||
      (req.method === "POST" && url.pathname === "/api/projects") ||
      (req.method === "GET" && Boolean(projectItemMatch)) ||
      (req.method === "PATCH" && Boolean(projectItemMatch)) ||
      (req.method === "DELETE" && Boolean(projectItemMatch)) ||
      (req.method === "PATCH" && Boolean(projectCodexMatch)) ||
      (req.method === "POST" && Boolean(projectTasksMatch)) ||
      (req.method === "PATCH" && Boolean(projectTasksMatch)) ||
      (req.method === "DELETE" && Boolean(projectTasksMatch)) ||
      (req.method === "GET" && url.pathname === "/api/workspace/tree") ||
      (req.method === "GET" && url.pathname === "/api/workspace/file") ||
      (req.method === "GET" && url.pathname === "/api/workspace/codex") ||
      (req.method === "GET" && url.pathname === "/api/workspace/changes") ||
      (req.method === "GET" && url.pathname === "/api/workspace/search") ||
      (req.method === "GET" && url.pathname === "/api/workspace/context") ||
      (req.method === "POST" && url.pathname === "/api/workspace/changes/snapshot") ||
      (req.method === "GET" && url.pathname === "/api/workspace/checks") ||
      (req.method === "POST" && url.pathname === "/api/system/folder-picker") ||
      (req.method === "GET" && Boolean(generatedAssetMatch)) ||
      (req.method === "POST" && url.pathname === "/api/generate/image") ||
      (req.method === "POST" && url.pathname === "/api/generate/video") ||
      (req.method === "PUT" && url.pathname === "/api/workspace/file") ||
      (req.method === "POST" && url.pathname === "/api/workspace/patch") ||
      (req.method === "POST" && url.pathname === "/api/workspace/checks") ||
      (req.method === "POST" && url.pathname === "/api/chat/simple/stream");
    if (url.pathname.startsWith("/api/") && !allowedChatOnlyApi) {
      return notFound(res);
    }

    if (req.method === "GET" && generatedAssetMatch) {
      await serveGeneratedAsset(url, res);
      return;
    }

    if (req.method === "POST" && (url.pathname === "/api/generate/image" || url.pathname === "/api/generate/video")) {
      try {
        const kind = url.pathname.endsWith("/video") ? "video" : "image";
        const body = await readBody(req, 2 * 1024 * 1024);
        const creditCharge = await consumeRequestCredits(req, kind === "video" ? 10 : 3, `${kind}-generation`);
        const result = await generateMediaArtifact(body, kind);
        json(res, 200, { ...result, credits: creditCharge.credits || null });
      } catch (error) {
        json(res, error.status || 500, { ok: false, error: error.message, code: error.code || "", credits: error.credits || null });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/system") {
      json(res, 200, await systemProfile());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/system/folder-picker") {
      try {
        const selected = await pickLocalFolderDialog();
        if (!selected) {
          json(res, 200, { canceled: true, path: "", name: "" });
          return;
        }
        await validateWorkspaceFolder(selected);
        json(res, 200, {
          canceled: false,
          path: selected,
          name: folderNameFromWorkspace(selected)
        });
      } catch (error) {
        json(res, error.status || 500, { error: error.message });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/plugins") {
      json(res, 200, { plugins: await loadPlugins() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/mcp") {
      json(res, 200, await loadMcp({ probe: url.searchParams.get("probe") === "1" }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/workspace/tree") {
      const depth = Math.min(5, Math.max(0, Number(url.searchParams.get("depth") || 2)));
      json(res, 200, await workspaceTree(url.searchParams.get("path") || "", depth));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/workspace/file") {
      const projectId = url.searchParams.get("projectId");
      const project = projectId ? await getProject(projectId) : null;
      if (projectId && !project) {
        json(res, 404, { error: "project_not_found" });
        return;
      }
      json(res, 200, await workspaceFile(url.searchParams.get("path") || "", project));
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/workspace/file") {
      try {
        json(res, 200, await writeWorkspaceFile(await readBody(req, 2 * 1024 * 1024)));
      } catch (error) {
        json(res, error.status || 400, {
          error: error.message,
          code: error.code || "",
          currentHash: error.currentHash || ""
        });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/workspace/patch") {
      try {
        json(res, 200, await workspacePatch(await readBody(req, 768 * 1024)));
      } catch (error) {
        json(res, error.status || 400, { error: error.message, code: error.code || "" });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/workspace/search") {
      const projectId = url.searchParams.get("projectId");
      const project = projectId ? await getProject(projectId) : null;
      if (projectId && !project) {
        json(res, 404, { error: "project_not_found" });
        return;
      }
      json(res, 200, await workspaceSearch(url.searchParams.get("q") || "", 80, project));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/workspace/context") {
      const project = await getProject(url.searchParams.get("projectId"));
      if (!project) {
        json(res, 404, { error: "project_not_found" });
        return;
      }
      const context = await workspaceAutoContext(project, url.searchParams.get("q") || "", []);
      json(res, 200, {
        query: url.searchParams.get("q") || "",
        context: contextSummary(context),
        previews: context.map((item) => ({
          path: item.path,
          reason: item.reason,
          preview: clip(item.text, 240)
        }))
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/workspace/changes") {
      json(res, 200, await workspaceChanges());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/workspace/checks") {
      const projectId = url.searchParams.get("projectId");
      const project = projectId ? await getProject(projectId) : null;
      if (projectId && !project) {
        json(res, 404, { error: "project_not_found" });
        return;
      }
      json(res, 200, { commands: await workspaceCheckCommands(project) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/workspace/checks") {
      await executeWorkspaceChecks(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/workspace/changes/snapshot") {
      const baseline = await createWorkspaceBaseline();
      json(res, 200, {
        ok: true,
        baselineAt: baseline.createdAt,
        count: Object.keys(baseline.files || {}).length
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/workspace/codex") {
      const projectId = url.searchParams.get("projectId");
      const project = projectId ? await getProject(projectId) : null;
      if (projectId && !project) {
        json(res, 404, { error: "project_not_found" });
        return;
      }
      json(res, 200, await workspaceCodexState(project));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/workspace/agents/init") {
      const body = await readBody(req, 128 * 1024);
      const project = body.projectId ? await getProject(body.projectId) : null;
      if (body.projectId && !project) {
        json(res, 404, { error: "project_not_found" });
        return;
      }
      assertCodexPermission(project, "agents-init");
      json(res, 200, { ok: true, file: await initAgentsFile() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/projects") {
      json(res, 200, { projects: await listProjects() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/projects") {
      const body = await readBody(req, 128 * 1024);
      const project = createProject(body.name, body.goal);
      if ("mode" in body) project.mode = normalizeChatMode(body.mode);
      if ("accessLevel" in body) project.accessLevel = normalizeAccessLevel(body.accessLevel);
      if ("workspaceRoot" in body) {
        project.workspaceRoot = await validateWorkspaceFolder(body.workspaceRoot);
        project.workspaceReady = true;
        project.selectedFolderPath = project.workspaceRoot;
        project.selectedFolderName = folderNameFromWorkspace(project.workspaceRoot);
        project.projectType = "folder";
        if (!body.name && project.selectedFolderName) project.name = project.selectedFolderName;
      }
      project.codex.permissions = codexPermissionForAccess(project.accessLevel);
      await saveProject(project);
      json(res, 201, { project });
      return;
    }

    const pinCollectionMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/pins$/);
    if (pinCollectionMatch) {
      const project = await getProject(decodeURIComponent(pinCollectionMatch[1]));
      if (!project) return notFound(res);
      if (req.method === "POST") {
        try {
          const body = await readBody(req, 128 * 1024);
          const pin = await pinWorkspaceFile(project, body.path);
          await saveProject(project);
          json(res, 201, { project, pin });
        } catch (error) {
          json(res, 400, { error: error.message });
        }
        return;
      }
    }

    const pinItemMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/pins\/([^/]+)$/);
    if (pinItemMatch) {
      const project = await getProject(decodeURIComponent(pinItemMatch[1]));
      if (!project) return notFound(res);
      const pinId = decodeURIComponent(pinItemMatch[2]);
      const before = project.pinnedContext.length;
      project.pinnedContext = project.pinnedContext.filter((item) => item.id !== pinId && item.path !== pinId);
      if (before === project.pinnedContext.length) return notFound(res);
      await saveProject(project);
      json(res, 200, { project });
      return;
    }

    const taskCollectionMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/tasks$/);
    if (taskCollectionMatch) {
      const project = await getProject(decodeURIComponent(taskCollectionMatch[1]));
      if (!project) return notFound(res);
      if (req.method === "POST") {
        const body = await readBody(req, 128 * 1024);
        const [task] = addProjectTasks(project, [body.text], "open");
        if (!task) {
          json(res, 400, { error: "empty_task" });
          return;
        }
        await saveProject(project);
        json(res, 201, { project, task });
        return;
      }
    }

    const taskItemMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/tasks\/([^/]+)$/);
    if (taskItemMatch) {
      const project = await getProject(decodeURIComponent(taskItemMatch[1]));
      if (!project) return notFound(res);
      const taskId = decodeURIComponent(taskItemMatch[2]);
      const task = project.memory.tasks.find((item) => item.id === taskId);
      if (!task) return notFound(res);

      if (req.method === "PATCH") {
        const body = await readBody(req, 128 * 1024);
        if ("text" in body) {
          const text = taskText(body.text);
          if (!text || blankMemoryText(text)) {
            json(res, 400, { error: "empty_task" });
            return;
          }
          task.text = text;
        }
        if ("status" in body) {
          task.status = body.status === "done" ? "done" : "open";
        }
        task.updatedAt = now();
        syncNextFromTasks(project);
        await saveProject(project);
        json(res, 200, { project, task });
        return;
      }

      if (req.method === "DELETE") {
        project.memory.tasks = project.memory.tasks.filter((item) => item.id !== taskId);
        syncNextFromTasks(project);
        await saveProject(project);
        json(res, 200, { project });
        return;
      }
    }

    const codexConfigMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/codex$/);
    if (codexConfigMatch) {
      const project = await getProject(decodeURIComponent(codexConfigMatch[1]));
      if (!project) return notFound(res);
      if (req.method === "PATCH") {
        const body = await readBody(req, 128 * 1024);
        const codex = updateCodexConfig(project, body);
        await saveProject(project);
        json(res, 200, { project, codex });
        return;
      }
    }

    const reviewCollectionMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/review-comments$/);
    if (reviewCollectionMatch) {
      const project = await getProject(decodeURIComponent(reviewCollectionMatch[1]));
      if (!project) return notFound(res);
      if (req.method === "POST") {
        try {
          const body = await readBody(req, 128 * 1024);
          const comment = addReviewComment(project, body);
          await saveProject(project);
          json(res, 201, { project, comment });
        } catch (error) {
          json(res, 400, { error: error.message });
        }
        return;
      }
    }

    const reviewItemMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/review-comments\/([^/]+)$/);
    if (reviewItemMatch) {
      const project = await getProject(decodeURIComponent(reviewItemMatch[1]));
      if (!project) return notFound(res);
      const commentId = decodeURIComponent(reviewItemMatch[2]);
      const codex = normalizeCodexState(project);
      const comment = codex.reviewComments.find((item) => item.id === commentId);
      if (!comment) return notFound(res);

      if (req.method === "PATCH") {
        const body = await readBody(req, 128 * 1024);
        if ("status" in body) comment.status = body.status === "resolved" ? "resolved" : "open";
        if ("body" in body) comment.body = String(body.body || "").trim().slice(0, 2000) || comment.body;
        if ("line" in body) comment.line = Number(body.line || 0);
        if ("path" in body) comment.path = String(body.path || comment.path).slice(0, 500);
        await saveProject(project);
        json(res, 200, { project, comment });
        return;
      }

      if (req.method === "DELETE") {
        codex.reviewComments = codex.reviewComments.filter((item) => item.id !== commentId);
        await saveProject(project);
        json(res, 200, { project });
        return;
      }
    }

    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch) {
      const project = await getProject(projectMatch[1]);
      if (!project) return notFound(res);

      if (req.method === "DELETE") {
        const summary = await deleteProject(project.id);
        json(res, 200, { ok: true, project: summary });
        return;
      }

      if (req.method === "PATCH") {
        const body = await readBody(req, 128 * 1024);
        let changed = false;
        if ("name" in body) {
          const name = String(body.name || "").trim().slice(0, 80);
          if (!name) {
            json(res, 400, { error: "name_required" });
            return;
          }
          project.name = name;
          changed = true;
        }
        if ("workspaceRoot" in body) {
          project.workspaceRoot = await validateWorkspaceFolder(body.workspaceRoot);
          project.workspaceReady = true;
          project.selectedFolderPath = project.workspaceRoot;
          project.selectedFolderName = folderNameFromWorkspace(project.workspaceRoot);
          project.projectType = "folder";
          if ((project.name === "新しいチャット" || project.name === "Untitled Project") && project.selectedFolderName) {
            project.name = project.selectedFolderName;
          }
          changed = true;
        }
        if ("mode" in body) {
          project.mode = normalizeChatMode(body.mode);
          changed = true;
        }
        if ("accessLevel" in body) {
          project.accessLevel = normalizeAccessLevel(body.accessLevel);
          project.codex = normalizeCodexState(project);
          project.codex.permissions = codexPermissionForAccess(project.accessLevel);
          changed = true;
        }
        if ("selectedFolderPath" in body) {
          project.selectedFolderPath = String(body.selectedFolderPath || "").slice(0, 1000);
          project.selectedFolderName = folderNameFromWorkspace(project.selectedFolderPath);
          project.projectType = project.selectedFolderPath ? "folder" : "general";
          changed = true;
        }
        if ("projectType" in body) {
          const type = String(body.projectType || "general");
          project.projectType = type === "folder" ? "folder" : "general";
          changed = true;
        }
        if (!changed) {
          json(res, 400, { error: "project_patch_required" });
          return;
        }
        await saveProject(project);
        json(res, 200, { project, summary: projectSummary(project) });
        return;
      }

      if (req.method === "GET") {
        json(res, 200, { project });
        return;
      }
    }

    if (req.method === "POST" && url.pathname === "/api/chat/stream") {
      await chatStream(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/chat/simple/stream") {
      await companyChatStream(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/execute/javascript") {
      await executeJavaScript(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/execute/shell") {
      await executeShell(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/computer/action") {
      await executeComputerAction(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/network/fetch") {
      await executeNetworkFetch(req, res);
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(url, res, req.method);
      return;
    }

    notFound(res);
  } catch (error) {
    json(res, error.status || (error.message === "request_too_large" ? 413 : 500), {
      error: error.message,
      code: error.code || ""
    });
  }
}

await ensureData();

const server = http.createServer(route);
server.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" || HOST === "::" ? "localhost" : HOST;
  console.log(`Nexa running at http://${displayHost}:${PORT}`);
  console.log(`Ollama endpoint: ${OLLAMA_URL}`);
  console.log(`Workspace root: ${WORKSPACE_ROOT}`);
});
