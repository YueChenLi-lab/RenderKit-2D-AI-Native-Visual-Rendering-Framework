# v0.1 实际验证记录

验证日期：2026-10-25（Asia/Shanghai）。本记录描述当前云实例；没有声称 GitHub Actions 已在远程运行，也没有验证新云任务的快照恢复。

## 已通过

| 检查 | 实际结果 |
| --- | --- |
| 锁文件安装 | `npm ci --no-audit --no-fund` 成功；项目内 npm 缓存 |
| TypeScript | `npm run typecheck`，strict 模式通过 |
| 构建 | `npm run build`，Node CLI 与 Vite Studio 生产构建通过 |
| Vitest | `npm test`：6 个测试文件，43 项通过，0 失败、0 跳过 |
| Playwright | `npm run test:browser`：6 项通过，0 失败、0 跳过 |
| 主演示 | 8 页 HTML、PPTX 与 8 张 1280×720 PNG 真实生成 |
| DOM 审计 | `artifacts/demo/audit-report.json`：browser+geometry，passed=true，0 个问题 |
| Markdown | `examples/clustering/lesson.md` → 2 页 HTML/PPTX，几何审计通过 |
| 编译后 CLI | `node dist/packages/cli/src/index.js build examples/agent-architecture/demo.json --target all --out artifacts/compiled-cli` 成功 |
| 局部修复 | `examples/repair-needed.json` 的 metrics-table 越界，一轮将 x=-80 调整到64，浏览器复查通过 |
| 依赖审计 | `npm audit`：0 个已知漏洞（执行时的注册表结果） |

测试覆盖非法布局参数、稳定 ID、主题切换、结构化数据映射、Markdown 与公式源保留；真实 KaTeX 数学字形；PPTX ZIP、每份 XML/rels/SVG 解析、原生文字/表格/图表及精确数据；负值/零值图表；实际图片字节的等比缩放和裁切；文本溢出、页面越界、非预期重叠、低对比度、损坏图片和失败公式；数据变更检测、局部修复不改变无关组件、源文件不变、生成版本保留和损坏产物拒绝。

浏览器测试还实际操作 Studio 的主题、导航、演讲备注与 JSON 导出。主文稿截图已检查公式页、架构方向、模拟数据页、图片和路线图。演示数据标注为模拟数据，图像标注为合成示意图。

## 修正并复验的问题

- 托管 Chromium 禁止 file:// 导航：改为加载生成 HTML 的原始字节；所有资产内嵌，不修改或绕过浏览器策略。
- 行内 SVG 的基线空间导致实际溢出：根 SVG 改为 display:block，保持审计阈值。
- 图片比例不能信任输入元数据：PPTX 按嵌入图像实际字节测量，Web 审计检测比例声明差异。
- 无效公式：导出明确报错；Studio 显示诊断，审计记录失败。
- 架构相邻节点和回路连线方向不清：区分向下连线与右侧返回通道。

## 受环境限制 / 未运行

当前没有 PowerPoint 或 LibreOffice，因此**未执行 PPTX 最终视觉渲染**。已执行 Office 包结构、原生元素和数值检查，不能据此保证所有 Office 版本中的换行与最终外观。Web PNG 不是 PPTX 渲染截图。

Windows 11、WSL 和 GitHub Actions 配置已提供，但本次只在 Linux / Node 24.19.0 / Chromium 环境执行。远程 CI 没有触发。

## 尚未实现与后续优先项

- 完整 Markdown 方言、连续数值 XY 散点图 IR、任意画幅、模型服务适配器。
- 通用长文本/复杂图表拆页求解器。当前修复可移动完整 block 到续页；单个不可容纳 block 保留诊断。
- 图表刻度和图示内部字号尚未逐项按正文安全字号审计。
- Office 视觉回归与跨平台字体基线，应作为下一版本的首要工作。

软质量分数是几何启发式，独立于硬约束 passed，不证明审美偏好、来源真实性或科学结论。
