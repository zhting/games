# 顶栏图标 v2

使用内置 image_gen 分别生成两个透明图标，依据用户的设计图。用 Sharp 裁去外围空白、统一为 192×192，保留透明 alpha。

最终文件：
- `H:/project/games/games/gandengyan/public/assets/layers/hud-icons-v2/tutorial.png`
- `H:/project/games/games/gandengyan/public/assets/layers/hud-icons-v2/help.png`

接入：首页顶部栏使用图片替换字符图标；英雄榜、接任务通过共用顶部栏自动同步。CSS：`public/css/topbar-icons-v2.css`。

## 新手指导

原始输出：`C:/Users/zhting/.codex/generated_images/01a10a5b-000a-79a0-a416-c5b598586305/exec-04755889-8e23-4e9a-97d4-1cef64d19212.png`

最终提示词：

Use case: ui-mockup. Asset type: one standalone transparent game HUD icon. The attached screenshot is a visual reference: reproduce ONLY the circular hand icon to the left of 新手指导. Front view. A thin complete circular outline enclosing the line outline of an upright open palm with five fingers, thumb gently curving out on the left, vertical fingers pointing upward, wrist ending with a rounded bottom. Match its simple legible silhouette. Use pale desaturated ice cyan / silver blue lines (#8ec4d1 family) with a tiny metallic bevel, understated shading. Dark areas are holes with genuine transparency: no filled disk behind the hand, no background behind the circular rim, transparent surrounding canvas. Uniform moderately thin line weight, finely rounded edges, no bulky ornament, no added rings. Center the hand within the circle with generous internal spacing, perfectly circular outer ring. Designed to remain readable when reduced to 36 by 36 pixels. Icon alone occupies most of a square canvas, small equal margins. No text, no lettering, no button plate, no screenshot, no realistic skin, no realistic hand, no neon halo or rays, no extra decoration.

## 帮助

原始输出：`C:/Users/zhting/.codex/generated_images/01a10a5b-000a-79a0-a416-c5b598586305/exec-c10bcc8d-4d29-42cd-9a7b-770d803f8cf8.png`

最终提示词：

Use case: ui-mockup. Asset type: one standalone transparent game HUD HELP icon. Input image 1 is the design reference screenshot: reproduce ONLY the circular open-book icon immediately left of 帮助. Input image 2 is the newly generated tutorial hand icon: match its pale silver ice-blue material, circular rim thickness and restrained bevel so these two icons form a matching pair. Front orthographic view. One simple complete circle enclosing a symmetric open book line outline. The book has two gently curved open pages, a vertical center spine, straight outer vertical page edges and slightly curved lower page edges. Keep the interior minimal and empty with no page text or horizontal lines. Pale desaturated ice cyan / silver blue thin lines, tiny metallic bevel and understated shading, finely rounded clean edges. The circle and book outlines should be about 4 percent of the outer circle diameter in thickness. Circle occupies most of a square canvas with small equal margins. The book fits centered at about 60 percent of the circle width and 44 percent of the circle height. True transparent alpha background: outside the circle and all empty areas inside the circle and between the book outlines must be transparent, no filled circular disk. Legible at 36 by 36 pixels. No text, no lettering, no words, no button plate, no screenshot, no neon halo, no rays, no extra rings or ornaments.
