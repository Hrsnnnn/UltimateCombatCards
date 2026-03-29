import { GameEngine, runAITurn } from '@haunted/core'
import type { GameState, CardInstance, Faction, GameConfig } from '@haunted/core'
import { renderState, renderLog } from './render.js'

const engine = new GameEngine()

let state: GameState
let config: GameConfig
let selectedCard: CardInstance | null = null
let logCount = 0

// ── Hero Selection Screen ─────────────────────────────────────────────────────

function startGame(cfg: GameConfig): void {
  config = cfg
  state = cfg.testMode ? engine.createTestGame() : engine.createGame()
  selectedCard = null
  logCount = 0

  // Hide selection, show game
  const sel = document.getElementById('hero-select')
  const game = document.getElementById('game-area')
  if (sel) sel.style.display = 'none'
  if (game) game.style.display = 'flex'

  refresh()
}

function setupHeroSelect(): void {
  const sel = document.getElementById('hero-select')
  if (!sel) return

  const testToggle = document.getElementById('test-toggle') as HTMLInputElement | null

  // "Play as Human" button
  document.getElementById('btn-play-human')?.addEventListener('click', () => {
    startGame({ playerFaction: 'HUMAN', testMode: testToggle?.checked ?? false })
  })

  // "Play as Nonhuman" button
  document.getElementById('btn-play-nonhuman')?.addEventListener('click', () => {
    startGame({ playerFaction: 'NONHUMAN', testMode: testToggle?.checked ?? false })
  })
}

// ── AI Helpers ────────────────────────────────────────────────────────────────

/** 当前阶段是否由 AI 控制 */
function isAIPhase(): boolean {
  if (!state || !config) return false
  const { playerFaction } = config
  const aiFaction: Faction = playerFaction === 'HUMAN' ? 'NONHUMAN' : 'HUMAN'

  // AI controls NONHUMAN → triggers on NONHUMAN_PLAY / NONHUMAN_TRICK
  // AI controls HUMAN → triggers on HUMAN_PLAY
  if (aiFaction === 'NONHUMAN') {
    return state.phase === 'NONHUMAN_PLAY' || state.phase === 'NONHUMAN_TRICK'
  } else {
    return state.phase === 'HUMAN_PLAY'
  }
}

function maybeRunAI(): void {
  if (!state || !config) return
  if (state.winner) return
  if (!isAIPhase()) return

  const aiFaction: Faction = config.playerFaction === 'HUMAN' ? 'NONHUMAN' : 'HUMAN'

  setTimeout(() => {
    state = runAITurn(state, aiFaction)
    selectedCard = null
    refresh()
  }, 600)
}

// ── Active Player ─────────────────────────────────────────────────────────────

function currentPlayer(): Faction {
  return state.activePlayer
}

// ── Card Interactions ─────────────────────────────────────────────────────────

function onSelectCard(card: CardInstance): void {
  // Toggle selection
  if (selectedCard?.instanceId === card.instanceId) {
    selectedCard = null
    refresh()
    return
  }

  selectedCard = card

  // AoE or no-target spells: cast immediately
  if (card.definition.type === 'SPELL') {
    if (!card.definition.requiresTarget()) {
      state = engine.playCard(state, currentPlayer(), card.instanceId, 0)
      selectedCard = null
      refresh()
      return
    }
    // Needs target: wait for unit click (handled by setupUnitTargetClicks)
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

// ── Render + AI trigger ───────────────────────────────────────────────────────

function refresh(): void {
  renderState(state, selectedCard, config, onSelectCard, onPlayToLane, onEndPhase)
  logCount = renderLog(state.log, logCount)

  // Highlight unit targets when a targeting spell is selected
  setupUnitTargetClicks()

  // If it's the AI's phase, trigger AI automatically
  maybeRunAI()
}

// ── Spell target clicks ───────────────────────────────────────────────────────

function setupUnitTargetClicks(): void {
  if (!selectedCard) return
  if (selectedCard.definition.type !== 'SPELL') return
  if (!selectedCard.definition.requiresTarget()) return

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

// ── Init ──────────────────────────────────────────────────────────────────────

setupHeroSelect()

// Expose for browser console debugging
;(window as any).__engine = engine
;(window as any).__getState = () => state
;(window as any).__getConfig = () => config
