# ForzaMap — Brand Handover

Direction 1a · “Contour” · v1.0 · August 2026
Full visual spec: `ForzaMap-Brand-Handover.html` (print to PDF from the page).

---

## The mark

A weight-contrast wordmark — **Forza** in Archivo 800, **Map** in Archivo 400,
tracked −0.035 em — above three elevation rules that carry the “Map” without a
literal map. Tagline: *your strengths, charted.*

Variants:

| File | Use |
| --- | --- |
| `forzamap-lockup.svg` | Primary, no tagline |
| `forzamap-lockup-tagline.svg` | Primary with tagline |
| `forzamap-lockup-reversed.svg` | On ink grounds (#22201C or darker) |
| `forzamap-lockup-mono-ink.svg` | One colour: stamped, engraved, single-plate, faxed |
| `forzamap-lockup-2x.png` | 608×274 raster for decks, email, docs |
| `forzamap-icon.svg` | Master icon (512 grid) |
| `forzamap-icon-mono.svg` | One-colour icon |
| `forzamap-icon-maskable.svg` | Android maskable, square, mark at 60 % |

All lettering is **outlined vector geometry** — no font dependency in any file.

## Rules

- Clear space on all four sides = cap height of *F*. Nothing enters it.
- Minimum width 88 px on screen, 24 mm in print. Below that drop the tagline;
  below 64 px use the icon.
- Never stretch, re-weight, recolour the rules independently, add a stroke or
  shadow, or re-set the wordmark in another typeface.

## Colour

| Name | Hex | RGB | CMYK (uncoated est.) |
| --- | --- | --- | --- |
| Ink | `#2A251F` | 42 37 31 | 65 65 70 75 |
| Forza | `#C96442` | 201 100 66 | 15 72 80 3 |
| Lift | `#E0764F` | 224 118 79 | dark grounds only |
| Paper | `#F0EEE9` | 240 238 233 | surface |

Icon: tile `#2A251F`, mark `#F4F1EA`, rules `#C96442` at 100 % and 50 %.

## Type

- Wordmark — Archivo 800 / 400, −0.035 em. Drawn as one unit, never re-typed.
- Tagline and UI labels — Archivo 500, +0.07 em.
- Body copy — Archivo 400. Technical values — JetBrains Mono 400.
- Both families are SIL OFL: free for commercial and embedded use.

## Favicon / app icon

Icon simplifies as it shrinks: two rules at 48 px and up, one at 32 px, none at
16 px. Corner radius is 21.7 % of the tile.

Files: `favicon.svg`, `favicon-16.png`, `favicon-32.png`, `favicon-48.png`,
`apple-touch-icon-180.png`, `icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`, `site.webmanifest`.

Serve from the web root and add `head-snippet.html`:

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#2A251F">
```

## Before release

1. Pack `favicon.ico` from `favicon-16/32/48.png` (multi-resolution ICO).
2. Have a type designer redraw the outlines as true Bézier curves — the current
   paths are high-resolution traces (≈0.2 unit tolerance) and the *F*/*M*
   junctions and *z* shoulder want optical correction at large sizes.
3. Add Pantone equivalents for Ink and Forza once a print partner is chosen.
4. Register `forzamap` handles and clear the name in the target territory.
