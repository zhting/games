# 牌底 v4：加宽与边缘厚度

使用内置 image_gen 编辑 v3 牌底，保留切角与中段内收轮廓，补入右侧和底部叠层、浅蓝亮边、钢蓝倒角和深蓝外缘。

新素材：card-face-v4.png（952 × 1422，透明 PNG）；生成原图：sources/card-face-v4.png。仅裁去透明外边距（x=42,y=48,w=952,h=1422），原 alpha 保留。

CSS 展示宽度：桌面手牌 84 → 98，出牌 66 → 76；竖屏手牌 62 → 72，出牌 52 → 60。高度不变。调整手牌叠放间距避免加宽后拥挤。旧 v3 牌底保留。

## 最终提示词

Use case: precise-object-edit. Asset type: transparent blank game playing card face v4. Image 1 is the EXACT EDIT TARGET (current blank card), Image 2 is a reference ONLY for the previously used thick blue beveled lower/right edge, Image 3 is a reference ONLY for the desired card face proportions and angular shoulder silhouette. Modify Image 1 minimally: KEEP its white-to-pale-periwinkle face gradient, both clipped top corners, short centered recessed blue top strip, the symmetric inward shoulder steps at mid-height, broad flat white face and clipped lower corners. ADD physical thickness similar to Image 2: a clearly visible layered steel-blue backing displaced slightly toward right and down, about 3 to 5 percent card width, visible along RIGHT OUTER EDGE and ENTIRE BOTTOM EDGE including both bottom chamfers. Put a narrow pale blue specular highlight line on the bevel just outside the front face, a medium-blue bevel ledge, and a dark navy outermost rim / lower shadow. The lower side rails should have distinct facets, a narrow light edge and a darker outer edge rather than appearing painted flat. Preserve the exact original face silhouette, do not change the stepped-in shoulders or fill in the lower side recesses. Card face width-to-height approximately 0.66, like Image 3, not a skinny card. Orthographic front view remains mandatory; no tilted card. Blank card with no typography, ranks, suits, crowns or red shapes. Avoid extra border ornament, glowing cyan perimeter, studs, machinery or excessive realism. The center remains visually uncluttered for live card ink. True transparent alpha outside the card, no painted backdrop, no baked checkerboard. Output one centered complete card, portrait 1024x1536, tight transparent margins roughly 40px on all sides.
