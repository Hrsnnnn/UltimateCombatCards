import type {
  GameState,
  LaneState,
  UnitState,
  CardInstance,
  Action,
  HeroState,
} from '../types/state.js'
import type { Faction } from '../types/card.js'
import type { CardBase } from '../cards/CardBase.js'
import { getNextPhase, canEndPhase, getManaForTurn } from './TurnStateMachine.js'
import { resolveCombat } from '../systems/CombatResolver.js'
import { addArmor } from '../systems/KeywordSystem.js'
import { CARD_MAP, HUMAN_CARDS, NONHUMAN_CARDS, TEST_HUMAN_CARDS, TEST_NONHUMAN_CARDS } from '../data/cards-index.js'
import { HUMAN_HERO, NONHUMAN_HERO } from '../data/demo-heroes.js'

let instanceCounter = 0
function nextId(): string {
  return `inst_${++instanceCounter}`
}

function createCardInstance(card: CardBase): CardInstance {
  return { instanceId: nextId(), cardId: card.id, definition: card }
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildDeck(faction: Faction): CardInstance[] {
  const cards = faction === 'HUMAN' ? HUMAN_CARDS : NONHUMAN_CARDS
  // Two copies of each card
  const deck: CardInstance[] = []
  for (const card of cards) {
    deck.push(createCardInstance(card))
    deck.push(createCardInstance(card))
  }
  return shuffleArray(deck)
}

function dealHand(deck: CardInstance[], count: number): { hand: CardInstance[]; remaining: CardInstance[] } {
  return {
    hand: deck.slice(0, count),
    remaining: deck.slice(count),
  }
}

function createLanes(): LaneState[] {
  return Array.from({ length: 5 }, (_, i) => ({
    index: i,
    humanUnit: null,
    nonhumanUnit: null,
    environment: null,
    isAquatic: i === 4,
  }))
}

function log(state: GameState, msg: string): void {
  state.log.push(msg)
}

/**
 * Deep clone the game state.
 * CardBase instances (definition) are class instances with methods — they must NOT
 * be JSON-cloned. They are immutable singletons, so we keep them by reference.
 * Only the mutable data (heroes, lanes, hands, mana, etc.) is cloned.
 */
function deepClone(state: GameState): GameState {
  // Extract all CardBase definitions, clone the rest, then restore definitions
  const cloned = JSON.parse(JSON.stringify(state, (_key, value) => {
    // Replace CardBase instances with their id so they survive stringify
    if (value && typeof value === 'object' && typeof value.onPlay === 'function') {
      return { __cardId: value.id }
    }
    return value
  })) as GameState

  // Restore CardBase instances from CARD_MAP
  function restoreDefinitions(obj: any): void {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      obj.forEach(restoreDefinitions)
      return
    }
    for (const key of Object.keys(obj)) {
      const val = obj[key]
      if (val && typeof val === 'object' && '__cardId' in val) {
        obj[key] = CARD_MAP.get(val.__cardId) ?? val
      } else {
        restoreDefinitions(val)
      }
    }
  }
  restoreDefinitions(cloned)
  return cloned
}

export class GameEngine {
  createGame(): GameState {
    instanceCounter = 0
    const humanDeck = buildDeck('HUMAN')
    const nonhumanDeck = buildDeck('NONHUMAN')

    const { hand: humanHand, remaining: humanRemaining } = dealHand(humanDeck, 4)
    const { hand: nonhumanHand, remaining: nonhumanRemaining } = dealHand(nonhumanDeck, 4)

    const state: GameState = {
      phase: 'NONHUMAN_PLAY',
      turn: 1,
      activePlayer: 'NONHUMAN',
      humanHero: JSON.parse(JSON.stringify(HUMAN_HERO)) as HeroState,
      nonhumanHero: JSON.parse(JSON.stringify(NONHUMAN_HERO)) as HeroState,
      lanes: createLanes(),
      humanHand,
      nonhumanHand,
      humanDeck: humanRemaining,
      nonhumanDeck: nonhumanRemaining,
      humanMana: { current: 1, max: 1 },
      nonhumanMana: { current: 1, max: 1 },
      graveyard: [],
      log: [],
      winner: null,
      pendingTargetEffect: null,
      cardRegistry: {},
    }

    // Populate registry with all dealt cards
    for (const c of [...humanHand, ...humanRemaining, ...nonhumanHand, ...nonhumanRemaining]) {
      state.cardRegistry[c.instanceId] = c
    }

    log(state, `🎮 游戏开始！回合 1`)
    log(state, `非人类先手，阶段: NONHUMAN_PLAY，费用: 1/1`)
    return state
  }

  /**
   * 测试模式：使用费用全为1的测试卡组，方便每回合都能出牌验证逻辑。
   * 起始费用为 5，手牌 5 张，覆盖所有卡牌类型和关键词。
   */
  createTestGame(): GameState {
    instanceCounter = 0

    const buildTestDeck = (faction: 'HUMAN' | 'NONHUMAN'): CardInstance[] => {
      const cards = faction === 'HUMAN' ? TEST_HUMAN_CARDS : TEST_NONHUMAN_CARDS
      // Three copies of each for a bigger deck
      const deck: CardInstance[] = []
      for (const card of cards) {
        deck.push(createCardInstance(card))
        deck.push(createCardInstance(card))
        deck.push(createCardInstance(card))
      }
      return shuffleArray(deck)
    }

    const humanDeck = buildTestDeck('HUMAN')
    const nonhumanDeck = buildTestDeck('NONHUMAN')

    const { hand: humanHand, remaining: humanRemaining } = dealHand(humanDeck, 5)
    const { hand: nonhumanHand, remaining: nonhumanRemaining } = dealHand(nonhumanDeck, 5)

    const state: GameState = {
      phase: 'NONHUMAN_PLAY',
      turn: 1,
      activePlayer: 'NONHUMAN',
      humanHero: JSON.parse(JSON.stringify(HUMAN_HERO)) as HeroState,
      nonhumanHero: JSON.parse(JSON.stringify(NONHUMAN_HERO)) as HeroState,
      lanes: createLanes(),
      humanHand,
      nonhumanHand,
      humanDeck: humanRemaining,
      nonhumanDeck: nonhumanRemaining,
      humanMana: { current: 5, max: 5 },
      nonhumanMana: { current: 5, max: 5 },
      graveyard: [],
      log: [],
      winner: null,
      pendingTargetEffect: null,
      cardRegistry: {},
    }

    for (const c of [...humanHand, ...humanRemaining, ...nonhumanHand, ...nonhumanRemaining]) {
      state.cardRegistry[c.instanceId] = c
    }

    log(state, `🧪 [测试模式] 游戏开始！费用: 5/5，手牌: 5张`)
    return state
  }

  playCard(
    state: GameState,
    playerId: Faction,
    cardInstanceId: string,
    laneIndex: number,
    targetInstanceId?: string
  ): GameState {
    const s = deepClone(state)

    if (s.winner) return s

    // Validate phase
    const validPhase =
      (playerId === 'HUMAN' && s.phase === 'HUMAN_PLAY') ||
      (playerId === 'NONHUMAN' && (s.phase === 'NONHUMAN_PLAY' || s.phase === 'NONHUMAN_TRICK'))
    if (!validPhase) {
      log(s, `⚠️  现在不是 ${playerId} 的出牌阶段`)
      return s
    }

    const hand = playerId === 'HUMAN' ? s.humanHand : s.nonhumanHand
    const cardIndex = hand.findIndex(c => c.instanceId === cardInstanceId)
    if (cardIndex === -1) {
      log(s, `⚠️  在手牌中找不到卡牌 ${cardInstanceId}`)
      return s
    }

    const card = hand[cardIndex]

    // Validate card type against phase
    // NONHUMAN_PLAY: units + environments only; NONHUMAN_TRICK: spells + environments only
    if (s.phase === 'NONHUMAN_PLAY' && card.definition.type === 'SPELL') {
      log(s, `⚠️  出牌阶段不能打出法术牌（请等待绝招阶段）`)
      return s
    }
    if (s.phase === 'NONHUMAN_TRICK' && card.definition.type === 'UNIT') {
      log(s, `⚠️  绝招阶段不能打出单位牌`)
      return s
    }
    const mana = playerId === 'HUMAN' ? s.humanMana : s.nonhumanMana

    if (mana.current < card.definition.cost) {
      log(s, `⚠️  费用不足：需要 ${card.definition.cost}，当前 ${mana.current}`)
      return s
    }

    // Spend mana
    mana.current -= card.definition.cost
    hand.splice(cardIndex, 1)

    log(s, `🃏 ${playerId === 'HUMAN' ? '人类' : '非人类'} 打出 ${card.definition.name} (费用${card.definition.cost}) 到道路 ${laneIndex}`)

    if (card.definition.type === 'UNIT') {
      this._deployUnit(s, card, playerId, laneIndex, targetInstanceId)
    } else if (card.definition.type === 'SPELL') {
      this._castSpell(s, card, playerId, laneIndex, targetInstanceId)
    } else if (card.definition.type === 'ENVIRONMENT') {
      this._placeEnvironment(s, card, playerId, laneIndex)
    }

    return s
  }

  private _resolveTarget(state: GameState, targetInstanceId?: string): UnitState | undefined {
    if (!targetInstanceId) return undefined
    for (const lane of state.lanes) {
      if (lane.humanUnit?.instanceId === targetInstanceId) return lane.humanUnit
      if (lane.nonhumanUnit?.instanceId === targetInstanceId) return lane.nonhumanUnit
    }
    return undefined
  }

  private _deployUnit(
    state: GameState,
    card: CardInstance,
    owner: Faction,
    laneIndex: number,
    targetInstanceId?: string
  ): void {
    const lane = state.lanes[laneIndex]
    if (!lane) {
      log(state, `⚠️  无效道路 ${laneIndex}`)
      return
    }

    const existingUnit = owner === 'HUMAN' ? lane.humanUnit : lane.nonhumanUnit
    if (existingUnit) {
      log(state, `⚠️  道路 ${laneIndex} 己方已有单位`)
      return
    }

    const def = card.definition
    const unit: UnitState = {
      instanceId: card.instanceId,
      cardId: def.id,
      ownerId: owner,
      currentAttack: def.attack ?? 0,
      currentHealth: def.health ?? 1,
      maxHealth: def.health ?? 1,
      keywords: [...def.keywords] as import('../types/card.js').Keyword[],
      isAmbushed: def.hasKeyword('AMBUSH'),
      statusTags: [],
      laneIndex,
      teamUpSlot: 0,
    }

    // Apply ARMOR keyword as status tag
    if (def.hasKeyword('ARMOR')) {
      const armorVal = def.armorValue ?? 2
      addArmor(unit, armorVal)
      log(state, `🛡️  ${def.name} 获得 护甲${armorVal}`)
    }

    if (owner === 'HUMAN') {
      lane.humanUnit = unit
    } else {
      lane.nonhumanUnit = unit
    }

    if (unit.isAmbushed) {
      log(state, `👻 ${def.name} 进入潜伏状态`)
    }

    // Trigger onPlay hook
    const targetUnit = this._resolveTarget(state, targetInstanceId)
    def.onPlay(state, owner, laneIndex, targetUnit)
  }

  private _castSpell(
    state: GameState,
    card: CardInstance,
    owner: Faction,
    laneIndex: number,
    targetInstanceId?: string
  ): void {
    const targetUnit = this._resolveTarget(state, targetInstanceId)
    card.definition.onPlay(state, owner, laneIndex, targetUnit)
    state.graveyard.push(card)
  }

  private _placeEnvironment(
    state: GameState,
    card: CardInstance,
    owner: Faction,
    laneIndex: number
  ): void {
    const lane = state.lanes[laneIndex]
    if (!lane) return

    lane.environment = card
    card.definition.onPlay(state, owner, laneIndex)
  }

  endPhase(state: GameState, playerId: Faction): GameState {
    const s = deepClone(state)

    if (s.winner) return s

    if (!canEndPhase(s, playerId)) {
      log(s, `⚠️  ${playerId} 现在无法结束阶段（当前: ${s.phase}）`)
      return s
    }

    const { nextPhase, nextActivePlayer } = getNextPhase(s.phase)
    log(s, `\n📍 阶段结束: ${s.phase} → ${nextPhase}`)

    s.phase = nextPhase
    s.activePlayer = nextActivePlayer

    if (nextPhase === 'COMBAT') {
      // Auto-resolve combat
      resolveCombat(s)

      if (!s.winner) {
        // After combat: start next turn
        s.turn += 1
        const newMana = getManaForTurn(s.turn)
        s.humanMana = { current: newMana, max: newMana }
        s.nonhumanMana = { current: newMana, max: newMana }
        s.phase = 'NONHUMAN_PLAY'
        s.activePlayer = 'NONHUMAN'

        // Draw a card for each player
        this._drawCard(s, 'HUMAN')
        this._drawCard(s, 'NONHUMAN')

        log(s, `\n🌅 回合 ${s.turn} 开始，费用: ${newMana}/${newMana}`)
      }
    }

    return s
  }

  private _drawCard(state: GameState, faction: Faction): void {
    const deck = faction === 'HUMAN' ? state.humanDeck : state.nonhumanDeck
    const hand = faction === 'HUMAN' ? state.humanHand : state.nonhumanHand
    if (deck.length === 0) {
      log(state, `⚠️  ${faction} 牌库已空`)
      return
    }
    const card = deck.shift()!
    state.cardRegistry[card.instanceId] = card
    hand.push(card)
    log(state, `🃏 ${faction === 'HUMAN' ? '人类' : '非人类'} 摸牌: ${card.definition.name}`)
  }

  getValidActions(state: GameState, playerId: Faction): Action[] {
    const actions: Action[] = []

    if (state.winner) return actions

    const isMyTurn =
      (playerId === 'HUMAN' && state.phase === 'HUMAN_PLAY') ||
      (playerId === 'NONHUMAN' && (state.phase === 'NONHUMAN_PLAY' || state.phase === 'NONHUMAN_TRICK'))

    if (!isMyTurn) return actions

    const hand = playerId === 'HUMAN' ? state.humanHand : state.nonhumanHand
    const mana = playerId === 'HUMAN' ? state.humanMana : state.nonhumanMana

    for (const card of hand) {
      if (card.definition.cost > mana.current) continue
      const def = card.definition

      // Phase-based type restrictions:
      // NONHUMAN_PLAY: units + environments only (no spells)
      // NONHUMAN_TRICK: spells + environments only (no units)
      if (state.phase === 'NONHUMAN_PLAY' && def.type === 'SPELL') continue
      if (state.phase === 'NONHUMAN_TRICK' && def.type === 'UNIT') continue

      if (def.type === 'UNIT') {
        for (let i = 0; i < 5; i++) {
          const lane = state.lanes[i]
          const occupied = playerId === 'HUMAN' ? lane.humanUnit : lane.nonhumanUnit
          if (!occupied) {
            actions.push({ type: 'PLAY_UNIT', cardInstanceId: card.instanceId, laneIndex: i })
          }
        }
      } else if (def.type === 'SPELL') {
        if (def.requiresTarget()) {
          // List all valid unit targets
          for (const lane of state.lanes) {
            const units = [lane.humanUnit, lane.nonhumanUnit].filter(Boolean) as UnitState[]
            for (const unit of units) {
              actions.push({ type: 'PLAY_SPELL', cardInstanceId: card.instanceId, targetInstanceId: unit.instanceId })
            }
          }
        } else {
          actions.push({ type: 'PLAY_SPELL', cardInstanceId: card.instanceId })
        }
      } else if (def.type === 'ENVIRONMENT') {
        // 环境卡可放置到任意道路（新环境替换旧环境）
        for (let i = 0; i < 5; i++) {
          actions.push({ type: 'PLAY_ENVIRONMENT', cardInstanceId: card.instanceId, laneIndex: i })
        }
      }
    }

    actions.push({ type: 'END_PHASE' })
    return actions
  }
}
