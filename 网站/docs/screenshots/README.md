# 验收截图

这些截图用于这次改版的人工验收，不会发布到线上站点。

| 文件 | 内容 |
| --- | --- |
| `before-root-desktop.jpg` | 合并前 `main`（`826832a`）在桌面 1440 × 900 下访问根路径：直接是游戏主菜单 |
| `after-root-desktop.jpg` | 本次改动在桌面 1440 × 900 下访问根路径：个人作品集首页 |
| `before-root-mobile.jpg` | 合并前在手机 390 × 844 下访问根路径：游戏主菜单 |
| `after-root-mobile.jpg` | 本次改动在手机 390 × 844 下访问根路径：个人作品集首页 |
| `after-full-page-desktop.jpg` | 本次改动的桌面整页（作品、关于、联系） |
| `after-game-playing.jpg` | 从首页点击「游玩《穗守》」打开 `/game/` 并开始游戏后的画面 |

所有截图都由 Playwright 驱动真实 Chromium 渲染生成：macOS arm64、headless Chromium、Metal GPU、桌面 1440 × 900 / 手机 390 × 844、`deviceScaleFactor: 1`。

合并前仓库没有启用 GitHub Pages，所以基线截图来自 `main` 上当时的游戏构建在本地根路径运行的结果，而不是线上旧页面。
