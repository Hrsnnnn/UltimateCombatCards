# The Haunted University — 项目上下文

> 本文件在每次新 session 启动时自动读取。
> 读完后请根据用户指示，前往 `docs/Sessions/` 下对应的路由文档确认自己的角色与工作范围。

---

## 基础合作规则

- **规则数值只改一处** — 所有规则数值的唯一来源是 `GameDesign.md`，其他文件只做路由引用，不重复描述
- **不知道就说** — 某个设计细节文档里没有时，不要假设，立刻告知用户
- **上下文预警** — 感觉上下文窗口快满时，主动提醒用户开新 session，同时统一更新 `CHANGELOG.md` 和知识库
- **CHANGELOG 节奏** — 不在每次交互后更新，仅在 session 即将结束/上下文接近上限时集中整理一次

---

## 文档分层规则（重要）

本项目采用**单一来源（Single Source of Truth）**原则，每条信息只在一处定义：

| 层级 | 文件 | 职责 | 禁止做的事 |
|------|------|------|-----------|
| **规则层** | `GameDesign.md` | 所有规则、数值、关键词的**唯一完整定义** | 不得在其他文件重复定义 |
| **索引层** | `CardsCommon.md` | 关键词**名称列表**（无定义），便于查阅分类 | 不得写关键词效果描述 |
| **实现层** | `DevFeatures.md` | 关键词**实现要点**，规则数值只引用来源 | 不得重复规则描述，只写代码实现细节 |
| **导航层** | `CLAUDE.md`（本文件）| 结构索引，指向各文件 | 不得包含任何规则数值 |

### 新增关键词的正确流程

1. `GameDesign.md` §七 — 写完整定义（**唯一需要写定义的地方**）
2. `CardsCommon.md` — 在对应分类下加名称（一行，无需描述）
3. `DevFeatures.md` §七 — 加实现要点一行（只写代码逻辑，不重复效果描述）

### 修改规则数值的正确流程

只改 `GameDesign.md`，其他文件使用路由引用，**无需同步**。

### 卡牌数量不在文档中维护

卡牌数量以 `Cards/` 目录实际内容为准，需要统计时运行：
```bash
node docs/count-cards.mjs
```

---

## 项目简介

**The Haunted University** 是一款仿照 Plants vs. Zombies Heroes（PVZH）框架设计的 2D 卡牌对战游戏，运行在微信公众号（H5）上，供朋友间私下娱乐，无商业目的。

游戏使用真实存在或虚构的各类 IP 角色（动漫、历史人物、电影、体育明星等），两方对战：**人类 vs 非人类**。

核心规则详见 `GameDesign.md`，技术方案详见 `Developer/TechDesign.md`，**当前已实现代码的架构说明详见 `Developer/CodeArchitecture.md`**。

---

## 文档结构

```
docs/
├── CLAUDE.md                    ← 本文件，项目全局上下文
├── GameDesign.md                ← 设计圣经，所有已敲定的核心规则
├── GameModes.md                 ← 游戏模式设计（VS AI / 特殊挑战 / PvP）
├── CHANGELOG.md                 ← 设计变更记录（session 结束时更新）
├── Sessions/
│   ├── Gameplay.md              ← 玩法设计 session 路由
│   └── Dev.md                   ← 程序开发 session 路由
├── Cards/                       ← 卡牌数据（按阵营/类型拆分）
│   ├── CardsCommon.md           ← 关键词分类名称索引（定义见 GameDesign.md）
│   ├── Human/
│   │   ├── Units.md             ← 人类方单位卡
│   │   ├── Spells.md            ← 人类方法术卡
│   │   └── Environments.md      ← 人类方环境卡
│   └── NonHuman/
│       ├── Units.md             ← 非人类方单位卡
│       ├── Spells.md            ← 非人类方法术卡
│       └── Environments.md      ← 非人类方环境卡
├── GamePlay/
│   ├── Heroes.md                ← 英雄候选列表
│   └── Heroes_Powers.md         ← 英雄超能力设计
├── Deprecated/                  ← 已归档的历史版本（仅供参考）
├── Ideas/
│   ├── Characters.md            ← 角色候选池
│   └── Spells.md                ← 法术卡牌创意
├── Developer/
│   ├── TechDesign.md            ← 技术设计文档（完整版规划蓝图）
│   ├── DevFeatures.md           ← 开发功能清单（程序 session 维护）
│   └── CodeArchitecture.md      ← 当前已实现代码的架构说明（Demo v0.1）
└── Pvzh/                        ← PVZH 参考资料（非本游戏内容）
    ├── rules.md
    └── cards.md
```

---

## 基础概念

> 以下为快速索引，所有规则数值的权威来源是 `GameDesign.md`。

| 项目 | 说明 | 详见 |
|------|------|------|
| 阵营 | 人类 vs 非人类 | GameDesign.md §二 |
| 属性 | 人类5种 / 非人类5种 | GameDesign.md §三 |
| 英雄 | 每方10位，各拥有2个属性 | GameDesign.md §四 |
| 超能力 | 每位英雄4张，不计入卡组 | GameDesign.md §五 |
| 护盾 | 护盾条满格触发格挡，每局最多3次 | GameDesign.md §五 |
| 卡组 | 固定张数，只可使用英雄属性下的卡牌 | GameDesign.md §七 |
| 道路 | 5条（高地面 / 平地×3 / 水路）| GameDesign.md §七 |
| 关键词 | 共23个 | GameDesign.md §七 |
| DLC保留 | 法术/异术属性（咒术回战、哈利波特等）| GameDesign.md §三 |
