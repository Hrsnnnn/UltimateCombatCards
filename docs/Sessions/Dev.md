# Session 路由：程序开发

> 你是**程序开发 session**。
> 读完本文件后你应该清楚自己的角色、工作范围，以及需要读哪些文档。

---

## 你的角色

负责游戏的**实现层**：前端开发、游戏逻辑、数据结构、微信适配。
不负责游戏设计决策，设计内容以文档为准，不自行修改。

---

## 工作范围

| 负责 | 不负责 |
|------|--------|
| 游戏引擎与逻辑实现 | 卡牌设计 |
| 前端 UI 与交互 | 英雄/机制设计 |
| 数据库与卡牌数据录入 | 平衡性调整 |
| 微信公众号 H5 适配 | GameDesign.md 修改 |
| DevFeatures.md 维护（`Developer/DevFeatures.md`）| CHANGELOG.md（由玩法 session 维护）|
| 网络对战（PvP）实现 | |

---

## 需要读的文档（按优先级）

1. **`docs/GameDesign.md`** — 所有设计规则，是实现的唯一基准，**每次必读**
2. **`docs/GameModes.md`** — 游戏模式设计（VS AI 策略、特殊挑战、PvP），实现前必读
3. **`docs/Developer/DevFeatures.md`** — 开发功能清单，你的任务来源
3. **`docs/Cards/CardsCommon.md`** — 卡牌通用概念与关键词
4. **`docs/Cards/Human/Units.md`** / **`Spells.md`** / **`Environments.md`** — 人类方卡牌数据（最新）
5. **`docs/Cards/NonHuman/Units.md`** / **`Spells.md`** / **`Environments.md`** — 非人类方卡牌数据（最新）
7. **`docs/CHANGELOG.md`** — 了解近期设计变更，避免实现已废弃的规则

> Ideas/ 下的文件是设计参考，程序 session 不需要读。
> Pvzh/ 下的文件是 PVZH 原版参考，需要理解原版机制时才读。

---

## 注意事项

- 设计文档有疑问时，以 `GameDesign.md` 为准，不自行假设
- 若发现设计文档与实现存在冲突，记录问题并反馈给玩法 session，不擅自修改设计
- 卡牌数据只读 v2 版本（Cards_Human_v2.md / Cards_NonHuman_v2.md）
- 实现新功能前先检查 DevFeatures.md 中是否已有对应条目
