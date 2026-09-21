#!/usr/bin/env python3
"""Check that every English content page has an in-sync Portuguese sibling.

    python3 scripts/check-translations.py                  every English page must have a .pt.md sibling
    python3 scripts/check-translations.py --allow-missing  only compare the pairs that exist (work in progress)

For each pair, `date`, `tags` and `math` must match and the fenced code blocks must be byte-identical
(code is not translated, comments included). Standard library only.
"""
import re
import sys
import tomllib
from pathlib import Path

CONTENT = Path("content")
SAME = ("date", "tags", "math")
FENCE = re.compile(r"^```.*?^```", re.S | re.M)
allow_missing = "--allow-missing" in sys.argv[1:]
errors = []


def parts(path):
    """Return (front matter dict, body) of a page with +++ TOML front matter."""
    text = path.read_text(encoding="utf-8")
    if not text.startswith("+++"):
        errors.append(f"{path}: no +++ TOML front matter")
        return {}, text
    end = text.index("+++", 3)
    return tomllib.loads(text[3:end]), text[end + 3:]


for english in sorted(CONTENT.rglob("*.md")):
    if english.name.endswith(".pt.md"):
        continue
    portuguese = english.with_name(english.name[: -len(".md")] + ".pt.md")
    if not portuguese.exists():
        if not allow_missing:
            errors.append(f"{english}: missing {portuguese.name}")
        continue
    en_front, en_body = parts(english)
    pt_front, pt_body = parts(portuguese)
    if "title" not in pt_front:
        errors.append(f"{portuguese}: no title")
    for key in SAME:
        if en_front.get(key) != pt_front.get(key):
            errors.append(f"{portuguese}: {key} is {pt_front.get(key)!r}, the English page has {en_front.get(key)!r}")
    if FENCE.findall(en_body) != FENCE.findall(pt_body):
        errors.append(f"{portuguese}: fenced code blocks differ from {english.name}")

for portuguese in sorted(CONTENT.rglob("*.pt.md")):
    if not portuguese.with_name(portuguese.name[: -len(".pt.md")] + ".md").exists():
        errors.append(f"{portuguese}: no English original")

if errors:
    print("\n".join(errors))
    sys.exit(1)
print("translations in sync")
