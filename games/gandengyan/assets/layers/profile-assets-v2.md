# 个人中心精细化图片

生成方式：内置 image_gen，三张分别生成，透明背景。参考用户提供的三张局部截图。

| 用途 | 文件 | 原始分辨率 |
| --- | --- | --- |
| 窗口左上包角（右下通过 CSS 旋转复用） | profile-corner-v2.png | 1522 × 1033 |
| 底部按钮（文字仍为 HTML） | profile-action-v2.png | 2172 × 724 |
| 三排部件选中框（中央透空，不含头像） | profile-selection-frame-v2.png | 1106 × 1422 |

CSS background-size/position 仅将按钮 PNG 的可见范围适配到现有尺寸，保留原始 PNG 和透明通道，不重新绘制。
头像图片、拼接坐标和窗口布局均保持不变。

## 提示词

### 窗口包角

Use case: stylized-concept. Asset: production-ready transparent PNG game UI window top-left corner bracket. Reference image is shape/layout reference only. Regenerate ONLY the small L-shaped metallic corner ornament, REMOVE ALL star field, background, diagonal scene objects. Maintain reference silhouette: long horizontal upper arm running to the right, shorter thick vertical left arm running down, diagonal beveled ends; tiny teal hexagonal inset near elbow, restrained yellow-orange inlay top/right and lower left. Detailed brushed white-silver alloy with realistic bevel highlights, dark graphite understructure, precise seam lines, restrained tiny fasteners and fine metal grain. Front orthographic view, no perspective, crisp premium sci-fi game HUD matching reference, not cartoon or flat vector. Isolated single object on true transparent alpha, all negative space including lower right fully transparent. Landscape canvas around 112:76 aspect, ornament fills 96% of canvas, 2% margin, no excessive empty padding, very high resolution. No text, logos, stars, background, other widgets.

### 按钮底图

Use case: stylized-concept. Asset: production-ready transparent PNG sci-fi game button background ONLY. Reference screenshot is silhouette/layout/material guide. Regenerate isolated horizontal rectangular beveled silver button chassis with slim cyan-blue side rails and small faceted angled white-silver end caps. Exact wide ratio 120:36 (about 3.33:1), height compact. Blank broad pale silver center spans 80% width for HTML label to be overlaid; subtle metallic light gradient, smooth readable light center, dark graphite narrow outer grooves and crisp layered bevels; finely detailed brushed silver and anodized blue chamfers matching classic premium sci-fi game HUD. Front orthographic, bilateral symmetry, sharp high-resolution clean edges. Object fills canvas with max 2% transparent margin. Genuine transparent alpha outside object. Remove the Chinese text completely, NO text or pseudo glyphs anywhere, no stars, background, floating shadows, robot, additional buttons. Only one blank button.

### 选中框

Use case: stylized-concept. Asset: production-ready transparent PNG vertical avatar part selection FRAME ONLY. Reference screenshot defines exact outline, proportions, material placement. Regenerate this single compact vertically elongated polygonal open frame, aspect ratio84:108. Thin layered white-silver upper/side beveled armor, blue-steel bottom support, graphite connector tabs centered top/bottom, four small amber-orange diamond accents inside corners, extremely restrained thin cyan seams. Central opening occupies 60% width and 72% height and is truly TRANSPARENT, not a black panel. REMOVE ROBOT, EYES, ALL AVATAR PARTS, backdrop and star field completely. Detailed crisp metallic bevels, subtle fine brushed metal, precise panel seams and tiny fasteners, depth restrained to reference, orthographic front, symmetrical, no perspective. Preserve compact silhouette and four yellow accents, no giant wings or ornaments. Single frame fills 96% of canvas with 2% alpha margins, high resolution. True transparent background outside AND through center, no text, logos, extra objects, no shadows filling opening.
