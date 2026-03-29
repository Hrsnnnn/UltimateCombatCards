/**
 * card.ts — 卡牌基础类型
 * CardDefinition 已由 CardBase 类替代，此处只保留引擎和 UI 共用的枚举类型。
 */

export type Keyword =
  | 'SNIPER'       // 神射 (Foresight X)
  | 'PIERCE'       // 穿透 (Strikethrough)
  | 'OVERSHOOT'    // 溢伤 (Overshoot X)
  | 'ARMOR'        // 护甲 (Armored X)
  | 'AMBUSH'       // 潜伏 (Gravestone)
  | 'TEAM_UP'      // 协作 (Team-Up)
  | 'AMPHIBIOUS'   // 两栖 (Amphibious)

export type CardType = 'UNIT' | 'SPELL' | 'ENVIRONMENT' | 'SUPERPOWER'

export type Faction = 'HUMAN' | 'NONHUMAN'
