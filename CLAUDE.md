# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A collection of standalone HTML-based educational mini-games for Chinese elementary school (小学) math teaching. Each `.html` file is a self-contained game — no build tools, no package manager, no server required. Open any file directly in a browser to run it.

**Current focus: 小学一年级 (Grade 1).** Requirement docs live in `小学一年级需求文档文件夹/` (数学拔河 ✅ built, 数学飞行棋 ✅ built as 飞行棋 + 地图编辑器, data flows via `localStorage['rewardmap_editor']`).

## Directory Structure (按年级归档)

- `index.html` — 根目录导航页，按年级分类列出所有游戏（新增游戏请同步更新）
- `小学一年级/` — Grade 1 games (数学拔河、飞行棋、地图编辑器、立体图形系列……)
  - `图形小镇-公开课工具包/` — 《认识立体图形》公开课全套资产：课件模板+构建脚本、素材库(实物PNG)、渲染素材(形状PNG/展开GIF/MP4)、演示页、展开动画管线(帧截图生产线)、一键启动.lnk、按钮页、入口PPT、各指南。课件成品的路径 `小学一年级/认识立体图形-图形小镇课件.html` 被 .lnk/PS1/PPT链接/GitHub Pages 硬编码，**不可移动或改名**；素材制作流程见工具包内 `素材制作流程.md`
- `二年级/` — Grade 2 games (认识时间、时间认读PK赛、水果分配余数教学、认识数字-多位数)
- `三年级/` — Grade 3 games (15 games covering 上册7 + 下册8 units)
- `四年级/` — Grade 4 games (大数读法×2)
- `通用工具/` — Cross-grade tools (消消乐、七巧板、三视图、答题闯关游戏/、zhuomianchongwu/ 课堂宠物系统含 server)
- `视频/` — 视频生产线总目录：ffmpeg.exe(勿挪，脚本按绝对路径引用)、立体王国2(魔法师导入视频)、立体王国视频生成、课本插图转视频、素材库(视频生成素材图)、惠州集览项目(惠州建筑集览.mp4 成片 + MusicGPT 本地音乐生成 exe)
- `小学一年级需求文档文件夹/` — Grade 1 requirement docs (.md)；`认识立体图形/` 子文件夹存公开课 PPT 成品(184M，已 gitignore)
- `开发调试/` — 根目录淘汰下来的一次性调试资产：probe_*.js 探针、shot_*.js 截图脚本、test_*.js 测试脚本(绝对路径指向各游戏，移动不影响运行)、历史截图/(_shots 调试截图存档)
- `文档/` — 散篇文档：公开课实战指南、小游戏制作规范、更新部署新页面步骤、网址.txt、一键打开在线网站.url
- `图片处理/`、`图片转文档工具/` — 打印页/板书素材产物与图片转文档小工具

New games go into the matching grade folder and get registered in `index.html`. 公开课/课件素材进 `图形小镇-公开课工具包/` 对应子文件夹，别散落在年级目录根部。
- `小学一年级/图形小镇-公开课工具包/素材处理工作区/` — 《新素材.pptx》源文件与导出处理脚本（去白底→裁边→base64，喂给课件素材库）

## Tech Stack & Conventions

- **Inline everything**: All CSS and JavaScript live inside `<style>` and `<script>` tags within the single HTML file
- **No external dependencies**: No npm packages, no CDN imports (rare exceptions for Google Fonts)
- **Dual rendering**: Games use either **SVG** (`createElementNS`, viewBox-based) or **Canvas** (`getContext('2d')`) for interactive graphics; some mix both
- **Vanilla JS**: No frameworks — direct DOM manipulation, event listeners, and imperative rendering
- **Chinese UI**: All labels, instructions, and button text are in Chinese (Simplified). Use `font-family: 'Microsoft YaHei', 'PingFang SC'` for CJK text
- **Touch + mouse**: Most games support both via `mousedown`/`touchstart` event pairs with `{ passive: false }` for touch
- **No responsive design**: Games target desktop browsers; mobile support is secondary and inconsistent

## File Naming

- `测试*.html` / `测试七巧板N.html` — Iterative versions of the same game concept (tangram)
- `*(待改进).html` — Works-in-progress with known issues
- Descriptive Chinese names — e.g., `时间认读PK赛.html` = "Time Reading PK Competition"

## Common Visual Patterns

Games share a consistent look reproduced across files:
- Background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` (purple gradient)
- Cards/panels: white `rgba(255,255,255,0.95)` with `border-radius: 12-20px` and `box-shadow: 0 8px 30px rgba(0,0,0,0.3)`
- Buttons: white text on colored background, `border-radius: 25px`, hover lifts with `translateY(-2px)`
- Game containers: `position: relative`, fixed max dimensions, centered with flexbox
- `user-select: none` and `touch-action: none` on body or interactive elements

## Key Game Files

| File | Topic | Lines | Rendering |
|---|---|---|---|
| `通用工具/百变七巧板.html` | Single-canvas tangram, simpler drag + wheel rotate | 853 | Canvas |
| `二年级/时间认读PK赛.html` | Clock reading competition for 2nd grade | ~970 | CSS/HTML |
| `通用工具/消消乐(待改进).html` | Mental math match-3 game | ~490 | CSS Grid |
| `二年级/认识数字-多位数.html` | Multi-digit number place-value explorer | ~836 | CSS/Canvas |
| `四年级/探索星球-大数读法.html` | Large number reading via planet exploration | ~697 | CSS/HTML |
| `通用工具/小天才空间积木盒 - 三视图挑战.html` | 3D block spatial reasoning (orthographic views) | ~370 | CSS/HTML |
| `二年级/水果分配 余数教学.html` | Division with remainder using fruit distribution | ~611 | CSS/HTML |
| `小学一年级/数字转盘小游戏.html` | Number wheel spinner game | ~798 | CSS/HTML |
| `小学一年级/分与合运动会.html` | Part-whole bond 4-team boat race; pre-race setup screen (adjustable max number), only "?" bubble is team-colored | ~530 | SVG scene + CSS/HTML |

注：早期迭代文件 `测试七巧板.html`~`测试七巧板5.html` 已删除，仅存 `通用工具/百变七巧板.html`；行数与描述为历史记录，未必与当前文件一致。

### Tangram Family (历史迭代关系)

七巧板历经多版迭代，**现仅存 `通用工具/百变七巧板.html`**（单 Canvas 简化版：1 面板、拖拽 + 滚轮旋转）。以下为历史沿革，文件均已删除：

- **测试七巧板3.html** — SVG 三面板布局（左参考件/中自由拼/右例题按钮），后升级角点手柄旋转（选中块后顶点显示蓝圆，拖动绕质心旋转）
- **测试七巧板4.html** — 类似 3，中面板叠加例题提示
- **测试七巧板5.html** — Canvas 全面重写：`Piece` 类、质心相对顶点坐标（`relVerts`）、旋转矩阵 `getAbsVerts()`、射线法 `containsPoint()` 命中检测、角点拖转；与 3 共用 400×400 坐标系缩至 200×200 的块几何
- **测试七巧板.html / 测试七巧板2.html** — 最早迭代

**Piece geometry**（源自七巧板3，百变七巧板沿用）：正方形分解的 7 块 — 2 大三角（①红 ②蓝）、1 中三角（③黄）、1 平行四边形（④金）、1 正方形（⑤橙）、2 小三角（⑥绿 ⑦粉）。颜色：`#E74C3C, #3498DB, #F1C40F, #D4AC0D, #E67E22, #27AE60, #E91E63`。

## How to Test

Since each file is standalone:

```bash
# Open any game directly in the default browser (Windows)
start "" "filename.html"

# Or from bash
explorer.exe filename.html
```

No server, bundler, or installation step is needed. Changes take effect on browser refresh.

## Python Environment

The `.venv/` directory contains a Python virtual environment with Flask and setuptools installed. This appears to be experimental — none of the current games depend on it. If asked about server-side features, Flask is available but unused.
