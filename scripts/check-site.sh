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
