# dario.dev.br

Personal site and blog. A retro terminal/desktop UI (boot log, title-bar windows, a palette picker, a
typewriter effect) built as a static Hugo site, bilingual in English and Brazilian Portuguese.

**Live:** https://dario.dev.br/

## Stack

- [Hugo](https://gohugo.io/) 0.166 extended — no external theme; every layout and asset lives in this repo
- Plain CSS and JS, no bundler beyond Hugo's own asset pipeline (`resources.Concat`, minify, fingerprint)
- Python 3, standard library only, for the verification scripts

## Features

- Boot-log home page and title-bar "windows" (`.win`) for the content area and the sidebar
- A palette picker (dark / light) and a language picker (English / Português), both in the header
- A typewriter effect that types the content window in on every page load
- Bilingual content: every page has an English version at `/` and a Portuguese one at `/pt/`
- Minimize and close buttons on the sidebar windows (not persisted — a reload brings them back)
- A shell-styled 404 page that serves both languages from the one file GitHub Pages returns

## Develop

```sh
hugo serve
```

Serves the site at http://localhost:1313/ with live reload.

## Verify

```sh
scripts/check-site.sh                    # the full structural check suite
scripts/check-site.sh i18n picker         # just the named groups
python3 scripts/check-translations.py     # English/Portuguese content pairs stay in sync
```

`scripts/check-site.sh` builds the site and asserts on the output — spacing, palettes, the language and
palette pickers, i18n coverage, and more. Run it before committing a template or CSS change.

## Content

```
content/
├── _index.md          home (boot log)
├── about/index.md      whoami
└── til/                 today-I-learned posts
```

Every English page has a `*.pt.md` sibling (for example `content/about/index.pt.md`). Front matter other
than `title` is copied across; `scripts/check-translations.py` fails the build if a page is missing its
translation or the two drift out of sync.

## Deploy

Pushing to `main` triggers `.github/workflows/hugo.yaml`, which builds the site with Hugo and publishes it
to GitHub Pages under the custom domain in `CNAME`.
