# 修改网站内容

这是个人作品集网站。姓名、简介、联系方式、作品等主要内容都集中在 **[`content.js`](content.js)**，不需要安装任何工具，也不用手改页面结构；导航和区块标题等固定文案在 `index.html` 里。

## 上线前要替换的占位文案

打开 [`content.js`](content.js)，搜索 `TODO`，把下面几处换成你自己的内容：

| 字段 | 现在的占位 | 说明 |
| --- | --- | --- |
| `name` | `你的名字` | 导航、首页大标题、浏览器标题、页脚都会同步更新 |
| `nameEn` | `YOUR NAME` | 名字下方的英文小字，可留空 |
| `tagline` | 一句话介绍你自己…… | 首页的大标题下方的那句话 |
| `about.lead` | 你好，我是「你的名字」。 | 关于我区块的开头 |
| `about.paragraphs` | 两段占位介绍 | 换成你的自我介绍，可以是一段或多段 |
| `contact.github` | `https://github.com/kkbott` | 你的个人主页；留空则隐藏该入口 |

`contact.email` 已经填好为 `kkbbot@163.com`，以后要换直接改这一项；它会同步生成 `mailto:` 链接。`about.tools`（工具标签）和 `about.facts`（右侧小档案）也建议按实际情况改一下。

## 改字的规则

只需要改英文双引号 `"..."` 里面的文字：

1. **不要删掉引号、逗号或冒号。**
2. 每段文字仍然要放在一对英文双引号里。
3. 不要在中文引号里再嵌套英文双引号；普通标点可以随意用。
4. 改完保存即可。网站上线后，把改好的 `content.js` 提交到仓库，GitHub Actions 会自动更新网站。

## 添加其他作品

`works` 数组里的第一件作品（标了 `featured: true` 的那件）会作为首页主视觉和作品区的大卡片；其余作品会以小卡片排在「其他作品」里。

复制下面这段，放在作品数组里第一件作品后面（注意逗号）：

```js
{
  title: "作品名",
  titleEn: "WORK TITLE",
  category: "网页 · WEB",
  year: "2026",
  summary: "一两句话介绍这件作品。",
  details: ["第一个亮点", "第二个亮点"],
  tags: ["标签一", "标签二"],
  cover: "assets/your-cover.jpg",
  coverAlt: "图片的文字描述",
  href: "https://example.com",
  hrefLabel: "打开作品",
  source: "https://github.com/你的用户名/仓库",
  sourceLabel: "查看源码",
},
```

- 封面图放到 [`assets/`](assets/) 里，建议 16:10、宽度 1440px 的 JPG。
- 如果新作品也有独立的静态页面，可以放在 `网站/` 下的新文件夹里，`href` 填相对路径；否则直接填外部网址。
- 不想显示某个字段（例如 `source`、`details`）时，把整行删掉即可，页面会自动省略。
- 「更多作品正在整理中」这句话在 `moreWorksNote`，添加了其他作品后会自动隐藏。

## 换首页大图

首页的游戏大图和作品卡图分别由作品里的 `heroImage` 和 `cover` 指定。图片在 [`assets/`](assets/) 中：

- `harvest-hold-menu.jpg`：游戏主菜单，用在首页大图
- `harvest-hold-gameplay.jpg`：游戏画面，用在作品卡
- `harvest-hold-mobile.jpg`：手机画面备用图
- `og-cover.jpg`：分享到社交平台时的缩略图（1200 × 630）

换图时建议保持文件名不变直接替换，或者同时修改 `content.js` 里的路径。

## 本地预览

最简单的办法：直接双击 `index.html` 用浏览器打开。文字、图片和布局都能看到，但「游玩《穗守》」按钮需要完整的构建目录，直接打开时可能打不开游戏。完整预览需要项目根目录的构建步骤，见[根目录 README](../README.md)。

## 页面文件说明

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构；导航、区块标题等固定文案也在这里 |
| `content.js` | **日常只改这个文件**：姓名、简介、联系方式、作品、图片路径 |
| `styles.css` | 配色、排版、响应式布局 |
| `app.js` | 把 `content.js` 的内容填进页面，并处理滚动动画等轻交互 |
| `assets/` | 图片、图标 |
| `docs/screenshots/` | 改动前后的验收截图，仅存档，不会发布到网站 |

网站部署在 Pages 根路径，游戏在 `game/` 子路径；两个入口之间用的是相对链接，换域名后不需要改。
