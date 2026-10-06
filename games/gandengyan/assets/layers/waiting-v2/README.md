# 联机等待房素材 v2

使用用户提供的等待房设计图作为参照。视觉：星空背景、银灰切角框架、少量青色灯条；保持五人布局（左右各两人、自己在下方）。文本均由 DOM 显示真实昵称、能量和剩余时间，空位不填假玩家。动效仅限按钮悬停和按下，减少动态时关闭过渡。

流程：所有场地先等待真人联机，五人到齐立即开局，30 秒超时补电脑；换桌排除原房间。等待房的短暂断线保留座位 5 秒，刷新重连回到原房间；主动退出立即释放座位。头像复用玩家的现有组合。计时、换桌和头像底座分离为三张透明 PNG，生成后仅用 Sharp 按 alpha 裁切和缩放。

参考文件：`设计稿/06 等待连接.jpg`；用户附图 `codex-clipboard-ce27531b-e7e0-4da1-8074-922e5f3fc8e9.png`。

## counter.png

Exact image generation prompt:

```text
Use case: stylized-concept. Transparent production game UI SPRITE, reference: provided waiting lobby design. Recreate ONLY the top-center waiting-time counter assembly, front-facing. A wide dark gray faceted shield-like panel approximately 250 wide x155 tall. Main face: black/dark gray HEXAGONAL HONEYCOMB recessed surface, broad bevelled cool slate-gray angular frame, silver upper corners, short cyan luminous strips on left and right. Bottom edge slopes down to a broad V with a small cyan inset at bottom center. Above this panel: small gray metal tab, narrow rounded/chamfered corners, empty flat dark gray face for the 'waiting time' label. Two short cylindrical dark connectors link tab to panel. Match simple old mobile-game painted 2.5D art in reference, restrained gray and cyan palette, not ornate cyberpunk. LEAVE ALL FACES BLANK: no text, no digits, no units. The central face must be dark honeycomb, NOT transparent; exterior of this ONE isolated assembly must be genuine transparent alpha. No star field, no other UI, no avatar, no whole screen. Center this complete counter assembly with generous transparent padding, no clipping.
```

## change.png

Exact image generation prompt:

```text
Use case: stylized-concept. Transparent production game UI SPRITE, reference: provided waiting lobby design. Recreate ONLY the large CENTRAL round 'change table' button housing, front-facing and circular, no text. A simple chunky gray/silver segmented mechanical dial, approximately 200x200: dark circular inner button with soft gray highlight at upper left, black recessed rim; thick outer ring formed by FOUR separated broad gray/silver arc plates with short black gaps between arcs, light silver beveled edges. A thin cyan inset arc in the upper-left quadrant between outer frame and central disc, another short cyan inset arc lower-right. Original reference has quiet silver gradients and subdued cyan, not a bright neon circular outline, not many thin concentric rings. No timer/progress implementation, the cyan arcs are decorative fixed insets. Center inner disc stays blank dark charcoal for live 'change table' text. Isolated whole button on actual transparent alpha, generous margins; no screen, no stars, no numbers, no text or letters. Closely match reference silhouette and thickness.
```

## podium.png

Exact image generation prompt:

```text
Use case: stylized-concept. Transparent production waiting-lobby PLAYER PODIUM SPRITE. Reference: supplied waiting room design. Recreate one EMPTY player name/energy pedestal with robot HEAD REMOVED, so an avatar can be overlaid later by code. Front-facing, symmetrical, simple low-detail painted 2.5D mobile-game style. At top is a small muted slate-blue/gray oval or round backing disk, no glass glare or bright energy orb, perfectly blank middle with no head. Below it is a compact silver/slate angular shoulder-like mechanical mount, violet glowing faceted hexagonal gem at middle, two gray diagonal struts. Wide horizontal SILVER NAMEPLATE with chamfered corner tips below the gem, blank for live nickname. Below nameplate is a narrower black/dark gray ENERGY STRIP, short cyan illuminated side lamps and two small cyan angled bottom lights, blank for live balance. Overall aspect width160 height190, simple restrained metallic gradients like reference, NOT intricate mechanical chassis. Maintain geometric hierarchy: avatar backing about 60% of total width and upper 45% of height; nickname plaque spans almost full width at 67%-83% height; energy strip 83%-96%. No Chinese text, no numbers, no letters. Transparent alpha outside the backing and stand; no star background, no floor, no human or robot face. Complete silhouette inside canvas with generous outer transparent margin.
```
