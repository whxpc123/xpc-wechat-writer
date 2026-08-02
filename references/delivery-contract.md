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
├── article.html
├── publish.html
├── wechat-body.html
├── qa-report.md
├── imgs/
│   ├── cover.png
│   ├── 01-*.png
│   ├── ...
│   ├── outline.md
│   └── prompts/
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

图片错误只能通过新提示词重新生成。裁切、缩放和压缩可以程序处理，但不能程序覆盖、擦除或重画文字。

## HTML 工作台

`article.html` 是主要交付物，需要响应式支持桌面和手机。

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
- HTML 内嵌图片数量等于正文图加封面
- 四个复制按钮存在
- 纯正文页面不含图片占位符

浏览器检查

- `file://` 加载时图片全部成功
- 四个复制动作返回成功状态
- 手机端不出现横向滚动
- 文章字号和行距适合 390 像素屏幕
- 浏览器控制台错误为 0

