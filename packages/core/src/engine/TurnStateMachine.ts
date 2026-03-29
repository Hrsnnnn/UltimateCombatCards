import type { GameState, TurnPhase, Faction } from '../types/state.js'

export type PhaseTransition = {
  nextPhase: TurnPhase
  nextActivePlayer: Faction
}

/**
 * Phase order:
 * NONHUMAN_PLAY → HUMAN_PLAY → NONHUMAN_TRICK → COMBAT → (next turn) NONHUMAN_PLAY
 */
export function getNextPhase(currentPhase: TurnPhase): PhaseTransition {
  switch (currentPhase) {
    case 'NONHUMAN_PLAY':
      return { nextPhase: 'HUMAN_PLAY', nextActivePlayer: 'HUMAN' }
    case 'HUMAN_PLAY':
      return { nextPhase: 'NONHUMAN_TRICK', nextActivePlayer: 'NONHUMAN' }
    case 'NONHUMAN_TRICK':
      return { nextPhase: 'COMBAT', nextActivePlayer: 'NONHUMAN' }
    case 'COMBAT':
      return { nextPhase: 'NONHUMAN_PLAY', nextActivePlayer: 'NONHUMAN' }
  }
}

export function canEndPhase(state: GameState, playerId: Faction): boolean {
  switch (state.phase) {
    case 'NONHUMAN_PLAY':
      return playerId === 'NONHUMAN'
    case 'HUMAN_PLAY':
      return playerId === 'HUMAN'
    case 'NONHUMAN_TRICK':
      return playerId === 'NONHUMAN'
    case 'COMBAT':
      return false // Combat resolves automatically
  }
}

export function getManaForTurn(turn: number): number {
  return Math.min(turn, 10)
}
