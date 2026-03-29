#!/usr/bin/env python3
"""
PvZH Cards Markdown Generator
读取 cards_raw.json，正确解析字段，生成 docs/Pvzh/cards.md
"""

import json
import os
import time

# 套组名映射
PACK_NAMES = {
    "Basic": "基础套组",
    "Premium": "高级套组",
    "Galactic": "银河套组",
    "Triassic": "三叠纪套组",
    "Colossal": "庞大套组",
    "Token": "代币",
    "Event": "活动卡",
    "Superpower": "超能力",
}

# 稀有度映射
RARITY_NAMES = {
    "Common": "普通",
    "Uncommon": "非普通",
    "Rare": "稀有",
    "Super-Rare": "超稀有",
    "Legendary": "传奇",
    "Token": "代币",
    "Event": "活动",
    "Superpower": "超能力",
    "Hero": "英雄",
}

# 植物色组
PLANT_CLASSES = {
    "Guardian": "守卫",
    "Kabloom": "大爆炸",
    "Mega-Grow": "超级生长",
    "Smarty": "聪慧",
    "Solar": "太阳",
}

# 僵尸色组
ZOMBIE_CLASSES = {
    "Beastly": "野蛮",
    "Brainy": "聪慧",
    "Crazy": "疯狂",
    "Hearty": "坚强",
    "Sneaky": "狡猾",
}

# 卡牌 tribe → 植物色组 推断表
TRIBE_TO_PLANT_CLASS = {
    # Guardian
    "Nut": "Guardian", "Cactus": "Guardian", "Wall": "Guardian",
    # Kabloom
    "Mushroom": "Kabloom", "Berry": "Kabloom", "Corn": "Kabloom",
    "Bomb": "Kabloom",
    # Mega-Grow
    "Pea": "Mega-Grow", "Bean": "Mega-Grow",
    # Smarty
    "Leafy": "Smarty", "Lily": "Smarty",
    # Solar
    "Flower": "Solar", "Sun": "Solar",
}

# 卡牌 tribe → 僵尸色组 推断表
TRIBE_TO_ZOMBIE_CLASS = {
    # Beastly
    "Pet": "Beastly", "Animal": "Beastly",
    # Brainy
    "Science": "Brainy", "Gargantuar": "Brainy",
    # Crazy
    "Dancing": "Crazy", "Sports": "Crazy",
    # Hearty
    "Pirate": "Hearty", "Knight": "Hearty",
    # Sneaky
    "Imp": "Sneaky", "Ninja": "Sneaky",
}


def parse_pack_rarity(key: str):
    """
    解析套组+稀有度字段名。
    'Basic - Common'                → pack='Basic',    rarity='Common'
    'Solar - Triassic - Super-Rare' → pack='Triassic', rarity='Super-Rare' (含色组前缀)
    'Token' / 'Event' / 'Superpower'→ 特殊处理
    """
    RARITY_WORDS = {"Common", "Uncommon", "Rare", "Super-Rare", "Legendary"}

    for special in ("Token", "Event", "Superpower"):
        if key == special:
            return special, special, PACK_NAMES.get(special, special), RARITY_NAMES.get(special, special)

    if " - " in key:
        rarity = key.rsplit(" - ", 1)[-1].strip()
        remainder = key.rsplit(" - ", 1)[0].strip()
        # remainder 可能是 "Pack" 或 "Class - Pack"，取最后一段作为pack
        pack = remainder.rsplit(" - ", 1)[-1].strip() if " - " in remainder else remainder
        pack_zh = PACK_NAMES.get(pack, pack)
        rarity_zh = RARITY_NAMES.get(rarity, rarity)
        return pack, rarity, pack_zh, rarity_zh

    return key, key, PACK_NAMES.get(key, key), RARITY_NAMES.get(key, key)


def normalize_raw_card(raw: dict) -> dict:
    """将原始 JSON 数据标准化为结构化卡牌字段"""
    card = {
        "name": "",
        "pack": "",
        "pack_zh": "",
        "rarity": "",
        "rarity_zh": "",
        "tribe": "",
        "ability": "",
        "cost": "",
        "strength": "",
        "health": "",
        "flavor": "",
        "section": raw.get("section", ""),
        "url": raw.get("_url", ""),
        "hero": raw.get("Hero", ""),
        "class": raw.get("Class", ""),
    }

    # === 英雄卡（有 Signature Superpower 字段，且没有 Hero 字段作为从属标记）===
    if "Name" in raw and "Heroes" in raw.get("section", "") and "Signature Superpower" in raw:
        card["name"] = raw.get("Name", "")
        card["tribe"] = "Hero"
        card["rarity"] = "Hero"
        card["rarity_zh"] = "英雄"
        sig = raw.get("Signature Superpower", "")
        others = raw.get("Other Superpowers", "")
        card["ability"] = sig + (" | 其他: " + others.replace("\n", ", ") if others else "")
        card["flavor"] = raw.get("Description", "")
        return card

    # === 超能力卡（section 是英雄列表，但有 Hero/Tribe/Ability/Cost 字段，是附属超能力卡）===
    if "Hero" in raw and "Ability" in raw and "Cost" in raw and "Heroes" in raw.get("section", ""):
        # 这是英雄的超能力卡，作为普通卡处理（rarity=Superpower）
        card["name"] = raw.get("Name", "")
        card["pack"] = "Superpower"
        card["pack_zh"] = "超能力"
        card["rarity"] = "Superpower"
        card["rarity_zh"] = "超能力"
        card["tribe"] = raw.get("Tribe", "")
        card["ability"] = raw.get("Ability", "")
        card["cost"] = raw.get("Cost", "")
        card["flavor"] = raw.get("Description", "")
        return card

    # === 普通可打卡牌 ===
    SKIP_KEYS = {"section", "_url", "Hero", "Class", "Name", "Pic", "Description",
                 "Tribe", "Ability", "Cost", "Superpower", "Token", "Event",
                 "Signature Superpower", "Other Superpowers"}
    RARITY_WORDS = {"Common", "Uncommon", "Rare", "Super-Rare", "Legendary",
                    "Token", "Event", "Superpower"}

    for key in raw.keys():
        if key in SKIP_KEYS or key.startswith("col_"):
            continue

        val = raw[key]
        if not val or not str(val).strip():
            continue

        # 判断是否为套组-稀有度格式的键
        is_pack_key = False
        if key in ("Token", "Event", "Superpower"):
            is_pack_key = True
        elif " - " in key:
            last_seg = key.rsplit(" - ", 1)[-1].strip()
            if last_seg in RARITY_WORDS:
                is_pack_key = True

        if is_pack_key:
            card["name"] = str(val).strip()
            pack, rarity, pack_zh, rarity_zh = parse_pack_rarity(key)
            card["pack"] = pack
            card["pack_zh"] = pack_zh
            card["rarity"] = rarity
            card["rarity_zh"] = rarity_zh
            break

    if not card["name"] and "Name" in raw:
        card["name"] = raw["Name"].strip()

    # 解析其他字段（优先用命名字段，否则用 col_N）
    card["tribe"]    = raw.get("Tribe",    raw.get("col_2", "")).strip()
    card["ability"]  = raw.get("Ability",  raw.get("col_3", "")).strip()
    card["cost"]     = raw.get("Cost",     raw.get("col_4", "")).strip()
    card["strength"] = raw.get("col_5", "").strip()
    card["health"]   = raw.get("col_6", "").strip()
    card["flavor"]   = raw.get("Description", raw.get("col_7", "")).strip()

    # 修正无属性标记
    for field in ("strength", "health"):
        if card[field] in ("-", "—", "–", "N/A", ""):
            card[field] = "-"

    return card


def build_card_list(raw_list: list) -> list:
    cards = []
    for raw in raw_list:
        c = normalize_raw_card(raw)
        if c["name"]:
            cards.append(c)
    return cards


def infer_class(card: dict, side: str) -> str:
    """推断卡牌色组"""
    # 直接有 class 字段
    cls = card.get("class", "")
    if cls:
        return cls

    # 从 pack 名推断
    pack = card.get("pack", "")
    class_map = PLANT_CLASSES if side == "plant" else ZOMBIE_CLASSES
    for known_cls in class_map:
        if known_cls.lower() in pack.lower():
            return known_cls

    # 从 tribe 推断
    tribe = card.get("tribe", "")
    tribe_map = TRIBE_TO_PLANT_CLASS if side == "plant" else TRIBE_TO_ZOMBIE_CLASS
    for tribe_key, cls_val in tribe_map.items():
        if tribe_key.lower() in tribe.lower():
            return cls_val

    return "Unknown"


def group_by_class(cards: list, class_map: dict, side: str) -> dict:
    groups = {cls: [] for cls in class_map}
    groups["Unknown"] = []
    for card in cards:
        cls = infer_class(card, side)
        matched = False
        for known_cls in class_map:
            if known_cls.lower() in cls.lower():
                groups[known_cls].append(card)
                matched = True
                break
        if not matched:
            groups["Unknown"].append(card)
    return groups


def render_card_row(card: dict) -> str:
    def clean(s):
        if not s:
            return "-"
        return s.replace("|", "\\|").replace("\n", " / ").strip()

    name = clean(card.get("name", ""))
    url = card.get("url", "")
    if url:
        base = "https://plantsvszombies.wiki.gg"
        if not url.startswith("http"):
            url = base + url
        name_cell = f"[{name}]({url})"
    else:
        name_cell = name

    cost     = clean(card.get("cost", ""))
    strength = clean(card.get("strength", ""))
    health   = clean(card.get("health", ""))
    tribe    = clean(card.get("tribe", ""))
    rarity   = card.get("rarity_zh") or card.get("rarity") or "-"
    pack     = card.get("pack_zh") or card.get("pack") or "-"
    ability  = clean(card.get("ability", ""))

    return f"| {name_cell} | {pack} | {rarity} | {cost} | {strength} | {health} | {tribe} | {ability} |"


TABLE_HEADER = (
    "| 卡牌名称 | 套组 | 稀有度 | 费用 | 攻击 | 生命 | 种族/类型 | 技能描述 |\n"
    "|---------|------|--------|------|------|------|-----------|----------|"
)


def sort_key(card: dict):
    cost = card.get("cost", "99")
    try:
        cost_int = int(cost)
    except Exception:
        cost_int = 99
    return (cost_int, card.get("name", ""))


def render_section(title: str, cards: list, level: int = 3) -> list:
    lines = []
    prefix = "#" * level
    lines.append(f"{prefix} {title}")
    lines.append("")
    if not cards:
        lines.append("*暂无数据*")
        lines.append("")
        return lines
    lines.append(TABLE_HEADER)
    for card in sorted(cards, key=sort_key):
        lines.append(render_card_row(card))
    lines.append("")
    return lines


def generate_markdown(plants: list, zombies: list) -> str:
    lines = []

    # 分开英雄和普通卡牌
    plant_heroes = [c for c in plants if c.get("rarity") == "Hero"]
    plant_cards  = [c for c in plants if c.get("rarity") != "Hero"]
    zombie_heroes = [c for c in zombies if c.get("rarity") == "Hero"]
    zombie_cards  = [c for c in zombies if c.get("rarity") != "Hero"]

    lines += [
        "# Plants vs. Zombies Heroes — 完整卡牌图鉴",
        "",
        "> **数据来源：** [plantsvszombies.wiki.gg](https://plantsvszombies.wiki.gg/wiki/Category:Cards)",
        f"> **更新时间：** {time.strftime('%Y-%m-%d')}",
        "> **说明：** 卡牌名称点击可跳转 Wiki 查看详情",
        "",
        "---",
        "",
        "## 目录",
        "",
        "- [游戏机制说明](#游戏机制说明)",
        "- [植物英雄](#植物英雄)",
        "- [植物卡牌](#植物卡牌)",
        "  - [Guardian 守卫](#guardian-守卫)",
        "  - [Kabloom 大爆炸](#kabloom-大爆炸)",
        "  - [Mega-Grow 超级生长](#mega-grow-超级生长)",
        "  - [Smarty 聪慧（植物）](#smarty-聪慧植物)",
        "  - [Solar 太阳](#solar-太阳)",
        "  - [未分类植物](#未分类植物)",
        "- [僵尸英雄](#僵尸英雄)",
        "- [僵尸卡牌](#僵尸卡牌)",
        "  - [Beastly 野蛮](#beastly-野蛮)",
        "  - [Brainy 聪慧（僵尸）](#brainy-聪慧僵尸)",
        "  - [Crazy 疯狂](#crazy-疯狂)",
        "  - [Hearty 坚强](#hearty-坚强)",
        "  - [Sneaky 狡猾](#sneaky-狡猾)",
        "  - [未分类僵尸](#未分类僵尸)",
        "",
        "---",
        "",
        "## 游戏机制说明",
        "",
        "### 基础规则",
        "",
        "- 这是一款**回合制数字卡牌对战游戏**，植物方 vs 僵尸方，各自控制一位英雄",
        "- **植物方** 使用 ☀️ **阳光(Sun)** 作为费用；**僵尸方** 使用 🧠 **脑子(Brains)** 作为费用",
        "- 每回合自动获得等同于回合数的费用（第1回合1点，第2回合2点，上限10点）",
        "- 流程：**植物方布置阶段 → 僵尸方布置阶段 → 战斗阶段**",
        "- 将对方英雄的 **20点生命值** 归零即获胜",
        "",
        "### 战场结构",
        "",
        "- 战场分为 **5条道路（Lane）**",
        "- 道路类型：**草地**、**水域**（需水陆两栖才能使用）、**天空**（需飞行/腾空单位）",
        "- 植物单位在己方道路阻挡对应道路的僵尸",
        "",
        "### 卡牌类型",
        "",
        "| 类型 | 说明 |",
        "|------|------|",
        "| **植物/僵尸单位** | 放置到道路上，有攻击力和生命值，在战斗阶段对抗 |",
        "| **招数 (Trick)** | 即发效果卡，使用后立刻生效，无单位形态 |",
        "| **环境 (Environment)** | 放置到道路上，持续提供增益或改变道路属性 |",
        "| **超能力 (Superpower)** | 英雄专属，费用为0，每局只能使用 **1次** |",
        "",
        "### 关键词大全",
        "",
        "| 关键词 | 说明 |",
        "|--------|------|",
        "| **Team-Up（协作）** | 可与其他单位共占同一格位，互不干扰 |",
        "| **Amphibious（水陆两栖）** | 可以放置在水域道路 |",
        "| **Bullseye（神射手）** | 战斗造成的伤害直接穿透打到敌方英雄 |",
        "| **Deadly（致命）** | 对任何单位造成伤害时，目标直接被消灭 |",
        "| **Armored X（装甲X）** | 每次受到的伤害减少X点（最低为0）|",
        "| **Strikethrough（贯穿）** | 消灭挡路的单位后，继续用剩余攻击力攻击英雄 |",
        "| **Overshoot X（越界X）** | 超出目标生命值的溢出伤害打到英雄 |",
        "| **Frenzy（狂暴）** | 可以攻击所有道路上的目标 |",
        "| **Splash Damage X（溅射X）** | 攻击时对相邻道路单位或英雄也造成X点伤害 |",
        "| **Untrickable（防招数）** | 招数卡不能以此单位为目标 |",
        "| **Hunt（追踪）** | 立刻移动到有僵尸的道路并攻击（仅植物）|",
        "| **Gravestone（墓碑）** | 战斗开始前以墓碑形式隐藏，战斗阶段才出现（仅僵尸）|",
        "| **When Played（登场触发）** | 放置到战场时触发一次效果 |",
        "| **When Hurt（受伤触发）** | 受到任何伤害时触发效果 |",
        "| **When Destroyed（死亡触发）** | 被消灭时触发效果 |",
        "| **Start of Turn（回合开始）** | 每回合开始时触发 |",
        "| **End of Turn（回合结束）** | 每回合结束时触发 |",
        "| **Conjure（随机生成）** | 随机生成一张符合条件的卡牌加入手牌 |",
        "| **Bounce（弹回）** | 将目标单位送回其主人手牌 |",
        "| **Freeze（冰冻）** | 被冻结的单位下回合无法攻击或阻挡 |",
        "| **Bonus Attack（额外攻击）** | 本回合获得额外攻击次数 |",
        "| **Fury（狂怒）** | 每消灭一个单位获得+1攻击/+1生命 |",
        "| **Fight（格斗）** | 立刻与目标单位战斗 |",
        "",
        "### 植物色组说明",
        "",
        "| 色组 | 英文 | 主要特色 |",
        "|------|------|----------|",
        "| 守卫 | Guardian | 坚果类高生命防御单位，护盾，控制 |",
        "| 大爆炸 | Kabloom | 爆炸/穿刺伤害，菇类和浆果类 |",
        "| 超级生长 | Mega-Grow | 强化友方，豌豆快速进攻 |",
        "| 聪慧 | Smarty | 弹回控制，绘制卡牌，百合科 |",
        "| 太阳 | Solar | 治疗英雄，产生额外阳光，花朵科 |",
        "",
        "### 僵尸色组说明",
        "",
        "| 色组 | 英文 | 主要特色 |",
        "|------|------|----------|",
        "| 野蛮 | Beastly | 强力动物单位，进攻导向 |",
        "| 聪慧 | Brainy | 科技与控制，弹回，巨人 |",
        "| 疯狂 | Crazy | 低费快攻，特殊移动，骨气 |",
        "| 坚强 | Hearty | 高生命值，装甲，海盗 |",
        "| 狡猾 | Sneaky | 墓碑隐身，飞行，忍者 |",
        "",
        "---",
        "",
    ]

    # ===== 植物英雄 =====
    lines += [
        "## 植物英雄",
        "",
        f"> 共 **{len(plant_heroes)}** 位植物英雄",
        "",
        "| 英雄名称 | 签名超能力 | 其他超能力 |",
        "|---------|-----------|------------|",
    ]
    for h in plant_heroes:
        name = h.get("name", "")
        url = h.get("url", "")
        if url and not url.startswith("http"):
            url = "https://plantsvszombies.wiki.gg" + url
        name_cell = f"[{name}]({url})" if url else name
        ability = h.get("ability", "")
        # 分离签名和其他
        if " | 其他: " in ability:
            sig, others = ability.split(" | 其他: ", 1)
        else:
            sig = ability
            others = "-"
        sig = sig.replace("|", "\\|")
        others = others.replace("|", "\\|")
        lines.append(f"| {name_cell} | {sig} | {others} |")
    lines.append("")
    lines += ["---", ""]

    # ===== 植物卡牌 =====
    lines += [
        "## 植物卡牌",
        "",
        f"> 共收录 **{len(plant_cards)}** 张植物可打卡牌",
        "",
    ]
    plant_groups = group_by_class(plant_cards, PLANT_CLASSES, "plant")
    for cls_en, cls_zh in PLANT_CLASSES.items():
        group = plant_groups.get(cls_en, [])
        lines += render_section(f"{cls_en} {cls_zh}（{len(group)} 张）", group, level=3)

    unknown_plants = plant_groups.get("Unknown", [])
    if unknown_plants:
        lines += render_section(f"未分类植物（{len(unknown_plants)} 张）", unknown_plants, level=3)

    lines += ["---", ""]

    # ===== 僵尸英雄 =====
    lines += [
        "## 僵尸英雄",
        "",
        f"> 共 **{len(zombie_heroes)}** 位僵尸英雄",
        "",
        "| 英雄名称 | 签名超能力 | 其他超能力 |",
        "|---------|-----------|------------|",
    ]
    for h in zombie_heroes:
        name = h.get("name", "")
        url = h.get("url", "")
        if url and not url.startswith("http"):
            url = "https://plantsvszombies.wiki.gg" + url
        name_cell = f"[{name}]({url})" if url else name
        ability = h.get("ability", "")
        if " | 其他: " in ability:
            sig, others = ability.split(" | 其他: ", 1)
        else:
            sig = ability
            others = "-"
        sig = sig.replace("|", "\\|")
        others = others.replace("|", "\\|")
        lines.append(f"| {name_cell} | {sig} | {others} |")
    lines.append("")
    lines += ["---", ""]

    # ===== 僵尸卡牌 =====
    lines += [
        "## 僵尸卡牌",
        "",
        f"> 共收录 **{len(zombie_cards)}** 张僵尸可打卡牌",
        "",
    ]
    zombie_groups = group_by_class(zombie_cards, ZOMBIE_CLASSES, "zombie")
    for cls_en, cls_zh in ZOMBIE_CLASSES.items():
        group = zombie_groups.get(cls_en, [])
        lines += render_section(f"{cls_en} {cls_zh}（{len(group)} 张）", group, level=3)

    unknown_zombies = zombie_groups.get("Unknown", [])
    if unknown_zombies:
        lines += render_section(f"未分类僵尸（{len(unknown_zombies)} 张）", unknown_zombies, level=3)

    lines += [
        "---",
        "",
        "## 附注",
        "",
        "- **-** 表示该卡牌无此属性（如招数无攻击/生命值）",
        "- 色组分类依据套组名称或种族类型推断，如有偏差请参考 Wiki",
        "- 卡牌名称带超链接，点击可跳转到官方 Wiki 查看详细数据与图片",
        "",
    ]

    return "\n".join(lines)


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, "cards_raw.json")
    # 输出到 scraper 上一层目录的 cards.md
    output_path = os.path.normpath(os.path.join(script_dir, "..", "cards.md"))

    print("📂 读取原始数据...")
    with open(json_path, encoding="utf-8") as f:
        raw = json.load(f)

    print("🌿 标准化植物卡牌...")
    plants = build_card_list(raw.get("plants", []))
    plant_heroes = [c for c in plants if c.get("rarity") == "Hero"]
    plant_cards  = [c for c in plants if c.get("rarity") != "Hero"]
    print(f"   英雄: {len(plant_heroes)} 位  |  可打卡牌: {len(plant_cards)} 张")

    print("🧟 标准化僵尸卡牌...")
    zombies = build_card_list(raw.get("zombies", []))
    zombie_heroes = [c for c in zombies if c.get("rarity") == "Hero"]
    zombie_cards  = [c for c in zombies if c.get("rarity") != "Hero"]
    print(f"   英雄: {len(zombie_heroes)} 位  |  可打卡牌: {len(zombie_cards)} 张")

    print("\n📋 植物卡样例（前5张）：")
    for c in plant_cards[:5]:
        print(f"  [{c['pack_zh']}/{c['rarity_zh']}] {c['name']} | {c['cost']}费 | {c['strength']}/{c['health']} | {c['tribe']} | {c['ability'][:50]}")

    print("\n📋 僵尸卡样例（前5张）：")
    for c in zombie_cards[:5]:
        print(f"  [{c['pack_zh']}/{c['rarity_zh']}] {c['name']} | {c['cost']}费 | {c['strength']}/{c['health']} | {c['tribe']} | {c['ability'][:50]}")

    print("\n✍️  生成 Markdown...")
    md = generate_markdown(plants, zombies)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(md)

    size_kb = os.path.getsize(output_path) // 1024
    print(f"\n✅ 完成！")
    print(f"   输出路径: {output_path}")
    print(f"   文件大小: {size_kb} KB")
    print(f"   总卡牌数: {len(plants) + len(zombies)} 张（植物{len(plants)} + 僵尸{len(zombies)}）")


if __name__ == "__main__":
    main()
