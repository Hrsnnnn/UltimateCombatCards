/**
 * human-cards.ts — 人类方卡牌定义
 * 每张卡一个 class，继承 UnitCard / SpellCard / EnvironmentCard。
 * 复杂效果直接复写 onPlay / onDeath / onReveal / onEndOfTurn。
 */

import { UnitCard, SpellCard, EnvironmentCard } from '../cards/CardBase.js'
import type { GameState, UnitState } from '../types/state.js'
import type { Faction } from '../types/card.js'
import {
  healHero, damageUnit, buffUnit, buffAllFriendly, drawCard, bounceUnit, destroyUnit, log,
} from '../cards/effects.js'

// ── 单位卡 ────────────────────────────────────────────────────────────────────

export class QiJiguang extends UnitCard {
  readonly id = 'qi_jiguang'; readonly name = '戚继光'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 3; readonly attack = 2; readonly health = 3
  readonly keywords = ['SNIPER'] as const
  readonly foresightValue = 2
  readonly tribes = ['将领']
  readonly description = '神射2：战斗开始前对敌方英雄造成2点伤害，之后正常参与战斗。'
}

export class LiBai extends UnitCard {
  readonly id = 'li_bai'; readonly name = '李白'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 4; readonly attack = 4; readonly health = 2
  readonly keywords = ['PIERCE'] as const
  readonly tribes = ['诗人']
  readonly description = '穿透：消灭对面单位后，剩余伤害传到英雄。'
}

export class XiangYu extends UnitCard {
  readonly id = 'xiang_yu'; readonly name = '项羽'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 5; readonly attack = 5; readonly health = 4
  readonly keywords = ['OVERSHOOT'] as const
  readonly overshootValue = 3
  readonly tribes = ['英雄']
  readonly description = '溢伤3：击杀对面单位后，对该道路后方下一目标造成固定3点伤害。'
}

export class Terracotta extends UnitCard {
  readonly id = 'terracotta'; readonly name = '秦始皇兵马俑'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 2; readonly attack = 3; readonly health = 3
  readonly keywords = ['ARMOR'] as const
  readonly armorValue = 2
  readonly tribes = ['傀儡']
  readonly description = '护甲2：每次受到伤害时先消耗2点护甲。'
}

export class JingKe extends UnitCard {
  readonly id = 'jing_ke'; readonly name = '荆轲'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 2; readonly attack = 2; readonly health = 2
  readonly keywords = ['AMBUSH'] as const
  readonly tribes = ['刺客']
  readonly description = '潜伏：放置时隐藏，战斗前揭示。'
}

export class YueFei extends UnitCard {
  readonly id = 'yue_fei'; readonly name = '岳飞'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 4; readonly attack = 4; readonly health = 3
  readonly keywords = [] as const
  readonly tribes = ['将领']
  readonly description = '强力战士，无特殊关键词。'
}

export class HuaTuo extends UnitCard {
  readonly id = 'hua_tuo'; readonly name = '华佗'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 2; readonly attack = 2; readonly health = 4
  readonly keywords = [] as const
  readonly tribes = ['医者']
  readonly description = '登场：治疗己方英雄3点生命。'

  onPlay(state: GameState, owner: Faction): void {
    healHero(state, owner, 3)
  }
}

// ── 法术卡 ────────────────────────────────────────────────────────────────────

export class ArtOfWar extends SpellCard {
  readonly id = 'art_of_war'; readonly name = '孙子兵法'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 2
  readonly keywords = [] as const
  readonly tribes = []
  readonly description = '对目标单位造成3点伤害。'

  requiresTarget(): boolean { return true }

  onPlay(state: GameState, _owner: Faction, _lane: number, targetUnit?: UnitState): void {
    if (targetUnit) damageUnit(state, targetUnit, 3, this.name)
  }
}

export class MilitaryRations extends SpellCard {
  readonly id = 'military_rations'; readonly name = '军粮'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 1
  readonly keywords = [] as const
  readonly tribes = []
  readonly description = '给己方一个单位+2攻击。'

  requiresTarget(): boolean { return true }

  onPlay(state: GameState, owner: Faction, _lane: number, targetUnit?: UnitState): void {
    if (targetUnit && targetUnit.ownerId === owner) buffUnit(state, targetUnit, 2, 0, this.name)
  }
}

// ── 环境卡 ────────────────────────────────────────────────────────────────────

export class GreatWall extends EnvironmentCard {
  readonly id = 'great_wall'; readonly name = '长城'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 3
  readonly keywords = [] as const
  readonly tribes = []
  readonly description = '登场：所有己方单位+0/+2。'

  onPlay(state: GameState, owner: Faction): void {
    buffAllFriendly(state, owner, 0, 2, this.name)
  }
}

// ── 注册表 ────────────────────────────────────────────────────────────────────

import type { CardBase } from '../cards/CardBase.js'

export const HUMAN_CARDS: CardBase[] = [
  new QiJiguang(), new LiBai(), new XiangYu(), new Terracotta(),
  new JingKe(), new YueFei(), new HuaTuo(),
  new ArtOfWar(), new MilitaryRations(),
  new GreatWall(),
]
