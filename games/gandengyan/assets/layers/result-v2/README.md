# 结算窗口 v2

参考 `设计稿/08 赢-窗口.jpg`、`设计稿/08-01 输-窗口.jpg`，使用内置 imagegen 生成透明金属装甲与道具图标。完整提示词见 [generation-prompts.md](generation-prompts.md)。

视觉：白色四角装甲、橙黄色衬边、青色灯光与半透明深灰面板。顶部双翼金属徽章区分胜负；赢的灯亮，输的灯灭并带裂纹。四个道具统计在上方，黄色能量值位于中央，底部为继续玩、退出。

交互：沿用弹窗淡入与按钮悬停提亮、按下反馈；保留自动开下一局的倒计时。

素材：

- `frame-source.png`：生成的原始透明装甲框。
- `tl.png`、`tr.png`、`bl.png`、`br.png`：四角装甲，按透明边界切分后独立定位，保持图片比例。
- `crest-win.png`、`crest-lose.png`：亮灯胜利徽章与暗灯裂纹失败徽章。赢、输为页面文字。
- `bomb.png`、`hbomb.png`、`rocket.png`：三种独立金属道具图标，替换原 emoji。
- `button.png`：复用已有 `profile-action-v2.png` 的银色按钮，去透明边距后缩小。
- 剩余牌数图标复用已有 `/assets/layers/battle-v2/count-badge.png`。

实现：`public/css/result-v2.css` 控制比例和排版，`public/js/main.js` 使用结算结果生成真实数字与文字。只生成前景素材，没有把效果图截图作为弹窗背景。按本回合胜负显示对手剩余牌数合计或本人的剩余牌数，能量显示实际变化的绝对值。

验证：浏览器验证赢、输两种状态，桌面、手机竖屏与横屏布局，真实数据渲染、继续玩关闭、退出离开对局、倒计时变化及自动关闭。所有新素材已加入 Service Worker 预缓存，版本 `gdg-v62`。

预览：`win-desktop-preview.png`、`lose-desktop-preview.png`、`lose-mobile-preview.png`。
