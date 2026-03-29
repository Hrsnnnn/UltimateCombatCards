import type { HeroState } from '../types/state.js'

export const HUMAN_HERO: HeroState = {
  id: 'alexander',
  faction: 'HUMAN',
  name: '亚历山大大帝',
  currentHealth: 20,
  maxHealth: 20,
}

export const NONHUMAN_HERO: HeroState = {
  id: 'jade_emperor',
  faction: 'NONHUMAN',
  name: '玉皇大帝',
  currentHealth: 20,
  maxHealth: 20,
}
