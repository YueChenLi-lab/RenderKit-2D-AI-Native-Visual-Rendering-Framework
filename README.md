# RenderKit 2D

**AI-Native Visual Rendering Framework · v0.1**

将 Markdown / JSON 转换为共享语义 IR，经过规则叙事规划与主题布局，输出 React/Web 和可编辑 PPTX，再运行几何审计与确定性修复。默认使用本地规则，不需要模型 API、密钥或付费服务。

该项目复用 React、SVG、KaTeX、MathJax、PptxGenJS、Zod 和 Playwright。它提供内容与渲染之间的工程协议，不实现新的底层图形引擎。

## 快速运行

要求 Node.js **22.12+ 或 24 LTS**、npm。所有命令在本仓库根目录执行，适用于 Windows 11 PowerShell、WSL Ubuntu 和 Linux。

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run demo
npm run dev
```

`npm run dev` 启动 Vite + React Studio：选择演示页面、切换 Academic Minimal / Tech Dashboard 主题。终端显示监听端口。静态 HTML 可直接用浏览器打开，依赖安装完成后，演示渲染无需联网。

本次实现使用现有独立仓库 `RenderKit-2D-AI-Native-Visual-Rendering-Framework`，开发分支为 `feat/renderkit-v0.1-mvp`。本项目没有向远程推送或合并代码的自动步骤。

## 渲染、审计与修复

```bash
# 共享输入同时输出 Web 与 PPTX
npm run renderkit -- build examples/demo.json --target all --out artifacts/demo

# 单独输出，并保存页面 PNG
npm run renderkit -- build examples/demo.json --target web --out artifacts/web --screenshots
npm run renderkit -- build examples/demo.json --target pptx --out artifacts/pptx

# 预览任意输入
npm run renderkit -- preview examples/demo.json --port 4173

# 几何审计 / 加入 Chromium DOM 实测
npm run renderkit -- audit examples/demo.json --out artifacts/audit
npm run renderkit -- audit examples/demo.json --out artifacts/browser-audit --browser

# 有次数上限的修复；保留原始输入
npm run renderkit -- repair examples/repair-needed.json --out artifacts/repair --max-iterations 3 --element metrics-table --browser
```

局部修复可附加 `--element <block-id>`；ID 来自输入的 `blocks[].id` 或审计问题的 `elementId`。输出保存在指定目录，输入文件不会就地覆盖。再次写入同一输出目录时，旧产物会移动到 `versions/`，原始文件按内容哈希留存。遇到无法安全处理的问题，应读取诊断报告并修订原始布局约束；不要删数据或改公式来获得通过状态。

演示产物位于 `artifacts/demo/`。`artifacts/` 为生成目录，不纳入 Git；在新环境中运行 `npm run demo` 重新生成。CLI 会报告实际生成路径。

## 浏览器截图与测试

Chromium 用于真实 DOM 尺寸检查和 PNG 截图。可使用环境变量 `RENDERKIT_CHROMIUM_PATH` 指定已有浏览器；Linux 环境会优先使用 `/usr/bin/chromium`。没有可用浏览器时，安装项目对应的 Playwright Chromium：

```bash
npx playwright install chromium
npm run test:browser
npm run renderkit -- build examples/demo.json --target all --out artifacts/demo --screenshots
```

Windows PowerShell 的可选路径设置：

```powershell
$env:RENDERKIT_CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
```

Linux CI 如缺少 Chromium 系统依赖，可在受控 CI 镜像中运行 `npx playwright install --with-deps chromium`。本项目的运行命令不会自行修改系统配置。

测试覆盖 Schema 拒绝非法输入、主题切换、共享内容映射、公式渲染、PPTX ZIP/XML 结构、图表数据、几何审计与修复数据保留。浏览器测试覆盖实际 HTML、图片比例和 DOM 几何。实际执行结果及环境限制见 [验证记录](docs/VALIDATION.md)。

## 能力与边界

| 模块 | v0.1 的职责 |
| --- | --- |
| Content / Narrative | Markdown 与 JSON 解析；规则生成每页语义契约；保留来源和必需内容 |
| Design System | 两套主题的颜色、字号、间距、圆角、边框、阴影、网格和画幅 token |
| Core | 1280 × 720 共享布局、稳定 ID、显式局部布局覆盖 |
| Web | React + SVG；真实 KaTeX 公式；离线静态 HTML；图片等比展示 |
| PPTX | 原生文本、表格、基本形状和图表；MathJax SVG 公式 |
| Auditor | 几何和规则检查；可加入 Chromium 实测；结构化问题与质量评分 |
| Repair | 有界、确定性的布局修复；保留输入内容；报告未解决问题 |
| CLI / Agent | build、preview、audit、repair；[Agent 使用说明](skills/renderkit-design/SKILL.md) |

共享 IR 支持标题、内容、双栏、公式、流程、架构、对比、实验、路线图和总结等表达。Web/PPTX 共用语义和主题，不承诺逐像素一致。PPTX 公式为矢量资产，不是 Office 原生公式；图片也不是可编辑图形。

演示中的实验数值明确标记为**模拟数据**，不能作为研究证据。审计的审美分数只反映启发式规则，不能证明论点、实验结论或引用正确。审计通过也不能替代人工内容检查。

输入图片仅接受嵌入式 PNG/JPEG data URI；不自动读取外部 URL 或上传用户文档。Markdown 是受限的内容输入格式，不执行 HTML 或脚本。LLM 接口、完整 Markdown 方言、任意画幅和全面版式求解器留待后续迭代。

当前验证以 Chromium Web 渲染及 PPTX 文件结构为基础。如果没有安装 PowerPoint 或 LibreOffice，无法证明 PPTX 在目标 Office 版本中的实际视觉效果；分享前请在目标软件中打开检查。

## 目录

```text
packages/
  schema/          # Zod IR 与输入约束
  narrative/       # 内容解析、规则规划、视觉映射
  design-system/   # 主题 token
  core/            # 共享几何布局与适配器接口
  renderer-web/    # React、KaTeX、静态 HTML
  renderer-pptx/   # PptxGenJS、MathJax SVG
  auditor/         # 几何/DOM 审计、修复
  cli/             # 本地命令入口
apps/studio/       # Vite + React 预览
examples/          # 演示 JSON / Markdown
skills/renderkit-design/
docs/
tests/
artifacts/         # 本地生成，Git 忽略
```

这是一个根目录统一安装、统一测试的 TypeScript 工程。`packages/` 表达模块边界，当前没有发布为独立 npm 包。

- [架构与接口边界](docs/ARCHITECTURE.md)
- [Schema 与内容编写](docs/SCHEMA.md)
- [设计系统](docs/DESIGN_SYSTEM.md)
- [下一版本路线图](docs/ROADMAP.md)

## 许可证

MIT，详见 [LICENSE](LICENSE)。依赖和字体保留各自许可证。
