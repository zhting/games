# 倒计时底座 v2

使用内置 image_gen 生成透明 PNG，参考用户提供的设计图。外壳与左右连接件使用生成素材，数字、进度条和上层圆盘由 ui.js 实时绘制。进度条侧面与接触阴影均为暗色。

## 最终提示词

Use case: stylized-concept.
Asset type: production transparent PNG sprite, circular countdown housing for a 2.5D sci-fi card game.
Input image: reference only, match the gray-blue round timer housing and the horizontal connector behind it, not the cropped star background or numbers.
Generate ONE complete isolated timer BASE HOUSING, orthographic front view, centered on 1024x1024 transparent canvas. Main circular housing center exactly (512,512), outer radius approximately 360 pixels. Chunky smooth rounded blue-gray steel circular outer bezel, wide matte curved bevel, pale silver blue top-left and subdued slate-blue lower-right, close to the reference's soft dimensional painted game art. Behind the circle, a short broad hexagonal backing plate visible at four corners, and a horizontal mechanical connecting shaft running behind the circle left to right. Both ends visible, x=60..160 and x=864..964, aligned at y=512, cylindrical dark graphite coupling ends, short silver gray shoulder collars, simple shapes matching the reference. Shaft thickness around 200 pixels. Entire object uncropped.
Inside outer circular bezel: recessed dark desaturated blue-gray circular well, radius about 270 pixels, broad and EMPTY for a dynamic progress ring and a separate central silver disc to be drawn by code later. Make the well flat and clean enough to overlay animation, with narrow DARK contact shading where it meets the bezel.
No center disc and no blue/cyan ring; those are live overlays. No digits, letters, logos, screws, extra gadgets, neon, chrome sparkle, white rim around the recess, harsh black drop shadows, star background or ground.
Material: softly shaded brushed/painted steel with convincing rounded thickness, simple restrained reference-like 2010s game GUI; avoid flat vector styling. Actual transparent alpha background. No text.
