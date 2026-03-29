import type { UnitState, GameState, StatusTag, LaneState } from '../types/state.js'
import type { Keyword } from '../types/card.js'

/**
 * Apply keyword-derived status tags when a unit enters play.
 */
export function applyKeywordsOnPlay(unit: UnitState, cardKeywords: Keyword[]): void {
  // ARMOR keyword adds a status tag based on card definition value
  // This is handled separately via EffectDefinition — keywords list just marks the unit
  unit.keywords = [...cardKeywords]
}

export function getArmorValue(unit: UnitState): number {
  const tag = unit.statusTags.find((t): t is StatusTag & { tag: 'ARMOR'; value: number } => t.tag === 'ARMOR')
  return tag ? tag.value : 0
}

export function addArmor(unit: UnitState, value: number): void {
  const existing = unit.statusTags.find((t): t is StatusTag & { tag: 'ARMOR'; value: number } => t.tag === 'ARMOR')
  if (existing) {
    existing.value += value
  } else {
    unit.statusTags.push({ tag: 'ARMOR', value })
  }
}

export function hasKeyword(unit: UnitState, keyword: Keyword): boolean {
  return unit.keywords.includes(keyword)
}
