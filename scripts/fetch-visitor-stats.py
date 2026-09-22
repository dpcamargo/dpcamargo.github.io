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
