# Next-Generation Improvements To The Research AI Plan

## 一句话判断

当前方案已经从“AI 工具门户”升级到了“AI 原生科研操作系统”。下一步还可以再往前走一步：不要只建设一个固定功能平台，而要建设一个 **科研能力生成工厂**。

也就是说，平台不仅提供文献、数据、写作、实验、项目申报等固定模块，还应该能根据教师的具体科研任务，低成本、快速、安全地生成新的：

- 研究小站
- 数据分析脚本
- 可视化 dashboard
- 文献追踪器
- 专题知识库
- 调研问卷站点
- 实验记录工具
- 数据清洗 pipeline
- 论文图表生成器
- 基金申报材料检查器
- 课题组内部协同页面
- 面向某个学科的专用智能体

这才是真正利用最新模型能力、agent harness、工具调用、代码生成、MCP、沙箱执行和低成本 Web 工程的方案。

## 一、为什么当前方案还可以更激进

现在的方案重点是“AI 原生科研 OS”，核心能力包括 `ContextBundle`、`TokenFlow`、`AIAction`、`CrawlerPlugin`、科研记忆图谱、智能体工作流、MCP 工具层和代码沙箱。

这个方向是正确的，但仍然隐含一个传统软件假设：平台团队要预先设计和实现主要功能。

最新技术变化打破了这个假设：

- 模型已经不只是生成文本，而是可以在一个 agent loop 中调用工具、读文件、运行代码、生成 UI、写脚本、修改项目。
- 工具协议正在标准化，MCP 让外部数据源、业务系统和平台工具可以被 AI 以统一方式调用。
- Web 工程成本下降，创建一个新页面、小站、API route、dashboard、脚本、爬虫、数据处理流程的成本大幅降低。
- 代码执行可以进入沙箱，AI 生成脚本不必直接进入生产环境。
- 前端可以流式渲染 agent 中间结果，用户不必等“最终答案”，而是能看到任务进展、工具调用和交互块。

因此，平台的目标不应只是“把已有科研流程 AI 化”，而应是：**让 AI 能持续生成新的科研工具，并把生成工具的过程纳入治理、审计、复用和评估。**

## 二、核心升级：从 Research OS 到 Research Capability Foundry

### 2.1 新定位

建议把方案定位升级为：

> 面向高校科研的 AI 原生科研操作系统与科研能力生成工厂。

其中：

- Research OS：负责身份、权限、数据、文献、项目、写作、记忆、审计和治理。
- Capability Foundry：负责按需生成站点、脚本、工具、插件、工作流、智能体和交互式研究界面。

前者保证稳定，后者保证爆发力。

### 2.2 与川农方案的本质差异

川农方案强在整合已有资源、展示成熟场景、把现有平台包装进 AI 叙事。我们的升级方案不走“聚合更多入口”的路，而是把 AI 变成一个受控的软件生产力层：

| 维度 | 传统 AI 赋能方案 | 当前方案 | 下一代改进 |
| --- | --- | --- | --- |
| 平台形态 | 资源门户 + 模型入口 | AI 原生科研 OS | 科研 OS + 能力生成工厂 |
| 功能来源 | 供应商预置 | 平台团队开发 | AI 生成 + 人审 + 沙箱 + 复用 |
| AI 作用 | 问答、润色、生成文本 | 工具调用和科研工作流 | 生成新工具、新站点、新脚本、新智能体 |
| 交付方式 | 固定模块 | 模块化工作台 | 按研究任务动态生成能力 |
| 创新重点 | 整合 | 上下文和闭环 | 低成本创造新科研能力 |

## 三、必须新增的七个系统能力

### 能力一：Agent Harness Layer

当前计划已有智能体工作流，但还需要一个明确的 harness 层。这个层的任务不是“再包一层聊天”，而是把 AI 运行变成工程系统。

核心内容：

- Agent Spec：每个智能体必须有角色、可用工具、输入输出 schema、停止条件、权限边界、成本上限。
- Tool Registry：所有工具都有名称、描述、参数 schema、权限等级、风险等级、审计规则。
- Run State Machine：每次 AI 任务有状态机，如 created、context_built、tool_calling、awaiting_approval、running_sandbox、completed、failed。
- Trace Replay：保存 agent 每一步上下文、工具调用、结果、错误、成本，支持回放和复盘。
- Evaluation Harness：对文献摘要、综述、数据分析、代码生成、申报书修改等任务建立回归测试集。
- Approval Gates：高风险动作必须审批，包括外发数据、发布站点、部署脚本、运行爬虫、昂贵模型调用、删除共享资产。

这个 harness 层是区别“玩模型”和“做系统”的关键。

### 能力二：Research App Factory

平台应允许教师用自然语言生成小型科研应用。

典型请求：

- “为我的课题组生成一个水稻基因表达数据探索小站。”
- “根据这 30 篇论文做一个研究路线图页面，可以按方法、数据集、年份过滤。”
- “生成一个问卷收集页面，帮我调查教师使用 AI 辅助科研的情况。”
- “给这个 Excel 数据做一个交互式 dashboard，支持筛选学院、职称、年份。”
- “为这个基金项目生成一个任务分解和材料检查站点。”

生成流程：

1. AI 将自然语言需求转成 `GeneratedAppSpec`。
2. 系统判断数据权限、公开范围、是否需要登录、是否允许外链。
3. AI 基于模板生成页面、组件、API route、数据 schema 和测试。
4. 代码进入沙箱构建和预览。
5. 用户审查预览效果。
6. 通过后发布到内部路径，如 `/apps/{app_id}`。
7. 站点自动记录来源数据、生成版本、负责人、访问日志和到期时间。

这会让平台从“固定模块平台”变成“科研应用生产平台”。

### 能力三：Script And Pipeline Factory

科研中大量工作不是网页，而是脚本：

- 数据清洗
- 文献抓取
- 格式转换
- 批量 OCR
- PDF 分块
- 图表生成
- 统计检验
- LaTeX/Word 转换
- 图片压缩和标注
- 参考文献格式修复
- 数据库导入导出

建议把脚本生成作为一等能力，而不是附属在聊天里。

每个 AI 生成脚本都应成为 `GeneratedScript`：

- 输入文件要求
- 输出文件类型
- 运行命令
- 依赖环境
- 参数 schema
- 示例数据
- 沙箱运行日志
- 测试用例
- 适用范围
- 共享权限
- 版本历史

教师不需要懂代码，但平台应该把脚本变成可复用的科研工具。

### 能力四：Executable Research Object

论文、数据、图表、脚本、实验记录和写作片段不应分散保存。建议新增 `ExecutableResearchObject`，简称 ERO。

一个 ERO 是一个可执行的科研对象包：

- 原始数据
- 清洗后数据
- 分析脚本
- 环境定义
- 运行参数
- 输出图表
- 统计结果
- 文献证据
- 写作段落
- 审计日志
- 复现实验按钮

这会把“AI 生成结果”升级为“AI 生成可复现科研资产”。

典型场景：

- 教师提交论文前，点一次“复现所有图表”。
- 课题组新人接手项目时，能看到数据从哪里来、怎么处理、图怎么生成。
- 申报书引用团队成果时，可以直接复用 ERO 中的图表、数据和文字依据。

### 能力五：Dynamic UI Blocks And Research Canvas

当前计划已有 interactive blocks，但下一代应该更进一步：AI 不只返回文本或固定卡片，而是能生成受控的 UI block。

可生成的 UI block 包括：

- paper table
- citation graph
- method map
- dataset browser
- experiment matrix
- statistical result table
- chart panel
- grant checklist
- writing diff viewer
- reviewer response matrix
- workflow timeline
- decision board

这些 UI block 必须来自白名单组件和 schema，不能让 AI 任意写前端代码直接进入生产页面。真正的新页面由 Research App Factory 走沙箱和发布流程。

### 能力六：MCP-First Tool Plane

当前计划里有 MCP-compatible layer，但建议把它提前到架构核心位置。

平台内部所有关键能力都应以 tools/resources/prompts 三类接口暴露：

- Tools：执行动作，如解析 PDF、跑统计、生成图表、创建 tracker、发布内部小站。
- Resources：提供上下文，如论文、笔记、数据集、项目材料、实验记录、组织知识。
- Prompts：沉淀学校认可的任务流程，如基金立项依据分析、相关工作写作、数据分析审查。

这样做的价值：

- AI 平台内部可调用。
- 未来 ChatGPT、Codex、IDE、学院系统、图书馆系统可通过同一套协议接入。
- 每个工具天然具备 schema、权限、日志、审批和可观测性。

但 MCP 必须带安全边界：默认只允许可信内部 MCP server；外部 MCP 必须经过白名单、审批、数据脱敏和日志审查。

### 能力七：Cost-Aware Model Mesh

当前 `TokenFlow` 已经处理成本和模型选择，但下一代要做成模型网格。

模型调用不应只有“大模型 API”一条路，而是按任务分层：

- 小模型：分类、字段抽取、简单摘要、标签、路由。
- 强推理模型：复杂综述、方法比较、实验设计、基金论证。
- 长上下文模型：整篇论文、长项目书、多轮审稿意见处理。
- 多模态模型：PDF 版面、图表理解、实验图片、扫描件。
- 代码模型或代码工具：脚本生成、数据分析、测试修复。
- 本地模型：涉密材料、低成本批量任务、离线 embedding。
- 批处理调用：夜间处理论文库、批量摘要、批量 embedding。
- 缓存调用：稳定结果如论文摘要、claim、方法抽取、图表解释优先复用。

`TokenFlow` 不只是省钱工具，而是平台能规模化运行的基础。

## 四、建议新增的数据对象

在当前 `User`、`Paper`、`Tracker`、`ResearchArtifact`、`ContextBundle`、`AIAction`、`CrawlerPlugin`、`WritingProject` 基础上，新增：

### `AgentSpec`

定义一个可运行智能体：

- name
- purpose
- instructions
- allowed_tools
- input_schema
- output_schema
- risk_level
- approval_policy
- max_steps
- max_cost
- eval_suite_id

### `ToolDefinition`

定义平台工具：

- name
- description
- input_schema
- output_schema
- permission_scope
- risk_level
- side_effect_level
- audit_policy
- owner
- version

### `GeneratedApp`

定义 AI 生成的小站或 dashboard：

- title
- app_spec
- source_artifacts
- generated_code_ref
- preview_url
- published_url
- owner
- sharing_scope
- expiry_policy
- approval_state
- audit_log

### `GeneratedScript`

定义 AI 生成脚本：

- title
- language
- input_schema
- output_schema
- dependencies
- command
- sandbox_result
- tests
- owner
- sharing_scope
- version

### `ExecutableResearchObject`

定义可复现科研对象：

- source_data
- transformed_data
- scripts
- environment
- parameters
- outputs
- evidence_links
- writing_fragments
- replay_status
- audit_log

### `EvalSuite`

定义智能体和工具的评测集：

- task_type
- test_cases
- expected_properties
- graders
- regression_history
- failure_examples

## 五、产品形态升级

### 5.1 中心界面：Research Command Center

中心聊天框升级为 Research Command Center，除聊天外还包含：

- 当前任务上下文
- 正在运行的 agent steps
- 工具调用轨迹
- 成本和 token 预算
- 需要审批的动作
- 生成的 UI blocks
- 生成的文件、脚本、小站和 ERO

教师不应只看到“AI 回答”，而应看到“AI 正在如何推进科研任务”。

### 5.2 右侧栏：Context And Evidence Rail

右侧上下文栏应显示：

- 当前使用的论文
- 证据卡片
- 数据文件
- 笔记
- 过往聊天洞察
- 引用来源
- 权限状态
- 可信度提示

这能减少幻觉，也让教师愿意信任 AI 输出。

### 5.3 新增工作区：Foundry

新增一个 `Foundry` 工作区，管理所有 AI 生成能力：

- Generated Apps
- Generated Scripts
- Generated Crawlers
- Generated Workflows
- Agent Specs
- Tool Definitions
- Eval Suites
- Sandbox Runs

它是平台的创新核心。

## 六、建议重排建设路径

### Phase 0：Harness First

在继续堆功能前，先补 harness：

- `AgentSpec`
- `ToolDefinition`
- `AIAction` 扩展为 step trace
- approval policy
- sandbox run log
- cost log
- replay log
- eval suite skeleton

验收标准：

- 任意 AI 动作都能看到上下文、工具调用、成本、输出和风险等级。
- 任意高风险工具都能进入审批流程。
- 任意失败任务都能回放和复盘。

### Phase 1：Research App Factory MVP

先做内部小站生成，不追求复杂：

- 只允许白名单模板
- 只支持登录态内部访问
- 只支持读取已授权平台数据
- 只支持静态页面 + 少量 API route
- 必须通过构建测试和人工预览

优先模板：

- 文献路线图小站
- 数据 dashboard
- 项目材料检查站
- 课题组知识库页面

### Phase 2：Script And Pipeline Factory

把脚本能力产品化：

- AI 生成 Python/R/SQL/Node 脚本
- 沙箱运行
- 输入输出 schema
- 测试数据
- 版本管理
- 一键复用

优先脚本：

- PDF 批量解析
- CSV/Excel 清洗
- 统计检验
- 论文图表生成
- 引用格式检查

### Phase 3：Executable Research Object

把数据、脚本、图表、证据和写作绑定：

- 每个图表绑定数据和代码
- 每个结论绑定证据和分析结果
- 每个写作段落绑定引用和来源
- 支持“重新运行全部结果”

### Phase 4：MCP-First Ecosystem

平台内部工具全部标准化：

- PDF MCP server
- Literature MCP server
- Data Analysis MCP server
- Writing MCP server
- Project Grant MCP server
- Governance MCP server
- Foundry MCP server

先服务内部 AI，再服务经批准的外部客户端。

## 七、最值得做的三个新标杆场景

### 场景一：一小时生成一个课题组研究小站

教师上传论文、项目书和数据说明，AI 自动生成：

- 课题组研究方向页面
- 代表论文列表
- 研究路线图
- 数据集说明
- 当前项目进度
- 内部资料入口
- 可分享但需登录的访问链接

价值：展示能力强，但不是空壳展示。它来自真实资料和权限控制。

### 场景二：从 Excel 到可复现论文图表

教师上传 Excel，说“帮我分析不同学院教师 AI 使用差异，并生成论文图表”。

系统自动：

- 识别变量
- 清洗数据
- 推荐统计方法
- 生成脚本
- 沙箱运行
- 输出图表
- 生成结果解释
- 打包成 ERO

价值：直接减少科研劳动，并形成可复现资产。

### 场景三：AI 生成并审查一个领域采集器

教师说“帮我追踪近 6 个月 AI 辅助数学教育的论文和项目动态”。

系统自动：

- 创建 tracker
- 生成采集器 spec
- 使用开放 API 或网页采集策略
- 沙箱运行
- 生成测试
- 人工审批
- 定时更新
- 输出研究看板

价值：比简单文献检索更接近持续科研情报系统。

## 八、实施原则

1. 不要让 AI 直接改生产系统。
2. 不要让 AI 生成代码后跳过测试。
3. 不要把 MCP 当成无边界连接器。
4. 不要为了炫技生成大量一次性页面。
5. 所有生成物必须有 owner、scope、expiry、version、audit。
6. 所有科研结论必须可追溯到数据、文献或人工输入。
7. 所有高风险动作必须有审批。
8. 能用模板生成的不要让 AI 从零写。
9. 能用小模型完成的不要调用强模型。
10. 能缓存的稳定结果必须缓存。

## 九、对当前计划的具体修改建议

### 修改一：在总体定位中加入“能力生成工厂”

原定位：

> AI 原生科研操作系统。

建议升级：

> AI 原生科研操作系统 + 科研能力生成工厂。

### 修改二：把模块五升级为“Agent Harness 与 Foundry”

当前“科研智能体工具链与安全沙箱”还偏工具执行。建议扩展为：

- Agent Harness
- Tool Registry
- Research App Factory
- Script Factory
- Workflow Factory
- Sandbox Runner
- Eval Harness

### 修改三：建设路径前置 Phase 0

不要等功能多了再补审计和评估。harness 必须前置，否则后续生成的工具、脚本、站点会难以治理。

### 修改四：新增 Foundry 工作区

现有 `ai`、`trackers`、`library`、`writing`、`governance` 建议增加：

- `foundry`

用于管理生成能力。

### 修改五：把验收标准从“功能可用”提高到“能力可生成”

新增验收标准：

- 教师能生成一个内部研究小站。
- 教师能生成一个可复用数据处理脚本。
- 教师能生成一个文献追踪器或采集器。
- 管理员能审查所有生成物、运行日志、成本和权限。
- 平台能把生成物沉淀为可复用模板或工具。

## 十、推荐最终叙事

对外汇报时，不要只说“我们有文献、数据、写作、实验、培训六大模块”。这种说法很容易和旧方案撞车。

建议这样讲：

> 传统 AI 赋能科研平台是把工具和资源聚合起来，让教师自己去使用。我们的方案是建设一个 AI 原生科研操作系统，并进一步把最新模型能力、工具调用、代码生成、沙箱执行、MCP 协议和低成本 Web 工程整合为科研能力生成工厂。平台不仅能辅助教师完成文献、数据、写作和申报，还能按需生成新的研究小站、分析脚本、交互看板、采集器和学科智能体，并把这些生成能力纳入权限、审批、审计、复现和复用体系。它不是旧酒换新瓶，而是让高校具备持续生产科研工具和科研知识资产的能力。

## Sources Checked

- OpenAI Responses API: agentic primitives, built-in tools, stateful context, tool loops, MCP support.
  <https://developers.openai.com/api/docs/guides/migrate-to-responses>
- OpenAI MCP and Connectors: remote MCP tools, approvals, security risks.
  <https://developers.openai.com/api/docs/guides/tools-connectors-mcp>
- OpenAI Code Interpreter: sandboxed Python execution for data analysis and code iteration.
  <https://developers.openai.com/api/docs/guides/tools-code-interpreter>
- Model Context Protocol specification 2025-11-25: resources, prompts, tools, authorization, JSON-RPC.
  <https://modelcontextprotocol.io/specification/2025-11-25/basic>
- Next.js App Router and Backend for Frontend docs: modern low-cost full-stack app delivery patterns.
  <https://nextjs.org/docs/app>
  <https://nextjs.org/docs/app/guides/backend-for-frontend>
- Vercel AI SDK agents and UI stream docs: tool-loop agents and streaming interactive AI UI.
  <https://ai-sdk.dev/docs/agents/overview>
  <https://ai-sdk.dev/docs/reference/ai-sdk-core/create-agent-ui-stream>
