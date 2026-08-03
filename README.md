# XPC WeChat Writer

一套面向中国普通用户的 AI 公众号长文生产 Skill。它把选题、资料、大纲、正文、去 AI 味、配图、公众号封面和可复制 HTML 串成一条有确认节点的工作流。

## 主要能力

- 基于最近热点生成恰好 5 个选题，并使用 HKR 评分
- 在“选题”和“正式大纲”两个节点等待确认
- 核查官方来源、案例、数据和统计口径
- 借用现象解读型叙事节奏，但不冒充任何作者
- 默认生成 5 张正文图和 2.35:1 公众号封面
- 使用 gzh-design 生成可直接粘贴的公众号正文，支持逐篇选择 6 套主题
- 所选主题同步控制 HTML、正文图和封面，统一配色、线条、卡片形态、留白和字体气质
- 生成适配手机和电脑的 HTML 复制工作台
- 分别复制标题、摘要、正文与图片、封面
- 每篇文章创建独立目录并执行交付验收

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

可以让 Codex 直接安装：

```text
请从 GitHub 安装 Skill：
https://github.com/whxpc123/xpc-wechat-writer
Skill 位于仓库根目录，名称为 xpc-wechat-writer。
```

也可以直接克隆到 Codex 的全局 Skill 目录：

```bash
git clone https://github.com/whxpc123/xpc-wechat-writer.git \
  ~/.codex/skills/xpc-wechat-writer
```

安装位置默认为 `~/.codex/skills/xpc-wechat-writer`。安装后在下一轮对话中可用。

更新已安装版本：

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
└── evals/
```

核心规则见 `SKILL.md`。
