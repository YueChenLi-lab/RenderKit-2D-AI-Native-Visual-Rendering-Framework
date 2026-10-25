---
name: renderkit-design
description: Use RenderKit 2D to build local Web/PPTX presentations from validated semantic JSON or Markdown, inspect audits, and apply content-preserving layout repairs.
---

# RenderKit 2D Agent 工作流

在用户需要将结构化技术、教学、实验或架构内容转换为 Web / PPTX，或需要可追溯的版式审计和局部修复时调用。本 Skill 依赖真正的 `packages/` 渲染代码；它不能替代代码、测试和文件输出。

## 运行前

在现有 RenderKit 仓库根目录工作。云任务已经隔离，除非用户明确要求，不要创建 Git worktree。保留现有用户文件及改动。检查 README、`package.json` 和 `packages/schema/src/index.ts`；依赖未安装时执行 `npm ci`。

默认只用本地规则，不需要模型 API Key，不上传用户文档。不将来源引用当成需要自动访问的地址。安装依赖所需网络与内容渲染分开处理。

## 生成输入

优先从 `examples/demo.json` 和 [Schema 说明](../../docs/SCHEMA.md) 创建 JSON。使用独立输出目录和稳定的页 / block ID。

- Deck 必须有标题、至少一页、受支持的主题。
- 每页明确 `keyMessage`，来源放入 `sources`。
- 必须保留的 block ID 放入 `constraints.preserve`。
- 表格每行与表头等长；图表每条数值序列与 labels 等长。
- 模拟值设置 `simulated: true` 并在说明中明示；不编造真实实验结果。
- 公式使用 `type: "formula"` 与 LaTeX，不能把源码当作已渲染公式交付。
- 图片仅使用嵌入式 PNG/JPEG data URI，提供真实尺寸与 alt。
- 布局默认由 Core 决定，仅在需要时添加 `layout` 覆盖。

Markdown 适合简单标题、段落与数学内容；复杂图表、来源和保留约束使用 JSON。先验证生成的 IR，再渲染。

## 选择表达和主题

比较使用 table / bar chart；趋势用 line chart；关系用 scatter（先确认横坐标编码）；流程和路线图用 process；模块关系用 architecture；数学用 formula；实验截图用 image 加数据说明。不要把所有目的转换成同一种卡片布局。

科研与教学优先 `academic-minimal`；系统和工程展示可用 `tech-dashboard`。只修改 `theme` 即可切换，不改内容和数值。优先使用 theme token，减少直接指定颜色。

## 运行

```bash
npm run renderkit -- build examples/demo.json --target all --out artifacts/agent-run
npm run renderkit -- audit examples/demo.json --out artifacts/agent-audit --browser
npm run renderkit -- build examples/demo.json --target web --out artifacts/agent-preview --screenshots
```

没有 Chromium 时，记录截图与 DOM 验证受限原因，保留可完成的结构和几何检查。不要把没有运行的浏览器检查标成通过。项目支持 `RENDERKIT_CHROMIUM_PATH` 指定已有浏览器。

## 读取报告与修复

打开输出的 `audit-report.json`。按 `severity` 排序，通过 `slideId` / `elementId` 定位，阅读 `evidence` 和 `recommendedFix`。区分硬错误与软质量分数；审美分数不能验证科学结论、数据来源或引用真实性。

```bash
npm run renderkit -- repair examples/demo.json --out artifacts/agent-repair --max-iterations 3
npm run renderkit -- repair examples/demo.json --out artifacts/agent-local-repair --max-iterations 3 --element target-block-id
```

对比 `repaired.json`、原始输入与 `repair-history.json`，检查数值、公式、来源和必需内容没有改变。重新执行浏览器审计；不要仅凭几何估算宣称实际渲染已经通过。

不能安全修复的问题必须保留诊断。不要通过删除文字、缩到不可读字号、改实验值或改写结论“解决”问题。不要反复运行无变化修复形成无限循环。

## 交付

提供实际生成的 HTML、PPTX、PNG（若执行截图）、IR 和审计报告路径。明确 PPTX 中公式为 SVG 资产；结构验证不等于在 PowerPoint 中的视觉验证。报告已通过、失败、跳过、未实现与环境受限项目，保留原始输入与生成版本。未经用户授权，不推送、合并或发布远程内容。
