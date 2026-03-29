/**
 * effects.ts — 共享工具函数
 * 供各卡牌的 onPlay / onDeath / onReveal 等 hook 内部直接调用。
 * 所有函数直接修改传入的 state（引擎层已做 deepClone）。
 */

import type { GameState, UnitState } from '../types/state.js'
import type { Faction } from '../types/card.js'

export function log(state: GameState, msg: string): void {
  state.log.push(msg)
}

export function opposite(faction: Faction): Faction {
  return faction === 'HUMAN' ? 'NONHUMAN' : 'HUMAN'
}

// ── 英雄操作 ──────────────────────────────────────────────

export function healHero(state: GameState, owner: Faction, amount: number): void {
  const hero = owner === 'HUMAN' ? state.humanHero : state.nonhumanHero
  const actual = Math.min(amount, hero.maxHealth - hero.currentHealth)
  hero.currentHealth += actual
  if (actual > 0) log(state, `💚 ${hero.name} 恢复 ${actual} 点生命 (${hero.currentHealth}/${hero.maxHealth})`)
}

export function damageHero(state: GameState, target: Faction, amount: number, source: string): void {
  if (amount <= 0) return
  const hero = target === 'HUMAN' ? state.humanHero : state.nonhumanHero
  hero.currentHealth = Math.max(0, hero.currentHealth - amount)
  log(state, `💥 ${source} 对 ${hero.name} 造成 ${amount} 点伤害 (${hero.currentHealth}/${hero.maxHealth})`)
  if (hero.currentHealth <= 0) {
    state.winner = target === 'HUMAN' ? 'NONHUMAN' : 'HUMAN'
    log(state, `🏆 游戏结束！${state.winner === 'HUMAN' ? '人类' : '非人类'} 获胜！`)
  }
}

// ── 单位操作 ──────────────────────────────────────────────

/** 对场上所有敌方单位造成伤害 */
export function damageAllEnemyUnits(state: GameState, owner: Faction, amount: number, source: string): void {
  const enemy = opposite(owner)
  for (const lane of state.lanes) {
    const unit = enemy === 'HUMAN' ? lane.humanUnit : lane.nonhumanUnit
    if (unit) {
      unit.currentHealth -= amount
      log(state, `🔥 ${source} 对 ${unit.cardId} 造成 ${amount} 点伤害 (${unit.currentHealth}hp)`)
    }
  }
  removeDeadUnits(state)
}

/** 对指定单位造成伤害 */
export function damageUnit(state: GameState, target: UnitState, amount: number, source: string): void {
  target.currentHealth -= amount
  log(state, `🔥 ${source} 对 ${target.cardId} 造成 ${amount} 点伤害 (${target.currentHealth}hp)`)
  if (target.currentHealth <= 0) removeDeadUnits(state)
}

/** 消灭指定单位（无视生命值） */
export function destroyUnit(state: GameState, target: UnitState, source: string): void {
  target.currentHealth = 0
  log(state, `💥 ${source} 消灭了 ${target.cardId}`)
  removeDeadUnits(state)
}

/** 将单位弹回其主人手牌 */
export function bounceUnit(state: GameState, target: UnitState): void {
  const ownerFaction = target.ownerId
  const ownerHand = ownerFaction === 'HUMAN' ? state.humanHand : state.nonhumanHand
  const original = state.cardRegistry[target.instanceId]
  if (original) {
    ownerHand.push({ ...original })
    log(state, `↩️  ${original.definition.name} 弹回到 ${ownerFaction === 'HUMAN' ? '人类' : '非人类'} 手牌`)
  }
  removeSingleUnit(state, target)
}

/** 给目标单位 buff */
export function buffUnit(state: GameState, target: UnitState, attack: number, health: number, source: string): void {
  target.currentAttack += attack
  target.currentHealth += health
  target.maxHealth += health
  if (attack !== 0 || health !== 0) {
    log(state, `⬆️  ${source} 给 ${target.cardId} +${attack}/+${health}`)
  }
}

/** 给场上所有己方单位 buff */
export function buffAllFriendly(state: GameState, owner: Faction, attack: number, health: number, source: string): void {
  for (const lane of state.lanes) {
    const unit = owner === 'HUMAN' ? lane.humanUnit : lane.nonhumanUnit
    if (unit) buffUnit(state, unit, attack, health, source)
  }
}

// ── 摸牌 ──────────────────────────────────────────────────

export function drawCard(state: GameState, faction: Faction, count = 1): void {
  const deck = faction === 'HUMAN' ? state.humanDeck : state.nonhumanDeck
  const hand = faction === 'HUMAN' ? state.humanHand : state.nonhumanHand
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      log(state, `⚠️  ${faction} 牌库已空，无法摸牌`)
      return
    }
    const card = deck.shift()!
    // Register in cardRegistry (in case it wasn't already)
    state.cardRegistry[card.instanceId] = card
    hand.push(card)
    log(state, `🃏 ${faction === 'HUMAN' ? '人类' : '非人类'} 摸到 ${card.definition.name}`)
  }
}

// ── 内部清理 ──────────────────────────────────────────────

export function removeDeadUnits(state: GameState): void {
  for (const lane of state.lanes) {
    if (lane.humanUnit && lane.humanUnit.currentHealth <= 0) {
      log(state, `💀 ${lane.humanUnit.cardId} 死亡`)
      lane.humanUnit = null
    }
    if (lane.nonhumanUnit && lane.nonhumanUnit.currentHealth <= 0) {
      log(state, `💀 ${lane.nonhumanUnit.cardId} 死亡`)
      lane.nonhumanUnit = null
    }
  }
}

function removeSingleUnit(state: GameState, unit: UnitState): void {
  for (const lane of state.lanes) {
    if (lane.humanUnit?.instanceId === unit.instanceId) { lane.humanUnit = null; return }
    if (lane.nonhumanUnit?.instanceId === unit.instanceId) { lane.nonhumanUnit = null; return }
  }
}
