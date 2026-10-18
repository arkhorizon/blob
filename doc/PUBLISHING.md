# 拾页文章发布手册

本文档是给执行型 agent（Lobster、Hermes 等）加载的作业规范。请完整阅读本文档后再修改仓库，目标是新增或更新一篇可直接构建、可部署、可长期维护的文章。

## 1. 使命与非目标

你的任务是产出一篇“完整作品”，不是只提交一个 Markdown 草稿。执行结果必须同时满足：

- 文章位于正确分类目录，frontmatter 与正文通过 `npm run validate`。
- 封面与全部插图已上传到 R2，Markdown 只引用最终公网 URL。
- 章节结构正确，阅读页目录、分章导航、进度保存、搜索索引能正常工作。
- 不提交密钥、临时文件、私有源路径或不必要的仓库噪音。

除非用户明确要求，不要：

- 执行仓库迁移脚本 `npm run import:shiye`，它会清空并重建 `src/content/articles/`。
- 覆盖或删除既有 R2 对象。
- 修改全局布局、样式、构建脚本、数据库或部署配置。
- 重建或重新生成全部既有文章。

## 2. 前置检查

在项目根目录执行：

```bash
git status --short
npm run validate
```

判读规则：

- 既有未提交变更：默认保留，不要回滚；不要把这些文件混入你的提交。
- `npm run validate` 报错：必须先修复与本次发布相关的问题；与本次无关的错误要报告并请求指令。
- 只处理用户指定的文章；不要顺手重排、重命名或“美化”其他文章。

## 3. 路径与路由协议

文章必须放在：

```text
src/content/articles/<category>/<slug>.md
```

分类目录、站点名称与页面路由固定如下：

| 分类目录             | 站点分类 | 适用内容                       |
| -------------------- | -------- | ------------------------------ |
| `personal-blog`      | 个人博客 | 原创文章、随笔、技术与日常记录 |
| `foreign-literature` | 国外文学 | 外国小说、散文、经典译文       |
| `chinese-literature` | 中国文学 | 中国小说、散文、经典作品       |

slug 规则：

- 全局唯一，由文件名决定；frontmatter 不写 slug。
- 只使用 `a-z`、`0-9`、单连字符；长度不超过 120。
- 中文标题转无声调拼音后用 `-` 连接，例如 `白夜` → `bai-ye`。
- 无法从标题推导时，使用稳定英文短语；不要使用日期、随机串、下划线或中文。
- 重名时追加有语义的限定词，例如 `jian-shu`、`jian-shu-ru-men`，不要只追加数字。

文章 URL 为：

```text
/e/<slug>
```

例如 `src/content/articles/foreign-literature/bai-ye.md` 对应 `/e/bai-ye`。

## 4. Frontmatter 协议

完整模板：

```yaml
---
title: 白夜
description: 一个孤独的彼得堡幻想家，在四个明亮如昼的白夜里遇见少女纳斯金卡。
date: 2026-06-07
updated: 2026-10-18
author: 陀思妥耶夫斯基
translator: 耿济之
tags:
  - 俄国文学
  - 爱情
cover: https://img.arkblob.ccwu.cc/articles/bai-ye/cover.jpg
draft: false
---
```

字段协议：

| 字段          | 必填 | 规则                                                         |
| ------------- | ---- | ------------------------------------------------------------ |
| `title`       | 是   | 作品最终标题；不要加书名号、编号前缀或营销词。               |
| `description` | 是   | 一两句简介，避免与正文首段机械相同；会用于列表、SEO 与搜索。 |
| `date`        | 是   | `YYYY-MM-DD`；按内容发布日期填写，不确定时询问用户。         |
| `updated`     | 否   | 只在更新既有作品时填写或更新，不能早于 `date`。              |
| `author`      | 否   | 原作者；译文可写原作者，或使用“原作者 / 译者 译”。           |
| `translator`  | 否   | 译者；如 `author` 已含译者信息可省略。                       |
| `tags`        | 否   | 字符串数组；2–6 个，使用已有中文标签优先。                   |
| `cover`       | 否   | 绝对 R2 公网 URL；推荐封面必填。                             |
| `draft`       | 否   | 默认 `false`；只允许在明确要求暂存不发布时设为 `true`。      |

禁止添加 schema 未定义字段；未知字段会导致构建失败。

## 5. 图片与 R2 协议

### 5.1 存储命名

所有文章图片必须先上传到 R2，再在 Markdown 中引用最终 URL。禁止提交图片到仓库，禁止 `/images/...`、`/public/...`、相对路径、占位图或第三方热链。

公网基准地址：

```text
https://img.arkblob.ccwu.cc
```

对象命名协议：

```text
articles/<slug>/cover.<ext>
articles/<slug>/<figure-name>.<ext>
articles/<slug>/chapters/<chapter-number>-<chapter-key>/<figure-name>.<ext>
```

命名要求：

- `figure-name` 用小写英文和连字符，描述画面而不是描述文件类型。
- `chapter-number` 从 `01` 开始，与章节顺序一致。
- `chapter-key` 用英文短语或无声调拼音，避免中文、空格、反斜杠、`..`。
- 正文中中文路径必须 URL encode；R2 对象键本身建议保持 ASCII。
- 图片与 slug 绑定。更新文章时只新增新对象，不覆盖旧对象。

示例：

```text
articles/bai-ye/cover.jpg
articles/bai-ye/first-night-canal.jpg
articles/bai-ye/chapters/01-first-night/first-night-canal.jpg
```

对应 Markdown 引用：

```markdown
![图：两人沿运河堤岸同行](https://img.arkblob.ccwu.cc/articles/bai-ye/chapters/01-first-night/first-night-canal.jpg)
```

对象键冲突处理：

- 发布前先请求公网 URL 的 `HEAD`；若已存在同名对象，默认改用新的描述性对象键。
- 确需覆盖同名但内容不同的对象时，先向用户说明缓存与不可变 `Cache-Control` 的影响并获得确认。
- 不要用删除对象来“清理”验证失败；改用新对象键后重新上传和验证。

### 5.2 上传方式

优先使用已登录的 Wrangler，从项目根目录执行：

```bash
npx wrangler r2 object put arkblob/articles/<slug>/cover.jpg \
  --file /absolute/path/to/cover.jpg \
  --remote \
  --content-type image/jpeg \
  --cache-control "public, max-age=31536000, immutable"
```

常用 MIME：

| 扩展名           | Content-Type    |
| ---------------- | --------------- |
| `.avif`          | `image/avif`    |
| `.gif`           | `image/gif`     |
| `.jpeg` / `.jpg` | `image/jpeg`    |
| `.png`           | `image/png`     |
| `.svg`           | `image/svg+xml` |
| `.webp`          | `image/webp`    |

上传成功后：

```bash
curl -I "https://img.arkblob.ccwu.cc/articles/<slug>/cover.jpg"
```

必须看到 `200`，再写入 Markdown。

Wrangler 当前 CLI 没有稳定的 `object head` 子命令；上传后的权威校验以公网 URL 的 `HEAD` 请求为准。

### 5.3 S3 API 备用方式

仅当 Wrangler 登录不可用时，才使用 R2 的 S3 兼容 API。不要把凭据写入命令参数、文档、代码或 shell 历史：

```bash
export R2_S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
export R2_BUCKET="arkblob"
export R2_ACCESS_KEY_ID="<access-key-id>"
export R2_SECRET_ACCESS_KEY="<secret-access-key>"
```

仓库脚本 `npm run upload:r2` 只消费 `content/r2-upload-manifest.json`，用于旧站批量迁移；新文章不要为了使用它而修改该 manifest。若用户明确要求批量上传，需要先确认源文件布局与 manifest 结构。

### 5.4 图片规格

封面：

- 推荐输出宽 1600px 或以上，安全比例 16:10；最长边建议不超过 3000px。
- 文件建议 WebP 或 JPEG，单张不超过 2MB。
- 主体居中或偏安全区中部，避免顶部、底部与左右边缘放关键文字。
- 不得含二维码、站点水印、AI 生成水印之外的额外促销文案。

插图：

- 统一宽度 1600–2400px，保持 16:10 或原作比例。
- 单张建议不超过 1.5MB；正文插入频率遵循阅读节奏，不设硬性数量上限。
- 优先贴合具体场景，不做无意义的装饰图。

## 6. 正文与目录协议

- 正文使用 UTF-8 Markdown，文首不加 `#` 主标题；页面标题来自 frontmatter。
- 多章节作品必须一文一个 Markdown；不要为章节创建多个文件。
- 每章使用二级标题：`## 章节名`；标题单独成行，前后保留空行。
- 章节标题不要重复。站点会按全部 `##` 切章；无 `##` 时整篇作为单页。
- 正文若有开头且后面才开始章节，开头会进入“开篇”目录项；短文可不使用 `##`。
- 三级及以下标题仅供文章内部层级，不进入章节目录。
- 分隔符使用 `---`，会被渲染为阅读页分隔线。
- 引文、注释建议保持原有排版；不要把注释改写成 Markdown 脚注语法。
- 空章节会被过滤。不要写只有标题没有内容的章节。

推荐结构：

```markdown
## 第一章

正文…

![图：场景描述](https://img.arkblob.ccwu.cc/articles/<slug>/chapters/01-first-chapter/scene.jpg)

## 第二章

正文…
```

## 7. 插图协议

插图 Markdown：

```markdown
![图：具体画面描述](https://img.arkblob.ccwu.cc/articles/<slug>/scene.jpg)
```

渲染规则：

- alt 以 `图：` 或 `图:` 开头时，渲染为带 `figcaption` 的插图。
- alt 会成为可访问文本与可见 caption，必须具体、简洁、自然。
- 无 `图：` 前缀时渲染为普通图片。
- 图片可点击进入 lightbox，所以不要上传含敏感信息或私有水印的图片。

示例：

- 好：`![图：幻想家在运河堤岸遇见倚栏流泪的纳斯金卡](...)`
- 差：`![插图](...)`
- 差：`![图：文章配图](...)`

## 8. 发布检查协议

至少执行：

```bash
npm run validate
npm run build
```

构建通过后，如果本地环境允许，再执行：

```bash
npm run preview
```

检查项：

- `/e/<slug>` 能打开，标题、分类、作者、译者、日期、标签显示正确。
- 封面在首页卡片、文章页、OG/Twitter 元信息中均为 `200`。
- 每个 `## 章节名` 都出现在目录，分章导航顺序正确，空章节被过滤。
- 全部插图加载成功，caption 自然，点击可打开 lightbox。
- 搜索该文章标题或独特段落能命中 `/e/<slug>`。
- `updated` 只在确实更新时变化，`draft` 不为 `true`。
- 浏览器控制台无与文章渲染相关的新错误。

镜像验证：

```bash
curl -L -s -o /dev/null -w '%{http_code} %{content_type}\n' \
  "https://img.arkblob.ccwu.cc/articles/<slug>/cover.jpg"
```

## 9. 变更范围与安全

只应出现这些仓库变更：

- 新增或修改一个文章 Markdown 文件。
- 用户明确要求的封面、插图源文件临时产物应放在仓库外；不要提交。
- 用户明确要求的配置或脚本变更。

禁止提交：

- `.env`、`.env.local`、R2 密钥、GitHub token。
- `node_modules/`、`dist/`、`.astro/`、`.wrangler/`、`.DS_Store`。
- `content/r2-upload-manifest.json` 或批量迁移产物。
- 未上传 R2 的图片、素材包、临时下载文件。

如果发现不属于你的意外仓库变更，立即停止并报告。

## 10. Git 提交协议

用户要求提交时：

```bash
git status --short
git diff --check
git diff -- src/content/articles/<category>/<slug>.md
git add src/content/articles/<category>/<slug>.md
git commit -m "Add <slug>"
```

要求：

- 只添加本次文章路径；不要使用 `git add .` 或 `git add -A`。
- 提交信息使用祈使句，例如 `Add bai-ye`；更新为 `Update bai-ye`。
- 提交前确认没有密钥、本地路径、临时素材或无关文件。
- 用户没有要求提交时，只保留工作区变更，不要主动提交。

## 11. 部署协议

正常生产路径是推送 `master` 后由 Cloudflare Pages 自动构建：

```text
Build command: npm run build
Build output directory: dist
Node version: 20+
Production branch: master
```

不要使用 Cloudflare 控制台拖拽上传，因为那不会编译 Pages Functions。

只有在用户明确要求直接部署时才执行：

```bash
npm run build
npx wrangler pages deploy dist
```

部署后检查：

```bash
curl -L -s -o /dev/null -w '%{http_code}\n' https://arkblob.ccwu.cc/e/<slug>
```

返回 `200` 且内容为当前版本，发布完成。

## 12. Agent 执行流程

1. 读取本文档；除非用户明确要求，不要修改全局配置。
2. 确认分类、标题、正文、图片源、发布日期和是否立即发布。
3. 生成稳定 slug，检查全局唯一。
4. 规范化 frontmatter 与章节结构。
5. 规范化图片名，上传封面和插图到 R2，逐张用公网 URL 验证 `200`。
6. 把公网 URL 写入 Markdown。
7. 执行 `npm run validate`、`npm run build`，必要时 preview 并人工复核。
8. 输出变更文件、slug、R2 对象、验证结果与未覆盖的既有变更。
9. 用户要求时，按第 10 节提交；部署按第 11 节执行。

## 13. 交付报告模板

执行完成后，必须向用户报告：

```text
文章：<title>
路径：src/content/articles/<category>/<slug>.md
线上路由：/e/<slug>
章节：N 章 / 单篇
封面：https://img.arkblob.ccwu.cc/articles/<slug>/cover.jpg
插图：N 张已上传并返回 200
验证：npm run validate 通过；npm run build 通过
部署：未执行 / Cloudflare Pages 部署完成 / 失败原因
```

如存在限制，必须写明：未上传图片、构建失败、既有脏工作区、无法访问 R2、用户要求暂存为 draft 等。
