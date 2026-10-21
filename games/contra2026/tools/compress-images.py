"""Build browser WebP assets from the original PNG artwork (requires Pillow)."""
import argparse
import io
import json
import math
from pathlib import Path
import re

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[3]
GAME = ROOT / "games/contra2026"


def encode(source, destination, *, max_size=None):
    with Image.open(source) as original:
        image = original.copy()
        profile = original.info.get("icc_profile")
    if max_size:
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    transparent = "A" in image.getbands()
    options = {"method": 6, "icc_profile": profile or b""}
    if transparent:
        options.update(lossless=True, exact=True)
    else:
        options.update(quality=90)
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", **options)
    encoded = buffer.getvalue()
    with Image.open(io.BytesIO(encoded)) as decoded:
        assert decoded.size == image.size, destination
        if transparent:
            assert decoded.convert("RGBA").tobytes() == image.convert("RGBA").tobytes(), destination
            psnr = None
        else:
            error = ImageStat.Stat(ImageChops.difference(image.convert("RGB"), decoded.convert("RGB"))).rms
            mse = sum(value * value for value in error) / 3
            psnr = round(10 * math.log10(255 * 255 / mse), 2) if mse else None
            assert psnr is None or psnr >= (28 if max_size else 32), (destination, psnr)
    assert len(encoded) < source.stat().st_size, destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(encoded)
    return {
        "source": source.relative_to(ROOT).as_posix(),
        "webp": destination.relative_to(ROOT).as_posix(),
        "originalBytes": source.stat().st_size,
        "webpBytes": len(encoded),
        "width": image.width,
        "height": image.height,
        "lossless": transparent,
        "psnr": psnr,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    code = "\n".join(path.read_text(encoding="utf-8") for path in [GAME / "index.html", *sorted((GAME / "js").glob("*.mjs"))])
    urls = sorted(set(re.findall(r"/games/contra2026/assets/[A-Za-z0-9_./-]+\.(?:png|webp)", code)))
    sources = sorted({(ROOT / url.lstrip("/")).with_suffix(".png") for url in urls})
    records = [encode(source, source.with_suffix(".webp")) for source in sources]
    records.append(encode(ROOT / "assets/covers/contra2026-zh.png", ROOT / "assets/covers/contra2026-zh.webp", max_size=800))
    original = sum(record["originalBytes"] for record in records)
    compressed = sum(record["webpBytes"] for record in records)
    report = {"originalBytes": original, "webpBytes": compressed, "savedPercent": round((1 - compressed / original) * 100, 1), "images": records}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "images"} | {"images": len(records), "losslessImages": sum(record["lossless"] for record in records)}, indent=2))


if __name__ == "__main__":
    main()
