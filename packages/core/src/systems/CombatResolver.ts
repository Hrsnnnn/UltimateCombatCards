import type { UnitState, GameState, StatusTag } from '../types/state.js'
import type { Faction } from '../types/card.js'
import { CARD_MAP } from '../data/cards-index.js'

function log(state: GameState, msg: string): void {
  state.log.push(msg)
}

function consumeArmor(unit: UnitState, damage: number): number {
  const tagIndex = unit.statusTags.findIndex(t => t.tag === 'ARMOR')
  if (tagIndex === -1) return damage
  const tag = unit.statusTags[tagIndex] as StatusTag & { tag: 'ARMOR'; value: number }
  if (tag.value >= damage) {
    tag.value -= damage
    if (tag.value === 0) unit.statusTags.splice(tagIndex, 1)
    return 0
  } else {
    const remaining = damage - tag.value
    unit.statusTags.splice(tagIndex, 1)
    return remaining
  }
}

function applyDamageToUnit(unit: UnitState, damage: number): number {
  const actual = consumeArmor(unit, damage)
  unit.currentHealth -= actual
  return actual
}

function applyDamageToHero(state: GameState, faction: Faction, damage: number, source: string): void {
  if (damage <= 0) return
  const hero = faction === 'HUMAN' ? state.humanHero : state.nonhumanHero
  hero.currentHealth = Math.max(0, hero.currentHealth - damage)
  log(state, `💥 ${source} 对 ${hero.name} 造成 ${damage} 点伤害 (${hero.currentHealth}/${hero.maxHealth})`)
  if (hero.currentHealth <= 0) {
    state.winner = faction === 'HUMAN' ? 'NONHUMAN' : 'HUMAN'
    log(state, `🏆 游戏结束！${state.winner === 'HUMAN' ? '人类' : '非人类'} 获胜！`)
  }
}

function isDead(unit: UnitState): boolean {
  return unit.currentHealth <= 0
}

/**
 * Resolve a single unit's attack against the opposite side of its lane.
 * Each unit attacks exactly once per combat phase:
 *   - Defender present → fight (PIERCE/OVERSHOOT may add bonus damage to hero as keyword effect)
 *   - No defender → attack enemy hero directly
 *   - Killing a defender does NOT carry damage to hero unless PIERCE/OVERSHOOT
 * Note: SNIPER pre-combat effect is handled separately in resolveCombat.
 */
function resolveUnitAttack(
  attacker: UnitState,
  lane: import('../types/state.js').LaneState,
  state: GameState
): void {
  const attackerName = attacker.cardId
  const enemyFaction: Faction = attacker.ownerId === 'HUMAN' ? 'NONHUMAN' : 'HUMAN'
  const defender = attacker.ownerId === 'HUMAN' ? lane.nonhumanUnit : lane.humanUnit

  const isPierce = attacker.keywords.includes('PIERCE')
  const isOvershoot = attacker.keywords.includes('OVERSHOOT')

  if (!defender) {
    // Lane undefended: attack hero directly
    applyDamageToHero(state, enemyFaction, attacker.currentAttack, attackerName)
    return
  }

  // Defender present: both units deal damage simultaneously (one attack each)
  log(state, `⚔️  ${attackerName} (${attacker.currentAttack}/${attacker.currentHealth}) 攻击 ${defender.cardId} (${defender.currentAttack}/${defender.currentHealth})`)

  const attackerDmg = applyDamageToUnit(attacker, defender.currentAttack)
  const defenderDmg = applyDamageToUnit(defender, attacker.currentAttack)

  log(state, `   → ${attackerName} 受到 ${attackerDmg} 伤害 (${attacker.currentHealth}hp), ${defender.cardId} 受到 ${defenderDmg} 伤害 (${defender.currentHealth}hp)`)

  if (isDead(defender)) {
    // PIERCE keyword exception: overkill passes through to hero
    if (isPierce) {
      const overkill = attacker.currentAttack - (defender.currentHealth + defenderDmg)
      if (overkill > 0) {
        log(state, `🗡️  ${attackerName} [穿透] 剩余 ${overkill} 点伤害穿透到英雄`)
        applyDamageToHero(state, enemyFaction, overkill, `${attackerName}[穿透]`)
      }
    }

    // OVERSHOOT keyword exception: fixed X bonus damage to next target
    if (isOvershoot) {
      const cardDef = CARD_MAP.get(attacker.cardId)
      const overshootDmg = cardDef?.overshootValue ?? 1
      log(state, `💫 ${attackerName} [溢伤${overshootDmg}] 对敌方英雄造成固定 ${overshootDmg} 点伤害`)
      applyDamageToHero(state, enemyFaction, overshootDmg, `${attackerName}[溢伤]`)
    }
    // Normal kill: no carry-over damage to hero
  }
}

function removeDeadUnits(state: GameState): void {
  for (const lane of state.lanes) {
    if (lane.humanUnit && isDead(lane.humanUnit)) {
      // Trigger onDeath hook
      const def = CARD_MAP.get(lane.humanUnit.cardId)
      def?.onDeath(state, 'HUMAN', lane.humanUnit.laneIndex)
      log(state, `💀 ${lane.humanUnit.cardId} 死亡`)
      lane.humanUnit = null
    }
    if (lane.nonhumanUnit && isDead(lane.nonhumanUnit)) {
      const def = CARD_MAP.get(lane.nonhumanUnit.cardId)
      def?.onDeath(state, 'NONHUMAN', lane.nonhumanUnit.laneIndex)
      log(state, `💀 ${lane.nonhumanUnit.cardId} 死亡`)
      lane.nonhumanUnit = null
    }
  }
}

export function resolveCombat(state: GameState): GameState {
  log(state, `\n⚔️  ===== 战斗阶段开始 (回合 ${state.turn}) =====`)

  // Step 1: Reveal all ambushed units and trigger onReveal hook
  for (const lane of state.lanes) {
    for (const unit of [lane.humanUnit, lane.nonhumanUnit]) {
      if (unit && unit.isAmbushed) {
        unit.isAmbushed = false
        log(state, `👻 ${unit.cardId} 从潜伏中揭示！`)
        const def = CARD_MAP.get(unit.cardId)
        def?.onReveal(state, unit.ownerId, unit.laneIndex)
      }
    }
  }

  if (state.winner) return state

  // Step 2: Pre-combat SNIPER (Foresight X) — all SNIPER units fire before lane combat
  for (const lane of state.lanes) {
    if (state.winner) break
    for (const unit of [lane.nonhumanUnit, lane.humanUnit]) {
      if (!unit || unit.isAmbushed) continue
      if (unit.keywords.includes('SNIPER')) {
        const def = CARD_MAP.get(unit.cardId)
        const foresightDmg = def?.foresightValue ?? 1
        const enemyFaction: Faction = unit.ownerId === 'HUMAN' ? 'NONHUMAN' : 'HUMAN'
        log(state, `🎯 ${unit.cardId} [神射${foresightDmg}] 战斗前对敌方英雄造成 ${foresightDmg} 点伤害`)
        applyDamageToHero(state, enemyFaction, foresightDmg, `${unit.cardId}[神射]`)
      }
    }
  }

  if (state.winner) return state

  // Step 3: Lane-by-lane combat
  for (const lane of state.lanes) {
    if (state.winner) break
    log(state, `\n--- 道路 ${lane.index} ---`)

    // Nonhuman attacks first
    if (lane.nonhumanUnit && !lane.nonhumanUnit.isAmbushed) {
      resolveUnitAttack(lane.nonhumanUnit, lane, state)
    }

    removeDeadUnits(state)
    if (state.winner) break

    // Human attacks
    if (lane.humanUnit && !lane.humanUnit.isAmbushed) {
      resolveUnitAttack(lane.humanUnit, lane, state)
    }

    removeDeadUnits(state)
  }

  // Step 4: Environment onEndOfTurn hooks
  for (const lane of state.lanes) {
    if (state.winner) break
    if (lane.environment) {
      const env = lane.environment
      env.definition.onEndOfTurn(state, env.definition.faction, lane.index)
    }
  }

  log(state, `\n⚔️  ===== 战斗阶段结束 =====\n`)
  return state
}
