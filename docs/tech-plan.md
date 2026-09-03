# awesome-agent-tools · 第一版实现方案

> 配套 `docs/product.md`。这份只管「怎么落地」：技术选型、数据落库形式、目录结构、分阶段。
> 标 **【待你拍板】** 的是需要你确认的决策。

---

## 1. 选型结论

| 层 | 选择 | 为什么 |
|---|---|---|
| 数据库 | **YAML in git**，build 时读进内存 | 条目量在千级以下，join 都是小表内存操作。git 天生带版本和 diff，而「每条数据带出处 + 可核查」正需要 blame。不引入 DB 进程 |
| 站点 | **Astro 6，纯静态输出** | 服务端渲染成 HTML 是硬需求（见下），Astro 的 content collections 直接吃 YAML/Markdown 并带 zod 校验 |
| 校验 | **TypeScript（zod + 自写引用完整性检查）**，`npm run check`，build 前置 | 见 §5 的偏离说明 |
| 样式 | **手写 CSS + tokens**，不用 Tailwind | `ui-poc.html` 已经是一套克制的设计系统，照抄成 tokens 比重新表达成 utility class 更保真 |
| 字体 | `@fontsource-variable/inter` + `@fontsource/jetbrains-mono`，自托管 | 去掉 Google CDN 依赖 |
| 部署 | **GitHub Pages + 自定义域**（`awesome-agent-tools.com`）【待你拍板】 | 与 `do-i-own-my-data` 同一条流水线。备选 Cloudflare Pages，见 §9 |
| 仓库 | 新建 public GitHub repo `awesome-agent-tools`【待你拍板】 | 数据公开可核是可信度的物理载体；也是外部引用你数字的前提 |

**站点放仓库根目录**（不像 `do-i-own-my-data` 那样塞进 `site/`）。单一 npm 工程，`data/` 在顶层显眼，路径不用 `../` 跳。

### 为什么必须服务端渲染

产品文档里「agent 是渠道 → 内容必须机器可读，别用图片和 JS 渲染」是一条硬约束，它直接否决了 SPA。
`ui-poc.html` 现在用 JS 模板字符串生成表格，**这部分要全部改写成 Astro 组件**，产物是纯 HTML `<table>`。
客户端 JS 只保留一处：首页搜索框的即时过滤（渐进增强，禁用 JS 也不影响任何内容可读）。

---

## 2. 数据落库形式

原则：**观察归属谁，就写在谁的文件里**；只有「一次测量批次」独立成文件。
这样一条 commit = 一次可解释的事实变更，diff 直接可读。

```
data/
  capabilities.yaml            6 条，扁平小表
  metrics.yaml                 量什么，扁平小表
  observation-keys.yaml        ★ 见 §3，观察键的注册表
  featured.yaml                首页精选卡片的编辑选择

  agents/<slug>.yaml           claude-code.yaml · opencode.yaml
  packages/<slug>.yaml         playwright-mcp.yaml
  tools/<owner>/<name>.yaml    tools/claude-code/read.yaml   ← 目录结构 = URL 结构
  tools/<owner>/<name>.schema.json   （可选，schema 大时外置）

  benchmarks/<id>.yaml         browser-snapshot-cost.yaml（含 protocol / fixtures_ref / emits）
  runs/<benchmark>-<ver>-<date>.yaml   一次执行批次 + 它产出的全部 measurement

content/
  capabilities/<id>.md         能力页的 pick / switch_when（frontmatter）+ 正文（markdown）
  posts/<slug>.md              文章
```

### tool 文件长这样

```yaml
# data/tools/claude-code/read.yaml
exposed_name: Read                 # 逐字保留，大小写不动
owner: { type: agent, id: claude-code }
capabilities:
  - { id: read, role: primary }    # tool_capability 内联在 tool 里
schema_file: read.schema.json      # 可选
description_text: |
  Reads a file from the local filesystem...
source: { url: "...", commit: "abc1234", checked_at: 2026-09-02 }
observations:
  - key: offset_base
    value: "1"
    source_url: "...#L88"
    commit: abc1234
    checked_at: 2026-09-02
    method: source                 # source | docs | measured
```

### run 文件长这样

```yaml
# data/runs/browser-snapshot-cost-v1-2026-09-05.yaml
benchmark: browser-snapshot-cost
benchmark_version: v1              # ★ 可比性靠它
date: 2026-09-05
post: eight-browser-mcps-snapshot-cost   # 方法论页 = 首发它的那篇文章
environment: { model: ..., tokenizer: o200k_base, machine: ..., network: ... }
measurements:
  - subject: { type: package, id: playwright-mcp }
    metric: snapshot-tokens
    value_num: 3200
    subject_version: "0.0.41"      # ★ 少了它一个月后数字就废了
    status: ok
  - subject: { type: package, id: camoufox-mcp }
    metric: snapshot-tokens
    status: error
    note: "装不上：需要 Python 3.11+，容器里是 3.9"   # 缺失本身是信息
```

### adoption 写在 agent 文件里

```yaml
# data/agents/opencode.yaml
adoption:
  - { package: playwright-mcp, kind: bundled, source_url: "..." }
```
build 时反向建索引供 package 页用。写在 agent 侧是因为「内置谁」是 harness 作者的选择，条目也少（13 vs 上百）。

### 两条独立链路，不合并

- `observation` —— 读源码/文档得来 —— 出处是 `source_url + commit`
- `measurement` —— 跑出来 —— 出处是 `run`（benchmark@version + date + environment）

渲染层永远分开展示，永远不共用一张表。

---

## 3. `observation-keys.yaml` —— 这版最关键的一个新增

产品文档里「不变量 vs 设计选择」这条线，如果只活在正文里，半年后必然被写乱。
把它做成**注册表**，让它可机器校验：

```yaml
- key: offset_base
  label: Offset 基
  group: 分页                   # 决定对照表的分组和行序
  capability: read
  type: enum
  values: ["0", "1"]
  class: design-choice          # ★ invariant | design-choice
  headline: true                # 四条筛子过了 → 排在前面

- key: pagination_roundtrip
  label: 分页拼得回原文
  group: 不变量
  capability: read
  type: boolean
  class: invariant              # 违反 = bug，渲染成 FAIL
```

带来三件事：
1. 阻止 observation key 随手乱起名（校验：未注册的 key → build 失败）
2. 能力页对照表的**行分组和行序由它决定**，不用在模板里硬编码
3. `class: invariant` 才允许渲染成 pass/fail；`design-choice` 只允许渲染成中性取值——**从渲染层上禁止把 Qwen 的 0-indexed 判成 fail**

`class: invariant` 的键同时就是 `type: boolean` 的 metric，一致性检查不单开一套（与产品文档一致）。

---

## 4. capability 的粒度 vs 已有 matrix 的粒度（一个需要说清的建模决定）

`agent-tool-matrix.html` 有约 40 行（"Run shell command" / "Glob" / "Todo list"…），
而 `capabilities.yaml` 只有 6 条。**两者不是一回事，不要强行对齐。**

处理方式：matrix 的每一行导入后生成 **tool 记录**（`exposed_name` + `owner`），
其中落在 6 个 capability 之内的才打 capability 标签，其余（todo、subagent、审批…）先只有 tool 记录、没有 capability。

这跟产品文档「想不出这页在比什么，这个 capability 就不该存在」是一致的：
capability 是**比较页面的单位**，不是分类学。以后想给 "subagent" 做对照页，再把它提升成 capability，数据不用动。

副产品：首页那张 6×13 覆盖矩阵卡片就是一句真实的 DB 查询，而不是手填的。

---

## 5. 校验：为什么不照抄 `do-i-own-my-data` 的 Python validator

那个项目里 schema 简单（registry + ratings 两张平表），Python 校验 + TS 加载各写一遍代价很低。
这里不一样——有一堆**跨实体引用**要保证：

- `tool.owner.id` → 存在的 agent 或 package（多态引用）
- `tool.capabilities[].id` → 存在的 capability
- `observation.key` → 在 `observation-keys.yaml` 注册过，且 `capability` 匹配
- `measurement.subject` → 存在的 tool/package/agent；`metric` → 存在的 metric
- `run.benchmark_version` → 该 benchmark 声明过的 version
- **capability slug 不得与 owner slug 相撞**（`/tools/` 下单段 vs 两段路由的前提）
- **可比性**：同一张表里并排的 measurement 必须 `metric` 相同**且** `benchmark_version` 相同，否则 build 失败或强制标注「协议不同」

同一套定义写两遍必然漂移。所以**只用一套 TypeScript**：
zod schema 管字段形状（`src/content.config.ts`），`src/lib/integrity.ts` 管上面这些跨表规则，
`npm run check` 跑，build 前置跑，CI 跑。**校验不过 = 部署不了。**

这是相对 `do-i-own-my-data` 的有意偏离，理由如上。

---

## 6. 目录结构

```
awesome-agent-tools/
  README.md  AGENTS.md
  package.json  astro.config.mjs  tsconfig.json
  data/          见 §2
  content/       见 §2
  src/
    content.config.ts        全部 collection 的 zod schema
    lib/
      db.ts                  加载 + 建索引 + join（byCapability / adoptionOf / measurementsFor）
      integrity.ts           §5 的跨表校验
      divergence.ts          「与多数实现的不同之处」的推导
    components/
      cards/                 Bars · CoverageMatrix · AdoptionRank · CodeLines · Ratio · Change
      Verdict.astro          结论块（pick / switch_when）
      ObservationTable.astro 完整对照表，每格带出处角标
      CandidateTable.astro   候选表
      MeasurementBlock.astro 实测块，每个数字挂 benchmark@version + run 日期
      SourceRef.astro        出处角标（统一一个组件，保证没有一个数字是裸的）
    layouts/Base.astro
    pages/
      index.astro
      tools/[capability].astro         /tools/browser
      tools/[owner]/[name].astro       /tools/claude-code/read
      agents/[agent].astro
      posts/index.astro  posts/[slug].astro
      api/…json.ts  llms.txt.ts  rss.xml.ts  search-index.json.ts
    styles/tokens.css  global.css      从 ui-poc.html 移植
  scripts/
    refresh-signals.ts       star / downloads / last_commit 定期刷新，写回 YAML
  .github/workflows/
    deploy.yml               push main → check → build → Pages
    refresh.yml              每周 cron 跑 refresh-signals，开 PR
```

**一个模板两种形态**（产品文档 §7）：`content/capabilities/<id>.md` 的 frontmatter 有 `pick` → 渲染成选购指南；无 `pick` → 结论块整块不渲染，退化成纯对照表。同一个 `[capability].astro`，不做两个模板。

---

## 7. 机器可读产物（几乎免费，直接服务「agent 是渠道」）

- `/api/tools.json`、`/api/tools/<owner>/<name>.json`、`/api/capabilities/<id>.json`、`/api/db.json`（全量快照）
- `/llms.txt` —— 站点结构 + 各能力页当前结论的纯文本摘要
- `/rss.xml`（posts）、`/sitemap.xml`（`@astrojs/sitemap`）
- 每个工具页可被精确引用：`/tools/claude-code/read`，表格行锚点 `#claude-code-read`

Astro 静态 endpoint 写这些是几十行的事，但它是「以后开机器可读接口」这条的提前兑现。

---

## 8. 分阶段

| 阶段 | 内容 | 产出判据 |
|---|---|---|
| **0 · 骨架** | git init、Astro 根工程、tokens 从 POC 移植、Base 布局（导航数字来自 DB）、deploy 流水线 | 空站能部署到域名 |
| **1 · 模式** | `content.config.ts` 全部 zod schema、`db.ts`、`integrity.ts`、`npm run check`；用 2 个 agent 试跑 | 故意写坏一条引用，build 挂 |
| **2 · 灌数据** | 迁移 `read-tools.html`（9 个工具 × 约 30 个 key）与 `agent-tool-matrix.html`（13 agent × 约 40 行）；补 `observation-keys.yaml` | 导航上的数字（能力 6 / Agents 13 / 工具 61）是真的 |
| **3 · 页面** | 能力页（两种形态）、工具页（含 divergence 块）、agent 页、首页卡片 | `/tools/read` 是一页可用的对照，`/tools/claude-code/read` 能自动说出它跟多数实现的不同 |
| **4 · 内容管道** | posts 集合 + 第一篇文章、§7 全部机器可读产物、`refresh-signals` + 周 cron | 文章里的数字是冻住的抄本，能力页的数字跟 DB 走 |
| **5 · 首个实测**（内容工作，非基建） | browser 品类：候选清单 + 两个数字（每次快照 token、占几个工具位）+ 首发文章即方法论页 | 产品文档 §11 的成功判据：有人引用这个数字 |

阶段 0–4 是这一版的实现范围。**阶段 5 的成败取决于测量本身，不取决于代码**，所以放在最后单列。

### 顺序上的一个建议

产品文档 §11 说「先做 browser」。我建议**基建先用已经在手的 read + matrix 数据灌起来**（阶段 2），
因为那批数据已经逐行核过源码、零新增调研成本，能让站立刻是满的；
browser 作为**第一篇有新数字的文章**在阶段 5 出。
这样「站上线」不被「测量做完」阻塞。【待你拍板】

---

## 9. 待你拍板

1. **站点语言**。建议：主站英文放根路径，中文版以后加 `/zh/` 前缀（非破坏性追加）。POC 是中文的，改成英文要重写全部文案，越早定越省。
2. **部署**。GitHub Pages + CNAME（与现有流水线一致、免费）vs Cloudflare Pages（重定向、边缘函数、分析更顺手，将来要做 `/api` 动态查询时不用搬家）。我倾向 Pages，因为这一版全静态。
3. **仓库公开与否**、以及是不是从第一天就开 public。
4. **阶段 2 vs 阶段 5 的先后**（见上）。
5. **POC 里的示例数字怎么办**。建议：DB 里**不允许**存占位数字；卡片需要示意时必须挂 `draft: true` 并渲染出可见的「示例数据」角标。加一条 integrity 检查兜住。

## 10. 这一版明确不做

搜索结果页（首页搜索框只做跳转式过滤）· diff 页 · `/changes` 变更流 · 标签 · 账号 ·
`signal_snapshot` 时间序列（先在 agent/package 上存当前值 + `checked_at`）· i18n 路由 ·
`offering` 实体（已否决，分组在模板里做）· `/methods` 和 `/about` 独立页（方法论进首发文章，about 一行放页脚）
