/**
 * test-cards.ts — 测试专用卡牌
 *
 * 设计原则：
 * - 费用全部为 1，保证每回合都能出牌
 * - 覆盖所有卡牌类型（单位/法术/环境）
 * - 覆盖所有 demo 关键词（神射/穿透/溢伤/护甲/潜伏）
 * - 不进入正式卡池
 */

import { UnitCard, SpellCard, EnvironmentCard } from '../cards/CardBase.js'
import type { GameState, UnitState } from '../types/state.js'
import type { Faction } from '../types/card.js'
import type { CardBase } from '../cards/CardBase.js'
import { healHero, damageUnit, damageAllEnemyUnits, damageHero, buffUnit, drawCard } from '../cards/effects.js'

// ── 人类测试卡 ────────────────────────────────────────────────────────────────

export class TestHumanBasic extends UnitCard {
  readonly id = 'test_human_basic'; readonly name = '测试兵'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 1; readonly attack = 2; readonly health = 2
  readonly keywords = [] as const; readonly tribes = ['测试']
  readonly description = '2/2 普通单位，无特殊效果。'
}

export class TestHumanSniper extends UnitCard {
  readonly id = 'test_human_sniper'; readonly name = '测试神射'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 1; readonly attack = 1; readonly health = 1
  readonly keywords = ['SNIPER'] as const
  readonly foresightValue = 1
  readonly tribes = ['测试']
  readonly description = '神射1：战斗前对敌方英雄造成1点伤害。'
}

export class TestHumanPierce extends UnitCard {
  readonly id = 'test_human_pierce'; readonly name = '测试穿透'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 1; readonly attack = 3; readonly health = 1
  readonly keywords = ['PIERCE'] as const
  readonly tribes = ['测试']
  readonly description = '穿透：消灭后剩余伤害传到英雄。'
}

export class TestHumanOvershoot extends UnitCard {
  readonly id = 'test_human_overshoot'; readonly name = '测试溢伤'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 1; readonly attack = 2; readonly health = 2
  readonly keywords = ['OVERSHOOT'] as const
  readonly overshootValue = 2
  readonly tribes = ['测试']
  readonly description = '溢伤2：击杀后对后方目标造成2点伤害。'
}

export class TestHumanArmor extends UnitCard {
  readonly id = 'test_human_armor'; readonly name = '测试护甲'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 1; readonly attack = 1; readonly health = 2
  readonly keywords = ['ARMOR'] as const
  readonly armorValue = 3
  readonly tribes = ['测试']
  readonly description = '护甲3：受伤时先消耗护甲。'
}

export class TestHumanAmbush extends UnitCard {
  readonly id = 'test_human_ambush'; readonly name = '测试潜伏'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 1; readonly attack = 2; readonly health = 2
  readonly keywords = ['AMBUSH'] as const
  readonly tribes = ['测试']
  readonly description = '潜伏：放置时隐藏，战斗前揭示。'
}

export class TestHumanHeal extends UnitCard {
  readonly id = 'test_human_heal'; readonly name = '测试治疗兵'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 1; readonly attack = 1; readonly health = 2
  readonly keywords = [] as const; readonly tribes = ['测试']
  readonly description = '登场：治疗己方英雄2点。'
  onPlay(state: GameState, owner: Faction): void { healHero(state, owner, 2) }
}

export class TestHumanSpell extends SpellCard {
  readonly id = 'test_human_spell'; readonly name = '测试法术'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 1; readonly keywords = [] as const; readonly tribes = ['测试']
  readonly description = '对目标单位造成2点伤害。'
  requiresTarget(): boolean { return true }
  onPlay(state: GameState, _owner: Faction, _lane: number, targetUnit?: UnitState): void {
    if (targetUnit) damageUnit(state, targetUnit, 2, this.name)
  }
}

export class TestHumanEnv extends EnvironmentCard {
  readonly id = 'test_human_env'; readonly name = '测试环境'
  readonly faction: Faction = 'HUMAN'
  readonly cost = 1; readonly keywords = [] as const; readonly tribes = ['测试']
  readonly description = '登场：治疗己方英雄1点。'
  onPlay(state: GameState, owner: Faction): void { healHero(state, owner, 1) }
}

// ── 非人类测试卡 ──────────────────────────────────────────────────────────────

export class TestNonhumanBasic extends UnitCard {
  readonly id = 'test_nonhuman_basic'; readonly name = '测试怪'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 1; readonly attack = 2; readonly health = 2
  readonly keywords = [] as const; readonly tribes = ['测试']
  readonly description = '2/2 普通单位，无特殊效果。'
}

export class TestNonhumanSniper extends UnitCard {
  readonly id = 'test_nonhuman_sniper'; readonly name = '测试神射怪'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 1; readonly attack = 1; readonly health = 1
  readonly keywords = ['SNIPER'] as const
  readonly foresightValue = 1
  readonly tribes = ['测试']
  readonly description = '神射1：战斗前对敌方英雄造成1点伤害。'
}

export class TestNonhumanPierce extends UnitCard {
  readonly id = 'test_nonhuman_pierce'; readonly name = '测试穿透怪'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 1; readonly attack = 3; readonly health = 1
  readonly keywords = ['PIERCE'] as const
  readonly tribes = ['测试']
  readonly description = '穿透：消灭后剩余伤害传到英雄。'
}

export class TestNonhumanOvershoot extends UnitCard {
  readonly id = 'test_nonhuman_overshoot'; readonly name = '测试溢伤怪'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 1; readonly attack = 2; readonly health = 2
  readonly keywords = ['OVERSHOOT'] as const
  readonly overshootValue = 2
  readonly tribes = ['测试']
  readonly description = '溢伤2：击杀后对后方目标造成2点伤害。'
}

export class TestNonhumanArmor extends UnitCard {
  readonly id = 'test_nonhuman_armor'; readonly name = '测试护甲怪'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 1; readonly attack = 1; readonly health = 2
  readonly keywords = ['ARMOR'] as const
  readonly armorValue = 3
  readonly tribes = ['测试']
  readonly description = '护甲3：受伤时先消耗护甲。'
}

export class TestNonhumanAmbush extends UnitCard {
  readonly id = 'test_nonhuman_ambush'; readonly name = '测试潜伏怪'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 1; readonly attack = 2; readonly health = 2
  readonly keywords = ['AMBUSH'] as const
  readonly tribes = ['测试']
  readonly description = '潜伏：放置时隐藏，战斗前揭示。'
}

export class TestNonhumanAoe extends UnitCard {
  readonly id = 'test_nonhuman_aoe'; readonly name = '测试AOE怪'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 1; readonly attack = 1; readonly health = 2
  readonly keywords = [] as const; readonly tribes = ['测试']
  readonly description = '登场：对所有敌方单位造成1点伤害。'
  onPlay(state: GameState, owner: Faction): void { damageAllEnemyUnits(state, owner, 1, this.name) }
}

export class TestNonhumanSpell extends SpellCard {
  readonly id = 'test_nonhuman_spell'; readonly name = '测试怪法术'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 1; readonly keywords = [] as const; readonly tribes = ['测试']
  readonly description = '对目标单位造成2点伤害。'
  requiresTarget(): boolean { return true }
  onPlay(state: GameState, _owner: Faction, _lane: number, targetUnit?: UnitState): void {
    if (targetUnit) damageUnit(state, targetUnit, 2, this.name)
  }
}

export class TestNonhumanEnv extends EnvironmentCard {
  readonly id = 'test_nonhuman_env'; readonly name = '测试怪环境'
  readonly faction: Faction = 'NONHUMAN'
  readonly cost = 1; readonly keywords = [] as const; readonly tribes = ['测试']
  readonly description = '每回合结束时对敌方英雄造成1点伤害。'
  onEndOfTurn(state: GameState, owner: Faction): void {
    const enemy: Faction = owner === 'HUMAN' ? 'NONHUMAN' : 'HUMAN'
    damageHero(state, enemy, 1, this.name)
  }
}

// ── 测试卡组 ──────────────────────────────────────────────────────────────────

export const TEST_HUMAN_CARDS: CardBase[] = [
  new TestHumanBasic(), new TestHumanSniper(), new TestHumanPierce(),
  new TestHumanOvershoot(), new TestHumanArmor(), new TestHumanAmbush(),
  new TestHumanHeal(), new TestHumanSpell(), new TestHumanEnv(),
]

export const TEST_NONHUMAN_CARDS: CardBase[] = [
  new TestNonhumanBasic(), new TestNonhumanSniper(), new TestNonhumanPierce(),
  new TestNonhumanOvershoot(), new TestNonhumanArmor(), new TestNonhumanAmbush(),
  new TestNonhumanAoe(), new TestNonhumanSpell(), new TestNonhumanEnv(),
]
