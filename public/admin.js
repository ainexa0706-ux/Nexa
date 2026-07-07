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

function userRow(user, plans = [], ownerUserId = "") {
  const isOwner = user.id === ownerUserId || user.role === "admin";
  const banned = ["banned", "disabled"].includes(user.status);
  return `
    <div class="row user-admin-row">
      <div>
        <strong>${escapeHtml(user.email)}${isOwner ? " / Owner" : ""}</strong>
        <small>${escapeHtml(user.name || "")} / ${escapeHtml(user.role)} / ${escapeHtml(user.plan)} / ${escapeHtml(user.status)}</small>
      </div>
      <div class="row-actions">
        <select data-user-plan="${escapeHtml(user.id)}" ${isOwner ? "disabled" : ""}>
          ${plans.map((plan) => `<option value="${escapeHtml(plan.id)}" ${user.plan === plan.id ? "selected" : ""}>${escapeHtml(plan.name)}</option>`).join("")}
        </select>
        <button class="${banned ? "secondary" : "danger"}" type="button" data-user-status="${escapeHtml(user.id)}" data-next-status="${banned ? "active" : "banned"}" ${isOwner ? "disabled" : ""}>
          ${banned ? "BAN解除" : "BAN"}
        </button>
      </div>
    </div>
  `;
}

function billingRow(event) {
  return `
    <div class="row">
      <div>
        <strong>${escapeHtml(event.type || "event")}</strong>
        <small>${escapeHtml(event.id || "")}</small>
      </div>
      <small>${escapeHtml(event.createdAt || "")}</small>
    </div>
  `;
}

async function refresh() {
  const overview = await api("/api/admin/overview");
  $("#adminStatus").textContent = overview.stripeConfigured
    ? "Stripe is configured. Checkout and webhook verification are ready."
    : "Stripe setup needed: set STRIPE_SECRET_KEY, plan Price IDs, and STRIPE_WEBHOOK_SECRET.";
  $("#metrics").innerHTML = [
    metric("Users", overview.users),
    metric("Active users", overview.activeUsers),
    metric("Banned users", overview.bannedUsers),
    metric("Pro users", overview.proUsers),
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
  if (!select) return;
  await api(`/api/admin/users/${encodeURIComponent(select.dataset.userPlan)}`, {
    method: "PATCH",
    body: { plan: select.value }
  });
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
