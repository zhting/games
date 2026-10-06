# 游戏背景音乐 · 星门回环

当前使用用户提供的 `H:/download/星门回环.mp3`，完整复制至 `public/assets/audio/stargate-loop.mp3`，不剪辑或转码。

由 `public/js/sound.js` 解码后全曲循环播放。首次点击或按键解锁后开始，设置中的音乐音量独立控制并保存；页面隐藏/静音时暂停，恢复后继续播放。当前曲目已加入 Service Worker 的离线缓存。

## 原背景音乐（已停用）

Space Orbit 保留用于历史素材记录，当前游戏不加载或预缓存这些旧音频。

原创合成的 64 秒立体声循环，60 BPM，D 小调太空氛围。柔和铺底和弦、低频脉冲、延迟琶音和稀疏高音组成，无人声、无外部采样。尾部音符和延迟以循环方式写入开头，避免淡出后重新开始。

- 首选文件：`space-orbit.ogg`（Vorbis）。
- 兼容文件：`space-orbit.mp3`（浏览器无法解码 OGG 时使用）。
- 原始 WAV：`artifacts/audio/space-orbit.wav`。
- 制作脚本：`scripts/create-space-bgm.cjs`，执行 `node scripts/create-space-bgm.cjs` 可重建 WAV。

使用 FFmpeg 从 WAV 转码：

```powershell
ffmpeg -i artifacts/audio/space-orbit.wav -c:a libvorbis -q:a 4 public/assets/audio/space-orbit.ogg
ffmpeg -i artifacts/audio/space-orbit.wav -c:a libmp3lame -q:a 4 public/assets/audio/space-orbit.mp3
```

播放由 `public/js/sound.js` 的 Web Audio 管理，首次点击或按键解锁后播放；使用解码后的 AudioBuffer 循环，切换游戏界面不会重复叠加音乐。设置的音乐音量独立于音效并保存，静音/页面隐藏时暂停，恢复后从上次位置继续。音频文件纳入 Service Worker 的离线缓存。
