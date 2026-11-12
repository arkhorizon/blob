---
title: Pi 和 DeepSeek Harness：两款 agent 框架的生态对比
description: 光看 star 数选框架会踩坑。用实测数据对比 Pi 和 DeepSeek Harness 的生态：现状、扩展难度、长期跟下去的风险。
date: 2026-11-12
author: Ark
tags:
  - agent
  - AI
  - 开源
  - 框架对比
cover: https://img.arkblob.ccwu.cc/articles/pi-vs-dsh-ecosystem/cover-v3.jpg
draft: false
---

最近半年 agent 框架这个赛道特别热闹，而热闹里有两个名字经常被放在一起提：一个是 Pi（GitHub 上的 earendil-works/pi），一个是大模型公司 DeepSeek 开源的 DeepSeek Harness，下面简称 dsh。

两个项目 star 都很高，但如果你把它们当成「两个差不多的框架」来选，很容易踩坑。因为比框架好不好，光看 star 数没用，得看生态：外面已经长出来多少东西、你上手用顺不顺、以后跟着它走累不累。

这篇是我基于两边仓库和 npm 的一手调研（数据截至 2026 年 11 月 12 日），把这三件事摊开来讲。

![图：小老鼠讲师在黑板前对比 Pi 的大集市与 dsh 的整齐货架](https://img.arkblob.ccwu.cc/articles/pi-vs-dsh-ecosystem/cover-v3.jpg)

## 一、两家生态现在长什么样

先看一组实测数据：

| 维度 | Pi | dsh |
|---|---|---|
| GitHub star | 12.1 万 | 27.9 万（六周从 3.2 万冲上来） |
| 贡献者 | 307 人 | 52 人（基本都是 DeepSeek 团队） |
| 近 30 天提交 | 939 | 4486 |
| Issues / feedback | 开放，277 个在公开讨论 | 普通问题主要走 PR 与 Discussions；不依赖公开 issue 排队 |
| 版本状态 | 1.5.x 稳定版，每周发版 | 0.2.x 预览版，只有 alpha / rc |
| npm 三方包 | 5370 个，每周下载 620 万次 | 55 个左右，几乎全是官方自己写的 |

这组数字背后是两种完全不同的生长方式。

Pi 是从个人项目一步步长大的，它的生态像一个大集市：任何人写了一个模型接入、一个工具、一个界面美化，都可以打成 npm 包发上去，装的时候一条 `pi install npm:xxx` 就完事。5300 多个包里有接各家模型的、有加 MCP 工具的、有改终端界面的，甚至有人把整个仓库复制出去改成了自己的分支版本。

dsh 的生态像一家店自建的全套货架：模型接入、工具、压缩、子 agent、会话存储……npm 上能直接看到的官方包约 55 个，仓库内部则拆成数百个细粒度 workspace package，统一命名为 `@deepseek-ai/dsh-xxx` 并在同一个 monorepo 里开发。外界不是只能给官方仓库提 PR：GitHub 有 `dsh-plugin` topic，社区也出现了 source-verified 精选目录和 experimental plugin index；只是这些入口还很新，不能和 Pi 的 npm 包市场比成熟度。

![图：小老鼠讲师敲黑板对比两边的贡献者和包数量](https://img.arkblob.ccwu.cc/articles/pi-vs-dsh-ecosystem/ecosystem-numbers-v3.jpg)

还有一个挺有意思的现象：npm 上有一批 dsh 相关的社区包，干的事是「帮 dsh 接上 pi 生态的现成货」——比如把 pi 的模型库包装给 dsh 用、把 pi 的终端界面移植过来。这说明 dsh 原生生态虽然声势大，但内容还年轻，社区先去 pi 那里借存货过渡。连 dsh 官方自己都有一个 `dsh-llm-pi-ai` 包，就是封装 pi 的模型库——pi 攒下的广度，连竞争对手都在用。

一句话总结这一章：**Pi 是大家一起摆摊的大市场，dsh 是一家店自建的全套货架。**

### 已经有人把轮子造好了吗

看生态不能只看包数量，还要看「我今天不用再写什么」。下面改成按能力维度对齐：Pi 和 dsh 各占一列，标出官方/内核已有、社区/可选、缺失或没有默认方案的部分。`✅` 表示官方或默认能力，`🟡` 表示社区扩展、可选包或实验入口，`❌` 表示没有可靠的默认方案。Pi 的认可信号主要看 Pi gallery 的下载排名和更新时间；dsh 的认可信号主要看是否进入 `awesome-dsh-plugin` 这类做过 source-level verification 的社区目录，以及是否绑定了明确的 DSH capability seam。两者都不是安全审计，也不能保证和未来版本兼容。

| 能力维度 | Pi：内核 / 社区生态 | dsh：官方 / 社区生态 | 主要缺口与选型影响 |
|---|---|---|---|
| 模型接入 | ✅ `pi-ai` 统一多 provider；🟡 社区 provider/本地模型扩展 | ✅ DeepSeek 官方接入；✅ `dsh-llm-pi-ai` 复用 Pi AI；🟡 社区模型桥 | Pi 的即时广度更强；dsh 对 DeepSeek 路径更深，跨厂商常要通过 adapter 或社区桥。 |
| 文件 / Shell / 编辑 | ✅ `read`、`edit`、`write`、`bash`、`grep` 等默认工具 | ✅ `fs`、`bash/pwsh`、tool executor、workspace 变更 | 两边基础编码能力都齐；dsh 把执行器接进统一 tool pipeline，Pi 更轻但边界更薄。 |
| MCP / Tool Search / Codemode | ✅ 内置 MCP、codemode、tool-search；🟡 `pi-mcp-adapter` 约 1.4M/月 | ✅ MCP client/resources；✅ native/PTC executor；✅ tool registry | 不必重写协议层。差异在治理：dsh 可替换 registry 和 executor，Pi 替换的是扩展入口。 |
| 上下文压缩 / 长会话 | ✅ 内置 compaction；🟡 `billion-context` 约 2.3M/月 | ✅ compaction-basic、image offload、tool-result pruner | Pi 可选方案更热闹；dsh 已把多类压缩策略拆成平台接缝。 |
| Web / 搜索 / 抓取 | ❌ 无核心默认；🟡 `pi-web-access` 约 1M/月、`pi-web-search` | ✅ 官方 web fetch/search providers；🟡 `dsh-free-web-search` | Pi 要选第三方包；dsh 默认底盘更完整，但具体 provider 仍要配 key 或换实现。 |
| 长期记忆 / 语义检索 | ❌ 无核心默认；🟡 `pi-memory` 约 54K/月 | 🟡 官方 session query 提供历史检索；🟡 `co-engram`、`dsh-memory-evolve` 仍早期 | 两边都没有稳定到可以无脑采用的统一 memory schema；这块仍容易重复造轮子。 |
| 子 agent / 编排 | ❌ 核心有意不内置；🟡 `pi-subagents`、`@tintinweb/pi-subagents` | ✅ `subagent` registry、fresh/fork/ACP/Codex/Claude providers；✅ workflow | Pi 能拼出原型但要选社区包；dsh 已有官方接缝，不过 API 仍会变。 |
| Plan mode / review | ❌ 核心不内置；🟡 `@plannotator/pi-extension` 约 94K/月 | ✅ 官方 plan mode；🟡 社区 review/annotator 增强 | 想要默认治理流程，dsh 更接近产品化；Pi 需要引入扩展并自定约束。 |
| 权限 / 沙箱 / 审批 | ❌ 核心明确无权限系统；🟡 `@gotgenes/pi-permission-system` 约 56K/月；🟡 外部容器 | ✅ sandbox、approval policy、FS policy、Windows ACL | 这是 Pi 最大的平台缺口；dsh 的安全边界已进入默认 profile。 |
| 观测 / tracing / 成本 | ✅ `pi-telemetry` 契约；🟡 Langfuse 约 93K/月、LangSmith 约 90K/月 | ✅ OTel/session telemetry；🟡 cost meter、context doctor | Pi 的第三方 observability 生态更广；dsh 的运行时和会话级观测更深。 |
| LSP / 代码质量反馈 | 🟡 `pi-lens` 约 80K/月，覆盖 LSP/lint/type check | ✅ 官方 LSP、stdio transport、tool-lsp | Pi 依赖社区包质量；dsh 已有平台级 language-server 入口。 |
| Git worktree / checkpoint | 🟡 官方示例覆盖 git checkpoint，但无统一默认产品 | 🟡 experimental worktree；🟡 `dsh-worktree` 入选社区精选 | 两边都要评估后采用；没有一边已经形成无可争议的标准方案。 |
| 浏览器 / Computer Use | 🟡 `@onkernel/browser-loop`、browser 扩展 | ✅ 官方 browser-use/computer-use 基础；🟡 CUA、社区浏览器插件 | Pi 更像工具箱拼装；dsh 已把浏览器/GUI 当成平台能力，但成熟度要按版本验证。 |
| UI / 客户端形态 | ✅ TUI 和扩展 UI 很强；❌ Web/Desktop 不是默认产品重心 | ✅ Web、Desktop、headless、SDK、ACP、client plugin slots | 做终端 agent 选 Pi 更顺；做多端平台或企业入口，dsh 的覆盖面明显更大。 |
| 远程执行 / SSH | 🟡 SSH 扩展示例；🟡 `pi-env` 触及 remote/ssh | ✅ official SSH/subprocess/sandbox seams；🟡 `dsh-ssh` 增强远端体验 | Pi 可做但要自建组合；dsh 的远程路径更接近一等能力。 |
| 插件发现 / 分发 | ✅ npm/git 包、`pi-package` gallery、5300+ 包 | 🟡 约 55 个官方 npm 包；✅ Plugin Manager；🟡 experimental index / awesome list | Pi 赢在广度和低门槛；dsh 赢在组合治理，但第三方发现还早期。 |

这张表背后的结论是：**Pi 的优势是「社区已经把常见编码 agent 工作流摆上货架」，dsh 的优势是「官方先把平台级轮子装进底盘，再由社区补长尾」**。Pi 在模型广度、TUI、observability 集成和 web access 上更容易直接复用；dsh 在沙箱审批、subagent/workflow、plan mode、LSP、多端 UI 和远程执行上更像已经铺好平台轨道。真正两边都还不成熟的，是长期记忆的标准 schema、worktree/checkpoint 的统一体验，以及三方包的跨版本兼容保障。

## 二、用它、扩展它，各自有多省事

数字看完了，换工程师视角：假设我今天要基于其中一个框架干活——接一个新模型、写一个工具、复用它的某块能力——实际体验差在哪。这部分我不空谈，两边都翻到代码层面了。

### Pi：门槛极低，质量自己把关

Pi 的核心代码小得让人意外：整个 agent loop（就是驱动模型、执行工具、循环往复的那个主循环）就是一个不到一千行的独立文件，而且是一个独立 npm 包。想研究它、复用它，直接装包看源码就行。

接一个新模型也简单。官方 README 里有个接本地 Ollama 的例子，核心就是用 `createProvider()` 描述三样东西：模型列表、鉴权方式、API 协议，二十行左右就能跑通。写扩展更直接：一个 TypeScript 文件，放进项目的 `.pi/extensions/` 目录就自动加载，改完敲个 `/reload` 热更新。扩展能注册工具、拦截事件、加自定义命令，官方示例目录里躺着二十多个现成例子，从「危险命令确认」到「git 自动存档」都有。

这套体验的代价在别处。生态太散了：5300 多个包没有统一的质量把关，名字互相撞车，作者弃坑的、写得糙的、和最新版本不兼容的都混在一起。选型踩坑要自己兜，文档得自己去读源码验证。另外 Pi 的核心虽然版本稳定（1.5.x），但它每月都在加新东西，你深度依赖的 API 偶尔也会变——只是它发版规律，变化都在 changelog 里，跟得上。

一句话总结：**用 Pi 是「马上能用，质量自己把关」。**

### dsh：接口位规整，但路还在施工

dsh 的思路完全不同：它不追求「随便什么人都能快速塞一个东西进来」，而是先把规矩定清楚。它的核心概念叫「能力接缝」（capability seam）：每一项能力——工具、模型、存储、压缩——都拆成「接口定义、具体实现、使用方」三个部分，实现可以随时替换，使用方只认接口。你写扩展时，官方文档会明确告诉你接缝在哪、能替换什么、不能动什么。

写一个工具，最小形态十几行就够：`defineTool()` 声明名字、参数 schema、执行函数，注册即生效，插件卸载时自动注销。而且你注册的工具会自动出现在它的编程模式里，模型可以直接 `await tools.你的工具名()` 调用，不用额外做集成。这套设计的规整程度确实高：接口错不了位、生命周期不用你操心、替换后端不用改调用方。

但门槛在另一个地方。它的官方文档里有一篇《添加包清单》，讲怎么往仓库里加一个新包——几千字的逐文件清单：package.json 有一堆不变式要满足（有专门脚本强制校验）、包命名要按「角色表」对号入座（Controller、Store、Registry、Resolver……每个词的适用条件都写了两列表格）、LLM 适配器要遵守九条协议义务（比如 usage 必须在 finish 之前发、不支持的能力要抛特定错误而不是静默忽略）。规矩清楚是清楚，但你得先读懂这一整套结构体系才能下手。

![图：一边是即插即用的插槽，一边是规整齿轮接口但围着施工围栏](https://img.arkblob.ccwu.cc/articles/pi-vs-dsh-ecosystem/extension-paths-v3.jpg)

更要命的是，这些接口本身还在动。dsh 至今没有 1.0，只有 0.2 的预览版，接口随时会调整。这不是猜测——官方那个封装 pi 模型库的包 `dsh-llm-pi-ai`，从 2026 年 8 月 10 日到 11 月 12 日，95 天里发了 **44 个版本**，从 0.0.1-rc 一路追到 0.2.2-rc。连官方自己的包都在追着接口跑、每隔几天重发一次，社区包要付的返工成本可想而知。

一句话总结：**用 dsh 是「路修得整齐，但路还在施工」。**

## 三、长期跟下去，各自的风险在哪

选框架不是只看今天上手快不快，还要看三年后你还在不在它的轨道上。这一章讲持有成本和长期判断。

**Pi 的风险是「散」。** 307 个贡献者、大量整仓分支，活力是真活力，但碎片化也是真碎片化。你今天依赖的某个三方包，作者可能明年就弃坑；社区里最活跃的分支已经开始和主线各走各的版本了。也就是说，攀上 Pi 之后，你的依赖面是自己一块块拼起来的，哪块塌了都得自己补。好消息是核心足够小（主循环不到一千行），真出问题，读源码兜底的成本不高。

**dsh 的风险是「独」。** 核心规矩仍由 DeepSeek 一家定：接口怎么设计、什么时候破坏性变更、什么实现能进入官方组合，外部主要能通过 PR、Discussions、Discord 和社区插件目录参与，但没有 Pi 那种以 npm 包为中心的低门槛分发面。它的迭代速度快得惊人（30 天 4486 次提交），这个速度由一家公司的 AI 辅助产能驱动，跟起来的成本就是上面那 44 个版本。它要是持续投入，规整的接口会吸引越来越多严肃的集成者；但它要是转向或者降温，官方底盘之外的第三方生态凉得也会很快。

所以我的选型建议是看你要干什么：

- 想**快速出活**、接各种模型、攒自己的工具库，能接受自己踩坑兜底——选 Pi。它的市场足够大，你要的绝大多数东西已经有人摆在那了。
- 想要**明确的契约**、干净的替换能力，赌它稳定下来之后生态会兑现——可以盯 dsh，但今天入场就要接受「追版本」的成本，最好等 1.0。

最后说句实在的：这两个生态其实不冲突。dsh 官方都在封装 pi 的模型库，你在选型时也完全可以取各家之长——用 pi 的广度解决「今天怎么跑起来」的问题，用 dsh 的结构化设计当成自己架构的参考答案。毕竟比来比去，真正要回答的问题是：**你要把自己的时间，押在哪个生态的演进节奏上。**
