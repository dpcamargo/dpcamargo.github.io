# Terminal prompt

Turns the main content window into a terminal session: a prompt at the bottom of the window accepts shell-style commands, navigation appends pages to a scrollback instead of replacing them, and a handful of easter eggs give visitors something to remember and share.

## Goals

- **Memorable first.** The primary job is fun and shareability for recruiters and developers clicking around for 30 seconds; navigation by keyboard is a welcome side effect, not the goal.
- Feels like one continuous terminal session: old pages scroll up as new ones arrive.
- Costs nothing for visitors who never type (no framework, data fetched lazily).
- Works in both languages, on mobile, with a screen reader, with reduced motion, and degrades to today's site with JavaScript off.
- Search engines keep seeing ordinary, separate pages.

Non-goals (v1): `matrix`, `ping`, `echo`, pipes, quoting, a `projects` page (the menu is built so it can be added later without touching the terminal), persisting scrollback across reloads.

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| Main job of the prompt | Memorable/fun (not primarily navigation) |
| How far effects go | Mostly text; a few page-level effects (`rm -rf /`, `theme`, `lang`) |
| Where the prompt lives | Main content window, on every page (not the header) |
| Where output goes | Appended to a scrollback in the main window; the prompt stays pinned at the window bottom |
| Clicks on internal links | Append to the session like `cd`; external links, the language switch and downloads navigate normally |
| Boot log | Plays only on a fresh load of `/`, then auto-types `whoami` |
| Home page content | The about/whoami bio moves into the home page; `/about/` becomes an alias redirecting to `/` |
| Menu | `./whoami` (→ `/`) and `./til`; `./boot` removed; `./projects` later |
| Implementation | Vanilla JS + a Hugo-generated JSON index (not xterm.js / jQuery Terminal, not pre-rendered hidden HTML) |

## Design

### 1. Page structure

- **Home `/`** (and `/pt/`): boot log → the line `guest@dario:~$ whoami` → the bio → the prompt. The boot and the auto-typed `whoami` animate only on a fresh load of `/`; within a session `cd ~` shows the whoami block without the boot. With `prefers-reduced-motion: reduce` everything appears at once.
- **The bio moves into the home page.** The body of `content/about/index.md` (and `.pt.md`) becomes the body of `content/_index.md` (and `.pt.md`); the about files are deleted and the home front matter gets `aliases = ["/about/"]` (pt: `["/pt/about/"]`) so old links and search results redirect. The home page's title becomes `whoami`, so the window title reads `~/whoami` and the header branch `git:(whoami)`. The browser tab title keeps the home special case: `Dario Camargo – Software Engineer`.
- **Menu:** `hugo.toml` `[menu.main]` becomes `whoami` → `/`, `til` → `/til/`. The `home`/`boot` entry is removed.
- **Other pages** (`/til/`, posts, tag pages): unchanged, plus the prompt at the bottom of the main window.
- **Main window = scrollback.** Inside `.win__scroll`, content is a sequence of blocks. The first block is the server-rendered page. Each command appends one block: the echoed prompt line (`guest@dario:~/til$ cat go-errgroup`) followed by the output, which is either text or another page's `.page__main` content (plus its `title.html` header).
- **Prompt:** a real `<input>` pinned to the bottom of the main window (desktop: sticky inside the window; mobile ≤768px: fixed to the bottom of the visual viewport). Its visible label is the current prompt string, e.g. `guest@dario:~/til$`. It stays visible while the user scrolls up through old blocks.
- **Navigation** (`cd`, `cat`, menu clicks, internal links): `fetch` the target URL, parse it with `DOMParser`, take its `.page__main` and page header, append them as a block, scroll to the new block, then `history.pushState` and update: `document.title`, the window title (`~/til`), the header branch (`git:(til)`), the active menu item, and the `hreflang` targets of the language picker. `popstate` restores those same details and scrolls to the matching block if it is still in the scrollback, otherwise does a full page load.
- **Fetched home page:** when `/` is appended through navigation, its `.boot` section is dropped, so only the `whoami` line and the bio appear. The boot log exists only in the first block of a fresh load (and in the `rm -rf /` replay, which re-uses the `.boot` markup from the page if present, else fetches `/`).
- **Cap:** at most 20 blocks; the oldest is removed when a 21st is added.
- **Unchanged:** sidebar windows, header layout, palette and language buttons, and every URL as a real server-rendered page for crawlers and no-JS visitors.

### 2. Data and the command engine

**`/terminal.json`** (and `/pt/terminal.json`): a new Hugo output format on the home page, rendered by `layouts/index.terminal.json` (or equivalent), containing:

- `pages`: from the main menu, e.g. `[{"name": "whoami", "url": "/"}, {"name": "til", "url": "/til/"}]`. Adding a `projects` menu entry makes it appear in `ls`/`cd` automatically.
- `posts`: TIL posts in the current language, `[{"slug", "title", "url", "date", "tags"}]`.
- `strings`: all terminal text from `i18n/*.toml` under `term_*` keys (help lines, error messages, jokes, neofetch labels). `check-translations.py` keeps en/pt in sync as it does today.
- `neofetch`: stack, location, and the visitor-country count from `data/visitor_countries.json`. (No uptime: `params.boot.since` is not set in `hugo.toml`, so the boot page's uptime line is not rendered either; if `since` is added later, neofetch shows it too.)

`terminal.js` fetches it on the first focus of the prompt and caches it for the page's lifetime.

**Engine:** `assets/js/terminal.js`, minified and fingerprinted in `head.html` like `theme.js`. A single command table maps a name to `{ run(args, term), complete?(args) }`. `term` exposes `print(textOrNode)`, `navigate(url)`, `clear()`, `effect(name)` and `data`.

- Input is split on whitespace; no quoting or pipes. Command names are case-insensitive.
- ↑/↓ walk command history, stored in `sessionStorage` (wrapped in try/catch; works without it).
- Tab completes command names, page names and post slugs; on mobile, tapping a slug in `ls` output fills it into the prompt.

**Commands (v1):**

| Command | Behaviour |
|---|---|
| `help` | Lists commands with one-line descriptions |
| `ls` | In `~`: pages. In `~/til`: post slugs. `ls -l`: slugs with title and date |
| `cd <x>` | `~`, `/`, `..`, a page name, a path, or a slug when in `~/til`. `cd ..` from a post → `~/til`; from `~/til` → `~` |
| `cat <slug>` | Opens a TIL post |
| `clear` | Empties the scrollback, keeps the current page's URL |
| `exit` | Prints `logout`, then `clear`s back to the current page's content block |
| `whoami` | Short bio text |
| `neofetch` | ASCII portrait (aria-hidden) beside stack, location, visitor countries |
| `contact` | LinkedIn and GitHub links |
| `sudo <anything>` | `guest is not in the sudoers file. This incident will be reported.` |
| `vim`, `vi`, `nano` | `you are now trapped. type :q to exit`; `:q` prints nothing and returns |
| `theme light\|dark` | Clicks the matching palette option |
| `lang en\|pt` | Follows the language picker's link for that language (full navigation) |
| `rm -rf /`, `sudo rm -rf /`, `rm -rf ~` | Page-level effect, see section 3 |
| `rm <anything else>` | `rm: cannot remove '<x>': Permission denied` |
| anything else | `zsh: command not found: <cmd>` |

### 3. `rm -rf /` and error handling

**`rm -rf /`**, about 4 seconds, prompt disabled throughout:

1. Prints ~8 fake removal lines quickly (`removed '/usr/bin/go'`, `removed '/home/dario/career'`, …).
2. Windows shake, colours flicker, then windows fall off the bottom one by one (CSS classes only).
3. Black screen with `Kernel panic - not syncing: attempted to kill dario`.
4. Boot log replays; the session resets to `~` (scrollback, history and command history cleared, URL `pushState`d to the home page of the current language).

With reduced motion, steps 2–3 are skipped: print the lines, then reset.

**Errors:**

- `terminal.json` fetch fails: `cd` still works using the header menu links; other data-backed commands print `terminal: offline, try reloading`.
- Page fetch for navigation returns 404: `cd: no such file or directory: <x>`. Network failure: fall back to a full page load (`location.href = url`).
- Fetched HTML has no `.page__main`: full page load.
- Exception inside a command: print `segfault (core dumped)`, `console.error` the error, keep the prompt working.
- No JavaScript: no prompt is rendered (it is created by the script); the site works as today, and `/` still shows the boot log and the bio.

### 4. Accessibility, mobile, discoverability, testing

**Discoverability:** placeholder `type help` in the prompt; blinking cursor when empty; after the boot on first load, the prompt is focused on desktop only (not on touch devices, to avoid opening the keyboard).

**Accessibility:**

- The input has a visually hidden label ("terminal: type a command, help for the list"), localized.
- The scrollback container is `aria-live="polite"`, so new blocks are announced.
- Esc blurs the prompt. Tab is only captured for completion when the input is non-empty; otherwise focus moves on normally.
- Output is real text; decorative ASCII is `aria-hidden`.
- On navigation, focus stays in the prompt and the new page title is announced.

**Mobile (≤768px):**

- Prompt fixed to the bottom of the visual viewport, above browser toolbars (relies on the `100dvh` page height).
- Input `font-size: 16px` (prevents iOS zoom), `autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`, `enterkeyhint="send"`.
- Blocks never exceed the screen width; long lines wrap (same approach as the boot-log fix).

**Testing:**

- `scripts/check-site.sh` gains a `terminal` group: `terminal.json` exists for both languages and parses; every `term_*` key exists in both languages; `/about/` redirects to `/` (alias page present); the menu is exactly `whoami` + `til`; `head.html` includes `terminal.js`.
- Playwright against the built site at 1280px and 390px:
  - Fresh `/`: boot plays, then `whoami`, then the prompt appears.
  - `ls`, `cd til`, `cat go-errgroup`, `cd ..`: URL, document title, window title, branch and blocks update.
  - Back/Forward restore state.
  - Tab completion of a slug.
  - Unknown command prints `command not found`; `sudo x` prints the sudoers line.
  - `rm -rf /` resets the session.
  - `theme light` and `lang pt` work.
  - JavaScript disabled: site works, no prompt.
  - Reduced motion: no animation.
  - No horizontal overflow (`scrollWidth === clientWidth`), no console errors.
