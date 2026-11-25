"""메뉴 원본에 명시된 속성으로 추천 후보를 좁힌다."""

# 취향은 성분 분석값이 아니라, 메뉴 이름과 설명에 실제 적힌 표현이다.
TASTE_WORDS = {
    "sweet": ("달콤", "달달"),
    "chocolate": ("초코", "초콜릿"),
    "strawberry": ("딸기",),
    "mild": ("부드러", "고소"),
    "crispy": ("바삭",),
}


def enrich_menu(menu):
    """백엔드가 준 이름·설명을 기준으로 검색용 속성을 만들고 원본은 보존한다."""
    enriched = dict(menu)
    text = f"{menu.get('name', '')} {menu.get('description') or ''}"
    enriched["taste_tags"] = [tag for tag, words in TASTE_WORDS.items()
                              if any(word in text for word in words)]
    # 카페인·알레르기·원재료는 이 태그에서 추론하지 않는다.
    return enriched


def filter_menus(menus, preferences):
    """확인 가능한 정형 조건과 명시된 설명 태그만 사용한다."""
    candidates = []
    for menu in menus.values():
        category = menu["category"]
        if preferences.get("category") and category != preferences["category"]:
            continue
        if category in preferences.get("exclude_categories", []):
            continue
        if preferences.get("kind") == "drink" and category == "bakery":
            continue
        if preferences.get("kind") == "bakery" and category != "bakery":
            continue
        if preferences.get("temperature") and preferences["temperature"] not in menu["temperatures"]:
            continue
        if preferences.get("max_price") is not None and menu["price"] > preferences["max_price"]:
            continue
        if any(taste not in menu["taste_tags"] for taste in preferences.get("tastes", [])):
            continue
        candidates.append(menu["name"])
    return candidates
