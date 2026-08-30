# 受控持续优化

本 Skill 在每篇文章后复盘，但不会自动修改自己。自动记录、自动聚合和自动生成提案都不等于获得修改权限。

## 状态位置

学习状态必须放在可安装 Skill 目录之外，按以下顺序确定：

1. `config.local.md` 中的 `学习状态目录` 或 `learning_state_dir`
2. 环境变量 `XPC_WECHAT_LEARNING_STATE_DIR`
3. 文章根目录下的 `_xpc-wechat-state/`

```text
_xpc-wechat-state/
├── feedback.jsonl
├── decisions.jsonl
├── proposals/
│   ├── P-0001.json
│   └── P-0001.md
└── snapshots/
    └── P-0001/
```

学习状态、文章目录和提案中都不得保存公众号凭据、访问令牌、Cookie、浏览器会话、SSH 私钥内容或完整进程环境。

## 每篇文章复盘

文章完成后生成 `learning-report.md`。它只记录：

- 文章标识、QA 和草稿状态
- 用户明确提出的纠正或长期偏好
- QA 失败、返工原因和有效做法的摘要
- 是否有规则达到提案门槛

需要记录新信号时，在文章目录创建 `learning-signals.json`：

```json
{
  "signals": [
    {
      "kind": "user_correction",
      "rule_key": "opening-specificity",
      "summary": "开头需要具体人物或数字",
      "scope": "candidate_long_term",
      "direction": "adopt",
      "evidence_files": ["edit-report.md"]
    }
  ]
}
```

运行：

```bash
node <skill-dir>/scripts/record_learning.mjs \
  <article-dir> \
  --state-dir <learning-state-dir> \
  --signals <article-dir>/learning-signals.json
```

没有新信号时省略 `--signals`，仍生成本篇复盘，但不推断长期规则。

## 信号边界

允许的信号类型：

- `user_long_term_preference`：用户明确说以后都这样、记住这条或同义表达
- `user_correction`：用户对当前结果的明确纠正
- `qa_failure`：确定性 QA 暴露的问题
- `rework`：已经交付的部分因同一原因返工
- `effective_practice`：本篇有效做法，只作辅助证据
- `model_hypothesis`：模型自评，只作候选证据

`scope` 为 `article` 时只影响本篇；只有 `candidate_long_term` 能参加规则晋升。`direction` 为 `adopt`、`avoid` 或 `neutral`，同一规则同时出现 `adopt` 与 `avoid` 时形成冲突，必须等待用户解决。

以下证据门槛不可降低：

- 一条明确的 `user_long_term_preference` 可以立即生成提案。
- `user_correction`、`qa_failure` 或 `rework` 需要至少 3 篇独立文章的同类证据。
- `effective_practice` 和 `model_hypothesis` 不能单独触发提案。
- 单篇审美偏好、无法复现的问题或模型猜测不能成为长期规则。

查看资格：

```bash
node <skill-dir>/scripts/propose_improvement.mjs eligible \
  --state-dir <learning-state-dir>
```

## 优化提案

达到门槛后，由当前 Agent 根据原始反馈和实际文件编写完整提案 JSON。提案必须包含：

- `proposal_id` 和 `rule_key`
- 问题、适用范围和证据事件编号
- 计划修改的相对文件路径
- 修改摘要和补丁预览
- 风险与回滚方式
- 至少一个新的行为评测编号

创建提案：

```bash
node <skill-dir>/scripts/propose_improvement.mjs create \
  --state-dir <learning-state-dir> \
  --proposal <complete-proposal.json>
```

提案创建后向用户展示 Markdown 路径、证据、影响文件、补丁预览、风险和新增评测，然后停止等待对该提案编号的明确批准。不要把普通的文章大纲确认或草稿确认误解为 Skill 修改批准。

自动记录不等于自动修改。没有当前用户对具体提案的明确批准，不得运行 `approve`、创建修改快照或编辑 Skill 文件。

## 批准、修改和回归

收到对具体提案编号的明确批准后：

```bash
node <skill-dir>/scripts/verify_improvement.mjs approve \
  <proposal.json> --state-dir <learning-state-dir> --source user

node <skill-dir>/scripts/verify_improvement.mjs snapshot \
  <proposal.json> --state-dir <learning-state-dir> --skill-dir <skill-dir>
```

只有快照成功后，才能用最小补丁修改提案列出的文件。不得顺带重构或修改未列出的文件。

修改后运行确定性测试，并根据 `evals/evals.json` 执行全部旧行为评测和本次新增评测。评测结果文件格式：

```json
{
  "proposal_id": "P-0001",
  "results": [
    {
      "eval_id": 1,
      "passed": true,
      "evidence": "输出恰好 5 个候选并停在选题确认点"
    }
  ]
}
```

每个已有和新增评测都必须有 `passed: true` 和非空证据。可用且已经获得委派授权时优先使用独立评估者；否则由当前 Agent 逐项运行并记录可观察结果，不能只凭主观判断填通过。

最终验证：

```bash
node <skill-dir>/scripts/verify_improvement.mjs verify \
  <proposal.json> \
  --state-dir <learning-state-dir> \
  --skill-dir <skill-dir> \
  --eval-results <eval-results.json> \
  --quick-validate <skill-creator-dir>/scripts/quick_validate.py
```

验证固定执行 Skill 快速校验、全部确定性测试、行为评测结构检查和行为评测证据检查。全部通过才记录 `accepted`。任一项失败会恢复快照、记录 `rolled_back`，并再次检查恢复版本。

## 冲突与过期提案

- 用户反馈互相冲突时只输出冲突报告，不生成可应用提案。
- 提案获批后内容或影响文件发生变化，原批准失效，必须重新展示和确认。
- 快照创建后发现 Skill 已漂移，停止修改并重新生成提案。
- 快照失败时禁止修改。
- 回滚失败属于真实阻塞，立即报告，不能继续应用其他提案。

## 最终报告

每篇文章交付时附上 `learning-report.md`。有新提案时附上提案 Markdown 路径和状态；没有提案时只说明复盘已记录。Skill 升级完成时报告提案编号、修改文件、确定性测试、行为评测结果和最终状态。
