# PWS Book — Project Guidelines

HTML book chapters live in this folder (`part-*.html`, `introduction.html`, `index.html`, `postface.html`, …).
Shared design system: **Source Serif 4** (body text) + **Source Code Pro** (code), loaded from Google Fonts via a single `@import` at the top of each file's `<style>`. Page content sits in `.page` (max-width 820px).

## Images — REQUIRED workflow

**Never embed images as inline `base64` data URIs.** Large inline base64 bloats the HTML and — as observed on `part-6` — can keep the page busy long enough that the Google Fonts `@import` fails to load, so the text falls back to the wrong (generic serif) font. Always use **external image files referenced by filename**.

When adding ANY image:

1. Save it as an external file **in this folder** (`pws-book/`).
2. Reference it with `<img src="filename.png" alt="...">`. If the filename contains spaces, URL-encode them as `%20` in the `src` (e.g. `src="Figura%205.1.png"`).
3. Add a `<figcaption>` consistent with the other chapters.
4. **Reduce/optimize the image BEFORE inserting it** if it is large (see thresholds below).
5. Keep total page weight small so the page and the web fonts load quickly.

### Size thresholds

- **Max width: 1400px** (pages display at 820px; 1400 covers HiDPI/retina). Do not insert images wider than this.
- **Target file size: < 150 KB per image** (line diagrams / editor screenshots are usually 30–60 KB).
- If a source image is wider than ~1600px or larger than ~200 KB, **downscale to ≤1400px wide and re-encode** before inserting.
- Prefer **palette PNG (256 colors)** for diagrams and screenshots — it is much smaller than full RGB with no visible quality loss.

### Recipe — from a PDF (e.g. figures exported from PWSEditor)

```bash
pdftoppm -png -scale-to-x 1400 -scale-to-y -1 "Figura 5.1.pdf" out
python3 -c "from PIL import Image; im=Image.open('out-1.png').convert('RGB'); \
im.quantize(colors=256, method=Image.FASTOCTREE).save('Figura 5.1.png', optimize=True)"
```

### Recipe — from an oversized raster image

```bash
python3 -c "from PIL import Image; im=Image.open('big.png').convert('RGB'); \
im.thumbnail((1400,10000)); im.quantize(colors=256, method=Image.FASTOCTREE).save('big.png', optimize=True)"
```

## Fonts

Keep the Google Fonts `@import` exactly as it is in the other chapters — do **not** embed fonts (`@font-face` base64) unless explicitly asked. Consistency across chapters matters more than self-containment.

## Notes

- git cannot be run from the Cowork sandbox because only the `pws-book/` subfolder is mounted, while the repo's `.git` lives in the parent (repo root, not shared). To enable git from the sandbox, share the repo root folder; otherwise commits/pushes must be run by the user from their own Mac terminal.
- The book is published at: https://github.com/lucapazzi/book (folder `pws-book/`).
