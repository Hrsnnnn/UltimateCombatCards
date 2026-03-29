/**
 * nonhuman-cards.ts — 非人类方卡牌定义
 */

import { UnitCard, SpellCard, EnvironmentCard } from '../cards/CardBase.js'
import type { GameState, UnitState } from '../types/state.js'
import type { Faction } from '../types/card.js'
import {
  damageAllEnemyUnits, damageUnit, destroyUnit, bounceUnit, drawCard, damageHero, log,
} from '../cards/effects.js'

// ── 单位卡 ────────────────────────────────────────────────────────────────────

export class BaiGuJing extends UnitCard {
  readonly id = 'bai_gu_jing'; readonly name = '白骨精'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 3; readonly attack = 2; readonly health = 3
  readonly keywords = ['SNIPER'] as const
  readonly foresightValue = 2
  readonly tribes = ['妖精']
  readonly description = '神射2：战斗开始前对敌方英雄造成2点伤害，之后正常参与战斗。'
}

export class SunWukong extends UnitCard {
  readonly id = 'sun_wukong'; readonly name = '孙悟空'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 5; readonly attack = 5; readonly health = 4
  readonly keywords = ['PIERCE'] as const
  readonly tribes = ['神仙']
  readonly description = '穿透：消灭后剩余伤害穿透到英雄。'
}

export class LishanLaomu extends UnitCard {
  readonly id = 'lishan_laomu'; readonly name = '骊山老母'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 2; readonly attack = 3; readonly health = 3
  readonly keywords = ['ARMOR'] as const
  readonly armorValue = 2
  readonly tribes = ['神仙']
  readonly description = '护甲2：每次受到伤害时先消耗2点护甲。'
}

export class NieXiaoqian extends UnitCard {
  readonly id = 'nie_xiaoqian'; readonly name = '聂小倩'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 2; readonly attack = 2; readonly health = 2
  readonly keywords = ['AMBUSH'] as const
  readonly tribes = ['鬼魂']
  readonly description = '潜伏，揭示：摸1张牌。'

  onReveal(state: GameState, owner: Faction): void {
    drawCard(state, owner, 1)
  }
}

export class NiuMowang extends UnitCard {
  readonly id = 'niu_mowang'; readonly name = '牛魔王'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 4; readonly attack = 4; readonly health = 4
  readonly keywords = ['OVERSHOOT'] as const
  readonly overshootValue = 2
  readonly tribes = ['妖王']
  readonly description = '溢伤2：击杀对面单位后，对该道路后方下一目标造成固定2点伤害。'
}

export class Nezha extends UnitCard {
  readonly id = 'nezha'; readonly name = '哪吒'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 3; readonly attack = 3; readonly health = 3
  readonly keywords = [] as const
  readonly tribes = ['神仙']
  readonly description = '登场：对所有敌方单位造成1点伤害。'

  onPlay(state: GameState, owner: Faction): void {
    damageAllEnemyUnits(state, owner, 1, this.name)
  }
}

export class TaishangLaojun extends UnitCard {
  readonly id = 'taishang_laojun'; readonly name = '太上老君'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 2; readonly attack = 2; readonly health = 2
  readonly keywords = [] as const
  readonly tribes = ['神仙']
  readonly description = '登场：消灭一个有护甲的单位。'

  requiresTarget(): boolean { return true }

  onPlay(state: GameState, _owner: Faction, _lane: number, targetUnit?: UnitState): void {
    if (targetUnit) {
      const hasArmor = targetUnit.statusTags.some(t => t.tag === 'ARMOR')
      if (hasArmor) destroyUnit(state, targetUnit, this.name)
      else log(state, `⚠️  太上老君：目标没有护甲，无效`)
    }
  }
}

// ── 法术卡 ────────────────────────────────────────────────────────────────────

export class ThunderSpell extends SpellCard {
  readonly id = 'thunder_spell'; readonly name = '雷法'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 2
  readonly keywords = [] as const
  readonly tribes = []
  readonly description = '对目标单位造成2点伤害。'

  requiresTarget(): boolean { return true }

  onPlay(state: GameState, _owner: Faction, _lane: number, targetUnit?: UnitState): void {
    if (targetUnit) damageUnit(state, targetUnit, 2, this.name)
  }
}

export class SealSpell extends SpellCard {
  readonly id = 'seal_spell'; readonly name = '封印'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 2
  readonly keywords = [] as const
  readonly tribes = []
  readonly description = '将目标单位弹回其主人手牌。'

  requiresTarget(): boolean { return true }

  onPlay(state: GameState, _owner: Faction, _lane: number, targetUnit?: UnitState): void {
    if (targetUnit) bounceUnit(state, targetUnit)
  }
}

// ── 环境卡 ────────────────────────────────────────────────────────────────────

export class Underworld extends EnvironmentCard {
  readonly id = 'underworld'; readonly name = '阴司'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 3
  readonly keywords = [] as const
  readonly tribes = []
  readonly description = '每回合结束时，对敌方英雄造成1点伤害。'

  onEndOfTurn(state: GameState, owner: Faction, _lane: number): void {
    const enemy: Faction = owner === 'HUMAN' ? 'NONHUMAN' : 'HUMAN'
    damageHero(state, enemy, 1, this.name)
  }
}

// ── 注册表 ────────────────────────────────────────────────────────────────────

import type { CardBase } from '../cards/CardBase.js'

export const NONHUMAN_CARDS: CardBase[] = [
  new BaiGuJing(), new SunWukong(), new LishanLaomu(), new NieXiaoqian(),
  new NiuMowang(), new Nezha(), new TaishangLaojun(),
  new ThunderSpell(), new SealSpell(),
  new Underworld(),
]
