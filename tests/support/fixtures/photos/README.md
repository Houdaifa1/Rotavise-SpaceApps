# Synthetic test photos

Drawn images (a green ellipse on a soil colour), not real crops or farms. Each
carries invented metadata so tests can prove the server strips it before a
photo is sent to the AI provider: EXIF camera make "SyntheticCam", model
"FixtureModel", orientation 6 and GPS 30° N 20° W (open Atlantic), a JPEG
comment, and PNG text chunks. `tiny.jpg` is 150 px, below the 200 px minimum.

Made on 2026-11-03 with Pillow 12.3.0:

```python
from PIL import Image, ImageDraw
from PIL.PngImagePlugin import PngInfo
img = Image.new("RGB", (320, 240), (120, 90, 60))
d = ImageDraw.Draw(img)
d.ellipse((60, 40, 260, 200), fill=(40, 140, 50))
d.ellipse((150, 100, 180, 130), fill=(130, 100, 40))
exif = Image.Exif()
exif[0x010F] = "SyntheticCam"; exif[0x0110] = "FixtureModel"; exif[0x0112] = 6
exif[0x8825] = {1: "N", 2: (30.0, 0.0, 0.0), 3: "W", 4: (20.0, 0.0, 0.0)}
img.save("leaf-exif.jpg", "JPEG", quality=85, exif=exif.tobytes(), comment=b"synthetic fixture comment")
info = PngInfo(); info.add_text("Location", "synthetic 30N 20W"); info.add_text("Author", "fixture")
img.save("leaf-text.png", "PNG", pnginfo=info, exif=exif.tobytes())
img.save("leaf-exif.webp", "WEBP", quality=80, exif=exif.tobytes())
Image.new("RGB", (150, 150), (40, 140, 50)).save("tiny.jpg", "JPEG")
```

On 2026-11-03 the cleaned JPEG, PNG and WebP were decoded with Pillow: same
size, pixel-identical to the originals, no EXIF or text left.
