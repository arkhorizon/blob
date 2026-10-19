# 拾页 2.0

拾页 2.0 是一个以 Markdown 为内容源的 Astro 静态站点。推送 GitHub 后由 Cloudflare Pages 构建，图片走 R2 公网地址，评论使用 giscus，全文搜索索引由 Pagefind 在构建后生成。

## 内容模型

文章位于 `src/content/articles/<category>/<slug>.md`：

```text
personal-blog       个人博客
foreign-literature  国外文学
chinese-literature  中国文学
```

文件名即全局唯一 slug，也是文章的稳定 ID。slug 使用中文或小写英文，不自动转拼音；分类由一级目录推导，不写入 frontmatter。

```yaml
---
title: 白夜
description: 一个孤独的彼得堡幻想家，在四个白夜里遇见纳斯金卡。
date: 2026-06-07
author: 陀思妥耶夫斯基
translator: 耿济之
tags: [俄国文学, 爱情]
cover: https://img.arkblob.ccwu.cc/articles/bai-ye/cover.jpg
---
```

多章节作品采用一文一个 Markdown。每章使用 `## 章节名`，Astro 会为标题生成锚点并在文章页显示目录。

## 本地开发

```bash
npm install
npm run dev
```

完整搜索索引与 Cloudflare Functions 需要构建产物：

```bash
npm run build
npm run preview
```

## 数据迁移

从拾页 1.0 导入时，会合并既定分类、按标题生成语义 slug、保留 tag，并把多章节作品合并为一个 Markdown 文件：

```bash
SHIYE_SOURCE_DIR=/Volumes/SSD/Work/code/self/shiye-books/data \
R2_PUBLIC_BASE_URL=https://img.arkblob.ccwu.cc \
npm run import:shiye
```

导入结果包含 `content/r2-upload-manifest.json`，可用它把源图片上传到 R2 的 `articles/...` 路径。阅读量不会迁移，站点会从 0 开始计数。迁移脚本默认导出 103 篇文章：国外文学 98 篇、中国文学 5 篇；解读、母婴、信件不迁移，个人博客为空分类。

文章路由统一为 `/articles/<slug>`。slug 由文件名决定，全局唯一，发布后不再修改；frontmatter 不单独维护 slug。旧 `/e/<拼音>` 路由由 `public/_redirects` 永久跳转到新路由。

浏览量按 slug 存储在 D1，阅读进度按 slug 存储在 KV。部署本次路由迁移时执行：

```bash
npx wrangler d1 execute shiye --file migrations/0002_rename_article_slugs.sql --remote
```

KV 阅读进度为匿名用户分散存储，无法安全地全站批量枚举；如需保留，可参考 `scripts/article-slug-map.csv` 手动迁移对应 key，或接受旧进度失效。

## 图片上传

R2 上传脚本使用 Node 内置能力签名 S3 请求，不额外安装依赖。执行前在 shell 中设置 Cloudflare R2 的 S3 兼容凭据，不要把值提交到仓库：

```bash
export R2_S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
export R2_BUCKET="arkblob"
export R2_ACCESS_KEY_ID="<access-key-id>"
export R2_SECRET_ACCESS_KEY="<secret-access-key>"
npm run upload:r2
```

脚本会先用 HEAD 检测对象，已存在的对象默认跳过；设置 `R2_OVERWRITE=1` 才会覆盖。上传后 Markdown 中的图片地址保持 `https://img.arkblob.ccwu.cc/...`。

## 部署

Cloudflare Pages 建议配置：

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 20 或更高
- Production branch: `master`

项目包含 `functions/` 目录（`/api/views` 和 `/api/progress`）。不要用 Cloudflare 控制台的拖拽上传部署；拖拽上传不会编译 Pages Functions。可以选下面任一种方式：

### Git 集成

提交并推送整个仓库（包括 `functions/`、`migrations/` 和 `wrangler.toml`），Cloudflare Pages 使用上面的构建命令自动部署。

### Wrangler 直接部署

在项目根目录执行：

```bash
npx wrangler login
npm install
npm run build
npx wrangler pages deploy dist
```

第一次使用 Direct Upload 时，先执行 `npx wrangler pages project create blob --production-branch=master` 创建 Pages 项目；后续直接执行部署命令即可。Wrangler 会同时上传 `functions/`。首次生产部署前初始化 D1：

```bash
npx wrangler d1 execute shiye --file migrations/0001_article_views.sql --remote
```

需要配置的环境变量：

- `SITE_URL`：正式站点域名
- `PUBLIC_GISCUS_REPO=arkhorizon/blob-comments`
- `PUBLIC_GISCUS_REPO_ID=R_kgDOUyVdig`
- `PUBLIC_GISCUS_CATEGORY=Announcements`
- `PUBLIC_GISCUS_CATEGORY_ID=DIC_kwDOUyVdis4DHVny`
- `PUBLIC_WECHAT_NAME`：页脚展示的微信公众号名称，默认 `Ark视界`
- `PUBLIC_WECHAT_URL`：可选，公众号主页地址
- `PUBLIC_WECHAT_QR_URL`：公众号二维码图片地址

`wrangler.toml` 已包含 Pages 绑定配置；部署后在 Cloudflare Pages 项目中确认 D1 数据库名为 `shiye`、KV namespace ID 为 `a34433be74364948a743bb87daaca1b0`。

## 搜索

`npm run build` 会在 Astro 构建完成后运行 Pagefind。文章页包含隐藏的全文索引块，搜索结果通过 URL 中的 `/articles/<slug>` 映射回首页列表。
