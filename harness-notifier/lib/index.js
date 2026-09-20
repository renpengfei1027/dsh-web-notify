// dsh-harness-notifier — host half（Node 侧）
//
// M1 职责（刻意保持最小）：
//   1) 注册 `notifications` 设置节 —— GUI「设置 → 插件配置 → 通知」卡片按这个
//      命名空间派发（dsh-client-ui-settings-plugins 以 ns 作为
//      settings.plugin.item 的 entryKey），浏览器半区通过
//      ctx.remote.settings.describe/update 读写同一节；
//   2) systemPrompt presence 节 —— 告知模型本插件已安装、提醒覆盖哪些事件。
//
// 检测面在浏览器半区（lib/client.js）：直接订阅官方转发的
// approval/request、user-questions/request、api-session/status、
// api-session/error、api-session/activity 事件 —— 当前版本的
// API_REMOTE_FORWARDED_EVENTS 已包含它们，因此不需要旧版
// dsh-web-notify 的「改 dsh-api-remotes 包文件加白名单」补丁。
//
// 注意：设置节 ns 使用普通字符串。旧插件依赖的 @deepseek-ai/dsh-settings
// （settingsNamespace/installSettingsSection 助手）已不在本部署的物理
// node_modules 中，运行时 seam 只需要一个字符串键。
import z from "@deepseek-ai/schemastery";

export const name = "dsh-harness-notifier";

/** 硬依赖：settings 注册设置节；systemPrompt 注册 presence 节。 */
export const inject = ["settings", "systemPrompt"];

/** 设置节命名空间（浏览器半区与 GUI 卡片按同一 ns 读写）。 */
export const SETTINGS_NAMESPACE = "notifications";

/** presence 节在 tool-guidance 带内的排序。 */
const SECTION_ORDER = 120;

/** 模型可见的插件说明。 */
export const GUIDANCE =
	"本机已安装 dsh-harness-notifier 插件（DSH Web GUI 的「通知」）：当任意会话出现待处理审批或待回答提问时，" +
	"浏览器会播放提示音、在标签页标题与 PWA 徽标上显示待处理数量、弹出通知中心（可展开并跳转对应会话）。" +
	"回合结束（等待用户输入）、会话异常、连接恢复时也会以 toast / 提示音提醒。" +
	"提醒只负责「叫人」，不代替用户回答审批或提问；请在对应会话中处理。" +
	"通道与免打扰时段可在 GUI「设置 → 插件配置 → 通知」卡片热调整。";

/**
 * 设置节 schema。默认值与浏览器半区的 DEFAULTS 保持一致；
 * 字段名沿用旧 dsh-web-notify 的用户配置（同名节可直接迁移）。
 * M1 仅保留页内通道字段；M2/M3 的宿主出页通道字段（windowsToast、webhook）
 * 届时向后兼容地追加。
 */
export const Config = z.object({
	sound: z.boolean().default(true).description("待审批/提问提示音"),
	volume: z.number().min(0).max(1).default(0.15).description("提示音音量 0-1"),
	badge: z.boolean().default(true).description("标签页标题与 PWA 徽标"),
	toast: z.boolean().default(true).description("页内 toast 提醒"),
	notify: z.boolean().default(true).description("浏览器 OS 通知（需授权）"),
	escalateOnHidden: z.boolean().default(true).description("页面不可见时自动升级为系统通知"),
	dock: z.boolean().default(true).description("右下角通知中心"),
	completion: z.boolean().default(true).description("回合结束提醒"),
	completionSound: z.boolean().default(true).description("回合结束提示音"),
	completionNotify: z.boolean().default(true).description("回合结束 OS 通知"),
	connection: z.boolean().default(true).description("连接恢复提醒"),
	agentError: z.boolean().default(true).description("会话异常提醒"),
	cooldownMs: z.number().min(0).default(5000).description("同类提醒冷却（毫秒）"),
	diagnostics: z.boolean().default(false).description("在 window.__NOTIFIER_DIAG__ 暴露诊断"),
	alertKinds: z
		.array(z.string())
		.default(["approval", "plan-review", "question"])
		.description("待处理提醒类别：approval / plan-review / question（plan-review 与 question 同走提问事件）"),
	quiet: z
		.object({
			enabled: z.boolean().default(false),
			start: z.string().default("23:00"),
			end: z.string().default("08:00")
		})
		.default({ enabled: false, start: "23:00", end: "08:00" })
		.description("免打扰时段（HH:mm，可跨零点）")
});

/** 宿主插件入口。 */
export function apply(ctx) {
	// 设置节：注册后 GUI 插件配置页与 ctx.remote.settings 即可读写本节。
	// register 返回 SettingsScope（非 disposer），旧插件同样不持有其生命周期。
	ctx.settings.register(SETTINGS_NAMESPACE, Config);

	// presence：随 Fiber 自动移除。
	ctx.effect(
		() =>
			ctx.systemPrompt.section({
				name: "plugin:notifications",
				order: SECTION_ORDER,
				text: GUIDANCE
			}),
		"dsh-harness-notifier: presence section"
	);
}

const plugin = { name, inject, apply };
export default plugin;
