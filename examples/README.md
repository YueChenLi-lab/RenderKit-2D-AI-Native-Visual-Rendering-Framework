# 示例输入

- `demo.json`：8 页完整演示，覆盖标题、双栏、数学公式、架构图、表格与图表、图片、路线图、总结。
- `clustering/demo.json`：算法教学和公式。
- `clustering/lesson.md`：Markdown 解析示例，二级标题分割页面，`$$…$$` 转为真实公式。
- `agent-architecture/demo.json`：Tech Dashboard 主题架构图。

所有对比指标与图片中的点均为明确标注的模拟内容，不代表真实实验结果。图片作为 PNG data URI 嵌入输入，默认离线，不从外部下载。

`repair-needed.json` 是故意越界的模拟数据对比页，用于验证 `repair --element metrics-table --browser`；不得把原始审计失败误当成演示生成失败。
