# 交付契约

## 目录结构

每篇文章至少包含

```text
YYYY-MM-DD-topic-slug/
├── README.md
├── spec.md
├── research.md
├── writing-plan.md
├── fact-lock.md
├── article-draft.md
├── article.md
├── edit-report.md
├── article-formatted.md
├── article-formatted.html
├── article_排版_{主题中文名}({英文标识}).html
├── article.html
├── publish.html
├── wechat-body.html
├── wechat-draft.json（用户要求保存草稿后生成）
├── qa-report.md
├── learning-report.md
├── learning-signals.json（有明确反馈信号时生成）
├── imgs/
│   ├── cover.png
│   ├── 01-*.png
│   ├── 01-*.svg（仅 complex-flowchart 的可编辑源图）
│   ├── ...
│   ├── outline.md
│   ├── visual-system.md
│   └── prompts/
│       ├── 00-cover-*.md
│       ├── 01-*.md
│       └── ...
└── qa/
    ├── desktop.png
    └── mobile.png
```

## Markdown 元数据

`article.md` 顶部包含

```yaml
---
title: 最终标题
summary: 50 至 100 字摘要
---
```

正文可以保留 H1，转换 HTML 时移除 H1，标题通过工作台单独复制。

## 图片

- 正文图默认 5 张
- 正文图最终尺寸 1600 × 900 PNG
- `complex-flowchart` 正文图允许按内容选择宽高比，但 PNG 不小于 2400 × 1200，并保留同名 SVG 源图
- 封面最终尺寸 1800 × 766 PNG
- 封面比例允许误差小于 0.01
- 所有最终图片需要人工查看
- 生成候选和修正版本需要保留，避免覆盖后无法比较
- `imgs/visual-system.md` 必须记录本篇选中的 `gzh-design` 主题及其颜色、线条、几何、留白、字体气质、纹理和禁用项
- 封面和所有正文图必须继承同一视觉系统；信息类型和构图可以变化，视觉语言不能各自为政
- 图片提示词先通过 `scripts/verify_visual_prompts.mjs`，再调用生图工具
- 禁止无主题依据地回退为马卡龙手绘、通用 AI 蓝紫渐变、发光芯片、悬浮玻璃或写实机器人

图片错误只能通过新提示词重新生成。裁切、缩放和压缩可以程序处理，但不能程序覆盖、擦除或重画文字。

`complex-flowchart` 是上述规则的受限例外：文字和结构从一开始就在可编辑 SVG 中确定性排版，再从该 SVG 导出 PNG；不得拿 SVG 给生成式位图打补丁。规格文件必须声明步骤、决策、分支、回环、图例、必需标签、源 SVG、输出 PNG 和移动端可读性。SVG 禁止脚本、`foreignObject`、事件处理器、外链资源、Data URL 与本机绝对路径。

## HTML 工作台

`article.html` 是主要交付物，需要响应式支持桌面和手机。

`article-formatted.html` 是经 `gzh-design` 校验的纯公众号正文，只允许一个根 `<section>`，不得包含 `doctype`、`html`、`head`、`body`、`style`、`script`、`class` 或 `id`。所选主题记录在 `spec.md`，不得固定为摸鱼绿；用户未指定时才使用本篇推荐主题。

左侧或手机顶部包含

- 封面预览和复制封面
- 标题预览和复制标题
- 摘要预览和复制摘要
- 复制正文和图片
- 复制状态反馈
- 打开封面原图和纯正文 HTML 的备用入口

正文复制逻辑需要

1. 克隆正文容器
2. 将每张正文图替换为内嵌 PNG Data URL
3. 优先写入 `text/html` 和 `text/plain`
4. Clipboard API 不可用时，对可移植克隆执行 `execCommand('copy')`

不要直接复制仍然引用本地相对路径的原始 DOM，否则粘贴到公众号时图片会丢失。

## 验收

确定性检查

- `writing-plan.md` 包含文章原型、唯一核心判断、开头锚点、三个读者问题、情绪曲线、回环对象和当天动作
- `fact-lock.md` 分开记录事实、来源、适用边界和作者判断，待核实项已经清零
- 核心判断在正文前 600 字完整出现
- `edit-report.md` 确认事实核对和读者测试通过
- `scripts/verify_writing.mjs` 通过，WARNING 已经人工判断并写入编辑报告
- 标题和摘要存在
- 正文 4000 至 8000 字符
- 关键数据和限定语存在
- 禁用词、禁用标点、卡兹克署名和投稿邮箱为 0
- Markdown 图片数量与 HTML 图片数量一致
- 所有图片是有效 PNG
- 封面比例正确
- 图片提示词全部继承 `imgs/visual-system.md` 的主题标识和主色、背景色、强调色
- `complex-flowchart` 的步骤、决策、分支、回环、图例和必需标签通过规格校验
- `complex-flowchart` 的 SVG 安全检查、结构标记、可见文字、PNG 尺寸和正文引用全部通过
- 封面与正文图通过人工一致性检查，且没有通用 AI 蓝紫风或无关视觉模板
- HTML 内嵌图片数量等于正文图加封面
- 四个复制按钮存在
- 纯正文页面不含图片占位符
- 纯正文通过 `gzh-design/scripts/validate_gzh_html.py`，0 ERROR、0 WARNING
- 正文文字使用 `<span leaf="">`，图片使用 `max-width:100%;height:auto;display:block;margin:0 auto`

浏览器检查

- `file://` 加载时图片全部成功
- 四个复制动作返回成功状态
- 手机端不出现横向滚动
- 文章字号和行距适合 390 像素屏幕
- 浏览器控制台错误为 0

## 公众号草稿

`wechat-draft.json` 只保存非敏感状态，包括文章标识、内容指纹、账号别名、方式、输入路径、标题、摘要、状态、尝试编号、草稿标识、错误摘要和时间。不得保存 AppSecret、access token、Cookie、浏览器会话或 SSH 私钥内容。

草稿保存的确定性检查：

- 写作、图片、HTML 和交付验收已经全部通过
- 使用 `article-formatted.html`，不使用复制工作台 `article.html`
- 标题、摘要、正文图片和 `imgs/cover.png` 均存在
- 用户确认的完整内容指纹与清单完全一致
- 相同成功指纹不会重复提交
- 每次确认最多调用发布适配器一次
- 成功时 API 记录 `media_id`，浏览器方式记录 `appmsgid`
- 浏览器方式记录 `cover_verification_required: true`
- 结果不明确时状态为 `unknown`，自动重试次数为 0
- 草稿失败不改变本地交付完成状态

## 交付复盘

每篇文章完成后生成 `learning-report.md`，记录 QA 状态、草稿状态、本篇反馈摘要和达到门槛的候选规则。没有反馈信号时仍生成报告，但不得凭模型猜测创建长期偏好。

`learning-signals.json` 仅在有明确用户反馈、QA 失败、返工或有效做法需要记录时创建。它不得包含完整正文或任何账号凭据。长期学习状态保存在文章根目录的 `_xpc-wechat-state/` 或本机配置指定的 Skill 外部目录，不得打包进可安装 Skill。

持续优化的确定性检查：

- 普通问题至少来自 3 篇独立文章，明确长期偏好可以立即生成提案
- 模型自评不能单独触发提案
- 冲突方向阻止提案晋升
- 提案包含证据、影响文件、补丁预览、风险、回滚和新增评测
- 未经批准时 Skill 文件哈希保持不变
- 批准后先快照再修改
- 快速校验、确定性测试或行为评测失败时恢复快照
- 日志、提案、决策和快照清单不含凭据
