# 果冻俄罗斯方块广告生成器

使用 Playwright 自动操作并采集五种真实玩法，使用中文 TTS 生成旁白，再由 Remotion 输出 1920×1080、30 秒的 MP4 广告。

## 一键生成

```powershell
cd ad-generator
python -m pip install edge-tts
npm run make-ad
```

成片输出到 `output/jelly-tetris-ad.mp4`。

首次执行会把大量 Node 运行依赖安装到本机 Codex 缓存目录，避免云盘同步大量小文件时产生写入冲突。项目源码、采集素材和最终 MP4 仍保存在当前项目中。

如果 `edge-tts` 未安装或网络 TTS 不可用，脚本会自动改用 Windows 自带的 `Microsoft Huihui Desktop` 中文语音。

## 单独执行

```powershell
npm run capture   # 重新录制五种玩法
npm run audio     # 重新生成旁白、音乐与音效
npm run render    # 仅重新渲染成片
npm run preview   # 打开 Remotion 可视化预览
```
