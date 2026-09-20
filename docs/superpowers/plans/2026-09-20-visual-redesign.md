# Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the site's uneven spacing and give it the typesafe.ai look (title-bar windows, pixel buttons, dithered background, Departure Mono) with a three-way palette picker replacing the sun/moon toggle.

**Architecture:** Pure Hugo templates plus the existing bundled CSS (`resources.Concat` in `head.html`). A spacing scale and palette tokens on `:root` feed two reusable components (`.win`, `.btn`); a `data-palette` attribute on `<html>` selects one of three token sets. The dithered blobs are a pre-rendered alpha PNG used as a CSS mask over `--dither-ink`, so one asset recolours per palette.

**Tech Stack:** Hugo 0.166 extended, plain CSS, vanilla JS, bash + Python 3 (standard library only) for checks and asset generation, Playwright MCP tools for visual checks.

**Spec:** `docs/superpowers/specs/2026-09-20-visual-redesign-design.md`

## Global Constraints

- Spacing scale on `:root`: `--space-1` 0.25rem, `--space-2` 0.5rem, `--space-3` 1rem, `--space-4` 1.5rem, `--space-5` 2rem, `--space-6` 3rem. `--gutter: var(--space-4)`. All sizes in `rem`; `line-height: 1.5` unitless.
- Font: Departure Mono (SIL OFL), self-hosted `woff2` in `static/fonts/` with its license beside it; base size stays 22px (1.375rem), 2x the font's 11px grid. No Google Fonts links remain.
- Palettes: `dark` (also the no-attribute default), `light`, `pink`, selected by `[data-palette]` on `<html>`. This replaces `[data-theme]`; no `data-theme` string may remain in `assets/` or `layouts/`.
- Storage: choice is saved in `localStorage["palette"]`; legacy `localStorage["theme"]` of `dark`/`light` is still honoured on load; then OS `prefers-color-scheme`; invalid values ignored. Every storage access is wrapped in try/catch.
- New tokens every palette must define: `--win-title-bg`, `--win-title-fg`, `--win-bg`, `--win-fg`, `--win-border`, `--btn-bg`, `--btn-fg`, `--btn-shadow`, `--dither-ink`, `--dot-a`, `--blob-a`.
- Pink palette: `--scan-a: 0` (CRT scanlines off). Dark and light keep scanlines.
- One layer owns each inset; no page has more than one nested inset.
- Body text and links meet WCAG AA in all three palettes.
- Cascade order of the CSS bundle is preserved: `spacing colours window button header layout social typography side_image crt chroma boot scrollbar background` (files are added to this list as their tasks land).
- Commit messages end with the line `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- `hugo serve` is already running at http://localhost:1313/ and live-reloads. Use it for visual checks; do not start a second server.

## File Structure

| File | Responsibility |
|------|----------------|
| `scripts/check-site.sh` | Builds the site and asserts structure, one group per task |
| `scripts/gen-dither.py` | Deterministically generates `static/images/dither.png` |
| `assets/css/spacing.css` (new) | Spacing scale and `--gutter` |
| `assets/css/window.css` (new) | `.win`, `.win__title`, `.win__body` |
| `assets/css/button.css` (new) | `.btn` |
| `assets/css/background.css` (new) | Dot grid and blob layers, print rule, `.page` stacking |
| `assets/css/colours.css` | Three palettes and all tokens |
| `assets/css/layout.css`, `boot.css`, `social.css`, `side_image.css`, `header.css`, `typography.css`, `chroma.css` | Rewritten or edited per task |
| `assets/js/theme.js` | Palette picker behaviour |
| `layouts/_default/baseof.html`, `single.html`; `layouts/partials/head.html`, `header.html`, `theme_init.html`, `side_*.html` | Markup |
| `static/fonts/DepartureMono-Regular.woff2`, `LICENSE` | Self-hosted font |
| `static/images/dither.png` | Generated blob mask |

---

### Task 1: Verification script

CSS and templates have no unit-test framework, so this script is the test suite: it builds the site and greps the sources and the built HTML. Every later task starts by running its group (red) and ends by running it again (green).

**Files:**
- Create: `scripts/check-site.sh`

**Interfaces:**
- Produces: `scripts/check-site.sh [group ...]` with groups `layout type palette window picker background`; exits non-zero on any failure. Later tasks call it by group name.

- [ ] **Step 1: Write the script**

```bash
mkdir -p scripts
```

Write `scripts/check-site.sh`:

```bash
#!/usr/bin/env bash
# Build the site and assert structural expectations, one group per visual-redesign task.
#   scripts/check-site.sh              run every group
#   scripts/check-site.sh layout type  run only the named groups
# Groups: layout type palette window picker background
set -u
cd "$(dirname "$0")/.."

OUT=$(mktemp -d)
trap 'rm -rf "$OUT" "$OUT.log"' EXIT
FAILED=0

pass() { echo "  ok    $1"; }
fail() { echo "  FAIL  $1"; FAILED=1; }
# expect "<what>" <command...>   passes when the command succeeds
expect() { local what=$1; shift; if "$@" >/dev/null 2>&1; then pass "$what"; else fail "$what"; fi; }
# forbid "<what>" <command...>   passes when the command fails
forbid() { local what=$1; shift; if "$@" >/dev/null 2>&1; then fail "$what"; else pass "$what"; fi; }
# count_ge <n> <pattern> <file>  at least n matches of the pattern in the file
count_ge() { [ "$(grep -o -- "$2" "$3" | wc -l)" -ge "$1" ]; }

build() {
    echo "build"
    if hugo --gc --destination "$OUT" >"$OUT.log" 2>&1; then pass "hugo builds"; else fail "hugo builds"; tail -20 "$OUT.log"; fi
    forbid "build log has no WARN or ERROR" grep -Eq "WARN|ERROR" "$OUT.log"
}

group_layout() {
    echo "layout"
    expect "spacing.css defines --gutter" grep -q -- "--gutter:" assets/css/spacing.css
    expect "spacing scale has six steps" count_ge 6 "--space-[1-6]:" assets/css/spacing.css
    expect "layout.css uses --gutter" grep -q -- "--gutter" assets/css/layout.css
    forbid "no width: calc(100% - 2rem) boxes" grep -rq "calc(100% - 2rem)" assets/css
    forbid "no 2rem margin on .boot" grep -q "margin: 2rem" assets/css/boot.css
    forbid "no 2rem padding on .content__body" grep -q "padding: 2rem" assets/css/layout.css
    forbid "footer.css is gone" test -e assets/css/footer.css
    forbid "footer.css is not bundled" grep -q '"footer"' layouts/partials/head.html
    expect "spacing.css is bundled" grep -q '"spacing"' layouts/partials/head.html
    expect "baseof uses page__main" grep -q "page__main" layouts/_default/baseof.html
    forbid "no page_main typo left" grep -rq "page_main" layouts assets
}

group_type() {
    echo "type"
    expect "Departure Mono woff2 is in static/fonts" test -s static/fonts/DepartureMono-Regular.woff2
    expect "font licence is shipped beside it" test -s static/fonts/LICENSE
    expect "woff2 is served by the build" test -s "$OUT/fonts/DepartureMono-Regular.woff2"
    expect "typography.css declares the font face" grep -q 'font-family: "Departure Mono"' assets/css/typography.css
    expect "font is preloaded" grep -Eq 'rel="?preload"?' "$OUT/index.html"
    forbid "no Google Fonts links" grep -q "fonts.googleapis.com" "$OUT/index.html"
    forbid "no VT323 or Press Start left" grep -rqE "VT323|Press Start" assets/css layouts
    forbid "no px font sizes in typography.css" grep -Eq "font-size: *[0-9.]+px" assets/css/typography.css
    forbid "no rem line-height in typography.css" grep -Eq "line-height: *[0-9.]+rem" assets/css/typography.css
    expect "body line-height is unitless 1.5" grep -Eq "line-height: *1\.5;" assets/css/typography.css
    expect "typography.css uses the spacing scale" grep -q "var(--space-4)" assets/css/typography.css
}

group_palette() {
    echo "palette"
    forbid "no data-theme left in assets or layouts" grep -rq "data-theme" assets layouts
    for palette in dark light pink; do
        expect "colours.css has the $palette palette" grep -q "data-palette=\"$palette\"" assets/css/colours.css
    done
    for token in link hover bg-body bg text border-pink border-blue text-header text-subheader text-body \
        inner-bg off-fg muted highlight header-bg header-fg on-highlight glow glow-k off-fg-rgb border-blue-rgb scan-a \
        win-title-bg win-title-fg win-bg win-fg win-border btn-bg btn-fg btn-shadow dither-ink dot-a blob-a; do
        expect "--$token is defined in all three palettes" count_ge 3 "^[[:space:]]*--$token:" assets/css/colours.css
    done
    expect "theme_init sets data-palette" grep -q "data-palette" layouts/partials/theme_init.html
    expect "theme_init still reads the legacy theme key" grep -q '"theme"' layouts/partials/theme_init.html
    expect "built page carries the init script" grep -q "data-palette" "$OUT/index.html"
    expect "chroma light styles also cover pink" grep -q 'data-palette="pink"' assets/css/chroma.css
}

group_window() {
    echo "window"
    expect "window.css exists" test -s assets/css/window.css
    expect "window.css is bundled" grep -q '"window"' layouts/partials/head.html
    for page in index.html about/index.html til/index.html til/go-errgroup/index.html 404.html; do
        expect "$page has at least five titled windows" count_ge 5 "win__title" "$OUT/$page"
    done
    expect "content window title is a ~/ path" grep -Eq 'win__title[^>]*>~/' "$OUT/index.html"
    forbid "old sidebar box classes are gone" grep -rqE "socials__header|side__section" layouts assets
    forbid "empty content footer is gone" grep -q "content__footer" layouts/_default/single.html
}

group_picker() {
    echo "picker"
    expect "button.css defines .btn" grep -q "^\.btn" assets/css/button.css
    expect "button.css is bundled" grep -q '"button"' layouts/partials/head.html
    expect "header has the palette button" grep -Eq 'id="?palette-btn"?' "$OUT/index.html"
    expect "header has the palette popup" grep -Eq 'id="?palette-popup"?' "$OUT/index.html"
    expect "popup lists three palettes" count_ge 3 "data-palette-value" "$OUT/index.html"
    expect "button announces its popup state" grep -q "aria-expanded" "$OUT/index.html"
    forbid "sun/moon toggle is gone" grep -rq "theme-toggle" assets layouts
    expect "script wires the popup" grep -q "palette-popup" assets/js/theme.js
}

group_background() {
    echo "background"
    expect "generator script is executable" test -x scripts/gen-dither.py
    expect "dither mask is committed" test -s static/images/dither.png
    expect "dither mask is a PNG" sh -c 'head -c 4 static/images/dither.png | grep -q PNG'
    expect "background.css is bundled" grep -q '"background"' layouts/partials/head.html
    expect "background.css masks the dither image" grep -q "/images/dither.png" assets/css/background.css
    expect "dots and blobs are drawn in --dither-ink" count_ge 2 "--dither-ink" assets/css/background.css
    expect "print hides the background" grep -q "@media print" assets/css/background.css
    expect ".page sits above the background layers" grep -q "z-index: 1" assets/css/background.css
}

ALL="layout type palette window picker background"
build
for group in ${*:-$ALL}; do
    if declare -F "group_$group" >/dev/null; then "group_$group"; else echo "unknown group: $group"; FAILED=1; fi
done
exit $FAILED
```

- [ ] **Step 2: Make it executable and run everything**

Run: `chmod +x scripts/check-site.sh && scripts/check-site.sh`
Expected: `hugo builds` and `build log has no WARN or ERROR` pass. Every group prints `FAIL` lines (for example `spacing.css defines --gutter`, `Departure Mono woff2 is in static/fonts`). Exit status non-zero. If the build itself fails or warns, stop and fix that first; nothing after this is trustworthy on a broken build.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-site.sh
git commit -m "$(cat <<'EOF'
add site check script for the visual redesign

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Spacing scale and layout structure

Replaces the stacked, per-layer insets with one scale and one gutter, fixes the `page_main` typo and the sidebar width mismatch, and deletes the dead `footer.css`. The existing bordered boxes stay for now (Task 5 replaces them); only their widths change.

**Files:**
- Create: `assets/css/spacing.css`
- Modify: `assets/css/layout.css` (full rewrite), `assets/css/boot.css`, `assets/css/social.css`, `assets/css/side_image.css`, `layouts/_default/baseof.html`, `layouts/partials/head.html`
- Delete: `assets/css/footer.css`

**Interfaces:**
- Produces: tokens `--space-1..6`, `--gutter`; layout classes `.page__header`, `.page__body`, `.page__content`, `.page__main`, `.right__content`. Tasks 5 and 7 edit `.page__content`, `.right__content` and add `.page` stacking.

- [ ] **Step 1: Run the group to see it fail**

Run: `scripts/check-site.sh layout`
Expected: FAIL on `spacing.css defines --gutter`, `layout.css uses --gutter`, `no width: calc(100% - 2rem) boxes`, `footer.css is gone`, `no page_main typo left`, and the rest of the group.

- [ ] **Step 2: Create the scale**

Write `assets/css/spacing.css`:

```css
/* Spacing scale. Every gap, inset and margin in the site draws from these tokens. */
:root {
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 1rem;
    --space-4: 1.5rem;
    --space-5: 2rem;
    --space-6: 3rem;

    /* Page padding, the gap between content and sidebar, and the gap between sidebar boxes */
    --gutter: var(--space-4);
}
```

- [ ] **Step 3: Rewrite `assets/css/layout.css`**

Replace the whole file with:

```css
/* 1rem = 16px by default */
body, html {
    height: 100%;
    margin: 0;
    padding: 0;
    background-color: var(--bg);
    font-family: var(--font-body);
    overflow: hidden;
}

.page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.page__header {
    flex-shrink: 0;
    padding: var(--space-2) var(--gutter);
    display: flex;
    align-items: center;
    color: var(--header-fg);
    background-color: var(--header-bg);
    border-bottom: 3px solid var(--border-pink);
}

/* The only place that insets the page: everything below sits one --gutter from its neighbours */
.page__body {
    display: flex;
    flex: 1;
    gap: var(--gutter);
    padding: var(--gutter);
    min-height: 28.125rem;
    overflow: hidden;
}

.page__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    padding: var(--space-4);
    color: var(--text-body);
    background-color: var(--bg-body);
    border: 2px solid var(--border-pink);
    overflow-x: hidden;
    overflow-y: auto;
    overflow-wrap: break-word;
}

.page__main {
    min-width: 0;
}

.content__header {
    width: 100%;
}

.content__body {
    position: relative;
    z-index: 2;
}

.header__container {
    margin-bottom: var(--space-4);
}

.page__404 {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
}

.post__header a {
    position: relative;
    z-index: 2;
}

.right__content {
    display: flex;
    flex-direction: column;
    gap: var(--gutter);
    flex: 0 0 clamp(18rem, 22%, 26rem);
    overflow-y: auto;
    overflow-x: hidden;
}

/* Responsive Images */
img {
    max-width: 100%;
    height: auto;
    display: block;
    object-fit: contain;
}

/* Responsive adjustments for smaller screens */
@media screen and (max-width: 768px) {
    .page__body {
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .page__content {
        flex: none;
    }

    .right__content {
        flex: none;
        overflow: visible;
    }

    .side__image img {
        max-height: 150px;
        width: auto;
    }

    .content__body img {
        margin: var(--space-2) 0;
    }
}
```

- [ ] **Step 4: Drop the sidebar width hacks**

Run:

```bash
sed -i '' -e '/width: calc(100% - 2rem);/d' -e '/^    margin: 0 auto;$/d' assets/css/social.css assets/css/side_image.css
grep -rn "calc(100% - 2rem)\|margin: 0 auto" assets/css
```

Expected: the `grep` prints nothing. The four sidebar boxes now stretch to the column width (the column no longer centres them).

- [ ] **Step 5: Remove the stacked boot margins**

In `assets/css/boot.css`, replace:

```css
.boot {
    margin: 2rem 2rem 1rem;
}
```

with:

```css
.boot {
    margin: 0 0 var(--space-3);
}
```

and delete the trailing block (and the blank line before it):

```css
@media screen and (max-width: 480px) {
    .boot {
        margin: 1rem 0.5rem;
    }
}
```

- [ ] **Step 6: Fix the class typo and the bundle list; delete `footer.css`**

In `layouts/_default/baseof.html` replace `<div class="page_main">` with `<div class="page__main">`.

In `layouts/partials/head.html` replace:

```
{{ range slice "colours" "footer" "header" "layout" "social" "typography" "side_image" "crt" "chroma" "boot" "scrollbar" }}
```

with:

```
{{ range slice "spacing" "colours" "header" "layout" "social" "typography" "side_image" "crt" "chroma" "boot" "scrollbar" }}
```

Run: `git rm -q assets/css/footer.css`

- [ ] **Step 7: Run the group to see it pass**

Run: `scripts/check-site.sh layout`
Expected: every line `ok`, exit 0.

- [ ] **Step 8: Measure the gaps in the browser**

With the Playwright tools: navigate to `http://localhost:1313/`, resize to 1280x720, and evaluate:

```js
() => {
  const box = s => document.querySelector(s).getBoundingClientRect();
  const c = box('.page__content'), s = box('.right__content'), h = box('.page__header');
  const kids = [...document.querySelectorAll('.right__content > *')].map(e => e.getBoundingClientRect());
  return {
    headerToContent: c.top - h.bottom,
    columnGap: s.left - c.right,
    sidebarGaps: kids.slice(1).map((k, i) => k.top - kids[i].bottom),
    sidebarBoxWidths: [...new Set(kids.map(k => Math.round(k.width)))]
  };
}
```

Expected: `headerToContent` 24, `columnGap` 24, `sidebarGaps` `[24, 24, 24, 24]`, and `sidebarBoxWidths` a single value. Also take a screenshot of `/` and `/about/` and confirm nothing overlaps or is clipped.

- [ ] **Step 9: Commit**

```bash
git add -A assets layouts
git commit -m "$(cat <<'EOF'
add spacing scale and one gutter for every layout gap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Departure Mono and the type scale

**Files:**
- Create: `static/fonts/DepartureMono-Regular.woff2`, `static/fonts/LICENSE`
- Modify: `assets/css/typography.css` (full rewrite), `layouts/partials/head.html`

**Interfaces:**
- Consumes: `--space-*` tokens from Task 2.
- Produces: `--font-body` and `--font-heading` (both Departure Mono); body `font-size: 1.375rem`, `line-height: 1.5`. Later CSS uses `1.375rem` as "base size".

- [ ] **Step 1: Run the group to see it fail**

Run: `scripts/check-site.sh type`
Expected: FAIL on the font file, license, `@font-face`, preload, Google Fonts, VT323 and the px/rem checks.

- [ ] **Step 2: Download the font and its license**

```bash
mkdir -p static/fonts
curl -fL -o static/fonts/DepartureMono-Regular.woff2 https://departuremono.com/assets/DepartureMono-Regular.woff2
curl -fL -o static/fonts/LICENSE https://raw.githubusercontent.com/rektdeckard/departure-mono/main/LICENSE
file static/fonts/DepartureMono-Regular.woff2
head -3 static/fonts/LICENSE
```

Expected: `file` reports `Web Open Font Format (Version 2)`; the license starts with `Copyright` / `SIL Open Font License`.

- [ ] **Step 3: Rewrite `assets/css/typography.css`**

Replace the whole file with:

```css
/* Fonts */
@font-face {
    font-family: "Departure Mono";
    src: url("/fonts/DepartureMono-Regular.woff2") format("woff2");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
}

:root {
    --font-body: "Departure Mono", "Fira Mono", "Consolas", monospace;
    --font-heading: var(--font-body);
}

body {
    font-family: var(--font-body);
    /* 22px is 2x the font's native 11px pixel grid, so glyph edges stay crisp */
    font-size: 1.375rem;
    line-height: 1.5;
    /* Departure Mono has a single weight; a synthesised bold would smear the pixels */
    font-synthesis: none;
    /* keep letters separate; pixel fonts look wrong with fused ligatures */
    font-variant-ligatures: none;
}

/* Headings */
h1 {
    font-size: 2.75rem;
    margin: 0;
    font-weight: 400;
    color: var(--text-header);
    text-shadow: 0 0 8px rgba(var(--glow), calc(0.6 * var(--glow-k))), 0 0 20px rgba(var(--glow), calc(0.25 * var(--glow-k)));
}

h2,
h3,
h4,
h5,
h6 {
    font-size: 1.375rem;
    margin: var(--space-5) 0 var(--space-2) 0;
    font-weight: 400;
    color: var(--text-header);
    text-shadow: 0 0 6px rgba(var(--glow), calc(0.5 * var(--glow-k))), 0 0 15px rgba(var(--glow), calc(0.2 * var(--glow-k)));
}

/* 33px = 3x the pixel grid */
h2 {
    font-size: 2.0625rem;
}

h1+h2,
h1+h3,
h1+h4,
h1+h5,
h1+h6,
h2+h3,
h2+h4,
h2+h5,
h2+h6,
h3+h4,
h3+h5,
h3+h6,
h4+h5,
h4+h6,
h5+h6 {
    margin: 0;
}


h1:first-child {
    margin-top: 0;
}

/* Paragraphs */
p {
    margin: 0 0 var(--space-4) 0;
}

/* Links */
a:link, a:visited {
    color: var(--text-subheader);
}

a:active, a.active {
    color: var(--text-header);
}

a:hover {
    color: var(--text-header);
}

/* Lists */
ul {
    margin: 0 0 var(--space-4) 0;
    padding-left: 1.25rem;
}

ol {
    margin: 0 0 var(--space-4) 0;
    padding-left: 1.75rem;
}

ul ul,
ul ol,
ol ul,
ol ol {
    margin: 0;
}

ul li::marker {
    content: '∗\00A0';
    color: var(--muted);
}

ol li::marker {
    color: var(--muted);
}

dt {
  margin: 0;
  color: var(--off-fg);
}

dd {
  margin: 0 0 0 var(--space-4);
  font-style: italic;
}

dd + dt {
  margin-top: var(--space-4);
}

dl {
  margin: 0 0 var(--space-4) 0;
}

/* Blockquotes */
blockquote {
    position: relative;
    margin: 0 0 var(--space-4) var(--space-4);
}

blockquote::before {
    position: absolute;
    left: calc(-1 * var(--space-4));
    content: ">";
    color: var(--muted);
}

/* Code */
pre,
code, 
kbd,
samp {
    background: var(--inner-bg) !important;
    font-family: var(--font-body);
    color: var(--off-fg);
    font-size: 1.375rem;
}

pre {
    overflow-x: auto;
    padding: var(--space-4);
    margin: 0 0 var(--space-4) 0;
    border: 1px solid var(--border-blue);
    border-radius: 4px;
}

/* Fix overflow when config markup.highlight.lineNos is true */
/* See https://github.com/joeroe/risotto/issues/41 */
.highlight div {
	overflow-x: auto;
}

/* Emphasis: one weight only, so colour does the work */
b,
strong {
    font-weight: 400;
    color: var(--off-fg);
}

/* Highlighting */
::selection,
mark {
    background-color: var(--highlight);
    color: var(--on-highlight);
}

/* Other typographic elements */
hr {
    border: 0;
    margin-bottom: var(--space-4);
}

hr:after {
    content: '---';
    color: var(--muted);
}


/* Prevent super/sub from affecting line height */
sup, sub {
    vertical-align: baseline;
    position: relative;
    top: calc(-1 * var(--space-1));
    font-size: unset;
}
sub { 
    top: var(--space-1); 
}

/* Tables */
table {
    border-spacing: 0;
    margin: 0 0 var(--space-4) 0;
    overflow-wrap: anywhere;
}
th, td {
    padding: 0 var(--space-3);
    vertical-align: top;
}
th:first-child, td:first-child {
    padding-left: 0;
}
th {
    text-align: inherit;
}

/* Figures */
img {
    max-width: 100%;
    height: auto;
}
```

- [ ] **Step 4: Swap the font links in `layouts/partials/head.html`**

Replace:

```
<!-- fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet">
```

with:

```
<!-- fonts: Departure Mono is self-hosted (licence in static/fonts/LICENSE) and declared in assets/css/typography.css -->
<link rel="preload" href="/fonts/DepartureMono-Regular.woff2" as="font" type="font/woff2" crossorigin>
```

- [ ] **Step 5: Run the groups**

Run: `scripts/check-site.sh type layout`
Expected: every line `ok`, exit 0.

- [ ] **Step 6: Check it renders**

Playwright: navigate to `http://localhost:1313/about/`, then evaluate:

```js
async () => {
  await document.fonts.ready;
  return {
    loaded: document.fonts.check('22px "Departure Mono"'),
    family: getComputedStyle(document.body).fontFamily,
    size: getComputedStyle(document.body).fontSize,
    lineHeight: getComputedStyle(document.body).lineHeight
  };
}
```

Expected: `loaded: true`, family starts with `"Departure Mono"`, size `22px`, line height `33px`. Screenshot `/`, `/about/` and `/til/go-errgroup/`. Check the header prompt (`➜`, `✗`) and the `∗` list markers still draw: if Departure Mono lacks a glyph the browser falls back to another monospace, which is acceptable as long as nothing shows as a missing-glyph box. Check the sidebar text does not overflow its box now that the font is wider; `.til__list` items ellipsise by design.

- [ ] **Step 7: Commit**

```bash
git add static/fonts assets/css/typography.css layouts/partials/head.html
git commit -m "$(cat <<'EOF'
switch to self-hosted Departure Mono with a pixel-grid type scale

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Palette tokens and the `data-palette` attribute

Renames the attribute, adds every new token to dark and light, and adds the pink palette. The sun/moon toggle keeps working (dark/light) until Task 6 replaces it.

**Files:**
- Modify: `assets/css/colours.css` (full rewrite), `assets/css/chroma.css`, `assets/css/header.css`, `assets/js/theme.js`, `layouts/partials/theme_init.html`

**Interfaces:**
- Produces: `<html data-palette="dark|light|pink">`; every token in Global Constraints defined for all three. Tasks 5-7 consume `--win-*`, `--btn-*`, `--dither-ink`, `--dot-a`, `--blob-a`.

- [ ] **Step 1: Run the group to see it fail**

Run: `scripts/check-site.sh palette`
Expected: FAIL on `data-theme` left, pink palette, new tokens, `theme_init`, chroma.

- [ ] **Step 2: Rewrite `assets/css/colours.css`**

Replace the whole file with:

```css
/* Palettes. [data-palette] is set on <html> by layouts/partials/theme_init.html before first paint.
   Dark is the default, so with no attribute (no JS) the page is dark.
   Every palette defines every token; add a palette by adding one block here (and one option in
   layouts/partials/header.html plus the PALETTES list in assets/js/theme.js and theme_init.html). */

:root,
:root[data-palette="dark"] {
	color-scheme: dark;

	--link: #7cafc2;
	--hover: #86c1b9;
	--bg-body: #1e2434;
    --bg: #0a1019;
    --text:#878d9d;
    --border-pink: #815f86;
    --border-blue: #779aa1;
    --text-header: #f94eca;
    --text-subheader: #60d3cc;
    --text-body: #b8bcc9;
    --inner-bg: #151b2b;
    --off-fg: #a3be8c;
    --muted: #878d9d;
    --highlight: #815f86;

    --header-bg: #1e2434;
    --header-fg: #fff;
    --on-highlight: #0a1019;

    /* rgb triplets for translucent tints; glow-k scales every neon glow, scan-a the CRT scanlines */
    --glow: 249, 78, 202;
    --glow-k: 1;
    --off-fg-rgb: 163, 190, 140;
    --border-blue-rgb: 119, 154, 161;
    --scan-a: 0.08;

    /* windows and buttons */
    --win-title-bg: var(--border-pink);
    --win-title-fg: #fff;
    --win-bg: var(--bg-body);
    --win-fg: var(--text-body);
    --win-border: var(--border-pink);
    --btn-bg: var(--border-pink);
    --btn-fg: #fff;
    --btn-shadow: var(--border-blue);

    /* background: dot grid (--dot-a) and dithered blobs (--blob-a), both drawn in --dither-ink */
    --dither-ink: var(--border-pink);
    --dot-a: 0.12;
    --blob-a: 0.1;
}

:root[data-palette="light"] {
	color-scheme: light;

	--link: #3d7a94;
	--hover: #2f8a82;
	--bg-body: #f4f5f9;
    --bg: #dde1ec;
    --text: #5b6274;
    --border-pink: #a06fa6;
    --border-blue: #5f8e99;
    --text-header: #b8127f;
    --text-subheader: #167a74;
    --text-body: #2a3142;
    --inner-bg: #e8ebf3;
    --off-fg: #4f7a2f;
    --muted: #6b7285;
    --highlight: #d3aad9;

    --header-bg: #f4f5f9;
    --header-fg: #1a1f2e;
    --on-highlight: #1a1f2e;

    --glow: 184, 18, 127;
    --glow-k: 0.3;
    --off-fg-rgb: 79, 122, 47;
    --border-blue-rgb: 95, 142, 153;
    --scan-a: 0.04;

    --win-title-bg: var(--text-body);
    --win-title-fg: var(--bg-body);
    --win-bg: var(--bg-body);
    --win-fg: var(--text-body);
    --win-border: var(--text-body);
    --btn-bg: var(--highlight);
    --btn-fg: var(--on-highlight);
    --btn-shadow: var(--text-body);

    --dither-ink: var(--border-pink);
    --dot-a: 0.18;
    --blob-a: 0.14;
}

/* typesafe.ai: pink halftone ground, light-grey windows, black title bars */
:root[data-palette="pink"] {
	color-scheme: light;

	--link: #0a5f5a;
	--hover: #a3106f;
	--bg-body: #dcdcdc;
    --bg: #e88ba0;
    --text: #4a4a4a;
    --border-pink: #1e1e1e;
    --border-blue: #1e1e1e;
    --text-header: #a3106f;
    --text-subheader: #0a5f5a;
    --text-body: #1e1e1e;
    --inner-bg: #ececec;
    --off-fg: #2f5f1a;
    --muted: #4a4a4a;
    --highlight: #d65cbb;

    --header-bg: #dcdcdc;
    --header-fg: #1e1e1e;
    --on-highlight: #1e1e1e;

    --glow: 163, 16, 111;
    --glow-k: 0;
    --off-fg-rgb: 47, 95, 26;
    --border-blue-rgb: 30, 30, 30;
    --scan-a: 0;

    --win-title-bg: #1e1e1e;
    --win-title-fg: #dcdcdc;
    --win-bg: #dcdcdc;
    --win-fg: #1e1e1e;
    --win-border: #1e1e1e;
    --btn-bg: #d65cbb;
    --btn-fg: #1e1e1e;
    --btn-shadow: #1e1e1e;

    --dither-ink: #1e1e1e;
    --dot-a: 0.35;
    --blob-a: 0.9;
}
```

- [ ] **Step 3: Point the syntax-highlighting styles at the new attribute**

Pink has light panels, so it uses the light (github) syntax colours. In `assets/css/chroma.css` replace the first two lines:

```
/* Syntax highlighting (Hugo/Chroma). Dark = monokai, light = github, swapped by data-theme.
   Regenerate: hugo gen chromastyles --style=<name>, scoping the light rules under :root[data-theme="light"]. */
```

with:

```
/* Syntax highlighting (Hugo/Chroma). Dark = monokai; light and pink = github, swapped by data-palette.
   Regenerate: hugo gen chromastyles --style=<name>, scoping the light rules under
   :root:is([data-palette="light"], [data-palette="pink"]). */
```

Then run:

```bash
sed -i '' 's/:root\[data-theme="light"\]/:root:is([data-palette="light"], [data-palette="pink"])/' assets/css/chroma.css
grep -c 'data-theme' assets/css/chroma.css
```

Expected: `0`.

- [ ] **Step 4: Rename the attribute in the toggle CSS and JS**

```bash
sed -i '' 's/data-theme/data-palette/g' assets/css/header.css assets/js/theme.js
sed -i '' 's/"theme"/"palette"/g' assets/js/theme.js
grep -n "data-\|localStorage" assets/js/theme.js
```

Expected: every match now reads `data-palette` / `"palette"`.

- [ ] **Step 5: Rewrite `layouts/partials/theme_init.html`**

```html
<!-- Resolve the palette before first paint (stored choice, else OS preference) to avoid a flash.
     "theme" is the key an older version of the site stored; dark/light there are still valid palettes. -->
<script>
(function () {
    var palettes = ["dark", "light", "pink"];
    var palette;
    try { palette = localStorage.getItem("palette") || localStorage.getItem("theme"); } catch (e) {}
    if (palettes.indexOf(palette) === -1) {
        palette = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    document.documentElement.setAttribute("data-palette", palette);
})();
</script>
```

- [ ] **Step 6: Run the group**

Run: `scripts/check-site.sh palette`
Expected: every line `ok`, exit 0.

- [ ] **Step 7: Check all three palettes in the browser**

Playwright, at `http://localhost:1313/about/`, evaluate for each of `dark`, `light`, `pink`:

```js
p => { document.documentElement.dataset.palette = p; return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); }
```

Screenshot each. Expected: `dark` and `light` look exactly as before this task (the toggle still flips between them). `pink` shows a pink background with a grey content box and black borders; it will look unfinished until Tasks 5-7, which is fine. Then test the legacy key: evaluate `localStorage.removeItem('palette'); localStorage.setItem('theme','light')`, reload, and expect `document.documentElement.dataset.palette === 'light'`. Clean up: `localStorage.removeItem('theme')`.

- [ ] **Step 8: Commit**

```bash
git add assets layouts
git commit -m "$(cat <<'EOF'
add palette tokens, a pink palette and the data-palette attribute

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Window component

Replaces the bespoke bordered boxes (content, portrait, status, connect, stack, latest TILs) with `.win`.

**Files:**
- Create: `assets/css/window.css`
- Modify: `layouts/_default/baseof.html` (full rewrite), `layouts/_default/single.html`, `layouts/partials/side_image.html`, `side_status.html`, `side_socials.html`, `side_stack.html`, `side_tils.html`, `layouts/partials/head.html`, `assets/css/layout.css`, `assets/css/social.css` (full rewrite), `assets/css/side_image.css` (full rewrite)

**Interfaces:**
- Consumes: `--win-*` tokens (Task 4), spacing tokens (Task 2).
- Produces: markup contract `<section class="win"><header class="win__title">…</header><div class="win__body">…</div></section>`; `.win[hidden]` is hidden; a `.win` with no title bar gets a full border. Task 6's popup uses this contract.

- [ ] **Step 1: Run the group to see it fail**

Run: `scripts/check-site.sh window`
Expected: FAIL on `window.css exists`, the five `titled windows` lines, and the old-class check.

- [ ] **Step 2: Create `assets/css/window.css`**

```css
/* Window: black title bar over a light panel with an inset double frame (typesafe.ai style).
   <section class="win"><header class="win__title">name</header><div class="win__body">…</div></section> */
.win {
    display: flex;
    flex-direction: column;
    min-width: 0;
    box-shadow: 2px 2px 0 var(--win-border);
}

.win[hidden] {
    display: none;
}

.win__title {
    padding: var(--space-1) var(--space-2);
    color: var(--win-title-fg);
    background-color: var(--win-title-bg);
    border: 2px solid var(--win-border);
    border-bottom: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.win__body {
    padding: var(--space-4);
    color: var(--win-fg);
    background-color: var(--win-bg);
    border: 2px solid var(--win-border);
    /* second, thinner frame 3px inside the first; inset shadows stay put while the body scrolls */
    box-shadow: inset 0 0 0 3px var(--win-bg), inset 0 0 0 4px var(--win-border);
}

/* Under a title bar the bar supplies the top edge */
.win__title + .win__body {
    border-top: 0;
}

/* The body owns the inset, so its first and last blocks add no margin of their own */
.win__body > :first-child {
    margin-top: 0;
}

.win__body > :last-child,
.page__main > :last-child,
.content__body > :last-child {
    margin-bottom: 0;
}
```

- [ ] **Step 3: Add it to the bundle**

In `layouts/partials/head.html` replace:

```
{{ range slice "spacing" "colours" "header" "layout" "social" "typography" "side_image" "crt" "chroma" "boot" "scrollbar" }}
```

with:

```
{{ range slice "spacing" "colours" "window" "header" "layout" "social" "typography" "side_image" "crt" "chroma" "boot" "scrollbar" }}
```

- [ ] **Step 4: Rewrite `layouts/_default/baseof.html`**

```html
<!DOCTYPE html>
<html lang="{{- site.Language.Lang -}}">

    <head>
        {{- partial "head.html" . -}}
    </head>

    <body>
        <div class="page">
            
            <header class="page__header">
                {{- partial "header.html" . -}}
            </header>

            <div class="page__body">
                <section class="page__content win">
                    <header class="win__title">~/{{ replace (lower .Title) " " "_" }}</header>
                    <div class="win__body">
                        {{ partial "title.html" . }}
                        <div class="page__main">
                            {{- block "main" . }}{{- end }}
                        </div>
                    </div>
                </section>

                <section class="right__content">
                        {{- partial "side_image.html" . -}}
                        {{- partial "side_status.html" . -}}
                        {{- partial "side_socials.html" . -}}
                        {{- partial "side_stack.html" . -}}
                        {{- partial "side_tils.html" . -}}
                </section>
            </div>

        </div>
    </body>
</html>
```

- [ ] **Step 5: Rewrite the sidebar partials**

`layouts/partials/side_image.html`:

```html
<div class="side__image win">
    <div class="win__body">
        <img src="/images/standing.png" alt="Standing">
    </div>
</div>
```

`layouts/partials/side_status.html`:

```html
<section class="win side__status">
    <header class="win__title">status</header>
    <div class="win__body">
        <div class="status__line">
            <span class="status__dot"></span>
            <span class="status__label">status:</span>
            <span class="status__value">online</span>
        </div>
        <div class="status__line">
            <span class="status__label">&gt; location:</span>
            <span class="status__value">Brazil</span>
        </div>
    </div>
</section>
```

`layouts/partials/side_socials.html`:

```html
<section class="win side__socials">
    <header class="win__title">connect</header>
    <nav class="win__body socials__nav" aria-label="Social media links">
        <div class="socials__list">
            <div class="socials__item">
                <a href="https://linkedin.com/in/dpcamargo" 
                   rel="me" 
                   aria-label="LinkedIn Profile" 
                   title="Connect on LinkedIn" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="socials__link">
                    <i class="fa-brands fa-linkedin" aria-hidden="true"></i>
                    <span class="socials__text">LinkedIn</span>
                </a>
            </div>
            <div class="socials__item">
                <a href="https://github.com/dpcamargo" 
                   rel="me" 
                   aria-label="GitHub Profile" 
                   title="View GitHub Profile" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="socials__link">
                    <i class="fa-brands fa-github" aria-hidden="true"></i>
                    <span class="socials__text">GitHub</span>
                </a>
            </div>
        </div>
    </nav>
</section>
```

`layouts/partials/side_stack.html`:

```html
<section class="win side__stack">
    <header class="win__title">stack</header>
    <nav class="win__body socials__nav" aria-label="Tech stack links">
        <div class="socials__list">
            <div class="socials__item">
                <a href="https://go.dev/" 
                   title="Go" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="socials__link">
                    <i class="fa-brands fa-golang" aria-hidden="true"></i>
                    <span class="socials__text">Go</span>
                </a>
            </div>
            <div class="socials__item">
                <a href="https://www.java.com/" 
                   title="Java" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="socials__link">
                    <i class="fa-brands fa-java" aria-hidden="true"></i>
                    <span class="socials__text">Java</span>
                </a>
            </div>
            <div class="socials__item">
                <a href="https://www.python.org/" 
                   title="Python" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="socials__link">
                    <i class="fa-brands fa-python" aria-hidden="true"></i>
                    <span class="socials__text">Python</span>
                </a>
            </div>
        </div>
    </nav>
</section>
```

`layouts/partials/side_tils.html`:

```html
<section class="win side__tils">
    <header class="win__title">latest_til</header>
    <div class="win__body">
        <ul class="til__list">
            {{ range first 5 (where .Site.RegularPages "Section" "til") }}
            <li><a href="{{ .RelPermalink }}">{{ .Title }}</a></li>
            {{ end }}
        </ul>
    </div>
</section>
```

- [ ] **Step 6: Remove the empty footer from `layouts/_default/single.html`**

Delete the line `<footer class="content__footer"></footer>` (nothing styles or fills it, and it would leave an extra margin under the last paragraph).

- [ ] **Step 7: Rewrite `assets/css/social.css`**

The box frames now come from `.win`; this file keeps only what is inside them.

```css
/* Inside the sidebar windows: link lists, the TIL list and the status line.
   The frames come from window.css. */
.socials__nav {
    width: 100%;
}

.socials__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.socials__item {
    width: 100%;
}

.socials__link {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    text-decoration: none;
    border: 1px solid transparent;
    transition: all 0.2s ease;
    background: transparent;
}

.socials__link:hover {
    background-color: rgba(var(--off-fg-rgb), 0.1);
    border-color: var(--off-fg);
}

.socials__link:focus {
    outline: 1px solid var(--border-blue);
    outline-offset: 2px;
}

.socials__text {
    font-size: 1.375rem;
    color: var(--win-fg);
}

.socials__link:hover .socials__text {
    color: var(--off-fg);
}

.fa-brands {
    font-size: 1.8rem;
    color: var(--text-subheader);
    transition: color 0.2s ease;
}

.socials__link:hover .fa-brands {
    color: var(--off-fg);
}

/* Latest TILs */
.til__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.til__list li {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.til__list li::marker {
    content: none;
}

.til__list li::before {
    content: "~ ";
    color: var(--muted);
}

.til__list li a {
    text-decoration: none;
    color: var(--win-fg);
    transition: color 0.2s ease;
}

.til__list li a:hover {
    color: var(--off-fg);
}

/* Status line */
.status__line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.status__line + .status__line {
    margin-top: var(--space-1);
}

.status__dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: var(--off-fg);
    animation: blink-dot 1.5s infinite;
}

@keyframes blink-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}

.status__label {
    color: var(--muted);
}

.status__value {
    color: var(--off-fg);
}
```

- [ ] **Step 8: Rewrite `assets/css/side_image.css`**

```css
/* Sidebar portrait; the frame comes from window.css */
.side__image {
    flex-shrink: 0;
}

.side__image .win__body {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-2);
    overflow: hidden;
}

.side__image img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    transition: transform 0.3s ease, filter 0.3s ease;
}

.side__image:hover img {
    transform: scale(1.05);
    filter: drop-shadow(0 0 12px rgba(var(--glow), calc(0.5 * var(--glow-k))));
}

/* Content images */
.content__body img {
    max-width: 100%;
    height: auto;
    margin: var(--space-3) 0;
    min-height: 2rem;
}

@media screen and (max-width: 480px) {
    .side__image img {
        max-height: 100px;
        width: auto;
    }

    .content__body img {
        margin: var(--space-1) 0;
    }
}
```

- [ ] **Step 9: Let the layout use the windows**

In `assets/css/layout.css` replace the `.page__content` block:

```css
.page__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    padding: var(--space-4);
    color: var(--text-body);
    background-color: var(--bg-body);
    border: 2px solid var(--border-pink);
    overflow-x: hidden;
    overflow-y: auto;
    overflow-wrap: break-word;
}
```

with:

```css
/* The content window fills the column; only its body scrolls, so the title bar stays put */
.page__content {
    flex: 1;
    min-height: 0;
}

.page__content .win__body {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overflow-wrap: break-word;
}
```

Replace the `.right__content` block:

```css
.right__content {
    display: flex;
    flex-direction: column;
    gap: var(--gutter);
    flex: 0 0 clamp(18rem, 22%, 26rem);
    overflow-y: auto;
    overflow-x: hidden;
}
```

with:

```css
.right__content {
    display: flex;
    flex-direction: column;
    gap: var(--gutter);
    flex: 0 0 clamp(18rem, 22%, 26rem);
    overflow-y: auto;
    overflow-x: hidden;
    /* room for the windows' 2px hard shadow, which the overflow would otherwise clip */
    padding: 0 var(--space-1) var(--space-1) 0;
}

.right__content > .win {
    flex-shrink: 0;
}

.right__content .win__body {
    padding: var(--space-3);
}
```

And inside the `@media screen and (max-width: 768px)` block, after the `.page__content { flex: none; }` rule add:

```css
    .page__content .win__body {
        flex: none;
        overflow: visible;
    }
```

- [ ] **Step 10: Run the groups**

Run: `scripts/check-site.sh window layout type palette`
Expected: every line `ok`, exit 0.

- [ ] **Step 11: Check it in the browser**

Playwright, `http://localhost:1313/` at 1280x720; screenshot dark, light and pink (set `document.documentElement.dataset.palette`). Expect: black/slate title bars named `~/boot`, `status`, `connect`, `stack`, `latest_til`, an untitled portrait window, inset double frame, hard 2px shadow, all sidebar windows the same width. Then evaluate on `/til/go-errgroup/`:

```js
() => {
  const body = document.querySelector('.page__content .win__body');
  const title = document.querySelector('.page__content .win__title').getBoundingClientRect();
  body.scrollTop = 200;
  return { scrolls: body.scrollHeight > body.clientHeight, titleTopAfterScroll: document.querySelector('.page__content .win__title').getBoundingClientRect().top === title.top };
}
```

Expected: `titleTopAfterScroll: true` (the title bar does not scroll away). Also resize to 390x800 and confirm the page stacks in one column and nothing is clipped horizontally. Check the spacing: measure `.win__body` padding on `.page__content` (24px) and confirm the first heading or boot line sits exactly that far below the title bar, and the last paragraph sits 24px above the bottom frame (no double margin).

- [ ] **Step 12: Commit**

```bash
git add -A assets layouts
git commit -m "$(cat <<'EOF'
replace bordered boxes with title-bar windows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Button and palette picker

**Files:**
- Create: `assets/css/button.css`
- Modify: `layouts/partials/header.html` (full rewrite), `assets/css/header.css`, `assets/js/theme.js` (full rewrite), `layouts/partials/head.html`

**Interfaces:**
- Consumes: `.win` markup contract (Task 5), `--btn-*` tokens (Task 4), `theme_init.html`'s `data-palette` on load.
- Produces: `.btn` (usable on `<button>` or `<a>`; sub-project 2 uses it for the language link). DOM ids `palette-btn`, `palette-popup`; option buttons carry `data-palette-value` and `aria-pressed`.

- [ ] **Step 1: Run the group to see it fail**

Run: `scripts/check-site.sh picker`
Expected: FAIL on `button.css`, palette button/popup, `theme-toggle`.

- [ ] **Step 2: Create `assets/css/button.css`**

```css
/* Hard-shadow pixel button (typesafe.ai style). Works on <button> and <a>. */
.btn {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    font: inherit;
    color: var(--btn-fg);
    background-color: var(--btn-bg);
    border: 0;
    border-radius: 0;
    box-shadow: 3px 3px 0 var(--btn-shadow);
    text-decoration: none;
    cursor: pointer;
    transition: filter 0.15s ease;
}

a.btn:link,
a.btn:visited,
a.btn:hover,
a.btn:active {
    color: var(--btn-fg);
}

.btn:hover {
    filter: brightness(1.15);
}

.btn:active {
    transform: translate(3px, 3px);
    box-shadow: none;
}

.btn:focus-visible {
    outline: 2px solid var(--text-header);
    outline-offset: 2px;
}
```

- [ ] **Step 3: Add it to the bundle**

In `layouts/partials/head.html` replace:

```
{{ range slice "spacing" "colours" "window" "header" "layout" "social" "typography" "side_image" "crt" "chroma" "boot" "scrollbar" }}
```

with:

```
{{ range slice "spacing" "colours" "window" "button" "header" "layout" "social" "typography" "side_image" "crt" "chroma" "boot" "scrollbar" }}
```

- [ ] **Step 4: Rewrite `layouts/partials/header.html`**

The sun/moon `<li>` becomes the palette button plus its popup:

```html
<nav class="main-nav">
    <ul>
    <a href="{{ .Site.BaseURL }}" class="page__logo-inner">
      <span class="head-circle">o</span>
      <span class="head-arrow">➜</span>
      <span class="head-text">{{ .Site.Params.Theme.header_text }}</span>
      <span class="head-branch">{{ replace (lower .Title) " " "_" }}</span>
      <span class="head-x">✗</span>
      <span class="blinking-underscore">_</span>
    </a>
    {{ $currentPage := . }}
    {{ range .Site.Menus.main }}
    <li class="main-nav__item"><a class="nav-main-item{{ if or ($currentPage.IsMenuCurrent "main" .) ($currentPage.HasMenuCurrent "main" .) (eq ($currentPage.Permalink) (.URL | absLangURL)) }} active{{end}}" href="{{ .URL | absLangURL }}" title="{{ .Title }}">{{ .Name }}</a></li>
    {{ end }}
    <li class="main-nav__item palette-item">
        <button type="button" id="palette-btn" class="btn" aria-haspopup="true" aria-expanded="false" aria-controls="palette-popup">
            <span class="palette-btn__label">dark</span>
        </button>
        <div id="palette-popup" class="win palette-popup" role="group" aria-label="Palette" hidden>
            <header class="win__title">palette</header>
            <div class="win__body">
                <button type="button" class="palette-option" data-palette-value="dark" aria-pressed="false">dark</button>
                <button type="button" class="palette-option" data-palette-value="light" aria-pressed="false">light</button>
                <button type="button" class="palette-option" data-palette-value="pink" aria-pressed="false">pink</button>
            </div>
        </div>
    </li>
    </ul>
</nav>
```

- [ ] **Step 5: Swap the toggle styles in `assets/css/header.css`**

Delete everything from the line `/* Theme toggle: pixel-art sun / moon pinned to the right of the header */` to the end of the file, then append:

```css
/* Palette picker: the button is pinned to the right of the header, its popup opens below it */
.main-nav {
    flex: 1;
}

.main-nav li.palette-item {
    position: relative;
    margin-left: auto;
}

.main-nav li.palette-item::before {
    content: none;
}

.palette-popup {
    position: absolute;
    top: calc(100% + var(--space-2));
    right: 0;
    z-index: 100;
    min-width: 12rem;
}

.palette-popup .win__body {
    padding: var(--space-2);
}

.palette-option {
    appearance: none;
    display: block;
    width: 100%;
    padding: var(--space-1) var(--space-2);
    font: inherit;
    text-align: left;
    color: var(--win-fg);
    background: none;
    border: 0;
    cursor: pointer;
}

.palette-option::before {
    content: "  ";
    white-space: pre;
}

.palette-option[aria-pressed="true"]::before {
    content: "> ";
    color: var(--off-fg);
}

.palette-option:hover,
.palette-option:focus-visible {
    color: var(--win-title-fg);
    background-color: var(--win-title-bg);
    outline: 0;
}
```

- [ ] **Step 6: Rewrite `assets/js/theme.js`**

```js
(function () {
    var PALETTES = ["dark", "light", "pink"];
    var root = document.documentElement;
    var button = document.getElementById("palette-btn");
    var popup = document.getElementById("palette-popup");
    var label = button && button.querySelector(".palette-btn__label");
    var options = popup ? popup.querySelectorAll("[data-palette-value]") : [];
    var query = matchMedia("(prefers-color-scheme: light)");

    function valid(value) {
        return PALETTES.indexOf(value) !== -1 ? value : null;
    }

    // The visitor's own choice, if any ("theme" is the key an older version of the site used)
    function stored() {
        try { return valid(localStorage.getItem("palette")) || valid(localStorage.getItem("theme")); } catch (e) { return null; }
    }

    function apply(palette) {
        root.setAttribute("data-palette", palette);
        if (label) label.textContent = palette;
        options.forEach(function (option) {
            option.setAttribute("aria-pressed", String(option.getAttribute("data-palette-value") === palette));
        });
    }

    function setOpen(open) {
        popup.hidden = !open;
        button.setAttribute("aria-expanded", String(open));
        if (open) {
            var current = popup.querySelector('[aria-pressed="true"]');
            if (current) current.focus();
        }
    }

    // theme_init.html already set the attribute before first paint; sync the button and options to it
    apply(valid(root.getAttribute("data-palette")) || "dark");

    if (button && popup) {
        button.addEventListener("click", function () {
            setOpen(popup.hidden);
        });

        options.forEach(function (option) {
            option.addEventListener("click", function () {
                var palette = option.getAttribute("data-palette-value");
                apply(palette);
                try { localStorage.setItem("palette", palette); } catch (e) {}
                setOpen(false);
                button.focus();
            });
        });

        document.addEventListener("click", function (event) {
            if (!popup.hidden && !popup.contains(event.target) && !button.contains(event.target)) setOpen(false);
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !popup.hidden) {
                setOpen(false);
                button.focus();
            }
        });
    }

    // Follow the OS until the visitor picks a palette themselves
    query.addEventListener("change", function (event) {
        if (!stored()) apply(event.matches ? "light" : "dark");
    });
})();
```

- [ ] **Step 7: Run the groups**

Run: `scripts/check-site.sh picker palette window`
Expected: every line `ok`, exit 0.

- [ ] **Step 8: Exercise it in the browser**

Playwright, `http://localhost:1313/`, first `localStorage.clear()` and reload. Then:
1. Popup is closed: `document.getElementById('palette-popup').hidden === true`, button `aria-expanded="false"`.
2. Click `#palette-btn`: popup visible below the button, right-aligned, above page content; `aria-expanded="true"`; focus is on the pressed option (`document.activeElement.dataset.paletteValue` equals the current palette).
3. Click the `pink` option: `documentElement.dataset.palette === 'pink'`, `localStorage.getItem('palette') === 'pink'`, button label reads `pink`, popup closed, focus back on the button.
4. Reload: still pink, with no flash of another palette (screenshot right after load).
5. Keyboard only: focus the button, press Enter (opens), Esc (closes, focus on the button); open again and click outside on the page background (closes).
6. Take a screenshot of the open popup in each palette; the option text must be readable and the selected option marked `>`.
7. Set `localStorage.clear()` and reload with the browser emulating light colour scheme (`browser_emulate_media` with colorScheme light): palette is `light`.
Clean up with `localStorage.clear()`.

- [ ] **Step 9: Commit**

```bash
git add -A assets layouts
git commit -m "$(cat <<'EOF'
replace the theme toggle with a palette picker and pixel button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Dithered background

**Files:**
- Create: `scripts/gen-dither.py`, `static/images/dither.png` (generated), `assets/css/background.css`
- Modify: `layouts/partials/head.html`

**Interfaces:**
- Consumes: `--dither-ink`, `--dot-a`, `--blob-a` (Task 4).
- Produces: fixed layers on `<html>::before` (dots) and `<html>::after` (blobs); `.page` gets `position: relative; z-index: 1` so windows sit above them.

- [ ] **Step 1: Run the group to see it fail**

Run: `scripts/check-site.sh background`
Expected: FAIL on every line except `hugo builds`-level checks.

- [ ] **Step 2: Create the generator**

Write `scripts/gen-dither.py`:

```python
#!/usr/bin/env python3
"""Generate static/images/dither.png: an alpha mask of dithered blobs.

The site paints it as a CSS mask over a --dither-ink colour, so one image
recolours per palette. Standard library only; the output is deterministic.

    python3 scripts/gen-dither.py [output.png]
"""
import random
import struct
import sys
import zlib

WIDTH, HEIGHT = 480, 270   # CSS draws it at 4x or more with image-rendering: pixelated
CELL = 96                  # size of the biggest blobs, in pixels
OCTAVES = 3
SEED = 7

# 8x8 Bayer matrix: the classic ordered-dither threshold pattern
BAYER = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
]


def smoothstep(t):
    return t * t * (3 - 2 * t)


def value_noise(rng, width, height, cell):
    """One octave of smooth random values in 0..1."""
    grid_w, grid_h = width // cell + 2, height // cell + 2
    grid = [[rng.random() for _ in range(grid_w)] for _ in range(grid_h)]
    rows = []
    for y in range(height):
        gy, fy = divmod(y / cell, 1)
        gy = int(gy)
        fy = smoothstep(fy)
        row = []
        for x in range(width):
            gx, fx = divmod(x / cell, 1)
            gx = int(gx)
            fx = smoothstep(fx)
            top = grid[gy][gx] * (1 - fx) + grid[gy][gx + 1] * fx
            bottom = grid[gy + 1][gx] * (1 - fx) + grid[gy + 1][gx + 1] * fx
            row.append(top * (1 - fy) + bottom * fy)
        rows.append(row)
    return rows


def field(rng):
    """Several octaves of noise summed into one 0..1 field."""
    total = [[0.0] * WIDTH for _ in range(HEIGHT)]
    amplitude, norm = 1.0, 0.0
    for octave in range(OCTAVES):
        layer = value_noise(rng, WIDTH, HEIGHT, max(4, CELL // (2 ** octave)))
        for y in range(HEIGHT):
            for x in range(WIDTH):
                total[y][x] += layer[y][x] * amplitude
        norm += amplitude
        amplitude /= 2
    return [[value / norm for value in row] for row in total]


def png_chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def write_png(path, rows):
    """Grey+alpha PNG: black pixels, alpha 255 where a dot is drawn."""
    raw = b"".join(b"\x00" + b"".join(b"\x00\xff" if on else b"\x00\x00" for on in row) for row in rows)
    with open(path, "wb") as out:
        out.write(b"\x89PNG\r\n\x1a\n")
        out.write(png_chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 4, 0, 0, 0)))
        out.write(png_chunk(b"IDAT", zlib.compress(raw, 9)))
        out.write(png_chunk(b"IEND", b""))


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "static/images/dither.png"
    noise = field(random.Random(SEED))
    rows = []
    for y in range(HEIGHT):
        row = []
        for x in range(WIDTH):
            # Stretch the middle of the noise range so blobs have a solid core and a fading, dithered edge
            density = min(1.0, max(0.0, (noise[y][x] - 0.42) / 0.22))
            row.append(density > (BAYER[y % 8][x % 8] + 0.5) / 64)
        rows.append(row)
    write_png(path, rows)
    filled = sum(map(sum, rows)) / (WIDTH * HEIGHT)
    print(f"wrote {path}: {WIDTH}x{HEIGHT}, {filled:.0%} filled")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Generate the mask**

```bash
chmod +x scripts/gen-dither.py
python3 scripts/gen-dither.py
file static/images/dither.png
```

Expected: `wrote static/images/dither.png: 480x270, 22% filled` and `PNG image data, 480 x 270, 8-bit gray+alpha`. Re-running produces an identical file (`git status` shows no change after the first commit).

- [ ] **Step 4: Create `assets/css/background.css`**

```css
/* Halftone background: a dot grid and dithered blobs, both drawn in --dither-ink.
   Two fixed layers behind .page; the windows are opaque, so they read as floating over it. */
html::before,
html::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
}

/* Dot grid */
html::before {
    background-image: radial-gradient(var(--dither-ink) 1px, transparent 1.5px);
    background-size: 4px 4px;
    opacity: var(--dot-a);
}

/* Blobs: one alpha image, recoloured per palette by painting --dither-ink through it as a mask.
   Regenerate with scripts/gen-dither.py */
html::after {
    background-color: var(--dither-ink);
    opacity: var(--blob-a);
    -webkit-mask: url("/images/dither.png") center / cover no-repeat;
    mask: url("/images/dither.png") center / cover no-repeat;
    image-rendering: pixelated;
}

.page {
    position: relative;
    z-index: 1;
}

@media print {
    html::before,
    html::after {
        display: none;
    }
}
```

- [ ] **Step 5: Add it to the bundle**

In `layouts/partials/head.html` replace:

```
{{ range slice "spacing" "colours" "window" "button" "header" "layout" "social" "typography" "side_image" "crt" "chroma" "boot" "scrollbar" }}
```

with:

```
{{ range slice "spacing" "colours" "window" "button" "header" "layout" "social" "typography" "side_image" "crt" "chroma" "boot" "scrollbar" "background" }}
```

- [ ] **Step 6: Run the whole suite**

Run: `scripts/check-site.sh`
Expected: every line `ok`, exit 0.

- [ ] **Step 7: Look at it**

Playwright, `http://localhost:1313/` at 1440x900; screenshot each palette. Expect: pink shows pink ground, black dot grid and dark dithered blobs behind the windows; dark and light show a very faint version. Check: the blobs' pixels are chunky and square (not smoothed) at 1440 wide; windows, header and text are unaffected and clickable; the CRT scanlines still overlay dark and light and are absent in pink.

If the blob edges look blurry, `image-rendering: pixelated` is not being applied to the mask in that browser. Fix by replacing `center / cover` with an explicit integer scale, for example `mask-size: 1920px 1080px; mask-position: center`, and re-check. If a browser will not render the mask at all, delete the `html::after` rule and keep the dot grid; both layers are independent, and the spec allows this fallback. Then emulate print (`browser_emulate_media` media `print`) and confirm `getComputedStyle(document.documentElement, '::before').display === 'none'`.

- [ ] **Step 8: Commit**

```bash
git add scripts/gen-dither.py static/images/dither.png assets/css/background.css layouts/partials/head.html
git commit -m "$(cat <<'EOF'
add dithered halftone background recoloured per palette

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Final verification

No new code unless a check fails; fix anything found and commit it as a separate `fix:` commit.

**Files:**
- Modify: whatever a failed check points at

- [ ] **Step 1: Full production build**

Run: `hugo --gc --minify --destination "$(mktemp -d)" && echo BUILD_OK`
Expected: no `WARN` or `ERROR` lines, `BUILD_OK`. Then `scripts/check-site.sh`: all `ok`.

- [ ] **Step 2: Screenshot matrix**

For pages `/`, `/about/`, `/til/go-errgroup/` × palettes `dark`, `light`, `pink` × widths 1440, 768, 390, set the palette with `document.documentElement.dataset.palette = ...` and take a screenshot (27 shots, saved in the scratchpad). Review each for: overlapping or clipped elements, horizontal page scroll, text overflowing a window, a window wider than its column, the header wrapping badly at 390.

- [ ] **Step 3: Spacing acceptance**

At 1280x720 on `/` and `/about/`, re-run the Task 2 measurement script. Expected: `headerToContent` 24, `columnGap` 24, `sidebarGaps` all 24, one `sidebarBoxWidths` value. On `/`, also confirm the boot log starts exactly one `--space-4` (24px) below the content window's title bar.

- [ ] **Step 4: Contrast (WCAG AA)**

For each palette, evaluate on `/til/go-errgroup/`:

```js
p => {
  document.documentElement.dataset.palette = p;
  const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
  const bg = getComputedStyle(document.querySelector('.page__content .win__body')).backgroundColor;
  const fg = s => getComputedStyle(document.querySelector(s)).color;
  return {
    palette: p,
    body: ratio(fg('.content__body p'), bg),
    link: ratio(fg('.content__body a, .til__list a'), bg),
    heading: ratio(fg('.content__body h3'), bg),
    titleBar: ratio(fg('.page__content .win__title'), getComputedStyle(document.querySelector('.page__content .win__title')).backgroundColor)
  };
}
```

Expected: every ratio at least 4.5. If one is lower, adjust that palette's token in `assets/css/colours.css` (darken or lighten only that colour) and re-run. The decorative logo colours in the header (`.head-*`) are hard-coded and out of scope for this check.

- [ ] **Step 5: Keyboard and motion**

Tab through the header and page: the palette button and each option show a visible focus outline in all three palettes. Emulate `prefers-reduced-motion: reduce` and confirm nothing new animates (the background layers are static).

- [ ] **Step 6: Report**

If anything was fixed, commit it (`git commit -m "fix: ..."` with the trailer). Then tell the user the visual pass is done, list what changed against the spec (the blob layer is a generated PNG mask rather than an inline SVG filter, see the spec), and hand over to the i18n plan.
