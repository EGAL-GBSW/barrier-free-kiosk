const menus = [
  {
    id: 1,
    name: "아메리카노",
    price: 3000,
    category: "coffee",
    description: "깊고 진한 에스프레소, 깔끔하게 남는 여운.",
    badge: "BEST",
    temperatures: ["ICE", "HOT"]
  },
  {
    id: 2,
    name: "바닐라 크림 라떼",
    price: 4900,
    category: "coffee",
    description: "부드러운 바닐라 크림과 에스프레소의 달콤한 만남.",
    badge: "NEW",
    temperatures: ["ICE", "HOT"]
  },
  {
    id: 3,
    name: "카페 라떼",
    price: 4200,
    category: "coffee",
    description: "고소한 우유에 풍부한 에스프레소를 더했어요.",
    badge: null,
    temperatures: ["ICE", "HOT"]
  },
  {
    id: 4,
    name: "제주 말차 라떼",
    price: 5200,
    category: "noncoffee",
    description: "제주 말차의 진한 풍미와 우유의 부드러움.",
    badge: "BEST",
    temperatures: ["ICE", "HOT"]
  },
  {
    id: 5,
    name: "리얼 딸기 밀크",
    price: 5500,
    category: "noncoffee",
    description: "진짜 딸기 과육을 가득 담은 딸기 우유.",
    badge: "NEW",
    temperatures: ["ICE"]
  },
  {
    id: 6,
    name: "딥 초코 프라페",
    price: 5800,
    category: "frappe",
    description: "진한 초콜릿과 달콤한 크림을 시원하게 즐겨요.",
    badge: null,
    temperatures: ["ICE"]
  },
  {
    id: 7,
    name: "생딸기 케이크",
    price: 6500,
    category: "bakery",
    description: "폭신한 시트 사이로 생크림과 상큼한 딸기.",
    badge: "BEST",
    temperatures: []
  },
  {
    id: 8,
    name: "버터 크루아상",
    price: 3800,
    category: "bakery",
    description: "겹겹이 바삭하게 퍼지는 버터 향.",
    badge: null,
    temperatures: []
  },
  {
    id: 9,
    name: "바스크 치즈케이크",
    price: 5900,
    category: "bakery",
    description: "짙게 구운 표면 속 부드럽고 진한 치즈.",
    badge: "NEW",
    temperatures: []
  }
];

module.exports = menus;