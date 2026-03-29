import type { Keyword, Faction, CardType } from './card.js'
import type { CardBase } from '../cards/CardBase.js'

export type { Keyword, Faction, CardType }

export type StatusTag =
  | { tag: 'ARMOR'; value: number }
  | { tag: 'POISONED' }
  | { tag: 'SILENCED' }

export interface UnitState {
  instanceId: string
  cardId: string
  ownerId: Faction
  currentAttack: number
  currentHealth: number
  maxHealth: number
  keywords: Keyword[]
  isAmbushed: boolean
  statusTags: StatusTag[]
  laneIndex: number
  teamUpSlot: 0 | 1
}

export interface HeroState {
  id: string
  faction: Faction
  name: string
  currentHealth: number
  maxHealth: number
  superpower?: CardBase
}

export type TurnPhase = 'NONHUMAN_PLAY' | 'HUMAN_PLAY' | 'NONHUMAN_TRICK' | 'COMBAT'

export interface CardInstance {
  instanceId: string
  cardId: string
  definition: CardBase
}

export interface LaneState {
  index: number
  humanUnit: UnitState | null
  nonhumanUnit: UnitState | null
  environment: CardInstance | null
  /** AMPHIBIOUS lane — lane 4 */
  isAquatic: boolean
}

export interface GameState {
  phase: TurnPhase
  turn: number
  activePlayer: Faction
  humanHero: HeroState
  nonhumanHero: HeroState
  lanes: LaneState[]
  humanHand: CardInstance[]
  nonhumanHand: CardInstance[]
  humanDeck: CardInstance[]
  nonhumanDeck: CardInstance[]
  humanMana: { current: number; max: number }
  nonhumanMana: { current: number; max: number }
  graveyard: CardInstance[]
  log: string[]
  winner: Faction | null
  /** Pending effect waiting for player to choose a target */
  pendingTargetEffect: PendingTargetEffect | null
  /** Registry of all card instances ever created, keyed by instanceId */
  cardRegistry: Record<string, CardInstance>
}

export interface PendingTargetEffect {
  sourceInstanceId: string
  playerId: Faction
}

/** 游戏配置：决定玩家控制哪个阵营，另一方由 AI 控制；'BOTH' = 单机双人调试模式 */
export interface GameConfig {
  /** 玩家控制的阵营。'BOTH' = 双方均由玩家操控（单机调试） */
  playerFaction: Faction | 'BOTH'
  /** 是否使用测试模式（费用全1，手牌更多） */
  testMode: boolean
}

export type Action =
  | { type: 'PLAY_UNIT'; cardInstanceId: string; laneIndex: number }
  | { type: 'PLAY_SPELL'; cardInstanceId: string; targetInstanceId?: string; targetLane?: number }
  | { type: 'PLAY_ENVIRONMENT'; cardInstanceId: string; laneIndex: number }
  | { type: 'END_PHASE' }
