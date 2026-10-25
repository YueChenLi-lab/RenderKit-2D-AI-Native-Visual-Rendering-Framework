# 共享 IR：内容编写协议

权威定义是 `packages/schema/src/index.ts` 的 Zod Schema。所有外部输入先调用 `parseDeck(unknown): Deck`，不要将任意 JSON 断言为 `Deck` 后传入渲染器。IR 版本为 `0.1`，Schema 会补齐默认值。

## 最小文稿

```json
{
  "version": "0.1",
  "id": "my-deck",
  "title": "Clustering lesson",
  "theme": "academic-minimal",
  "slides": [
    {
      "id": "lesson",
      "type": "content",
      "title": "K-Means minimises within-cluster distance",
      "keyMessage": "The objective is sensitive to initialisation.",
      "blocks": [
        {
          "id": "lesson-body",
          "type": "text",
          "text": "Assign samples to centroids, then recompute each centroid."
        }
      ],
      "constraints": {"preserve": ["lesson-body"]}
    }
  ]
}
```

## Deck 与 Slide

| 字段 | 约束 / 用途 |
| --- | --- |
| `version` | 固定 `"0.1"` |
| `id`, `title` | 非空字符串 |
| `theme` | `academic-minimal` / `tech-dashboard` |
| `audience` | 用于规则叙事契约 |
| `slides` | 至少一页；页 ID 与 block ID 在整份文稿中唯一 |
| `render` | 固定 `width: 1280`, `height: 720`；可配置安全字号区间 |
| `slide.type` | `title`, `content`, `two-column`, `formula`, `architecture`, `comparison`, `timeline`, `summary`, `experiment` |
| `slide.keyMessage` | 本页的主信息 |
| `slide.sources` | `{id, title, url?, note?}[]`；URL 只是证据引用，不自动抓取 |
| `slide.constraints.preserve` | 必须保留的本页 block ID；引用不存在的 ID 会拒绝 |
| `slide.constraints.maxDensity` | 0–1 的内容密度上限 |
| `slide.speakerNotes` | 作者备注 |
| `slide.contract` | 规划器的语义契约；保持与来源内容一致 |

`contract` 字段包括 `audience`, `purpose`, `keyMessage`, `claims`, `evidence`, `visualRepresentation`, `speakerNotes`, `acceptanceCriteria`。契约所属页面的 ID 使用 `slide.id`，不重复存储在契约内。

## Block 公共字段

每个 block 需要唯一 `id` 和判别字段 `type`。`required` 默认 `true`。可选 `layout` 对默认排版做局部覆盖：`x`, `y`, `width`, `height` 均为逻辑像素，其中宽高必须大于零；负坐标可被解析但会被审计为越界。

`fontSize` 可设为 12–72，之后仍受文稿 `render.minFontSize` / `maxFontSize` 审计。`color` 仅接受六位十六进制颜色；一般应使用主题默认颜色，避免把样式写进业务内容。

| type | 特有字段 |
| --- | --- |
| `text` | 非空 `text` |
| `formula` | 非空 `latex`，可选 `caption`；渲染器使用 KaTeX / MathJax |
| `process` | `steps: string[]`，2–12 步 |
| `architecture` | `nodes: {id,label}[]`，1–16 个节点；`edges: {from,to,label?}[]`；边必须引用现存节点 |
| `table` | `columns: string[]`、`rows: (string \| number)[][]`；每行列数一致；`simulated` 明示模拟数据 |
| `chart` | `chartType: bar \| line \| scatter`、`labels: string[]`、`series: {name,values:number[]}[]`；每条序列长度与 labels 一致；可标记 `simulated` |
| `image` | PNG/JPEG `data:` URI、非空 `alt`、真实 `naturalWidth` / `naturalHeight`、`fit: contain \| cover`、可选 `caption` |

图表只接受有限数值；不要使用 `NaN`、无穷大或字符串数值。散点图的横坐标编码以渲染适配器约定为准，当前模型没有独立的 `{x,y}` 点类型；需要连续数值横坐标时，应先确认适配器支持，不能臆造数据。

## Markdown 输入

Markdown 适合标题、段落、列表及 `$$ ... $$` 公式。JSON 是表格、图表、架构关系、证据元数据与精确布局的完整输入协议。对于超出解析器覆盖的 Markdown 语法，先转换为显式 JSON，并检查解析结果是否保留全部内容。

解析器不执行输入脚本，不下载远程图片。公式 LaTeX 也是数据，不应放入任意 HTML。

## 数据完整性规则

1. 不为修复布局改变 `series.values`、表格行、公式、结论或来源。
2. 未提供的实验数据不由规划器补造；示例数据必须标注 `simulated: true`。
3. 明确保留要求使用 `constraints.preserve`，不要仅在提示语中口头说明。
4. 修复生成新版本并保留原始输入；用稳定 ID 比较变化，避免按数组下标错误定位组件。
5. 跨版本新增字段、判别类型或改变单位时，先引入 IR 版本迁移，再升级适配器。
