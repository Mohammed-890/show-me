"""Make harder versions of every labelled screenshot, for a held-out test.

The engine was tuned on the 16 original screenshots, so a fair test needs
screens it has not seen. Each original gets four variants that mimic what real
people send:

  small    - 72% size (older or smaller phone, or a resized image)
  lowq     - heavy JPEG compression and slight blur (sent over WhatsApp)
  shifted  - scrolled a little differently (top 110px cut off)
  dim      - darker, lower-contrast screen

Labels are transformed to match. Variants where the target would be cut off
are skipped.

Usage: python3 scripts/augment.py
"""
import io
import json
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / "eval"
SRC = ROOT / "screens"
OUT = ROOT / "screens-augmented"
OUT.mkdir(exist_ok=True)

labels = [json.loads(l) for l in (ROOT / "labels.jsonl").read_text().splitlines() if l.strip()]
out_labels = []


def save(img, name, quality=90):
    img.convert("RGB").save(OUT / name, "JPEG", quality=quality)


def scale_target(t, k):
    return None if t is None else {key: round(v * k) for key, v in t.items()}


for lab in labels:
    im = Image.open(SRC / lab["file"]).convert("RGB")
    stem = lab["file"].rsplit(".", 1)[0]
    W, H = im.size

    # small
    k = 0.72
    small = im.resize((round(W * k), round(H * k)), Image.LANCZOS)
    save(small, f"{stem}--small.jpg")
    out_labels.append({**lab, "file": f"{stem}--small.jpg", "target": scale_target(lab["target"], k), "variant": "small"})

    # lowq: blur + recompress hard
    buf = io.BytesIO()
    im.filter(ImageFilter.GaussianBlur(0.8)).save(buf, "JPEG", quality=28)
    lowq = Image.open(io.BytesIO(buf.getvalue()))
    save(lowq, f"{stem}--lowq.jpg", quality=95)
    out_labels.append({**lab, "file": f"{stem}--lowq.jpg", "variant": "lowq"})

    # shifted: cut 110px off the top, pad the bottom with the bottom colour
    d = 110
    t = lab["target"]
    if t is None or t["y"] - d >= 0:
        shifted = Image.new("RGB", (W, H), im.getpixel((W // 2, H - 2)))
        shifted.paste(im.crop((0, d, W, H)), (0, 0))
        save(shifted, f"{stem}--shifted.jpg")
        nt = None if t is None else {**t, "y": t["y"] - d}
        out_labels.append({**lab, "file": f"{stem}--shifted.jpg", "target": nt, "variant": "shifted"})

    # dim
    dim = ImageEnhance.Contrast(ImageEnhance.Brightness(im).enhance(0.82)).enhance(0.88)
    save(dim, f"{stem}--dim.jpg")
    out_labels.append({**lab, "file": f"{stem}--dim.jpg", "variant": "dim"})

(ROOT / "labels-augmented.jsonl").write_text("\n".join(json.dumps(l) for l in out_labels) + "\n")
print(f"wrote {len(out_labels)} augmented screenshots")
