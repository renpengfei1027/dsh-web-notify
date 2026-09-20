# dsh-harness-notifier — DeepSeek Harness 通知插件

DSH Web GUI 的注意力插件：**待审批 / 待回答提问 / 回合结束 / 会话异常 / 连接恢复**时，
在浏览器内多通道提醒——提示音、标签页标题徽标 + PWA 徽标、OS 通知、通知中心 dock、toast。
所有配置在 GUI「设置 → 插件配置 → 通知」卡片热调整，无需重启。

> 本插件是 `dsh-web-notify`（npm 0.1.x）的当前机制重制版（M1）：
> 去掉了「改 `@deepseek-ai/dsh-api-remotes` 包文件加转发白名单」的补丁——当前版本的
> 官方转发名单 `API_REMOTE_FORWARDED_EVENTS` 已包含检测所需的全部事件，浏览器端
> `ctx.remote.$on` 直接订阅即可。旧版依赖的 `@deepseek-ai/dsh-settings`
> （settingsNamespace / installSettingsSection）也已不在当前部署中。

## 原理

| 部分 | 职责 |
|---|---|
| `lib/index.js`（宿主，Node 侧） | 注册 `notifications` 设置节（GUI 卡片按该命名空间派发）；注册 systemPrompt presence 节告知模型 |
| `lib/client.js`（浏览器侧） | 订阅官方转发事件驱动提醒：`approval/request`、`user-questions/request`（waterfall 观察者，`return next()` 绝不代答）、`api-session/status`（回合结束 + 待处理清除）、`api-session/error`、`api-session/activity`（用户介入即清除）、`settings/document-updated`（配置热刷新）、`connection/reset`（恢复提醒）；UI 落点：`shell.overlay`（dock + toast）、`settings.plugin.item`（key = `notifications` 设置卡片） |

### 行为细节

- **waterfall 车道必须 prepend 抢位**：cordis waterfall 的首个返回值即终止整条链。
  官方审批/问答 UI 的应答器返回 `await pending.result`，普通 `$on` 注册的观察者排在
  它之后**永远收不到事件**（v0.1.x 初版"审批/提问没提醒"的根因）。`$on` 底下只是往
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
  也可在设置卡片手动申请。被浏览器拒绝后只能去站点权限设置里放开。
- **链路自证**：设置卡片「发送测试系统通知」一键验证 授权 → Windows 横幅 全链路；
  `window.__NOTIFIER_DIAG__.os`（attempt/sent/skipPermission/skipDisabled/lastSkip）
  与 `lastVisibility` 记录每次系统通知的派发结果和页面可见性变化。
- 提示音走 WebAudio，浏览器要求先有一次页面手势；插件在首次 pointerdown 时预热。
- 诊断：开启后 `window.__NOTIFIER_DIAG__` 暴露配置、待处理、计数与最近错误。

## 安装 / 更新（开发模式）

```powershell
dsh plugin --profile web add link:D:\developer\flipped.ren\flipped.ren\dsh-plugins\harness-notifier
```

之后重启 `dsh web`。验收：

1. 「设置 → 插件配置」出现**通知**卡片
2. 触发一次需要审批的操作 → 提示音 + 标签页标题出现 `(N)` + 右下角铃铛 + toast
3. 铃铛展开通知中心，「前往」跳转对应会话
4. OS 通知：卡片里申请权限后，浏览器窗口最小化也能收到系统通知

## 目录

```
dsh-plugins/harness-notifier/
├── package.json          # dsh.bundle.patch + dsh.client（platform: web, immediately）
├── cordis.patch.yml      # 插件行：id notifications / name dsh-harness-notifier
├── lib/index.js          # 宿主半区（settings 节 + presence）
├── lib/client.js         # 浏览器半区（检测 + 六通道 + 设置卡片）
└── README.md
```

纯手写 JS，无构建链：宿主为 ESM（`"type": "module"`），客户端为
`window.__ModuleLoader__.load({ id, factory })` 协议的 classic script，
`require("react")` 走客户端模块表 baseline。

本地自检（假 DOM + 假 ctx，验证协议注册、事件订阅面、卡片写入三参调用）：

```sh
cd dsh-plugins/harness-notifier && npm run check
```

### 设置卡片写入链路

所有保存都经 `cardWrite`：**乐观回显**（受控输入立即生效，不等服务端往返）
→ **150ms 合并**（拖动音量/键入冷却只发最后一次）→
`ctx.remote.settings.update(ns, patch, void 0)`（网关按 descriptor 严格校验
参数数，第三参是 `expectedRevision: number | undefined`，传 `undefined` 表示
无条件写；`describe()` 同样按精确参数数调用）。服务器值经 describe 落地后
清空乐观层。

## 路线图

| 阶段 | 内容 |
|---|---|
| M1（本版） | 零补丁页内六通道 + 设置卡片 |
| M2 | 宿主权威决策层（pending 状态机 / 去重 / 免打扰下沉宿主）+ Windows toast 出页通道 |
| M3 | Webhook 手机推送（Bark / ntfy / Server酱 / 自定义模板，secrets 走 `role('secret')`） |
| M4 | `notify` 模型工具：agent 在长任务关键节点主动呼叫人 |

## 注意

- 设置节命名空间沿用 `notifications`，与旧版 `dsh-web-notify` 的用户配置字段兼容
  （`settings.yaml` 里的旧配置直接生效；旧版宿主 feed 专属字段被忽略）。
- 安装会改 `~/.dsh/profiles/web/cordis.patch.yml`（由 `dsh plugin add` 完成），
  不要手动编辑。
- M1 检测在浏览器侧：页面关闭时页内提醒天然失效——这正是 M2/M3 出页通道的动机。
