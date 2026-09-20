# dsh-harness-notifier

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English version](#dsh-harness-notifier-english) · 默认中文

> DeepSeek Harness 更新迭代很快，rc 版会破坏插件协议——本插件按当前部署的机制实现，
> 挂载/升级后以「设置 → 插件」里能看到通知卡片、真实触发一次提醒为准。

DSH Web GUI 的**注意力插件**：**待审批 / 待回答提问 / 回合结束 / 会话异常 / 连接恢复**时，
在浏览器内多通道提醒——提示音、标签页标题徽标 + PWA 徽标、OS 通知、通知中心 dock、toast。

纯手写 JS，零构建链：宿主半区为 ESM，客户端半区为
`window.__ModuleLoader__.load({ id, factory })` 协议的 classic script，
`require("react")` 走客户端模块表 baseline。

## 原理

| 部分 | 职责 |
|---|---|
| `lib/index.js`（宿主，Node 侧） | 注册 `notifications` 设置节（插件页配置表单按该命名空间读写）；注册 systemPrompt presence 节告知模型 |
| `lib/client.js`（浏览器侧） | 订阅官方转发事件驱动提醒：`approval/request`、`user-questions/request`（waterfall 观察者，`return next()` 绝不代答）、`api-session/status`（回合结束 + 待处理清除）、`api-session/error`、`api-session/activity`（用户介入即清除）、`settings/document-updated`（配置热刷新）、`connection/reset`（恢复提醒）；UI 落点：`shell.overlay`（dock + toast）、`plugins.bundle.config`（插件页配置表单，key = 包名，双视图） |

### 行为细节

- **waterfall 车道必须 prepend 抢位**：cordis waterfall 的首个返回值即终止整条链。
  官方审批/问答 UI 的应答器返回 `await pending.result`，普通 `$on` 注册的观察者排在
  它之后**永远收不到事件**（这就是"审批/提问没提醒"的典型根因）。`$on` 底下只是往
  ctx 钩子表写 `remote.events.eventPrefix + 事件名`（前缀随启动随机，运行时可读），
  插件直接以 `{ prepend: true }` 向同一张表注册观察者：观察 → `next()` 放行 →
  官方应答器应答 → 应答值原样回流，链返回时精确清除待处理项。内部面不可用时退化为
  `$on` 并在诊断记一条（此时这两个车道可能不响）。
- **免打扰时段**只静音（提示音 / OS 通知 / toast 不发），徽标与 dock 静默更新。
- **冷却**：同类提醒（类别 + 会话）按 `cooldownMs` 去重。
- **待处理清除**：会话重新开跑（`api-session/status` running=true）、用户发消息
  （activity）、dock/toast 点击「前往」、手动「忽略」。
- **回合结束不误报**：若该会话还有待审批/提问在等用户，idle 边沿不报「回合结束」。
- **页面无人值守自动升级**：最小化 / 被完全遮挡（`visibilityState=hidden`）或**失焦**
  （点了别的窗口，`document.hasFocus()=false`）时，页内 toast 注意不到——此时即使
  「OS 通知」开关关闭，任何提醒（审批 / 提问 / 回合结束 / 会话异常）都会自动升级为
  系统通知（`escalateOnHidden`，默认开；免打扰时段仍静音）。失焦但可见的窗口里
  页内 toast 与声音照常。
- 系统通知权限：首次页面手势（pointerdown）时若为 default 态自动索权一次；
  也可在设置表单手动申请。被浏览器拒绝后只能去站点权限设置里放开。
- **链路自证**：设置表单「发送测试系统通知」一键验证 授权 → Windows 横幅 全链路；
  `window.__NOTIFIER_DIAG__.os`（attempt/sent/skipPermission/skipDisabled/lastSkip）
  与 `lastVisibility` 记录每次系统通知的派发结果和页面可见性变化。
- 提示音走 WebAudio，浏览器要求先有一次页面手势；插件在首次 pointerdown 时预热。
- 诊断：开启后 `window.__NOTIFIER_DIAG__` 暴露配置、待处理、计数与最近错误。
- **模拟入口**：控制台 `__NOTIFIER_SIM__.help`——本地驱动审批/提问/完成/异常提醒，
  不触碰真实会话，验证 UI 全链路用。

## 安装 / 更新（开发模式）

纯手写 JS，无构建链：宿主为 ESM（`"type": "module"`），客户端为
`window.__ModuleLoader__.load({ id, factory })` 协议的 classic script，
`require("react")` 走客户端模块表 baseline。无需 `npm install` / `npm run build`。

```sh
# 1. 克隆仓库
git clone https://github.com/renpengfei1027/dsh-web-notify.git
cd dsh-web-notify

# 2. 把插件目录挂进 web profile（link: 指向插件子目录，不是仓库根）
dsh plugin --profile web add link:"$PWD/harness-notifier"
# Windows PowerShell: dsh plugin --profile web add link:"$PWD/harness-notifier"

# 3. 重启 dsh web
dsh web
```

### 设置卡片写入链路

所有保存都经 `cardWrite`：**乐观回显**（受控输入立即生效，不等服务端往返）
→ **150ms 合并**（拖动音量/键入冷却只发最后一次）→
`ctx.remote.settings.update(ns, patch, void 0)`（网关按 descriptor 严格校验
参数数，第三参是 `expectedRevision: number | undefined`，传 `undefined` 表示
无条件写）。服务器值经 describe 落地后清空乐观层。

### 配置 UI 挂载点（协议现况）

配置表单注册进插件页的 **`plugins.bundle.config`** keyed 槽位（key = 包名）：

- 插件列表的 Installed 卡片下方渲染 `view: 'summary'` 一行简介（实时显示已开启的通道）；
- 点进包详情页渲染 `view: 'page'` 完整表单（带保存语义的逐字段热写）。

旧的 `settings.plugin.item` 槽位已从 DSH 客户端移除；`plugins.item` 保留给官方
宿主面配置页，第三方 bundle 不要注册。DSH 升级后若插件页协议再变，对照
`ui-plugin-manager` 的 `slot-contract.ts` 移植。

### 本地自检

假 DOM + 假 ctx，验证协议注册、事件订阅面、卡片写入三参调用：

```sh
cd harness-notifier && npm run check
```

### 安装后校验

| 校验项 | 位置 | 预期 |
|---|---|---|
| profile dependencies | `~/.dsh/profiles/web/package.json` | `dependencies` 含 `dsh-harness-notifier`（link:） |
| bundle 列表 | 同上 `dsh.profile.bundles` | 含 `dsh-harness-notifier` |
| 配置表单 | 设置 → 插件 → dsh-harness-notifier | 详情页出现完整表单，卡片下有一行通道简介 |
| 全链路 | 表单「发送测试系统通知」 | Windows 通知横幅弹出 |

### 生效

**插件集合变更 / 插件代码变更都必须重启 `dsh web`**——boot graph 的 bundle rev
按启动时内容哈希计算，刷新页面拿不到新 bundle。

### 验证

1. 设置 → 插件 → dsh-harness-notifier：详情页出现完整配置表单
2. 控制台 `__NOTIFIER_SIM__.pending("approval")`（或真实触发一次审批）：
   提示音 + 标签页标题 `(N)` + 右下角铃铛 + toast
3. 铃铛展开通知中心，「前往」跳转对应会话
4. OS 通知：表单里申请权限后，浏览器窗口最小化也能收到系统通知

### 卸载

```sh
dsh plugin --profile web remove dsh-harness-notifier
```

## 配置参数

改完即生效（乐观回显 + 150ms 合并写，无需重启）。

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `sound` | boolean | `true` | 待审批/提问提示音 |
| `volume` | number 0–1 | `0.15` | 提示音音量 |
| `badge` | boolean | `true` | 标签页标题徽标 + PWA 徽标 |
| `toast` | boolean | `true` | 页内 toast 提醒 |
| `notify` | boolean | `true` | 浏览器 OS 通知（需授权） |
| `escalateOnHidden` | boolean | `true` | 页面无人值守时自动升级为系统通知 |
| `dock` | boolean | `true` | 右下角通知中心 |
| `completion` | boolean | `true` | ① 回合结束提醒 |
| `completionSound` | boolean | `true` | 回合结束提示音 |
| `completionNotify` | boolean | `true` | 回合结束 OS 通知 |
| `connection` | boolean | `true` | ② 连接恢复提醒 |
| `agentError` | boolean | `true` | ③ 会话异常提醒 |
| `cooldownMs` | number ≥0 | `5000` | 同类提醒冷却（毫秒） |
| `alertKinds` | string[] | `["approval","plan-review","question"]` | 触发待处理提醒的 kind 白名单 |
| `quiet` | object | `{enabled:false, start:"23:00", end:"08:00"}` | 免打扰时段（仅静音，视觉通道照常） |
| `diagnostics` | boolean | `false` | 在 `window.__NOTIFIER_DIAG__` 暴露诊断 |

**几个常用调法**：

- **只要审批**：`completion=false`、`connection=false`、`agentError=false`
- **只想听响**：`toast=false`、`notify=false`，保留 `sound + badge + dock`
- **夜间免打扰**：`quiet.enabled=true`、`start=22:00`、`end=09:00`
- **嫌系统通知吵、但要离开窗口时不错过**：保持 `notify=false`，`escalateOnHidden=true`

## 限制

- 提醒粒度是**会话级**；被委派的子代理在委派边界即固定「审批永不、提问拒答」策略，
  不会产生待审批/提问条目，只有父会话的审批会进通知中心
- 提示音需要页面有过用户手势（浏览器音频策略）；无手势时静默降级为视觉通道
- 检测在浏览器侧：页面关闭时页内提醒天然失效——这正是 M2/M3 出页通道的动机

## 路线图

| 阶段 | 内容 |
|---|---|
| M1（本版） | 零补丁页内六通道 + 插件页配置表单 |
| M2 | 宿主权威决策层（pending 状态机 / 去重 / 免打扰下沉宿主）+ Windows toast 出页通道 |
| M3 | Webhook 手机推送（Bark / ntfy / Server酱 / 自定义模板，secrets 走 `role('secret')`） |
| M4 | `notify` 模型工具：agent 在长任务关键节点主动呼叫人 |

## 项目结构

```
dsh-web-notify/
├── README.md               # 本文件
├── LICENSE
└── harness-notifier/       # 插件本体（零构建，手写 JS）
    ├── package.json        # dsh.bundle.patch + dsh.client（platform: web, immediately）
    ├── cordis.patch.yml    # 插件行：id notifications / name dsh-harness-notifier
    ├── lib/index.js        # 宿主半区（settings 节 + presence）
    ├── lib/client.js       # 浏览器半区（检测 + 六通道 + 插件页配置表单）
    └── scripts/smoke.mjs   # 假 DOM 冒烟（node --check + npm run check）
```

## License

MIT

---

# dsh-harness-notifier (English)

[中文版](#dsh-harness-notifier) · Chinese by default

> DeepSeek Harness iterates fast and rc releases break plugin protocols — this plugin
> is implemented against the currently deployed mechanism. After mounting/upgrading,
> treat "the notification card shows up under Settings → Plugins and a real alert
> fires" as the source of truth.

**Attention plugin for the DSH Web GUI**: on **pending approval / pending question /
turn completion / session error / connection restore**, it rings back inside the
browser — chime, tab-title badge + PWA badge, OS notification, notifications dock, toast.

Hand-written JS, zero build chain: the host half is ESM, the client half is a classic
script speaking the `window.__ModuleLoader__.load({ id, factory })` protocol,
`require("react")` resolved through the client module-table baseline.

## How it works

| Part | Responsibility |
|---|---|
| `lib/index.js` (host, Node) | Registers the `notifications` settings node (read/written by the plugin-page config form); registers a systemPrompt presence node telling the model the notifier exists |
| `lib/client.js` (browser) | Subscribes to official forwarded events: `approval/request`, `user-questions/request` (waterfall observers, `return next()`, never answers on the user's behalf), `api-session/status` (turn completion + pending clear), `api-session/error`, `api-session/activity` (clear on user activity), `settings/document-updated` (hot config refresh), `connection/reset` (restore alert); UI mounts: `shell.overlay` (dock + toast), `plugins.bundle.config` (plugin-page config form, keyed by package name, dual view) |

### Behaviour details

- **The waterfall lane must prepend**: the first return value of a cordis waterfall
  terminates the chain. The official approval/question responder returns
  `await pending.result`, so plain `$on` observers registered after it never see the
  event (a classic root cause of "no approval/question alerts"). The plugin
  registers into the same hook table with `{ prepend: true }`: observe → `next()`
  passes through → the official responder answers → the answer flows back unchanged,
  and the pending item is cleared exactly when the chain returns. Falls back to plain
  `$on` (recording a diagnostic) when the internal surface is unavailable — those two
  lanes may then stay silent.
- **Quiet hours** only mute (chime / OS notify / toast); badge and dock update silently.
- **Cooldown**: same-kind reminders (category + session) dedupe by `cooldownMs`.
- **Pending clear**: session resumes (`api-session/status` running=true), user sends a
  message (activity), dock/toast "go", or manual "ignore".
- **No false turn-completion**: if that session still has a pending approval/question,
  the idle edge stays silent.
- **Unattended-page escalation**: minimised / fully occluded (`visibilityState=hidden`)
  or **unfocused** (`document.hasFocus()=false`) pages can't show in-page toasts — in
  that state every alert escalates to a system notification even with the OS-notify
  switch off (`escalateOnHidden`, default on; quiet hours still mute). In a focused but
  visible window, in-page toast and chime behave normally.
- OS-notify permission: auto-requested once on the first page gesture (pointerdown)
  when in the default state; also requestable from the settings form. If the browser
  denied it, only the site-permission page can re-enable.
- **Chain self-test**: one click on "send test notification" in the settings form
  verifies permission → Windows banner end to end; `window.__NOTIFIER_DIAG__.os`
  (attempt/sent/skipPermission/skipDisabled/lastSkip) and `lastVisibility` record every
  dispatch result and visibility change.
- The chime rides WebAudio and needs a prior user gesture; the plugin warms up on the
  first pointerdown.
- Diagnostics: when enabled, `window.__NOTIFIER_DIAG__` exposes config, pending items,
  counters and recent errors.
- **Simulation console**: `__NOTIFIER_SIM__.help` drives approval/question/completion/
  error alerts locally without touching real sessions.

## Install / update (dev mode)

Hand-written JS, no build chain: the host half is ESM (`"type": "module"`), the client
half is a classic script speaking the `window.__ModuleLoader__.load({ id, factory })`
protocol, `require("react")` resolved through the client module-table baseline. No
`npm install` / `npm run build` needed.

```sh
# 1. clone
git clone https://github.com/renpengfei1027/dsh-web-notify.git
cd dsh-web-notify

# 2. link the plugin subdirectory (not the repo root) into the web profile
dsh plugin --profile web add link:"$PWD/harness-notifier"

# 3. restart dsh web
dsh web
```

### Settings write path

Every save goes through `cardWrite`: **optimistic echo** (controlled inputs apply
immediately, no server round-trip wait) → **150ms coalescing** (dragging the volume or
typing the cooldown sends only the last value) →
`ctx.remote.settings.update(ns, patch, void 0)` (the gateway validates argument counts
strictly; the third parameter is `expectedRevision: number | undefined`, `undefined`
meaning an unconditional write). Server values clear the optimistic layer once they
land via describe.

### Config UI mount point (current protocol)

The form registers into the plugin page's **`plugins.bundle.config`** keyed slot
(key = package name):

- `view: 'summary'` renders a one-liner under the Installed card (live list of enabled
  channels);
- `view: 'page'` renders the full form on the package's own detail page.

The old `settings.plugin.item` slot has been removed from the DSH client;
`plugins.item` is reserved for official host-plane config pages — third-party bundles
should not register there. If a DSH upgrade changes the plugin-page protocol again,
port against `ui-plugin-manager`'s `slot-contract.ts`.

### Local smoke

Fake DOM + fake ctx; verifies protocol registration, the event subscription surface,
and the 3-argument card write:

```sh
cd harness-notifier && npm run check
```

### Post-install checklist

| Check | Where | Expected |
|---|---|---|
| profile dependencies | `~/.dsh/profiles/web/package.json` | `dependencies` contains `dsh-harness-notifier` (link:) |
| bundle list | same file, `dsh.profile.bundles` | contains `dsh-harness-notifier` |
| config form | Settings → Plugins → dsh-harness-notifier | full form on the detail page, one-line summary under the card |
| end-to-end | "send test notification" in the form | a Windows notification banner pops |

### Take effect

**Any plugin-roster or plugin-code change requires restarting `dsh web`** — the boot
graph's bundle rev is a content hash computed at startup; refreshing the page never
picks up a new bundle.

### Verify

1. Settings → Plugins → dsh-harness-notifier: the full config form appears
2. `__NOTIFIER_SIM__.pending("approval")` (or a real approval): chime + tab title `(N)`
   + corner bell + toast
3. Expand the dock, "go" jumps to the session
4. OS notify: grant permission in the form, then minimise the browser — the system
   notification still arrives

### Uninstall

```sh
dsh plugin --profile web remove dsh-harness-notifier
```

## Configuration

Changes apply hot (optimistic echo + 150 ms coalesced writes, no restart).

| Field | Type | Default | Description |
|---|---|---|---|
| `sound` | boolean | `true` | Approval/question chime |
| `volume` | number 0–1 | `0.15` | Chime loudness |
| `badge` | boolean | `true` | Tab-title badge + PWA badge |
| `toast` | boolean | `true` | In-page toast alerts |
| `notify` | boolean | `true` | Browser OS notification (needs permission) |
| `escalateOnHidden` | boolean | `true` | Escalate to a system notification when the page is unattended |
| `dock` | boolean | `true` | Corner notifications dock |
| `completion` | boolean | `true` | ① Turn-completion alerts |
| `completionSound` | boolean | `true` | Turn-completion chime |
| `completionNotify` | boolean | `true` | Turn-completion OS notification |
| `connection` | boolean | `true` | ② Connection-restore alerts |
| `agentError` | boolean | `true` | ③ Session-error alerts |
| `cooldownMs` | number ≥0 | `5000` | Same-kind dedupe window (ms) |
| `alertKinds` | string[] | `["approval","plan-review","question"]` | Kind whitelist for pending alerts |
| `quiet` | object | `{enabled:false, start:"23:00", end:"08:00"}` | Quiet hours (mute only; visuals stay) |
| `diagnostics` | boolean | `false` | Expose `window.__NOTIFIER_DIAG__` |

**Common recipes**:

- **Approvals only**: `completion=false`, `connection=false`, `agentError=false`
- **Chime only**: `toast=false`, `notify=false`, keep `sound + badge + dock`
- **Late-night quiet**: `quiet.enabled=true`, `start=22:00`, `end=09:00`
- **OS toasts too loud but don't want to miss anything while away**: keep
  `notify=false`, `escalateOnHidden=true`

## Limits

- Granularity is **session-level**; delegated subagents get their approval policy pinned
  to "never" and questions rejected at the delegation boundary, so only parent-session
  approvals can ever reach the dock
- Chimes need a prior user gesture (browser autoplay policy); without one it silently
  degrades to visual surfaces
- Detection lives in the browser: with the page closed, in-page alerts naturally die
  — that is the motivation for the M2/M3 out-of-page channels

## Roadmap

| Phase | Scope |
|---|---|
| M1 (this version) | Zero-patch in-page six channels + plugin-page config form |
| M2 | Host-authoritative decision layer (pending state machine / dedupe / quiet hours sink) + out-of-page Windows toast |
| M3 | Webhook phone push (Bark / ntfy / ServerChan / custom templates, secrets via `role('secret')`) |
| M4 | A `notify` model tool: the agent calls the human at key points of long tasks |

## Project layout

```
dsh-web-notify/
├── README.md               # this file
├── LICENSE
└── harness-notifier/       # the plugin (zero-build, hand-written JS)
    ├── package.json        # dsh.bundle.patch + dsh.client (platform: web, immediately)
    ├── cordis.patch.yml    # plugin row: id notifications / name dsh-harness-notifier
    ├── lib/index.js        # host half (settings node + presence)
    ├── lib/client.js       # browser half (detection + six channels + plugin-page form)
    └── scripts/smoke.mjs   # fake-DOM smoke (node --check + npm run check)
```

## License

MIT
