# XPC WeChat Writer

一套面向中国普通用户的 AI 公众号长文生产 Skill。它把选题、资料、大纲、正文、去 AI 味、配图、公众号封面和可复制 HTML 串成一条有确认节点的工作流。

## 主要能力

- 基于最近热点生成恰好 5 个选题，并使用 HKR 评分
- 在“选题”和“正式大纲”两个节点等待确认
- 核查官方来源、案例、数据和统计口径
- 使用写前编辑卡、事实锁定、分原型叙事和两轮编辑稳定正文质量
- 借用具体事件切入、层层追问和回环等叙事技术，但不冒充任何作者
- 默认生成 5 张正文图和 2.35:1 公众号封面
- 复杂技术流程图使用可编辑 SVG 精确排版，并导出高清 PNG，支持多步骤、回环、审批与终止分支
- 新文章默认以一张自适应总览图作为正文第一张图，先帮助读者理解全文结构
- 普通正文图使用主题感知的 Knowledge Card 2.0 质量层，同时锁定 1600×900、16:9
- 使用 gzh-design 生成可直接粘贴的公众号正文，支持逐篇选择 6 套主题
- 所选主题同步控制 HTML、正文图和封面，统一配色、线条、卡片形态、留白和字体气质
- 生成适配手机和电脑的 HTML 复制工作台
- 分别复制标题、摘要、正文与图片、封面
- 每篇文章创建独立目录并执行交付验收
- 经逐篇内容指纹确认后保存到微信公众号草稿箱，不自动群发
- 每篇交付后记录复盘，把重复问题转成需批准和回归评测的优化提案

正文不再由一次初稿直接进入去 AI 味。每篇文章会额外生成 `writing-plan.md`、`fact-lock.md` 和 `edit-report.md`，并通过 `verify_writing.mjs` 检查核心判断位置、禁用表达、事实复核和读者动作。

## 复杂技术流程图

当文章需要至少 8 个步骤以及决策、回环、审批、终止、泳道或分组区域时，Skill 会启用 `complex-flowchart` 模式。它不依赖生成式图片猜测中文文字，而是生成可编辑 SVG 源图，再导出最小 2400 × 1200 的 PNG 放入公众号正文。

复杂图仍继承本篇 `gzh-design` 主题，并通过确定性校验检查：

- 步骤、决策、分支、回环和图例声明
- 所有必需中文标签是否真实出现在 SVG 中
- `data-flow-role` 结构标记是否齐全
- SVG 是否包含脚本、外链资源或本机绝对路径
- PNG 是否达到高清尺寸并被正文实际引用

普通插图和低密度流程图继续使用原有图片生成流程，不会被强制做成 SVG。

## 开篇总览图

每篇新文章默认从一张开篇总览图开始。它放在开场和核心判断之后、第一节正文之前，并计入原有 3 至 5 张正文图，不会机械增加第六张图。

Skill 会根据文章选择形式：

- `process-flow`：步骤与执行顺序
- `system-map`：角色、组成和关系
- `architecture-map`：层级与模块
- `decision-map`：条件、选择和分支
- `timeline-map`：变化与演进
- `action-journey`：读者从问题到行动的路径
- `comparison-path`：两种或多种方案的并行路线

普通总览图使用 3 至 7 个主干节点；节点更多且包含分支或回环时才升级为 `complex-flowchart`。用户明确要求某篇不要开篇图时，可以逐篇取消，不会改变长期默认值。

## 正文图 Knowledge Card 2.0 质量层

新文章的普通正文图和普通开篇总览图默认使用 `knowledge-card-2.0-adapted`。它吸收资料卡片 2.0 中有利于公众号阅读的部分：60-30-10 信息层级、充足留白、清晰阅读动线、短标签与容器和具象插画绑定，以及按内容选择流程、层级、环绕、对比、卡片或行动路径构图。

它不会把公众号图片改成小红书 3:4 竖图，也不会强制所有主题变成手账涂鸦风：

- 普通正文图保持 1600×900、16:9
- 封面保持 1800×766、2.35:1，不使用正文图 profile
- 复杂技术流程图保持确定性 SVG、高清 PNG 和规格中声明的比例
- `gzh-design` 主题优先；石墨极简风禁止阴影时，质量层只能使用细线、色块、间距和错层建立层次
- 提示词校验拒绝 3:4、750×1000 和 portrait-only 污染，交付校验确认普通正文 PNG 的实际尺寸

每份正文图提示词还会声明唯一 `Output-PNG`、图片要回答的问题、构图家族、留白、层次、阅读动线和画幅锁。正文引用必须与这些输出一一对应。

## 公众号草稿依赖

本 Skill 复用已安装的 `baoyu-post-to-wechat` 保存公众号草稿，不复制账号凭据或微信接口代码。API 与远程 API 返回 `media_id`；浏览器方式返回 `appmsgid`，并需要人工核对公众号外部封面。

文章全部 QA 通过后才会生成 `wechat-draft.json`。系统先展示账号、发布方式和完整内容指纹，只有收到本篇明确确认后才提交一次。不会自动群发，也不会在结果不明确时自动重试。

## 排版依赖

本 Skill 调用独立的 [gzh-design-skill](https://github.com/isjiamu/gzh-design-skill) 完成主题排版。请先把它安装为全局 Skill：

```bash
npx -y skills@latest add isjiamu/gzh-design-skill \
  --skill gzh-design \
  --agent codex \
  --global \
  --copy \
  --yes
```

正式大纲会给出推荐主题和全部可选主题。可以在确认时直接指定，例如：

```text
确认大纲，排版用石墨极简风
```

只回复「确认」或「按默认配置」时，使用本篇推荐主题，不固定为摸鱼绿。主题确认后会同时应用到排版、正文插图和封面，不再分别套用马卡龙手绘与通用 AI 蓝紫风。

## 安装

推荐使用开源 Agent Skills CLI 从 GitHub 全局安装到 Codex：

```bash
npx -y skills@latest add whxpc123/xpc-wechat-writer \
  --skill xpc-wechat-writer \
  --agent codex \
  --global \
  --copy \
  --yes
```

建议使用 Node.js 22.20 或更高版本。安装完成后验证：

```bash
npx -y skills@latest list --global --agent codex
```

只安装到当前项目，不设为全局 Skill：

```bash
npx -y skills@latest add whxpc123/xpc-wechat-writer \
  --skill xpc-wechat-writer \
  --agent codex \
  --copy \
  --yes
```

查看 GitHub 仓库中可安装的 Skill：

```bash
npx -y skills@latest add whxpc123/xpc-wechat-writer --list
```

更新全局安装版本：

```bash
npx -y skills@latest update xpc-wechat-writer --global --yes
```

也可以让 Codex 根据 GitHub 地址安装：

```text
请从 GitHub 安装 Skill：
https://github.com/whxpc123/xpc-wechat-writer
Skill 位于仓库根目录，名称为 xpc-wechat-writer。
```

手动安装仍可直接克隆到 Codex 的全局 Skill 目录：

```bash
git clone https://github.com/whxpc123/xpc-wechat-writer.git \
  ~/.codex/skills/xpc-wechat-writer
```

安装位置默认为 `~/.codex/skills/xpc-wechat-writer`。安装后在下一轮对话中可用。

手动克隆版本的更新方式：

```bash
git -C ~/.codex/skills/xpc-wechat-writer pull --ff-only
```

## 使用

```text
$xpc-wechat-writer 继续下一篇
```

接着根据输出回复：

```text
1
```

确认大纲后回复：

```text
确认大纲，按默认配置完成
```

文章验收完成后，可以继续回复：

```text
保存到公众号草稿
```

系统会先展示草稿摘要和内容指纹，再等待最终保存确认。

## 网页版 ChatGPT 使用

网页版 ChatGPT 不会因为仓库公开就自动安装这个 Skill。先在 ChatGPT 的应用设置中连接 GitHub，并允许它读取 `whxpc123/xpc-wechat-writer`，然后在对话中明确要求读取仓库文件。

仓库根目录提供了专门的 [CHATGPT-WEB.md](CHATGPT-WEB.md)，其中包含：

- GitHub 连接后的使用步骤
- 可直接复制到 GPT-5.6 Sol Pro 对话中的启动提示词
- 标题、摘要、正文、图片和 `article.html` 的交付顺序
- 四个复制按钮的 HTML 契约
- 网页端缺少脚本、图片或发布工具时的降级规则
- 公众号草稿的逐篇确认边界

连接 GitHub 后，可以先发送：

```text
请读取 GitHub 仓库 whxpc123/xpc-wechat-writer 中的 CHATGPT-WEB.md 和 SKILL.md，
按网页兼容模式把我随后提供的知识资料写成公众号文章，并生成可复制的 article.html。
```

GitHub 应用只提供仓库读取能力。能否生成图片、下载 HTML 或保存公众号草稿，取决于当前 ChatGPT 会话实际可用的工具；工具不可用时必须如实降级，不能伪造执行结果。

每篇文章完成后会生成 `learning-report.md`。普通问题需要在至少 3 篇独立文章中重复出现，明确长期偏好可以立即成为提案候选。提案不会自动修改 Skill；只有用户批准、影响文件已快照且全部旧评测与新增评测通过后才接受升级，失败会回滚。

也可以直接提供自定义主题：

```text
$xpc-wechat-writer 写这个选题：《普通人用 AI 副业赚钱，为什么多数人坚持不到一个月》
```

## 本地文章目录

文章目录按以下优先级确定：

1. 当前对话中指定的位置
2. Skill 根目录下的 `config.local.md`
3. 环境变量 `XPC_WECHAT_ARTICLES_DIR`
4. 当前工作区的 `公众号文章/`

`config.local.md` 已被 `.gitignore` 排除，可以保存个人电脑上的绝对路径：

```markdown
# 本机配置

文章根目录：`/path/to/公众号文章/`
```

## 目录结构

```text
xpc-wechat-writer/
├── SKILL.md
├── references/
├── scripts/
├── tests/
└── evals/
```

长期反馈、提案、决策和快照默认保存在文章根目录的 `_xpc-wechat-state/`，不打包进 Skill，也不保存公众号凭据。

核心规则见 `SKILL.md`。
