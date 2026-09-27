from __future__ import annotations

import asyncio
import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "audio" / "voice"
OUT.mkdir(parents=True, exist_ok=True)

LINES = [
    ("01-hook", "俄罗斯方块，还能这么软？"),
    ("02-classic", "经典消行，落地就弹。"),
    ("03-melt", "融化模式，果冻会坍塌流淌。"),
    ("04-fluid", "流体模式，颗粒碰撞，连片清空。"),
    ("05-iso", "立体果冻，厚度与高光全部拉满。"),
    ("06-3d", "再进入真三维世界，感受折射、反光和软体晃动。"),
    ("07-cta", "五种玩法，每一次落点都不一样。果冻俄罗斯方块，现在开玩！"),
]


async def edge_generate() -> None:
    import edge_tts

    for name, text in LINES:
        communicate = edge_tts.Communicate(
            text,
            "zh-CN-XiaoxiaoNeural",
            rate="+12%",
            pitch="+7Hz",
            volume="+0%",
        )
        await communicate.save(str(OUT / f"{name}.mp3"))


def sapi_generate() -> None:
    for name, text in LINES:
        wave_target = OUT / f"{name}.wav"
        mp3_target = OUT / f"{name}.mp3"
        safe_text = text.replace("'", "''")
        safe_target = str(wave_target).replace("'", "''")
        script = (
            "Add-Type -AssemblyName System.Speech;"
            "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;"
            "$s.SelectVoice('Microsoft Huihui Desktop');"
            "$s.Rate=2;"
            f"$s.SetOutputToWaveFile('{safe_target}');"
            f"$s.Speak('{safe_text}');"
            "$s.Dispose();"
        )
        subprocess.run(["powershell", "-NoProfile", "-Command", script], check=True)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wave_target), "-codec:a", "libmp3lame", "-q:a", "2", str(mp3_target)],
            check=True,
        )
        wave_target.unlink(missing_ok=True)


if importlib.util.find_spec("edge_tts"):
    try:
        asyncio.run(edge_generate())
        print("generated Chinese neural voiceover with Edge TTS")
        sys.exit(0)
    except Exception as exc:
        print(f"Edge TTS failed, falling back to Windows SAPI: {exc}", file=sys.stderr)

sapi_generate()
print("generated Chinese voiceover with Windows SAPI")
