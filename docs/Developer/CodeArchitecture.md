# The Haunted University — 代码架构文档

> **版本：** Demo v0.1（OOP 卡牌架构）
> **最后更新：** 2026-03-29
> **状态：** 已实现并可运行
>
> 本文档描述**现在代码库中已实际实现**的架构，与 `TechDesign.md` 的规划方向一致但不完全相同。
> `TechDesign.md` 是未来完整版的蓝图，本文件是当前可跑代码的说明书。

---

## 目录

- [1. 仓库结构](#1-仓库结构)
- [2. packages/core 详细结构](#2-packagescore-详细结构)
- [3. 数据流与调用关系](#3-数据流与调用关系)
- [4. 卡牌架构：CardBase OOP 模式](#4-卡牌架构cardbase-oop-模式)
- [5. 核心类型系统](#5-核心类型系统)
- [6. GameEngine 公开 API](#6-gameengine-公开-api)
- [7. 回合状态机](#7-回合状态机)
- [8. 战斗结算流程](#8-战斗结算流程)
- [9. 关键词实现](#9-关键词实现)
- [10. Demo 卡牌数据](#10-demo-卡牌数据)
- [11. packages/debug-ui 结构](#11-packagesdebug-ui-结构)
- [12. 自动化测试](#12-自动化测试)
- [13. 开发命令](#13-开发命令)
- [14. 已知限制与 TODO](#14-已知限制与-todo)

---

## 1. 仓库结构

```
TheHauntedUniv/                  ← monorepo 根目录
├── package.json                 ← 根 workspace（scripts: build/test/dev）
├── pnpm-workspace.yaml          ← 声明 packages/*
├── tsconfig.base.json           ← 共享 TS 配置（strict: true, target: ES2020）
├── .gitignore
├── test-game.mjs                ← 自动化集成测试（直接 node 运行）
├── docs/                        ← 所有文档
└── packages/
    ├── core/                    ← @haunted/core（纯 TS 游戏引擎，零渲染依赖）
    └── debug-ui/                ← @haunted/debug-ui（Vite + 纯 HTML/CSS 调试界面）
```

---

## 2. packages/core 详细结构

```
packages/core/src/
├── index.ts                     ← 统一导出入口
│
├── types/
│   ├── card.ts                  ← 基础枚举类型（Keyword, Faction, CardType）
│   ├── state.ts                 ← GameState, UnitState, HeroState, LaneState, CardInstance, Action
│   └── events.ts                ← GameEvent union 类型（目前定义，未接入事件总线）
│
├── cards/                       ← 卡牌 OOP 基础设施
│   ├── CardBase.ts              ← 抽象基类 + UnitCard / SpellCard / EnvironmentCard
│   └── effects.ts               ← 共享工具函数（healHero/damageUnit/bounceUnit...）
│
├── engine/
│   ├── GameEngine.ts            ← 对外唯一入口（createGame/playCard/endPhase/getValidActions）
│   └── TurnStateMachine.ts      ← 阶段流转（getNextPhase/canEndPhase/getManaForTurn）
│
├── systems/
│   ├── CombatResolver.ts        ← 战斗结算（道路遍历、关键词处理、OOP 钩子调用）
│   ├── KeywordSystem.ts         ← 关键词工具函数（addArmor）
│   └── EffectSystem.ts          ← ⚠️ 已废弃（空壳，效果逻辑已迁移至各卡牌 class）
│
└── data/
    ├── cards-index.ts           ← 全卡牌注册表（ALL_CARDS / CARD_MAP / 分阵营导出）
    ├── human-cards.ts           ← 人类方10张卡（OOP class 形式）
    ├── nonhuman-cards.ts        ← 非人类方10张卡（OOP class 形式）
    ├── demo-cards.ts            ← ⚠️ 已废弃（空壳，使用 cards-index.ts 替代）
    └── demo-heroes.ts           ← 亚历山大大帝 + 玉皇大帝
```

---

## 3. 数据流与调用关系

```
debug-ui / test-game.mjs
        │
        │ import { GameEngine }
        ▼
   GameEngine.ts                  ← 所有操作唯一入口
   ├── createGame()               → 初始化 GameState，buildDeck（来自 cards-index），dealHand，填充 cardRegistry
   ├── playCard()                 → deepClone state → 校验阶段/费用 → _deployUnit/_castSpell/_placeEnvironment
   │                                → 调用 card.onPlay(state, owner, laneIndex, targetUnit?)
   ├── endPhase()                 → deepClone state → TurnStateMachine → (COMBAT时) CombatResolver
   └── getValidActions()          → 遍历手牌，调用 def.requiresTarget() 判断法术类型
        │
        ├── TurnStateMachine.ts   ← 纯函数，阶段枚举与流转规则
        ├── CombatResolver.ts     ← resolveCombat()，逐道路战斗
        │   ├── unit.onReveal()   ← 揭示时机（CARD_MAP.get(cardId)?.onReveal(...)）
        │   ├── unit.onDeath()    ← 死亡时机（CARD_MAP.get(cardId)?.onDeath(...)）
        │   └── env.onEndOfTurn() ← 环境回合结束效果
        └── KeywordSystem.ts      ← addArmor()，工具函数
```

**关键设计原则：**
- `GameEngine` 的每个方法都 `deepClone(state)` 后操作，**返回新 state，不修改传入值**（不可变状态模式）
- `packages/core` 内部**没有任何渲染/DOM/网络依赖**，可在 Node.js 测试环境直接运行
- `state.activePlayer` 是当前操作方的权威来源，UI 层永远读此字段，不手动维护

---

## 4. 卡牌架构：CardBase OOP 模式

### 设计思路

每张卡牌是一个 **TypeScript class**，继承 `UnitCard` / `SpellCard` / `EnvironmentCard`。
- 简单卡：只声明属性（id, name, faction, cost, attack, health, keywords...）
- 复杂卡：额外复写生命周期钩子（`onPlay`, `onDeath`, `onReveal`, `onEndOfTurn`）

### CardBase 抽象基类

```typescript
abstract class CardBase {
  // 必须声明的属性（abstract）
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly faction: Faction
  abstract readonly type: CardType
  abstract readonly cost: number
  abstract readonly tribes: string[]

  // 可选属性（有默认值）
  readonly keywords: readonly Keyword[] = []
  readonly armorValue?: number        // ARMOR X 的 X
  readonly foresightValue?: number    // SNIPER / Foresight X 的 X
  readonly overshootValue?: number    // OVERSHOOT X 的 X

  // 生命周期钩子（默认空实现，子类按需复写）
  onPlay(state, owner, laneIndex, targetUnit?): void {}
  onDeath(state, owner, laneIndex): void {}
  onReveal(state, owner, laneIndex): void {}
  onEndOfTurn(state, owner, laneIndex): void {}

  // UI 层调用：判断法术是否需要玩家点选目标
  requiresTarget(): boolean { return false }
}
```

### 卡牌编写示例

```typescript
// 简单单位卡（只有属性）
class YueFei extends UnitCard {
  readonly id = 'yue_fei'; readonly name = '岳飞'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 4; readonly attack = 4; readonly health = 3
  readonly keywords = [] as const
  readonly tribes = ['将领']
}

// 带登场效果的单位卡
class HuaTuo extends UnitCard {
  readonly id = 'hua_tuo'; readonly name = '华佗'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 2; readonly attack = 2; readonly health = 4
  readonly tribes = ['医者']

  onPlay(state: GameState, owner: Faction): void {
    healHero(state, owner, 3)   // 直接调用 effects.ts 里的工具函数
  }
}

// 复杂单位卡（多钩子、条件逻辑）
class ZhuGeLiang extends UnitCard {
  readonly id = 'zhuge_liang'; readonly name = '诸葛亮'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 5; readonly attack = 2; readonly health = 6
  readonly keywords = ['SENSE'] as const
  readonly tribes = ['谋士']

  onPlay(state: GameState, owner: Faction): void {
    const enemyHand = owner === 'HUMAN' ? state.nonhumanHand : state.humanHand
    log(state, `🔍 诸葛亮查看对方 ${enemyHand.length} 张手牌`)
    if (enemyHand.length >= 4) damageHero(state, opposite(owner), 3, this.name)
  }
}
```

### effects.ts 共享工具函数

所有卡牌 hook 可直接调用的副作用函数：

| 函数 | 说明 |
|------|------|
| `healHero(state, owner, amount)` | 治疗己方英雄，不超过 maxHealth |
| `damageHero(state, target, amount, source)` | 对指定英雄造成伤害，自动处理死亡 |
| `damageUnit(state, target, amount, source)` | 对指定单位造成伤害 |
| `damageAllEnemyUnits(state, owner, amount, source)` | 对所有敌方单位造成伤害 |
| `destroyUnit(state, target, source)` | 直接消灭单位（无视生命值）|
| `bounceUnit(state, target)` | 将单位弹回其主人手牌（重置状态）|
| `buffUnit(state, target, atk, hp, source)` | 给单位 +攻击/+生命 |
| `buffAllFriendly(state, owner, atk, hp, source)` | 给所有己方单位 buff |
| `drawCard(state, faction, count)` | 从牌库摸牌 |
| `removeDeadUnits(state)` | 清除生命值≤0的单位 |
| `opposite(faction)` | 返回对立阵营 |

### deepClone 对 CardBase 的处理

`GameEngine` 使用不可变状态模式，每次操作都 `deepClone(state)` 后返回新状态。但 `CardBase` 是**有方法的 class 实例**，无法被 `JSON.parse(JSON.stringify(...))` 正确克隆。

解决方案：自定义 `deepClone` 函数，序列化时将 CardBase 实例替换为 `{ __cardId: id }`，反序列化后从 `CARD_MAP` 恢复原始 class 实例（单例引用）：

```typescript
function deepClone(state: GameState): GameState {
  const cloned = JSON.parse(JSON.stringify(state, (_key, value) => {
    if (value && typeof value === 'object' && typeof value.onPlay === 'function') {
      return { __cardId: value.id }   // 序列化：替换为 id 占位
    }
    return value
  })) as GameState
  // 反序列化：从 CARD_MAP 恢复 CardBase 实例
  restoreDefinitions(cloned)
  return cloned
}
```

---

## 5. 核心类型系统

### CardBase（卡牌定义，OOP class）

见第4节。`CardDefinition` 接口已废弃，由 `CardBase` 抽象类替代。

### GameState（运行时唯一数据源）

```typescript
interface GameState {
  phase: TurnPhase        // 当前阶段
  turn: number
  activePlayer: Faction   // 权威来源，UI 层直接读此字段
  humanHero: HeroState
  nonhumanHero: HeroState
  lanes: LaneState[]      // 长度5
  humanHand: CardInstance[]
  nonhumanHand: CardInstance[]
  humanDeck: CardInstance[]
  nonhumanDeck: CardInstance[]
  humanMana: { current: number; max: number }
  nonhumanMana: { current: number; max: number }
  graveyard: CardInstance[]
  cardRegistry: Record<string, CardInstance>  // instanceId → CardInstance，用于弹回等效果
  log: string[]           // 事件文字日志
  winner: Faction | null
  pendingTargetEffect: PendingTargetEffect | null
}

type TurnPhase = 'NONHUMAN_PLAY' | 'HUMAN_PLAY' | 'NONHUMAN_TRICK' | 'COMBAT'
```

### CardInstance（手牌/场上/墓地的卡牌实例）

```typescript
interface CardInstance {
  instanceId: string    // 唯一实例 ID（同一张卡的两份实例有不同 ID）
  cardId: string        // 对应 CardBase.id
  definition: CardBase  // 指向 CARD_MAP 中的 class 实例（单例引用）
}
```

### UnitState（场上单位运行时状态）

```typescript
interface UnitState {
  instanceId: string
  cardId: string
  ownerId: Faction
  currentAttack: number
  currentHealth: number
  maxHealth: number
  keywords: Keyword[]     // 拷贝自 CardBase.keywords，可运行时修改
  isAmbushed: boolean     // 潜伏中，战斗前揭示
  statusTags: StatusTag[] // 运行时状态（如 ARMOR: { tag, value }）
  laneIndex: number
  teamUpSlot: 0 | 1
}
```

---

## 6. GameEngine 公开 API

```typescript
class GameEngine {
  // 创建新游戏，返回初始 GameState
  createGame(): GameState

  // 出牌：返回新 GameState（原 state 不变）
  playCard(
    state: GameState,
    playerId: Faction,
    cardInstanceId: string,
    laneIndex: number,
    targetInstanceId?: string  // 法术目标单位的 instanceId
  ): GameState

  // 结束当前阶段：若进入 COMBAT 则自动结算并推进到下一回合
  endPhase(state: GameState, playerId: Faction): GameState

  // 返回当前局面下 playerId 的所有合法动作
  getValidActions(state: GameState, playerId: Faction): Action[]
}
```

**UI 层使用约定：**
```typescript
// 始终从 state.activePlayer 读取当前操作方，不手动维护变量
state = engine.playCard(state, state.activePlayer, cardId, laneIndex)
state = engine.endPhase(state, state.activePlayer)
```

---

## 7. 回合状态机

**阶段顺序：**
```
NONHUMAN_PLAY → HUMAN_PLAY → NONHUMAN_TRICK → COMBAT → (下一回合) NONHUMAN_PLAY
```

**各阶段可执行操作：**

| 阶段 | 可出牌方 | 允许出牌类型 |
|------|---------|------------|
| NONHUMAN_PLAY | NONHUMAN | 单位、环境 |
| HUMAN_PLAY | HUMAN | 单位、法术、环境 |
| NONHUMAN_TRICK | NONHUMAN | 法术、环境（绝招阶段）|
| COMBAT | — | 自动结算，不接受玩家输入 |

**费用规则：** 第 N 回合双方各有 N 费（无上限）。回合开始时费用满额重置，当回合不能结转。

**endPhase 触发 COMBAT 后的完整流程：**
1. `resolveCombat(state)` — 战斗结算
2. `turn += 1`
3. 双方费用重置为 `turn`
4. 双方各摸1张牌
5. `phase = 'NONHUMAN_PLAY'`，`activePlayer = 'NONHUMAN'`

---

## 8. 战斗结算流程

`CombatResolver.resolveCombat(state)` 按以下顺序执行：

```
1. 遍历所有道路，揭示潜伏单位：
   - isAmbushed → false
   - 调用 CARD_MAP.get(unit.cardId)?.onReveal(state, owner, laneIndex)

2. 神射（SNIPER）预处理——战斗循环开始前：
   - 遍历所有道路，对每个有 SNIPER 的单位：
     调用 applyDamageToHero(enemyFaction, def.foresightValue ?? 1)

3. 逐道路 (index 0 → 4) 结算：
   a. 非人类单位攻击：
      - 对面有单位 → 双方互相造成对方攻击力伤害
        - 攻击后对面死亡 + 本方有 PIERCE → overkill 伤害传英雄
        - 攻击后对面死亡 + 本方有 OVERSHOOT → 读取 def.overshootValue，固定 X 点打英雄
      - 对面无单位 → 直接攻击人类英雄
   b. 死亡检测：currentHealth ≤ 0 → 调用 onDeath → 移除单位
   c. 人类单位攻击（同上逻辑）
   d. 死亡检测

4. 环境牌回合结束效果：
   调用 env.definition.onEndOfTurn(state, owner, laneIndex)

5. 每步检查 state.winner，一旦英雄 HP ≤ 0 立即设置并停止结算
```

**护甲处理：** 受伤时先消耗 ARMOR status tag 的值，超出部分才扣 currentHealth。护甲值随伤害递减，耗尽后 tag 移除。

---

## 9. 关键词实现

Demo v0.1 实现了 5 个关键词：

| 关键词 | 代码位置 | 实现方式 |
|--------|---------|---------|
| SNIPER（神射 X）| `CombatResolver` 步骤2 | 战斗前遍历，读 `def.foresightValue`，对敌方英雄造成固定 X 点伤害；单位之后正常参与道路战斗 |
| PIERCE（穿透）| `CombatResolver.resolveUnitAttack` | 击杀后计算 `overkill = attack - targetHealth`，调用 `applyDamageToHero` |
| OVERSHOOT（溢伤 X）| `CombatResolver.resolveUnitAttack` | 击杀后读 `CARD_MAP.get(id)?.overshootValue`，造成固定 X 点伤害 |
| ARMOR（护甲 X）| `CombatResolver.consumeArmor` + `GameEngine._deployUnit` | 放置时读 `def.armorValue` 调用 `addArmor(unit, X)` 写入 statusTag；受伤时先消耗 ARMOR tag |
| AMBUSH（潜伏）| `GameEngine._deployUnit` + `CombatResolver` 步骤1 | 放置时 `unit.isAmbushed = true`；战斗前揭示并调用 `onReveal` 钩子 |

**关键词 X 值存储位置：**

| 关键词 | 字段 | 位置 |
|--------|------|------|
| SNIPER | `def.foresightValue` | `CardBase` 子类属性 |
| OVERSHOOT | `def.overshootValue` | `CardBase` 子类属性 |
| ARMOR | `def.armorValue` | `CardBase` 子类属性 |

---

## 10. Demo 卡牌数据

**人类方（`data/human-cards.ts`，10张）：**

| 卡名 | 费用 | 攻/血 | 关键词/效果 |
|------|------|--------|------------|
| 戚继光 | 3 | 2/3 | 神射2（战斗前对英雄造成2点伤害）|
| 李白 | 4 | 4/2 | 穿透 |
| 项羽 | 5 | 5/4 | 溢伤3 |
| 秦始皇兵马俑 | 2 | 3/3 | 护甲2 |
| 荆轲 | 2 | 2/2 | 潜伏 |
| 岳飞 | 4 | 4/3 | — |
| 华佗 | 2 | 2/4 | 登场：治疗英雄3点（onPlay）|
| 孙子兵法（法术）| 2 | — | 对目标造成3点伤害（requiresTarget=true）|
| 军粮（法术）| 1 | — | 给己方单位+2攻击（requiresTarget=true）|
| 长城（环境）| 3 | — | 登场：所有己方单位+0/+2（onPlay）|

**非人类方（`data/nonhuman-cards.ts`，10张）：**

| 卡名 | 费用 | 攻/血 | 关键词/效果 |
|------|------|--------|------------|
| 白骨精 | 3 | 2/3 | 神射2 |
| 孙悟空 | 5 | 5/4 | 穿透 |
| 骊山老母 | 2 | 3/3 | 护甲2 |
| 聂小倩 | 2 | 2/2 | 潜伏，揭示：摸1张牌（onReveal）|
| 牛魔王 | 4 | 4/4 | 溢伤2 |
| 哪吒 | 3 | 3/3 | 登场：对所有敌方单位造成1点伤害（onPlay）|
| 太上老君 | 2 | 2/2 | 登场：消灭一个有护甲的单位（onPlay，requiresTarget=true）|
| 雷法（法术）| 2 | — | 对目标造成2点伤害 |
| 封印（法术）| 2 | — | 弹回目标单位到手牌 |
| 阴司（环境）| 3 | — | 每回合结束对敌方英雄造成1点伤害（onEndOfTurn）|

**英雄（`data/demo-heroes.ts`）：**
- 人类：亚历山大大帝（20HP）
- 非人类：玉皇大帝（20HP）

**牌库构成：** 每张卡 ×2，共 20 张，洗牌后各发4张初始手牌。

**新增卡牌方式：** 在 `human-cards.ts` 或 `nonhuman-cards.ts` 新增 class，加入对应的 `HUMAN_CARDS` / `NONHUMAN_CARDS` 数组，`pnpm build` 验证。

---

## 11. packages/debug-ui 结构

```
packages/debug-ui/
├── package.json          （name: @haunted/debug-ui，依赖: @haunted/core workspace:*，devDep: vite）
├── tsconfig.json
├── index.html            （完整 HTML + CSS，无 CSS 框架）
└── src/
    ├── main.ts           ← 游戏状态管理 + 事件处理入口
    └── render.ts         ← 将 GameState 渲染为 DOM
```

**main.ts 核心逻辑：**
```typescript
// 始终用 state.activePlayer，不手动维护 currentPlayer 变量
function currentPlayer(): Faction { return state.activePlayer }

function onSelectCard(card): void      // 选中手牌
                                       // 无需目标的法术（!requiresTarget()）→ 直接施放
                                       // 需要目标的法术 → 等待点击棋盘单位
function onPlayToLane(laneIndex): void // 单位/环境出牌到指定道路
function onEndPhase(): void            // 结束当前阶段
function handleUnitTargetClick(e): void // 点击棋盘单位（作为法术目标）
```

**render.ts 核心逻辑：**
- `renderState()` — 直接从 `state.phase` 判断哪方手牌可交互
- `renderHand(side, isActive, ...)` — `isActive=false` 时该方手牌完全禁用
- `selectedCard.definition.requiresTarget()` — 判断是否需要点选目标（替代旧的 effects 数组检查）
- 右侧事件日志面板增量渲染 `state.log`

---

## 12. 自动化测试

**文件：** `test-game.mjs`（monorepo 根目录）

**运行方式：**
```bash
pnpm --filter @haunted/core build && node test-game.mjs
```

无需安装额外依赖，直接 import `packages/core/dist/` 的编译产物。

**测试覆盖（16个 section，60个断言）：**

| 编号 | 测试内容 |
|------|---------|
| TEST 1 | 游戏初始化（阶段、英雄HP、手牌数、费用、cardRegistry）|
| TEST 2 | 非人类出牌（手牌减少、单位上场、费用扣除、无错误日志）|
| TEST 3 | 阶段校验：人类在非人类回合出牌被拒 |
| TEST 4 | 费用不足出牌被拒 |
| TEST 5 | 完整阶段流转（4个阶段 + 下回合费用）|
| TEST 6 | 错误方结束阶段被拒 |
| TEST 7 | 完整多回合自动对局（至少跑到有人获胜）|
| TEST 8 | 神射关键词（战斗前预伤害，绕过挡路单位打英雄）|
| TEST 9 | 穿透关键词（overkill 伤害传英雄）|
| TEST 10 | getValidActions（有效动作列表，含 END_PHASE）|
| TEST 11 | 护甲关键词（吸收伤害，血量不变，护甲耗尽）|
| TEST 12 | 潜伏关键词（isAmbushed=true → 战斗后揭示，onReveal 触发）|
| TEST 13 | 登场效果（华佗 onPlay 治疗英雄3点）|
| TEST 14 | 日志无 undefined/[object Object] |
| TEST 15 | activePlayer 驱动出牌（模拟 UI 正确行为）|
| TEST 16 | 溢伤关键词（击杀后固定 X 点伤害打英雄）|

**辅助函数：**
- `injectCard(state, faction, cardId)` — 强制把指定卡牌注入手牌，绕过随机性
- `setMana(state, faction, amount)` — 设置指定方费用，保证可出指定卡

---

## 13. 开发命令

```bash
# 安装依赖（首次或新增依赖后）
pnpm install

# 编译 core（检查 TypeScript 类型）
pnpm --filter @haunted/core build

# 启动调试界面（浏览器打开 http://localhost:5173）
pnpm --filter @haunted/debug-ui dev

# 运行自动化测试（需先 build core）
pnpm --filter @haunted/core build && node test-game.mjs

# 构建 debug-ui 生产包
pnpm --filter @haunted/debug-ui exec vite build
```

---

## 14. 已知限制与 TODO

**Demo v0.1 的已知限制：**

| 项目 | 当前状态 | 说明 |
|------|---------|------|
| ON_DEATH 效果 | ⚠️ 接口已接入 | `CombatResolver` 会调用 `onDeath` 钩子，但目前没有卡牌复写该方法 |
| 协作（TEAM_UP）| ❌ 未实现 | 每条道路目前只能放1个单位 |
| 两栖（AMPHIBIOUS）| ❌ 未实现 | 道路4水路无特殊限制 |
| 超能力 | ❌ 未实现 | 英雄无超能力卡槽 |
| 护盾机制 | ❌ 未实现 | 游戏设计中的护盾格挡未引入 |
| 牌库耗尽处理 | ⚠️ 有提示 | 只打日志，无疲劳伤害 |
| 法术目标选择UI | ⚠️ 基础 | 只能点棋盘上已有单位，无法选英雄为目标 |
| 回放/撤销 | ❌ 未实现 | 无法撤销操作 |

**下一步优先级：**
1. 协作机制（道路多单位）
2. 两栖道路限制
3. 超能力系统
4. ON_DEATH 效果卡牌（编写第一张有死亡效果的卡牌验证钩子正确触发）
