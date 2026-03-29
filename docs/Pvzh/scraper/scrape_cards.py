#!/usr/bin/env python3
"""
PvZH Card Scraper
从 plantsvszombies.wiki.gg 抓取所有 Plants vs. Zombies Heroes 卡牌数据
"""

import urllib.request
import urllib.error
import json
import time
import re
import os
from html.parser import HTMLParser

BASE_URL = "https://plantsvszombies.wiki.gg"

# 要抓取的页面列表（植物和僵尸卡牌主页面）
CARD_PAGES = [
    "/wiki/Plants_(PvZH)",
    "/wiki/Zombies_(PvZH)",
    "/wiki/Tricks_(PvZH)",
    "/wiki/Environments_(PvZH)",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; PvZH-Card-Scraper/1.0)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch_page(url: str) -> str:
    """抓取页面 HTML"""
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            content = response.read()
            # 尝试检测编码
            charset = "utf-8"
            ct = response.headers.get("Content-Type", "")
            if "charset=" in ct:
                charset = ct.split("charset=")[-1].strip()
            return content.decode(charset, errors="replace")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {url}")
        return ""
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return ""


def strip_html_tags(text: str) -> str:
    """移除 HTML 标签"""
    # 先把 <br> 换成换行
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    # 移除所有其他标签
    text = re.sub(r"<[^>]+>", "", text)
    # 解码常见 HTML 实体
    entities = {
        "&amp;": "&", "&lt;": "<", "&gt;": ">",
        "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
        "&#160;": " ",
    }
    for entity, char in entities.items():
        text = text.replace(entity, char)
    return text.strip()


class TableParser(HTMLParser):
    """解析 wiki 页面中的卡牌表格"""

    def __init__(self):
        super().__init__()
        self.cards = []
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.current_row = []
        self.current_cell_html = ""
        self.headers = []
        self.current_section = ""
        self.cell_depth = 0  # 嵌套表格深度
        self.table_depth = 0
        self._raw_cell = ""

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "table":
            self.table_depth += 1
            cls = attrs_dict.get("class", "")
            if "wikitable" in cls and self.table_depth == 1:
                self.in_table = True
                self.headers = []
        elif tag in ("h2", "h3", "h4"):
            self.current_section = ""
        elif self.in_table and self.table_depth == 1:
            if tag == "tr":
                self.in_row = True
                self.current_row = []
            elif tag in ("th", "td") and self.in_row:
                self.in_cell = True
                self.cell_depth = 1
                self._raw_cell = f"<{tag}>"
            elif self.in_cell:
                self._raw_cell += f"<{tag}>"
                self.cell_depth += 1

    def handle_endtag(self, tag):
        if tag == "table":
            if self.in_table and self.table_depth == 1:
                self.in_table = False
            self.table_depth -= 1
        elif self.in_table and self.table_depth == 1:
            if tag == "tr" and self.in_row:
                self.in_row = False
                if self.current_row:
                    if all(c.strip().startswith("<th>") or not c.strip() for c in self.current_row):
                        # 这是表头行
                        self.headers = [strip_html_tags(c) for c in self.current_row]
                    elif self.headers:
                        # 数据行
                        card = {}
                        for i, cell in enumerate(self.current_row):
                            if i < len(self.headers) and self.headers[i]:
                                card[self.headers[i]] = strip_html_tags(cell)
                        if card:
                            card["_section"] = self.current_section
                            self.cards.append(card)
                self.current_row = []
            elif tag in ("th", "td") and self.in_cell:
                self.cell_depth -= 1
                if self.cell_depth == 0:
                    self.in_cell = False
                    self.current_row.append(self._raw_cell)
                    self._raw_cell = ""
            elif self.in_cell:
                self._raw_cell += f"</{tag}>"
                self.cell_depth -= 1

    def handle_data(self, data):
        if self.in_cell:
            self._raw_cell += data
        # 尝试捕获章节标题
        if not self.in_table:
            stripped = data.strip()
            if stripped and len(stripped) > 2:
                self.current_section = stripped


def parse_cards_from_html(html: str) -> list:
    """从 HTML 中提取卡牌数据"""
    parser = TableParser()
    # 先提取章节标题
    sections = re.findall(r'<h[234][^>]*>\s*<span[^>]*>(.*?)</span>', html, re.DOTALL)

    parser.feed(html)
    return parser.cards


def fetch_card_detail(card_url: str) -> dict:
    """抓取单张卡牌的详细页面"""
    if not card_url.startswith("http"):
        card_url = BASE_URL + card_url
    html = fetch_page(card_url)
    if not html:
        return {}

    detail = {}

    # 提取卡牌信息框
    infobox_match = re.search(r'<table[^>]*class="[^"]*infobox[^"]*"[^>]*>(.*?)</table>',
                               html, re.DOTALL | re.IGNORECASE)
    if infobox_match:
        infobox_html = infobox_match.group(1)
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', infobox_html, re.DOTALL)
        for row in rows:
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL)
            if len(cells) >= 2:
                key = strip_html_tags(cells[0]).strip()
                val = strip_html_tags(cells[1]).strip()
                if key and val:
                    detail[key] = val

    # 提取卡牌描述/能力文字
    desc_patterns = [
        r'<div[^>]*class="[^"]*card-text[^"]*"[^>]*>(.*?)</div>',
        r'<p[^>]*class="[^"]*flavor[^"]*"[^>]*>(.*?)</p>',
        r'==\s*(?:Description|Ability|Effect)\s*==(.*?)(?:==|\Z)',
    ]
    for pat in desc_patterns:
        m = re.search(pat, html, re.DOTALL | re.IGNORECASE)
        if m:
            detail["ability_text"] = strip_html_tags(m.group(1)).strip()
            break

    return detail


def scrape_card_list_page(path: str) -> list:
    """抓取卡牌列表页面（Plants/Zombies/Tricks/Environments）"""
    url = BASE_URL + path
    print(f"\n正在抓取: {url}")
    html = fetch_page(url)
    if not html:
        print("  ❌ 页面获取失败")
        return []

    # 提取所有 wikitable 中的数据
    cards = []

    # 找所有的 wikitable
    table_pattern = re.compile(
        r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>',
        re.DOTALL | re.IGNORECASE
    )

    # 同时提取章节标题
    # 将 HTML 分成章节
    section_splits = re.split(r'(<h[234][^>]*>.*?</h[234]>)', html, flags=re.DOTALL | re.IGNORECASE)

    current_section = "General"

    for chunk in section_splits:
        # 检查是否是标题
        h_match = re.match(r'<h[234][^>]*>(.*?)</h[234]>', chunk, re.DOTALL | re.IGNORECASE)
        if h_match:
            current_section = strip_html_tags(h_match.group(1)).strip()
            # 清理编辑链接等
            current_section = re.sub(r'\[edit\].*', '', current_section).strip()
            continue

        # 在此 chunk 中找表格
        for table_match in table_pattern.finditer(chunk):
            table_html = table_match.group(1)
            rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL | re.IGNORECASE)

            headers = []
            for row in rows:
                cells_raw = re.findall(r'<(th|td)[^>]*>(.*?)</(th|td)>', row, re.DOTALL | re.IGNORECASE)
                if not cells_raw:
                    continue

                cell_types = [c[0].lower() for c in cells_raw]
                cell_values = [strip_html_tags(c[1]) for c in cells_raw]

                if all(t == "th" for t in cell_types) or (headers == [] and "th" in cell_types):
                    headers = cell_values
                    continue

                if headers and cell_values:
                    card = {"section": current_section}
                    for i, val in enumerate(cell_values):
                        if i < len(headers) and headers[i]:
                            card[headers[i]] = val
                        else:
                            card[f"col_{i}"] = val

                    # 提取卡牌链接
                    links = re.findall(r'<td[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', row, re.DOTALL | re.IGNORECASE)
                    if links:
                        card["_url"] = links[0][0]

                    if any(v.strip() for v in card.values() if isinstance(v, str)):
                        cards.append(card)

    print(f"  ✅ 找到 {len(cards)} 张卡牌")
    return cards


def normalize_card(card: dict, card_type: str) -> dict:
    """标准化卡牌数据字段名"""
    normalized = {
        "name": "",
        "type": card_type,
        "cost": "",
        "strength": "",
        "health": "",
        "tribes": "",
        "rarity": "",
        "class": "",
        "abilities": "",
        "section": card.get("section", ""),
    }

    # 映射各种可能的字段名
    field_map = {
        "name": ["Name", "Card", "name", "Card Name"],
        "cost": ["Cost", "Sun", "Brains", "Sun Cost", "Brain Cost", "cost"],
        "strength": ["Strength", "Attack", "ATK", "Power", "strength"],
        "health": ["Health", "HP", "DEF", "health"],
        "tribes": ["Tribes", "Tribe", "Type", "Card Type", "tribes"],
        "rarity": ["Rarity", "rarity"],
        "class": ["Class", "Faction", "Color", "class"],
        "abilities": ["Abilities", "Ability", "Text", "Effect", "Description", "abilities"],
    }

    for norm_key, possible_keys in field_map.items():
        for pk in possible_keys:
            if pk in card and card[pk].strip():
                normalized[norm_key] = card[pk].strip()
                break
        # 如果还没找到，尝试不区分大小写
        if not normalized[norm_key]:
            for ck, cv in card.items():
                if ck.lower() == norm_key.lower() or ck.lower() in [pk.lower() for pk in possible_keys]:
                    if isinstance(cv, str) and cv.strip():
                        normalized[norm_key] = cv.strip()
                        break

    return normalized


def cards_to_markdown(all_cards: dict) -> str:
    """将卡牌数据转换为 Markdown 格式"""

    md_lines = [
        "# Plants vs. Zombies Heroes - 完整卡牌列表",
        "",
        "> 数据来源：[plantsvszombies.wiki.gg](https://plantsvszombies.wiki.gg/wiki/Category:Cards)",
        f"> 生成时间：{time.strftime('%Y-%m-%d')}",
        "",
        "## 目录",
        "",
        "- [游戏机制说明](#游戏机制说明)",
        "- [植物卡牌](#植物卡牌)",
        "  - [Guardian（守卫）](#guardian守卫)",
        "  - [Kabloom（大爆炸）](#kabloom大爆炸)",
        "  - [Mega-Grow（超级生长）](#mega-grow超级生长)",
        "  - [Smarty（聪慧）](#smarty聪慧)",
        "  - [Solar（太阳）](#solar太阳)",
        "- [僵尸卡牌](#僵尸卡牌)",
        "  - [Beastly（野蛮）](#beastly野蛮)",
        "  - [Brainy（聪慧）](#brainy聪慧)",
        "  - [Crazy（疯狂）](#crazy疯狂)",
        "  - [Hearty（坚强）](#hearty坚强)",
        "  - [Sneaky（狡猾）](#sneaky狡猾)",
        "- [招数卡牌](#招数卡牌)",
        "- [环境卡牌](#环境卡牌)",
        "",
        "---",
        "",
        "## 游戏机制说明",
        "",
        "### 基础规则",
        "- **植物方** 使用 **阳光(Sun)** 作为费用资源",
        "- **僵尸方** 使用 **脑子(Brains)** 作为费用资源",
        "- 每回合自动获得与回合数等量的费用（第1回合1点，第2回合2点……上限为10）",
        "- 植物方先布置，僵尸方后布置，然后战斗阶段",
        "",
        "### 卡牌类型",
        "| 类型 | 说明 |",
        "|------|------|",
        "| **植物/僵尸单位** | 放置在战场上进行战斗的单位卡，有攻击力和生命值 |",
        "| **招数 (Trick)** | 即时效果卡，使用后直接产生效果 |",
        "| **环境 (Environment)** | 放置在某条道路上，持续提供效果 |",
        "| **超能力 (Superpower)** | 英雄专属技能，费用为0，每局只能用1次 |",
        "",
        "### 常见关键词",
        "| 关键词 | 说明 |",
        "|--------|------|",
        "| **Team-Up（协作）** | 可以与其他单位共享同一格位 |",
        "| **Bullseye（神射手）** | 伤害直接穿透，打到英雄身上 |",
        "| **Amphibious（水陆两栖）** | 可以放置在水域格 |",
        "| **Deadly（致命）** | 对任何单位造成伤害时，目标直接死亡 |",
        "| **Armored X（装甲X）** | 每次受到的伤害减少X点 |",
        "| **Strikethrough（贯穿）** | 战斗后继续攻击英雄 |",
        "| **Overshoot X（越界X）** | 攻击超出目标生命值的伤害打到英雄 |",
        "| **Frenzy（狂暴）** | 可以攻击所有道路上的目标 |",
        "| **Splash Damage X（溅射X）** | 攻击时对相邻道路也造成X点伤害 |",
        "| **When Hurt（受伤触发）** | 受到伤害时触发效果 |",
        "| **When Destroyed（死亡触发）** | 被消灭时触发效果 |",
        "| **When Played（登场触发）** | 放置到战场时触发效果 |",
        "| **Start of Turn（回合开始触发）** | 每回合开始时触发 |",
        "| **End of Turn（回合结束触发）** | 每回合结束时触发 |",
        "| **Conjure（随机生成）** | 随机生成一张特定类型的卡牌 |",
        "| **Bounce（弹回）** | 将单位送回手牌 |",
        "| **Freeze（冰冻）** | 被冰冻的单位无法攻击或阻挡 |",
        "| **Bonus Attack（额外攻击）** | 获得额外攻击次数 |",
        "| **Untrickable（防招数）** | 招数不能以此单位为目标 |",
        "| **Hunt（追踪）** | 立刻移动到有僵尸的道路并攻击（植物专属）|",
        "| **Gravestone（墓碑）** | 僵尸专属，战斗开始时才从墓碑中出现 |",
        "",
        "### 道路与战场",
        "- 战场分为 **5条道路**",
        "- 不同道路类型：草地、水域、天空",
        "- 水域道路只有两栖单位才能占据",
        "",
        "---",
        "",
    ]

    # 植物卡牌部分
    plant_classes = {
        "Guardian": "守卫",
        "Kabloom": "大爆炸",
        "Mega-Grow": "超级生长",
        "Smarty": "聪慧",
        "Solar": "太阳",
    }

    zombie_classes = {
        "Beastly": "野蛮",
        "Brainy": "聪慧",
        "Crazy": "疯狂",
        "Hearty": "坚强",
        "Sneaky": "狡猾",
    }

    def render_card_table(cards_list, cost_label="费用"):
        lines = []
        if not cards_list:
            lines.append("*暂无数据*\n")
            return lines
        lines.append(f"| 卡牌名称 | {cost_label} | 攻击 | 生命 | 类型/种族 | 稀有度 | 技能/描述 |")
        lines.append("|---------|------|------|------|-----------|--------|-----------|")
        for c in cards_list:
            name = c.get("name", "").replace("|", "\\|")
            cost = c.get("cost", "-")
            strength = c.get("strength", "-")
            health = c.get("health", "-")
            tribes = c.get("tribes", "-").replace("|", "\\|")
            rarity = c.get("rarity", "-")
            abilities = c.get("abilities", "").replace("|", "\\|").replace("\n", " ")
            if not name:
                continue
            lines.append(f"| {name} | {cost} | {strength} | {health} | {tribes} | {rarity} | {abilities} |")
        lines.append("")
        return lines

    # 植物卡牌
    md_lines.append("## 植物卡牌")
    md_lines.append("")
    md_lines.append("植物方使用**阳光(Sun)**作为费用资源。")
    md_lines.append("")

    plant_cards = all_cards.get("plants", [])
    for cls_en, cls_zh in plant_classes.items():
        md_lines.append(f"### {cls_en}（{cls_zh}）")
        md_lines.append("")
        # 按 section 筛选（section 通常对应 class）
        filtered = [c for c in plant_cards if cls_en.lower() in c.get("section", "").lower()
                    or cls_en.lower() in c.get("class", "").lower()]
        if not filtered:
            filtered = plant_cards  # 如果没有分类信息就全部显示一次（仅第一次）
        md_lines.extend(render_card_table(filtered, "阳光费用"))

    # 如果没有分类，直接显示全部
    if not any(c.get("section") for c in plant_cards):
        md_lines.append("### 全部植物卡牌")
        md_lines.append("")
        md_lines.extend(render_card_table(plant_cards, "阳光费用"))

    md_lines.append("---")
    md_lines.append("")

    # 僵尸卡牌
    md_lines.append("## 僵尸卡牌")
    md_lines.append("")
    md_lines.append("僵尸方使用**脑子(Brains)**作为费用资源。")
    md_lines.append("")

    zombie_cards = all_cards.get("zombies", [])
    for cls_en, cls_zh in zombie_classes.items():
        md_lines.append(f"### {cls_en}（{cls_zh}）")
        md_lines.append("")
        filtered = [c for c in zombie_cards if cls_en.lower() in c.get("section", "").lower()
                    or cls_en.lower() in c.get("class", "").lower()]
        if not filtered:
            filtered = zombie_cards
        md_lines.extend(render_card_table(filtered, "脑子费用"))

    if not any(c.get("section") for c in zombie_cards):
        md_lines.append("### 全部僵尸卡牌")
        md_lines.append("")
        md_lines.extend(render_card_table(zombie_cards, "脑子费用"))

    md_lines.append("---")
    md_lines.append("")

    # 招数卡牌
    md_lines.append("## 招数卡牌")
    md_lines.append("")
    tricks = all_cards.get("tricks", [])
    md_lines.extend(render_card_table(tricks))

    md_lines.append("---")
    md_lines.append("")

    # 环境卡牌
    md_lines.append("## 环境卡牌")
    md_lines.append("")
    envs = all_cards.get("environments", [])
    md_lines.extend(render_card_table(envs))

    return "\n".join(md_lines)


def main():
    print("=" * 60)
    print("PvZH Card Scraper - 开始抓取卡牌数据")
    print("=" * 60)

    all_cards = {
        "plants": [],
        "zombies": [],
        "tricks": [],
        "environments": [],
    }

    page_map = {
        "/wiki/Plants_(PvZH)": "plants",
        "/wiki/Zombies_(PvZH)": "zombies",
        "/wiki/Tricks_(PvZH)": "tricks",
        "/wiki/Environments_(PvZH)": "environments",
    }

    for path, key in page_map.items():
        cards = scrape_card_list_page(path)
        if cards:
            all_cards[key] = cards
        else:
            print(f"  ⚠️  {path} 没有获取到数据，尝试备用解析...")
        time.sleep(1)  # 礼貌性延迟

    # 统计
    total = sum(len(v) for v in all_cards.values())
    print(f"\n📊 抓取统计:")
    for k, v in all_cards.items():
        print(f"   {k}: {len(v)} 张")
    print(f"   总计: {total} 张")

    # 保存原始 JSON（调试用）
    json_path = os.path.join(os.path.dirname(__file__), "cards_raw.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_cards, f, ensure_ascii=False, indent=2)
    print(f"\n💾 原始数据已保存至: {json_path}")

    # 转换并保存 Markdown
    md_content = cards_to_markdown(all_cards)
    output_path = os.path.join(os.path.dirname(__file__), "..", "cards.md")
    output_path = os.path.normpath(output_path)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"📄 Markdown 文件已生成: {output_path}")

    return all_cards


if __name__ == "__main__":
    main()
