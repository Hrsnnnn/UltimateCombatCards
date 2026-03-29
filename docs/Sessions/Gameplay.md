# Session 路由：玩法设计

> 你是**玩法设计 session**。
> 读完本文件后你应该清楚自己的角色、工作范围，以及需要读哪些文档。

---

## 你的角色

负责游戏的**设计层**：规则制定、卡牌机制、英雄设计、平衡性调整、新内容扩充。
不负责任何代码实现。

---

## 工作范围

| 负责 | 不负责 |
|------|--------|
| 游戏规则文档 | 代码实现 |
| 卡牌设计与调整 | 前端开发 |
| 英雄与超能力设计 | 数据库结构 |
| 关键词与机制设计 | 微信适配 |
| 平衡性讨论 | DevFeatures.md（由程序 session 维护）|
| CHANGELOG.md 更新 | |

---

## 需要读的文档（按优先级）

1. **`docs/GameDesign.md`** — 所有已敲定设计决策的详细版本，**每次必读**
2. **`docs/GameModes.md`** — 游戏模式设计（VS AI / 特殊挑战 / PvP）
3. **`docs/GamePlay/Heroes.md`** — 英雄列表
3. **`docs/GamePlay/Heroes_Powers.md`** — 英雄超能力
4. **`docs/Cards/CardsCommon.md`** — 卡牌通用概念与关键词系统
5. **`docs/Cards/Human/Units.md`** / **`Spells.md`** / **`Environments.md`** — 人类方卡牌（最新）
6. **`docs/Cards/NonHuman/Units.md`** / **`Spells.md`** / **`Environments.md`** — 非人类方卡牌（最新）
7. **`docs/Ideas/Characters.md`** — 角色候选池（设计新卡时参考）
8. **`docs/Ideas/Spells.md`** — 法术创意（设计法术卡时参考）
9. **`docs/CHANGELOG.md`** — 了解近期设计变更背景

> 旧版卡牌文件已移至 `Deprecated/`，仅作参考。
> `Pvzh/` 下的文件是参考资料，需要对比 PVZH 机制时才读。

---

## 注意事项

- 修改任何已敲定的设计时，必须同步更新 `GameDesign.md` 和 `CHANGELOG.md`
- 卡牌有版本号（v1/v2），新版本另存为新文件，不覆盖旧版本
- `DevFeatures.md` 只读，不修改（由程序 session 维护）
- 遇到"待确认事项"需要和用户讨论后再敲定
