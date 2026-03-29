/**
 * CardBase.ts — 所有卡牌的抽象基类
 *
 * 使用方式：
 *   - 简单卡：继承 UnitCard / SpellCard / EnvironmentCard，只填属性
 *   - 复杂卡：额外复写 onPlay / onDeath / onReveal / onEndOfTurn 钩子
 *
 * 引擎通过 card.onPlay(state, owner, laneIndex, targetUnit?) 触发效果，
 * 不再解析 EffectDefinition 数组。
 */

import type { GameState, UnitState } from '../types/state.js'
import type { Keyword, Faction, CardType } from '../types/card.js'

// ── 抽象基类 ──────────────────────────────────────────────────────────────────

export abstract class CardBase {
  // 必须由子类声明的属性
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly faction: Faction
  abstract readonly type: CardType
  abstract readonly cost: number
  abstract readonly tribes: string[]

  // 可选属性（默认值）
  readonly attack?: number
  readonly health?: number
  readonly keywords: readonly Keyword[] = []
  readonly description?: string

  // 关键词附属值（只对携带对应关键词的卡有意义）
  readonly armorValue?: number        // ARMOR X 的 X
  readonly foresightValue?: number    // SNIPER / Foresight X 的 X
  readonly overshootValue?: number    // OVERSHOOT X 的 X

  // ── 生命周期钩子（默认空实现，子类按需复写）──────────────────────────────

  /**
   * 登场时触发（单位打出/法术施放/环境放置时）
   * @param state   当前游戏状态（已 deepClone，可直接修改）
   * @param owner   打出这张卡的玩家阵营
   * @param laneIndex  打出到的道路编号
   * @param targetUnit 玩家选择的目标单位（需要目标的法术/效果才会有值）
   */
  onPlay(state: GameState, owner: Faction, laneIndex: number, targetUnit?: UnitState): void {}

  /**
   * 单位死亡时触发（生命值归零被移出场地时）
   * @param state   当前游戏状态
   * @param owner   该单位所属阵营
   * @param laneIndex 死亡时所在道路
   */
  onDeath(state: GameState, owner: Faction, laneIndex: number): void {}

  /**
   * 潜伏单位揭示时触发
   * @param state   当前游戏状态
   * @param owner   该单位所属阵营
   * @param laneIndex 所在道路
   */
  onReveal(state: GameState, owner: Faction, laneIndex: number): void {}

  /**
   * 环境牌每回合结束时触发（repeating effect）
   * @param state   当前游戏状态
   * @param owner   放置该环境牌的玩家阵营
   * @param laneIndex 所在道路
   */
  onEndOfTurn(state: GameState, owner: Faction, laneIndex: number): void {}

  // ── 辅助方法 ──────────────────────────────────────────────────────────────

  /** 是否包含某个关键词 */
  hasKeyword(kw: Keyword): boolean {
    return (this.keywords as Keyword[]).includes(kw)
  }

  /**
   * UI 层判断法术是否需要玩家选择目标（不需要目标=AoE/自动）
   * 默认根据是否复写 onPlay 且有 targetUnit 形参来判断，
   * 需要目标的法术子类应复写此方法返回 true。
   */
  requiresTarget(): boolean {
    return false
  }
}

// ── 具体基类（按卡牌类型细分）────────────────────────────────────────────────

/** 单位卡基类 */
export abstract class UnitCard extends CardBase {
  readonly type: CardType = 'UNIT'
  abstract readonly attack: number
  abstract readonly health: number
}

/** 法术卡基类 */
export abstract class SpellCard extends CardBase {
  readonly type: CardType = 'SPELL'
}

/** 环境卡基类 */
export abstract class EnvironmentCard extends CardBase {
  readonly type: CardType = 'ENVIRONMENT'
}
