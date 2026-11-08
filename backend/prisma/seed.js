const db = require("../src/db");
const menus = require("../src/data/menus");

async function seed() {
  await db.$transaction(menus.map((menu) => db.menu.upsert({
    where: { id: menu.id },
    create: menu,
    update: {}
  })));
  console.log(`기본 메뉴 ${menus.length}개를 확인했습니다.`);
}

seed().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
