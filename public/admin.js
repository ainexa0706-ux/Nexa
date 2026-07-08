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

function metric(title, value) {
  return `<div class="card metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(title)}</span></div>`;
}

function numberLabel(value) {
  return new Intl.NumberFormat("ja-JP").format(Number(value || 0));
}

function creditLabel(credits = {}) {
  if (credits.unlimited) return `無制限 / ${numberLabel(credits.used)} 使用済み`;
  return `残り ${numberLabel(credits.remaining)} / ${numberLabel(credits.total)}（追加 ${numberLabel(credits.bonus)}）`;
}

function userRow(user, plans = [], ownerUserId = "") {
  const isOwner = user.id === ownerUserId || user.role === "admin";
  const banned = ["banned", "disabled"].includes(user.status);
  const credits = user.credits || {};
  return `
    <div class="row user-admin-row">
      <div>
        <strong>${escapeHtml(user.email)}${isOwner ? " / 所有者" : ""}</strong>
        <small>${escapeHtml(user.name || "")} / ${escapeHtml(user.role)} / ${escapeHtml(user.plan)} / ${escapeHtml(user.status)}</small>
        <small>クレジット: ${escapeHtml(creditLabel(credits))}</small>
      </div>
      <div class="row-actions">
        <select data-user-plan="${escapeHtml(user.id)}" ${isOwner ? "disabled" : ""}>
          ${plans.map((plan) => `<option value="${escapeHtml(plan.id)}" ${user.plan === plan.id ? "selected" : ""}>${escapeHtml(plan.name)}</option>`).join("")}
        </select>
        <label class="mini-admin-field">
          追加
          <input type="number" min="0" step="1" value="${escapeHtml(credits.bonus || 0)}" data-user-bonus-credits="${escapeHtml(user.id)}" ${isOwner ? "disabled" : ""} />
        </label>
        <label class="mini-admin-field">
          使用済み
          <input type="number" min="0" step="1" value="${escapeHtml(credits.used || 0)}" data-user-used-credits="${escapeHtml(user.id)}" ${isOwner ? "disabled" : ""} />
        </label>
        <button class="${banned ? "secondary" : "danger"}" type="button" data-user-status="${escapeHtml(user.id)}" data-next-status="${banned ? "active" : "banned"}" ${isOwner ? "disabled" : ""}>
          ${banned ? "BAN解除" : "BAN"}
        </button>
      </div>
    </div>
  `;
}

function billingRow(event) {
  const detail = event.credits
    ? `${numberLabel(event.credits)} credits / ${event.reason || ""}`
    : event.planId || "";
  return `
    <div class="row">
      <div>
        <strong>${escapeHtml(event.type || "event")}</strong>
        <small>${escapeHtml([event.id || "", detail].filter(Boolean).join(" / "))}</small>
      </div>
      <small>${escapeHtml(event.createdAt || "")}</small>
    </div>
  `;
}

async function refresh() {
  const overview = await api("/api/admin/overview");
  $("#adminStatus").textContent = overview.stripeConfigured
    ? "Stripe設定済みです。CheckoutとWebhook検証を利用できます。"
    : "Stripe設定待ちです。STRIPE_SECRET_KEY、Price ID、STRIPE_WEBHOOK_SECRETを設定してください。";
  $("#metrics").innerHTML = [
    metric("ユーザー", overview.users),
    metric("有効ユーザー", overview.activeUsers),
    metric("BAN中", overview.bannedUsers),
    metric("Proユーザー", overview.proUsers),
    metric("使用済みクレジット", numberLabel(overview.creditUsed || 0)),
    metric("Stripe", overview.stripeConfigured ? "ready" : "setup needed")
  ].join("");

  const users = await api("/api/admin/users");
  $("#usersList").innerHTML = users.users.length
    ? users.users.map((user) => userRow(user, overview.plans || [], overview.ownerUserId)).join("")
    : `<p class="status">ユーザーはいません。</p>`;

  const billing = await api("/api/admin/billing");
  $("#billingList").innerHTML = billing.events.length
    ? billing.events.map(billingRow).join("")
    : `<p class="status">課金イベントはまだありません。</p>`;
}

$("#usersList")?.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-user-plan]");
  const bonus = event.target.closest("[data-user-bonus-credits]");
  const used = event.target.closest("[data-user-used-credits]");
  if (select) {
    await api(`/api/admin/users/${encodeURIComponent(select.dataset.userPlan)}`, {
      method: "PATCH",
      body: { plan: select.value }
    });
  } else if (bonus) {
    await api(`/api/admin/users/${encodeURIComponent(bonus.dataset.userBonusCredits)}`, {
      method: "PATCH",
      body: { bonusCredits: Number(bonus.value || 0) }
    });
  } else if (used) {
    await api(`/api/admin/users/${encodeURIComponent(used.dataset.userUsedCredits)}`, {
      method: "PATCH",
      body: { creditsUsed: Number(used.value || 0) }
    });
  } else {
    return;
  }
  await refresh();
});

$("#usersList")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-user-status]");
  if (!button) return;
  const next = button.dataset.nextStatus;
  const ok = next === "banned"
    ? confirm("このユーザーをBANしますか？ログインできなくなります。")
    : confirm("このユーザーのBANを解除しますか？");
  if (!ok) return;
  await api(`/api/admin/users/${encodeURIComponent(button.dataset.userStatus)}`, {
    method: "PATCH",
    body: { status: next }
  });
  await refresh();
});

refresh().catch((error) => {
  $("#adminStatus").textContent = ["admin_required", "login_required"].includes(error.message)
    ? "所有者アカウントでログインしてください。"
    : error.message;
});
