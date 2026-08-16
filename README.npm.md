# dsh-web-notify

[![npm version](https://img.shields.io/npm/v/dsh-web-notify.svg)](https://www.npmjs.com/package/dsh-web-notify)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

DSH Web GUI 审批注意力插件 — 待处理审批、会话完成、任务失败、连接断线时，通过提示音、标签页徽标、OS 通知、通知中心 Dock 多通道提醒。

## 安装

```sh
# npm 一键挂载
dsh plugin --profile web add dsh-web-notify

# 或开发调试模式
git clone https://github.com/renpengfei1027/dsh-web-notify.git
cd dsh-web-notify
npm install && npm run build
dsh plugin --profile web add link:$(pwd)
```

安装后重启 `dsh web`，设置页「插件配置」→「通知」卡片可热配置所有通道、音量、免打扰时段。

## 功能

- 🔔 待处理审批 / 提问 → 提示音 + 标签页徽标 + OS 通知 + Dock
- ✅ 会话完成 → toast + 完成音
- ❌ 任务失败 / 模型异常(429等) → error toast + 提示音
- 📡 断线 / 重连 → warning toast + 提示音

## License

MIT
