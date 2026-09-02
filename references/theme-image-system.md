# 排版主题联动图片系统

让正文图、封面和 `gzh-design` 排版属于同一视觉家族。不要再把所有文章固定生成成 `sketch-notes + macaron`。

## 目录

- [建立视觉系统](#建立视觉系统)
- [六套主题映射](#六套主题映射)
- [提示词统一前缀](#提示词统一前缀)
- [正文图知识卡 2.0 质量层](#正文图知识卡-20-质量层)
- [开篇总览图](#开篇总览图)
- [复杂技术流程图模式](#复杂技术流程图模式)
- [图片质量红线](#图片质量红线)

## 建立视觉系统

用户确定排版主题后，读取该主题组件库的「设计风格」和「设计变量速查表」，先保存 `imgs/visual-system.md`，再写任何图片提示词。文件至少包含：

```markdown
# XPC_THEME_VISUAL_SYSTEM
Theme: 石墨极简风
Theme-ID: graphite-minimal
Primary: #52525B
Background: #FFFFFF
Accent: #F97316
Secondary: #E4E4E7
Rendering: minimal editorial flat-vector
Geometry: 1px 细线、直角或小圆角、无装饰性阴影
Density: 低密度、60% 留白
Typography: 简洁无衬线，标题短而大
Texture: 纯色或极轻纸感
Avoid: 蓝紫渐变、发光 3D、写实人物、随机机器人、密集小字
```

颜色字段必须使用所选主题组件库的真实色值。自定义主题没有下表映射时，从它的主题色、背景色、正文色、强调色、装饰色、圆角、阴影和风格 TAG 推导，不能回退到马卡龙手绘风。

将视觉系统写入 `spec.md`，封面和全部正文图共用。每张图可以有不同的信息结构，但不能改变基础配色、线条、圆角、阴影和纹理语言。

## 六套主题映射

### 摸鱼绿 `moyu-green`

- 色彩：白色或极浅灰底，emerald `#059669`、`#10B981` 为主，`#FDE68A` 只点亮关键结论。
- 正文图：`editorial` 或 `vector-illustration`；圆角信息卡、杂志标签、清晰分区，中高信息密度。
- 封面：`conceptual + flat-vector + balanced + clean`；不要大面积绿色铺底，不要卡通儿童画。
- 禁止：默认马卡龙四色、暖奶油纸、随手涂鸦星星铺满画面。

### 红白色系 `red-white`

- 色彩：白底，`#DC2626`、`#991B1B` 克制点睛，浅底使用 `#FEF2F2`、`#FECACA`。
- 正文图：经典编辑信息图，编号、竖线、对比栏；红色面积控制在 10% 左右。
- 封面：`typography` 或 `conceptual + flat-vector + bold`，可用编辑海报构图，但保持白底和强留白。
- 禁止：整页鲜红、庆典海报、党政宣传画感、红黑高饱和渐变。

### 石墨极简风 `graphite-minimal`

- 色彩：纯白底，`#27272A`、`#52525B`、`#E4E4E7` 构成灰阶，暖橙 `#F97316` 低于 5%。
- 正文图：`minimal` 或克制的 `editorial`；1px 几何细线、无阴影、低密度、50% 至 65% 留白。
- 封面：`minimal + flat-vector + subtle + clean`，单一视觉锚点，不做复杂场景。
- 禁止：玻璃拟态、蓝紫科技光、3D 图标、圆润糖果卡片、装饰性渐变。

### 留白禅意风 `zen-whitespace`

- 色彩：白底、墨绿 `#4A5D52`、低饱和绿 `#B5C8BC`、细线 `#E8E8E8`。
- 正文图：`minimal` 或 `elegant`；东方留白、细线、少量墨迹或纸张纹理，60% 以上呼吸空间。
- 封面：`minimal` 或 `metaphor + hand-drawn + subtle + serif`，视觉意象宁少勿杂。
- 禁止：大色块、密集信息卡、可爱贴纸、霓虹、真实山水照片拼贴。

### 摸鱼票据风 `moyu-ticket`

- 色彩：米黄纸底 `#FFFEF8`，黑色 `#1A1A1A` 实边框和硬阴影，绿色 `#059669`、`#A7F3D0` 作撕票线。
- 正文图：`editorial` 或 `vector-illustration`；票据编号、星级、打孔、撕线、硬边框，信息密度中高。
- 封面：`typography + flat-vector + bold + display`，像一张值得收藏的门票或凭证。
- 禁止：柔光阴影、玻璃卡片、渐变背景、商务图库人物、软萌卡通。

### 橄榄手记 `olive-journal`

- 色彩：米白 `#FDFDF8`，墨黑 `#1E1F23`，橄榄灰 `#BFC1B7`，橙色 `#ED7B2F` 只用于重点。
- 正文图：`editorial`；内部简报、档案卡、批注线、期号和小圆角，信息密度高但秩序清晰。
- 封面：`conceptual` 或 `typography + flat-vector/screen-print + balanced`，呈现编辑部内刊质感。
- 禁止：大圆角、强柔光阴影、彩虹配色、赛博光效、可爱手账贴纸。

## 提示词统一前缀

每个正文图和封面提示词都必须原样包含以下结构，并填入 `visual-system.md` 的值：

```markdown
# XPC_THEME_VISUAL_SYSTEM
Theme: {Theme}
Theme-ID: {Theme-ID}
Primary: {Primary}
Background: {Background}
Accent: {Accent}
Secondary: {Secondary}
Rendering: {Rendering}
Geometry: {Geometry}
Density: {Density}
Typography: {Typography}
Texture: {Texture}
Avoid: {Avoid}

REQUIRED: This image belongs to the same visual family as the selected WeChat layout theme.
REQUIRED: Apply the specified palette, line treatment, geometry, shadow, whitespace and texture consistently.
Color values and color names are rendering guidance only — do NOT display color names, hex codes, or palette labels as visible text.
```

这些字段必须从 `visual-system.md` 原样复制，不能只抄颜色而忽略线条、几何、密度和纹理。正文图再追加类型专属的 `ZONES / LABELS / COLORS / STYLE / ASPECT`。封面再追加 `Content Context / Visual Design / Text Elements / Composition`。所有提示词必须先保存到 `imgs/prompts/`，再调用生成后端。

## 正文图知识卡 2.0 质量层

新文章在 `spec.md` 写入：

```markdown
Body-Image-Profile: knowledge-card-2.0-adapted
```

这个 profile 是对用户提供的「资料卡片 2.0」提示词的公众号适配，不是原文复制。只吸收信息层级、留白、阅读动线、文字视觉化和内容驱动构图；删除原提示词中的 3:4 竖版、750×1000、多张图挤在一张画布、固定手绘涂鸦、强制投影和固定马克笔配色。封面不使用该 profile。

执行优先级固定为：

1. `fact-lock.md` 中的事实、数字和边界
2. 当前图片要解决的问题与图片角色
3. 画幅锁定
4. `imgs/visual-system.md` 的主题颜色、线条、几何、阴影、留白、字体和纹理
5. 本节的知识卡质量层

### 质量规则

- 配色按 60-30-10 建立层级：约 60% 使用主题背景与呼吸区，约 30% 使用主题主色或次色承载结构，不超过 10% 使用主题强调色形成视觉锚点。主题规定强调色低于 10% 时采用更严格值。
- 深度处理必须与主题兼容。票据风可以使用硬阴影，手记风可以使用纸张错层；石墨极简风明确无阴影时，只能用细线、色块、间距和轻微错位建立层次。
- 阅读动线服务信息关系。流程使用箭头或编号，层级使用尺寸和位置，对比使用分栏，环绕关系使用中心与连接线；禁止为了装饰增加无意义曲线和图标。
- 普通生成式正文图只显示 3 至 8 个短标签，每个标签尽量不超过 8 个汉字。标签文字使用反引号锁定，并同时声明容器与具象插画；生成后仍需人工逐字检查。
- 一张图只回答一个 `Information-Question`。超过 8 个必要标签时拆成另一张独立图片，不拼图，不要求图片模型一次返回多张画布。

### 横版构图路由

| Layout-Family | 适用问题 | 16:9 构图建议 |
|---|---|---|
| `process-horizontal` | 顺序、步骤、反馈 | 横向时间线、折线路径、阶梯或循环 |
| `hierarchy-landscape` | 层级、显性与隐性 | 宽金字塔、冰山、树与根系 |
| `radial-system` | 中心对象与多方关系 | 中心发散、同心圆、闭环 |
| `comparison-split` | 方案或前后差异 | 左右分栏、双路径、上下对比 |
| `card-grid` | 并列要点、证据、清单 | 横向卡片、票据、便签或双列网格 |
| `journey-map` | 行动与成长路径 | 山峰、地铁线、关卡或河流汇聚 |
| `technical-workflow` | 高密度决策与回环 | 确定性 SVG，遵守 complex-flowchart 契约 |

### 普通正文图提示词字段

每份非封面、非复杂流程图提示词在统一主题前缀后加入：

```markdown
Body-Image-Profile: knowledge-card-2.0-adapted
Image-Role: body
Output-PNG: imgs/02-detail.png
Information-Question: 读者看完这张图应该理解什么
Layout-Family: comparison-split
Palette-Balance: 60-30-10 using selected theme colors
Whitespace-Strategy: 说明主要留白区和防拥挤方式
Depth-Treatment: theme-compatible layering, no forced shadow
Reading-Flow: 说明先看哪里、如何移动到下一节点
Aspect-Lock: 16:9
Canvas: 1600x900
ASPECT: 16:9 landscape body image
Label-1: `短标签一` | Container: 主题允许的卡片或节点 | Illustration: 与标签直接相关的具象符号
Label-2: `短标签二` | Container: 主题允许的卡片或节点 | Illustration: 与标签直接相关的具象符号
Label-3: `短标签三` | Container: 主题允许的卡片或节点 | Illustration: 与标签直接相关的具象符号
```

提示词可以继续追加 `ZONES / COLORS / STYLE` 等生成细节，但不得更改上面的角色、输出路径和画幅字段。`verify_visual_prompts.mjs` 会拒绝 portrait-only、3:4 和 750×1000 污染，`verify_delivery.mjs` 会确认普通正文 PNG 精确为 1600 × 900。旧文章的 `spec.md` 没有 profile 字段时继续按 legacy 契约验收。

## 开篇总览图

新文章默认有且只有一张 `opening-overview`。它计入原有 3 至 5 张正文图，是 `article.md` 的第一张图片，放在开场和核心判断之后、第一节 H2 之前。用户明确要求本篇不要时，在 `spec.md` 写 `Opening-Overview: omitted-by-user`，此时不创建总览图规格。

根据文章最主要的理解任务选择类型：

| Overview-Type | 适用内容 | 常见结构 |
|---|---|---|
| `process-flow` | 任务、方法、执行过程 | 从目标到结果的顺序步骤 |
| `system-map` | 角色、组成、相互作用 | 中心对象加关系网络 |
| `architecture-map` | 产品、技术、组织层级 | 分层模块与连接 |
| `decision-map` | 条件、选择、风险判断 | 决策点与分支结果 |
| `timeline-map` | 历史、政策、产品演进 | 时间节点与阶段变化 |
| `action-journey` | 普通读者如何行动 | 困境、判断、动作、结果 |
| `comparison-path` | 两种以上方案 | 并行路线、差异与汇合点 |

总览图只保留 3 至 7 个主干节点，不复述正文全部小节。标签、关系、数字和结论必须来自 `fact-lock.md` 或已确认大纲。提示词在统一主题前缀后加入：

```markdown
Overview-Role: opening-overview
Overview-Type: system-map
Overview-Purpose: 让读者先理解模型、Harness、工具和用户之间的关系
Overview-Placement: after-opening-before-first-section
Body-Image-Profile: knowledge-card-2.0-adapted
Image-Role: body
Output-PNG: imgs/01-opening-overview.png
Information-Question: 模型、Harness、工具和用户如何组成完整工作系统
Layout-Family: radial-system
Palette-Balance: 60-30-10 using selected theme colors
Whitespace-Strategy: 中心对象与外围节点之间保留清晰呼吸区
Depth-Treatment: theme-compatible layering, no forced shadow
Reading-Flow: 先看中心，再沿连接线阅读外围角色
Aspect-Lock: 16:9
Canvas: 1600x900
Overview-Node-1: 用户目标
Overview-Node-2: 模型判断
Overview-Node-3: Harness 执行与反馈
Overview-Node-4: 工具完成真实操作
Label-1: `用户目标` | Container: 入口节点 | Illustration: 人物与目标旗帜
Label-2: `模型判断` | Container: 核心节点 | Illustration: 大脑线稿
Label-3: `Harness 执行` | Container: 执行节点 | Illustration: 循环箭头
Label-4: `工具操作` | Container: 结果节点 | Illustration: 扳手图标
ASPECT: 16:9 article opening overview
```

3 至 7 个节点使用普通生图流程。超过 7 个节点时必须同时满足并声明 `Diagram-Mode: complex-flowchart`，再遵守下一节的确定性 SVG 契约；不要为了显得专业而增加无用节点。

## 复杂技术流程图模式

只有用户明确要求高密度流程图，或画面需要至少 8 个步骤并同时出现决策、回环、审批、终止、泳道或分组区域之一时，才使用 `complex-flowchart`。普通图继续走生成式图片流程。

复杂图不使用图片模型猜测长中文。读取 `baoyu-diagram` 的 `SKILL.md` 和 `references/flowchart.md`，用确定性 SVG 完成布局，再导出 PNG。默认采用横向主流程、必要时跨两行；回环走外围，分支从决策菱形直接引出，连接线不能穿过文字或节点。

对应的 `imgs/prompts/NN-*.md` 在统一主题前缀后必须包含以下机器可校验字段。字段名保持英文，字段值使用文章中的真实中文：

```markdown
Diagram-Mode: complex-flowchart
Body-Image-Profile: knowledge-card-2.0-adapted
Image-Role: body
Source-SVG: imgs/04-agent-loop.svg
Output-PNG: imgs/04-agent-loop.png
Information-Question: 读者如何理解完整执行循环与人工审批边界
Layout-Family: technical-workflow
Palette-Balance: 60-30-10 using selected theme colors
Whitespace-Strategy: 主流程、审批分支和外围回环分区，避免连接线穿字
Depth-Treatment: theme-compatible layering, no forced shadow
Reading-Flow: 主流程从左到右，回环沿外围返回
Aspect-Lock: declared-spec
Canvas: adaptive-from-svg
ASPECT: 8:5 wide technical workflow
Mobile-Readability: 公众号正文显示时可点击放大；正文最小字号 20，若仍拥挤则拆成两张图

Step-1: 用户提出目标
Step-2: 收集当前信息
Step-3: 模型判断下一步
Step-4: 提出工具调用请求
Step-5: 权限检查与审批
Step-6: 执行真实动作
Step-7: 返回执行结果
Step-8: 模型接收结果并思考
Decision-1: 是否需要人工确认
Branch-1: 是 → 人工确认
Branch-2: 否 → 继续执行
Loop-1: 结果返回模型并继续下一轮
Legend-1: 主流程、循环、安全通过、终止拒绝、可扩展组件

Required-Label-1: 用户提出目标
Required-Label-2: 收集当前信息
Required-Label-3: 模型判断下一步
Required-Label-4: 提出工具调用请求
Required-Label-5: 权限检查与审批
Required-Label-6: 执行真实动作
Required-Label-7: 返回执行结果
Required-Label-8: 模型接收结果并思考
```

继续遵守以下绘制契约：

- SVG 根节点只有自适应 `viewBox`，不写固定 `width` 或 `height`。
- 用 `data-flow-role="step"`、`decision`、`branch`、`loop`、`legend` 标记相应 SVG 结构；数量不得少于规格声明。
- 使用中文安全字体栈，例如 `PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif`。
- 每条 `Required-Label` 必须逐字出现在 SVG 可见文字中。长句通过 `<tspan>` 换行，但不改变文字。
- 禁止 `script`、`foreignObject`、事件处理器、外链字体或图片、Data URL 和本机绝对路径。
- PNG 至少 2400 × 1200，优先以 SVG 视图框的 2 倍分辨率导出；文章 Markdown 和 HTML 只引用 PNG，SVG 作为可编辑源文件保留。
- 布局和颜色必须继承 `visual-system.md`。参考图可以影响信息结构，不能强制覆盖已确认主题。
- 高密度图应在正文旁提示可点击查看大图；如果 390 像素手机宽度下无法辨认，拆成总览图和细节图。

## 图片质量红线

- 默认正文图 1600 × 900；封面 1800 × 766、2.35:1。
- 一张图只解决一个问题。优先流程、对比、框架和证据边界，不生成泛化装饰图。
- 开篇总览图只解决「读者如何先看懂全文」这一问题，不承担全部细节说明。
- 普通生成式图片的画面文字控制在 3 至 8 个短标签；每个标签尽量不超过 8 个汉字。`complex-flowchart` 允许更多标签，但必须使用确定性 SVG、逐字校验并满足移动端拆图规则。长解释仍留在正文。
- 数据必须来自文章，数字、日期和结论逐项核对；不得让模型补造案例或经营结果。
- 不出现默认 AI 审美：蓝紫渐变、发光芯片、悬浮玻璃球、写实机器人、无意义城市夜景。
- 不使用写实人物脸；需要人物时使用主题一致的符号化剪影或编辑插画。
- 同篇图片必须像同一设计师完成，但构图不能五张完全一样。
- 逐张检查主题一致性、信息层级、中文文字、事实和裁切；不合格时保存新提示词并整张重生成，禁止程序覆盖修字。
