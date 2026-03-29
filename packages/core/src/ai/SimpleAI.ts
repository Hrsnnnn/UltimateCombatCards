/**
 * SimpleAI.ts — 贪心 AI，控制非人类方
 *
 * 决策策略（按优先级）：
 * 1. NONHUMAN_PLAY 阶段：把费用最高的单位打到最优道路（优先无敌方单位的道路）
 * 2. NONHUMAN_TRICK 阶段：把费用最高的法术打出（优先打攻击力最高的敌方单位）
 * 3. 费用耗尽或没有合法出牌 → 结束阶段
 *
 * 所有决策过程写入 state.log，方便调试。
 */

import type { GameState, Action, UnitState, CardInstance } from '../types/state.js'
import type { Faction } from '../types/card.js'
import { GameEngine } from '../engine/GameEngine.js'

const engine = new GameEngine()

function aiLog(state: GameState, msg: string): void {
  state.log.push(`🤖 [AI] ${msg}`)
}

/**
 * 选择最优出牌道路：
 * - 优先选对面没有单位的道路（直接打英雄）
 * - 其次选对面有单位但己方没有的道路
 * - 最后随机选一个空道路
 */
function chooseBestLane(state: GameState, laneIndices: number[]): number {
  // 优先：对面没有单位（直接打英雄）
  const openLanes = laneIndices.filter(i => state.lanes[i].humanUnit === null)
  if (openLanes.length > 0) {
    return openLanes[0]
  }
  return laneIndices[0]
}

/**
 * 选择最优法术目标：攻击力最高的敌方单位
 */
function chooseBestTarget(state: GameState): UnitState | undefined {
  const targets: UnitState[] = []
  for (const lane of state.lanes) {
    if (lane.humanUnit) targets.push(lane.humanUnit)
  }
  if (targets.length === 0) return undefined
  return targets.sort((a, b) => b.currentAttack - a.currentAttack)[0]
}

/**
 * 从合法行动中选出 AI 要执行的单个行动。
 * 返回 null 表示结束阶段。
 */
function pickAction(state: GameState): Action | null {
  const actions = engine.getValidActions(state, 'NONHUMAN')
  const playActions = actions.filter(a => a.type !== 'END_PHASE')

  if (playActions.length === 0) {
    aiLog(state, '没有可出的牌 → 结束阶段')
    return null
  }

  // 按费用从高到低排序手牌
  const hand = state.nonhumanHand
  const sortedHand = [...hand].sort(
    (a, b) => b.definition.cost - a.definition.cost
  )

  if (state.phase === 'NONHUMAN_PLAY') {
    // 出费用最高的单位/环境
    for (const card of sortedHand) {
      if (card.definition.type === 'UNIT') {
        const unitActions = playActions.filter(
          a => a.type === 'PLAY_UNIT' && a.cardInstanceId === card.instanceId
        ) as Extract<Action, { type: 'PLAY_UNIT' }>[]

        if (unitActions.length > 0) {
          const laneIndex = chooseBestLane(state, unitActions.map(a => a.laneIndex))
          aiLog(state, `出牌阶段 → 打出「${card.definition.name}」(费用${card.definition.cost}) 到道路${laneIndex}`)
          const lane = state.lanes[laneIndex]
          const reason = lane.humanUnit
            ? `对面有「${lane.humanUnit.cardId}」，阻挡`
            : `对面空道路，直接攻英雄`
          aiLog(state, `  理由：${reason}`)
          return { type: 'PLAY_UNIT', cardInstanceId: card.instanceId, laneIndex }
        }
      }

      if (card.definition.type === 'ENVIRONMENT') {
        const envActions = playActions.filter(
          a => a.type === 'PLAY_ENVIRONMENT' && a.cardInstanceId === card.instanceId
        ) as Extract<Action, { type: 'PLAY_ENVIRONMENT' }>[]

        if (envActions.length > 0) {
          const laneIndex = envActions[0].laneIndex
          aiLog(state, `出牌阶段 → 打出环境「${card.definition.name}」到道路${laneIndex}`)
          return { type: 'PLAY_ENVIRONMENT', cardInstanceId: card.instanceId, laneIndex }
        }
      }
    }

    aiLog(state, '出牌阶段没有可打的单位/环境 → 结束阶段')
    return null
  }

  if (state.phase === 'NONHUMAN_TRICK') {
    // 出费用最高的法术
    for (const card of sortedHand) {
      if (card.definition.type !== 'SPELL') continue

      if (card.definition.requiresTarget()) {
        const target = chooseBestTarget(state)
        if (!target) {
          aiLog(state, `法术「${card.definition.name}」需要目标，但场上没有敌方单位，跳过`)
          continue
        }
        aiLog(state, `绝招阶段 → 施放「${card.definition.name}」(费用${card.definition.cost}) 目标：「${target.cardId}」(${target.currentAttack}/${target.currentHealth})`)
        aiLog(state, `  理由：目标攻击力最高，优先消灭`)
        return { type: 'PLAY_SPELL', cardInstanceId: card.instanceId, targetInstanceId: target.instanceId }
      } else {
        aiLog(state, `绝招阶段 → 施放「${card.definition.name}」(费用${card.definition.cost})（无目标法术）`)
        return { type: 'PLAY_SPELL', cardInstanceId: card.instanceId }
      }
    }

    aiLog(state, '绝招阶段没有可打的法术 → 结束阶段')
    return null
  }

  return null
}

/**
 * 执行 AI 的完整回合（持续出牌直到无牌可出或费用不足）。
 * 返回执行完所有行动后的新 GameState。
 */
export function runAITurn(state: GameState): GameState {
  let s = state
  const phase = s.phase

  aiLog(s, `===== AI 回合开始（阶段: ${phase}，费用: ${s.nonhumanMana.current}/${s.nonhumanMana.max}）=====`)
  aiLog(s, `手牌: ${s.nonhumanHand.map(c => `${c.definition.name}(${c.definition.cost}费)`).join(' | ')}`)

  let maxActions = 20 // 防止死循环
  while (maxActions-- > 0) {
    if (s.winner) break
    if (s.phase !== phase) break // 阶段已切换（不应发生，保险用）

    const action = pickAction(s)

    if (action === null) {
      // 结束阶段
      s = engine.endPhase(s, 'NONHUMAN')
      break
    }

    // 执行行动
    if (action.type === 'PLAY_UNIT') {
      s = engine.playCard(s, 'NONHUMAN', action.cardInstanceId, action.laneIndex)
    } else if (action.type === 'PLAY_SPELL') {
      s = engine.playCard(s, 'NONHUMAN', action.cardInstanceId, 0, action.targetInstanceId)
    } else if (action.type === 'PLAY_ENVIRONMENT') {
      s = engine.playCard(s, 'NONHUMAN', action.cardInstanceId, action.laneIndex)
    }
  }

  aiLog(s, `===== AI 回合结束 =====`)
  return s
}
