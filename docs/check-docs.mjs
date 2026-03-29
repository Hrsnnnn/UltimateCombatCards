#!/usr/bin/env node
/**
 * check-docs.mjs
 * 文档一致性检查脚本
 *
 * 触发方式：每次 Edit/Write 修改 docs/ 下的 .md 文件后自动运行
 * 检查规则：GameDesign.md 是权威来源，其他文件只能路由引用，不能重复定义数值
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = __dirname

// 读取文件内容
function read(relPath) {
  try {
    return readFileSync(resolve(ROOT, relPath), 'utf8')
  } catch {
    return ''
  }
}

const issues = []

function report(file, message) {
  issues.push({ file, message })
}

// ─── 规则 1：英雄血量 ────────────────────────────────────────────────
// 权威来源：GameDesign.md
// 其他文件不应再出现具体数值（20 / 30 + "血量"），允许出现路由引用文字

const heroHpPattern = /英雄.*?(?:血量|HP|初始血量).*?(\d+)\s*点/g
const heroHpExclude = ['GameDesign.md', 'check-docs.mjs']

const filesToCheckHp = [
  'CLAUDE.md',
  'Developer/DevFeatures.md',
  'Cards/CardsCommon.md',
  'Sessions/Dev.md',
  'Sessions/Gameplay.md',
]

for (const f of filesToCheckHp) {
  const content = read(f)
  // 按行检查：排除同一行含 GameDesign 来源引用的，或含"确认结论/已确认"的历史记录行
  const badLines = content.split('\n').filter(line =>
    heroHpPattern.test(line) &&
    !/GameDesign/.test(line) &&
    !/确认结论|已确认|✅/.test(line)
  )
  // 重置 lastIndex（matchAll 会自动重置，但 test() 不会）
  heroHpPattern.lastIndex = 0
  if (badLines.length > 0) {
    report(f, `⚠️  包含英雄血量具体数值且无来源引用（应只在 GameDesign.md 定义）：${badLines.map(l => l.trim()).join(' | ')}`)
  }
}

// ─── 规则 2：卡组张数 ────────────────────────────────────────────────
const deckSizePattern = /卡组.*?(\d+)\s*张|(\d+)\s*张.*?卡组/g

for (const f of ['CLAUDE.md', 'Cards/CardsCommon.md', 'Sessions/Dev.md', 'Sessions/Gameplay.md']) {
  const content = read(f)
  // 只检查明确写了数字张数的，排除"见 GameDesign.md"这种路由句
  const lines = content.split('\n').filter(l =>
    /卡组.*\d+\s*张|\d+\s*张.*卡组/.test(l) && !/GameDesign/.test(l) && !/路由|详见|来源/.test(l)
  )
  if (lines.length > 0) {
    report(f, `⚠️  包含卡组张数具体数值（应只在 GameDesign.md 定义）：${lines.map(l => l.trim()).join(' | ')}`)
  }
}

// ─── 规则 3：费用上限不应出现"上限10"或"上限 10" ────────────────────
const costCapFiles = ['Developer/DevFeatures.md', 'CLAUDE.md', 'Cards/CardsCommon.md']
for (const f of costCapFiles) {
  const content = read(f)
  if (/费用.*上限\s*10|上限\s*10.*费用/.test(content)) {
    report(f, `❌  费用上限错误：出现"上限10"，正确规则是费用无上限（见 GameDesign.md §六）`)
  }
}

// ─── 规则 4：传奇卡限制不应出现"最多1张" ────────────────────────────
const legendaryFiles = ['Cards/CardsCommon.md', 'Developer/DevFeatures.md', 'CLAUDE.md']
for (const f of legendaryFiles) {
  const content = read(f)
  if (/传奇.*最多\s*1\s*张|最多\s*1\s*张.*传奇/.test(content)) {
    report(f, `❌  传奇卡限制错误：出现"最多1张"，正确规则是最多4张（见 GameDesign.md §七）`)
  }
}

// ─── 规则 5：关键词数量 ──────────────────────────────────────────────
// 若提到关键词数量，不应出现"17个"或"16个"（旧版本遗留）
const kwFiles = ['Developer/DevFeatures.md', 'CLAUDE.md', 'Cards/CardsCommon.md', 'Sessions/Dev.md', 'Sessions/Gameplay.md']
for (const f of kwFiles) {
  const content = read(f)
  if (/(?:16|17)\s*个.*关键词|关键词.*(?:16|17)\s*个/.test(content)) {
    report(f, `⚠️  关键词数量过时：出现16或17个，当前已扩展至23个（见 GameDesign.md §七）`)
  }
}

// ─── 规则 6：GameDesign.md 不应再有"待确认"血量条目 ─────────────────
{
  const gd = read('GameDesign.md')
  if (/英雄血量.*待确认|待确认.*英雄血量/.test(gd)) {
    report('GameDesign.md', `❌  英雄血量仍标注为"待确认"，应更新为20点`)
  }
}

// ─── 输出结果 ────────────────────────────────────────────────────────
if (issues.length === 0) {
  // 正常无问题时输出简单 JSON，不打扰对话
  process.stdout.write(JSON.stringify({
    suppressOutput: true
  }) + '\n')
  process.exit(0)
} else {
  const lines = issues.map(i => `  [${i.file}] ${i.message}`).join('\n')
  const msg = `\n📋 文档一致性检查发现 ${issues.length} 个问题：\n${lines}\n\n→ 所有规则数值应只在 GameDesign.md 中定义，其他文件使用路由引用。`

  process.stdout.write(JSON.stringify({
    suppressOutput: false,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: msg
    }
  }) + '\n')
  process.exit(0)
}
