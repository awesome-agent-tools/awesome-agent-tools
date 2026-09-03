# awesome-agent-tools · 产品文档

> 域名 `awesome-agent-tools.com`（2026-09-01 注册）
> 本文记录 2026-09-01 / 09-02 讨论中已决定的内容。标注「未定」的是尚未拍板的。

---

## 1. 一句话

按品类给 agent 工具做选购指南：读源码得出行为对照，自己跑出关键数字，每条附出处。

## 2. 是什么，不是什么

**是**：分品类的选购指南（Wirecutter 形态）。骨架是 listing，但每页顶上必须有结论；跟纯 listing 的区别在于自己做实测。

**不是**：

| | 为什么不 |
|---|---|
| wiki | 追求全和中立，跟「头条先行、要有观点」直接冲突；社区编辑需要还没有的用户量 |
| 纯 listing / awesome-list | 只搬运已有信号，不制造新信号 |
| 搜索引擎 | 搜索是给规模用的 UI，条目过几百再说 |
| 新闻站 | 内容跑步机，不 compound |
| 排行榜 | 跟「暴露差异、不判绝对好坏」的定位冲突，且招致无穷申诉 |

## 3. 目标用户

| 层 | 谁 | 说明 |
|---|---|---|
| **第一批（生产侧）** | 工具 / MCP 作者、harness 作者 | 人不多但唯一会回馈数据的一群。工具作者的痛是「用户抱怨模型老用错我的工具，但我不知道为什么」——现在完全无解 |
| **长期主体（消费侧）** | agentic app builder | 数量是前者几十倍，专业度更低所以更需要参考；但分散、无集中渠道，早期指望不上 |
| **读者** | model builder | 数量可忽略，影响不对称。他们缺的很具体：**真实世界工具接口的分布**（几种行号格式、几种 offset 基、几种截断话术），这个东西现在没人有 |
| **渠道（不是客户）** | agent | 没有 harness 会来查还不存在的服务。但「用户让 agent 替他调研」今天就成立 → **内容必须机器可读，别用图片和 JS 渲染** |

**明确不服务**：

- 选 agent 的普通开发者（「该用 Claude Code 还是 opencode」）——搜索量最大，但他们要排名，服务他们会把站拖成榜单站。**当流量看待，不为他们改内容。**
- 企业 / 安全 / 治理团队——是在替还不存在的东西找钱，砍掉。

## 4. 原则

1. **重要、明显的信息 first，长尾在后。** 每一层单独看都得是完整答案，不能是钩子——停在第一句的人应该拿到了正确答案，只是没拿到依据。
2. **长尾不是给人读的，是让人知道它存在。** 九成读者不会点开源码链接，但正是链接的存在让他们敢信第一句。所以长尾不需要好读，只需要真实、可核。
3. **快速筛选 > 绝对公正。** 绝对公正不存在——选哪些轴、收哪些工具、行怎么排序，本身就是编辑判断。正确做法是：**表态 + 依据可见 + 容易推翻**。
4. **信号强度 ∝ 发出信号的人付出的代价：**
   `harness 内置 > 下载量 > 发版节奏 > "模型老调错"类 issue > star`
   star 排最后不是因为不准，是因为太便宜——便宜的信号必然被稀释和被刷。
   信号失灵的两种情形（只针对这两种打补丁，不为一百个反例换方法论）：**太新**（好东西还没被集成，信号滞后）、**小众品类**（harness 作者不关心的领域）。
5. **广度靠廉价信号，深度只投头部。** 不需要实测 50 个浏览器工具——廉价信号先筛成 4 个，只对这 4 个做实测。深度做在哪不是拍脑袋，是廉价信号帮你决定的。
6. **目标是造出两三个别人会引用的数字，不是覆盖全。** 成功判据很具体：某个工具的 README 上写着「snapshot ≈ 3.2k tokens（awesome-agent-tools 实测）」。新信号还没被人学会怎么刷，我们是唯一出处。
7. **信号从「大家在抱怨但归不了因」的地方来**，不是从指标设计里来（bundlephobia、Lighthouse、aider 的 edit-format 数字都是这么来的）。所以策略是**多打几枪**：用最糙的方式量三个工具、发出去、看有没有人复述。一天成本验一个假设，别先花一个月建测量基础设施。
   现成的几个"有抱怨无归因"：装了几个 MCP 之后 agent 变笨了 / 上下文怎么这么快就满了 / 模型老是用错我的工具。**第一条最肥**——抱怨量最大、完全不可见、测起来极便宜（数工具数和 schema token，不用跑模型）。
8. **凡涉及具体行为的断言，必须有实测或源码出处撑着。** 推荐可以拍板、可以快，但这条守住了，「表态」才不会退化成又一个凭感觉的榜单。
9. **文章是快照，数据库是现状。** 文章要故意冗余地把引用的数字抄一份冻住，否则半年后 star 变了而正文论断还在，自相矛盾。

## 5. 内容

### 三类值得反复生产的 post

- **新数字首发** —— 八个浏览器 MCP 的快照成本
- **横向对照的头条** —— 九个 read 工具，两件事你需要知道
- **生态变更** —— opencode 改了 read 的字节上限

### 什么配得上头条

四条筛子（**事后解释用，事前帮不上忙**——不能靠推理找到会火的指标）：

1. 能改变决策
2. 廉价信号推不出来
3. 用户自己感知不到 ← 最关键
4. 能压成一个数或一句话

过筛示例：

| | 结果 |
|---|---|
| 每次快照多少 token | 四条全中 → 头条 |
| 装上占几个工具位 / schema token | 四条全中 → 头条 |
| offset 从 0 还是 1 开始 | 全中（builder 完全感知不到，直到错一行）→ 头条 |
| 有没有 staleness 检查 | 全中（感知不到，直到丢数据）→ 头条 |
| 行号有四种格式 | 挂第 1 条，知道了也不换工具 → 长尾 |
| 上限 2000 还是 1000 行 | 挂第 3 条，不意外代价也低 → 长尾 |

### 不变量 vs 设计选择

对照数据要分两类，这条线画对了才是真正的贡献：

- **不变量**（违反 = bug，所有实现都该过）：分页拼得回原文、两次读一致、截断必须被告知、二进制不得静默进入 context、read→edit→write 往返不被行号污染、**grep 报告的第 N 行与 read(offset=N) 必须是同一行**、编码保真
- **设计选择**（不同 = 差异，记录但不判错）：1-indexed vs 0-indexed、行号格式、行数上限、图片走 attachment 还是独立工具

把 Qwen 的 0-indexed 判成 fail 是错的——那是选择。但「分页拼不回原文」是 bug，谁都不能狡辩。

### 测量的三层（性质不同，别混）

| | 需要模型 | 输出 | 类比 |
|---|---|---|---|
| 契约测试 | 否 | pass/fail | 单元测试（真正意义上的） |
| 特征刻画 | 否 | 数值 | golden file / 基准数 |
| 行为测试 | 是 | 分布 + 置信区间 | 集成测试，天然 flaky |

最常见的错误是拿第三层当第一层用——跑一次、pass/fail、当结论。行为层必须重复 k 次报区间。

## 6. 数据模型

原则：**文章自包含、与数据库无关**；数据库负责文章干不了的三件事——廉价信号定期刷新、工具与 agent 多对多、以后开机器可读接口。

### 描述现状

```
capability            归一化轴，没有它就没有对照页
  id                  read | browse | web_search | memory | code_search | shell
  name, description
  # 粒度由「用户会不会拿它们互相比较」决定，不由分类学决定
  # 一个 capability = 一个比较页面；想不出这页在比什么，这个 capability 就不该存在
  # 保持扁平简洁，允许少量边界模糊

agent                 harness：Claude Code / opencode / MiMo ...
  id, name, vendor, repo, language, license
  kind                cli | ide | framework | assistant
  stars, downloads, last_commit, signals_checked_at

package               可安装物：MCP server / library / 托管服务
  id, name, vendor, repo, registry, install_id
  kind                mcp-server | library | hosted
  stars, downloads, last_commit, signals_checked_at

tool                  模型能调用的那个东西 —— 主角
  id                  <owner>/<name>，owner 是产品不是厂商
                      claude-code/read · codex/exec_command · playwright-mcp/browser_navigate
  exposed_name        "Read" —— 逐字保留，大小写不动
                      （字面命名本身是数据：模型对工具名有先验，slug 化会抹掉它）
  schema_json, description_text
  owner_type          agent | package     ← 内置工具和外挂工具同表
  owner_id
  source_url, commit, checked_at

tool_capability       多对多
  tool_id, capability_id, role     role: primary | partial | batch
  # 反例：Hermes 的 search_files 同时覆盖 glob 和 grep；Qwen 的 read_many_files 是 read 的批量形态

adoption              最强的信号，独立成表（字段做不到双向查）
  agent_id, package_id
  kind                bundled | recommended | documented
  source_url

observation           单个主体的事实，键值对
  subject_type        tool | package | agent      ← 多态
  subject_id
  key                 offset_base | line_number_format | announces_truncation | needs_login_session ...
  value
  source_url, commit, checked_at, method
  # 用键值对不用列：每个 capability 关心的事实不同，且会不断增加，用列就要不停迁移
  # 每行必带出处，这是整个站可信度的物理载体，不是可选字段
```

### 记录测量

```
benchmark             测法：协议 + 固定输入
  id                  browser-snapshot-cost
  version             v1        ← 协议变了就升版本
  capability_id
  protocol            散文描述，人能照着复现
  fixtures_ref        git 路径 + commit（固定页面 / 固定文件）
  emits               [snapshot-tokens, tool-count, schema-tokens]

metric                量什么
  id, name, unit
  type                number | boolean | enum | string
  why                 为什么它重要（进头条的理由）

run                   一次执行批次
  id, benchmark_id, benchmark_version, date
  environment         模型 / tokenizer / 机器 / 网络，凡是会影响数字的
  notes

measurement           叶子：一个格子
  run_id, subject_type, subject_id, metric_id
  value               文本存
  value_num           可选，便于排序作图
  subject_version     被测对象的版本 ← 少了这个，一个月后数字就废了
  status              ok | error | na
  note                装不上、跑挂了也要记录，缺失本身是信息
```

**可比性规则（写进渲染逻辑或约束）**：两个 measurement 可比，当且仅当 `metric_id` 相同 **且** `benchmark_version` 相同。跨版本并排展示必须自动标注「协议不同」。这类站点最容易出的错就是把两次不同测法的数字放进同一张表，一旦发生可信度就没了。

**一致性检查不单开一套**：那些不变量就是 `type: boolean` 的 metric，走同一条 benchmark → run → measurement 链路。

**fixture 不建实体**：git 里的文件，benchmark 用路径 + commit 引用，天然带版本。

### 观察 vs 测量

两条独立的链路，出处形态不同，这个区分比什么都重要：

- **observation** = 读源码/文档得来的事实，出处是 `source_url + commit`
- **measurement** = 跑出来的结果，出处是 `run`

### 暂不做

- `signal_snapshot`（star / 下载量时间序列）：先在 agent/package 上放当前值 + `checked_at`，想看趋势时再提升成表，不影响现有查询
- `offering = owner × capability`：**已否决**。分组是渲染问题，不是模型概念。同一行里 Playwright MCP 的 21 个工具要并排显示，靠模板里 group by owner 实现

## 7. 站点结构

```
/                          首页
/tools/<capability>        能力页      /tools/browser
/tools/<owner>/<name>      工具页      /tools/claude-code/read
/agents/<agent>            agent 页
/posts                     文章索引
/posts/<slug>              文章
```

`/tools/` 下单段是 capability、两段是 tool，不冲突（保留 capability 的 slug 别撞 owner 名）。

**没有 `/methods` 和 `/about`。** benchmark 的协议、fixtures、环境搬进**首次发布它的那篇 post**——那篇 post 就是它的方法论页。DB 里照样存 `benchmark.version` 保证可比性，每个数字挂的链接指向那篇 post。这跟「文章自包含」一致，而且方法论天然变成可传播内容的一部分，而不是一个没人点的静态页。about 一行放页脚。

### 首页（两部分）

```
[1] 标题 + 搜索框 + 品类 chips
    没有副标题，没有口号

[2] 精选卡片（混合内容，卡片视觉＝数据本身，不用配图）
    大卡跨两列作为当期主推
```

### 能力页 `/tools/browser`

```
标题 + 问题 + updated
[结论块]      frontmatter.pick / switch_when，无 pick 时整块不渲染
[正文]        markdown
[实测]        measurement，每个数字挂 benchmark@version + run 日期
[候选表]      tool_capability → tool → owner；adoption / downloads / last_commit
[完整对照]    observation 全集，每格带出处角标
```

顺序即「重要的先、长尾在后」。**一个模板两种形态**：有 `pick` → 选购指南（browser 这类用户自己装的）；无 `pick` → 纯对照表（read 这类跟着 harness 走、用户没得选的，给 builder 看）。

行的单位是 **owner**，分组在模板里做。`claude-code/read` 作为表格行锚点，可被外部精确引用。一个 tool 挂两个 capability 就在两个页面各出现一次，不去重。

### 工具页 `/tools/claude-code/read`（纯 DB）

```
exposed_name + owner + capability + 源码链接 + checked_at
schema 原文
description 原文              ← 本身就是数据，别省
[与多数实现的不同之处]        ← 自动推导，这页最有价值的一块
完整 observation 表 + 出处角标
相关 measurement
提到过它的 posts
```

### post 与能力页的半衰期不同，别混

| | post | 能力页 |
|---|---|---|
| 性质 | 时间点、有观点、会传播 | 常青、被维护 |
| 数字 | 抄一份冻住 | 跟 DB 走 |
| 更新 | 不改 | 一直改 |

流程：post 产出新数据 → 进 DB → 能力页跟着变，post 原地不动。

### 现在不做

工具详情页之外的：diff 页、搜索页（有量了再说）、标签、账号、`/changes` 变更流（**但样本库要按版本存，将来它是白捡的**）。

## 8. UI

参考实现：`docs/ui-poc.html`（v5，已定方向）

- **全灰**。文字不用多种颜色，靠字号、字重、留白和细线做层级
- **顶部导航＝数据模型的轴，不是品类举例**：`能力 6 · Agents 13 · 工具 61 · 实测 4 · 文章 24`，数字挂在标签旁边（顺带取消了单独的宣传语——结构自己在报数）。品类实例降级成搜索框下的 chips
- **首页第一屏＝标题 + 搜索框**，没有副标题、没有口号；页脚只有链接和更新时间
- **卡片不用配图，视觉区就是数据本身**：横条图（快照成本）、真实字节（四种行号格式）、`6/9` 方块、`50KB → 32KB`、adoption 圆点、覆盖矩阵。用图片（截图 / logo / AI 插画）会立刻掉进内容农场观感，而且图不携带信息；**用数据当图，既是视觉又是证据，还顺手证明了「我们真的量过」**
- **首页要有数据库查询结果的卡片**（覆盖矩阵、adoption 榜单）——这是跟 listing site 最直接的区分
- 字体 Inter + JetBrains Mono；表格紧排、数字等宽右对齐；细线不用卡片阴影堆砌
- 目标观感：**像一份被认真维护的资料，不像一个产品官网**

## 9. 未定

- **站点语言**。建议主站英文（harness 作者、model builder、工具作者基本都在英文世界，源材料也全是英文），分析报告出中文版单独在国内传播。影响 URL 结构，越早定越好。POC 是中文的
- 用什么静态站生成器 / 数据库落地形式（YAML in git → build，还是真 DB + 生成静态页）

## 10. 已有素材

- `docs/research/read-tools.html` —— 9 个 harness 的 `read` 工具逐项对照，**全部从源码核出**（另有 4 家未能验证，已在文中标注）
- `docs/research/agent-tool-matrix.html` —— 13 个 agent 的完整工具清单对照
- `docs/ui-poc.html` —— 首页 + 能力页的 UI 参考实现

已经拿到手的头条素材（真实结论）：

- 九家里只有 **Qwen Code 的 read 是 0-indexed**，其余八家 1-indexed
- **6/9 没有 staleness 检查**——文件读完后被改，写入照样覆盖
- **四种行号格式**（`N→TAB` / `N: ` / `N|` / 无），pi 和 Codex 完全不给行号（Codex 根本没有 read 工具，走 shell 的 cat）
- **两家写了防护代码**阻止模型把行号前缀写回文件：Claude Code 靠 prompt 提示，Hermes 靠写入侧检测器（注释直言源文件会被 `1|` 污染）。同一个坑，两种补法，**都没有数据**
- Hermes 用**字符预算**（100k）而不是行数上限，代码注释写明原因：行数上限对日志、宽 CSV、压缩过的代码无效

## 11. 第一步

**一个品类做到有人引用**，再做第二个。做十个半吊子的页面不如做一个有人转的。

具体：browser 品类的候选清单 + 那两个数字（每次快照 token、装上占几个工具位）。这两个数字测起来极便宜——不用跑模型，装上数一下就行。
