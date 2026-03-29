# Changelog

> 记录所有重要的设计变更，包括变更内容、原因和影响范围。
> 格式：日期 → 模块 → 变更内容 → 原因 → 影响文档

---

## 2026-03-29

**[代码架构] 卡牌系统从数据驱动重构为 OOP class 模式**
- **变更前**：卡牌定义为 `CardDefinition` 对象字面量 + `EffectDefinition[]` 数组描述效果；`EffectSystem.triggerEffect()` 集中处理所有效果逻辑；效果靠 action type 字符串区分
- **变更后**：每张卡牌为 `CardBase` 子类（`UnitCard` / `SpellCard` / `EnvironmentCard`）；复杂效果直接复写 `onPlay / onDeath / onReveal / onEndOfTurn` 钩子；共享副作用函数移至 `cards/effects.ts`
- 新增文件：`packages/core/src/cards/CardBase.ts`、`cards/effects.ts`、`data/human-cards.ts`、`data/nonhuman-cards.ts`、`data/cards-index.ts`
- 废弃文件（保留空壳）：`systems/EffectSystem.ts`、`data/demo-cards.ts`
- `deepClone` 新增 CardBase 实例的序列化/反序列化处理（serialize→`{__cardId}`，restore from CARD_MAP）
- 影响文档：`Developer/CodeArchitecture.md`（全面重写）

**[关键词系统 · 神射/溢伤] 修正代码实现以匹配设计文档**
- **神射（Foresight X）**：修改前为「战斗时跳过对面单位直接打英雄」，修改后为「战斗循环开始**前**触发，造成固定 X 点预伤害；单位之后正常参与道路战斗」
- **溢伤X（Overshoot X）**：修改前为动态计算 `overkill = attack − targetHP`，修改后为读取卡牌定义中的固定 `overshootValue`
- **护甲X（Armor X）**：X 值从硬编码 card id 判断改为读取 `def.armorValue` 字段
- `CardBase` 新增 `armorValue / foresightValue / overshootValue` 可选字段
- 60个自动化测试全部通过，验证行为符合设计文档



**[关键词系统 · 溢伤X]** 重新定义溢伤X的效果描述与目标规则（设计确认）
- **变更前**：描述模糊（各文档说法不一：CardsCommon 注明"固定值"；DevFeatures 设计确认记录写"动态值 = 攻击力 − 目标剩余生命值"；GameDesign 未注明）
- **变更后**：统一为「消灭对面单位后，对该道路后方的下一目标（有单位先打单位，否则打英雄）造成**固定 X 点**伤害」
- 关键明确点：① X 是卡牌标注的固定值，不是溢出量；② 目标优先打道路后方的下一个单位，无单位才打英雄（而非直接打英雄）
- 影响文档：`GameDesign.md`、`Cards/CardsCommon.md`、`Developer/DevFeatures.md`（关键词描述 + 设计确认记录第5条）



**[文档结构]** 卡牌数据迁移至 `Cards/` 目录，完成结构重组
- 新增 `docs/Cards/CardsCommon.md`：统一记录卡牌类型、稀有度、全部关键词系统（23个）
- 新增 `docs/Cards/Human/Units.md`、`Spells.md`、`Environments.md`
- 新增 `docs/Cards/NonHuman/Units.md`、`Spells.md`、`Environments.md`
- 旧 `GamePlay/Cards_Human_v2.md` 和 `Cards_NonHuman_v2.md` 标注为归档，仅供参考
- 影响：`CLAUDE.md`、`Sessions/Gameplay.md`、`Sessions/Dev.md`

**[关键词系统]** 关键词数量从 17 扩展至 23，并完成以下重命名与重定义
- 神射（原：穿透到英雄）→ **必中**（Bullseye）：攻击不填充对方护盾条
- 弹射 → **击退**（Knockback）：将目标单位退回手牌，费用-1
- 龙吼 → **感知**（Sense）：登场时查看对方手牌
- 生命攻击 → **血战**（Bloodrush）：可在对方回合战斗阶段打出，无需等待己方回合
- 新增：**神射**（Foresight X）、**击退**、**感知**、**进化**、**血战**、**无敌**、**迟钝**（共 6 个新关键词）
- 新增：神射（Foresight X）= 战斗前对对方英雄造成 X 点直接伤害
- 全部卡牌描述已同步更新（弹回→击退，神射独立关键词→必中）
- 影响：`Cards/CardsCommon.md`、`GameDesign.md` 第七章、所有卡牌文件

**[回合结构]** 迁移并完善 PVZH 回合规则
- 4 阶段不对称回合：非人类出牌 → 战斗 → 人类出牌 → 战斗
- 费用规则：起始 1 点，每回合 +1，当回合不用尽则清零（不累积）
- 手牌上限：10 张，超出须弃牌
- 胜利条件：对方英雄 HP 归零 或 对方卡组抽空
- 影响：`GameDesign.md` 第六章

---

## 2026-03-28

**[文档结构]** 将 `DevFeatures.md` 从 `GamePlay/` 移动至 `Developer/`
- 原因：属于程序开发内容，应归入 `Developer/` 目录统一管理
- 影响：`CLAUDE.md` 文档结构、`Sessions/Dev.md` 路径引用


- 影响：`CLAUDE.md`

**[卡组构建]** 确定卡组张数为 40 张（原暂定 30 张）
- 影响：`GameDesign.md`、`CLAUDE.md`

**[初始手牌]** 确定初始手牌为 5 张（4 张从卡组抽取 + 1 张英雄超能力）
- 影响：`GameDesign.md`、`CLAUDE.md`

**[道路系统]** 确定 5 条道路布局：最左高地面 / 中间三条平地 / 最右水路
- 水路规则：仅「两栖」关键词卡牌可放置
- 高地面具体规则效果待后续讨论
- 影响：`GameDesign.md`、`CLAUDE.md`

**[传奇卡]** 传奇卡无张数限制（原为每副最多 1 张）
- 影响：`GameDesign.md`、`CLAUDE.md`


**[超能力系统]** 超能力从"每位英雄1张"改为"每位英雄4张"
- 初始 1 张进入手牌，剩余 3 张置入超能力池
- 影响：`GameDesign.md`、`CLAUDE.md`

**[护盾系统]** 新增护盾系统设计
- 英雄护盾条共 8 格，被攻击时随机增长 1~3 格
- 满格触发格挡：免疫本次伤害 + 护盾清零 + 从超能力池抽 1 张（可选立即打出或加入手牌）
- 超能力池耗尽后护盾停止积累，每局最多格挡 3 次
- 影响：`GameDesign.md`、`CLAUDE.md`


- 原因：不同费用会造成英雄间平衡性差异过大，统一费用后通过效果强度本身控制平衡
- 影响：`Heroes_Powers.md` 全部重写

**[卡牌多样性]** 卡牌从 v1 升级至 v2
- 原因：v1 中无名单位过多（天兵、小鬼、新兵、卫兵等），角色多样性不足，同质化严重
- 变更内容：替换所有无名单位为有名有姓角色，新增进击的巨人、龙珠、黑魂/艾尔登法环、魔戒、星战、英雄联盟、魔兽世界等系列
- 影响：新增 `Cards_Human_v2.md`、`Cards_NonHuman_v2.md`，v1 文件保留作参考

**[知识库结构]** 建立 Claude 知识库体系
- 新增：`CLAUDE.md`（全局上下文）、`GameDesign.md`（设计圣经）、`Sessions/Gameplay.md`、`Sessions/Dev.md`、`CHANGELOG.md`
