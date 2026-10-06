# 设置窗口 v2

生成方式：内置 image_gen，参考用户提供的设置窗口设计图。透明输出经 Sharp 裁去外围空白并等比缩放，保留 alpha。

最终素材：`H:/project/games/games/gandengyan/public/assets/layers/settings-v2/title.png`

原始输出：`C:/Users/zhting/.codex/generated_images/01a10a5b-000a-79a0-a416-c5b598586305/exec-bc30bce8-6c01-48c8-960b-a25f28f9ae2f.png`

四角装甲沿用 `result-v2/{tl,tr,bl,br}.png`；确认按钮使用 `buttons-cylinder-v1/cylinder.png`；滑条通过原生 range 和 CSS 金属渐变渲染，支持键盘和触摸。

## 最终提示词

Use case: ui-mockup. Generate a single transparent-background game UI sprite: the SETTINGS TITLE PLAQUE ONLY from the supplied reference image, not the whole window. Reference image is visual guidance for geometry and material. Wide symmetrical sci-fi metal nameplate, approximately 4.2:1 width-to-height. Its silhouette has a broad straight upper edge, angled outer wings tapering inwards, stepped lower edge with two short squared downward feet and a raised cyan-lit notch at the bottom center. Brushed light silver narrow bevel rim, dark charcoal small honeycomb mesh interior. A bright restrained cyan horizontal luminous strip along the top middle and a small bottom-center strip. Two orange-gold beveled diagonal undersides at the lower left and right. Front orthographic view, 2D game interface rendered with subtle metallic volume, matching the reference faithfully. Center blank interior reserved for separately rendered Chinese title. NO TEXT, no symbols, no screws, no additional panels, no background, no space scene, no frame corners. Compact clean silhouette with minimal empty transparent margins. True transparent alpha background.
