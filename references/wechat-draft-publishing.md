# 保存到微信公众号草稿箱

本流程只创建草稿，不执行群发。草稿保存属于外部写入，必须在本地文章全部验收通过后，针对当前内容指纹单独取得用户确认。

## 依赖边界

`xpc-wechat-writer` 负责文章质量、确认点、清单、幂等保护和结果记录。账号配置、凭据、图片上传、微信 API、远程 API 和浏览器操作由独立的 `baoyu-post-to-wechat` Skill 负责。

第一次保存草稿前：

1. 运行 `node <xpc-skill-dir>/scripts/resolve_post_to_wechat.mjs`。
2. 完整阅读返回目录中的 `SKILL.md`。
3. 按该 Skill 的规则读取已生效的 `EXTEND.md`；没有配置时完成首次配置。
4. 多账号场景解析明确的账号别名，不猜测目标公众号。
5. 凭据只保留在发布 Skill 的本机配置中，不写进文章目录、命令参数、日志或学习记录。

找不到依赖时停止草稿阶段，保留已经完成的本地交付。不要复制发布源码或凭记忆实现微信接口。

## 发布输入

发布前必须存在并通过检查：

- `article.md` 中的最终标题和不超过 120 字的摘要
- `article-formatted.html` 中经 `gzh-design` 校验的单根 `<section>` 正文
- `imgs/cover.png`
- 全部正文图片
- `qa-report.md`
- `verify_writing.mjs` 和 `verify_delivery.mjs` 的通过结果

使用 `article-formatted.html`，不要把复制工作台 `article.html` 当作公众号正文。

## 准备与确认

运行：

```bash
node <xpc-skill-dir>/scripts/prepare_wechat_draft.mjs \
  <article-dir> \
  --method api \
  --account <alias>
```

方法只能是 `api`、`remote-api` 或 `browser`。优先使用发布 Skill 本机配置中已经确定的方法；没有配置时推荐 API。不要在一次结果不明确的提交后自动切换方法。

准备成功后向用户展示：

```text
公众号草稿准备完成
账号：<alias>
方式：API / Remote API / Browser
标题：<title>
摘要：<summary>
正文图片：<count>
封面：imgs/cover.png
内容指纹：sha256:<64 hex>

回复“保存到草稿”后才执行本次提交。
```

确认只对这次展示的账号、方式和完整内容指纹有效。标题、摘要、正文 HTML 或封面变化后必须重新准备并再次确认。只回复「确认」且上下文不是当前草稿摘要时，不得视为保存授权。

## 保存

收到明确确认后运行：

```bash
node <xpc-skill-dir>/scripts/save_wechat_draft.mjs \
  <article-dir> \
  --confirm-fingerprint <完整指纹> \
  --method <已展示方法> \
  --account <已展示账号别名>
```

适配器只调用一次，不自动重试，不自动切换 API 与浏览器，不自动群发。

## 状态机

`wechat-draft.json` 只允许：

```text
prepared -> submitting -> saved
                      -> failed
                      -> unknown
```

- `prepared`：本地输入和 QA 已检查，尚未调用微信。
- `submitting`：已经记录唯一尝试编号，正在调用微信。
- `saved`：微信明确返回成功。API 记录 `media_id`；浏览器记录 `appmsgid`。
- `failed`：仅用于可以明确证明没有创建草稿的失败。修复后仍需重新准备和确认。
- `unknown`：进程中断、超时、响应无法解析或本地结果落盘失败，无法确定微信端状态。

当前适配器对发布脚本的非成功或不可解析结果采用保守策略，记录为 `unknown`。进入 `unknown` 后禁止自动重试，先让用户登录公众号草稿箱核查。

状态为 `saved` 且内容指纹相同时禁止重复提交。若用户明确要求创建副本，先说明会产生重复草稿，再重新准备并取得新的明确授权。

## 方法差异

- API 和远程 API 成功返回 `media_id`，能够显式上传 `imgs/cover.png`。
- 浏览器方式成功返回 `appmsgid`。现有浏览器脚本不能保证自动设置公众号外部封面，因此写入 `cover_verification_required: true`，最终结果必须提示用户人工核对封面。

## 最终报告

无论草稿是否成功，本地文章交付状态保持独立。报告：

- 本地 `article.html`、`article.md`、`qa-report.md`
- `wechat-draft.json`
- 草稿状态和方法
- 成功时的 `media_id` 或 `appmsgid`
- 浏览器方式的封面核对提醒
- `failed` 或 `unknown` 的安全后续动作

不得输出凭据、访问令牌、Cookie、浏览器会话、SSH 私钥内容或完整命令环境。
