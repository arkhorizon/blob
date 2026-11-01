---
title: Pi 深度拆解：极简内核如何长成一个生态
description: 从 agent loop、session 树、动态组装到崩溃恢复与记忆设计——七个视角拆解 pi coding agent 的核心机制，以及 1.0 到 1.4 背后的工程决策。
date: 2026-11-01
author: Ark
tags:
  - AI
  - Agent
  - 源码拆解
cover: https://img.arkblob.ccwu.cc/articles/pi-agent-nb/cover.jpg
draft: false
---

## 第 1 章 极简内核的哲学：一个 harness，不是一艘航母

**所有 agent 框架都在做加法，pi 在做减法。**

2026 年的主流叙事是"全能"：内置 sub-agent 编排、plan mode、任务看板、记忆库、插件市场，装完即得一个"企业级 agent 平台"。而 pi 的 README 亮出的立场几乎是反直觉的——它刻意不内置 sub-agents 和 plan mode，然后补了一句态度鲜明的话：

> Pi ships with powerful defaults but skips features like sub-agents and plan mode. **Ask Pi to build what you want**, or install a package that does it your way.

缺什么？让 agent 自己给你造，或者装一个别人造好的包。这句话就是 pi 的产品定义：**它不是一个开箱即全的 agent，而是一个让你把它改造成"你的 agent"的 harness。**

![图：阿Pi在黑板上讲解“小内核 大生态”，loop 被粉笔圈出重点](https://img.arkblob.ccwu.cc/articles/pi-agent-nb/chapters/01-philosophy/kernel-blackboard.jpg)

### 1.1 减法的本质：主循环足够小，才轮得到你做主

打开 pi 的 monorepo，分层清晰得近乎固执：

- **pi-ai**：模型接入层。多 provider 流式调用、重试、模型目录，不含任何 agent 逻辑；
- **pi-agent-core**：agent loop 本体。一个状态机 + 事件流：`agent_start → turn_start → tool calls → tool results → turn_end → agent_end`，外加 `transformContext` 和 `convertToLlm` 两个上下文变换钩子；
- **pi-coding-agent**：CLI 与默认工具集（read/bash/edit/write）、session 管理、扩展系统；
- **pi-durable**：可恢复的持久化 harness（第 4 章主角）；
- **chord**：插件热重载宿主运行时与 RPC；
- **pi-tui**：终端 UI 组件。

这个分层的意义不在"模块化好看"，而在**职责边界严格**：agent loop 不知道 session 的存在，session 不知道 CLI 的存在。每一层都可以单独拿来嵌到你自己的应用里——SDK 从 20 行跑通一个 loop，到完全接管上下文组装，一共就几个递进示例。**分层不是架构审美，是把"你能替换什么"写进了代码结构里。**

![图：阿Pi讲解 pi 的四层结构：模型接入、agent loop、CLI 会话、扩展生态](https://img.arkblob.ccwu.cc/articles/pi-agent-nb/chapters/01-philosophy/core-layers.jpg)

对比不少框架的做法：主循环、工具调度、记忆、编排、UI 缠在一个 runtime 里，想换掉其中任何一层，都得先读懂整个 runtime。pi 的赌注是：**只要 loop 足够小且边界干净，扩展就不再需要框架"支持"，而是天然可行。**

### 1.2 减法的杠杆：扩展点密度决定生态上限

极简不等于简陋。pi 把复杂度从"内置功能"转移到了"扩展点密度"上：

- **Extensions**：TypeScript 模块，直接加载进 pi 进程，可注册工具、命令、快捷键、provider、事件处理器、渲染器、终端 UI；
- **Skills**：按需加载的说明书——启动时只注入 name + description，模型判断任务匹配才读取全文（Agent Skills 规范实现）；
- **Prompt templates / Themes**：输入侧与渲染侧的轻量定制；
- **Pi Packages**：以上几类资源的打包分发单元，npm/git 装包即用，pi.dev 维护公开包目录。

数一下 npm 生态里的 pi 包：sub-agents、写沙箱、后台任务、SSH、记忆扩展、观测插件……README 里刻意不做的功能，社区全都补上了，而且不止一个实现。**"砍功能"砍出的空位，成了生态的生长点。** 这正是 pi 设计上的自洽：如果这些功能内置，社区只能做"配置"；不内置，社区才能做"实现"。

### 1.3 一个 harness 的克制清单

把 pi 的"不做清单"和"做清单"放在一起，设计意图一目了然：

| pi 不内置 | pi 交付 | 换来的 |
|---|---|---|
| sub-agents | 扩展点 + 包生态 | 多种实现方案竞争 |
| plan mode | 极小的核心 loop | 可整体替换的心智模型 |
| 记忆组件 | session 树 + custom entry + compaction | 记忆成为数据模型问题（第 5 章） |
| 权限系统 | 信任边界 + OS 权限复用 | 更少的抽象层 |

这就是传统软件几十年炼出来的纪律：**小内核、清晰边界、组合优于配置**。pi 是这套纪律在 agent harness 上的一个高质量落地。

### 本章要点

- pi 的极简是策略而非口味：小 loop + 高密度扩展点 = 生态生长空间；
- 分层的价值是"每一层都可被你替换"，SDK 与 extension 共用同一套内核 API；
- 一句话总结：pi 的竞争力 = 内核小到能被完全理解，扩展点多到能被完全重组。

---

---

## 第 2 章 上下文工程：session 树、compaction 与 prompt cache 的共舞

大多数 agent 的上下文管理是"一维"的：一条消息数组，满了就截断或摘要。pi 的出发点不同——**上下文的底层是一棵树，所有的上下文操作都应该是这棵树上的指针移动，而不是数据改写。** 这一个决定，同时解决了分支、压缩、缓存三个问题。

![图：阿Pi在黑板上画 session 树，橙旗标记活跃分支](https://img.arkblob.ccwu.cc/articles/pi-agent-nb/chapters/02-context/session-tree.jpg)

### 2.1 会话是一棵树，不是一个数组

Session 是 JSONL 文件，每个条目带 `id` 和 `parentId`，当前条目到根的路径就是**活跃分支**，它才是下一次模型请求的历史。这意味着：

- **分支零成本**：`/tree` 回到任意历史节点重新提交，旧分支原样保留在文件里——不是"撤销后重来"，是"另开一条路"。`/fork`、`/clone` 则把分支物化为独立 session；
- **改写即分支**：你在 `/tree` 里选中一条旧的用户消息，编辑后重新提交，pi 不会修改任何已有条目，只是新建一条指向旧节点的子条目。历史的完整性天然被保证；
- **离开分支不丢上下文**：从一条做了大量工作的分支切走时，pi 可以自动摘要这条分支，把摘要挂到你要去的分支上——放弃路径，保留结论。

**每一步都只追加、只移动指针。这个性质后面会反复出现：第 4 章的崩溃恢复、第 5 章的记忆设计，都建立在"session 是树"之上。**

### 2.2 Compaction：在树上做精确手术

上下文逼近窗口时的自动压缩，pi 的实现有几个容易被忽略的精确性：

**切点有铁律。** 从尾部回走 token 估算，直到 `keepRecentTokens`（默认 20k）得到切点——但**永远不在 tool result 处切**（工具结果必须和它的调用待在一起，否则下一轮请求直接报错）。切点只能是用户消息、助手消息、custom message 这些"安全边界"。

**长 turn 有专门算法。** 如果切点附近是一条超长的用户消息 span（一次提交引发的多轮工具调用），pi 会生成两份摘要——历史摘要 + span 前缀摘要——再合并，保证"正在进行的任务"不被拦腰斩断。

**摘要是条目，不是替换。** `CompactionEntry` 带 `firstKeptEntryId` 追加到树上，旧条目一个字节都不动。模型看到的是 `summary + firstKeptEntryId 之后的消息`，而你随时可以 `/tree` 回到压缩前的完整历史。1.4.0 还修掉了摘要输出的固定上限——推理模型经常把输出 token 烧在 thinking 上，旧上限会让摘要请求必然失败，现在摘要直接使用模型的输出上限。

**压缩是可编程的。** `session_before_compact` 事件允许扩展接管摘要生成——第 5 章会看到社区记忆插件如何利用这个钩子在压缩时顺手做记忆 handoff。

### 2.3 Prompt cache：一条藏在 changelog 里的主线

这是 pi 上下文工程里最不显眼、却最能体现工程态度的一条线。翻遍 1.0→1.4 的 changelog，你会发现大量修复的目标是同一个：**任何上下文变化，都不能破坏 provider 的 prompt cache。**

![图：cache 铁律——尾部追加打勾，中间改写打叉](https://img.arkblob.ccwu.cc/articles/pi-agent-nb/chapters/02-context/cache-append.jpg)

- **1.0.1**：Anthropic 的工具在会话中途重定义时，改为在对话内联定义工具——同名重定义不再重发整个工具列表，cache 保留；
- **1.2.0**：修复扩展触发的 run 在首次工具调用后丢失 system prompt 新增分区的问题——那会"每次 run 破坏 cache 两次"；同一版本，`serializeConversation` 不再携带 thinking 块，因为重放的 thinking 不在活跃上下文里，带上的话摘要请求会比它要摘要的上下文还大；
- **1.3.0**：GPT-6 中途改 thinking level 保住 cache；切模型时丢弃旧模型的 thinking 块而不是当正文发给新模型；resume 时恢复会话期间激活的工具集（否则每次 resume 工具列表都变，cache 全毁）；Kimi Code 切到 Chat Completions 协议后，中途加工具不再打爆 cache；
- **底层机制**：session 的第一条系统消息持久化完整的 prompt 分区 + 工具清单，之后的变化持久化为**按分区名打补丁的系统消息**（`toolsAdded`/`toolsRemoved`）——重放补丁序列即得当前状态，没有独立维护的"prompt 状态"，也就没有状态与历史不一致的缝隙。

为什么值得做到这个程度？因为长会话里 cache 命中直接决定成本和延迟：一次 cache 失效，等于把整个上下文按未命中价重算一遍。**pi 把"不动历史前缀"当作和"正确性"同级的约束，这在 agent 框架里是少数派。**

### 本章要点

- 树是根：分支、压缩、恢复、记忆全部是同一棵树上的操作；
- 压缩是追加式手术：切点有铁律、长 turn 有专门算法、摘要是可编程的条目；
- cache 是隐形主线：所有上下文变化都设计成"前缀稳定 + 尾部追加"，1.0→1.4 的十几条修复就是这条纪律的账单。

---

## 第 3 章 动态组装：skill 是"按需说明书"，tool 是"运行时积木"

skill 和 tool 都能"动态"，但它们的动态是两回事：**skill 的成本在内容，动态的是"何时读"；tool 的成本在执行与声明，动态的是"何时装"。** pi 对这两类资源给出了截然不同却同样彻底的方案，合起来才是完整的"上下文按需供给"。

![图：skill 加载——目录常驻，全文按需](https://img.arkblob.ccwu.cc/articles/pi-agent-nb/chapters/03-dynamic-assembly/skill-lazy-load.jpg)

### 3.1 Skill：目录与正文分离

pi 实现了 Agent Skills 规范，但值得讲的是它对"加载"二字的精确拆解：

- **启动时**：扫描所有 skill 目录（用户级、项目级、`.agents/skills/`、包贡献的路径），只把 `name + description + 路径` 注入系统提示。description 就是路由信息——"做什么 + 什么时候用"写不清的 skill，模型永远不会选它；
- **运行时**：模型判断任务匹配，自己用 read 工具读取 `SKILL.md` 全文。指令是普通文件读取，不走特殊通道；
- **强制路径**：模型可能漏读，所以 `/skill:name` 允许人工强制加载，`disable-model-invocation: true` 还能把 skill 从模型视野里藏掉、只留命令入口。

这个"目录常驻、正文按需"的结构，本质上把 skill 的上下文成本压到了一条 description 的水平——你可以装几十个 skill 而几乎不花 token 预算。**加载的粒度从"功能"细化到了"说明书的一页"。**

更进一步的动态性：`resources_discover` 事件让扩展在运行时贡献新的 skill/prompt/theme 路径——skill 目录不必在启动前就存在，可以由扩展按需生成或从远端拉取。配合 `/reload` 热重载，pi 的"说明书库"是活的。

### 3.2 Tool：运行时注册与卸载

Tool 的动态是另一条路：`pi.registerTool()` 在任何时刻都能注册新工具，`setActiveTools` 与 `--tools +name/-name`（1.1.0）随时调整活跃集。`dynamic-tools.ts` 示例展示了完整形态：session 启动时装一个工具，用户敲 `/add-echo-tool foo` 就地再装一个——模型下一轮请求就多了一个可调用的能力。

关键在于：**pi 对"工具变化"的上下文处理和对"内容变化"一视同仁。** 新工具的 `promptSnippet` 进入系统提示工具区、`promptGuidelines` 进入规则区，且只在工具活跃期间存在；变化以补丁式系统消息追加进 session（第 2 章讲过的 `toolsAdded`/`toolsRemoved`），prompt cache 不破。工具的装卸因此是"廉价且可逆"的。

还有一个反方向的能力：`prepareLoadout` 钩子让一个编排型工具反向控制别的工具可见性——`codemode` 激活时可以把其他工具从模型视野里藏起来（工具仍然可调用，只是声明被隐藏），由自己在脚本里代为调度。**工具不仅能加，还能被别的工具"收编"。**

![图：阿Pi从工具箱运行时组装工具积木](https://img.arkblob.ccwu.cc/articles/pi-agent-nb/chapters/03-dynamic-assembly/runtime-tools.jpg)

### 3.3 工具多到放不下怎么办：预算与检索

工具声明本身吃上下文。当工具数量膨胀（比如挂了几个 MCP server），pi 的答案是两层缓存友好型检索：

- **codemode 的声明预算**：活跃时所有工具声明共享 3000 token 的内联预算，装不下的工具不出现在系统提示里——模型在 QuickJS 脚本里用 `searchTools()`（BM25 相关度排序）按需检索，`describeTool()` 查看完整声明后再调用。`codemode.mode: "only"` 甚至可以把全部工具都藏进这条检索通道；
- **MCP 的 deferred 工具**：延迟加载的工具通过 `tool_search` 在需要时被"提拔"为活跃工具。1.3.0 专门修了一个 bug：resume 后这些工具曾因 session 恢复顺序问题被丢弃。

这两层机制的共同点：**把"工具列表"从静态枚举变成了可查询索引。** 上下文里放索引，仓库里放能力，这和第 2 章的"目录与正文分离"是同一个思想在不同资源上的投影。

### 3.4 组装的最后一环：分发

动态组装的生态闭环靠 Pi Packages：扩展、skill、prompt 模板、主题打成一个普通 npm/git 包，`pi install npm:xxx` 即装，`-e` 标志可以试用不安装，pi.dev 维护公开包目录。信任模型也划得清楚：项目级包只在项目信任授予后才加载。第 1 章说的"砍掉的功能由社区补齐"，物流系统就是它。

### 本章要点

- skill 动态在"读取"：目录常驻、正文按需、路径可运行时贡献；
- tool 动态在"注册"：随时装卸、变化走补丁、cache 不破、还能被编排工具收编可见性；
- 规模化靠索引化：声明预算 + BM25 检索 + deferred 提拔，工具列表从枚举变索引。

---

## 第 4 章 长任务的续命术：agent loop 的自动恢复

agent loop 本身不难写，难的是让一个跑了几个小时的长任务在"不可抗力"下活下来：进程被杀、服务宕机、模型 5xx、Cloudflare 把你的 Durable Object 驱逐了。大多数框架的答案是"重跑一次 prompt"，然后眼睁睁看着已经花了几个小时和几十美金的工作全部蒸发。pi 的答案分两层：coding-agent 层给你"可续的会话"，pi-durable 层给你"可续的 loop"。

![图：中断点之后不重头——从 checkpoint 续跑](https://img.arkblob.ccwu.cc/articles/pi-agent-nb/chapters/04-recovery/checkpoint-resume.jpg)

### 4.1 第一层：会话就是恢复点

第 2 章讲过 session 是树。这个设计在恢复场景下的价值此刻显形：**resume 不是"恢复现场"，而是"重放树路径"。** 每条消息、每次工具调用与结果、每次压缩，本来就是落盘的 JSONL 条目；进程重启后把活跃分支重新装进上下文，模型看到的世界和中断前分毫不差。`--continue` 一条命令回到最近会话，工具集、模型选择一并恢复（1.3.0 专门修了"resume 丢工具"——因为工具列表变了会连坐 prompt cache）。

在错误处理上，1.0→1.4 的 changelog 是一部"恢复健壮性补课史"：上下文溢出自动 compact-and-retry（压缩后原样重试一次）；越来越多的瞬态错误被正确分类为可重试——网关上游故障、代理中转的 stream 断连、Vertex OAuth token 过期刷新；甚至"重启后 OAuth 回调端口被占导致 state mismatch"这种边角也给了确定性的失败而非挂死。原则只有一条：**能区分"这次重试有意义"和"重试也没用"，前者重试，后者立刻报错。**

### 4.2 第二层：pi-durable，把 loop 做成状态机

pi-durable 是 pi 1.0 同步发布的实验性包，它把恢复从"会话级"推进到"任务级"。核心机制四件：

**Commit-before-show。** 所有变更（消息、工具调用、你自己的文档状态）经过一条原子提交线，**先落库，后展示**。进程在任何时刻死掉，重开时看到的世界都是"最后一次提交"的一致状态——不存在"模型说了一半但没记下来"的裂缝。

**任务即 checkpoint 状态机。** 一次 run 是一棵任务树：`pi.generation` 任务调用模型、拥有它的 `pi.tool` 任务、等待它们完成。每个任务每完成一步就存 checkpoint，进程重启后从最近 checkpoint 继续，而不是从头重跑。被中断的模型请求算一次失败尝试：部分回答保留为 aborted 条目，退避后重试。

**重放安全语义。** 这是最精妙的部分。工具调用有自己的意图先行提交；崩溃后只有声明为 `replay: "safe"` 的工具才会重跑，否则模型拿到 `interrupted` 错误和已提交的部分输出——**框架替你回答了"这个工具重跑有没有副作用"这个问题**。嵌套调用（codemode 脚本调工具）按 key 关联：重放的脚本以相同顺序调用时，拿回的是已完成的旧结果而不是重新执行。

**Crash loop 熔断。** 如果宿主进程总是在下一个 checkpoint 之前死掉（内存耗尽、确定性 bug），无限恢复就是无限烧钱。pi-durable 给每个任务计崩溃数，达到 `restartLimit`（默认 5）就终止任务并上报——恢复机制自己也需要熔断，这是大多数"自动恢复"叙事里缺失的一章。

![图：熔断器——重试上限不是失败，是保护](https://img.arkblob.ccwu.cc/articles/pi-agent-nb/chapters/04-recovery/restart-breaker.jpg)

### 4.3 最硬核的样本：codemode 脚本的确定性重放

看一个具体问题：一条 codemode 脚本正在 QuickJS 沙箱里跑，调了 7 个工具，进程在第 5 个工具的结果返回前死了。怎么续？

pi-durable 的做法是**确定性重放（deterministic replay）**：沙箱用虚拟时钟、种子化随机数、UTC 时区运行——脚本是确定性的；每个返回给脚本的工具结果在交付前先写入 journal；重启后重新执行脚本，按相同顺序把 journal 里的结果递还给它，脚本于是做出一模一样的调用，这些调用按 key 挂回各自的嵌套任务，脚本从断点继续。三条守卫保证重放不会"续错"：脚本走了和之前不同的路径、沙箱指纹或版本变了、或 `timeout_ms` 已过——任一命中，直接以错误终止而不是硬续。

这套机制的说服力在于它对复杂度的诚实：**恢复的通用解不是"快照一切"（沙箱内存快照几乎不可行），而是"确定性 + 输入日志"。** 这正是事件溯源、数据库 WAL 用了几十年的老办法。

### 4.4 面向宿主的恢复协议

pi-durable 还把"宿主会死"当成一等公民：每个 conversation 有持久化的 UUIDv7 会话身份（给 provider 做 cache 与会话亲和，跨重启/重试/压缩不变）；`requestId` 幂等——重试同一请求返回已有的 submission 而不是提交两次；任务可以"睡眠"——睡眠本身是持久化状态，进程不存在也能到点被唤醒；在 Cloudflare Durable Object 上，Harness 通过 `onWake` 把"什么时候需要被叫醒"告诉宿主，由宿主的 alarm 负责唤醒，驱逐和休眠都是正常流程而不是异常。

### 本章要点

- 会话级恢复：树重放 + 错误分类 + compact-and-retry，coding-agent 层零额外成本；
- 任务级恢复：commit-before-show、checkpoint 状态机、重放安全语义、crash loop 熔断，pi-durable 四件套；
- 确定性重放是"沙箱内长任务"恢复的正解：虚拟时钟 + journal + 三条守卫；
- 恢复协议的关键词汇是幂等（requestId）、持久睡眠、宿主协作——恢复不是重试的同义词。

---

## 第 5 章 记忆的正确打开方式：pi 没给你记忆，给你的是记忆的地基

personal agent 时代，记忆决定产品上限。但打开 pi 的源码你会发现一件反常的事：**这个生态里最活跃的 agent 框架，没有内置任何记忆组件。** 没有 memory 工具，没有向量库适配，没有"记忆面板"。这是缺失，还是判断？

![图：tree 即 memory——记忆是树上的条目，不是外挂的库](https://img.arkblob.ccwu.cc/articles/pi-agent-nb/chapters/05-memory/memory-as-tree.jpg)

### 5.1 地基四件套

pi 的立场是：记忆不是一个可以"装上"的功能，而是数据模型问题。它交出的地基有四件：

1. **树形 session**：一切对话历史以树的形式持久化，append-only、可分支、可重放——这天然满足好记忆的第一属性"永不丢、可追溯"；
2. **Custom entry**：session 条目类型是可扩展的。官方自己就这么用：codemode 的 `store()/load()` 把跨调用的小状态（游标、ID、摘要）作为 `codemode-store` 条目写进树，**分支各自可见自己路径上写入的值**——记忆跟着分支走，这是树式存储独有的语义；
3. **Compaction 结构化摘要**：第 2 章讲过，压缩摘要有固定结构（Goal / Done / In Progress / Blocked / Key Decisions / Next Steps / Critical Context），并且迭代式地把上一份摘要作为输入——这就是"会话内记忆"的收敛机制，`session_before_compact` 钩子还允许扩展接管摘要（顺带做记忆提取的最佳时机）；
4. **Handoff**：官方示例扩展，从一段对话生成自包含的上下文交接 prompt（决策、相关文件、下一步），跨会话不丢关键结论。

**这四件套没有一件叫"记忆"，但每一件都是记忆系统的一个必要组件。** pi 把"如何提取、如何注入、如何遗忘"留给了生态——于是社区长出了三种答案。

### 5.2 社区三派：同一个问题的三种性格

**pi-memory 派：文件即记忆，cache 是底线。** 记忆是 `~/.pi/agent/memory/` 下的 Markdown，用户可以 `cat`、可以 commit 进 git。写是带时间戳和哈希的 append；删除是"恢复式"的——先在 `recovery/` 留存再删，可 `memory_restore` 找回。最值得抄的细节是它的注入策略：**记忆块在 session_start 拍快照，之后逐 turn 输出字节级相同的内容，只在 compaction 等检查点才刷新**——因为任何中途变化都会打爆 prompt cache。记忆系统为 cache 让路，这是 pi 生态才有的约束意识。

**pi-hermes-memory 派：分类学 + policy 注入。** 这套移植自 Hermes agent 的实现把记忆分成六类（failure / correction / insight / preference / convention / tool-quirk），并且：用户纠正 agent 时立即落一条 correction；每 10 turns 后台复习对话并抽取值得存的；存满时自动合并旧条目而不是报错；密钥扫描阻止敏感信息落盘。它对注入问题的答案是 **policy-only**：默认不注入任何记忆本体，只注入一段"什么时候该调 memory_search"的常驻策略，让模型按需检索。最妙的细节是 **standing instructions**：用户手写的常驻指令有硬上限（20 条 / 2000 字符），且**agent 无权自我提升为常驻指令**——信任边界画得极清楚。

**Respire 派：引擎外置，pi 只做薄客户端。** `@rsrsai/pi` 把策略、判重、加密、同步全部放在独立的 rsrs 引擎里，扩展只做两件事：用户输入时以隐藏 context 消息附带召回的标题（最多 5 条 / 1500 字符，正文按需拉取）；"记："前缀触发显式存储。它的三态回执设计值得所有做记忆的人抄写一遍：**已存 / 待决 / 未确认——未确认时必须先查库，禁止盲目重试**，因为写入可能已经成功。这是把第 4 章的恢复语义用在了记忆写入上。

三派方案各异，但在两件事上完全一致：**节制注入**（快照 / 只给策略 / 只给标题）和**cache 友好**。这不是巧合，是 pi 的上下文经济学对生态的塑造。

![图：上下文预算——记忆很多，能进上下文的只有两张](https://img.arkblob.ccwu.cc/articles/pi-agent-nb/chapters/05-memory/context-budget.jpg)

### 5.3 业界横评：收敛点在哪

把视野拉到 pi 之外，当前公认做得好的几个方案：

- **mem0**（68k stars）：2026-04 的新算法很有信号量——**ADD-only 单遍抽取**：写入时一次 LLM 调用只做抽取、不做更新删除（记忆只增不改），把"过期"留给检索期解决：实体链接 + BM25/语义/实体三路召回融合 + 时序推理（"哪个时间的哪条记忆对这次查询有效"）。LoCoMo 92.5 / LongMemEval 94.4，p50 延迟 1 秒级。**把维护成本从写入期挪到检索期，是延迟与复杂度的聪明再分配**；
- **Letta**（MemGPT 正统）：self-editing memory blocks，agent 自己编辑自己的核心记忆区。优雅，但把正确性押在模型的自控力上；
- **Zep / Graphiti**：时序知识图谱，每条事实带有效期窗口（"Kendra 喜欢 Adidas，截至 2026-03"），表达力最强，运维最重；
- **Claude Code auto memory**：纯文件自动维护。最简单，但"哑"——检索靠模型自己 read。

横评的结论不是排名，而是**收敛**：append-only 写入、检索期排序融合、节制注入、cache 友好、可恢复删除。五条里，前一条和最后一条 pi 的树天然就有，中间三条恰好是三个社区插件各自发力的地方。**好的记忆方案不是发明出来的，是在正确的数据模型上收敛出来的。**

### 5.4 好记忆的设计判据

把这一章压成六条可操作的判据，留给正在做 personal agent 的你：

1. **写入 cheap，检索 smart**：写入只做抽取不做裁决（mem0 的 ADD-only），裁决推迟到检索期；
2. **注入有预算，且字节稳定**：注入策略必须把 prompt cache 当成第一约束（pi-memory 的快照法）；
3. **删除是状态不是操作**：恢复式删除，别让"忘"变成不可逆（pi-memory 的 recovery/）;
4. **记忆跟随分支**：在 A 分支写入的记忆不该污染 B 分支（pi 树的原生语义）；
5. **信任边界显式化**：agent 能写记忆 ≠ agent 能写常驻指令（hermes 的 standing instructions）；
6. **写入也要恢复语义**：未确认就是未确认，先查库再决定重试（Respire 的三态回执）。

### 本章要点

- pi 不做记忆组件是立场：记忆是数据模型问题，树已经给了答案的一半；
- 社区三派（文件+cache 快照 / 分类+policy 注入 / 外置引擎+三态回执）是另一半的三个平行实现；
- 业界收敛在 append-only + 检索期融合 + 节制注入 + cache 友好 + 可恢复删除——pi 的设计与这个收敛方向互相印证。

---

## 第 6 章 1.0 → 1.4：三周快进，看一个 harness 的生长

pi 在三周里发了 9 个版本（v1.0.0 → v1.4.0，2026-10-01 至 10-21），changelog 累计 200 余条。逐条读下来，它不是功能清单，而是一部**设计立场的执行记录**——第 1 到 5 章讲的所有机制，几乎都能在这个时间线里找到自己的施工痕迹。这一章按主题收拢，看一个极简内核怎么长大。

![图：从 v1.0 到 v1.4，五块里程碑一路跑上来](https://img.arkblob.ccwu.cc/articles/pi-agent-nb/chapters/06-evolution/version-timeline.jpg)

### 6.1 Prompt cache 保卫战（贯穿全线）

1.0.1 Anthropic 工具内联定义防 cache 失效；1.1.0 Bedrock Claude 的 prompt caching；1.2.0 修扩展触发的 run"两次破坏 cache"、`serializeConversation` 摘要请求不带 thinking；1.3.0 GPT-6 改 thinking level 保 cache、切模型丢旧 thinking、resume 恢复工具集、Kimi Code 中途加工具不破 cache；1.4.0 修"移除工具导致 deferred 加载后 cache 全毁"。十几个 fix 一个主题：**前缀即资产**。这条线在 1.3.0 还延伸到了供应商侧——给 Kimi 换成官方 Chat Completions 协议，理由正是新版协议支持"中途加工具不清缓存"。

### 6.2 codemode 从"能用"到"好用"

1.0.0 把 codemode 的提示词砍掉约 40%（GPT-5.6 请求从 ~5300 token 降到 ~3300），错误信息改为自解释（`tools.Bash` 会提示 `tools.bash`）；1.2.0 加 alias、`reachesTools`、MCP 命名空间声明与 `describeNamespace`；1.3.0 修 worker 泄漏与超时后不可中断的内建工具；1.4.0 并行脚本排队等待空闲 worker 而不是失败、`models.classify()` 支持图像分类器。轨迹清晰：**先压缩成本，再补齐并发语义，最后接上非 LLM 模型**——一个"用代码调工具"的工具，长成了 pi 的批处理引擎。

### 6.3 模型目录：从配置变成基础设施

这条线最容易被忽略，却是 pi 区别于"套壳"项目的分水岭：per-key 的 OpenRouter 分组定价（1.0.1）、模型目录 schema 化并发布 `models.schema.json`（1.2.0）、目录与目录间的兼容性检查进 CI（1.2.0）、`models.json` 的字段级参考文档直接从 schema 生成（1.4.0）、provider 的 `compat` 字段一路扩展到分类器模型（1.4.0）。**当模型目录有了 schema、CI 校验和生成式文档，"支持哪些模型"就从 README 承诺变成了可验证的契约。** Nix 构建的目录 pin 机制（1.3.0 修复离线构建）则说明这套目录已经深入到发行工程的毛细血管。

### 6.4 恢复健壮性：可持续的分类学

第 4 章讲过的恢复机制，在时间线上的样子是：1.0.4 起"更多瞬态错误可重试"成为每个版本的固定栏目；1.3.0 修 deferred MCP 工具在 resume 时丢失；1.4.0 修网关上游失败、代理 stream 断连、Vertex token 刷新三类重试盲区，并让 compaction 摘要用模型完整输出上限（此前推理模型经常把摘要请求顶爆）。**恢复能力的建设不是一次性交付，而是持续的错误分类学功课**——每一类新的故障模式（新代理协议、新 OAuth 流程）都要被归入"可重试/不可重试"的正确桶里。

### 6.5 生态与发行：把"可分发性"做成工程

1.1.0 managed install 修掉"旧版本堆积"；1.2.0 移除 `npm-shrinkwrap.json`（库用户可覆盖依赖，安装器继续 pin）；1.3.0 内部依赖精确 pin 防止混装不兼容版本；1.4.0 扩展包支持更新后展示自己的 changelog。加上一直在的 supply-chain 硬化（lifecycle script 白名单、`npm audit` 定时任务），pi 在认真回答一个多数 agent 项目回避的问题：**一个要装到用户机器上的 agent，发行工程应该长什么样。**

### 6.6 版本叙事之外的三个观察

- **砍掉的东西不再回来**：1.2.0 移除了未发布的 experimental server/client/plugin 栈和 chord 依赖——宁可删除也不让半成品挂在包里，"极简"是靠删维护的；
- **修复的密度分布暴露优先级**：cache 和恢复相关的 fix 密度远高于 UI 功能，工程注意力的流向比 roadmap 更诚实；
- **新功能几乎全是"给生态修路"**：`+name/-name` 工具选择、alias、包 changelog、schema 文档——主线剧情不是 pi 自己变强，而是让长在它上面的东西更容易变强。

### 本章要点

- 三周 9 个版本的 changelog 是设计立场的执行记录：前缀即资产、目录即契约、恢复即分类学；
- codemode 的成长路径（压缩成本 → 并发语义 → 非对称能力）是 pi 式功能演进的标准模板；
- 极简不是一次性的架构决定，而是每个版本都在做的减法（删除 experimental 栈、砍 40% 提示词）。

---

## 第 7 章 尾声：自己动手，三十行改造 pi

读了五章机制，最后回到 pi 的那句 README："Ask Pi to build what you want。" 这不是口号，是一个可验证的承诺——本篇用一个真实存在的 30 行扩展示例兑现它。这个 `dynamic-resources` 扩展的完整逻辑：

```typescript
export default function (pi: ExtensionAPI) {
  pi.on("resources_discover", () => {
    return {
      skillPaths: [join(baseDir, "SKILL.md")],
      promptPaths: [join(baseDir, "dynamic.md")],
      themePaths: [join(baseDir, "dynamic.json")],
    };
  });
}
```

十余行有效代码，运行时为 pi 贡献新的 skill、prompt 模板和主题。把第 3 章的 `registerTool` 和第 4 章的事件钩子加进来，你就有了一个按项目动态装配能力的 agent。**这些扩展点没有任何一个是"内部 API"——它们和官方内置功能走同一条公共通道**，这正是第 1 章说的"分层不是架构审美"的落地形态。

![图：阿Pi在自己的树洞工坊里](https://img.arkblob.ccwu.cc/articles/pi-agent-nb/cover.jpg)

### 什么时候该选 pi

给一个诚实的适用性判断，而不是布道：

- **选 pi**：你想完全理解并掌控你的 agent；你的需求会长成"标准功能集"之外的形状；你在意 prompt cache、恢复语义这些"看不见的成本"；你想让 agent 能力跟着项目走（项目级 skill/扩展/信任边界）；
- **慎选 pi**：你想要开箱即全的全家桶、官方保姆式的 sub-agent 编排和 plan mode、以及一个大而全的社区——pi 的生态年轻而锋利，但它的哲学就是让你自己当一等公民，这需要投入。

### 全系列回顾

- 第 1 章：极简是策略——小内核 + 高密度扩展点，砍功能砍出生长空间；
- 第 2 章：session 是树——分支、压缩、缓存全是同一棵树上的操作；
- 第 3 章：动态组装——skill 分离目录与正文，tool 随时装卸，规模化靠索引；
- 第 4 章：恢复是设计出来的——commit-before-show、checkpoint、确定性重放、熔断；
- 第 5 章：记忆是数据模型——树给了一半答案，生态给出另外一半；
- 第 6 章：三周五版本——changelog 是设计立场的执行记录。

把这些收拢成一句话：**pi 证明了 agent harness 的竞争力不在于内置了多少功能，而在于把多少"你将来想要的东西"留成了可能。** 传统软件三十年的纪律——小内核、清晰边界、组合优于配置——在 agent 时代不仅没有过时，反而成了最激进的设计。

去把 pi 改造成你的样子吧——毕竟它连 README 都是这么说的。
