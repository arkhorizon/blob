---
title: DeepSeek 开源 Super-agent 架构拆解：一套为"人的注意力"设计的 Agent 系统
description: 基于 DeepSeek Harness 官方设计文章与 dsh-superagent-prototype 源码的交叉验证式拆解：双层架构、事件驱动、异步 ReAct、存算分离与 Watchdog，附实验数据批判性解读与可直接落地的设计清单。
date: 2026-11-03
author: Ark
tags:
  - AI
  - Agent
  - 架构设计
cover: https://img.arkblob.ccwu.cc/articles/deepseek-superagent/cover.jpg
draft: false
---

> 本文基于 DeepSeek Harness 团队的设计文章《Super-agent 设计探索：迈向更自主的 Agent 系统》（2026-10-31 微信公众号首发）、开源原型 `deepseek-ai/dsh-superagent-prototype`（MIT）的设计文档与源码，以及社区首批实践，做一次面向 Agent 工程师的交叉验证式深度拆解。不是翻译，是拆解。

## 0. 先把事实说准

2026-10-31，DeepSeek Harness 团队做了两件事：在微信公众号发表设计文章《Super-agent 设计探索：迈向更自主的 Agent 系统》；同日在 GitHub 开源研究原型 `dsh-superagent-prototype`（MIT 协议）。

三个容易被标题党带偏的事实：

- **它不是产品**。README 第一句话就是"Research prototype for reference only, not an official DeepSeek product"。这是一个验证技术路线的原型，且官方坦承"大量工程由 coding agents 完成"。
- **文章 ≠ 原型**。README 明确说原型与文章描述的内部版本并不一致，文章中的部分设计（如异步 ReAct Loop 默认开启、存算分离、Watchdog）是方向而非已落地代码。
- **Super-agent 不是又一个框架**，而是一种架构形态的命名：能跨会话保持上下文、并行推进多项任务、持续在线响应环境事件的 Agent。文章的核心贡献是给出了支撑这种形态的五个模块化设计。

对 Agent 工程师来说，这件事的价值在于：DeepSeek 把一套已经在内部跑了几个月、日常参与问题复现修复和代码审查的系统设计思路，连同一份概念密度极高的原型，完整摊开了。下面逐层拆。

![图：A鼠讲师站在写有 Super-agent 的黑板前，粉笔勾出 Router 与三个 Worker 的架构草图](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/cover.jpg)

## 1. 问题定义：单任务上限在模型，多任务上限在你

文章的出发点是一个所有重度 Agent 用户都撞过的墙。

以 Coding Agent 为代表的单任务 Agent 已经证明：模型能用工具解决复杂问题，且越来越少需要人盯着。但现有主流设计以单一 Session 为基本单位，Session 之间彼此独立。当你并行推进多项工作时，必须手动切换并记住每个 Session 的上下文。DeepSeek 给出的观察是：**一个人通常只能同时跟进 3 到 5 个活跃 Session**。

于是得到本文最重要的一个不等式：

- 单任务的上限，取决于模型能力；
- 多任务的上限，取决于人的注意力。

"在本地单会话 Agent 上接 CLI、MCP 或外部连接器"这条常见的扩展路线，被文章判了死缓——它受制于三个结构性问题：单会话同步阻塞、多任务上下文混乱、本地设备离线即停。

突破方向是把 Agent 从"单次手动会话"的绑定中解放出来，成为具备四个特征的连续实体：

| 特征 | 含义 | 反例（单 Session 模式） |
|------|------|------------------------|
| **连续** | 用户在 IM、GitHub 评论等熟悉界面交互，感知上始终只有一个 Agent；IM 里说方案 A、PR 评论里改方案 B，它能跟上 | 必须记住"Session X 里说过什么" |
| **高效** | 响应迅速，并行完成多个复杂任务，不用等上一条命令跑完 | run() 一阻塞，什么都进不来 |
| **主动** | 持续观察环境事件，该出手时出手，不需要时保持安静 | 等人逐条下指令 |
| **持久** | 始终在线，接入真实工作环境，异常自动恢复 | 笔记本合盖即停 |

关键的架构判断是：**单个 ReAct Loop 无法同时支撑这四个特征**。连续和主动要求 Agent 常驻且监听全局，高效要求并发隔离，持久要求计算与状态分离——这些约束在单循环里互相冲突。解法不在提示词里，在系统架构里。

![图：A鼠被五个会话气泡同时包围，手忙脚乱——一个人的注意力上限](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/mouse-overloaded-sessions.jpg)

![图：单 Session 模式串行阻塞，Super-agent 双层并行——多任务上限从人的注意力移到系统吞吐](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/ch01-session-vs-superagent.jpg)

值得注意的还有文章的方法论自觉："相似的设计约束会导出相似的架构选择"，且这些问题与传统计算机系统长期探讨的问题高度相似。这是理解后面所有设计的钥匙：**这不是发明，是把 OS 和分布式系统的经典思想搬进 Agent 系统**。

## 2. 总体架构：五个模块，一张图

支撑四特征的五个模块：

- **双层架构**（Router/Worker）→ 支撑"连续 + 高效"
- **事件驱动**（Trigger 生命周期管理）→ 支撑"主动"
- **面向人的交互**（异步 ReAct + 多信道规范）→ 交互中同时做到连续与高效
- **存算分离**（两层解耦）→ 支撑"持久"的前半
- **外部 Watchdog**（外部控制回路）→ 支撑"持久"的后半（异常自愈）

![图：Super-agent 整体系统架构——五个模块支撑连续、高效、主动、持久四个特征](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/ch02-architecture-overview.jpg)

给工程师的翻译对照表——每个模块在经典系统里的对应物：

| Super-agent 模块 | 经典系统思想 |
|------------------|-------------|
| Router 批处理（Batching） | I/O 合并 / 中断合并 |
| 两级过滤 Fast/Slow Path | 硬中断 vs 软中断 / 快路径慢路径 |
| 订阅直通 | 已建立连接的直发，不经路由器 |
| Inline & Spill | 寄存器溢出 / Cache 行填充 |
| 链式召回（Chain of Recall） | 按引用链逐级取数的懒加载 |
| 投机执行 | 分支预测 / 推测执行 |
| 存算分离 | 无状态服务 + 持久层 |
| Watchdog | 硬件看门狗 / 外部控制回路 |

原文结语说"并没有提出全新的理论"，是准确的自评。但把这套思想在 LLM 约束下重新推一遍并跑通，正是这份工作的含金量所在。

## 3. 双层架构：Router 与 Worker

### 3.1 根本权衡

会话组织存在连续性与吞吐量的根本 trade-off：

- **全部事件进一个 Session**：上下文最连续，但单 ReAct Loop 串行执行，耗时长、吞吐低，多任务中间细节互相污染。
- **每个事件新开 Session**：并发最高，但任务一旦不独立，各 Session 结果割裂，多个 Session 各自向用户回复造成交互混乱。

拆法：把"维护全局连续性"和"高并发执行"分到两层。常驻 Router 层统一承接人类交互与全局协调；上下文隔离的 Worker 层并发执行任务。

![图：双层架构——常驻 Router 统一交互与分派，Worker 隔离并发执行](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/ch03-router-worker-layers.jpg)

### 3.2 Router 层：全局序点

Router 是常驻的全局路由层，充当全局的**序点（Sequence Point）、协调点和记忆**。设计上有两个反直觉的克制：

- **不执行具体任务**，只做交互与分派，甚至可以不配 Bash 工具；
- 从实践看 Router 的任务"常常没有想象中复杂"，**用轻量模型就够了**——省下的预算留给 Worker 上最强的模型。

它与 Agent Team 的区别值得细品：Team Lead 要深入单个复杂任务内部做步骤拆解和高频协调，推理负载很重；Router 只处理任务之间的高层关联与分派。文章甚至指出：用提示词约束一个 Agent Team 的主会话"不亲自执行、只分派"，它就退化成了双层架构——但这靠提示词维系，而双层架构靠结构保证（第 7 节实验会证明这个差异的代价）。

**Router 为什么不容易成为瓶颈：批处理。** 上一轮推理期间到达的 Trigger 会积压，下一轮一并注入。Router 每步是长输入、短输出，多条 Trigger 合并进一次 LLM 调用时，Prefill 阶段并行计算，单请求耗时增长远慢于批大小——**积压越多，单个决定分摊的推理时间越低**（上限是上下文长度和模型一轮能准确处理的 Trigger 数）。实测数据在 7.2 节：40 条/分的到达率下，分摊推理时间反而从 6.4 秒降到 1.6 秒。

规模再扩大时，Router 内部可以做多层过滤或水平切分（Sharding），但切分粒度越细，分片间记忆连续性越低——"在全局记忆问题被解决之前，这一权衡始终存在"。

### 3.3 Worker 层：隔离执行

Worker 之间上下文隔离、挂完整工具、专注单一任务，通常配最强模型。两个设计要点：

- **不对人直接输出**。Worker 的推理过程和工具调用不进外部信道，只向 Router 汇报状态，由 Router 统一回复用户。这从结构上消灭了"多个 Session 各自回复"的交互混乱。
- **Worker 间不直接通信**。执行冲突（比如两个任务动了同一个 PR）靠订阅机制消解：只要都订阅了对应 Thread，就会收到相同事件，各自发现并解决冲突；跨任务协同才由 Router 中转。

Worker 内部还可以再开 Subagent 或干脆是一个 Agent Team，对 Router 透明。这给了个人助手场景一个有趣的解释：前端只有一个聊天窗，底层可以按话题分派 Worker 并行推进——**单会话界面和多会话执行并不矛盾，中间隔着一个 Router**。

## 4. 事件驱动：一个 Trigger 的生命周期

这是全文技术密度最高的一章。驱动 Agent 的主输入从"人逐条键入的提示词"变成"环境中的半结构化事件"：群聊消息、邮件、日程提醒、代码审查评论、CI 结果，统称 **Trigger**。围绕 Trigger 从进入到处理的生命周期，四个递进问题。

### 4.1 两级过滤：Fast Path / Slow Path

真实环境事件流是"高噪音、低触发率"的——绝大多数日常消息不需要 Agent 介入。每个事件都调大模型判断，延迟和算力都不可承受。

解法是经典的两级过滤：

- **程序层策略（Fast Path）**：来源、群组范围、用户/机器人白名单等确定性条件，用代码直接做准入检查——"仅响应明确请求 / 作为候选 / 直接忽略"三选一，调模型前滤掉大部分噪音。
- **语义层策略（Slow Path）**：通过准入的候选交给 LLM，按提示词编写的策略和上下文判断是否需要行动。语义层同时是对人类开放的自然语言扩展点。

工程师的读法：Fast Path 是把"已经明确且稳定的高频判断"固化成代码——本质是给 Agent 系统写中断控制器。

![图：A鼠讲解漏斗过滤——大量灰点在程序层被筛掉，少数橙点交给模型研判](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/mouse-funnel-filter.jpg)

![图：两级过滤——程序层 Fast Path 筛除噪音，语义层 Slow Path 研判候选](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/ch04-two-level-filter.jpg)

### 4.2 订阅与直通：路由的快慢路径

过滤之后是路由。如果已分配任务的每个后续事件还要经 Router 转发，全局节点照样被压垮。Fast/Slow Path 再次适用：

- 同一个 GitHub PR、同一个 IM 话题、同一封往来邮件串下的连续事件构成一条 **Thread**；
- Router 根据 Thread 的初始事件创建 Worker 并建立**订阅**；
- 此后该 Thread 的后续事件由**程序直通**已订阅的 Worker，不经 Router；Router 只处理未被订阅的新任务冷启动与跨任务协调。

![图：订阅与直通——初始事件走 Router 建立订阅，后续事件程序直通 Worker](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/ch04-subscription-passthrough.jpg)

两个容易被忽略的深意：

- **多对多订阅是隐式的 Worker 间通信信道**。一个 Worker 可订阅多个 Thread，一个 Thread 可被多个 Worker 订阅。多个 Worker 在同一环境交遇时，新事件同时直通所有订阅者——它们无需点对点通信就能感知彼此的操作并自行消解冲突。这是用广播语义替代 IPC。
- **直通省的是 Router 的开销，不是用户的等待时间**。第 7 节实验会给出反直觉的证据。

### 4.3 上下文组织：Inline & Spill + 链式召回

事件到达目标 Session 后，注入多少信息是个 Cache 管理问题。注入过多挤占窗口、稀释注意力；注入过少迫使模型反复调工具读取、增加执行步数。文章的原话："浪费上下文窗口，就是浪费模型的智能。"

把有限的上下文窗口当 Cache 管理，两个基本操作：

- **Inline**：近期很可能用到的信息直接内联进窗口，省掉工具调用往返；
- **Spill**：超出预算或低频的完整信息留在窗口外，窗口内只留引用或摘要，供按需读取。

按局部性（Locality）逐步优化的操作序列：

1. 从最少信息开始：只给当前对象的 ID 和内容摘要；
2. 按局部性 Inline：先附紧密关联对象的 ID，再附时空相邻内容——内容前 50 字、IM 消息的前后相邻消息、代码评论所在讨论串的相邻评论；
3. 超上限则 Spill：截断并保留续读入口。

![图：Inline 与 Spill——窗口内联高频内容，低频内容外置留引用，沿引用图逐跳召回](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/ch04-inline-spill-chain-of-recall.jpg)

**链式召回（Chain of Recall）** 是 Inline & Spill 一致地应用到所有对象后的涌现产物：给 Trigger、Thread、Worker Session 等对象赋唯一 ID，注入时内联紧密关联对象的 ID，整个系统底层构成一张**引用图**。每次工具召回的对象同样遵循 Inline & Spill——返回结果里又内联下一跳的摘要与 ID——于是模型可以从当前事件出发，沿引用关系逐跳按需展开：当前消息 → 所在 Thread → 关联的 Worker Session → 该 Worker 关联的另一个代码评审 Thread。

这解决了 Router 长程丢上下文的问题：不需要把所有任务的全量历史塞进窗口，只需要在每个对象里留好"下一跳指针"。

### 4.4 提前行动：投机执行

借鉴分支预测思想：结果还不确定是否会被采用时，就根据环境信号在后台提前尝试。用额外后台算力换人类的等待与介入成本。结果有价值就交付，没价值就丢弃。

文章给了一个内部实例：DeepSeek Harness 内部用户群里配了"静默复现并修复"策略——群里有人反馈问题时，Agent 先在后台尝试复现并找修复方案，**只在确认问题且修复简单时才交付 PR，否则全程安静**。这对"主动"特征的产品化定义很有启发：主动 ≠ 多话，主动 = 在正确时机出现正确的结果。

## 5. 面向人的交互：全双工与多信道

### 5.1 异步 ReAct Loop

经典 ReAct 里模型发起同步 run() 后循环阻塞，工具没跑完，会话什么输入都收不到——半双工。解法是把耗时命令和子任务改成异步的 **start()/stop()**：

- start() 立即返回"已启动"，循环继续；
- 后台工具完成后，最终结果作为**一条新的事件消息**投递进会话；
- 模型可用 stop() 主动终止跑太久的后台命令；
- 新的用户输入在**当前推理步结束后**即被处理，不必等后台工具。

![图：同步 ReAct 的 run() 阻塞会话；异步 start/stop 让新输入在当前推理步后即被处理](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/ch05-async-react.jpg)

前台对话与后台执行解耦后，Agent 才真正做到"无需等上一个命令完成就能接受下一条指令"。文章注明：这一机制已在 DeepSeek Harness 实现，但**尚未默认开启**——这也是原型与文章差异的注脚之一。

![图：A鼠一手接电话一手展开长卷——前台对话与后台执行并行不误](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/mouse-full-duplex.jpg)

### 5.2 多信道输出规范

不同信道的信息密度和交互习惯不同。双层架构已把冗长推理隔离在 Worker 内，剩下的由提示词定信道规范：

- **IM 即时信道**：低打扰轻量沟通，像人类同事一样只在需要决策或验收时发言，只问直接问题、给简短结论。验证过的硬规：**单次回复不超过 100 词**。
- **GitHub / 邮件 / 文档等异步信道**：结构化高密度交付——PR 按项目规范写全问题背景、改动说明、验证结果。

100 词硬规是个精妙的约束设计：它不是能力限制，是信道带宽约束的产品化表达——把"像人一样在群里说话"从风格要求变成了可执行预算。

## 6. 持久在线：两层解耦 + 外部看门狗

### 6.1 第一层：计算与状态分离

推进 Agent Loop 的计算做成无状态的，放进云端无状态弹性容器；需要持久保存的会话状态进数据库。容器可水平扩展、可重启、可替换，任务连续性由持久层保障——Agent 摆脱单机生命周期限制。这是把无状态微服务的那套最佳实践原样搬到 Agent Loop 上。

### 6.2 第二层：Agent Loop 与执行环境分离

难点在执行环境：代码仓库、本地工具链、未提交的修改、私有凭据、内网依赖。云端建沙箱重建环境，成本高且必有遗漏；让用户迁往云端，迁移成本不可接受。

文章的选择很干脆：**环境难以复制，就不复制——环境留在原地，Agent Loop 上云**。端侧只部署一个不保存会话状态的轻量 daemon，负责执行命令、返回结果。相当于把执行环境当成按需读取的外置上下文。

![图：存算分离两层解耦——无状态 Loop 上云、执行环境留在端侧，外部 Watchdog 监控任务进展](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/ch06-separation-watchdog.jpg)

这个设计与 Anthropic 的"脑手分离"（Decoupling the brain from the hands）思想一致：harness 无状态、会话日志外置、统一接口接执行环境。差异在场景：Anthropic 讨论的是托管沙箱和客户 VPC 资源，DeepSeek 要接的是用户日常使用、可能间歇在线的个人机器——因此天然支持 **BYOM（Bring Your Own Machine）**，甚至支持间歇在线设备：设备重新上线后，云端 Agent 自动触发并完成需要在这台设备上执行的任务。

### 6.3 Watchdog：监控任务进展，不只是进程存活

长期运行的分布式系统很难靠主系统内部逻辑保证可靠，需要外部控制回路。但 Agent 系统的异常有特殊性：**许多异常不是进程崩溃，而是模型陷入无效循环或偏离目标**。所以监控对象必须是任务进展，不只是基础设施存活。

DeepSeek 的实现是在主系统外部配一个独立的 **Watchdog Session**，用定时消息驱动：处理接口报错、状态恢复失败等基础故障，同时由模型判断各 Worker 是否有实质进展、方向是否偏离；外部偶发故障持续复查直至恢复。Watchdog 本身是具备完整工具能力的 Agent Session——维护者可以用自然语言向它问诊，也可以让它在线修正主系统行为（增删提示词、调整触发规则）。

用 Agent 治理 Agent 系统，这是整套设计里最有想象力的一个组件。但它也埋下了第 9 节要讨论的安全隐忧。

## 7. 实验怎么读：两组数据与三个批判

![图：A鼠指着黑板上的柱状图讲实验结论](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/mouse-barchart-lecture.jpg)

### 7.1 消融实验

负载：群聊 + GitHub CI 消息流，单次约 300 条消息（约 20 条工作请求，其余闲聊/跟进/叫停/CI），编码工作用"只消耗时间的工具"代替——**实验衡量的是调度协作能力，不是任务执行能力**。每方案跑 5 次。

四种方案：完整 Super-agent、去掉直通的 Super-agent、单 Session + Subagent（中性提示）、单 Session + Subagent（优先委派提示）。

结果（任务完成时间）：

| 方案 | p50 | p95 | 备注 |
|------|-----|-----|------|
| **Super-agent** | **12.4 min** | **15.7 min** | 稳定 |
| 单Session+Subagent（中性提示） | — | 29.5 min | 5 次运行**一次都没调用** Subagent，全部自己干，不断被打断 |
| 单Session+Subagent（优先委派） | 介于两者之间，仍慢于 Super-agent | 长尾 | 5 次中 4 次委派；1 次嫌任务"小"自己干，形成长尾 |

![图：实验数据一览——消融、直通开销与批处理压测](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/ch07-experiments.jpg)

**这组数据真正的发现不是"Super-agent 快"，而是"提示词工程不靠谱"**。同样的单 Session 架构，仅仅换一句提示词，行为就从"从不委派"跳到"四次委派"；剩下那一次模型自作主张接的小任务，制造了全图最长的尾延迟。而双层架构把"分不分工"从模型临场判断升级为架构保证：Router 结构上不能执行任务，Worker 结构上只收订阅消息。**当你需要一个必然发生的约束时，提示词给不了，结构才给得了。**

开销侧：Super-agent 因维护多个独立会话，读缓存 token 高于单 Session——用 token 换时间与稳定性。去掉直通机制后：任务完成时间基本不变，但 Router 需做的决定 +30%，总读缓存 token 从 2323 万涨到 3177 万（+37%）。结论精确化：**直通机制不改善用户侧指标，它改善的是 Router 的负载与成本**——这正是"直通是省 Router 的钱"的定量证据。

### 7.2 Router 批处理压测

Router 调真实模型、Worker 用 Mock，Trigger 到达率从约 1 条/分拉升到约 40 条/分：

| 到达率 | 平均 batch | 单请求耗时 | 单决定分摊推理时间 |
|--------|-----------|-----------|-------------------|
| ~1 条/分 | 1.0 | 2.5 s | 6.4 s |
| ~40 条/分 | 2.8 | 3.9 s | **1.6 s** |

请求耗时 2.5→3.9 秒（+56%），batch 1.0→2.8（+180%）——摊薄效应显著。这也解释了 7.1 里为什么去掉直通（Router 决定 +30%）仍没触及单 Router 吞吐瓶颈：批处理把压力消化在 Prefill 并行里了。

### 7.3 批判性视角

- **合成负载**：消息流是构造的，真实群聊的语义复杂度、恶意输入、跨任务耦合都未覆盖；
- **Mock 执行**：工作请求用纯耗时工具代替，"调度好"不等于"调度+执行都好"；
- **样本量**：每方案 5 次，长尾分布下统计效力有限。

所以正确的读法是：这组实验证明的是**机制有效性**（直通省 token、批处理摊薄延迟、结构约束优于提示词），而不是产品级性能结论。原文自己也是这么定位的（"仅作初步参考"）。

## 8. 原型拆解：dsh-superagent 的领域模型

开源原型是理解这套架构如何落地的最好材料。形态：DeepSeek Harness 插件，面向单个 GitHub 仓库（可选接飞书），监听事件、开工作项、在自己的会话和目录里干活、回到原对话交付（比如一个 PR）。Web 面板只展示"需要人处理的事"。

它的哲学第一条就延续了全文立场：**"Take as little human attention as possible, and give as much value as possible."**（尽可能少占用人的注意力，尽可能多给价值。）每个消息、通知、设置、面板元素都要付出比它占用注意力更多的价值，否则删掉。

### 8.1 概念映射：文章 → 代码

| 文章概念 | 原型落地 | 关键规则 |
|----------|---------|---------|
| Router Session | 主 Session（orchestrator，`dsh-superagent-router` 预设，小工具集） | 不亲自执行，只评估分派 |
| Worker Session | Executor Session（`worker-<ticket id>`，每工单独立会话+独立目录） | 无审批跑命令（操作者 OS 用户身份） |
| Trigger | Trigger | **不可变**；同一 Trigger 接受两次只建一个 Ticket（幂等） |
| Thread | Thread | 同一时刻至多一个 Eval 在跑；持有订阅、运行中 Eval、决策历史 |
| 订阅 | Subscription（多对多） | 订阅消息直通工单，绕过 gate，不授予新权限 |
| 两级过滤 | Gate（代码）+ Assessment（模型研判）= Eval | Eval 无状态；输出 Decision：accept / stop / ignore / unavailable |
| 授权 | Mandate（授权凭据） | 记录 Policy 版本、范围、强度（explicit/inferred）、匹配规则；不可变；工单结束不撤销，仅人工 stop 或 Policy 不再容纳时撤销；恢复已结束工单前按当前 Policy 复验 |
| 工作单元 | Ticket | 有七阶段状态机 |
| 派工 | Assignment | Ticket ↔ Executor 实例的绑定 |
| 输出侧 | Channel | 一个 Thread 可有多个写地址；确认、回复、PR、resolve review 都是写 |
| 规则集 | Policy（版本化） | 规则变更使运行中 Eval 作废重来 |

![图：原型中的 Ticket 状态机——按在等什么分类，person 类状态优先展示](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/ch08-ticket-state-machine.jpg)

Ticket 状态机按"在等什么"分类，且 **person 类状态优先展示**（面板第一条原则：只显示等人处理的事）：

```
person/delivery  Input 投递失败（2s 起指数退避重试）
person/answer    有 Attention（等人工回答）
person/review    最新 Report 为 ready（等评审）
person/blocked|failed  受阻/失败且之后无人回复
working/queued   无 Assignment 或待启动
idle             最新 Report 为 waiting（等 Trigger）
working          其余一切
```

### 8.2 与文章的差异：原型验证的是哪一半

原型实现的是**事件驱动 + 双层架构 + 权限模型**这一半；文章里的异步 ReAct 默认化、存算分离、端侧 daemon、Watchdog 均未在此仓库落地（README 明说部分设计是未来方向）。所以别把原型当架构全貌，它是"事件驱动路由 + 授权"子系统的参考实现。

### 8.3 值得直接抄的工程细节

逐条过，都是可以搬进自己系统的：

1. **幂等三件套**：Trigger 不可变（审计与幂等单元）；Source 持有读位置（重启不重放）；重复接受同一 Trigger 只建一个工单。
2. **权限由宿主强制，提示词只是输入**。原文档原话："The host enforces allowed lists, rules and Mandates. Messages, comments and quoted documents are inputs to a decision; they cannot change those permissions."（宿主强制执行允许列表、规则与 Mandate。消息、评论和引用文档是决策的输入，不能改变这些权限。）——这是对提示词注入的**结构性防御**：外部文本永远不进入权限判定回路。所有消息内容（含引用、仓库文件）都标注为 untrusted data。
3. **准入三模式 off / observe / auto**：主动工作默认只在 observe 模式运行——只记录"本会做什么"，不动手。放量靠逐步观察后打开。
4. **Mandate 生命周期**：Policy 变更不追溯撤销已授 Mandate（在跑的工作不中断），但已结束工单恢复前要按当前 Policy 复验；更大范围要新 Ticket 而不是悄悄扩权。
5. **Effects 副作用队列 + Outbox**：消息发送先落 receipt 与 reply effect（同一事务），再由 effect 异步执行；Source 关闭时消息等待，会话消失才 drop 且留下永不重发的记录——对外输出的 exactly-once 语义。
6. **后台任务的槽位纪律**：turn 结束仍有后台任务则工单保持 working 并占住 worker 槽；30 分钟上限到点杀掉 shell 任务、报告 waiting；handoff 给人立即释放槽位。
7. **Prompt 组装顺序固定 + 每次模型请求重读最新版本**：改提示词不重启会话，下一次请求自然生效；override 记录基于哪个默认版本，升级时三选一（保留/采用新默认/再编辑）。
8. **Eval 失败的退避**：超时重排两次，第三次记 unavailable；Policy 变更作废进行中 Eval 并立即按新版本重排。

再加上一些规模感：TypeScript 实现、SQLite 持久化、62 个测试文件、九篇编号文档严格按序阅读组织（每篇只依赖之前引入的概念）。作为"大量工程由 agent 完成"的仓库，这种文档纪律本身就是 Agent 工程方法的展示。

## 9. 开放问题与设计清单

### 9.1 文章自己承认的四个开放问题

- **双层架构如何扩展**：Router 何时 Sharding、粒度多细；Worker 间何时需要直接通信、什么拓扑；甚至针对 Router 的事件判别/批量分派/上下文召回做专项训练（模型-系统协同设计）。以及更远的：跨月以上运行周期的长程记忆。
- **脱离 Session 的人机协作形态**：聊天窗口为中心是路径依赖的产物；交互可以更多发生在领域特化界面里（让 Super-agent 直接在 Issue 和 PR 里工作）；界面上的一个会话底层未必对应一个 Session。过渡期内"人中途介入、接管、实时协同"的产品形态待解。
- **上下文边界与 A2A**：组织配备 Super-agent 的实质是划上下文共享/隔离的边界；多实例间（个人助手 ↔ 团队实例）的 A2A 通信，在互不共享底层上下文、各代表不同权限边界的前提下如何安全可靠，未解。
- **安全与隐私**：事件驱动扩大了不可信输入的接触面；云端 Agent Loop 被攻破（服务端入侵或提示词注入）→ 其连接的**全部端侧设备**面临被控制；凭据进入模型上下文即有泄露风险，目标是设计出完全不接触凭据本身的凭据使用机制。

### 9.2 拿来即用的设计清单

![图：A鼠逐条核对设计清单](https://img.arkblob.ccwu.cc/articles/deepseek-superagent/mouse-checklist.jpg)

从全文提炼，按落地难度排序：

1. **把"分不分工"做成架构约束**，别交给提示词——实验证明提示词的委派行为不稳定；
2. **确定性判断固化成 Fast Path 代码**，语义判断才进 LLM，成本立降一个量级；
3. **已订阅 Thread 的事件程序直通 Worker**，Router 只管冷启动与跨任务协调（省 Router 30% 决定、37% token）；
4. **上下文窗口当 Cache 管理**：从最少信息开始，按局部性 Inline，超限 Spill 留引用；
5. **给每个对象赋 ID 并内联关联 ID**，让系统长成引用图，链式召回自然涌现；
6. **长工具异步化**：start/stop 替代阻塞 run()，结果事件化投递；
7. **按信道定输出预算**：IM 100 词硬规这类可执行约束比"要简洁"有效；
8. **计算无状态化、状态入库**，Agent Loop 才能云端常驻与水平扩展；
9. **环境留在端侧，daemon 化接入**，支持 BYOM 与间歇在线设备；
10. **外部 Watchdog 监控任务进展而非仅进程存活**，且它自己就该是全工具 Agent；
11. **权限由宿主代码强制，外部文本只是决策输入**——注入防御靠结构不靠提示词；
12. **主动行为默认 observe 模式**，先记录"会做什么"，观察对了再放量。

### 9.3 结语

这套设计最值得带走的不是任何一个模块，而是它的第一性视角：**当模型执行单任务越来越不需要人，瓶颈转向了人的注意力——那么系统设计的优化目标函数就应该换成"注意力效率"**。双层架构、事件驱动、异步交互、存算分离、Watchdog，全是这个目标函数下的推论；OS 与分布式系统的经典思想，则是这些推论的现成解法库。

原型已在内部日常参与问题复现修复、代码审查响应与 DeepSeek Harness 自身迭代。Agent 正在从"被动等指令的对话窗口"变成"数字环境里持续在线的自主协作者"——而工程师的任务，是给这个协作者装上不打扰人的架构。

---

**参考资料**

- 设计文章：《Super-agent 设计探索：迈向更自主的 Agent 系统》，DeepSeek Harness 团队，2026-10-31，微信公众号首发
- 开源原型：`github.com/deepseek-ai/dsh-superagent-prototype`（MIT），docs/000-008 设计文档
- Anthropic：《Decoupling the brain from the hands》（脑手分离）
- DeepSeek Harness 文档站：`deepseek-harness.github.io`

