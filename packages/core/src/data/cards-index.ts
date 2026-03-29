/**
 * cards-index.ts — 全卡牌注册表
 * 合并所有阵营的卡牌，供引擎构建牌库使用。
 */

import type { CardBase } from '../cards/CardBase.js'
import { HUMAN_CARDS } from './human-cards.js'
import { NONHUMAN_CARDS } from './nonhuman-cards.js'
import { TEST_HUMAN_CARDS, TEST_NONHUMAN_CARDS } from './test-cards.js'

export { HUMAN_CARDS } from './human-cards.js'
export { NONHUMAN_CARDS } from './nonhuman-cards.js'
export { TEST_HUMAN_CARDS, TEST_NONHUMAN_CARDS } from './test-cards.js'

export const ALL_CARDS: CardBase[] = [
  ...HUMAN_CARDS,
  ...NONHUMAN_CARDS,
  ...TEST_HUMAN_CARDS,
  ...TEST_NONHUMAN_CARDS,
]

/** 按 id 查找卡牌定义（包含测试卡） */
export const CARD_MAP = new Map<string, CardBase>(ALL_CARDS.map(c => [c.id, c]))
