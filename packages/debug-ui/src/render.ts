import type { GameState, CardInstance, UnitState } from '@haunted/core'

function el(id: string): HTMLElement {
  return document.getElementById(id)!
}

export function renderState(
  state: GameState,
  selectedCard: CardInstance | null,
  onSelectCard: (card: CardInstance) => void,
  onPlayToLane: (laneIndex: number) => void,
  onEndPhase: () => void
): void {
  // ── Heroes ──
  renderHero('nonhuman', state)
  renderHero('human', state)

  // ── Mana ──
  el('nonhuman-mana').textContent = `💜 ${state.nonhumanMana.current}/${state.nonhumanMana.max}`
  el('human-mana').textContent = `💛 ${state.humanMana.current}/${state.humanMana.max}`

  // ── Turn / Phase ──
  el('turn-display').textContent = String(state.turn)
  const phaseBadge = el('phase-badge')
  phaseBadge.textContent = phaseLabel(state.phase)
  phaseBadge.className = `phase-badge ${state.phase}`

  // ── Lanes ──
  renderLanes(state, selectedCard, onPlayToLane)

  // ── Hands ──
  // Only the active player's hand is interactive
  const isNonhumanActive = state.phase === 'NONHUMAN_PLAY' || state.phase === 'NONHUMAN_TRICK'
  const isHumanActive = state.phase === 'HUMAN_PLAY'
  renderHand('nonhuman', state, state.nonhumanHand, selectedCard, isNonhumanActive, state.nonhumanMana.current, onSelectCard, state.phase)
  renderHand('human', state, state.humanHand, selectedCard, isHumanActive, state.humanMana.current, onSelectCard, state.phase)

  // ── End Phase button ──
  // canEnd is true when the phase belongs to a human-controlled player action
  // (COMBAT resolves automatically, so it's never manually ended)
  const canEnd = state.phase !== 'COMBAT' && !state.winner
  const btn = el('btn-end-phase') as HTMLButtonElement
  btn.disabled = !canEnd
  btn.onclick = onEndPhase

  // ── Active player label ──
  const activeLabel = state.phase === 'HUMAN_PLAY' ? '人类回合' : '非人类回合'
  // ── Selection hint ──
  const hint = el('selection-hint')
  if (selectedCard) {
    if (selectedCard.definition.type === 'UNIT' || selectedCard.definition.type === 'ENVIRONMENT') {
      hint.textContent = `已选中: ${selectedCard.definition.name} — 点击道路格子出牌`
    } else {
      hint.textContent = `已选中: ${selectedCard.definition.name} — 点击目标单位施放`
    }
  } else {
    hint.textContent = canEnd ? `${activeLabel} — 点击手牌选择，或结束阶段` : '战斗结算中…'
  }

  // ── Winner overlay ──
  if (state.winner) {
    const overlay = el('winner-overlay')
    overlay.classList.add('show')
    el('winner-text').textContent = state.winner === 'HUMAN' ? '人类获胜！' : '非人类获胜！'
    el('winner-sub').textContent = state.winner === 'HUMAN'
      ? `${state.humanHero.name} 统治了鬼魂世界`
      : `${state.nonhumanHero.name} 击败了入侵者`
  }
}

function renderHero(side: 'human' | 'nonhuman', state: GameState): void {
  const hero = side === 'human' ? state.humanHero : state.nonhumanHero
  el(`${side}-hero-name`).textContent = hero.name
  el(`${side}-hp-text`).textContent = `${hero.currentHealth}/${hero.maxHealth}`
  const pct = Math.max(0, (hero.currentHealth / hero.maxHealth) * 100)
  ;(el(`${side}-hp-fill`) as HTMLDivElement).style.width = `${pct}%`
}

function renderLanes(
  state: GameState,
  selectedCard: CardInstance | null,
  onPlayToLane: (laneIndex: number) => void
): void {
  const container = el('lanes')
  container.innerHTML = ''

  for (const lane of state.lanes) {
    const laneEl = document.createElement('div')
    laneEl.className = 'lane'

    // Nonhuman slot (top, 1 part)
    const nhSlot = createLaneSlot(state, lane.nonhumanUnit, 'nonhuman', selectedCard, lane, onPlayToLane)
    laneEl.appendChild(nhSlot)

    // Battle area (middle, 2 parts): env badge + lane label
    const battleArea = document.createElement('div')
    battleArea.className = 'lane-battle-area'

    const label = document.createElement('div')
    label.className = 'lane-label'
    label.textContent = lane.isAquatic ? `${lane.index}🌊` : `${lane.index}`
    battleArea.appendChild(label)

    if (lane.environment) {
      const envBadge = document.createElement('div')
      envBadge.className = 'env-badge'
      envBadge.textContent = lane.environment.definition.name
      battleArea.appendChild(envBadge)
    }

    laneEl.appendChild(battleArea)

    // Human slot (bottom, 1 part)
    const hSlot = createLaneSlot(state, lane.humanUnit, 'human', selectedCard, lane, onPlayToLane)
    laneEl.appendChild(hSlot)

    container.appendChild(laneEl)
  }
}

function createLaneSlot(
  state: GameState,
  unit: UnitState | null,
  side: 'human' | 'nonhuman',
  selectedCard: CardInstance | null,
  lane: import('@haunted/core').LaneState,
  onPlayToLane: (laneIndex: number) => void
): HTMLElement {
  const slot = document.createElement('div')
  slot.className = `lane-slot ${side}-side`

  const faction = side === 'human' ? 'HUMAN' : 'NONHUMAN'
  const cardType = selectedCard?.definition.type
  const cardFaction = selectedCard?.definition.faction

  const canPlayUnit = selectedCard !== null &&
    cardType === 'UNIT' &&
    cardFaction === faction &&
    unit === null

  // 环境卡：只在己方阵营对应的 slot 上高亮（新环境会替换旧环境，允许覆盖）
  const canPlayEnv = selectedCard !== null &&
    cardType === 'ENVIRONMENT' &&
    cardFaction === faction

  const canPlay = canPlayUnit || canPlayEnv

  if (canPlay) {
    slot.classList.add('highlighted')
    slot.title = `点击在道路 ${lane.index} 打出 ${selectedCard!.definition.name}`
  }

  slot.addEventListener('click', () => {
    if (canPlay) onPlayToLane(lane.index)
  })

  if (unit) {
    const card = document.createElement('div')
    card.className = `unit-card${unit.ownerId === 'NONHUMAN' ? ' nonhuman' : ''}${unit.isAmbushed ? ' ambushed' : ''}`

    // Hover tooltip: show card description
    if (!unit.isAmbushed) {
      const def = state.cardRegistry[unit.instanceId]?.definition
      if (def?.description) card.title = def.description
    }

    const name = document.createElement('div')
    name.className = 'unit-name'
    name.textContent = unit.isAmbushed ? '??? (潜伏)' : getCardName(state, unit.cardId, unit.instanceId)
    card.appendChild(name)

    if (!unit.isAmbushed) {
      const stats = document.createElement('div')
      stats.className = 'unit-stats'
      stats.textContent = `${unit.currentAttack} / ${unit.currentHealth}`
      card.appendChild(stats)

      const armor = unit.statusTags.find(t => t.tag === 'ARMOR') as { tag: 'ARMOR'; value: number } | undefined
      if (armor) {
        const armorEl = document.createElement('div')
        armorEl.style.color = '#60a5fa'
        armorEl.style.fontSize = '10px'
        armorEl.textContent = `🛡 护甲${armor.value}`
        card.appendChild(armorEl)
      }

      if (unit.keywords.length > 0) {
        const kw = document.createElement('div')
        kw.className = 'unit-kw'
        kw.textContent = unit.keywords.map(keywordLabel).join(' ')
        card.appendChild(kw)
      }
    }
    slot.appendChild(card)
  } else {
    const placeholder = document.createElement('span')
    placeholder.style.color = '#444'
    placeholder.style.fontSize = '20px'
    placeholder.textContent = canPlay ? '⬇' : '+'
    slot.appendChild(placeholder)
  }

  return slot
}

function renderHand(
  side: 'human' | 'nonhuman',
  state: GameState,
  hand: CardInstance[],
  selectedCard: CardInstance | null,
  isActive: boolean,
  mana: number,
  onSelectCard: (card: CardInstance) => void,
  phase?: string
): void {
  const container = el(`${side}-hand-area`)
  container.innerHTML = ''

  for (const card of hand) {
    const cardEl = document.createElement('div')
    const insufficient = card.definition.cost > mana
    // Phase-based type restriction for nonhuman:
    //   NONHUMAN_PLAY → spells are locked; NONHUMAN_TRICK → units are locked
    const wrongType =
      (phase === 'NONHUMAN_PLAY' && card.definition.type === 'SPELL') ||
      (phase === 'NONHUMAN_TRICK' && card.definition.type === 'UNIT')
    // Cards are unclickable if it's not this side's turn, cost is insufficient, or wrong type for phase
    const unplayable = !isActive || insufficient || wrongType
    cardEl.className = [
      'hand-card',
      side === 'nonhuman' ? 'nonhuman' : '',
      selectedCard?.instanceId === card.instanceId ? 'selected' : '',
      unplayable ? 'insufficient' : '',
    ].filter(Boolean).join(' ')

    const name = document.createElement('div')
    name.className = 'card-name'
    name.textContent = card.definition.name
    cardEl.appendChild(name)

    const cost = document.createElement('div')
    cost.className = 'card-cost'
    cost.textContent = `费用: ${card.definition.cost}`
    cardEl.appendChild(cost)

    if (card.definition.type === 'UNIT') {
      const stats = document.createElement('div')
      stats.className = 'card-stats'
      stats.textContent = `${card.definition.attack}/${card.definition.health}`
      cardEl.appendChild(stats)
    } else {
      const typeEl = document.createElement('div')
      typeEl.className = 'card-stats'
      typeEl.textContent = typeLabel(card.definition.type)
      cardEl.appendChild(typeEl)
    }

    if (card.definition.keywords.length > 0) {
      const kw = document.createElement('div')
      kw.className = 'card-kw'
      kw.textContent = card.definition.keywords.map(keywordLabel).join(' ')
      cardEl.appendChild(kw)
    }

    if (card.definition.description) {
      cardEl.title = card.definition.description
    }

    cardEl.addEventListener('click', () => {
      if (!unplayable) onSelectCard(card)
    })

    container.appendChild(cardEl)
  }

  // Show deck count
  const deckCount = document.createElement('span')
  deckCount.style.color = '#555'
  deckCount.style.fontSize = '11px'
  deckCount.style.marginLeft = '8px'
  deckCount.textContent = `牌库: ${side === 'human' ? state.humanDeck.length : state.nonhumanDeck.length}`
  container.appendChild(deckCount)
}

export function renderLog(log: string[], lastRenderedCount: number): number {
  const content = el('log-content')
  const newEntries = log.slice(lastRenderedCount)
  for (const entry of newEntries) {
    const p = document.createElement('p')
    if (entry.trim() === '') {
      p.className = 'blank'
    } else {
      p.textContent = entry
    }
    content.appendChild(p)
  }
  if (newEntries.length > 0) {
    content.scrollTop = content.scrollHeight
  }
  return log.length
}

function getCardName(state: GameState, cardId: string, instanceId?: string): string {
  // Use the registry if instanceId provided
  if (instanceId && state.cardRegistry[instanceId]) {
    return state.cardRegistry[instanceId].definition.name
  }
  // Try hands
  for (const c of [...state.humanHand, ...state.nonhumanHand, ...state.graveyard]) {
    if (c.cardId === cardId) return c.definition.name
  }
  return cardId
}

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    NONHUMAN_PLAY: '非人类出牌',
    HUMAN_PLAY: '人类出牌',
    NONHUMAN_TRICK: '非人类绝招',
    COMBAT: '战斗结算',
  }
  return map[phase] ?? phase
}

function keywordLabel(kw: string): string {
  const map: Record<string, string> = {
    SNIPER: '神射',
    PIERCE: '穿透',
    OVERSHOOT: '溢伤',
    ARMOR: '护甲',
    AMBUSH: '潜伏',
    TEAM_UP: '协作',
    AMPHIBIOUS: '两栖',
  }
  return map[kw] ?? kw
}

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    UNIT: '单位',
    SPELL: '法术',
    ENVIRONMENT: '环境',
    SUPERPOWER: '超能力',
  }
  return map[t] ?? t
}
