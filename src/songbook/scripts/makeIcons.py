# One-off: generates the PWA icons in public/. Requires Pillow.
from PIL import Image, ImageDraw
import os
out = os.path.join(os.path.dirname(__file__), "..", "..", "..", "public")
os.makedirs(out, exist_ok=True)
def icon(size, name):
    im = Image.new("RGB", (size, size), (0, 0, 0))
    d = ImageDraw.Draw(im)
    m = size * 0.12
    d.ellipse([m, m, size - m, size - m], outline=(240, 192, 64), width=int(size * 0.07))
    # note head + stem
    r = size * 0.13
    cx, cy = size * 0.42, size * 0.62
    d.ellipse([cx - r, cy - r * 0.8, cx + r, cy + r * 0.8], fill=(240, 192, 64))
    d.rectangle([cx + r - size * 0.035, size * 0.28, cx + r, cy], fill=(240, 192, 64))
    d.rectangle([cx + r - size * 0.035, size * 0.28, cx + r + size * 0.12, size * 0.33], fill=(240, 192, 64))
    im.save(os.path.join(out, name))
icon(180, "apple-touch-icon.png"); icon(192, "icon-192.png"); icon(512, "icon-512.png")
print("icons written to", os.path.abspath(out))
