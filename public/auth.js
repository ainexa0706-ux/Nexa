const state = {
  tab: "login",
  user: null,
  providers: [],
  setupRequired: false
};

const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: options.body ? { "content-type": "application/json" } : undefined,
    credentials: "same-origin",
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.error || response.statusText);
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

function planLabel(planId = "free") {
  return {
    free: "無料",
    plus: "プラス",
    pro: "プロ",
    studio: "スタジオ"
  }[planId] || planId;
}

function roleLabel(role = "user") {
  return role === "admin" ? "管理者" : "ユーザー";
}

function setStatus(message, error = false) {
  const el = $("#authStatus");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("is-error", error);
}

function providerById(id) {
  return (state.providers || []).find((provider) => provider.id === id) || null;
}

function runningInElectron() {
  return /Electron/i.test(navigator.userAgent || "");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startDesktopGoogleLogin(google) {
  const button = $("#googleLoginButton");
  setStatus("Googleログインをブラウザで開いています...");
  if (button) button.disabled = true;
  try {
    const started = await api(google.desktopStartUrl || "/api/auth/google/desktop/start", {
      method: "POST",
      body: {}
    });
    if (!started.url || !started.state) throw new Error("desktop_oauth_start_failed");
    window.open(started.url, "_blank", "noopener");
    setStatus("ブラウザでGoogleログインを完了してください。Nexaが自動で続行します。");
    const deadline = Date.now() + 2 * 60 * 1000;
    while (Date.now() < deadline) {
      await wait(1200);
      const result = await api(`/api/auth/google/desktop/poll?state=${encodeURIComponent(started.state)}`);
      if (result.status === "pending") continue;
      if (result.status === "complete") {
        state.user = result.user || null;
        setStatus("Googleでログインしました。");
        await refresh();
        return;
      }
      throw new Error(result.error || "google_login_failed");
    }
    throw new Error("google_login_timeout");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    if (button) button.disabled = false;
  }
}

function consumeRedirectStatus() {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get("auth");
  const authError = params.get("auth_error");
  if (!auth && !authError) return;
  params.delete("auth");
  params.delete("auth_error");
  const nextSearch = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
  if (authError) setStatus(`Googleログインエラー: ${authError}`, true);
  if (auth === "google") setStatus("Googleでログインしました。");
}

function renderTabs() {
  if (!state.user && state.setupRequired) state.tab = "register";
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === state.tab);
  });
  const registering = state.tab === "register";
  $("#nameInput")?.parentElement?.classList.toggle("hidden", !registering);
  if ($("#authSubmit")) $("#authSubmit").textContent = registering ? "登録して開始" : "ログイン";
  if ($("#passwordInput")) $("#passwordInput").autocomplete = registering ? "new-password" : "current-password";
}

function renderProviders() {
  const google = providerById("google");
  const configured = Boolean(google?.configured);
  if ($("#googleLoginButton")) {
    $("#googleLoginButton").disabled = !configured;
    $("#googleLoginButton").classList.toggle("is-disabled", !configured);
  }
  if ($("#googleLoginHint")) {
    $("#googleLoginHint").textContent = configured
      ? "Googleアカウントでログインできます。"
      : "Googleログインはまだサーバー側で設定されていません。";
  }
}

function renderAccount() {
  const loggedIn = Boolean(state.user);
  $("#authCard")?.classList.toggle("hidden", loggedIn);
  $("#accountPanel")?.classList.toggle("hidden", !loggedIn);
  if (!loggedIn) return;
  $("#userLabel").textContent = `${state.user.name || state.user.email} / ${roleLabel(state.user.role)}`;
  $("#planLabel").textContent = `プラン: ${planLabel(state.user.plan || "free")} ${state.user.subscriptionStatus || ""}`.trim();
  $("#adminLinkRow")?.classList.toggle("hidden", state.user.role !== "admin");
}

async function refresh() {
  const me = await api("/api/auth/me");
  state.user = me.user || null;
  state.providers = me.providers || [];
  state.setupRequired = Boolean(me.setupRequired);
  renderTabs();
  renderProviders();
  renderAccount();
  if (!state.user && state.setupRequired) {
    setStatus("最初のアカウントを登録すると、このPCのNexa管理者になります。");
  }
}

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    state.tab = button.dataset.tab;
    setStatus("");
    renderTabs();
  });
});

$("#authForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const body = {
      name: $("#nameInput")?.value || "",
      email: $("#emailInput")?.value || "",
      password: $("#passwordInput")?.value || ""
    };
    const path = state.tab === "login" ? "/api/auth/login" : "/api/auth/register";
    const result = await api(path, { method: "POST", body });
    state.user = result.user;
    if ($("#passwordInput")) $("#passwordInput").value = "";
    setStatus(result.firstUser ? "管理者アカウントを作成しました。" : "ログインしました。");
    await refresh();
  } catch (error) {
    setStatus(error.message, true);
  }
});

$("#googleLoginButton")?.addEventListener("click", () => {
  const google = providerById("google");
  if (!google?.configured) {
    setStatus("Googleログインはまだサーバー側で設定されていません。", true);
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

$("#logoutButton")?.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST", body: {} });
  } catch {
    // セッションがすでに切れていてもUIはログアウト扱いにする。
  }
  state.user = null;
  setStatus("ログアウトしました。もう一度Googleでログインできます。");
  await refresh();
});

consumeRedirectStatus();
renderTabs();
renderProviders();
refresh().catch((error) => setStatus(error.message, true));
