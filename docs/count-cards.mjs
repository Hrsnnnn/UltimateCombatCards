#!/usr/bin/env node
/**
 * count-cards.mjs
 * 统计 Cards/ 目录下各属性、各类型的卡牌数量
 * 用法：node docs/count-cards.mjs
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CARDS = resolve(__dirname, 'Cards')

// 判断是否为卡牌数据行（非表头、非分隔线）
function isCardRow(line) {
  if (!line.startsWith('|')) return false
  if (/^\|\s*[-:]+\s*\|/.test(line)) return false      // 分隔线 |---|
  if (/卡牌名称|关键词|效果描述/.test(line)) return false // 表头行
  return true
}

// 统计单个文件，返回 { 属性名: 数量 } 和总数
function countFile(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  const sections = {}
  let currentSection = '通用'

  for (const line of lines) {
    // 匹配属性分组标题，如 ## 💪 肉体属性 或 ## ✨ 神属性
    const sectionMatch = line.match(/^##\s+(.+?)(?:属性)?$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim()
      if (!sections[currentSection]) sections[currentSection] = 0
    }
    if (isCardRow(line)) {
      if (!sections[currentSection]) sections[currentSection] = 0
      sections[currentSection]++
    }
  }

  const total = Object.values(sections).reduce((a, b) => a + b, 0)
  return { sections, total }
}

// 要统计的文件
const FILES = {
  human: {
    label: '人类方',
    units:        resolve(CARDS, 'Human/Units.md'),
    spells:       resolve(CARDS, 'Human/Spells.md'),
    environments: resolve(CARDS, 'Human/Environments.md'),
  },
  nonhuman: {
    label: '非人类方',
    units:        resolve(CARDS, 'NonHuman/Units.md'),
    spells:       resolve(CARDS, 'NonHuman/Spells.md'),
    environments: resolve(CARDS, 'NonHuman/Environments.md'),
  },
}

// ── 执行统计 ──────────────────────────────────────────────────────────

let grandTotal = 0
const results = {}

for (const [faction, info] of Object.entries(FILES)) {
  const units        = countFile(info.units)
  const spells       = countFile(info.spells)
  const environments = countFile(info.environments)
  const factionTotal = units.total + spells.total + environments.total

  grandTotal += factionTotal
  results[faction] = { label: info.label, units, spells, environments, factionTotal }
}

// ── 输出 ──────────────────────────────────────────────────────────────

const lines = []
for (const { label, units, spells, environments, factionTotal } of Object.values(results)) {
  lines.push(`\n── ${label}（共 ${factionTotal} 张）──`)

  lines.push('  单位卡：')
  for (const [attr, count] of Object.entries(units.sections)) {
    lines.push(`    ${attr}: ${count} 张`)
  }
  lines.push(`    小计：${units.total} 张`)

  lines.push('  法术卡：')
  for (const [attr, count] of Object.entries(spells.sections)) {
    lines.push(`    ${attr}: ${count} 张`)
  }
  lines.push(`    小计：${spells.total} 张`)

  lines.push('  环境卡：')
  for (const [attr, count] of Object.entries(environments.sections)) {
    lines.push(`    ${attr}: ${count} 张`)
  }
  lines.push(`    小计：${environments.total} 张`)
}
lines.push(`\n── 总计：${grandTotal} 张（不含英雄超能力）──`)

const text = lines.join('\n')

// --hook 模式：输出 hook JSON，让 Claude 感知最新数量
if (process.argv.includes('--hook')) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `卡牌统计已更新：\n${text}`
    }
  }) + '\n')
} else {
  console.log(text)
}

