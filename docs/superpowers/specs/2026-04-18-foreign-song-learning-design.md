# 外文歌曲学唱 Web App 设计文档

**日期：** 2026-04-18  
**状态：** 已审批  

---

## 一、产品概述

一个帮助用户学唱外文歌曲的 Web 应用。核心功能：

- 搜索歌曲，嵌入 YouTube 播放
- 每行歌词下方显示中文音译（如 `hello` → `哈喽`），由 Claude API 生成
- 歌词随播放自动高亮滚动，点击任意行进入单句循环模式
- 颜色分组映射：单词与对应音译用相同颜色标注，循环时行内从左到右扫描高亮

**目标用户：** 先自用，后续可开放注册。  
**支持语言：** 英语、日语、韩语、西班牙语、瑞典语。  
**平台：** Web 优先（响应式布局）。

---

## 二、整体架构

```
用户浏览器
│
├── Next.js Frontend (App Router)
│   ├── 搜索页       — 搜索歌曲
│   └── 播放页       — 核心学习界面
│       ├── YouTube IFrame 播放器
│       ├── 歌词面板（逐行高亮同步）
│       └── 单句循环控制器
│
└── Next.js API Routes
    ├── GET  /api/search        → YouTube Data API v3 搜索视频
    ├── GET  /api/lyrics        → lrclib.net 获取 LRC 时间轴歌词
    ├── POST /api/phonetics     → Claude API 批量生成音译（首次），读缓存（之后）
    └── GET  /api/songs         → 已保存歌曲列表

数据库：SQLite + Prisma（本地自用；可升级 PostgreSQL）
```

---

## 三、数据模型

### `songs` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| youtubeId | String | YouTube 视频 ID |
| title | String | 歌曲名 |
| artist | String | 艺术家 |
| language | String | 语言（en/ja/ko/es/sv） |
| thumbnailUrl | String | 封面图 |
| durationSeconds | Int | 时长（秒） |
| createdAt | DateTime | 创建时间 |

### `lyrics` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| songId | String | 外键 → songs.id |
| lines | Json | 歌词行数组（见下方结构） |

### `lines` JSON 结构

```json
[
  {
    "time": 12.5,
    "endTime": 15.2,
    "text": "you're looking for",
    "phonetic": "有儿 路奇恩佛",
    "segments": [
      { "original": "you're",      "phonetic": "有儿",    "color": 0 },
      { "original": "looking for", "phonetic": "路奇恩佛", "color": 1 }
    ]
  }
]
```

---

## 四、前端组件

| 组件 | 职责 |
|------|------|
| `SearchBar` | 搜索输入框 + YouTube 结果下拉列表 |
| `YouTubePlayer` | IFrame 封装，暴露 `seekTo(t)` / `getCurrentTime()` |
| `LyricsPanel` | 滚动容器，管理当前高亮行，500ms 轮询播放时间 |
| `LyricLine` | 单行：原文 + 音译，颜色分组，点击事件 |
| `LoopController` | 管理循环区间（startTime / endTime），驱动 `seekTo` |
| `PhoneticToggle` | 显示 / 隐藏音译开关（自测模式） |

### 播放页布局

```
┌─────────────────────────────────────────────┐
│  🔍 搜索框（顶部导航）                         │
├──────────────────┬──────────────────────────┤
│                  │  歌词面板                  │
│  YouTube 播放器   ├──────────────────────────┤
│                  │ ► you're looking for     │ ← 当前行（高亮）
│                  │   有儿 路奇恩佛            │ ← 音译（颜色分组）
│                  ├──────────────────────────┤
│                  │   I can see it...        │
│                  │   爱肯诶特...              │
└──────────────────┴──────────────────────────┘
      [ 🔁 单句循环：当前行  ✕ 退出循环 ]
```

---

## 五、核心交互逻辑

### 歌词同步高亮
- 每 500ms 调用 `player.getCurrentTime()`
- 找到满足 `line.time <= currentTime < line.endTime` 的行
- 滚动该行到视图中央，添加高亮样式

### 单句循环模式
1. 用户点击某行 → `seekTo(line.time)` → 开始播放
2. 每 500ms 检查：若 `currentTime >= line.endTime` → `seekTo(line.time)`
3. 底部显示循环提示条，点击"✕"退出循环

### 颜色分组 + 进度高亮（循环模式）
- 静态颜色：`segments[i].color` 决定原文词和对应音译用同一颜色
- 动态扫描：循环模式下，按行内时间比例 `(currentTime - line.time) / (line.endTime - line.time)` 计算进度，逐段点亮 segments
- 降级策略：若无词级时间戳，按等比估算，视觉效果一致

---

## 六、LLM 音译生成

### 调用时机
- 歌曲首次打开时，若 DB 无缓存则调用
- 调用一次后永久缓存，不再重复消耗 token

### Prompt 设计

**系统提示：**
```
你是一个专业的外语歌曲音译助手。将歌词转写为中国人能"按汉字发音来模拟演唱"的中文音译。
要求：①贴近原语言发音 ②自然流畅可唱 ③按词/短语分组返回 segments
```

**输入格式：**
```json
{
  "language": "en",
  "lines": [
    { "index": 0, "text": "you're looking for" }
  ]
}
```

**输出格式：**
```json
[
  {
    "index": 0,
    "phonetic": "有儿 路奇恩佛",
    "segments": [
      { "original": "you're",      "phonetic": "有儿"    },
      { "original": "looking for", "phonetic": "路奇恩佛" }
    ]
  }
]
```

---

## 七、外部 API 集成

| API | 用途 | 认证方式 |
|-----|------|----------|
| YouTube Data API v3 | 搜索视频、获取时长 | API Key（环境变量） |
| YouTube IFrame API | 嵌入播放器 | 无需认证 |
| lrclib.net | 获取 LRC 时间轴歌词 | 无需认证（免费公开） |
| Claude API | 生成音译 + 分组映射 | API Key（环境变量） |

---

## 八、边界情况处理

| 情况 | 处理方式 |
|------|----------|
| lrclib 找不到歌词 | 提示用户手动粘贴歌词文本 |
| YouTube 视频被屏蔽 | 提示更换视频链接 |
| Claude 生成失败 | 显示原文，音译标记"生成失败"并可手动重试 |
| LRC 无词级时间戳 | 降级为行内等比估算高亮 |
| 歌曲已缓存 | 跳过所有外部 API 调用，直接渲染 |

---

## 九、完整用户流程

```
搜索歌名/歌手
  → 选择 YouTube 视频
    → 自动拉取 LRC 歌词（lrclib.net）
      → Claude 生成音译 + 颜色分组映射（首次约 3-5 秒）
        → 进入播放页
          → 歌词随播放高亮滚动
            → 点击某行 → 单句循环 + 颜色进度扫描高亮
```

---

## 十、技术栈

| 层 | 选型 |
|----|------|
| 框架 | Next.js 15 (App Router) |
| 样式 | Tailwind CSS |
| 数据库 | SQLite + Prisma |
| 外部 API | YouTube Data API v3、lrclib.net、Claude API (claude-sonnet-4-6) |
| 部署 | 本地运行 / Vercel（未来） |
