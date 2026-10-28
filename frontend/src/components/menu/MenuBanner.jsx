import "./MenuBanner.css"

/**
 * MenuBanner
 * 레퍼런스 ./frontend/kiosk.css (.order-image-banner) 기준
 * 상단 프로모션 배너 (public/start-cafe-editorial.png 활용)
 *
 * Props:
 *   title      {string} 배너 텍스트 (기본: "모그커피 메뉴")
 *   imageSrc   {string} 배너 이미지 URL (기본: "/start-cafe-editorial.png")
 *   alt        {string} 이미지 대체 텍스트
 */
function MenuBanner({
    title = "모그커피 메뉴",
    imageSrc = "/start-cafe-editorial.png",
    alt = "모그커피 배너 이미지",
}) {
    return (
        <aside className="order-image-banner" aria-label={title}>
            <img src={imageSrc} alt={alt} />
            <span>{title}</span>
        </aside>
    )
}

export default MenuBanner
