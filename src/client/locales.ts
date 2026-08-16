/**
 * Dictionary namespace + plural dictionaries for the alerter's self-owned UI.
 */
export const NS = 'notifications'

/** All dictionary keys this plugin emits (zh is the key-set source of truth). */
export type LocaleKey = keyof typeof zh

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'kind.approval': '审批',
  'kind.planReview': '计划审批',
  'kind.question': '提问',
  'toast.waiting': '等待处理',
  'toast.pending': '待处理',
  'toast.go': '去处理',
  'toast.dismiss': '忽略',
  // OS-notification titles & bodies (per-event, so the system notification
  // tray at a glance reveals what happened — no more "completed needs action").
  'notify.pending.title': 'DSH 等待处理',
  'notify.pending.body': '会话「{title}」有{kind}等待你的处理',
  'notify.completion.title': 'DSH 任务完成',
  'notify.completion.body': '会话「{title}」已完成',
  'notify.failure.title': 'DSH 任务失败',
  'notify.failure.body': '会话「{sessionTitle}」的任务「{label}」失败{detail}',
  'notify.error.title': 'DSH 任务异常',
  'notify.error.body': '{kindLabel}{tool} — 会话「{title}」{message}',
  'title.badge': '⚠ {count} 待审批 — ',
  'dock.title': '通知',
  'dock.close': '收起',
  'dock.all': '共 {count} 项待处理',
  'completion.title': '任务完成',
  'completion.body': '会话「{title}」已完成',
  'conn.lost': '连接断开,正在重连',
  'conn.restored': '已重新连接',
  'job.failed': '任务失败',
  'job.body': '{label}{detail}',
  'agent.error': '任务异常',
  'agent.error.tool': '工具执行失败',
  'agent.error.turn': '任务执行失败',
  'agent.error.maxTokens': '达到输出上限',
  'agent.error.interrupted': '执行意外中断',
  'agent.error.llmRetry': '模型请求失败',
  'demo.title': '演示卡片',
  'demo.body': '一次性事件卡片(点「忽略」关闭)',
  // ---- settings card (family-shared chrome copy) ----
  'settings.title': '通知',
  'settings.description': '审批、提问等待处理,以及完成、失败、断线的提醒方式',
  'settings.collapse': '收起',
  'settings.expand': '展开',
  'settings.notExposed': '设置服务未开放该命名空间,卡片不可编辑(默认配置生效)',
  'settings.unsaved': '未保存',
  'settings.readOnly': '当前文档不允许写入,卡片只读',
  'settings.saveFailed': '保存未生效,请检查后再试',
  'settings.discard': '丢弃',
  'settings.save': '保存',
  'settings.saving': '保存中…',
  'settings.overridden': '已覆盖',
  'settings.reset': '重置',
  'settings.inherit': '继承',
  'settings.on': '开',
  'settings.off': '关',
  'settings.invalidNumber': '无效数字',
  // ---- settings card fields ----
  'settings.field.sound': '提示音',
  'settings.field.soundHint': '待处理事项到达时播放提示音',
  'settings.field.volume': '音量',
  'settings.field.volumeHint': '提示音大小(0 静音,1 最大)',
  'settings.field.badge': '标签页标题徽标',
  'settings.field.badgeHint': '待处理时在标签页标题显示 ⚠ 计数;安装为 PWA 后系统图标同步显示',
  'settings.field.toast': '一次性事件卡片',
  'settings.field.toastHint': '完成/失败/断线等一次性事件的右下角轻提示',
  'settings.field.notify': 'OS 通知',
  'settings.field.notifyHint': '需浏览器允许 127.0.0.1 发送通知',
  'settings.field.dock': '通知 Dock',
  'settings.field.dockHint': '待处理项统一收进右下角 Dock,不再逐条弹卡片',
  'settings.field.completion': '① 完成提醒',
  'settings.field.completionHint': '会话/子代理完成时提醒',
  'settings.field.completionSound': '完成提示音',
  'settings.field.completionSoundHint': '完成事件同时播放提示音',
  'settings.field.completionNotify': '完成走 OS 通知',
  'settings.field.completionNotifyHint': '完成事件同时发 OS 通知',
  'settings.field.connection': '② 掉线/重连提醒',
  'settings.field.connectionHint': '断线超过阈值后提醒,恢复时轻提示',
  'settings.field.connectionAlertAfterMs': '断线提醒阈值',
  'settings.field.connectionAlertAfterMsHint': '断线持续超过该毫秒数才提醒',
  'settings.field.jobFailure': '③ 任务失败提醒',
  'settings.field.jobFailureHint': '后台任务非零退出或中断时提醒',
  'settings.field.failureNotify': '失败/异常走 OS 通知',
  'settings.field.failureNotifyHint': '③ 任务失败与 ④ 任务异常共用一个系统通知开关',
  'settings.field.agentError': '④ 任务异常提醒',
  'settings.field.agentErrorHint': '模型/工具运行异常:429 配额超限、达到输出上限、执行中断、工具执行失败',
  'settings.field.cooldownMs': '同会话去重冷却',
  'settings.field.cooldownMsHint': '同一会话同一类事件在此间隔内只提醒一次',
  'settings.field.diagnostics': 'on-device 观测仪',
  'settings.field.diagnosticsHint': '采样最近 60 次会话快照(含 job 状态),用于排查;状态集合始终自动收集',
} as const

/** English dictionary, checked complete against the zh key set. */
export const en: Record<LocaleKey, string> = {
  'kind.approval': 'approval',
  'kind.planReview': 'plan review',
  'kind.question': 'question',
  'toast.waiting': 'waiting',
  'toast.pending': 'pending',
  'toast.go': 'Handle',
  'toast.dismiss': 'Dismiss',
  'notify.pending.title': 'DSH action required',
  'notify.pending.body': '{kind} is waiting in session “{title}”',
  'notify.completion.title': 'DSH task done',
  'notify.completion.body': 'Session “{title}” has completed',
  'notify.failure.title': 'DSH task failed',
  'notify.failure.body': 'Task “{label}” in “{sessionTitle}” failed{detail}',
  'notify.error.title': 'DSH task error',
  'notify.error.body': '{kindLabel}{tool} — “{title}”{message}',
  'title.badge': '⚠ {count} approval pending — ',
  'dock.title': 'Notifications',
  'dock.close': 'Close',
  'dock.all': '{count} pending total',
  'completion.title': 'Done',
  'completion.body': 'Session “{title}” finished',
  'conn.lost': 'Connection lost — reconnecting',
  'conn.restored': 'Reconnected',
  'job.failed': 'Task failed',
  'job.body': '{label}{detail}',
  'agent.error': 'Task error',
  'agent.error.tool': 'Tool failed',
  'agent.error.turn': 'Turn failed',
  'agent.error.maxTokens': 'Output limit reached',
  'agent.error.interrupted': 'Interrupted unexpectedly',
  'agent.error.llmRetry': 'Model request failed',
  'demo.title': 'Demo card',
  'demo.body': 'One-shot event card (tap “Dismiss”)',
  // ---- settings card (family-shared chrome copy) ----
  'settings.title': 'Notifications',
  'settings.description': 'How the GUI alerts you about pending approvals/questions, and about completions, job failures and disconnects',
  'settings.collapse': 'Collapse',
  'settings.expand': 'Expand',
  'settings.notExposed': 'This settings namespace is not exposed; the card is read-only (defaults apply)',
  'settings.unsaved': 'unsaved',
  'settings.readOnly': 'Read-only: this document does not accept writes',
  'settings.saveFailed': 'Save did not land — check your values',
  'settings.discard': 'Discard',
  'settings.save': 'Save',
  'settings.saving': 'Saving…',
  'settings.overridden': 'overridden',
  'settings.reset': 'Reset',
  'settings.inherit': 'inherit',
  'settings.on': 'On',
  'settings.off': 'Off',
  'settings.invalidNumber': 'invalid number',
  // ---- settings card fields ----
  'settings.field.sound': 'Chime',
  'settings.field.soundHint': 'Plays a chime when something needs attention',
  'settings.field.volume': 'Volume',
  'settings.field.volumeHint': 'Chime loudness (0 silent, 1 loudest)',
  'settings.field.badge': 'Title badge',
  'settings.field.badgeHint': 'Shows a ⚠ count in the tab title while pending; synced to the app icon when installed as a PWA',
  'settings.field.toast': 'One-shot event toasts',
  'settings.field.toastHint': 'Corner toasts for one-shot events: completion, failure, disconnect',
  'settings.field.notify': 'OS notifications',
  'settings.field.notifyHint': 'Requires the browser to allow 127.0.0.1 notifications',
  'settings.field.dock': 'Notifications dock',
  'settings.field.dockHint': 'Pending items collect in the corner dock instead of one toast each',
  'settings.field.completion': '① Completion alerts',
  'settings.field.completionHint': 'Alerts when a session or subagent finishes',
  'settings.field.completionSound': 'Completion chime',
  'settings.field.completionSoundHint': 'Also plays a chime on completion',
  'settings.field.completionNotify': 'Completions via OS notify',
  'settings.field.completionNotifyHint': 'Also sends an OS notification on completion',
  'settings.field.connection': '② Disconnect/reconnect',
  'settings.field.connectionHint': 'Alerts once the outage exceeds the threshold; a light cue on restore',
  'settings.field.connectionAlertAfterMs': 'Disconnect threshold',
  'settings.field.connectionAlertAfterMsHint': 'Milliseconds of outage before alerting',
  'settings.field.jobFailure': '③ Job-failure alerts',
  'settings.field.jobFailureHint': 'Alerts when a background job exits non-zero or is interrupted',
  'settings.field.failureNotify': 'Failures/errors via OS notify',
  'settings.field.failureNotifyHint': 'One shared OS-notify switch for ③ failures and ④ runtime errors',
  'settings.field.agentError': '④ Model/tool error alerts',
  'settings.field.agentErrorHint': 'Model/tool runtime errors: 429 quota, output limit, interruption, tool failure',
  'settings.field.cooldownMs': 'Per-session cooldown',
  'settings.field.cooldownMsHint': 'One alert per session per event kind within this interval',
  'settings.field.diagnostics': 'On-device observer',
  'settings.field.diagnosticsHint': 'Samples the last 60 session snapshots (incl. job status) for diagnosis; the status set is always collected',
}

/** Whichever dictionary matches the browser locale (default zh). */
export let dict: Record<LocaleKey, string> = zh

export function pickDict(): Record<LocaleKey, string> {
  const lang = typeof navigator !== 'undefined' ? navigator.language : ''
  return String(lang).toLowerCase().startsWith('en') ? en : zh
}

/** Activate the locale dictionary for the running browser (called on apply). */
export function setDict(next: Record<LocaleKey, string>): void {
  dict = next
}

/** Interpolation vars for t(). */
export type TplVars = Record<string, string | number>

/** Minimal t() for this plugin's own (non-seat, self-owned) UI. */
export function t(key: LocaleKey, vars?: TplVars): string {
  let text = dict[key] ?? key
  if (vars !== void 0) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value))
    }
  }
  return text
}