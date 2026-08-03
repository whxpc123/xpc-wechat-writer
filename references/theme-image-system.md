# 排版主题联动图片系统

让正文图、封面和 `gzh-design` 排版属于同一视觉家族。不要再把所有文章固定生成成 `sketch-notes + macaron`。

## 目录

- [建立视觉系统](#建立视觉系统)
- [六套主题映射](#六套主题映射)
- [提示词统一前缀](#提示词统一前缀)
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

## 图片质量红线

- 默认正文图 1600 × 900；封面 1800 × 766、2.35:1。
- 一张图只解决一个问题。优先流程、对比、框架和证据边界，不生成泛化装饰图。
- 画面文字控制在 3 至 8 个短标签；每个标签尽量不超过 8 个汉字。长解释留在正文。
- 数据必须来自文章，数字、日期和结论逐项核对；不得让模型补造案例或经营结果。
- 不出现默认 AI 审美：蓝紫渐变、发光芯片、悬浮玻璃球、写实机器人、无意义城市夜景。
- 不使用写实人物脸；需要人物时使用主题一致的符号化剪影或编辑插画。
- 同篇图片必须像同一设计师完成，但构图不能五张完全一样。
- 逐张检查主题一致性、信息层级、中文文字、事实和裁切；不合格时保存新提示词并整张重生成，禁止程序覆盖修字。
