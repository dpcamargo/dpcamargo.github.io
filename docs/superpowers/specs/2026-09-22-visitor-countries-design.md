# Boot page: visitor countries

Adds a country-visit metric to the home page's boot log: a summary line plus a top-5 ranked list, sourced from GoatCounter and baked into the site at build time.

## Goals

- Show how many countries have visited the site, and the top 5 by visit count, on the boot page (`/` and `/pt/`).
- No live network call from the visitor's browser; no cookies, no consent banner.

Non-goals: a live/real-time counter, a full country table, historical trends or graphs, human-vs-bot breakdown (that is a separate feature, specced on its own after this one ships).

## GoatCounter API facts this design relies on (checked against the live docs and `/api.json`, not memory)

- Base URL is per-site: `https://{CODE}.goatcounter.com/api/v0`.
- Auth: `Authorization: Bearer <token>` plus `Content-Type: application/json`. (Basic auth with the token as the password also works; this design uses Bearer.)
- Country breakdown is `GET /api/v0/stats/locations`, one case of the generic `GET /api/v0/stats/{page}` endpoint (`page` ∈ `browsers`, `systems`, `locations`, `languages`, `sizes`, `campaigns`, `toprefs`).
- Query params: `start`, `end` (date-time, default `start` is **one week ago** — an explicit early `start` is required for an all-time total, not just recent traffic), `limit` (1–100, default 20), `offset`.
- Response shape: `{"more": bool, "stats": [{"id": "US", "name": "United States", "count": 42, ...}, ...]}`.
- Rate limit is 4 requests/second — irrelevant at the one-request-a-day scale this design uses.
- GoatCounter's own selling point (not independently verified here, but load-bearing for the "no consent banner" claim): it records no cookies and no personally-identifying data, positioning itself as usable without a GDPR consent banner.

## Design

### Setup (the site owner's side; nothing here is something Claude can do)

1. Create a free GoatCounter account; note the site code (e.g. `dario`) — not secret, it appears in a public tracking snippet.
2. Add the tracking snippet GoatCounter provides (`<script data-goatcounter="https://{CODE}.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>`) to `layouts/partials/head.html`, so visits start being recorded. This is the only client-side piece; nothing else in this design runs in the browser.
3. Generate a read-only API token; add two GitHub Actions repository settings: `GOATCOUNTER_SITE_CODE` as a repository **variable** (not secret — it is not sensitive) and `GOATCOUNTER_API_TOKEN` as a repository **secret**.

### Data flow

- New `scripts/fetch-visitor-stats.py` (standard library only, matching `check-translations.py` and `gen-dither.py`): reads `GOATCOUNTER_SITE_CODE` and `GOATCOUNTER_API_TOKEN` from the environment, calls `GET /api/v0/stats/locations` with `start=2020-01-01T00:00:00Z` (a fixed date well before tracking could plausibly begin — an over-early date costs nothing, GoatCounter simply returns what it has) and `limit=100`, and writes `data/visitor_countries.json`:
  ```json
  {
    "generated": "2026-09-22T06:00:03Z",
    "total_countries": 14,
    "top": [
      {"code": "BR", "name": "Brazil", "count": 42},
      {"code": "US", "name": "United States", "count": 18}
    ]
  }
  ```
  `total_countries` is the count of every country GoatCounter returned (capped at 100 — unlikely to matter for a personal site; if it ever does, the script logs a warning rather than paginating). `top` is the top 5 by count, sorted defensively by the script rather than trusting the API's ordering.
- **Failure is non-fatal and non-destructive.** A missing env var, a network error, or a non-200 response makes the script print to stderr and exit 0 without touching the existing `data/visitor_countries.json`. A bad API call must never fail the site build, and must never wipe out the last good numbers.
- `data/visitor_countries.json` is committed to the repo with an empty placeholder (`{"generated": null, "total_countries": 0, "top": []}`), so `hugo serve` works locally with no secret and the boot page simply shows nothing extra until real data exists.
- The script is **not** expected to commit its output back to git. It runs as a build step inside GitHub Actions and only needs to produce a file for that build's `hugo build` to read; the committed placeholder stays as the fallback for local development and for any build where the fetch step is skipped or fails.

### GitHub Actions (`.github/workflows/hugo.yaml`)

- Add a `schedule:` trigger (daily) alongside the existing `push` and `workflow_dispatch` triggers, so the boot page's numbers refresh even without a code change.
- Add a step, `python3 scripts/fetch-visitor-stats.py`, after checkout and before `hugo build`, with `GOATCOUNTER_SITE_CODE: ${{ vars.GOATCOUNTER_SITE_CODE }}` and `GOATCOUNTER_API_TOKEN: ${{ secrets.GOATCOUNTER_API_TOKEN }}`.

### Display (`layouts/partials/boot.html`)

- No new CSS or component. Each country row reuses the existing `boot_line.html` partial exactly as the other boot lines do, so it staggers in with the rest of the log and gets the same `[ OK ]` tag styling for free.
- Rendered only `{{ with site.Data.visitor_countries }}{{ if gt (len .top) 0 }}...{{ end }}{{ end }}` — the empty placeholder renders nothing, no error, no "0 countries" line.
- One summary line: `{{ i18n "boot_visitors" }}` → "Received visitors from %d countries." / "Recebeu visitas de %d países." (printf'd with `.total_countries`), followed by one boot line per top-5 country, plain text `CODE — count` (e.g. `BR — 42`) — no flag icons; the site's pixel-art flags exist only for its 2 UI languages and don't generalise to arbitrary countries.
- Inserted after the existing "Reached target Graphical Interface." line and before the colour swatches, continuing the same `$i` stagger counter.

## Files touched

- new: `scripts/fetch-visitor-stats.py`, `data/visitor_countries.json` (committed empty placeholder)
- edited: `.github/workflows/hugo.yaml` (schedule trigger, new step), `layouts/partials/boot.html`, `i18n/en.toml`, `i18n/pt.toml`, `scripts/check-site.sh`

## Testing

- `scripts/check-site.sh` gains checks: the script exists and is executable, the data file exists and is valid JSON, `boot.html` reads `site.Data.visitor_countries`, both i18n files have `boot_visitors`, the workflow has a `schedule:` trigger and the new step. The suite already builds against the committed empty-placeholder data file, which doubles as the empty-state test — no separate fixture needed.
- Manually run `python3 scripts/fetch-visitor-stats.py` once real credentials exist, confirm `data/visitor_countries.json` gets real numbers and `hugo serve` renders the new lines on `/` and `/pt/`, staggering in with the rest of the boot log.
- Confirm a deliberately broken token leaves the previous `data/visitor_countries.json` untouched and does not fail the build.
