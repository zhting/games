# 圆柱体按钮 v1

当前替换范围：个人中心的随机生成、保存头像、取消，以及弹窗中标签为“确定”的按钮。其他按钮沿用现有素材。

视觉依据：用户的效果图 codex-clipboard-26cc37b6-cb8d-42b7-9bfc-8efaf19c9cee.png。横向银色圆柱弧面，上侧细亮带、中央浅色文字区、下側蓝灰暗部，两端独立银色端盖和蓝色凹槽。文字使用真实 DOM，按钮用途不变。素材按 alpha 裁切和等比缩小；CSS 横向三段切片保留端盖，中央弧面适应按钮宽度。

动效：悬停略提亮，按下下移 1px，禁用变暗；尊重减少动态设置。

生成方式：内置 imagegen，透明背景。
输出：cylinder.png。
原始输出：C:/Users/zhting/.codex/generated_images/01a10a5b-000a-79a0-a416-c5b598586305/exec-90253b49-c210-4fe9-ac0c-c55d551327f6.png。

Exact prompt:

```text
Use case: stylized-concept. Asset type: ONE transparent production UI button sprite for a sci-fi Chinese game. Input Image 1 shows the three CURRENT buttons whose functions will use this sprite; its flat rectangular frame is NOT the target. Image 2 is the authoritative DESIGN REFERENCE: match its SILVER HORIZONTAL CYLINDER shape and shading, but remove all text. Primary request: one EMPTY front-facing horizontally oriented cylindrical push button, width-to-height about 3.6:1. The main face must read as a rounded CYLINDRICAL barrel, not a flat metal rectangle: subtle silvery gray top shoulder, bright narrow highlight rolling across the upper quarter, light silver band at center for readable live text, progressively cool slate-blue dark shading on curved lower quarter, a thin lower contact shadow. Smooth continuous curved metallic light-to-dark roll across HEIGHT; cylinder axis runs left to right. Both ends have short projecting faceted silver end caps with a visible cylindrical rounded/elliptical seam, narrow deep navy vertical collar and restrained cyan/blue side inset, precisely like Image 2. Central barrel spans roughly 82% of total width. Simple clean painted 2.5D old mobile-game appearance, not ornate, not a photoreal industrial rod. Face must stay flat in screen plane left to right, no perspective rotation. NO rectangular picture-frame border around the central face; no pointed spear wings; no neon glow, no screws. Absolutely no text, letters, numbers, symbols, logo, star field or other UI. One isolated complete button, generous transparent exterior margin, actual transparent alpha. Smooth and crisp, enough resolution for small labels and nine-slice scaling.
```
