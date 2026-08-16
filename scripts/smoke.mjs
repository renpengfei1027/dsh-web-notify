/**
 * Runtime smoke test for the dsh-web-notify client bundle.
 *
 * Stubs the browser (window/document/navigator/MutationObserver), the module
 * loader, react, react-dom/client, and a fake `sessions` service, then drives
 * the sentinel through: baseline seed (no fire), transition fire, no re-fire
 * while pending, resolution cleanup, cooldown/replay dedupe, kind filtering,
 * and toast portal mount/unmount.
 *
 * Run: node scripts/smoke.mjs   (asserts throw on failure)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(here, "..", "lib", "client.js");
const source = readFileSync(bundlePath, "utf8");

// --- browser stubs ---------------------------------------------------------
const titleEl = { textContent: "HARNESS" };
function makeEl(tag) {
  return {
    tagName: tag,
    textContent: "",
    style: {},
    id: "",
    children: [],
    childNodes: [],
    remove() {
      documents.body.children = documents.body.children.filter((c) => c !== this);
    }
  };
}
const documents = {
  head: {
    children: [],
    appendChild(el) { this.children.push(el); }
  },
  body: {
    children: [],
    appendChild(el) { this.children.push(el); }
  },
  querySelector: (sel) => (sel === "title" ? titleEl : null),
  contains: () => true,
  createElement: makeEl,
  getElementById: (id) => documents.body.children.find((el) => el.id === id) ?? null,
  title: "HARNESS",
  visibilityState: "visible"
};
let factory = null;
globalThis.window = {
  AudioContext: undefined,
  webkitAudioContext: undefined,
  addEventListener: () => {},
  removeEventListener: () => {},
  __ModuleLoader__: { load: (entry) => { factory = entry.factory; } }
};
globalThis.document = documents;
// Node 26 ships a read-only global navigator; its .language is fine for the bundle.
globalThis.MutationObserver = class {
  constructor(cb) { this.cb = cb; }
  observe() {}
  disconnect() {}
};
// --- Notification stub (captures last constructed notification) -------------
const notifLog = [];
const NotifCtor = class {
  constructor(title, opts) {
    this.title = title;
    this.body = opts?.body ?? "";
    this.tag = opts?.tag ?? "";
    this.requireInteraction = opts?.requireInteraction === true;
    this.silent = opts?.silent === true;
    this._onclick = null;
    notifLog.push(this);
  }
  close() {}
  get onclick() { return this._onclick; }
  set onclick(fn) { this._onclick = fn; }
};
Object.defineProperty(NotifCtor, "permission", {
  get: () => "granted",
  configurable: true,
});
NotifCtor.requestPermission = () => Promise.resolve("granted");
// Bundle code checks `'Notification' in window` — must live on the window object.
globalThis.Notification = NotifCtor;
globalThis.window.Notification = NotifCtor;
// --- module loader + stubs -------------------------------------------------

const react = {
  Fragment: { $$typeof: Symbol.for("react.fragment") },
  useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
  useState: (init) => [typeof init === "function" ? init() : init, () => {}],
  useEffect: () => {}
};
const reactDomClient = { createRoot: () => ({ render: () => {}, unmount: () => {} }) };
const requireStub = (spec) => {
  if (spec === "react") return react;
  if (spec === "react/jsx-runtime") return { jsx: (...a) => ({ kind: "jsx", a }), jsxs: (...a) => ({ kind: "jsxs", a }) };
  if (spec === "react-dom/client") return reactDomClient;
  throw new Error(`unexpected require(${spec})`);
};

new Function("window", source)(globalThis.window);
if (factory === null) throw new Error("bundle did not register a factory");
const bundle = factory(requireStub);

// --- fake sessions service + controllable list store -----------------------
function createFakeList() {
  let snapshot = { ids: [], byId: {} };
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    _set(next) { snapshot = next; for (const fn of [...listeners]) fn(); }
  };
}

function makeCtx(list, opened, extra = {}) {
  const sessions = { list, open: (id) => opened.push(id) };
  const disposers = [];
  return {
    get: (name) => (name === "sessions" ? sessions : extra[name] !== void 0 ? extra[name] : void 0),
    locale: { register: () => ({}) },
    effect: (fn) => { const d = fn(); if (typeof d === "function") disposers.push(d); return d ?? (() => {}); },
    _disposeAll() { for (const d of disposers.reverse()) d(); }
  };
}

function row(id, interaction, title, extra = {}) {
  return {
    id, sessionId: id, displayTitle: title ?? `会话${id}`,
    pendingInteraction: interaction, running: false, blank: false, updatedAt: 0,
    ...extra
  };
}

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function assert(cond, label) {
  if (cond) console.log(`  ok  ${label}`);
  else { failures += 1; console.error(`FAIL  ${label}`); }
}
function setRows(list, ids, opts = {}) {
  const byId = {};
  for (const r of ids) byId[r.id] = r;
  list._set({
    ids: ids.map((r) => r.id),
    byId,
    current: opts.current,
    jobsBySession: opts.jobsBySession ?? {}
  });
}

/** Capture the toast store the portal would receive (react is not actually rendered). */
function captureToastStore() {
  const original = reactDomClient.createRoot;
  reactDomClient.createRoot = (el) => {
    const handle = { el, render: (v) => { handle.view = v; }, unmount: () => {} };
    reactDomClient.__last = handle;
    return handle;
  };
  return {
    store: () => reactDomClient.__last?.view?.a?.[1]?.store,
    restore: () => { reactDomClient.createRoot = original; }
  };
}

// scenario 1: baseline never fires; transitions fire; resolution settles.
{
  console.log("\n[scenario 1] baseline + transitions (visual channels off except toast)");
  const list = createFakeList();
  const opened = [];
  const ctx = makeCtx(list, opened);
  bundle.apply(ctx, { sound: false, toast: true, badge: false, notify: false, dock: false, cooldownMs: 5000 });
  setRows(list, []);
  await tick();
  // a session already pending when the page loads must NOT alert
  setRows(list, [row("s1", "approval")]);
  await tick();
  assert(opened.length === 0, "baseline pending approval does not alert");
  // a new approval arriving fires (toast pushed; nothing observable outside store, no crash)
  setRows(list, [row("s1", "approval"), row("s2", "approval")]);
  await tick();
  setRows(list, [row("s2", "approval")]);
  await tick();
  setRows(list, []);
  await tick();
  assert(true, "resolution path runs without error");
  ctx._disposeAll();
  assert(documents.body.children.length === 0, "toast portal cleaned up on dispose");
}

// scenario 2: title badge — count, kind filtering, replay suppression.
{
  console.log("\n[scenario 2] title badge lifecycle");
  const list = createFakeList();
  const opened = [];
  const ctx = makeCtx(list, opened);
  bundle.apply(ctx, { sound: false, toast: false, badge: true, notify: false, dock: false, cooldownMs: 5000 });
  setRows(list, []);
  await tick();
  setRows(list, [row("a1", "approval")]);
  await tick();
  const badged = titleEl.textContent;
  assert(badged.startsWith("⚠ 1 待审批 — "), `badge shows count 1 after fire (got "${badged}")`);
  // still pending -> no change
  setRows(list, [row("a1", "approval")]);
  await tick();
  assert(titleEl.textContent === badged, "no re-fire while the same approval stays pending");
  // approval resolved -> badge cleared
  setRows(list, []);
  await tick();
  assert(titleEl.textContent === "HARNESS", "badge cleared after resolution");
  // reconnect replay re-adds the same approval: no new alert (cooldown) but the
  // live count restores the badge
  setRows(list, [row("a1", "approval")]);
  await tick();
  assert(titleEl.textContent.startsWith("⚠ 1 "), "badge restores from live count after replay (no double alert)");
  // plan-review fires too
  setRows(list, [row("a1", "approval"), row("p1", "plan-review")]);
  await tick();
  assert(titleEl.textContent.startsWith("⚠ 2 "), "plan-review kind also alerts (count 2)");
  // question also alerts under the current default alertKinds
  setRows(list, [row("a1", "approval"), row("p1", "plan-review"), row("q1", "question")]);
  await tick();
  assert(titleEl.textContent.startsWith("⚠ 3 "), "question kind alerts too (count 3)");
  // everything resolved -> cleared
  setRows(list, []);
  await tick();
  assert(titleEl.textContent === "HARNESS", "badge fully cleared");
  ctx._disposeAll();
}

// scenario 3: toast portal mounts and go-action navigation wiring.
{
  console.log("\n[scenario 3] toast portal mount/unmount");
  const list = createFakeList();
  const opened = [];
  const ctx = makeCtx(list, opened);
  let mounted = null;
  const original = reactDomClient.createRoot;
  reactDomClient.createRoot = (el) => {
    mounted = { el, render: (v) => { mounted.view = v; }, unmount: () => {} };
    return mounted;
  };
  try {
    bundle.apply(ctx, { sound: false, toast: true, badge: false, notify: false, dock: false, cooldownMs: 0 });
    setRows(list, []);
    await tick();
    setRows(list, [row("t1", "approval")]);
    await tick();
    assert(mounted !== null && mounted.view !== null && mounted.view.kind === "jsx", "toast portal renders a React tree");
    assert(mounted.view.a[1].store.getSnapshot().length === 0, "pending approval does not push a toast (dock owns it)");
    ctx._disposeAll();
    assert(documents.body.children.length === 0, "portal root removed after dispose");
  } finally {
    reactDomClient.createRoot = original;
  }
}

// scenario 4: approval hub dock — live projection, go-action, dispose cleanup.
{
  console.log("\n[scenario 4] approval hub dock lifecycle");
  const list = createFakeList();
  const opened = [];
  const ctx = makeCtx(list, opened);
  const mounts = [];
  const original = reactDomClient.createRoot;
  reactDomClient.createRoot = (el) => {
    const handle = { el, render: (v) => { handle.view = v; }, unmount: () => {} };
    mounts.push(handle);
    return handle;
  };
  try {
    bundle.apply(ctx, { sound: false, toast: false, badge: false, notify: false, dock: true, cooldownMs: 0 });
    setRows(list, []);
    await tick();
    const dockRoot = mounts.find((m) => m.el.id === "dsh-web-notify-dock-root");
    assert(dockRoot !== void 0, "dock portal root created");
    assert(dockRoot.view !== null && dockRoot.view.a[0].name === "DockPanel", "dock root renders DockPanel");
    assert(typeof dockRoot.view.a[1].onGo === "function", "dock exposes go action");
    // live projection feeds pending rows regardless of cooldown
    setRows(list, [row("d1", "approval"), row("d2", "question")]);
    await tick();
    assert(dockRoot.view !== null && dockRoot.view.kind === "jsx", "hub stays rendered with pending rows");
    assert(dockRoot.view.a[1].store.getSnapshot().pulse >= 1, "dock store pulses on pending arrival");
    // jump wiring navigates to the session
    dockRoot.view.a[1].onGo({ sessionId: "d1" });
    assert(opened.length === 1 && opened[0] === "d1", "dock go opens the session");
    ctx._disposeAll();
    assert(documents.body.children.length === 0, "dock portal root removed after dispose");
  } finally {
    reactDomClient.createRoot = original;
  }
}

// scenario 5: completion + job-failure lifecycle (baseline-seeded edges).
{
  console.log("\n[scenario 5] completion + job failure lifecycle");
  const list = createFakeList();
  const opened = [];
  const ctx = makeCtx(list, opened);
  const toast = captureToastStore();
  try {
    // completion already true before the page loads -> baseline must suppress it
    setRows(list, [row("c1", void 0, "C1", { completed: true })], { current: "other" });
    bundle.apply(ctx, { sound: false, toast: true, badge: false, notify: false, dock: false, cooldownMs: 5000 });
    await tick();
    assert(toast.store() !== void 0, "toast store captured");
    assert(toast.store().getSnapshot().length === 0, "baseline completed session does not alert");
    // new completion edge (not current) -> completion toast
    setRows(list, [
      row("c1", void 0, "C1", { completed: true }),
      row("c2", void 0, "C2", { completed: true })
    ], { current: "other" });
    await tick();
    const items = toast.store().getSnapshot();
    const completionItem = items.find((i) => i.key === "completion:c2");
    assert(completionItem !== void 0 && completionItem.kindLabel === "任务完成", "completion edge pushes a toast");
    // same session completing while it IS current -> suppressed
    setRows(list, [
      row("c1", void 0, "C1", { completed: true }),
      row("c2", void 0, "C2", { completed: true }),
      row("c3", void 0, "C3", { completed: true })
    ], { current: "c3" });
    await tick();
    assert(toast.store().getSnapshot().some((i) => i.key === "completion:c3") === false, "current-session completion is silenced");
    // page hidden -> even the CURRENT session's completion alerts (you cannot see it)
    documents.visibilityState = "hidden";
    documents.title = "HARNESS";
    setRows(list, [
      row("c1", void 0, "C1", { completed: true }),
      row("c2", void 0, "C2", { completed: true }),
      row("c3", void 0, "C3", { completed: true }),
      row("c4", void 0, "C4", { completed: true })
    ], { current: "c4" });
    await tick();
    assert(!toast.store().getSnapshot().some((i) => i.key === "completion:c4"), "hidden completion: no corner card");
    assert(documents.title.startsWith("✓ "), "hidden completion pulses the tab title");
    documents.visibilityState = "visible";
    documents.title = "HARNESS";
    // job failure: baseline running never fires; failed fires once per job id
    setRows(list, [], { jobsBySession: {} });
    setRows(list, [], {
      jobsBySession: { s5: [{ id: "bash-1", kind: "pwsh", label: "npm test", status: "running", startedAt: 0 }] }
    });
    await tick();
    assert(toast.store().getSnapshot().some((i) => i.key === "jobfail:bash-1") === false, "running job does not alert");
    setRows(list, [], {
      jobsBySession: { s5: [{ id: "bash-1", kind: "pwsh", label: "npm test", status: "failed", detail: "exit code: 1", startedAt: 0 }] }
    });
    await tick();
    const failed = toast.store().getSnapshot().find((i) => i.key === "jobfail:bash-1");
    assert(failed !== void 0 && (failed.body ?? "").includes("npm test"), "failed job alerts with label");
    // replay re-sends the failed job -> never re-alerts the same job id
    setRows(list, [], {
      jobsBySession: { s5: [{ id: "bash-1", kind: "pwsh", label: "npm test", status: "failed", detail: "exit code: 1", startedAt: 0 }] }
    });
    await tick();
    assert(toast.store().getSnapshot().filter((i) => i.key === "jobfail:bash-1").length === 1, "failed job alerts only once");
    // killed job (interruption-shaped exit) also alerts — host status mapping
    // for a non-zero exit can land on 'killed' instead of 'failed'
    setRows(list, [], {
      jobsBySession: { s5: [{ id: "bash-2", kind: "pwsh", label: "kill me", status: "killed", detail: "exit code: 1", startedAt: 0 }] }
    });
    await tick();
    const killed = toast.store().getSnapshot().find((i) => i.key === "jobfail:bash-2");
    assert(killed !== void 0 && (killed.body ?? "").includes("kill me"), "killed job alerts like a failure");
    // completed-with-anomalous-detail also alerts (host reports "exit code: 7"
    // as status 'completed'; the failure lives in detail)
    setRows(list, [], {
      jobsBySession: { s5: [{ id: "bash-3", kind: "pwsh", label: "exit 7 hidden", status: "completed", detail: "exit code: 7", startedAt: 0 }] }
    });
    await tick();
    const hiddenFail = toast.store().getSnapshot().find((i) => i.key === "jobfail:bash-3");
    assert(hiddenFail !== void 0 && (hiddenFail.body ?? "").includes("exit 7 hidden"), "completed+exit-7 detail alerts");
    // clean completions never alert (no detail, or explicit exit code: 0)
    setRows(list, [], {
      jobsBySession: { s5: [{ id: "bash-4", kind: "pwsh", label: "clean ok", status: "completed", detail: "exit code: 0", startedAt: 0 }, { id: "bash-5", kind: "pwsh", label: "plain ok", status: "completed", startedAt: 0 }] }
    });
    await tick();
    assert(toast.store().getSnapshot().filter((i) => i.key === "jobfail:bash-4").length === 0, "completed exit 0 does not alert");
    assert(toast.store().getSnapshot().filter((i) => i.key === "jobfail:bash-5").length === 0, "completed w/o detail does not alert");
    ctx._disposeAll();
    assert(documents.body.children.length === 0, "toast portal cleaned up on dispose");
  } finally {
    toast.restore();
  }
}

// scenario 6: connection enter/exit via the shared HostDescription source.
{
  console.log("\n[scenario 6] connection monitor");
  const list = createFakeList();
  const opened = [];
  let desc = void 0;
  const connListeners = new Set();
  const conn = {
    hostDescription: {
      getSnapshot: () => desc,
      subscribe: (fn) => { connListeners.add(fn); return () => connListeners.delete(fn); }
    }
  };
  const ctx = makeCtx(list, opened, { connection: conn });
  const toast = captureToastStore();
  try {
    bundle.apply(ctx, { sound: false, toast: true, badge: false, notify: false, dock: false, connection: true, connectionAlertAfterMs: 800 });
    setRows(list, []);
    await tick();
    assert(toast.store() !== void 0, "toast store captured");
    // never-connected boot: loss of an empty snapshot is a boot, not an outage
    desc = { host: "boot" };
    for (const fn of connListeners) fn();
    await tick();
    assert(toast.store().getSnapshot().length === 0, "boot connect does not alert");
    // connected -> down: alert appears once the threshold passes
    desc = void 0;
    for (const fn of connListeners) fn();
    await tick(50);
    assert(toast.store().getSnapshot().some((i) => i.key === "conn:down") === false, "no alert before threshold");
    await tick(1000);
    assert(toast.store().getSnapshot().some((i) => i.key === "conn:down"), "connection lost alerts after threshold");
    // restored -> light cue
    desc = { host: "back" };
    for (const fn of connListeners) fn();
    await tick();
    assert(toast.store().getSnapshot().some((i) => i.key === "conn:up"), "reconnect cues a restored toast");
    // quick blip (below threshold): no down alert, and the restore stays silent too
    const upCountBefore = toast.store().getSnapshot().filter((i) => i.key === "conn:up").length;
    desc = void 0;
    for (const fn of connListeners) fn();
    await tick(50);
    desc = { host: "blip" };
    for (const fn of connListeners) fn();
    await tick(1200);
    const upCountAfter = toast.store().getSnapshot().filter((i) => i.key === "conn:up").length;
    assert(upCountAfter === upCountBefore, "quick blip stays silent (no down, no up)");
    ctx._disposeAll();
  } finally {
    toast.restore();
  }
}

// scenario 7: settings scope live-reconfig + settings card controller.
{
  console.log("\n[scenario 7] settings scope + card");
  const list = createFakeList();
  const opened = [];
  const scopeListeners = new Set();
  const writes = [];
  let scopeSnapshot = { status: "loading", writable: true, value: {}, base: {}, user: {} };
  const scope = {
    subscribe: (fn) => { scopeListeners.add(fn); return () => scopeListeners.delete(fn); },
    getSnapshot: () => scopeSnapshot,
    set: (f, v) => {
      writes.push(["set", f, v]);
      scopeSnapshot = { ...scopeSnapshot, status: "ready", user: { ...scopeSnapshot.user, [f]: v }, value: { ...scopeSnapshot.value, [f]: v } };
      for (const fn of [...scopeListeners]) fn();
    },
    unset: (f) => {
      writes.push(["unset", f]);
      const user = { ...scopeSnapshot.user }; delete user[f];
      scopeSnapshot = { ...scopeSnapshot, user };
      for (const fn of [...scopeListeners]) fn();
    }
  };
  const binder = { bind: () => scope };
  let registered = null;
  const slots = {
    inject: (name, reg) => { registered = reg; return () => { registered = null; }; },
    register: (...args) => args
  };
  const ctx = makeCtx(list, opened, { webUiSettings: binder, slots });
  bundle.apply(ctx, { sound: false, toast: true, badge: false, notify: false, dock: false, cooldownMs: 5000 });
  setRows(list, []);
  await tick();
  assert(scopeListeners.size >= 1, "settings scope subscribed (app + card)");
  assert(registered !== null, "settings card registered into the slot");
  // served value arrives while still 'loading' -> defaults mount; then ready fires
  scopeSnapshot = { status: "ready", writable: true, value: { sound: false, volume: 0.3 }, base: { sound: true, volume: 0.15 }, user: { sound: false, volume: 0.3 } };
  for (const fn of [...scopeListeners]) fn();
  await tick(200);
  assert(true, "scope readiness triggers remount without error");
  // card controller: staged edit -> save writes to the scope
  const entry = registered();
  const face = entry[0].inject();
  const cardState = face.hooks.approvalAlerterSettingsCard.getSnapshot();
  assert(cardState.available && cardState.exposed, "card state available + exposed");
  const volumeField = cardState.fields.find((f) => f.field === "volume");
  assert(volumeField.text === "0.3", `card shows served volume (got "${volumeField.text}")`);
  face.edit("volume", "0.5");
  await tick();
  const dirty = face.hooks.approvalAlerterSettingsCard.getSnapshot();
  assert(dirty.dirty === true && !dirty.invalid, "staged edit makes the form dirty");
  face.save();
  await tick(50);
  assert(typeof writes.find((w) => w[0] === "set" && w[1] === "volume")?.[2] === "number", "save writes volume to the scope");
  await tick(200);
  assert(true, "post-save remount settles");
  const after = face.hooks.approvalAlerterSettingsCard.getSnapshot();
  assert(after.dirty === false, "save clears the staged edit");
  ctx._disposeAll();
}

// scenario 8: host event feed (agent errors + host job-status ledger).
{
  console.log("\n[scenario 8] agent event feed");
  const list = createFakeList();
  const opened = [];
  const remoteListeners = new Map();
  const remote = {
    $on: (event, handler) => { remoteListeners.set(event, handler); return () => { remoteListeners.delete(event); }; },
  };
  const ctx = makeCtx(list, opened, { remote });
  const toast = captureToastStore();
  const { hostJobStatuses, hostJobStatusCounts, hostFeedCounters } = bundle;
  hostJobStatuses.clear();
  for (const key of Object.keys(hostJobStatusCounts)) delete hostJobStatusCounts[key];
  for (const key of Object.keys(hostFeedCounters)) delete hostFeedCounters[key];
  bundle.apply(ctx, { sound: false, toast: true, notify: false, dock: false, completion: true, jobFailure: true, diagnostics: true });
  const fire = (payload) => { const h = remoteListeners.get("notifications/evt"); if (h) h(payload); };
  fire({ type: "heartbeat", ts: 123, n: 1 });
  fire({ type: "heartbeat", ts: 456, n: 2 });
  assert(hostFeedCounters.heartbeat === 2, "heartbeat frames are ledgered");
  assert(bundle.lastHeartbeatAt === 456, "heartbeat freshness is tracked");
  fire({ type: "job-status", sessionId: "s8", jobId: "j1", status: "running" });
  fire({ type: "job-status", sessionId: "s8", jobId: "j1", status: "stopping" });
  fire({ type: "job-status", sessionId: "s8", jobId: "j1", status: "failed" });
  assert(hostJobStatuses.has("running") && hostJobStatuses.has("stopping") && hostJobStatuses.has("failed"), "host job-status ledger collects every status");
  assert(hostJobStatusCounts.stopping === 1, "host status counts track transitions");
  fire({ type: "agent-error", ts: 1, sessionId: "s8", kind: "turn-error", message: "insufficient_quota: Allocated quota exceeded, please increase your quota limit" });
  await tick();
  const agentToast = toast.store().getSnapshot().find((i) => i.key === "agenterr:1");
  assert(agentToast !== void 0 && agentToast.variant === "error", "agent-error pushes an error-variant toast");
  assert((agentToast.body ?? "").includes("quota"), "agent-error body carries the provider message");
  fire({ type: "agent-error", ts: 2, kind: "turn-max-tokens" });
  await tick();
  assert(toast.store().getSnapshot().some((i) => i.key === "agenterr:2"), "max-tokens agent-error alerts too");
  // llm/retry (the 429/resource-quota carrier) alerts once per session+kind
  fire({ type: "agent-error", ts: 3, sessionId: "s8q", kind: "llm-retry", message: "Allocated quota exceeded, please increase your quota limit" });
  await tick();
  const retryToast = toast.store().getSnapshot().find((i) => i.key === "agenterr:3");
  assert(retryToast !== void 0 && retryToast.variant === "error", "llm-retry pushes an error toast");
  assert((retryToast.body ?? "").includes("quota"), "llm-retry body carries the provider failure message");
  fire({ type: "agent-error", ts: 4, sessionId: "s8q", kind: "llm-retry", message: "Allocated quota exceeded, please increase your quota limit" });
  await tick();
  assert(!toast.store().getSnapshot().some((i) => i.key === "agenterr:4"), "repeated llm-retry within cooldown stays silent");
  // ① authoritative lane: host agent-completed -> completion toast; cooldown dedupes double fire
  fire({ type: "agent-completed", ts: 5, sessionId: "s8c" });
  fire({ type: "agent-completed", ts: 6, sessionId: "s8c" });
  await tick();
  const completedItems = toast.store().getSnapshot().filter((i) => i.key === "completion:s8c");
  assert(completedItems.length === 1, "agent-completed pushes one completion toast (cooldown dedupes)");
  assert(completedItems[0].variant === "done", "completion toast is the done variant");
  // uuid fallback -> short session tag, never a raw uuid; host-provided title wins
  fire({ type: "agent-completed", ts: 7, sessionId: "0870ac52-0f11-40fa-9d6d-841752e5d681" });
  await tick();
  const uuidItem = toast.store().getSnapshot().find((i) => i.key === "completion:0870ac52-0f11-40fa-9d6d-841752e5d681");
  assert(uuidItem !== void 0 && /^session 0870ac52$/.test(uuidItem.title), "uuid falls back to a short session tag");
  fire({ type: "agent-completed", ts: 8, sessionId: "probe-1", title: "My probe" });
  await tick();
  const titled = toast.store().getSnapshot().find((i) => i.key === "completion:probe-1");
  assert(titled !== void 0 && titled.title === "My probe", "host-provided title wins over the fallback");
  // visible + current session -> silenced; hidden -> alerts even for current
  documents.visibilityState = "visible";
  setRows(list, [row("s8cur", void 0, "Cur")], { current: "s8cur" });
  fire({ type: "agent-completed", ts: 9, sessionId: "s8cur" });
  await tick();
  assert(!toast.store().getSnapshot().some((i) => i.key === "completion:s8cur"), "visible current-session completion is silenced");
  documents.visibilityState = "hidden";
  documents.title = "HARNESS";
  fire({ type: "agent-completed", ts: 10, sessionId: "s8cur" });
  await tick();
  assert(!toast.store().getSnapshot().some((i) => i.key === "completion:s8cur"), "hidden completion: no corner card");
  assert(documents.title.startsWith("✓ "), "hidden completion pulses the tab title");
  documents.visibilityState = "visible";
  documents.title = "HARNESS";
  // demo card preview via the diagnostics surface
  const demoFns = globalThis.__NOTIFICATIONS__?.demo;
  assert(typeof demoFns === "function", "diag.demo is exposed");
  demoFns("error");
  await tick();
  const demoItem = toast.store().getSnapshot().find((i) => i.key.startsWith("demo:"));
  assert(demoItem !== void 0 && demoItem.variant === "error", "demo pushes a toast with the requested variant");
  // ④ has its own switch: agentError:false silences the anomaly lane
  const silent = bundle.startAgentEvents(remote, { agentError: false, failureNotify: false, toast: true, sound: false, notify: false }, { toast: toast.store() });
  const beforeSilent = toast.store().getSnapshot().length;
  fire({ type: "agent-error", ts: 3, kind: "turn-error", message: "insufficient_quota" });
  await tick();
  assert(toast.store().getSnapshot().length === beforeSilent, "agentError=false silences the anomaly lane");
  silent();
  // completion cue preview (stub window has no AudioContext -> must no-op cleanly)
  const demoSound = globalThis.__NOTIFICATIONS__?.demoSound;
  assert(typeof demoSound === "function", "diag.demoSound is exposed");
  let soundThrew = false;
  try { demoSound(0.2); demoSound(); demoSound(9); } catch { soundThrew = true; }
  assert(!soundThrew, "demoSound no-ops cleanly at any volume");
  ctx._disposeAll();
  assert(remoteListeners.size === 0, "agent feed unsubscribed on dispose");
}

// scenario 9: OS notification per-event text + requireInteraction + onClick + degraded.
{
  console.log("\n[scenario 9] OS notification per-event text + requireInteraction + onClick + degraded");
  const list = createFakeList();
  const opened = [];
  const ctx = makeCtx(list, opened);
  // enable notify + sound + badge + dock so the full alert path runs
  bundle.apply(ctx, {
    sound: true, badge: true, toast: false, notify: true, dock: true,
    cooldownMs: 5000, alertKinds: ["approval", "plan-review", "question"],
  });
  setRows(list, []);
  await tick();
  // --- pending approval: per-event title/body + requireInteraction ---
  notifLog.length = 0;
  setRows(list, [row("s1", "approval", "修复429bug")]);
  await tick();
  assert(notifLog.length === 1, "pending approval fires one OS notification");
  const pendingNotif = notifLog[0];
  assert(pendingNotif.title === "DSH 等待处理", "pending title uses notify.pending.title (zh)");
  assert(pendingNotif.body.includes("修复429bug") && pendingNotif.body.includes("审批"), "pending body carries session title + kind");
  assert(pendingNotif.requireInteraction === true, "approval kind sets requireInteraction");
  assert(typeof pendingNotif.onclick === "function", "pending notification has onclick handler");
  // clicking should jump to the session
  opened.length = 0;
  pendingNotif.onclick({ preventDefault: () => {} });
  assert(opened.length === 1 && opened[0] === "s1", "pending onclick opens the session");
  // --- plan-review: no requireInteraction (asymmetric by design) ---
  notifLog.length = 0;
  setRows(list, [row("s1", "approval", "修复429bug"), row("s2", "plan-review", "设计评审")]);
  await tick();
  const planNotif = notifLog[notifLog.length - 1];
  assert(planNotif.requireInteraction === false, "plan-review does NOT set requireInteraction (asymmetric)");
  assert(planNotif.body.includes("计划审批"), "plan-review body carries plan-review kind label");
  // --- degraded: visible + current session → no OS notification ---
  notifLog.length = 0;
  documents.visibilityState = "visible";
  setRows(list, [row("s1", "approval", "修复429bug"), row("s2", "plan-review", "设计评审"), row("s3", "approval", "当前会话")], { current: "s3" });
  await tick();
  assert(notifLog.length === 0, "degraded (visible+current) suppresses OS notification");
  // but title badge still reflects count (titleEl.textContent, not document.title)
  assert(titleEl.textContent.includes("3"), `degraded still updates title badge count (got "${titleEl.textContent}")`);
  // --- non-current session while visible → OS notification fires ---
  notifLog.length = 0;
  setRows(list, [row("s1", "approval", "修复429bug"), row("s2", "plan-review", "设计评审"), row("s3", "approval", "当前会话"), row("s4", "approval", "另一会话")], { current: "s3" });
  await tick();
  assert(notifLog.length === 1, "non-current session approval fires OS notification even while visible");
  ctx._disposeAll();
}

console.log(failures === 0 ? "\nALL SCENARIOS PASSED" : `\n${failures} FAILURE(S)`);
process.exitCode = failures === 0 ? 0 : 1;