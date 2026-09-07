# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A collection of standalone HTML-based educational mini-games for Chinese elementary school (小学) math teaching. Each `.html` file is a self-contained game — no build tools, no package manager, no server required. Open any file directly in a browser to run it.

**Current focus: 小学一年级 (Grade 1).** Requirement docs live in `小学一年级需求文档文件夹/` (数学拔河 ✅ built, 数学飞行棋 ✅ built as 飞行棋 + 地图编辑器, data flows via `localStorage['rewardmap_editor']`).

## Directory Structure (按年级归档)

- `游戏目录.html` — 根目录导航页，按年级分类列出所有游戏（新增游戏请同步更新）
- `小学一年级/` — Grade 1 games (数学拔河、飞行棋、地图编辑器、数字转盘×2)
- `二年级/` — Grade 2 games (认识时间、时间认读PK赛、水果分配余数教学、认识数字-多位数)
- `三年级/` — Grade 3 games (15 games covering 上册7 + 下册8 units)
- `四年级/` — Grade 4 games (大数读法×2)
- `通用工具/` — Cross-grade tools (消消乐、七巧板、三视图、答题闯关游戏/、zhuomianchongwu/ 课堂宠物系统含 server)
- `小学一年级需求文档文件夹/` — Grade 1 requirement docs (.md)

New games go into the matching grade folder and get registered in `游戏目录.html`.

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
| `测试七巧板3.html` | Tangram puzzle — 3-panel SVG layout with hint overlays | 853 | SVG |
| `测试七巧板5.html` | Tangram puzzle — Canvas-based with corner-handle rotation | 1070 | Canvas |
| `百变七巧板.html` | Single-canvas tangram, simpler drag + wheel rotate | 853 | Canvas |
| `时间认读PK赛.html` | Clock reading competition for 2nd grade | ~970 | CSS/HTML |
| `消消乐(待改进).html` | Mental math match-3 game | ~490 | CSS Grid |
| `认识数字-多位数.html` | Multi-digit number place-value explorer | ~836 | CSS/Canvas |
| `探索星球-大数读法.html` | Large number reading via planet exploration | ~697 | CSS/HTML |
| `小天才空间积木盒 - 三视图挑战.html` | 3D block spatial reasoning (orthographic views) | ~370 | CSS/HTML |
| `水果分配 余数教学.html` | Division with remainder using fruit distribution | ~611 | CSS/HTML |
| `数字转盘小游戏.html` | Number wheel spinner game | ~798 | CSS/HTML |

### Tangram Family (迭代关系)

The tangram games have undergone iterative development across multiple files:

- **`测试七巧板3.html`** — SVG-based, three-panel layout (left: reference pieces, center: free assembly, right: example buttons). Rotation was originally button-only (±45°), later upgraded with **corner-handle rotation**: selecting a piece shows blue circles on each vertex; dragging a circle rotates the piece around its centroid.
- **`测试七巧板4.html`** — Similar to 3, with example hints overlaid on the center panel
- **`测试七巧板5.html`** — Full Canvas rewrite using a `Piece` class with centroid-relative vertex coordinates (`relVerts`), rotation matrices in `getAbsVerts()`, ray-casting `containsPoint()` for hit detection, and corner-handle drag-to-rotate. Uses the same piece geometry as file 3 (400×400 coordinate system scaled to 200×200).
- **`百变七巧板.html`** — Single-canvas simplified version (1 panel, no examples)
- **`测试七巧板.html` / `测试七巧板2.html`** — Earliest iterations

**Piece geometry** (from file 3, used across all versions): 7 pieces decomposed from a square — 2 large right triangles (① red, ② blue), 1 medium triangle (③ yellow), 1 parallelogram (④ gold), 1 square (⑤ orange), 2 small triangles (⑥ green, ⑦ pink). Colors: `#E74C3C, #3498DB, #F1C40F, #D4AC0D, #E67E22, #27AE60, #E91E63`.

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
