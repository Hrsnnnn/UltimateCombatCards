import { GameEngine } from '@haunted/core'
import type { GameState, CardInstance, Faction } from '@haunted/core'
import { renderState, renderLog } from './render.js'

const engine = new GameEngine()

// 切换测试模式：URL 加 ?test=1 使用费用全1的测试卡组
const isTestMode = new URLSearchParams(window.location.search).get('test') === '1'
let state: GameState = isTestMode ? engine.createTestGame() : engine.createGame()

let selectedCard: CardInstance | null = null
let logCount = 0

// currentPlayer 直接从 state.activePlayer 读，不再手动维护
function currentPlayer(): Faction {
  return state.activePlayer
}

function onSelectCard(card: CardInstance): void {
  // Toggle selection
  if (selectedCard?.instanceId === card.instanceId) {
    selectedCard = null
    refresh()
    return
  }

  selectedCard = card

  // AoE 或无需目标的法术（直接施放）
  if (card.definition.type === 'SPELL') {
    if (!card.definition.requiresTarget()) {
      state = engine.playCard(state, currentPlayer(), card.instanceId, 0)
      selectedCard = null
      refresh()
      return
    }
    // 需要目标的法术：选中后等待点击目标单位（由 setupUnitTargetClicks 处理）
  }

  refresh()
}

function onPlayToLane(laneIndex: number): void {
  if (!selectedCard) return

  const card = selectedCard
  selectedCard = null

  if (card.definition.type === 'UNIT' || card.definition.type === 'ENVIRONMENT') {
    state = engine.playCard(state, currentPlayer(), card.instanceId, laneIndex)
  }

  refresh()
}

function onEndPhase(): void {
  state = engine.endPhase(state, currentPlayer())
  selectedCard = null
  refresh()
}

function refresh(): void {
  renderState(state, selectedCard, onSelectCard, onPlayToLane, onEndPhase)
  logCount = renderLog(state.log, logCount)

  // 选中法术后，高亮可点击的目标单位
  setupUnitTargetClicks()
}

function setupUnitTargetClicks(): void {
  if (!selectedCard) return
  if (selectedCard.definition.type !== 'SPELL') return

  const needsUnitTarget = selectedCard.definition.requiresTarget()

  if (!needsUnitTarget) return

  // 高亮棋盘上所有单位，等待玩家点击目标
  document.querySelectorAll<HTMLElement>('.unit-card').forEach(unitEl => {
    unitEl.style.cursor = 'crosshair'
    unitEl.style.outline = '2px solid #ff4444'
    unitEl.title = '点击选为目标'
    unitEl.addEventListener('click', handleUnitTargetClick, { once: true })
  })
}

function handleUnitTargetClick(e: Event): void {
  if (!selectedCard) return

  const unitEl = e.currentTarget as HTMLElement
  const laneEl = unitEl.closest('.lane') as HTMLElement | null
  if (!laneEl) return

  const lanesContainer = document.getElementById('lanes')!
  const laneEls = Array.from(lanesContainer.children)
  const laneIndex = laneEls.indexOf(laneEl)
  if (laneIndex === -1) return

  // 判断点的是上方（非人类）还是下方（人类）格子
  const slots = laneEl.querySelectorAll('.lane-slot')
  const isNonhumanSlot = slots[0].contains(unitEl)
  const lane = state.lanes[laneIndex]
  const targetUnit = isNonhumanSlot ? lane.nonhumanUnit : lane.humanUnit

  if (!targetUnit) return

  const card = selectedCard
  selectedCard = null

  state = engine.playCard(state, currentPlayer(), card.instanceId, laneIndex, targetUnit.instanceId)
  refresh()
}

// Initial render
refresh()

// Expose for browser console debugging
;(window as any).__engine = engine
;(window as any).__getState = () => state
