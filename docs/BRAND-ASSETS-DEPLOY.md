# ForzaMap — deploy tree

Drop `public/` into your web root as-is. Every path below is absolute from `/`.

## Root (served from /)

| File | Purpose |
| --- | --- |
| `favicon.ico` | Legacy browsers · multi-res 16/32/48 |
| `favicon.svg` | Modern browsers, scales to any tab size |
| `favicon-16.png` `favicon-32.png` `favicon-48.png` | ICO sources, kept for rebuilds |
| `apple-touch-icon-180.png` | iOS home screen |
| `icon-192.png` `icon-512.png` | PWA manifest icons |
| `icon-maskable-512.png` | Android adaptive/maskable |
| `site.webmanifest` | PWA metadata (theme #2A251F) |

## /brand

Lockups and master icons for the app header, reports, decks and email.
Full spec in `BRAND-ASSETS-README.md`.

## Install

Paste into `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#2A251F">
```

Serve icons with a long cache and a content hash or version query on updates —
browsers cache favicons aggressively.
