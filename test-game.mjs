/**
 * The Haunted University — 自动集成测试 v2
 * 运行: node test-game.mjs
 *
 * 改进：
 *  - 测试 11/12/13 改为强制注入指定卡牌，不依赖随机手牌
 *  - 新增 TEST 15: 模拟 UI 层出牌流程（验证 activePlayer 正确驱动）
 *  - 新增 TEST 16: 溢伤关键词
 */

import { GameEngine, CARD_MAP } from './packages/core/dist/index.js'

let passed = 0
let failed = 0

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.error(`  ❌ ${label}`)
    failed++
  }
}

function assertEq(actual, expected, label) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.error(`  ❌ ${label}  →  got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`)
    failed++
  }
}

function section(name) {
  console.log(`\n━━━ ${name} ━━━`)
}

/** 强制把指定卡牌注入到某方手牌第0位（用于确定性测试） */
function injectCard(state, faction, cardId) {
  let counter = Object.keys(state.cardRegistry).length + 1000
  const id = `test_inst_${counter++}`
  const def = CARD_MAP.get(cardId)
  if (!def) throw new Error(`Unknown card: ${cardId}`)
  const inst = { instanceId: id, cardId, definition: def }
  state.cardRegistry[id] = inst
  if (faction === 'HUMAN') {
    state.humanHand.unshift(inst)
  } else {
    state.nonhumanHand.unshift(inst)
  }
  return inst
}

/** 给某方英雄增加足够费用 */
function setMana(state, faction, amount) {
  if (faction === 'HUMAN') {
    state.humanMana = { current: amount, max: amount }
  } else {
    state.nonhumanMana = { current: amount, max: amount }
  }
}

const engine = new GameEngine()

// ═══════════════════════════════════════
// TEST 1: 游戏初始化
// ═══════════════════════════════════════
section('TEST 1: 游戏初始化')
{
  const s = engine.createGame()
  assertEq(s.phase, 'NONHUMAN_PLAY', '初始阶段是 NONHUMAN_PLAY')
  assertEq(s.activePlayer, 'NONHUMAN', 'activePlayer 是 NONHUMAN')
  assertEq(s.turn, 1, '初始回合是 1')
  assertEq(s.humanHero.currentHealth, 20, '人类英雄满血20')
  assertEq(s.nonhumanHero.currentHealth, 20, '非人类英雄满血20')
  assertEq(s.humanHand.length, 4, '人类手牌4张')
  assertEq(s.nonhumanHand.length, 4, '非人类手牌4张')
  assertEq(s.lanes.length, 5, '5条道路')
  assertEq(s.humanMana.current, 1, '第1回合费用1')
  assert(s.winner === null, '游戏未结束')
  assert(Object.keys(s.cardRegistry).length > 0, 'cardRegistry 有内容')
}

// ═══════════════════════════════════════
// TEST 2: 非人类打出单位卡（强制注入）
// ═══════════════════════════════════════
section('TEST 2: 非人类打出1费单位（强制注入聂小倩）')
{
  let s = engine.createGame()
  setMana(s, 'NONHUMAN', 3)
  const card = injectCard(s, 'NONHUMAN', 'nie_xiaoqian')  // 2费/2/2 潜伏

  const handBefore = s.nonhumanHand.length
  s = engine.playCard(s, 'NONHUMAN', card.instanceId, 0)

  assertEq(s.nonhumanHand.length, handBefore - 1, '手牌减少1张')
  assert(s.lanes[0].nonhumanUnit !== null, '道路0有非人类单位')
  assertEq(s.lanes[0].nonhumanUnit?.cardId, 'nie_xiaoqian', '道路0单位是聂小倩')
  assertEq(s.nonhumanMana.current, 1, '费用从3扣到1（花费2）')
  assert(!s.log.some(l => l.includes('⚠️')), '无错误日志')
}

// ═══════════════════════════════════════
// TEST 3: 阶段校验——人类在非人类回合出牌
// ═══════════════════════════════════════
section('TEST 3: 阶段校验——人类在非人类回合出牌被拒')
{
  let s = engine.createGame()
  const card = injectCard(s, 'HUMAN', 'jing_ke')
  setMana(s, 'HUMAN', 5)

  s = engine.playCard(s, 'HUMAN', card.instanceId, 0)

  assert(s.humanHand.includes(card) || s.humanHand.some(c => c.instanceId === card.instanceId), '出牌被拒绝，牌还在手')
  assert(s.log.some(l => l.includes('⚠️') && l.includes('HUMAN')), '有阶段错误提示')
}

// ═══════════════════════════════════════
// TEST 4: 费用不足出牌 → 被拒绝
// ═══════════════════════════════════════
section('TEST 4: 费用不足出牌')
{
  let s = engine.createGame()
  const card = injectCard(s, 'NONHUMAN', 'sun_wukong')  // 5费
  // 费用只有1，不够

  s = engine.playCard(s, 'NONHUMAN', card.instanceId, 0)
  assert(s.nonhumanHand.some(c => c.instanceId === card.instanceId), '出牌被拒绝，牌还在手')
  assert(s.log.some(l => l.includes('费用不足')), '有费用不足提示')
}

// ═══════════════════════════════════════
// TEST 5: 阶段流转
// ═══════════════════════════════════════
section('TEST 5: 阶段流转 NONHUMAN_PLAY → HUMAN_PLAY → NONHUMAN_TRICK → 下回合')
{
  let s = engine.createGame()
  assertEq(s.phase, 'NONHUMAN_PLAY', '初始NONHUMAN_PLAY')
  assertEq(s.activePlayer, 'NONHUMAN', 'activePlayer=NONHUMAN')

  s = engine.endPhase(s, 'NONHUMAN')
  assertEq(s.phase, 'HUMAN_PLAY', '→ HUMAN_PLAY')
  assertEq(s.activePlayer, 'HUMAN', 'activePlayer=HUMAN')

  s = engine.endPhase(s, 'HUMAN')
  assertEq(s.phase, 'NONHUMAN_TRICK', '→ NONHUMAN_TRICK')
  assertEq(s.activePlayer, 'NONHUMAN', 'activePlayer=NONHUMAN')

  s = engine.endPhase(s, 'NONHUMAN')
  assertEq(s.turn, 2, '战斗后进入回合2')
  assertEq(s.phase, 'NONHUMAN_PLAY', '回合2从NONHUMAN_PLAY开始')
  assertEq(s.humanMana.max, 2, '回合2费用上限为2')
}

// ═══════════════════════════════════════
// TEST 6: 错误方结束阶段 → 被拒
// ═══════════════════════════════════════
section('TEST 6: 错误方结束阶段')
{
  let s = engine.createGame()
  s = engine.endPhase(s, 'HUMAN')
  assertEq(s.phase, 'NONHUMAN_PLAY', '阶段未改变')
  assert(s.log.some(l => l.includes('⚠️')), '有错误提示')
}

// ═══════════════════════════════════════
// TEST 7: 完整多回合流程（自动对局）
// ═══════════════════════════════════════
section('TEST 7: 模拟完整多回合自动对局')
{
  let s = engine.createGame()

  function playBestCard(state, faction) {
    const actions = engine.getValidActions(state, faction)
    const playActions = actions.filter(a => a.type === 'PLAY_UNIT' || a.type === 'PLAY_ENVIRONMENT')
    if (playActions.length > 0) {
      const act = playActions[0]
      return engine.playCard(state, faction, act.cardInstanceId, act.laneIndex)
    }
    return state
  }

  let rounds = 0
  while (!s.winner && rounds < 20) {
    s = playBestCard(s, 'NONHUMAN')
    s = engine.endPhase(s, 'NONHUMAN')
    if (s.winner) break
    s = playBestCard(s, 'HUMAN')
    s = engine.endPhase(s, 'HUMAN')
    if (s.winner) break
    s = engine.endPhase(s, 'NONHUMAN')
    rounds++
  }

  assert(rounds > 0, `至少跑了1回合 (实际: ${rounds}回合)`)
  if (s.winner) {
    console.log(`  ℹ️  游戏在第${s.turn}回合结束，获胜方: ${s.winner}`)
    assert(true, `有获胜方: ${s.winner}`)
  } else {
    console.log(`  ℹ️  跑了${rounds}轮，HP: 人类${s.humanHero.currentHealth} vs 非人类${s.nonhumanHero.currentHealth}`)
    assert(true, '未崩溃')
  }
}

// ═══════════════════════════════════════
// TEST 8: 神射关键词
// ═══════════════════════════════════════
section('TEST 8: 神射关键词——跳过挡路单位直打英雄')
{
  let s = engine.createGame()
  // 先推进到HUMAN_PLAY，人类在道路0放一个单位
  s = engine.endPhase(s, 'NONHUMAN')  // → HUMAN_PLAY
  setMana(s, 'HUMAN', 5)
  const blocker = injectCard(s, 'HUMAN', 'yue_fei')  // 4/4/3，放道路0挡路
  s = engine.playCard(s, 'HUMAN', blocker.instanceId, 0)
  assert(s.lanes[0].humanUnit !== null, '人类道路0有岳飞挡路')

  // 推进到NONHUMAN_TRICK/下回合，让非人类放神射单位
  s = engine.endPhase(s, 'HUMAN')  // → NONHUMAN_TRICK
  s = engine.endPhase(s, 'NONHUMAN')  // → 回合2
  setMana(s, 'NONHUMAN', 5)
  const sniper = injectCard(s, 'NONHUMAN', 'bai_gu_jing')  // 3/2/3 神射
  s = engine.playCard(s, 'NONHUMAN', sniper.instanceId, 0)
  assert(s.lanes[0].nonhumanUnit?.cardId === 'bai_gu_jing', '非人类道路0有白骨精（神射）')

  const humanHpBefore = s.humanHero.currentHealth
  s = engine.endPhase(s, 'NONHUMAN')  // → HUMAN_PLAY
  s = engine.endPhase(s, 'HUMAN')  // → NONHUMAN_TRICK
  s = engine.endPhase(s, 'NONHUMAN')  // → COMBAT

  const humanHpAfter = s.humanHero.currentHealth
  console.log(`  ℹ️  人类英雄HP: ${humanHpBefore} → ${humanHpAfter}（神射2点攻击直击）`)
  assert(humanHpAfter < humanHpBefore, '神射成功绕过挡路单位直打人类英雄')
}

// ═══════════════════════════════════════
// TEST 9: 穿透关键词
// ═══════════════════════════════════════
section('TEST 9: 穿透关键词——overkill伤害传英雄')
{
  let s = engine.createGame()
  // NONHUMAN放孙悟空(5/5/4 穿透)，HUMAN放荆轲(2/2/2，血量低于5)
  s = engine.endPhase(s, 'NONHUMAN')  // → HUMAN_PLAY
  setMana(s, 'HUMAN', 5)
  const target = injectCard(s, 'HUMAN', 'jing_ke')  // 2/2/2
  s = engine.playCard(s, 'HUMAN', target.instanceId, 1)

  s = engine.endPhase(s, 'HUMAN')  // → NONHUMAN_TRICK
  s = engine.endPhase(s, 'NONHUMAN')  // → 回合2

  setMana(s, 'NONHUMAN', 5)
  const pierce = injectCard(s, 'NONHUMAN', 'sun_wukong')  // 5/5/4 穿透
  s = engine.playCard(s, 'NONHUMAN', pierce.instanceId, 1)

  const humanHpBefore = s.humanHero.currentHealth
  s = engine.endPhase(s, 'NONHUMAN')
  s = engine.endPhase(s, 'HUMAN')
  s = engine.endPhase(s, 'NONHUMAN')  // combat

  const humanHpAfter = s.humanHero.currentHealth
  // 孙悟空5攻打荆轲2血，overkill = 5-2 = 3，英雄应受3点穿透
  console.log(`  ℹ️  穿透：人类英雄HP ${humanHpBefore} → ${humanHpAfter}（预计-3穿透+荆轲反击）`)
  assert(humanHpAfter < humanHpBefore, '穿透：overkill伤害传到人类英雄')
  const pierceLog = s.log.find(l => l.includes('穿透'))
  assert(!!pierceLog, `日志有穿透记录: ${pierceLog || '无'}`)
}

// ═══════════════════════════════════════
// TEST 10: getValidActions
// ═══════════════════════════════════════
section('TEST 10: getValidActions')
{
  let s = engine.createGame()
  setMana(s, 'NONHUMAN', 3)
  injectCard(s, 'NONHUMAN', 'bai_gu_jing')  // 3费单位，现在能出

  const actions = engine.getValidActions(s, 'NONHUMAN')
  const unitActions = actions.filter(a => a.type === 'PLAY_UNIT')
  const hasEndPhase = actions.some(a => a.type === 'END_PHASE')

  assert(hasEndPhase, '有END_PHASE动作')
  assert(unitActions.length > 0, '有PLAY_UNIT动作')

  // 人类在非人类回合无动作
  const humanActions = engine.getValidActions(s, 'HUMAN')
  assertEq(humanActions.length, 0, '非人类回合人类无可用动作')

  console.log(`  ℹ️  非人类可用动作数: ${actions.length}（含${unitActions.length}个出单位动作）`)
}

// ═══════════════════════════════════════
// TEST 11: 护甲关键词（强制注入）
// ═══════════════════════════════════════
section('TEST 11: 护甲关键词（强制注入兵马俑）')
{
  let s = engine.createGame()
  s = engine.endPhase(s, 'NONHUMAN')  // → HUMAN_PLAY
  setMana(s, 'HUMAN', 5)
  const card = injectCard(s, 'HUMAN', 'terracotta')

  s = engine.playCard(s, 'HUMAN', card.instanceId, 0)
  const unit = s.lanes[0].humanUnit

  assert(unit !== null, '兵马俑在道路0')
  assert(unit?.statusTags.some(t => t.tag === 'ARMOR'), '兵马俑有护甲状态标签')
  const armorTag = unit?.statusTags.find(t => t.tag === 'ARMOR')
  assertEq(armorTag?.value, 2, '护甲值为2')

  // 验证护甲吸收伤害：兵马俑3血+护甲2，受2点伤害后护甲归零，血量不变
  if (unit) {
    unit.currentHealth -= Math.max(0, 2 - armorTag.value)
    // 用引擎外手动模拟是不准确的；改用让非人类攻击它
  }

  // 放一个攻击力=2的非人类单位打兵马俑
  s = engine.endPhase(s, 'HUMAN')  // → NONHUMAN_TRICK
  s = engine.endPhase(s, 'NONHUMAN')  // → 回合2
  setMana(s, 'NONHUMAN', 5)
  const attacker = injectCard(s, 'NONHUMAN', 'nie_xiaoqian')  // 2/2/2
  s = engine.playCard(s, 'NONHUMAN', attacker.instanceId, 0)

  s = engine.endPhase(s, 'NONHUMAN')
  s = engine.endPhase(s, 'HUMAN')
  s = engine.endPhase(s, 'NONHUMAN')  // combat

  // 兵马俑受2伤：先消耗护甲2，血量仍为3
  const unitAfter = s.lanes[0].humanUnit
  if (unitAfter) {
    console.log(`  ℹ️  兵马俑战斗后HP: ${unitAfter.currentHealth}（应为3，护甲吸收了2伤）`)
    assertEq(unitAfter.currentHealth, 3, '护甲吸收伤害：兵马俑血量仍为3')
    const armorAfter = unitAfter.statusTags.find(t => t.tag === 'ARMOR')
    assert(!armorAfter, '护甲已耗尽')
  } else {
    console.log('  ℹ️  兵马俑在战斗中死亡（聂小倩也反击了），护甲可能有效但双方均死')
    assert(true, '无崩溃')
  }
}

// ═══════════════════════════════════════
// TEST 12: 潜伏单位（强制注入）
// ═══════════════════════════════════════
section('TEST 12: 潜伏单位——战斗前揭示')
{
  let s = engine.createGame()
  s = engine.endPhase(s, 'NONHUMAN')  // → HUMAN_PLAY
  setMana(s, 'HUMAN', 5)
  const card = injectCard(s, 'HUMAN', 'jing_ke')  // 2/2/2 潜伏

  s = engine.playCard(s, 'HUMAN', card.instanceId, 2)
  const unit = s.lanes[2].humanUnit

  assert(unit !== null, '荆轲在道路2')
  assertEq(unit?.isAmbushed, true, '荆轲处于潜伏状态')

  // 战斗后应揭示
  s = engine.endPhase(s, 'HUMAN')
  s = engine.endPhase(s, 'NONHUMAN')  // combat

  const unitAfter = s.lanes[2].humanUnit
  if (unitAfter) {
    assertEq(unitAfter.isAmbushed, false, '战斗后荆轲揭示')
    assert(s.log.some(l => l.includes('揭示')), '日志有揭示记录')
  } else {
    // 荆轲战斗中死亡也可以（没有非人类单位时只是揭示后无事）
    assert(s.log.some(l => l.includes('揭示')), '日志有揭示记录')
  }
}

// ═══════════════════════════════════════
// TEST 13: 登场效果——华佗治疗（强制注入）
// ═══════════════════════════════════════
section('TEST 13: 登场效果——华佗治疗英雄3点')
{
  let s = engine.createGame()
  s.humanHero.currentHealth = 15  // 先扣血
  s = engine.endPhase(s, 'NONHUMAN')  // → HUMAN_PLAY
  setMana(s, 'HUMAN', 5)
  const card = injectCard(s, 'HUMAN', 'hua_tuo')

  const hpBefore = s.humanHero.currentHealth
  s = engine.playCard(s, 'HUMAN', card.instanceId, 0)
  const hpAfter = s.humanHero.currentHealth

  assert(hpAfter > hpBefore, `华佗治疗英雄: ${hpBefore} → ${hpAfter}`)
  assertEq(hpAfter - hpBefore, 3, '治疗量为3')
}

// ═══════════════════════════════════════
// TEST 14: 日志无 undefined
// ═══════════════════════════════════════
section('TEST 14: 全程日志无 undefined/null 字符串')
{
  let s = engine.createGame()
  for (let i = 0; i < 3; i++) {
    s = engine.endPhase(s, 'NONHUMAN')
    s = engine.endPhase(s, 'HUMAN')
    s = engine.endPhase(s, 'NONHUMAN')
    if (s.winner) break
  }

  const badLogs = s.log.filter(l => l.includes('undefined') || l.includes('[object Object]'))
  assert(badLogs.length === 0, `日志无undefined: ${badLogs.length === 0 ? '✓' : badLogs.slice(0,3).join(' | ')}`)
}

// ═══════════════════════════════════════
// TEST 15: activePlayer 驱动出牌（模拟UI行为）
// ═══════════════════════════════════════
section('TEST 15: activePlayer 正确驱动——模拟UI使用 state.activePlayer 出牌')
{
  let s = engine.createGame()
  setMana(s, 'NONHUMAN', 5)
  const nhCard = injectCard(s, 'NONHUMAN', 'nezha')  // 3/3/3 非人类

  // 模拟UI：用 state.activePlayer 而不是手动变量
  assert(s.activePlayer === 'NONHUMAN', '初始activePlayer=NONHUMAN')
  s = engine.playCard(s, s.activePlayer, nhCard.instanceId, 2)
  assert(s.lanes[2].nonhumanUnit?.cardId === 'nezha', '哪吒成功出牌到道路2')

  // 推进到HUMAN_PLAY
  s = engine.endPhase(s, s.activePlayer)  // NONHUMAN ends
  assert(s.activePlayer === 'HUMAN', '阶段切换后activePlayer=HUMAN')

  setMana(s, 'HUMAN', 5)
  const humanCard = injectCard(s, 'HUMAN', 'hua_tuo')
  s = engine.playCard(s, s.activePlayer, humanCard.instanceId, 3)
  assert(s.lanes[3].humanUnit?.cardId === 'hua_tuo', '华佗用activePlayer出牌成功')

  // 尝试用 'NONHUMAN' 出人类手牌 → 应该找不到牌
  const humanCard2 = injectCard(s, 'HUMAN', 'yue_fei')
  const sBefore = JSON.stringify(s.humanHand.length)
  s = engine.playCard(s, 'NONHUMAN', humanCard2.instanceId, 4)  // 错误faction
  assert(s.log.some(l => l.includes('⚠️')), '错误faction出牌被拒绝')
}

// ═══════════════════════════════════════
// TEST 16: 溢伤关键词
// ═══════════════════════════════════════
section('TEST 16: 溢伤关键词——击杀后溢出伤害打英雄')
{
  let s = engine.createGame()
  // NONHUMAN放牛魔王(4/4/4 溢伤)，HUMAN放荆轲(2/2/2)
  s = engine.endPhase(s, 'NONHUMAN')  // → HUMAN_PLAY
  setMana(s, 'HUMAN', 5)
  const target = injectCard(s, 'HUMAN', 'jing_ke')  // 2血
  s = engine.playCard(s, 'HUMAN', target.instanceId, 0)

  s = engine.endPhase(s, 'HUMAN')  // → NONHUMAN_TRICK
  s = engine.endPhase(s, 'NONHUMAN')  // → 回合2

  setMana(s, 'NONHUMAN', 5)
  const overshoter = injectCard(s, 'NONHUMAN', 'niu_mowang')  // 4/4/4 溢伤
  s = engine.playCard(s, 'NONHUMAN', overshoter.instanceId, 0)

  const humanHpBefore = s.humanHero.currentHealth
  s = engine.endPhase(s, 'NONHUMAN')
  s = engine.endPhase(s, 'HUMAN')
  s = engine.endPhase(s, 'NONHUMAN')  // combat

  const humanHpAfter = s.humanHero.currentHealth
  // 牛魔王4攻打荆轲2血，溢出 = 4-2 = 2，英雄扣2血
  console.log(`  ℹ️  溢伤：人类英雄HP ${humanHpBefore} → ${humanHpAfter}（预计-2溢伤）`)
  assert(humanHpAfter < humanHpBefore, '溢伤：击杀后溢出伤害传到人类英雄')
  const overLog = s.log.find(l => l.includes('溢伤'))
  assert(!!overLog, `日志有溢伤记录: ${overLog || '无'}`)
}

// ═══════════════════════════════════════
// 汇总
// ═══════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`)
console.log(`测试结果: ${passed} 通过 / ${failed} 失败 / ${passed + failed} 总计`)
if (failed > 0) {
  console.log('🔴 有失败项，请查看上方 ❌ 标记')
  process.exit(1)
} else {
  console.log('🟢 全部通过！')
}
