# 课堂宠物 · ClassPet

> 小学课堂教师端宠物养成系统 · v0.2

通过宠物升级机制激励小学生课堂参与度。**已接入 Node.js + Express + SQLite 后端**，支持 Excel 批量导入学生和题库、主题包上传、数据备份恢复；同时保留**纯前端本地降级模式**（后端没启动时自动走 localStorage，老师双击即用）。

---

## 🚀 两种使用方式

### 方式一：完整后端模式（推荐，支持多教师共享 / Excel 导入 / 备份）

```bash
cd server
# 复制环境变量
cp .env.example .env
# 启动（Node 22+ 内置 SQLite，无需原生编译）
npm install        # 或用全局工作区：见下方"依赖安装"
npm start
# 浏览器打开 http://localhost:3000
```

> 默认教师账号：`teacher` / `classpet123`（首次启动自动 seed，可在 `.env` 改 `TEACHER_PASSWORD`）

### 方式二：纯前端本地模式（降级，单机演示）

直接双击 `index.html`。前端会探测 `/api/health`，探测失败则自动切换到本地模式（数据存 localStorage，默认账号同样是 `teacher` / `classpet123`）。

---

## 🎮 核心功能

| 功能 | 说明 |
|---|---|
| 学生管理 | 列表/搜索/分页；Excel 批量导入（upsert）；导出当前数据为 Excel |
| 题库管理 | 列表/筛选（学科/难度）；Excel 导入；随机抽题（抢答用） |
| 课堂互动 | 三种模式：待机 / 普通答题 / 抢答；15 秒倒计时 + 滴答声 + 红色边框闪烁 + 结束铃声 |
| 加分系统 | +1 / +3 / +5 三档；自动检测升级并触发动画+音效 |
| 撤销机制 | 后端模式基于 score_logs 流水表逐条回滚（已修复原规范文档缺陷） |
| 主题包 | ZIP 上传 + 自动剥离父目录 + 校验 pet_level1~10 资源完整性 |
| 数据备份 | 一键下载 SQLite + uploads 打包 ZIP；支持上传 ZIP 恢复 |
| 教师鉴权 | 简单 token 鉴权；写接口需登录，读接口开放（便于投影时直接打开） |

## ⌨️ 键盘快捷键

| 键 | 功能 |
|---|---|
| `1` / `3` / `5` | 给当前学生 +1 / +3 / +5 |
| `U` | 撤销上次加分 |
| `N` | 换一题 |
| `Space` | 抢答模式下：开始/停止倒计时 |

---

## 📁 项目结构

```
zhuomianchongwu/
├── index.html              # 前端主页面
├── css/
│   └── style.css           # 柔和糖果卡通风（面向小学生）
├── js/
│   ├── pets.js             # 10 级占位像素宠物（SVG 矩阵）
│   ├── audio.js            # Web Audio 合成音效
│   ├── data.js             # 本地模式数据 + localStorage
│   ├── api.js              # 后端 API 封装 + 模式探测 + token 管理
│   └── app.js              # 主逻辑（API 模式 + 本地模式双支持）
├── server/                 # 后端
│   ├── package.json
│   ├── .env.example
│   ├── server.js           # Express 主入口
│   ├── db.js               # SQLite schema + seed（用 node:sqlite）
│   ├── middleware/
│   │   └── auth.js         # token 鉴权
│   └── routes/
│       ├── auth.js         # 登录 / 改密码 / 退出
│       ├── students.js     # 学生 CRUD + Excel 导入/导出
│       ├── questions.js    # 题库 CRUD + Excel 导入 + 随机抽题
│       ├── score.js        # 加分 / 撤销 / 流水查询（挂到 /api/students/:id/*）
│       ├── themes.js       # 主题包 ZIP 上传 / 激活 / 删除
│       └── backup.js       # 备份下载 / 上传恢复
└── README.md
```

---

## 🗄 数据库设计（修复原规范文档的几个缺陷）

| 表 | 用途 | 修复/新增点 |
|---|---|---|
| `students` | 学生 | 补 `created_at` / `updated_at` 时间戳 |
| `pet_configs` | 宠物配置 | 同原规范 |
| `questions` | 题库 | 补 `subject` / `difficulty` / `knowledge` 便于筛选 |
| **`score_logs`** | **加分流水** | **新增！原规范撤销接口无法回溯，现按流水回滚** |
| `teachers` | 教师账号 | **新增！原规范全部接口无鉴权，学生可作弊加分** |
| `themes` | 主题包 | 记录激活状态 |

---

## 🔌 API 一览

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| POST | `/api/auth/login` | 登录返回 token | 否 |
| POST | `/api/auth/logout` | 退出 | 是 |
| POST | `/api/auth/change-password` | 改密码 | 是 |
| GET | `/api/students` | 学生列表（分页/筛选） | 否 |
| POST | `/api/students` | 新增学生 | 是 |
| PUT | `/api/students/:id` | 修改学生 | 是 |
| DELETE | `/api/students/:id` | 删除学生 | 是 |
| POST | `/api/students/import` | Excel 导入 | 是 |
| GET | `/api/students/export` | 导出 Excel | 否 |
| GET | `/api/questions` | 题库列表 | 否 |
| GET | `/api/questions?random=1` | 随机抽一题 | 否 |
| POST | `/api/questions` | 新增题目 | 是 |
| PUT/DELETE | `/api/questions/:id` | 改/删 | 是 |
| POST | `/api/questions/import` | Excel 导入 | 是 |
| POST | `/api/students/:id/add-score` | 加分（返回是否升级） | 是 |
| POST | `/api/students/:id/undo-score` | 撤销最近一次加分 | 是 |
| GET | `/api/students/:id/score-logs` | 加分流水 | 否 |
| GET | `/api/themes` | 主题列表 | 否 |
| POST | `/api/themes/upload` | 上传 ZIP 主题包 | 是 |
| POST | `/api/themes/:id/activate` | 激活主题 | 是 |
| DELETE | `/api/themes/:id` | 删除主题 | 是 |
| GET | `/api/backup` | 下载备份 ZIP | 否 |
| POST | `/api/backup/restore` | 上传 ZIP 恢复 | 是 |

---

## 🎨 设计风格

- **方向**：柔和糖果卡通风（面向小学生）
- **取舍说明**：为符合"柔和卡通"美学，已放宽原文档"圆角≤2px"硬约束，改用 8/16/24px 大圆角 + 柔和模糊投影 + 糖果配色
- **字体**：ZCOOL KuaiLe（站酷快乐体）+ Fredoka + Noto Sans SC
- **配色**：奶油白底 + 糖果色系（珊瑚粉/薄荷绿/天空蓝/暖阳黄/薰衣草紫），文字用深紫灰 #3d405b 替代纯黑
- **童趣装饰**：舞台区有飘浮云朵、旋转太阳、圆润草地；升级特效飘散星星与爱心

---

## 🔧 替换占位素材

### 1. 替换像素宠物

打开 `js/pets.js`，修改 `PET_SPRITES` 对象（16×16 字符矩阵 + 调色板）。

### 2. 替换音效

打开 `js/audio.js`，将合成代码替换为 `new Audio('sounds/xxx.mp3').play()`。

### 3. 修改升级阈值

`js/pets.js` 顶部 `LEVEL_THRESHOLDS`，**同时**修改 `server/db.js` 中的 `LEVEL_THRESHOLDS`（前后端必须一致）。

---

## 📦 后端依赖安装（可选工作区）

为避免污染系统环境，推荐把 npm 包安装到隔离工作区：

```bash
# 在工作区安装依赖
cd C:\Users\<你>\.workbuddy\binaries\node\workspace
npm install express multer xlsx adm-zip cors

# 启动后端时通过 NODE_PATH 引用
cd <项目>\server
NODE_PATH=<工作区>\node_modules node --experimental-sqlite server.js
```

或者直接在 `server/` 下 `npm install` 也可以（推荐 Node ≥ 22，无需任何原生编译）。

---

## 🛠 管理端（admin）

独立管理界面，访问 **http://localhost:3000/admin**，默认账号 `admin` / `admin123`。

**角色区分**：管理员（admin）可登录管理端；普通教师（teacher）仅能登录课堂端。登录时若非管理员会提示无权限。

**功能模块**：

| 模块 | 能力 |
|---|---|
| 仪表盘 | 学生/题库/教师/班级总数、班级分布、宠物等级分布、近7天加分趋势、积分榜 Top5 |
| 班级管理 | **左侧班级列表 + 右侧学生列表联动**；班级 CRUD（含年级/排序/启停）；学生从属于班级，支持新增/编辑/换班/删除/Excel导入到指定班级/导出班级学生 |
| 题库管理 | 列表搜索/学科·类型筛选、新增/编辑/删除、Excel 导入（题目/选项A-D/答案/类型/学科/难度/知识点）|
| 教师管理 | 新增/编辑/启停/改角色、重置密码、删除（保护：禁删当前账号与最后一个管理员）|
| 主题管理 | 上传 ZIP 主题包（校验 pet_level1~10）、激活/删除 |
| 数据备份 | 下载完整备份（数据库+上传资源 ZIP）、上传恢复（自动重启）|

**保护逻辑**：
- `teachers`/`stats` 路由全部 `adminRequired` 中间件保护
- 至少保留一个启用的管理员，禁止降级/停用/删除最后一个
- 老库迁移自动补 role 列并确保存在 admin 账号

---

## 🐛 已知限制

1. 宠物只有 idle 状态，无 active（活跃）动画 —— 可用 CSS 实现
2. 升级音效用 Web Audio 合成，音质不如专业音效库 —— 可替换 mp3
3. 教师鉴权用进程内 token 池，重启后需重新登录（单机场景可接受）
4. 单班级，不支持多班切换 —— V2.0 规划

---

## 📝 技术参考

- 原始规范：`学习宠物系统技术规范文档.docx`
- 设计方向：[Impeccable](https://impeccable.style) 前端设计工具集
- 后端 SQLite：Node 22 内置 `node:sqlite` 模块（实验性，需 `--experimental-sqlite` 标志）
- 文档版本：v0.2
