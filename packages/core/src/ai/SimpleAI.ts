/**
 * SimpleAI.ts — 贪心 AI，支持控制任意阵营
 *
 * 决策策略（按优先级）：
 * 1. PLAY 阶段：把费用最高的单位打到最优道路（优先无敌方单位的道路）
 * 2. TRICK 阶段：把费用最高的法术打出（优先打攻击力最高的敌方单位）
 * 3. 费用耗尽或没有合法出牌 → 结束阶段
 *
 * 所有决策过程写入 state.log，方便调试。
 */

import type { GameState, Action, UnitState } from '../types/state.js'
import type { Faction } from '../types/card.js'
import { GameEngine } from '../engine/GameEngine.js'

const engine = new GameEngine()

function aiLog(state: GameState, faction: Faction, msg: string): void {
  const tag = faction === 'HUMAN' ? '🤖 [AI·人类]' : '🤖 [AI·非人类]'
  state.log.push(`${tag} ${msg}`)
}

/**
 * 选择最优出牌道路：
 * - 优先选对面没有单位的道路（可直接攻英雄）
 * - 其次选有敌方单位的道路（阻挡或清场）
 */
function chooseBestLane(state: GameState, faction: Faction, laneIndices: number[]): number {
  const enemyUnitKey = faction === 'HUMAN' ? 'nonhumanUnit' : 'humanUnit'
  // 优先：对面没有单位
  const openLanes = laneIndices.filter(i => state.lanes[i][enemyUnitKey] === null)
  if (openLanes.length > 0) return openLanes[0]
  return laneIndices[0]
}

/**
 * 选择最优法术目标：攻击力最高的敌方单位
 */
function chooseBestTarget(state: GameState, faction: Faction): UnitState | undefined {
  const enemyUnitKey = faction === 'HUMAN' ? 'nonhumanUnit' : 'humanUnit'
  const targets: UnitState[] = []
  for (const lane of state.lanes) {
    const unit = lane[enemyUnitKey]
    if (unit) targets.push(unit)
  }
  if (targets.length === 0) return undefined
  return targets.sort((a, b) => b.currentAttack - a.currentAttack)[0]
}

/**
 * 从合法行动中选出 AI 要执行的单个行动。
 * 返回 null 表示结束阶段。
 */
function pickAction(state: GameState, faction: Faction): Action | null {
  const actions = engine.getValidActions(state, faction)
  const playActions = actions.filter(a => a.type !== 'END_PHASE')

  if (playActions.length === 0) {
    aiLog(state, faction, '没有可出的牌 → 结束阶段')
    return null
  }

  const hand = faction === 'HUMAN' ? state.humanHand : state.nonhumanHand
  // 按费用从高到低排序
  const sortedHand = [...hand].sort((a, b) => b.definition.cost - a.definition.cost)

  const isPlayPhase =
    (faction === 'NONHUMAN' && state.phase === 'NONHUMAN_PLAY') ||
    (faction === 'HUMAN' && state.phase === 'HUMAN_PLAY')

  const isTrickPhase =
    (faction === 'NONHUMAN' && state.phase === 'NONHUMAN_TRICK')

  if (isPlayPhase) {
    // 出费用最高的单位或环境
    for (const card of sortedHand) {
      if (card.definition.type === 'UNIT') {
        const unitActions = playActions.filter(
          a => a.type === 'PLAY_UNIT' && a.cardInstanceId === card.instanceId
        ) as Extract<Action, { type: 'PLAY_UNIT' }>[]

        if (unitActions.length > 0) {
          const laneIndex = chooseBestLane(state, faction, unitActions.map(a => a.laneIndex))
          const lane = state.lanes[laneIndex]
          const enemyUnit = faction === 'HUMAN' ? lane.nonhumanUnit : lane.humanUnit
          const reason = enemyUnit
            ? `对面有「${enemyUnit.cardId}」(${enemyUnit.currentAttack}/${enemyUnit.currentHealth})，阻挡/清场`
            : `对面空道路，可直接攻英雄`
          aiLog(state, faction, `出牌 → 「${card.definition.name}」(费用${card.definition.cost}) 到道路${laneIndex}`)
          aiLog(state, faction, `  理由：${reason}`)
          return { type: 'PLAY_UNIT', cardInstanceId: card.instanceId, laneIndex }
        }
      }

      if (card.definition.type === 'ENVIRONMENT') {
        const envActions = playActions.filter(
          a => a.type === 'PLAY_ENVIRONMENT' && a.cardInstanceId === card.instanceId
        ) as Extract<Action, { type: 'PLAY_ENVIRONMENT' }>[]

        if (envActions.length > 0) {
          const laneIndex = envActions[0].laneIndex
          aiLog(state, faction, `出环境 → 「${card.definition.name}」到道路${laneIndex}`)
          return { type: 'PLAY_ENVIRONMENT', cardInstanceId: card.instanceId, laneIndex }
        }
      }
    }

    aiLog(state, faction, '出牌阶段无可打的单位/环境 → 结束阶段')
    return null
  }

  if (isTrickPhase || (faction === 'HUMAN' && state.phase === 'HUMAN_PLAY')) {
    // 人类出牌阶段也可以出法术；非人类 TRICK 阶段只出法术
    for (const card of sortedHand) {
      if (card.definition.type !== 'SPELL') continue

      if (card.definition.requiresTarget()) {
        const target = chooseBestTarget(state, faction)
        if (!target) {
          aiLog(state, faction, `「${card.definition.name}」需要目标，场上无敌方单位，跳过`)
          continue
        }
        aiLog(state, faction, `施法 → 「${card.definition.name}」(费用${card.definition.cost}) 目标：「${target.cardId}」(${target.currentAttack}/${target.currentHealth})`)
        aiLog(state, faction, `  理由：目标攻击力最高，优先消灭`)
        return { type: 'PLAY_SPELL', cardInstanceId: card.instanceId, targetInstanceId: target.instanceId }
      } else {
        aiLog(state, faction, `施法 → 「${card.definition.name}」(费用${card.definition.cost})（无目标）`)
        return { type: 'PLAY_SPELL', cardInstanceId: card.instanceId }
      }
    }

    aiLog(state, faction, '无可打的法术 → 结束阶段')
    return null
  }

  return null
}

/**
 * 执行指定阵营 AI 的完整回合（持续出牌直到无牌可出或费用不足）。
 * 返回执行完所有行动后的新 GameState。
 */
export function runAITurn(state: GameState, faction: Faction): GameState {
  let s = state
  const phase = s.phase
  const mana = faction === 'HUMAN' ? s.humanMana : s.nonhumanMana
  const hand = faction === 'HUMAN' ? s.humanHand : s.nonhumanHand

  aiLog(s, faction, `===== AI 回合开始（阶段: ${phase}，费用: ${mana.current}/${mana.max}）=====`)
  aiLog(s, faction, `手牌: ${hand.map(c => `${c.definition.name}(${c.definition.cost}费)`).join(' | ') || '（空）'}`)

  let maxActions = 20 // 防止死循环
  while (maxActions-- > 0) {
    if (s.winner) break
    if (s.phase !== phase) break

    const action = pickAction(s, faction)

    if (action === null) {
      s = engine.endPhase(s, faction)
      break
    }

    if (action.type === 'PLAY_UNIT') {
      s = engine.playCard(s, faction, action.cardInstanceId, action.laneIndex)
    } else if (action.type === 'PLAY_SPELL') {
      s = engine.playCard(s, faction, action.cardInstanceId, 0, action.targetInstanceId)
    } else if (action.type === 'PLAY_ENVIRONMENT') {
      s = engine.playCard(s, faction, action.cardInstanceId, action.laneIndex)
    }
  }

  aiLog(s, faction, `===== AI 回合结束 =====`)
  return s
}
