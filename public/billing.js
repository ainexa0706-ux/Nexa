const fallbackPlans = [
  {
    id: "free",
    name: "Nexa 無料",
    priceJpy: 0,
    period: "month",
    tagline: "個人で試せる無料プラン",
    features: ["ローカルAIチャット", "プロジェクト履歴", "基本的なファイル添付"],
    checkoutReady: false,
    stripeConfigured: true
  },
  {
    id: "plus",
    name: "Nexa プラス",
    priceJpy: 980,
    period: "month",
    tagline: "日常利用にちょうどいい軽量プラン",
    features: ["長期記憶の強化", "生成結果の保存枠アップ", "優先的なローカル実行キュー"],
    checkoutReady: false,
    stripeConfigured: false
  },
  {
    id: "pro",
    name: "Nexa プロ",
    priceJpy: 1980,
    period: "month",
    recommended: true,
    tagline: "開発、調査、コード生成まで使う人向け",
    features: ["コードモード強化", "AIチームログ", "高度なワークスペース操作", "優先サポート"],
    checkoutReady: false,
    stripeConfigured: false
  },
  {
    id: "studio",
    name: "Nexa スタジオ",
    priceJpy: 4980,
    period: "month",
    tagline: "配布や本格運用を見据えた制作者向け",
    features: ["大きなプロジェクト履歴", "管理者向け機能", "将来のチーム機能優先対応"],
    checkoutReady: false,
    stripeConfigured: false
  }
];

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
  if (!response.ok) {
    const error = new Error(payload.error || response.statusText);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function yen(value) {
  return new Intl.NumberFormat("ja-JP").format(Number(value || 0));
}

function planLabel(planId = "free") {
  return {
    free: "無料",
    plus: "プラス",
    pro: "プロ",
    studio: "スタジオ"
  }[planId] || planId;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function planButton(plan, currentPlan) {
  if (plan.id === "free") {
    return `<button class="secondary plan-checkout" type="button" disabled>無料プラン</button>`;
  }
  if (plan.id === currentPlan) {
    return `<button class="secondary plan-checkout" type="button" disabled>現在のプラン</button>`;
  }
  if (!plan.checkoutReady) {
    return `<button class="secondary plan-checkout" type="button" disabled>Stripe設定待ち</button>`;
  }
  return `<button class="primary plan-checkout" type="button" data-plan-id="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}を選ぶ</button>`;
}

function renderPlans(plans = fallbackPlans, currentPlan = "free") {
  const target = $("#plans");
  if (!target) return;
  target.innerHTML = plans.map((plan) => `
    <article class="card pricing-card ${plan.recommended ? "is-recommended" : ""}">
      <div class="pricing-head">
        <span>${plan.recommended ? "おすすめ" : escapeHtml(planLabel(plan.id))}</span>
        <h2>${escapeHtml(plan.name)}</h2>
        <p>${escapeHtml(plan.tagline || "")}</p>
      </div>
      <div class="price">
        <strong>¥${yen(plan.priceJpy)}</strong>
        <small>/ 月</small>
      </div>
      <ul>
        ${(plan.features || []).map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}
      </ul>
      ${planButton(plan, currentPlan)}
      <small class="plan-note">${plan.stripeConfigured ? "決済設定済み" : "このプランのPrice IDを.envに入れると有効化"}</small>
    </article>
  `).join("");
}

function renderSetup(data) {
  const target = $("#setupList");
  if (!target) return;
  const priceRows = Object.entries(data.requiredEnv?.prices || {
    plus: "STRIPE_PLUS_PRICE_ID",
    pro: "STRIPE_PRO_PRICE_ID",
    studio: "STRIPE_STUDIO_PRICE_ID"
  });
  target.innerHTML = [
    ["STRIPE_SECRET_KEY", data.stripeConfigured ? "設定済み" : "未設定"],
    ...priceRows.map(([plan, envName]) => [
      envName,
      (data.plans || []).find((item) => item.id === plan)?.stripeConfigured ? "設定済み" : "未設定"
    ]),
    ["STRIPE_WEBHOOK_SECRET", "本番Webhookで必須"]
  ].map(([name, status]) => `<li><code>${escapeHtml(name)}</code><span>${escapeHtml(status)}</span></li>`).join("");
}

async function refresh() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  if (status === "success") $("#billingStatus").textContent = "課金手続きが完了しました。Webhook反映後に更新されます。";
  if (status === "cancel") $("#billingStatus").textContent = "課金手続きをキャンセルしました。";

  try {
    const data = await api("/api/billing/status");
    renderPlans(data.plans || fallbackPlans, data.plan || "free");
    renderSetup(data);
    if (!status) {
      $("#billingStatus").textContent = data.authenticated
        ? `${data.user?.email || "ログイン中"} / 現在のプラン: ${planLabel(data.plan || "free")}`
        : "未ログインです。プラン内容は確認できます。決済するにはログインしてください。";
    }
    $("#checkoutHint").textContent = data.checkoutReady
      ? "Stripe決済を利用できます。"
      : data.authenticated
      ? "StripeキーとPrice IDを.envに設定すると、有料プランのボタンが有効になります。"
      : "有料プランを選ぶにはログインしてください。";
  } catch (error) {
    renderPlans(fallbackPlans);
    $("#billingStatus").textContent = "プランを見るにはログインしてください。";
    $("#checkoutHint").innerHTML = `<a href="/auth">ログインページを開く</a>`;
  }
}

$("#plans")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-plan-id]");
  if (!button) return;
  const planId = button.dataset.planId;
  button.disabled = true;
  $("#checkoutHint").textContent = "決済画面を準備中...";
  try {
    const result = await api("/api/billing/checkout", { method: "POST", body: { planId } });
    if (result.url) window.location.href = result.url;
  } catch (error) {
    button.disabled = false;
    $("#checkoutHint").textContent = error.payload?.setup || error.message;
  }
});

renderPlans(fallbackPlans);
refresh();
