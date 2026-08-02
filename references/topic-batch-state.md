# 选题批次状态

## 目的

把一次生成的 5 个候选保存为可持续生产的批次。完成其中一篇后，仍能在新会话中按编号或标题恢复其他候选及其大纲。

## 存储位置

在公众号文章根目录保存：

```text
_topic-batches/
├── CURRENT
└── YYYY-MM-DD-HHMM/
    ├── batch.json
    └── outlines/
        ├── 01.md
        └── 02.md
```

`CURRENT` 只保存当前批次 ID。批次目录不是正式文章目录；不要把正文、配图或最终 HTML 放在这里。

## batch.json

```json
{
  "schema_version": 1,
  "batch_id": "2026-08-02-1200",
  "created_at": "2026-08-02T12:00:00+08:00",
  "updated_at": "2026-08-02T12:00:00+08:00",
  "status": "active",
  "topics": [
    {
      "number": 1,
      "title": "候选标题",
      "topic": "文章主题",
      "target_reader": "目标读者",
      "problem": "解决的问题",
      "reader_gain": "读完获得",
      "why_now": "为什么现在写",
      "sources": ["https://example.com/source"],
      "hkr": {"h": 5, "k": 4, "r": 5},
      "prototype": "现象解读型",
      "risk": "事实或标题风险",
      "status": "candidate",
      "outline_file": null,
      "article_dir": null,
      "final_title": null,
      "article_html": null,
      "qa_report": null
    }
  ]
}
```

必须保存 5 个候选的完整信息。不得只保存标题，否则下一篇会丢失选题时的读者、问题、HKR 和风险判断。

## 状态

- `candidate`：候选尚未进入大纲。
- `outline_pending`：已生成大纲，等待确认。
- `outline_confirmed`：用户已确认或明确要求按其提供的大纲直接写。
- `producing`：正在研究、写作、配图或构建 HTML。
- `completed`：已完成 HTML 与 QA。
- `skipped`：用户明确跳过。

批次 `status` 使用 `active` 或 `closed`。只有 5 个候选全部为 `completed` 或 `skipped`，或用户明确关闭批次时，才标记为 `closed`。

## 恢复与匹配

1. 用户说「继续选题 2」时，先读取 `CURRENT` 和对应 `batch.json`。
2. 用户给出标题时，优先在当前批次做标题精确匹配，再做语义匹配。
3. 当前批次没有该候选时，搜索最近的批次；若命中多个，列出批次日期和标题让用户选择。
4. 用户贴出大纲但没写编号时，用大纲标题与 5 个候选匹配；无法唯一确定时只问一个澄清问题。
5. 不复制另一候选的研究、正文、配图或文章目录。

## 大纲处理

- 生成大纲后保存为 `outlines/NN.md`，状态改为 `outline_pending`。
- 用户说「确认大纲」后改为 `outline_confirmed`。
- 用户明确说「这是选题 2 的大纲，按它写」时，先原样保存其大纲，再改为 `outline_confirmed`，不重复确认。
- 用户只是贴出大纲但没有表达执行意图时，复述识别到的候选和核心结构，等待确认。

## 完成后的回复

完成一篇后，除交付文件外，简短列出当前批次剩余候选，例如：

`本批还可继续：2《……》、3《……》、5《……》。直接回复“继续选题 2”即可。`

