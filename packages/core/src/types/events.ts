import type { Faction } from './card.js'
import type { UnitState } from './state.js'

export type GameEvent =
  | { type: 'GAME_STARTED'; turn: number }
  | { type: 'PHASE_CHANGED'; from: string; to: string }
  | { type: 'CARD_PLAYED'; playerId: Faction; cardId: string; cardName: string; laneIndex?: number }
  | { type: 'UNIT_ATTACKED'; attackerId: string; targetId: string; damage: number }
  | { type: 'HERO_DAMAGED'; faction: Faction; amount: number; source: string }
  | { type: 'UNIT_DIED'; unit: UnitState; cardName: string }
  | { type: 'UNIT_REVEALED'; unit: UnitState; cardName: string }
  | { type: 'HERO_HEALED'; faction: Faction; amount: number }
  | { type: 'CARD_DRAWN'; playerId: Faction; cardName: string }
  | { type: 'MANA_SPENT'; playerId: Faction; amount: number }
  | { type: 'GAME_OVER'; winner: Faction }
