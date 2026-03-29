# The Haunted University — 技术设计文档

> **版本：** v1.0
> **创建时间：** 2026-03-28
> **技术方案：** Phaser 3 + TypeScript + Node.js + Socket.io
> **目标平台：** 微信内嵌 H5 网页（公众号菜单入口）

---

## 目录

- [1. 技术选型](#1-技术选型)
- [2. 项目结构](#2-项目结构)
- [3. 核心架构：GameCore](#3-核心架构-gamecore)
- [4. 数据结构设计](#4-数据结构设计)
- [5. 游戏状态机](#5-游戏状态机)
- [6. 关键词系统](#6-关键词系统)
- [7. 效果系统](#7-效果系统)
- [8. 渲染层（Phaser 3）](#8-渲染层phaser-3)
- [9. 网络层](#9-网络层)
- [10. 数据持久化](#10-数据持久化)
- [11. 开发阶段规划](#11-开发阶段规划)
- [12. 微信适配要点](#12-微信适配要点)

---

## 1. 技术选型

### 前端
| 技术 | 版本 | 用途 |
|------|------|------|
| TypeScript | 5.x | 主要开发语言，强类型保障游戏逻辑 |
| Phaser 3 | 3.70+ | 游戏渲染引擎（场景、动画、输入、音效）|
| Vite | 5.x | 构建工具，热更新，快速打包 |

### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20 LTS | 服务端运行时 |
| Express | 4.x | REST API（卡组管理、用户数据）|
| Socket.io | 4.x | 实时 PvP 状态同步 |
| Redis | 7.x | 游戏房间状态缓存（对局进行中）|
| MongoDB | 7.x | 玩家数据、卡组持久化 |

### 工具链
| 工具 | 用途 |
|------|------|
| Vitest | 单元测试（核心逻辑）|
| ESLint + Prettier | 代码规范 |
| pnpm | 包管理 |

---

## 2. 项目结构

```
haunted-university/
├── packages/
│   ├── core/                        # 纯 TypeScript 游戏核心，零渲染依赖
│   │   ├── src/
│   │   │   ├── models/              # 数据模型
│   │   │   │   ├── Card.ts          # 卡牌数据结构
│   │   │   │   ├── Unit.ts          # 场上单位状态
│   │   │   │   ├── Hero.ts          # 英雄状态
│   │   │   │   ├── Lane.ts          # 道路状态
│   │   │   │   ├── Hand.ts          # 手牌
│   │   │   │   ├── Deck.ts          # 牌库
│   │   │   │   └── GameState.ts     # 完整游戏状态（可序列化）
│   │   │   ├── engine/
│   │   │   │   ├── GameEngine.ts    # 主游戏循环与阶段管理
│   │   │   │   ├── CombatEngine.ts  # 战斗结算逻辑
│   │   │   │   ├── EffectEngine.ts  # 效果执行器
│   │   │   │   └── TurnManager.ts   # 回合与费用管理
│   │   │   ├── keywords/            # 每个关键词一个独立文件
│   │   │   │   ├── TeamUp.ts        # 协作
│   │   │   │   ├── Deadly.ts        # 致命
│   │   │   │   ├── Bullseye.ts      # 神射
│   │   │   │   ├── Armored.ts       # 护甲
│   │   │   │   ├── Strikethrough.ts # 穿透
│   │   │   │   ├── Overshoot.ts     # 溢伤
│   │   │   │   ├── DoubleStrike.ts  # 双击
│   │   │   │   ├── AntiHero.ts      # 克主
│   │   │   │   ├── Hunt.ts          # 追踪
│   │   │   │   ├── Untrickable.ts   # 法免
│   │   │   │   ├── Gravestone.ts    # 潜伏
│   │   │   │   ├── Frenzy.ts        # 狂暴
│   │   │   │   ├── Splash.ts        # 溅射
│   │   │   │   ├── Freeze.ts        # 冻结
│   │   │   │   ├── Bounce.ts        # 弹回
│   │   │   │   └── index.ts         # 关键词注册表
│   │   │   ├── effects/             # 效果类型实现
│   │   │   │   ├── DamageEffect.ts
│   │   │   │   ├── HealEffect.ts
│   │   │   │   ├── BuffEffect.ts
│   │   │   │   ├── SummonEffect.ts
│   │   │   │   ├── DrawEffect.ts
│   │   │   │   ├── DestroyEffect.ts
│   │   │   │   ├── BounceEffect.ts
│   │   │   │   ├── TransformEffect.ts
│   │   │   │   ├── StealEffect.ts
│   │   │   │   ├── ReviveEffect.ts
│   │   │   │   └── index.ts
│   │   │   ├── triggers/            # 触发时机
│   │   │   │   ├── TriggerSystem.ts # 触发器注册与分发
│   │   │   │   └── TriggerType.ts   # 触发时机枚举
│   │   │   ├── ai/
│   │   │   │   ├── BaseAI.ts        # AI 接口
│   │   │   │   └── GreedyAI.ts      # 贪心AI实现
│   │   │   └── data/
│   │   │       ├── cards/           # 卡牌数据 JSON
│   │   │       │   ├── human.json   # 232张人类卡牌
│   │   │       │   └── nonhuman.json# 232张非人类卡牌
│   │   │       └── heroes.json      # 20位英雄+超能力数据
│   │   └── tests/                   # Vitest 单元测试
│   │
│   ├── client/                      # Phaser 3 前端
│   │   ├── src/
│   │   │   ├── scenes/
│   │   │   │   ├── BootScene.ts     # 资源预加载
│   │   │   │   ├── MenuScene.ts     # 主菜单
│   │   │   │   ├── DeckScene.ts     # 卡组构建
│   │   │   │   ├── GameScene.ts     # 主游戏场景
│   │   │   │   └── ResultScene.ts   # 结算界面
│   │   │   ├── components/          # Phaser 游戏组件
│   │   │   │   ├── CardSprite.ts    # 卡牌精灵
│   │   │   │   ├── UnitSprite.ts    # 场上单位
│   │   │   │   ├── HeroPanel.ts     # 英雄血量面板
│   │   │   │   ├── HandArea.ts      # 手牌区
│   │   │   │   ├── LaneArea.ts      # 道路区
│   │   │   │   └── CostBar.ts       # 费用条
│   │   │   ├── animations/          # 动画定义
│   │   │   ├── network/
│   │   │   │   └── GameClient.ts    # Socket.io 客户端
│   │   │   └── main.ts              # Phaser 入口
│   │   └── index.html
│   │
│   └── server/                      # Node.js 后端
│       ├── src/
│       │   ├── api/                 # REST 接口
│       │   │   ├── deck.ts          # 卡组 CRUD
│       │   │   └── user.ts          # 用户信息
│       │   ├── socket/
│       │   │   ├── GameRoom.ts      # 对局房间管理
│       │   │   └── SyncEngine.ts    # 状态同步
│       │   └── app.ts               # Express 入口
│       └── package.json
│
├── pnpm-workspace.yaml
└── package.json
```

> **核心设计原则：`packages/core` 绝对不能引入任何渲染/网络依赖。**
> 它是纯粹的游戏逻辑层，可以在浏览器、Node.js 服务端、测试环境中无差别运行。

---

## 3. 核心架构：GameCore

### 3.1 架构分层

```
┌─────────────────────────────────────┐
│           Phaser 3 渲染层            │  ← 只负责展示与输入
│         (client/scenes/*)           │
├─────────────────────────────────────┤
│            GameCore API             │  ← 唯一接口层
│         GameEngine.ts               │
├──────────────┬──────────────────────┤
│  TurnManager │   CombatEngine       │  ← 回合 / 战斗
├──────────────┼──────────────────────┤
│ EffectEngine │   TriggerSystem      │  ← 效果 / 触发
├──────────────┴──────────────────────┤
│           GameState                 │  ← 唯一状态源
│   (纯数据，可完整序列化为 JSON)      │
└─────────────────────────────────────┘
```

### 3.2 GameEngine 对外 API

渲染层与核心层只通过以下接口通信：

```typescript
interface GameEngine {
  // 查询
  getState(): Readonly<GameState>

  // 玩家操作
  playCard(playerId: string, cardId: string, laneIndex: number): ActionResult
  playSpell(playerId: string, cardId: string, targetId?: string): ActionResult
  playSuperpower(playerId: string, targetId?: string): ActionResult
  endTurn(playerId: string): ActionResult

  // 事件订阅（渲染层监听，用于播放动画）
  on(event: GameEvent, handler: EventHandler): void
  off(event: GameEvent, handler: EventHandler): void
}

// ActionResult 统一返回结构
interface ActionResult {
  success: boolean
  error?: string          // 失败原因
  events: GameEvent[]     // 本次操作产生的事件序列（用于动画）
}
```

### 3.3 事件驱动

所有状态变化通过事件通知渲染层，渲染层**不直接读取 GameState 驱动动画**，而是响应事件：

```typescript
type GameEvent =
  | { type: 'UNIT_PLAYED';     unitId: string; laneIndex: number }
  | { type: 'UNIT_ATTACKED';   attackerId: string; defenderId: string }
  | { type: 'UNIT_DAMAGED';    unitId: string; amount: number }
  | { type: 'UNIT_DIED';       unitId: string }
  | { type: 'HERO_DAMAGED';    playerId: string; amount: number }
  | { type: 'CARD_DRAWN';      playerId: string; cardId: string }
  | { type: 'SPELL_PLAYED';    cardId: string; targetId?: string }
  | { type: 'TURN_CHANGED';    phase: TurnPhase }
  | { type: 'GAME_OVER';       winner: string }
```

---

## 4. 数据结构设计

### 4.1 卡牌定义（静态数据）

```typescript
// 卡牌原始数据，存储在 JSON 文件中
interface CardDefinition {
  id: string              // 唯一ID，如 "human_001"
  name: string            // 卡牌名称，如 "霍去病"
  faction: 'human' | 'nonhuman'
  attribute: Attribute    // 所属属性（肉体/脑力/财富/精神/超能/神/鬼/兽/械/异）
  rarity: Rarity          // 普通/非普通/稀有/超稀有/传奇
  cost: number            // 费用
  cardType: CardType      // unit / spell / environment / superpower
  // 单位专属
  attack?: number
  health?: number
  tribe?: string          // 族群，如 "历史"、"海贼"
  keywords?: Keyword[]    // 关键词列表
  // 效果
  effects?: EffectDefinition[]
  // 元数据
  flavorText?: string
  artKey?: string         // 图片资源 key
}

type Attribute =
  // 人类方
  | 'physical'   // 💪 肉体
  | 'mental'     // 🧠 脑力
  | 'wealth'     // 💰 财富
  | 'spirit'     // 🔥 精神
  | 'power'      // ⚡ 超能
  // 非人类方
  | 'divine'     // ✨ 神
  | 'ghost'      // 👻 鬼
  | 'beast'      // 🐉 兽
  | 'mech'       // 🤖 械
  | 'cosmic'     // 🌌 异

type Rarity = 'common' | 'uncommon' | 'rare' | 'superrare' | 'legendary'
type CardType = 'unit' | 'spell' | 'environment' | 'superpower'
```

### 4.2 场上单位状态（动态数据）

```typescript
// 场上的单位实例，与 CardDefinition 分离
interface UnitState {
  instanceId: string        // 运行时唯一ID（同一张牌可能出现多次）
  definitionId: string      // 对应的 CardDefinition.id
  ownerId: string           // 归属玩家
  laneIndex: number         // 所在道路（0-4）

  // 当前数值（可被效果修改）
  currentAttack: number
  currentHealth: number
  maxHealth: number

  // 关键词（可动态增减）
  keywords: Set<Keyword>
  armorValue: number        // 护甲X的X值

  // 状态标记
  isFrozen: boolean         // 被冻结
  isGravestone: boolean     // 潜伏中（战斗前揭示）
  hasAttackedThisTurn: boolean
  attacksRemainingThisTurn: number  // 双击等额外攻击

  // 临时效果（回合结束清除）
  tempBuffs: Buff[]
}
```

### 4.3 英雄状态

```typescript
interface HeroState {
  heroId: string
  name: string
  currentHealth: number
  maxHealth: number           // 固定为 30
  attributes: [Attribute, Attribute]  // 两个属性

  superpowerCard: CardDefinition | null  // null 表示已使用
  superpowerUsed: boolean
}
```

### 4.4 完整游戏状态

```typescript
// 这是整个游戏的唯一数据源，任意时刻都可序列化为 JSON
interface GameState {
  gameId: string
  turn: number                // 当前回合数
  phase: TurnPhase            // 当前阶段
  activePlayerId: string      // 当前行动方

  players: {
    [playerId: string]: PlayerState
  }

  lanes: LaneState[]          // 5条道路

  graveyard: {
    [playerId: string]: UnitState[]  // 墓地（复活效果需要）
  }

  history: GameEvent[]        // 完整事件历史（用于回放/断线重连）
  rng: RNGState               // 随机数状态（保证双端一致）
}

interface PlayerState {
  playerId: string
  hero: HeroState
  hand: CardDefinition[]
  deck: CardDefinition[]      // 剩余牌库（已洗牌顺序）
  currentCost: number         // 本回合剩余费用
  maxCost: number             // 本回合费用上限（= turn数，最大10）
}

interface LaneState {
  index: number               // 0-4
  units: {
    human: UnitState | null
    nonhuman: UnitState | null
  }
  environment: CardDefinition | null
  // 注：协作（TeamUp）允许同道路多单位，用数组处理
  humanUnits: UnitState[]
  nonhumanUnits: UnitState[]
}

type TurnPhase =
  | 'NONHUMAN_DEPLOY'   // 非人类方出单位
  | 'HUMAN_DEPLOY'      // 人类方出单位+法术
  | 'NONHUMAN_SPELL'    // 非人类方出法术
  | 'COMBAT'            // 战斗阶段（自动）
  | 'TURN_END'          // 回合结束处理
```

---

## 5. 游戏状态机

### 5.1 回合流程

```
回合开始
  │
  ▼
[NONHUMAN_DEPLOY]  ←── 非人类方出单位（可出环境牌）
  │ endTurn()
  ▼
[HUMAN_DEPLOY]     ←── 人类方出单位 + 法术 + 环境
  │ endTurn()
  ▼
[NONHUMAN_SPELL]   ←── 非人类方出法术 + 环境（特殊情况可出单位）
  │ endTurn()
  ▼
[COMBAT]           ←── 自动结算，不接受玩家输入
  │ (自动)
  ▼
[TURN_END]         ←── 清理临时效果，抽牌，费用上限+1
  │
  ▼
回合开始（turn+1）
```

### 5.2 战斗结算顺序

```
foreach lane (0 → 4):
  1. 揭示该道路的潜伏单位（触发 Reveal 效果）
  2. 非人类方单位先攻击
     a. 若对面有人类单位 → 互相造成伤害
     b. 若对面无单位 → 攻击人类英雄
  3. 检查死亡（生命值 ≤ 0 → 触发死亡效果 → 移入墓地）
  4. 处理战斗关键词（穿透/溢伤/溅射/双击/狂暴...）
  5. 人类方单位攻击（同上逻辑）
  6. 再次检查死亡
  7. 检查游戏结束（英雄血量 ≤ 0）
```

---

## 6. 关键词系统

每个关键词是一个独立的 TypeScript 模块，实现统一接口：

```typescript
interface KeywordHandler {
  keyword: Keyword
  // 修改伤害计算（护甲、神射、溢伤等）
  modifyDamage?: (context: DamageContext) => DamageContext
  // 战斗后额外效果（双击、穿透、狂暴等）
  onAfterCombat?: (context: CombatContext, state: GameState) => GameEvent[]
  // 出场时效果（追踪）
  onPlay?: (unit: UnitState, state: GameState) => GameEvent[]
  // 检查是否可以出牌到指定位置
  canPlayTo?: (unit: UnitState, laneIndex: number, state: GameState) => boolean
}
```

### 16个关键词实现要点

| 关键词 | 实现钩子 | 关键逻辑 |
|--------|---------|---------|
| 协作 | `canPlayTo` | 允许同道路存在多个协作单位 |
| 两栖 | `canPlayTo` | 允许放置到水域道路 |
| 神射 | `modifyDamage` | 攻击对方单位时，同时对英雄造成等量伤害 |
| 致命 | `modifyDamage` | 造成≥1伤害时目标直接死亡 |
| 护甲X | `modifyDamage` | 受到伤害时先扣护甲值，超出部分才扣血 |
| 穿透 | `onAfterCombat` | 消灭对面单位后，剩余攻击力打到英雄 |
| 溢伤X | `onAfterCombat` | 超出目标血量的固定X点伤害打到英雄 |
| 双击 | `onAfterCombat` | 战斗后若存活，再攻击一次（标记已用双击防循环）|
| 克主X | `modifyDamage` | 攻击时若对面道路无单位，攻击力+X |
| 追踪 | `onPlay` | 出场时自动移动到有敌方单位的道路 |
| 法免 | — | EffectEngine 执行法术时检查目标，跳过法免单位 |
| 潜伏 | — | 战斗阶段开始时翻转，对方在此前不可见 |
| 揭示 | `onPlay`变体 | 从潜伏状态翻转时触发，等同登场效果 |
| 狂暴 | `onAfterCombat` | 消灭单位后若自身存活，额外攻击一次 |
| 溅射X | `onAfterCombat` | 攻击时对相邻道路单位/英雄造成X点伤害 |
| 冻结 | — | 设置 `isFrozen=true`，该单位跳过攻击 |
| 弹回 | — | EffectEngine 将单位移出场地，放回手牌 |

---

## 7. 效果系统

### 7.1 效果定义结构

```typescript
interface EffectDefinition {
  trigger: TriggerType        // 触发时机
  effect: EffectType          // 效果类型
  target: TargetSelector      // 目标选择器
  value?: number | string     // 效果数值或引用
  condition?: Condition        // 触发条件（可选）
}

type TriggerType =
  | 'ON_PLAY'           // 登场时
  | 'ON_DEATH'          // 消灭时
  | 'ON_DAMAGED'        // 受伤时
  | 'ON_ATTACK'         // 攻击时
  | 'START_OF_TURN'     // 回合开始
  | 'END_OF_TURN'       // 回合结束
  | 'BEFORE_COMBAT'     // 战斗前
  | 'ON_SPELL_PLAYED'   // 我方法术打出时
  | 'ON_UNIT_PLAYED'    // 我方单位打出时
  | 'ON_ENEMY_DEATH'    // 敌方单位消灭时

type TargetSelector =
  | 'SELF'              // 自身
  | 'FRIENDLY_HERO'     // 友方英雄
  | 'ENEMY_HERO'        // 敌方英雄
  | 'TARGET_UNIT'       // 玩家手动选择的单位
  | 'ALL_FRIENDLY'      // 所有友方单位
  | 'ALL_ENEMIES'       // 所有敌方单位
  | 'RANDOM_ENEMY'      // 随机一个敌方单位
  | 'LANE_ENEMY'        // 同道路敌方单位
  | 'ADJACENT_UNITS'    // 相邻道路单位
  | { type: 'FILTER'; attribute?: Attribute; tribe?: string; maxCost?: number }
```

### 7.2 效果执行示例

以"霍去病（追踪）"为例：
```typescript
// cards/human.json
{
  "id": "human_physical_001",
  "name": "霍去病",
  "cost": 1, "attack": 2, "health": 1,
  "keywords": ["hunt"],   // 追踪
  "effects": []
}
```

以"项羽（受伤：+3攻击）"为例：
```typescript
{
  "id": "human_physical_020",
  "name": "项羽",
  "cost": 3, "attack": 3, "health": 6,
  "keywords": [],
  "effects": [{
    "trigger": "ON_DAMAGED",
    "effect": "BUFF",
    "target": "SELF",
    "value": { "attack": 3, "health": 0 }
  }]
}
```

---

## 8. 渲染层（Phaser 3）

### 8.1 场景划分

```
BootScene → MenuScene → DeckScene
                    ↓
               HeroSelectScene
                    ↓
               GameScene → ResultScene
```

### 8.2 GameScene 布局（横屏）

```
┌─────────────────────────────────────────────────────┐
│  [对手英雄] HP:30  [对手手牌背面 ×N]    [对手费用]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  道路0  道路1  道路2  道路3  道路4                   │
│  [环境] [环境] [环境] [环境] [环境]                  │
│  [敌方] [敌方] [敌方] [敌方] [敌方]  ← 非人类方区   │
│  ─────────────────────────────────                  │
│  [我方] [我方] [我方] [我方] [我方]  ← 人类方区     │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [我方英雄] HP:30  [超能力]  [费用条]  [结束回合]   │
│  ┌──────────────────────────────────────────────┐   │
│  │              手牌区（扇形排列）               │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 8.3 交互设计

- **出单位**：从手牌拖拽到目标道路，松手确认
- **出法术（需目标）**：点击法术卡 → 高亮可选目标 → 点击目标确认
- **出法术（无目标）**：点击法术卡，弹出确认
- **使用超能力**：点击超能力槽，如需目标同上
- **查看卡牌详情**：长按卡牌弹出放大详情
- **结束回合**：点击右下角按钮

### 8.4 动画队列

渲染层维护一个动画队列，监听 GameEvent 逐个播放，保证动画不重叠：

```typescript
class AnimationQueue {
  private queue: GameEvent[] = []
  private playing = false

  push(event: GameEvent) { ... }
  async play() {
    // 逐个执行，每个动画 await 完成后再下一个
  }
}
```

---

## 9. 网络层

### 9.1 PvP 同步模型

采用**服务端权威（Server Authoritative）**模型：

```
客户端A                服务端                客户端B
   │                     │                     │
   │── playCard(req) ──→ │                     │
   │                     │ 验证合法性           │
   │                     │ 执行 GameCore        │
   │                     │ 生成 Events          │
   │←── stateUpdate ──── │ ──── stateUpdate ──→ │
   │    + events         │      + events        │
```

- 客户端**不自行执行逻辑**，只发送操作意图
- 服务端执行同一套 GameCore 逻辑，广播结果
- 客户端收到 stateUpdate 后更新本地状态，播放动画

### 9.2 Socket 事件

```typescript
// 客户端 → 服务端
socket.emit('game:action', { type: 'PLAY_CARD', cardId, laneIndex })
socket.emit('game:action', { type: 'END_TURN' })

// 服务端 → 客户端
socket.on('game:update', (delta: GameStateDelta) => { ... })
socket.on('game:events', (events: GameEvent[]) => { ... })
socket.on('game:over', (result: GameResult) => { ... })
```

### 9.3 断线重连

服务端 Redis 中保存完整 GameState，断线后重连时下发完整状态快照，客户端直接同步。

---

## 10. 数据持久化

### 10.1 MongoDB 数据模型

```typescript
// 用户
{
  _id: ObjectId,
  wxOpenId: string,         // 微信 OpenID
  nickname: string,
  decks: DeckConfig[],      // 保存的卡组
  stats: { wins, losses }
}

// 卡组
{
  _id: ObjectId,
  userId: ObjectId,
  name: string,
  heroId: string,
  cards: string[],          // 30个 CardDefinition.id
  createdAt: Date
}
```

### 10.2 卡牌数据格式

所有 484 张卡牌存储为 JSON，随前端打包：

```
packages/core/src/data/
├── cards/
│   ├── human.json           # 232张人类卡牌数组
│   └── nonhuman.json        # 232张非人类卡牌数组
└── heroes.json              # 20位英雄 + 超能力
```

---

## 11. 开发阶段规划

### 第一阶段：GameCore MVP（目标：2~3周）

**目标：** 在 Node.js 控制台能跑通一局完整游戏

- [ ] 基础数据结构（Card/Unit/Hero/GameState）
- [ ] 回合状态机（4个阶段 + 费用管理）
- [ ] 战斗结算（单位互打 + 英雄直伤）
- [ ] 关键词：协作 / 致命 / 神射 / 护甲 / 冻结（5个核心）
- [ ] 效果系统：伤害 / 治疗 / 强化 / 弱化（基础4种）
- [ ] 触发时机：登场 / 消灭 / 受伤
- [ ] 简单AI（随机出牌）
- [ ] 完整单元测试覆盖 GameCore
- [ ] 录入 50 张卡牌数据（各属性各10张）

### 第二阶段：可视化原型（目标：3~4周）

**目标：** 浏览器里能拖牌对打

- [ ] Phaser 场景搭建（GameScene 基础布局）
- [ ] 卡牌/单位 Sprite 渲染
- [ ] 拖拽出牌交互
- [ ] 动画队列系统
- [ ] 道路战斗动画
- [ ] 接入全部 16 个关键词
- [ ] 接入全部 10 种触发时机
- [ ] 录入全部 484 张卡牌数据

### 第三阶段：完整单机（目标：3~4周）

**目标：** 完整单人对战体验

- [ ] 卡组构建界面
- [ ] 英雄选择界面
- [ ] 改进 AI（贪心策略）
- [ ] 超能力卡槽
- [ ] 结算界面
- [ ] 全部卡牌效果实现

### 第四阶段：联机 + 微信适配（目标：4周）

**目标：** 朋友间可以对战

- [ ] WebSocket 服务端
- [ ] 房间创建/加入（邀请码）
- [ ] PvP 状态同步
- [ ] 微信登录（公众号授权）
- [ ] 触屏优化
- [ ] 横屏强制
- [ ] 性能优化（资源压缩/懒加载）

---

## 12. 微信适配要点

| 问题 | 方案 |
|------|------|
| 横屏强制 | CSS `transform: rotate(90deg)` + 屏幕方向检测 |
| 触屏拖拽 | Phaser 内置 touch 事件，已支持 |
| 图片资源大 | WebP 格式，卡牌图片懒加载 |
| 微信缓存 | Service Worker 缓存静态资源 |
| 微信登录 | 公众号网页授权获取 OpenID |
| 音频自动播放 | 等待用户第一次触屏交互后再播放 |
| 安全区域 | CSS `safe-area-inset` 适配刘海屏 |

---

## 附：关键设计决策记录

| 日期 | 决策 | 理由 |
|------|------|------|
| 2026-03-28 | 选择 H5 而非微信小程序 | 小程序包体/Canvas限制对卡牌游戏不友好 |
| 2026-03-28 | GameCore 零渲染依赖 | 保证可测试性、可复用性、服务端权威模型 |
| 2026-03-28 | 服务端权威同步模型 | 防作弊，双端状态一致 |
| 2026-03-28 | 每个关键词独立文件 | 16个关键词逻辑复杂，独立维护防止互相污染 |
| 2026-03-28 | 英雄血量采用30（非PVZH的20）| 见 DevFeatures.md 设计决策 |
