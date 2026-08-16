# dsh-web-notify

[![npm version](https://img.shields.io/npm/v/dsh-web-notify.svg)](https://www.npmjs.com/package/dsh-web-notify)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English version](#dsh-web-notify-english) · 默认中文

> 本插件由 **DeepSeek Harness**（官方 cordis / `@deepseek-ai/dsh-*` 插件栈）驱动，结合 **DeepSeek-V4-Flash-0731** 模型参数的官方事件帧构建。
>
> **当前 DeepSeek Harness 处于开发预览快速迭代期**，推荐以**开发调试模式**（`link:` 本地仓库）挂载本插件：改代码后 `npm run build` 即时生效，配合 `window.__NOTIFICATIONS__` diagnostics 排查问题最顺手；当然也提供了 npm 一键挂载的备选方式。

DSH Web GUI 的**审批注意力插件**：当任意会话出现待处理的审批 / 计划审批 / 提问时，浏览器不再静默——提示音、标签页标题与 Favicon 徽标、OS 通知、右下角通知中心同步呈现；会话完成、任务失败、连接掉线、模型/工具异常（429 配额等）也有提醒。检测管道覆盖全部会话行（含子代理）；受运行时委派策略约束，被委派的子代理实际上不会产生待审批/提问，其完成 / 失败 / 异常提醒照常生效（详见下文「子代理通知可达性」）。

纯插件形态：host 半（`lib/index.js`）+ client 半（`lib/client.js`，loader 格式），通过 profile patch 挂载。

## 快速上手（推荐路径）

```
① 克隆仓库 → 安装依赖 → 构建产物
        ↓
② link:仓库目录 挂入 web profile
        ↓
③ 放行设置命名空间（patch 脚本）
        ↓
④ 重启 dsh web → 设置页找到「通知」卡片 → 按自己需求开关通道/音量/免打扰
        ↓
⑤ DevTools 控制台观察 window.__NOTIFICATIONS__ ：
     applied / cardRegistered / monitors / lastHeartbeatAt
     hostStatuses / hostStatusCounts  ← 宿主投递的 job 状态词汇
     feedCounters                     ← 每类事件计数
     jobSamples / seenStatuses        ← 浏览器侧采样环
     demo() / demoSound()             ← 一键 UI / 音频 demo
```

## 场景应用

### 1. 待处理审批 / 计划审批 / 提问到达

任意会话（包括未打开过的子代理）出现 `pendingInteraction` 即触发；同一 (会话, kind) 在冷却期（默认 5s）内不重复报警。

| 通道 | 表现 |
|---|---|
| 提示音 | WebAudio E5-G5-B5 三连音 |
| 标签页标题 | `⚠ N 待审批 — <原标题>`，MutationObserver 对抗 shell 标题写入 |
| 标签页 Favicon | 32×32 红底白字徽章（≤9 显示数字，>9 显示红点） |
| OS 通知 | 按会话 tag 去重，**点击跳转对应会话 + 聚焦窗口**；`approval` 类型 `requireInteraction: true` 持久显示直到处理 |
| PWA 任务栏徽标 | 已安装的 PWA 窗口在任务栏/应用图标显示数字（`navigator.setAppBadge`） |
| 通知中心 Dock | 右下角 FAB（实时计数）+ 展开面板列出**全部**待处理；按会话标题 + kind 圆点着色「去处理」一键跳转；归零自动收起；新到达时 FAB 脉冲高亮 |

**当前会话降级**：页面可见且新审批属于当前打开的会话时，提示音与 OS 通知静默（用户眼睛就在这），仅保留视觉通道；切走或最小化后恢复全通道。

**子代理通知可达性**：会话列表是客户端 lineage 展开后的同一张表（子代理行 `origin: 'subagent'` 按 `parentSessionId` 嵌套），因此检测管道天然覆盖子代理行——一旦某个子代理行挂上 `pendingInteraction`，提示音 / 徽标 / OS 通知 / Dock 全通道照常触发。但按当前 DSH 委派语义，被委派的子代理实际上**不会**产生这三种待处理状态：

- **审批**：`dsh-subagent` 在委派边界把子代理的审批策略固定为 `'never'`（无论父级策略如何），任何需审批操作（如 sandbox 升权）被确定性拒绝，不产生 `approval/requested` 帧，也就没有 `pendingInteraction`；
- **提问 / 计划审批**：`dsh-user-questions` 对受父级持有的调用方抛 `DELEGATED_CALLER`，子代理只能把未决问题写进最终结果，由父级代为询问；计划审批只是 `intent.kind === 'plan-review'` 的提问分类，同样不会产生；
- 因此通知中心里只可能出现**父会话**的审批条目，子代理行永远不会亮起待处理点。

与之相对，子代理的**完成、任务失败、模型/工具异常**走 `session/event` 流与 jobs 归集，覆盖所有会话，提醒照常生效。

### 2. 会话 / 子代理完成

任意会话 `turn/end` 完成 → 完成 toast 卡片（右上角，done 变体）+ 完成单音 + 可选 OS 通知。

- 页面可见 + 当前会话完成：toast / OS 静默，仅兜底播一声软完成音（用户可能滚走）
- 页面隐藏：无 toast（看不到），改用 tab 标题脉冲 + PWA 角标 + 提示音 + OS 通知

### 3. 任务失败

`jobsBySession` 中 job 状态为 `failed` / `killed`、或 `completed` 但 detail 非空且非 `exit code: 0`（DSH 真机异常终态映射）→ error 变体 toast + 提示音 + 可选 OS 通知。按 job 注册号只报一次。

### 4. 模型 / 工具运行异常（429 配额等）

宿主订阅官方 `session/event` 流，捕获 `llm/retry`（429 配额 / 限流）、`turn/end` 的 `error` / `max-tokens` / `interrupted`、`tool/result` 的 `error` / `isError` → error 变体 toast（错误原文进 body，截 240 字符）+ 提示音 + 可选 OS 通知。同会话同 kind 在冷却期内不重复。

### 5. 掉线 / 重连

共享 `connection` 服务断线持续超过 `connectionAlertAfterMs`（默认 10s）→ warning toast + 提示音；恢复时轻 toast + 完成单音。快速闪断（未跨阈值）不报。启动期从未连上过不报。

## 配置参数

设置卡片注册进 DSH Web 设置页的「插件配置」→「通知」（官方 `settings.plugin.item` 槽位），改完即生效（120 ms debounce 热重配，无需重启）。

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `sound` | boolean | `true` | 提示音主开关 |
| `volume` | number 0–1 | `0.15` | 提示音音量 |
| `badge` | boolean | `true` | 标签页标题徽标 + Favicon 徽章 + PWA 任务栏徽标（同一开关） |
| `toast` | boolean | `true` | 一次性事件卡片（完成 / 失败 / 断线） |
| `notify` | boolean | `true` | OS 通知主开关（首次触发在下一个用户手势请求 `Notification` 权限） |
| `dock` | boolean | `true` | 通知中心 Dock（右下角 FAB + 展开面板） |
| `completion` | boolean | `true` | ① 会话 / 子代理完成提醒 |
| `completionSound` | boolean | `true` | 完成时播放轻单音 |
| `completionNotify` | boolean | `true` | 完成也走 OS 通知 |
| `connection` | boolean | `true` | ② 掉线 / 重连提醒 |
| `connectionAlertAfterMs` | number ≥1000 | `10000` | 断线持续超过该毫秒数才提醒 |
| `jobFailure` | boolean | `true` | ③ 后台任务失败提醒 |
| `failureNotify` | boolean | `false` | ③ 任务失败 + ④ 任务异常共用一个 OS 通知开关 |
| `agentError` | boolean | `true` | ④ 模型 / 工具运行异常（429 配额、输出上限、中断、工具失败） |
| `cooldownMs` | number ≥0 | `5000` | 同会话同 kind 去重冷却 |
| `alertKinds` | string[] | `["approval","plan-review","question"]` | 触发待处理提醒的 kind 白名单 |
| `quiet` | object | `{enabled:false, start:"23:00", end:"08:00"}` | 免打扰时段（仅静音，视觉通道照常） |
| `soundResolved` | boolean | `false` | 审批解决时播放下行柔和音 |
| `diagnostics` | boolean | `true` | on-device 观测仪（采样最近 60 次会话快照，含 job 状态；状态集合始终自动收集） |

**几个常用调法示例**：

- **只要审批不要失败/断线**：`completion=false`、`connection=false`、`jobFailure=false`、`agentError=false`
- **只想听响，不喜欢卡片弹**：`toast=false`、`notify=false`，保留 `sound + badge + dock`
- **夜间开发免打扰**：`quiet.enabled=true`、`quiet.start=22:00`、`quiet.end=09:00`，提示音全关、视觉照常
- **只接 PWA / 任务栏，系统通知弹了嫌吵**：`notify=false`、`badge=true`、`dock=true`

## 安装

DSH 插件通过 `dsh plugin` 命令安装进 **profile**（`dsh web` 对应 `web` profile）。考虑到 DeepSeek Harness 当前处于开发预览快速迭代期，**推荐开发调试模式挂载**，便于即时迭代与 diagnostics 排查；当然也提供了 npm 一键挂载的备选方式。

### 前提条件

- **Node.js >= 22**
- **pnpm** — `dsh plugin` 内部使用 pnpm 安装依赖：`npm install -g pnpm`
- **dsh CLI** — 若未全局安装，所有 `dsh` 命令前缀 `npx @deepseek-ai/dsh`，如 `npx @deepseek-ai/dsh plugin --profile web add dsh-web-notify`

### 方式一：开发调试模式挂载（当前推荐）

```sh
# 1. 克隆仓库
git clone https://github.com/renpengfei1027/dsh-web-notify.git
cd dsh-web-notify

# 2. 安装依赖并构建（需要 Node.js >= 22）
npm install
npm run build

# 3. 把仓库挂进 web profile（link: 指向仓库根目录）
dsh plugin --profile web add link:$(pwd)
# Windows PowerShell: dsh plugin --profile web add link:$PWD.Path

# 4. 重启 dsh web，设置页「插件配置」下即出现「通知」卡片
dsh web
```

### 方式二：npm 一键挂载

```sh
dsh plugin --profile web add dsh-web-notify
```

### AI 编码工具 / 沙箱环境注意事项

在 TRAE、Cursor 等 AI 编码工具中安装本插件时，需注意：

1. **沙箱写限制**：AI 工具的沙箱通常阻止写入 `~/.dsh/` 目录，而 `dsh plugin` 和 `dsh web` 都需要写 profile 文件。**必须在 AI 工具外部的普通终端中执行这些命令**。
2. **切勿手动 `npm install`**：手动把包塞进 `~/.dsh/profiles/web/node_modules/` 会绕过 `dsh plugin` 的依赖链接逻辑，导致插件的 `@deepseek-ai/*` peer 依赖与 DSH host 的模块树脱节，`settings` 服务不可达，命名空间注册静默失败（卡片永远只读）。
3. **始终用 `dsh plugin --profile web add`**：这是唯一正确的安装方式，它会通过 pnpm 正确链接依赖、更新 `package.json` 和 `cordis.patch.yml`。

### 安装后校验

安装完成并重启 `dsh web` 后，检查以下文件和指标：

| 校验项 | 位置 / 命令 | 预期 |
|---|---|---|
| profile dependencies | `~/.dsh/profiles/web/package.json` | `dependencies` 含 `dsh-web-notify` |
| profile patch | `~/.dsh/profiles/web/cordis.patch.yml` | 含 `- id: notifications` 插入行 |
| 包已安装 | `~/.dsh/profiles/web/node_modules/dsh-web-notify/` | 目录存在，含 `lib/`、`cordis.patch.yml` |
| 命名空间已注册 | DevTools Console: `__NOTIFICATIONS__.scopeStatus` | `"ready"`（非 `"unavailable"`） |
| 卡片可编辑 | 设置页 → 插件配置 → 通知 | 字段可编辑（非只读） |

### 放行设置命名空间（可选，但推荐）

DSH 官方 apiproxy 的 `WEB_SETTINGS_NAMESPACES` 是硬编码白名单，第三方命名空间默认只读。运行一次本仓库的 patch 脚本把 `notifications` 注入白名单：

```sh
node scripts/patch-apiproxy.mjs
```

之后设置卡片可读可写；不放行则卡片只读，`DEFAULTS` 生效。**`dsh` 升级后需重跑此脚本**（脚本幂等，从旧的 `approval-alerter` 命名空间升级也支持原地替换）。

### Diagnostics 观察调试

插件加载后，在 DSH Web 页面打开 DevTools Console：

```js
// 插件是否完整挂载
> __NOTIFICATIONS__.applied, __NOTIFICATIONS__.cardRegistered
  true, true

// 绑定到了哪个 settings provider，sessions / connection 服务是否可用
> __NOTIFICATIONS__.binder, __NOTIFICATIONS__.sessions, __NOTIFICATIONS__.connAvailable
  "settingsScope", true, true

// 宿主事件通道健康度（~30s 一次心跳；lastHeartbeatAt 不变表示 host feed 断了）
> __NOTIFICATIONS__.feedCounters, __NOTIFICATIONS__.lastHeartbeatAt
  { heartbeat: 4, "agent-error": 1, … }, 1756789012345

// 宿主投递的 job 状态全量词汇（可对照 sentinel / lifecycle 对哪些终态做判断）
> __NOTIFICATIONS__.hostStatuses, __NOTIFICATIONS__.hostStatusCounts
  ["failed","killed","completed","running",…], { completed: 8, failed: 2, … }

// 浏览器侧采样（diagnostics=true 时开启，最近 60 帧）
> __NOTIFICATIONS__.jobSamples[0]
  { ts, sessionId, sessionTitle, jobs: [{ jobId, status }], alerts: [] }

// 一键 demo 卡片 / demo 提示音（排查 UI 与音频是否能响）
> __NOTIFICATIONS__.demo("error")     // 弹 error 变体卡片
> __NOTIFICATIONS__.demoSound(0.3)    // 以指定音量播放完成单音
```

### 生效

**插件集合变更必须重启 `dsh web`**——仅刷新页面不会注册新包（官方 client-modules 文档明确：包元数据按名缓存且永不过期）。白名单 patch 之后也要重启。

### 验证

1. 设置页「插件配置」下出现独立的「通知」卡片，字段可编辑
2. 触发一个待审批：标签页标题出现 `⚠ 1 待审批 —`，Favicon 显示红底数字 1，右下角 Dock 出现 FAB 与列表，播放三连音，OS 通知弹出（首次需授权）
3. 点击 OS 通知或 Dock 行的「去处理」→ 窗口聚焦并打开对应会话
4. 完成一个会话：右上角弹完成 toast + 完成单音
5. DevTools 控制台可见 `[notifications]` 前缀的日志；`window.__NOTIFICATIONS__` 暴露 apply 分步记录与 `jobSamples` 采样环

### 卸载

```sh
dsh plugin --profile web remove dsh-web-notify
```

或删除本地 profile 的 `cordis.patch.yml` 插入行与 `node_modules` junction。

## 限制

- 提醒粒度是**会话级**（列表行只有 kind 状态）；任务失败能到 job 级（含命令 label 与 exit detail），模型 / 工具异常走事件流原文（截 240 字符）
- 子代理可达性：子代理行位于检测管道内（与会话同一张 lineage 表），但被委派子代理的审批策略固定为 `'never'`、提问被拒，实际不会产生待审批/计划审批/提问条目——只可能出现父会话的审批；完成 / 失败 / 异常提醒照常覆盖子代理（见上文「子代理通知可达性」）
- 提示音需要页面有过用户手势（浏览器音频策略）；无手势时静默降级为视觉通道
- OS 通知权限在首次提醒后的下一次点击时请求；若 Windows 不弹，检查浏览器站点设置（127.0.0.1 通知权限）与 Windows「专注助手」
- 设置卡片走 settings scope；若宿主 apiproxy 未放行第三方命名空间，卡片只读，`DEFAULTS` 生效

## 项目结构

```
dsh-web-notify/
├── package.json          # dsh.client.platform=web + inject + dsh.bundle.patch
├── cordis.patch.yml      # 插件行 insert
├── src/
│   ├── index.ts          # host 半：settings 命名空间 + systemPrompt 通告 + 事件流转发
│   └── client/           # 浏览器半（零 @deepseek-ai 运行时依赖）
│       ├── index.ts      #   入口：apply/inject/mount + settings scope 热重配 + 卡片注册
│       ├── types.ts      #   本地结构类型 + DEFAULTS
│       ├── locales.ts    #   zh/en 词典 + t()
│       ├── channels.ts   #   WebAudio 提示音 / 免打扰 / OS 通知 / jumpToSession
│       ├── badge.ts      #   标题徽标 + Favicon 徽章（canvas）+ PWA 徽标
│       ├── stores.ts     #   toast / dock 两个 uSES store
│       ├── toast-ui.tsx  #   toast 卡片 + 堆栈
│       ├── toast-mount.tsx
│       ├── sentinel.ts   #   待处理边沿哨兵（Dock 承担视觉，仅打脉冲）
│       ├── lifecycle.ts  #   ① 完成 + ③ 任务失败 + ② 连接监视
│       ├── dock.ts       #   Dock FAB + 面板 + mount + startDock
│       └── settings-card.tsx # 设置卡片
└── scripts/
    ├── build.mjs         # esbuild 构建 → lib/{index.js,client.js}（loader 包装）
    ├── smoke.mjs         # 运行时冒烟（9 场景，对生成产物跑）
    ├── patch-apiproxy.mjs # 把 notifications 注入 apiproxy 白名单
    └── release.mjs       # 发布流水线：build → smoke → pack → publish
```

## License

MIT

---

# dsh-web-notify (English)

[中文版](#dsh-web-notify) · Chinese by default

> Built on the **DeepSeek Harness** (official cordis / `@deepseek-ai/dsh-*` plugin stack) against event frames produced by the **DeepSeek-V4-Flash-0731** model parameters.
>
> **DeepSeek Harness is currently in a fast-iterating dev-preview phase.** Mounting this plugin via the **dev / debug mode** (`link:` local repo) is recommended: after `npm run build` changes land immediately, and `window.__NOTIFICATIONS__` diagnostics makes troubleshooting smoothest. An npm one-shot install is also provided as an alternative.

**Approval-attention plugin for the DSH Web GUI**: whenever any session has a pending approval / plan-review / question, the browser rings back — chime, tab-title + favicon badge, OS notification, and a corner dock all surface the event at once. The detection pipe covers every session row including subagents; delegated subagents cannot actually raise approval/question waits under the current runtime delegation policy (see "Subagent notification reachability" below) while their completion / failure / runtime-error alerts work normally. Completions, job failures, disconnects, and model/tool runtime errors (429 quota, etc.) also alert.

Pure plugin form: a host half (`lib/index.js`) plus a browser half (`lib/client.js`, loader format), mounted via a profile patch.

## Quick start (recommended path)

```
(1) Clone → install deps → build artefacts
        ↓
(2) Link repo root into the web profile
        ↓
(3) Whitelist the settings namespace (patch script)
        ↓
(4) Restart `dsh web` → find the "Notifications" card in Settings →
    turn channels / volume / quiet-hours on and off as you like
        ↓
(5) In DevTools console, inspect `window.__NOTIFICATIONS__`:
       applied / cardRegistered / monitors / lastHeartbeatAt
       hostStatuses / hostStatusCounts ← job status vocab the host emits
       feedCounters                    ← per-event counters
       jobSamples / seenStatuses       ← browser-side sample ring
       demo() / demoSound()            ← one-shot UI / audio demos
```

## Use cases

### 1. Pending approval / plan-review / question arrives

Fires on a `pendingInteraction` edge for any session (including never-opened subagents). The same (session, kind) is not re-alerted during the cooldown window (default 5 s).

| Channel | Behaviour |
|---|---|
| Chime | WebAudio tri-tone: E5–G5–B5 |
| Tab title | `⚠ N approval pending — <original title>`; a MutationObserver fights the shell's own title writes |
| Tab Favicon | 32×32 red badge with white digits (a plain red dot when count > 9) |
| OS notification | Deduplicated per-session via a tag; **click jumps to the session and focuses the window**; `approval` notifications set `requireInteraction: true` so they stay until handled |
| PWA taskbar badge | When installed as a PWA, the taskbar/app icon shows the count (`navigator.setAppBadge`) |
| Notifications dock | A corner FAB with a live count, plus an expandable panel listing **every** pending item; coloured dots per (title, kind); a one-tap "Handle" jumps to the session; auto-collapses at zero; the FAB pulses on new arrivals |

**Current-session degrade**: while the page is visible and the new pending item belongs to the currently open session, chime + OS notify are silenced (you're looking right at it), only the visual surfaces stay active. Switching tabs or minimising restores the full surface.

**Subagent notification reachability**: the session list is one flattened lineage table (subagent rows with `origin: 'subagent'` nest under their `parentSessionId`), so the detection pipe covers subagent rows by construction — any `pendingInteraction` on a subagent row would fire every channel (chime / badge / OS notify / dock). Under the current DSH delegation semantics, however, a delegated subagent can never actually produce one of the three pending states:

- **Approval**: `dsh-subagent` pins the child's approval policy to `'never'` at the delegation boundary (regardless of the parent's policy), so any approval-requiring operation (e.g. a sandbox escalation) is deterministically rejected — no `approval/requested` frame is ever emitted, hence no `pendingInteraction`;
- **Question / plan-review**: `dsh-user-questions` throws `DELEGATED_CALLER` for callers owned by another live agent, so a subagent can only fold the unresolved question into its final result for the parent to ask; plan-review is merely the `intent.kind === 'plan-review'` classification of a question frame and cannot occur either;
- As a result only **parent-session** approval entries can ever show up in the notification dock — a subagent row never lights up a pending marker.

By contrast, subagent **completions, job failures and model/tool runtime errors** ride the `session/event` stream and the jobs grouping, which cover every session, and alert normally.

### 2. Session / subagent completes

A session finishes on `turn/end` → completion toast card (top-right, "done" variant) + a single completion chime + optional OS notify.

- Visible + current session completion: toast + OS notify are silenced, a soft completion chime plays as a safety net (you might have scrolled away)
- Hidden page: no toast (nobody sees it) — tab-title pulse + PWA badge + chime + OS notify instead

### 3. Job failure

Any job in `jobsBySession` whose status is `failed` / `killed`, or `completed` with a non-empty, non-`exit code: 0` detail (the DSH real-machine abnormal-terminal mapping) → error-variant toast + chime + optional OS notify. Reported once per registered job id.

### 4. Model / tool runtime errors (429 quota, etc.)

The host subscribes to the official `session/event` stream and catches: `llm/retry` (429 / rate-limit), `turn/end` flavours `error` / `max-tokens` / `interrupted`, and `tool/result` with `error` or `isError` content → error-variant toast carrying the raw provider message (capped at 240 chars) + chime + optional OS notify. Deduplicated per (session, kind) during the cooldown.

### 5. Disconnect / reconnect

The shared `connection` service stays down for longer than `connectionAlertAfterMs` (default 10 s) → warning toast + chime. On reconnect, a light toast + completion chime. Quick blips that never cross the threshold stay silent. Boot phases where it was never connected never alert.

## Configuration

The settings card registers under **Plugin settings → Notifications** in the DSH Web Settings page (official `settings.plugin.item` slot). Changes take effect hot (120 ms debounce, no restart).

| Field | Type | Default | Description |
|---|---|---|---|
| `sound` | boolean | `true` | Chime master switch |
| `volume` | number 0–1 | `0.15` | Chime loudness |
| `badge` | boolean | `true` | Tab-title badge + Favicon badge + PWA taskbar badge (one shared switch) |
| `toast` | boolean | `true` | One-shot corner toasts (completion / failure / disconnect) |
| `notify` | boolean | `true` | OS notify master switch; `Notification` permission is requested on the next user gesture after the first trigger |
| `dock` | boolean | `true` | Notifications dock: corner FAB + expandable panel |
| `completion` | boolean | `true` | ① Session / subagent completion alerts |
| `completionSound` | boolean | `true` | Play a soft chime on completion |
| `completionNotify` | boolean | `true` | Also send an OS notify on completion |
| `connection` | boolean | `true` | ② Disconnect / reconnect alerts |
| `connectionAlertAfterMs` | number ≥1000 | `10000` | Milliseconds of outage before alerting |
| `jobFailure` | boolean | `true` | ③ Background job failure alerts |
| `failureNotify` | boolean | `false` | Shared OS-notify switch for ③ failures + ④ runtime errors |
| `agentError` | boolean | `true` | ④ Model / tool runtime errors: 429 quota, output limit, interruption, tool failure |
| `cooldownMs` | number ≥0 | `5000` | Per-session per-kind dedupe window |
| `alertKinds` | string[] | `["approval","plan-review","question"]` | Kind whitelist for pending alerts |
| `quiet` | object | `{enabled:false, start:"23:00", end:"08:00"}` | Quiet hours (only mutes; visual surfaces stay) |
| `soundResolved` | boolean | `false` | Soft downstream chime when a pending approval resolves |
| `diagnostics` | boolean | `true` | On-device observer (last 60 session snapshots incl. job status; the status set is always auto-collected) |

**A few common recipes**:

- **Approvals only, no failures / disconnects**: `completion=false`, `connection=false`, `jobFailure=false`, `agentError=false`
- **Just the chime, hate popping cards**: `toast=false`, `notify=false`, keep `sound + badge + dock`
- **Late-night silence**: `quiet.enabled=true`, `quiet.start=22:00`, `quiet.end=09:00` — chimes fully off, visuals remain
- **Only PWA / taskbar, OS notify is too loud**: `notify=false`, `badge=true`, `dock=true`

## Install

DSH plugins are installed into a **profile** via the `dsh plugin` command (`dsh web` uses the `web` profile). Given the DeepSeek Harness is currently in a fast-iterating dev-preview phase, the **dev / debug mode mount is recommended** for immediate iteration and diagnostics troubleshooting. An npm one-shot install is also provided as an alternative.

### Method 1: dev / debug mode mount (recommended right now)

```sh
# 1. clone the repo
git clone https://github.com/renpengfei1027/dsh-web-notify.git
cd dsh-web-notify

# 2. install dependencies and build (Node.js >= 22 required)
npm install
npm run build

# 3. link the repo root into the web profile
dsh plugin --profile web add link:$(pwd)

# 4. restart `dsh web` — a standalone Notifications card
#    appears under Settings → Plugin settings
dsh web
```

### Method 2: npm one-shot install

```sh
dsh plugin --profile web add dsh-web-notify
```

### Whitelist the settings namespace (optional, but recommended)

DSH's own `WEB_SETTINGS_NAMESPACES` inside `dsh-host-apiproxy` is a hardcoded allowlist — third-party namespaces are read-only by default. Run the patch script once to inject `notifications` into the allowlist:

```sh
node scripts/patch-apiproxy.mjs
```

Afterwards the settings card is read+write. Without this patch the card falls back to read-only and `DEFAULTS` apply. **Re-run after every `dsh` upgrade**; the script is idempotent and can also upgrade an earlier `approval-alerter` allowlist in-place.

### Diagnostics for debugging

Once the plugin has loaded, open the DSH Web DevTools console:

```js
// Mounting health
> __NOTIFICATIONS__.applied, __NOTIFICATIONS__.cardRegistered
  true, true

// Which settings binder we got; are sessions/connection services available?
> __NOTIFICATIONS__.binder, __NOTIFICATIONS__.sessions, __NOTIFICATIONS__.connAvailable
  "settingsScope", true, true

// Host event-feed health (heartbeat ~ every 30 s; a stale lastHeartbeatAt means the host feed broke)
> __NOTIFICATIONS__.feedCounters, __NOTIFICATIONS__.lastHeartbeatAt
  { heartbeat: 4, "agent-error": 1, … }, 1756789012345

// Complete job-status vocabulary emitted by the host — use it to double-check
// which terminal states the sentinel/lifecycle guards react to.
> __NOTIFICATIONS__.hostStatuses, __NOTIFICATIONS__.hostStatusCounts
  ["failed","killed","completed","running",…], { completed: 8, failed: 2, … }

// Browser-side samples (captured while diagnostics=true; last 60 frames)
> __NOTIFICATIONS__.jobSamples[0]
  { ts, sessionId, sessionTitle, jobs: [{ jobId, status }], alerts: [] }

// One-shot UI / audio demos (confirm surfaces are wired and audio can play)
> __NOTIFICATIONS__.demo("error")     // push an error-variant card
> __NOTIFICATIONS__.demoSound(0.3)    // completion chime at a given volume
```

### Take effect

**Plugin-roster changes require `dsh web` to be restarted** — a page refresh alone never registers a new package (the official client-modules docs explicitly state package metadata is cached by name and never expires). A whitelist patch also needs a restart.

### Verify

1. Under **Plugin settings** in the Settings page, a standalone **Notifications** card appears with editable fields
2. Trigger a pending approval: the tab title shows `⚠ 1 approval pending — `, favicon draws a red `1`, the corner dock FAB + list appear, the tri-tone chime plays, and an OS notification pops (allow on first time)
3. Click the OS notification or "Handle" on a dock row → window focuses and that session opens
4. Finish a session: a completion toast appears top-right + the single completion chime
5. DevTools console shows `[notifications]` log lines; `window.__NOTIFICATIONS__` exposes the apply breakdown + `jobSamples` ring

### Uninstall

```sh
dsh plugin --profile web remove dsh-web-notify
```

…or remove the insert row from the profile's `cordis.patch.yml` and delete the `node_modules` junction.

## Limits

- Granularity is **session-level** for pending (list rows only carry a kind state); job failures reach job-level (command label + exit detail); model/tool errors carry the event-stream raw message capped at 240 chars
- Subagent reachability: subagent rows sit inside the detection pipe (same flattened lineage table), but a delegated subagent's approval policy is pinned to `'never'` and user questions are rejected — no approval/plan-review/question entries ever appear for subagents, only parent-session ones; completion / failure / runtime-error alerts still cover subagents (see "Subagent notification reachability" above)
- Chimes need a prior user gesture on the page (browser autoplay policy); without one it silently degrades to visual surfaces only
- OS-notify permission is requested on the first click after the first trigger; if nothing ever appears on Windows, check the browser site settings (127.0.0.1 notify permission) and Windows Focus Assist
- The card rides the settings scope; if the host apiproxy hasn't whitelisted the namespace, the card is read-only and `DEFAULTS` apply

## Project layout

```
dsh-web-notify/
├── package.json          # dsh.client.platform=web + inject + dsh.bundle.patch
├── cordis.patch.yml      # plugin-row insert
├── src/
│   ├── index.ts          # host half: settings NS + systemPrompt notice + event forwarder
│   └── client/           # browser half (zero @deepseek-ai runtime deps)
│       ├── index.ts      #   entry: apply/inject/mount + settings-scope hot reconfig + card
│       ├── types.ts      #   local types + DEFAULTS
│       ├── locales.ts    #   zh/en dicts + minimal t()
│       ├── channels.ts   #   WebAudio chime / quiet-hours / OS notify / jumpToSession
│       ├── badge.ts      #   title badge + canvas favicon badge + PWA badge
│       ├── stores.ts    #   uSES stores for toast + dock
│       ├── toast-ui.tsx  #   toast cards + stack
│       ├── toast-mount.tsx
│       ├── sentinel.ts   #   pending-edge sentinel (dock owns visuals; just pulses)
│       ├── lifecycle.ts  #   ① completion + ③ job-failure + ② connection monitor
│       ├── dock.ts       #   dock FAB + panel + mount + startDock
│       └── settings-card.tsx # settings card
└── scripts/
    ├── build.mjs         # esbuild → lib/{index.js,client.js} (loader-wrapped)
    ├── smoke.mjs         # runtime smoke (9 scenarios, runs on built artefacts)
    ├── patch-apiproxy.mjs # inject notifications into apiproxy allowlists
    └── release.mjs       # release pipeline: build → smoke → pack → publish
```

## License

MIT
