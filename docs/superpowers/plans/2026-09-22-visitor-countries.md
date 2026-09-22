# Boot Page Visitor Countries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a visitor-country summary and top-5 ranked list on the boot page (`/` and `/pt/`), sourced from GoatCounter and baked into the site at build time — no live browser network call.

**Architecture:** A standalone Python script fetches country stats from GoatCounter's API and writes `data/visitor_countries.json`; GitHub Actions runs it (on push and on a daily schedule) before `hugo build`; `layouts/partials/boot.html` reads `site.Data.visitor_countries` and renders each country as an ordinary boot line, reusing the existing `boot_line.html` partial with no new CSS.

**Tech Stack:** Python 3, standard library only (`urllib.request`, `json`, `os`, `sys`, `datetime`, `tempfile`); Hugo 0.166 `site.Data`; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-22-visitor-countries-design.md`

## Global Constraints

- GoatCounter API base: `https://{CODE}.goatcounter.com/api/v0`. Auth: header `Authorization: Bearer <token>` plus `Content-Type: application/json`.
- Endpoint: `GET /api/v0/stats/locations?start=2020-01-01T00:00:00Z&limit=100`. Response: `{"more": bool, "stats": [{"id": "US", "name": "United States", "count": 42, ...}, ...]}`.
- Credentials come from the environment: `GOATCOUNTER_SITE_CODE` (not secret) and `GOATCOUNTER_API_TOKEN` (secret). Both are already set in the repo's GitHub Actions settings (variable and secret respectively) — nothing to create there.
- `data/visitor_countries.json` shape: `{"generated": "<ISO8601 UTC>"|null, "total_countries": <int>, "top": [{"code": "BR", "name": "Brazil", "count": 42}, ...]}` (`top` capped at 5, sorted by `count` descending).
- The script must never fail the build and must never destroy good data: any missing env var, network error, non-200 response, or malformed response prints one line to stderr and exits 0, leaving the existing `data/visitor_countries.json` byte-for-byte untouched. Writes are atomic (write to a temp file, then `os.replace`).
- The committed `data/visitor_countries.json` starts as the empty placeholder `{"generated": null, "total_countries": 0, "top": []}`, so `hugo serve` works with no credentials and the boot page renders nothing extra until real data exists.
- Display reuses `layouts/partials/boot_line.html` for every country row (no new CSS, no flag icons) — plain text `CODE — count` (e.g. `BR — 42`), inserted after the existing "Reached target Graphical Interface." line and before the colour swatches, continuing the same `$i` stagger counter.
- i18n key `boot_visitors`, one `%d`-style placeholder for the country count, in both `i18n/en.toml` and `i18n/pt.toml`.
- Commit messages end with the line `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- `scripts/check-site.sh` must pass in the ordinary shell (locale `pt_BR.UTF-8`) and the build must print no `WARN`/`ERROR`. `hugo serve` may already be running at http://localhost:1313/; restart it (kill the `hugo serve` process, start `hugo serve --disableFastRender` in the background) if a new file doesn't show up.

## File Structure

| File | Responsibility |
|------|----------------|
| `scripts/fetch-visitor-stats.py` | Fetches country stats from GoatCounter, writes `data/visitor_countries.json` |
| `data/visitor_countries.json` | The data the boot page reads; committed as an empty placeholder |
| `.github/workflows/hugo.yaml` | Gains a `schedule:` trigger and a step running the fetch script before the Hugo build |
| `layouts/partials/boot.html` | Renders the summary line and top-5 list |
| `i18n/en.toml`, `i18n/pt.toml` | The `boot_visitors` string |
| `scripts/check-site.sh` | New `visitors` check group |

---

### Task 1: Fetch script, data contract, and its failure modes

**Files:**
- Create: `scripts/fetch-visitor-stats.py`, `data/visitor_countries.json`
- Modify: `scripts/check-site.sh`

**Interfaces:**
- Produces: `data/visitor_countries.json` with the exact shape in Global Constraints; the `check-site.sh` group `visitors` (Task 2 appends more checks to this same group, so name it exactly `group_visitors`).

- [ ] **Step 1: Write the script**

```bash
mkdir -p data
```

Write `scripts/fetch-visitor-stats.py`:

```python
#!/usr/bin/env python3
"""Fetch per-country visit counts from GoatCounter and write data/visitor_countries.json.

Reads GOATCOUNTER_SITE_CODE and GOATCOUNTER_API_TOKEN from the environment. Never fails the
build: any missing credential, network error, or bad response prints one line to stderr and
exits 0, leaving the existing data file untouched. Run from the repo root:

    python3 scripts/fetch-visitor-stats.py
"""
import datetime
import json
import os
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

DATA_FILE = "data/visitor_countries.json"
START = "2020-01-01T00:00:00Z"  # well before tracking could plausibly begin; costs nothing
LIMIT = 100
TOP_N = 5
TIMEOUT_S = 15


def fetch(site_code, token):
    query = urllib.parse.urlencode({"start": START, "limit": LIMIT})
    url = f"https://{site_code}.goatcounter.com/api/v0/stats/locations?{query}"
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
        return json.loads(response.read().decode("utf-8"))


def build_payload(api_response):
    stats = api_response.get("stats", [])
    stats = sorted(stats, key=lambda row: row.get("count", 0), reverse=True)
    if api_response.get("more") and len(stats) >= LIMIT:
        print(f"fetch-visitor-stats: more than {LIMIT} countries; total_countries will undercount", file=sys.stderr)
    top = [
        {"code": row["id"], "name": row["name"], "count": row["count"]}
        for row in stats[:TOP_N]
    ]
    return {
        "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_countries": len(stats),
        "top": top,
    }


def write_atomically(path, payload):
    directory = os.path.dirname(path) or "."
    fd, tmp_path = tempfile.mkstemp(dir=directory, prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
            f.write("\n")
        os.replace(tmp_path, path)
    except BaseException:
        os.unlink(tmp_path)
        raise


def main():
    site_code = os.environ.get("GOATCOUNTER_SITE_CODE")
    token = os.environ.get("GOATCOUNTER_API_TOKEN")
    if not site_code or not token:
        print("fetch-visitor-stats: GOATCOUNTER_SITE_CODE or GOATCOUNTER_API_TOKEN not set, skipping", file=sys.stderr)
        return 0
    try:
        api_response = fetch(site_code, token)
        payload = build_payload(api_response)
        write_atomically(DATA_FILE, payload)
    except Exception as e:
        print(f"fetch-visitor-stats: {type(e).__name__}: {e}", file=sys.stderr)
        return 0
    print(f"fetch-visitor-stats: wrote {DATA_FILE} ({payload['total_countries']} countries)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Make it executable, commit the empty placeholder data file**

```bash
chmod +x scripts/fetch-visitor-stats.py
cat > data/visitor_countries.json <<'EOF'
{
  "generated": null,
  "total_countries": 0,
  "top": []
}
EOF
```

- [ ] **Step 3: Verify the no-credentials path (deterministic, no network)**

Run: `unset GOATCOUNTER_SITE_CODE GOATCOUNTER_API_TOKEN; python3 scripts/fetch-visitor-stats.py; echo "exit=$?"`
Expected: one line on stderr (`fetch-visitor-stats: GOATCOUNTER_SITE_CODE or GOATCOUNTER_API_TOKEN not set, skipping`), `exit=0`.

Run: `git diff --stat data/visitor_countries.json`
Expected: empty output (the placeholder file is untouched).

- [ ] **Step 4: Verify the bad-credentials path (network required, no valid token needed)**

Run: `GOATCOUNTER_SITE_CODE=dario GOATCOUNTER_API_TOKEN=not-a-real-token python3 scripts/fetch-visitor-stats.py; echo "exit=$?"`
Expected: one line on stderr naming an `HTTPError` (401 or 403), `exit=0`.

Run: `git diff --stat data/visitor_countries.json`
Expected: empty output (still untouched — a bad token must not wipe the file).

- [ ] **Step 5: If you have the real token available in your shell, verify the success path**

This step is optional (the real secrets live only in GitHub Actions) — run it only if you exported real values yourself.

Run: `python3 scripts/fetch-visitor-stats.py && cat data/visitor_countries.json`
Expected: exit 0, a line like `fetch-visitor-stats: wrote data/visitor_countries.json (N countries)`, and the file now has a non-null `generated` timestamp, a real `total_countries`, and up to 5 entries in `top`, each with `code`, `name`, `count`.

If you ran this step, restore the placeholder before committing: `git checkout -- data/visitor_countries.json`.

- [ ] **Step 6: Add the check-site.sh group**

Add this function to `scripts/check-site.sh`, before the `ALL=` line:

```bash
group_visitors() {
    echo "visitors"
    expect "fetch-visitor-stats.py exists and is executable" test -x scripts/fetch-visitor-stats.py
    expect "the committed data file is valid JSON with the right keys" python3 -c "
import json
d = json.load(open('data/visitor_countries.json'))
assert set(d.keys()) == {'generated', 'total_countries', 'top'}, d.keys()
assert isinstance(d['top'], list) and len(d['top']) <= 5, d['top']
"
    expect "the no-credentials path leaves the data file untouched and exits 0" bash -c '
        before=$(cat data/visitor_countries.json)
        env -u GOATCOUNTER_SITE_CODE -u GOATCOUNTER_API_TOKEN python3 scripts/fetch-visitor-stats.py >/dev/null 2>&1
        rc=$?
        after=$(cat data/visitor_countries.json)
        [ "$rc" -eq 0 ] && [ "$before" = "$after" ]
    '
}

```

Change `ALL="layout type palette window picker background typewriter notfound i18n translations minimize jsonld favicon"` to append `visitors` at the end.

Update the `# Groups: ...` comment line the same way.

- [ ] **Step 7: Run it**

Run: `scripts/check-site.sh visitors`
Expected: every line `ok`, exit 0.

Run: `scripts/check-site.sh`
Expected: every line `ok`, exit 0, no `WARN`/`ERROR` in the build log.

- [ ] **Step 8: Commit**

```bash
git add scripts/fetch-visitor-stats.py data/visitor_countries.json scripts/check-site.sh
git commit -m "$(cat <<'EOF'
add the GoatCounter country-stats fetch script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Boot page display, GitHub Actions wiring, and a real-data dry run

**Files:**
- Modify: `layouts/partials/boot.html`, `i18n/en.toml`, `i18n/pt.toml`, `.github/workflows/hugo.yaml`, `scripts/check-site.sh`

**Interfaces:**
- Consumes: `data/visitor_countries.json` (Task 1), `group_visitors` in `scripts/check-site.sh` (Task 1; this task appends more `expect` lines to the same function).

- [ ] **Step 1: Add the checks; see them fail**

Append these lines inside `group_visitors` (after the existing three `expect` lines, before the closing `}`):

```bash
    expect "boot.html reads the visitor-countries data" grep -q "site.Data.visitor_countries" layouts/partials/boot.html
    expect "the boot_visitors key exists in both languages" sh -c 'grep -q "\[boot_visitors\]" i18n/en.toml && grep -q "\[boot_visitors\]" i18n/pt.toml'
    expect "the workflow has a schedule trigger" grep -q "schedule:" .github/workflows/hugo.yaml
    expect "the workflow fetches visitor stats before building" grep -q "fetch-visitor-stats.py" .github/workflows/hugo.yaml
```

Run: `scripts/check-site.sh visitors`
Expected: the three existing lines from Task 1 stay `ok`; the four new lines `FAIL`.

- [ ] **Step 2: Add the i18n key**

In `i18n/en.toml`, append:

```toml

[boot_visitors]
other = "Received visitors from %d countries."
```

In `i18n/pt.toml`, append:

```toml

[boot_visitors]
other = "Recebeu visitas de %d países."
```

- [ ] **Step 3: Render it in the boot log**

In `layouts/partials/boot.html`, the file currently reads (near the end):

```html
    {{ partial "boot_line.html" (dict "text" (i18n "boot_target_gui") "i" $i) }}
    {{ $i = add $i 1 }}
    <div class="boot__swatches" style="--i: {{ $i }}" aria-hidden="true">
```

Replace it with:

```html
    {{ partial "boot_line.html" (dict "text" (i18n "boot_target_gui") "i" $i) }}
    {{ $i = add $i 1 }}
    {{ with site.Data.visitor_countries }}
    {{ if gt (len .top) 0 }}
    {{ partial "boot_line.html" (dict "text" (printf (i18n "boot_visitors") .total_countries) "i" $i) }}
    {{ $i = add $i 1 }}
    {{ range .top }}
    {{ partial "boot_line.html" (dict "text" (printf "%s — %d" .code .count) "i" $i) }}
    {{ $i = add $i 1 }}
    {{ end }}
    {{ end }}
    {{ end }}
    <div class="boot__swatches" style="--i: {{ $i }}" aria-hidden="true">
```

(Only the two lines around the `<div class="boot__swatches" ...>` line are unchanged context; everything between them is new.)

- [ ] **Step 4: Wire GitHub Actions**

In `.github/workflows/hugo.yaml`, the `on:` block currently reads:

```yaml
on:
  # Runs on pushes targeting the default branch
  push:
    branches:
      - main

  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:
```

Replace it with:

```yaml
on:
  # Runs on pushes targeting the default branch
  push:
    branches:
      - main

  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:

  # Refreshes the boot page's visitor-country numbers even without a code change
  schedule:
    - cron: "0 6 * * *"
```

The `steps:` list currently reads:

```yaml
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive
          fetch-depth: 0
      - name: Setup Pages
        id: pages
        uses: actions/configure-pages@v5
```

Replace it with:

```yaml
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive
          fetch-depth: 0
      - name: Fetch visitor country stats
        env:
          GOATCOUNTER_SITE_CODE: ${{ vars.GOATCOUNTER_SITE_CODE }}
          GOATCOUNTER_API_TOKEN: ${{ secrets.GOATCOUNTER_API_TOKEN }}
        run: python3 scripts/fetch-visitor-stats.py
      - name: Setup Pages
        id: pages
        uses: actions/configure-pages@v5
```

(Only the `Checkout` and `Setup Pages` steps are unchanged context; the new step goes between them.)

- [ ] **Step 5: Run it green**

Run: `scripts/check-site.sh visitors`
Expected: every line `ok`, exit 0.

Run: `scripts/check-site.sh`
Expected: every line `ok`, exit 0, no `WARN`/`ERROR`.

- [ ] **Step 6: Dry run with fabricated data, on both languages and palettes**

The committed data file is still the empty placeholder, so the template renders nothing extra yet. Prove the non-empty path works before shipping it:

```bash
cp data/visitor_countries.json /tmp/visitor_countries.placeholder.json
cat > data/visitor_countries.json <<'EOF'
{
  "generated": "2026-09-22T06:00:00Z",
  "total_countries": 14,
  "top": [
    {"code": "BR", "name": "Brazil", "count": 42},
    {"code": "US", "name": "United States", "count": 18},
    {"code": "PT", "name": "Portugal", "count": 9},
    {"code": "DE", "name": "Germany", "count": 4},
    {"code": "IN", "name": "India", "count": 3}
  ]
}
EOF
```

If `hugo serve` is running, it picks this up on its own; otherwise start it (`hugo serve --disableFastRender &`). Use the Playwright MCP tools (load them first with ToolSearch if deferred, e.g. `select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_evaluate,mcp__plugin_playwright_playwright__browser_take_screenshot`) to check `http://localhost:1313/` and `http://localhost:1313/pt/`, in both the `dark` and `light` palettes (set `document.documentElement.dataset.palette` before reloading, or `localStorage.setItem('palette', ...)` before navigating): the boot log shows "Received visitors from 14 countries." / "Recebeu visitas de 14 países." followed by five lines `BR — 42`, `US — 18`, `PT — 9`, `DE — 4`, `IN — 3`, staggering in with the rest of the boot log, each with the same `[ OK ]` tag as every other boot line. Take a screenshot of each of the 4 combinations and look at it.

Then restore the placeholder:

```bash
mv /tmp/visitor_countries.placeholder.json data/visitor_countries.json
git diff --stat data/visitor_countries.json
```

Expected: no diff (back to the committed empty placeholder).

- [ ] **Step 7: Confirm the empty state is silent**

With the placeholder restored, reload `http://localhost:1313/`. Expected: the boot log ends at "Reached target Graphical Interface." followed directly by the colour swatches — no blank line, no "0 countries" line, nothing extra.

- [ ] **Step 8: Commit**

```bash
git add layouts/partials/boot.html i18n/en.toml i18n/pt.toml .github/workflows/hugo.yaml scripts/check-site.sh
git commit -m "$(cat <<'EOF'
show visitor countries on the boot page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Final verification

No new code unless a check fails; fix real failures with the smallest change and commit each as `fix: ...` (with the trailer).

- [ ] **Step 1: Build and check**

Run: `scripts/check-site.sh` (ordinary shell): all `ok`, exit 0.
Run: `hugo --gc --minify --printI18nWarnings --destination "$(mktemp -d)"`: no `WARN`/`ERROR`.
Run: `git status --short`: clean (the placeholder data file must still read `{"generated": null, "total_countries": 0, "top": []}`).

- [ ] **Step 2: Confirm the workflow file is valid**

Run: `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/hugo.yaml'))" 2>&1 || echo "no pyyaml available, eyeball the diff instead"`
If `pyyaml` isn't available, read `.github/workflows/hugo.yaml` once more and confirm indentation matches the rest of the file (2 spaces, consistent with the existing steps) and that `schedule:` sits at the same level as `push:` and `workflow_dispatch:` under `on:`.

- [ ] **Step 3: Report**

Note in your report: the fetch script and its tests are fully verified locally; the workflow's `schedule:` trigger and its new step cannot be verified end-to-end from this session (GitHub Actions only runs there), so the first real confirmation is the next scheduled run or the next push after merge. Tell the site owner to check the Actions tab after the next run and confirm `data/visitor_countries.json` gets real numbers in the deployed site's build artifact (the repo's committed copy stays the placeholder by design — only the CI build's working copy gets live data).
