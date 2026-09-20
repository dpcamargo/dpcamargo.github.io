# Visual redesign: spacing, window components, palette picker

Sub-project 1 of 2. Sub-project 2 (i18n) is in `2026-09-20-i18n-design.md` and builds on the button and header styles defined here.

## Goals

- Fix uneven spacing between sections.
- Adopt the look of typesafe.ai: black title-bar windows with an inset double frame, hard-shadow pixel buttons, a dithered halftone background, a pixel monospace font.
- Replace the sun/moon toggle with a palette picker (dark, light, pink).

Non-goals: new content, new pages, changes to the Hugo build, translation (sub-project 2).

## Current problems

- Every layer adds its own inset, so gutters stack. Under the header: 1rem `margin-bottom` plus 1rem `.page__body` padding. In the home content: `.page__content` 1rem + `.content__body` 2rem + `.boot` 2rem = 5rem. Sidebar gap is 0.75rem, page gap 1rem.
- `layout.css` styles `.page__main`, but `baseof.html` uses `page_main`. The rule never matches.
- Sidebar boxes use `width: calc(100% - 2rem)` with `margin: auto`, so they are narrower than the image above them.
- Vertical rhythm mixes `px` (font-size 22px) with `rem` (line-height 1.8rem, 1.5rem margins).

## Design

### Spacing (`assets/css/spacing.css`, first in the bundle)

Scale on `:root`:

| token | value |
|-------|-------|
| `--space-1` | 0.25rem |
| `--space-2` | 0.5rem |
| `--space-3` | 1rem |
| `--space-4` | 1.5rem |
| `--space-5` | 2rem |
| `--space-6` | 3rem |

`--gutter: var(--space-4)`. Page padding, the gap between content column and sidebar, and the gap between sidebar windows all use `--gutter`.

Rules:

- One layer owns each inset. `.page__header` has no `margin-bottom`. `.page__body` provides the padding under the header. `.content__body` and `.boot` lose their own 2rem margins. The content window pads its body once, with `--space-4`.
- Sidebar windows are full column width.
- Fix the `page_main` typo in `baseof.html` (class becomes `page__main`) and drop the dead margins or re-apply them intentionally.
- Block spacing: paragraphs and lists keep `margin: 0 0 var(--space-4)`. Headings: `margin-top: var(--space-5)`, `margin-bottom: var(--space-2)`. `h1:first-child` and first child of a window body get `margin-top: 0`.
- All sizes in `rem`, `line-height: 1.5` unitless.

### Font

- Departure Mono (SIL OFL), self-hosted. `woff2` in `static/fonts/`, license file next to it.
- `@font-face` in `typography.css`, `font-display: swap`. `--font-body` and `--font-heading` both become Departure Mono, with the existing monospace fallbacks.
- Base size stays at 22px, which is 2x the font's native 11px grid, so glyph edges stay crisp.
- Remove the Google Fonts link (`Press Start 2P`, `VT323`) and both `preconnect` links from `head.html`.
- Departure Mono is wider than VT323. Line lengths, the sidebar minimum width and `.til__list` truncation must be rechecked visually.

### Window component (`assets/css/window.css`)

```html
<section class="win">
  <header class="win__title">~/whoami</header>
  <div class="win__body">...</div>
</section>
```

- `.win__title`: `background: var(--win-title-bg)`, `color: var(--win-title-fg)`, padding `var(--space-1) var(--space-2)`, single line, ellipsis on overflow.
- `.win` frame: 2px border in `--win-border`, plus a hard offset shadow `2px 2px 0 var(--win-border)`.
- `.win__body`: `background: var(--win-bg)`, `color: var(--win-fg)`, an inner 1px border inset 3px from the outer edge (implemented with an inner pseudo-element or `outline` plus `outline-offset`), padding `var(--space-4)`.
- Used for: the main content window (title = `~/` plus the page title lowercased with spaces as underscores, the same rule as the header's `head-branch`, e.g. `~/whoami`; long TIL titles ellipsise), each sidebar box (`connect`, `stack`, `latest_til`, status), and the palette popup.
- The existing `.side__section`, `.side__socials` and `.side__status` boxes and their bespoke borders are replaced by `.win`. Inner list and link styles (`.socials__*`, `.til__list`) stay.
- The `h1` in `title.html` stays inside the content body. It is not moved into the title bar.

### Button (`assets/css/button.css`)

`.btn`: `background: var(--btn-bg)`, `color: var(--btn-fg)`, padding `var(--space-1) var(--space-3)`, no border radius, `box-shadow: 3px 3px 0 var(--btn-shadow)`. `:hover` brightens. `:active` translates by `(3px, 3px)` and drops the shadow. `:focus-visible` gets a 2px outline offset 2px. Used for the palette button now, the language button in sub-project 2.

### Palette picker

Palettes are blocks in `colours.css` keyed on `[data-palette="dark"]`, `[data-palette="light"]`, `[data-palette="pink"]`. Dark is also the default for `:root` with no attribute (no-JS fallback). This replaces `[data-theme]`.

Existing tokens stay (`--bg`, `--bg-body`, `--text-body`, `--border-pink`, and so on). New tokens per palette:

| token | purpose |
|-------|---------|
| `--win-title-bg`, `--win-title-fg` | title bar |
| `--win-bg`, `--win-fg` | window body |
| `--win-border` | frame and shadow |
| `--btn-bg`, `--btn-fg`, `--btn-shadow` | buttons |
| `--dither-ink` | dot grid and blob colour |

Initial values (tunable during build):

- dark: `--win-bg: var(--bg-body)`, title bar uses `--border-pink` background with white text (contrast 5.5:1; `--bg` text on it would be only 3.5:1), `--dither-ink` is `--border-pink` at low opacity. All other colours unchanged.
- light: same mapping onto the existing light colours.
- pink: `--bg: #e88ba0`, `--dither-ink: #1e1e1e`, `--win-title-bg: #1e1e1e`, `--win-title-fg: #dcdcdc`, `--win-bg: #dcdcdc`, `--win-fg: #1e1e1e`, `--win-border: #1e1e1e`, `--btn-bg: #d65cbb`, `--btn-fg: #1e1e1e`, `--btn-shadow: #1e1e1e`, `--scan-a: 0`. Link, heading and accent tokens are chosen for contrast on the grey panel (checked at build time against WCAG AA for body text).

Behavior:

- Header: the sun/moon `<button>` is removed. A `.btn` labelled with the current palette name, `aria-expanded` and `aria-controls`, opens a `.win` popup titled `palette`.
- Popup lists the three palettes as buttons with `aria-pressed`. Choosing one applies it immediately, saves it and closes the popup. Esc closes it and returns focus to the trigger; a click outside, or tabbing focus out of it, closes it without moving focus (it stays where the visitor put it). Tab order follows the DOM.
- `theme_init.html` (runs before first paint) sets `data-palette` from `localStorage["palette"]`. Fallbacks: a legacy `localStorage["theme"]` of `dark` or `light`, then the OS `prefers-color-scheme`. Invalid values are ignored.
- `assets/js/theme.js` becomes the palette script (file may be renamed `palette.js`; the bundle reference in `head.html` changes with it). It follows the OS until the visitor picks a palette themselves, as it does now.
- CRT scanlines (`crt.css`) stay for dark and light. `--scan-a: 0` in pink turns them off.
- Palette list is data: adding a palette is one CSS block and one list entry.

### Background (`assets/css/background.css`)

On `body` (behind `.page`):

1. Base colour `var(--bg)`.
2. Dot grid: `radial-gradient(var(--dither-ink) 1px, transparent 1.5px)` at `background-size: 4px 4px`, with reduced opacity.
3. Blob layer: a fixed pseudo-element filled with `--dither-ink`, using `static/images/dither.png` as `mask-image` (`center / cover`, `image-rendering: pixelated`). The PNG is a 480x270 alpha mask of Bayer-dithered blobs, generated by `scripts/gen-dither.py` (standard library only, deterministic), so one asset recolours per palette and each source pixel renders as a chunky 4px or larger cell. Blobs sit behind the windows and stay low-contrast in dark and light, full-contrast in pink.

An inline SVG `feTurbulence` mask was rejected: SVG filters render at device resolution, so the noise comes out smooth instead of pixel-dithered.

Fallback: if the blob layer looks bad or breaks in a target browser (Safari, Firefox, Chrome are checked), drop layer 3 and keep the dot grid. Both layers are static (no animation, so nothing to gate on `prefers-reduced-motion`) and are hidden under `@media print`.

## Files touched

- new: `assets/css/spacing.css`, `window.css`, `button.css`, `background.css`, `static/fonts/DepartureMono-Regular.woff2` (+ license), `static/images/dither.png`, `scripts/gen-dither.py`, `scripts/check-site.sh`
- edited: `colours.css`, `layout.css`, `header.css`, `typography.css`, `side_image.css`, `social.css`, `boot.css`, `chroma.css` (light syntax colours also apply to pink, attribute renamed), `head.html` (bundle list, fonts, script), `baseof.html`, `single.html` (empty footer removed), `header.html`, `theme_init.html`, `side_*.html`, `assets/js/theme.js`
- `crt.css` needs no edit: `--scan-a: 0` in the pink palette turns it off.
- removed: `footer.css` (its only rule is `.page__footer { background-color: red }` and no template uses it)

## Testing

- `hugo --gc --minify` builds with no warnings.
- Playwright screenshots of `/`, `/about/`, `/til/`, one TIL post and `/404.html`, per palette, at 1440, 1024, 768 and 390 px widths.
- Manual checks: keyboard-only use of the palette popup, no flash of the wrong palette on reload (with a stored choice and with none), light and dark OS preference, print preview, `prefers-reduced-motion`.
- Spacing check: from screenshots, the header-to-body gap, column gap and sidebar gap are equal to `--gutter`, and no page has more than one nested inset.
- Contrast: body text and links meet WCAG AA in all three palettes.
