# 交付契约

## 目录结构

每篇文章至少包含

```text
YYYY-MM-DD-topic-slug/
├── README.md
├── spec.md
├── research.md
├── article-draft.md
├── article.md
├── article-formatted.md
├── article-formatted.html
├── article_排版_{主题中文名}({英文标识}).html
├── article.html
├── publish.html
├── wechat-body.html
├── qa-report.md
├── imgs/
│   ├── cover.png
│   ├── 01-*.png
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
- 封面最终尺寸 1800 × 766 PNG
- 封面比例允许误差小于 0.01
- 所有最终图片需要人工查看
- 生成候选和修正版本需要保留，避免覆盖后无法比较
- `imgs/visual-system.md` 必须记录本篇选中的 `gzh-design` 主题及其颜色、线条、几何、留白、字体气质、纹理和禁用项
- 封面和所有正文图必须继承同一视觉系统；信息类型和构图可以变化，视觉语言不能各自为政
- 图片提示词先通过 `scripts/verify_visual_prompts.mjs`，再调用生图工具
- 禁止无主题依据地回退为马卡龙手绘、通用 AI 蓝紫渐变、发光芯片、悬浮玻璃或写实机器人

图片错误只能通过新提示词重新生成。裁切、缩放和压缩可以程序处理，但不能程序覆盖、擦除或重画文字。

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

- 标题和摘要存在
- 正文 4000 至 8000 字符
- 关键数据和限定语存在
- 禁用词、禁用标点、卡兹克署名和投稿邮箱为 0
- Markdown 图片数量与 HTML 图片数量一致
- 所有图片是有效 PNG
- 封面比例正确
- 图片提示词全部继承 `imgs/visual-system.md` 的主题标识和主色、背景色、强调色
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
