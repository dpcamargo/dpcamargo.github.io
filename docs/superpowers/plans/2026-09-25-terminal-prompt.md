# Terminal Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the main content window into a terminal session: a prompt pinned to the bottom of the window runs shell-style commands, navigation appends pages to a scrollback instead of replacing them, and the home page becomes boot log → `whoami` → bio.

**Architecture:** Hugo renders every page as today, plus a hidden `<form class="term__prompt">` in the content window and a per-language `/terminal.json` index. `assets/js/terminal-core.js` is pure logic (parse, paths, completion, what each command does → a list of actions) and is unit-tested with `node --test`. `assets/js/terminal.js` owns the DOM: wraps the page into the first scrollback block after the existing typewriter finishes, runs commands, fetches pages for in-place navigation, and performs the effects.

**Tech Stack:** Hugo 0.166 extended, plain ES5-style JS (`var`, `function`, like the other files in `assets/js/`), plain CSS, bash + Python 3 standard library for `scripts/check-site.sh`, Node's built-in `node:test` for unit tests (no npm packages), Playwright MCP tools for browser checks.

**Spec:** `docs/superpowers/specs/2026-09-25-terminal-prompt-design.md`

## Global Constraints

- No dependencies: no npm packages, no CDN scripts, no frameworks. Node is used only to run `node --test`.
- JS style matches `assets/js/*.js`: an IIFE, `var`, `function`, 4-space indent, a short comment on top saying what the file does.
- Every user-visible string exists in both `i18n/en.toml` and `i18n/pt.toml` (the `i18n` group of `check-site.sh` diffs the key lists; `hugo --printI18nWarnings` turns a missing key into a WARN, which fails the `build` check). Terminal strings use the `term_` prefix.
- Command output is always inserted with `textContent` / `createTextNode`, never `innerHTML` (the only `innerHTML` assignment copies the language picker's server-rendered markup from a same-origin page).
- The site must work exactly as today with JavaScript off: the prompt form ships with `hidden` and only `terminal.js` shows it.
- `prefers-reduced-motion: reduce` → no animation anywhere in this feature.
- Prompt string format: `guest@dario:<cwd>$`, cwd `~`, `~/til`, `~/til/<slug>`, `~/tags/<tag>`.
- Scrollback cap: 20 blocks. Command history cap: 50 entries, `sessionStorage` key `term-history`.
- `scripts/check-site.sh` must exit 0 at the end of every task. Run it as `bash scripts/check-site.sh`.
- Commit after every task, lowercase imperative subject in the style of `git log` (e.g. `move the whoami bio onto the home page`), ending with the session's co-author trailer. Do not push.

## Review Focus

1. **HTML in commands** — typing `<img src=x onerror=alert(1)>` must print it literally (`zsh: command not found: <img…`) and create no element. Test: Task 7, Playwright step "XSS".
2. **Pages that need their own scripts** — `cat using-katex` fetches a page whose `.page__main` includes KaTeX `<script>` tags that would never run when appended. Expected: a normal full page load with rendered math. Test: Task 5, Playwright step "KaTeX".
3. **Links the terminal must not hijack** — Ctrl/Cmd/Shift/middle-click, `target="_blank"`, in-page `#anchor` links, the language picker and file links must behave like normal links. Test: Task 5, Playwright step "links left alone".
4. **Typing before `/terminal.json` has arrived** — a fast visitor submitting `help` right after load must get the help text, not the offline message. `run()` always waits for `loadData()`. Test: Task 4, Playwright step "early submit".
5. **Storage that throws** — private windows and blocked site data make `sessionStorage` throw; history must silently work in memory. Test: Task 3, unit tests `loadHistory`/`saveHistory` with a throwing storage.

---

### Task 1: Move the whoami bio onto the home page

**Files:**
- Modify: `content/_index.md`, `content/_index.pt.md`
- Delete: `content/about/index.md`, `content/about/index.pt.md`
- Modify: `layouts/index.html`, `layouts/_default/baseof.html:19`, `hugo.toml` (`[menu]`)
- Modify: `scripts/check-site.sh` (window group loop, translations group, new `home` group)

**Interfaces:**
- Consumes: nothing.
- Produces: home page markup `boot log → <p class="term__echo"><span class="term__ps">guest@dario:~$</span> whoami</p> → header with <h1>whoami</h1> → .content__body bio`. Menu `[whoami → /, TIL → /til/]`. `/about/` and `/pt/about/` are alias redirects. Task 5 relies on the class `.boot` wrapping the boot log (unchanged, from `layouts/partials/boot.html`).

- [ ] **Step 1: Write the failing checks**

In `scripts/check-site.sh`:

1. In `group_window`, change the page loop to drop `about/index.html`:

```bash
    for page in index.html til/index.html til/go-errgroup/index.html 404.html; do
```

2. In `group_translations`, replace the line `expect "pt TIL list and about pages exist" …` with:

```bash
    expect "pt TIL list exists" test -s "$OUT/pt/til/index.html"
```

3. Add this group above `group_jsonld`:

```bash
group_home() {
    echo "home"
    expect "the menu is whoami then TIL" python3 -c "
import tomllib
menu = tomllib.load(open('hugo.toml', 'rb'))['menu']['main']
names = [m['name'] for m in sorted(menu, key=lambda m: m['weight'])]
assert names == ['whoami', 'TIL'], names
assert [m['url'] for m in sorted(menu, key=lambda m: m['weight'])] == ['/', '/til/']
"
    forbid "no boot link in the built menu" grep -q '>boot</a>' "$OUT/index.html"
    expect "the English home carries the bio" grep -q "distributed backend systems: REST microservices" "$OUT/index.html"
    expect "the Portuguese home carries the bio" grep -q "microsserviços REST" "$OUT/pt/index.html"
    expect "the home window is ~/whoami" grep -q 'class="win__title">~/whoami' "$OUT/index.html"
    expect "the home echoes whoami after the boot log" grep -q 'guest@dario:~\$</span> whoami' "$OUT/index.html"
    expect "the home has exactly one h1" python3 -c "
import re
html = open('$OUT/index.html').read()
assert len(re.findall(r'<h1[ >]', html)) == 1
"
    expect "/about/ redirects to the English home" grep -q 'url=https://dario.dev.br/"' "$OUT/about/index.html"
    expect "/pt/about/ redirects to the Portuguese home" grep -q 'url=https://dario.dev.br/pt/"' "$OUT/pt/about/index.html"
    forbid "the about content files are gone" test -e content/about
}
```

4. Add `home` to the `# Groups:` comment on line 5 and to `ALL=` near the end (after `translations`).

- [ ] **Step 2: Run the checks to verify they fail**

Run: `bash scripts/check-site.sh home`
Expected: `FAIL  the menu is whoami then TIL`, `FAIL  no boot link…`, `FAIL  the English home carries the bio`, and more FAIL lines; exit 1.

- [ ] **Step 3: Move the content**

Replace `content/_index.md` with (front matter plus the English body copied verbatim from `content/about/index.md`):

```markdown
+++
date = '2025-05-29T22:45:21-03:00'
title = 'whoami'
aliases = ['/about/']
+++

I'm a software engineer who builds distributed backend systems: REST microservices in **Go**, **Java**, and **Python**, designed for high availability and low latency. Since 2024 I've been at Mercado Livre, working on Proximity, its fast-food delivery unit. There I design APIs, apply Clean Architecture and Domain-Driven Design, and monitor production on Fury, the company's internal developer platform.

I hold a bachelor's degree in **Control and Automation Engineering** (UNIP) and postgraduate specializations in **Advanced Go Development** (<a href="https://goexpert.fullcycle.com.br/pos-goexpert/" target="_blank">**Full Cycle**</a>) and **Java Architecture and Development** (<a href="https://postech.fiap.com.br/curso/arquitetura-desenvolvimento-java" target="_blank">**FIAP**</a>). Portuguese is my native language, I'm fluent in English, and I speak intermediate Spanish.
```

Replace `content/_index.pt.md` with:

```markdown
+++
date = '2025-05-29T22:45:21-03:00'
title = 'whoami'
aliases = ['/about/']
+++

Sou engenheiro de software e construo sistemas distribuídos de backend: microsserviços REST em **Go**, **Java** e **Python**, projetados para alta disponibilidade e baixa latência. Desde 2024 estou no Mercado Livre, trabalhando no Proximity, a unidade de fast-food da empresa. Lá, projeto APIs, aplico Clean Architecture e Domain-Driven Design e monitoro a produção no Fury, a plataforma interna de desenvolvimento da empresa.

Sou formado em **Engenharia de Controle e Automação** (UNIP) e tenho especializações de pós-graduação em **Desenvolvimento Avançado em Go** (<a href="https://goexpert.fullcycle.com.br/pos-goexpert/" target="_blank">**Full Cycle**</a>) e **Arquitetura e Desenvolvimento Java** (<a href="https://postech.fiap.com.br/curso/arquitetura-desenvolvimento-java" target="_blank">**FIAP**</a>). O português é minha língua nativa, sou fluente em inglês e falo espanhol em nível intermediário.
```

Then: `git rm -r content/about`

- [ ] **Step 4: Render the home page's own heading**

Replace `layouts/index.html` with:

```html
{{ define "main" }}
    {{ partial "boot.html" . }}
    {{- /* The boot log hands over to a shell that has just run whoami; assets/js/terminal.js drops the .boot
           block when this page is appended to the scrollback later in a session */}}
    <p class="term__echo"><span class="term__ps">guest@dario:~$</span> whoami</p>
    <header class="content__header">
        <div class="header__container">
            <h1>{{ .Title }}</h1>
        </div>
    </header>
    <div class="content__body">
        {{ .Content }}
    </div>
{{ end }}
```

In `layouts/_default/baseof.html` line 19, change `{{ partial "title.html" . }}` to:

```html
                            {{ if not .IsHome }}{{ partial "title.html" . }}{{ end }}
```

- [ ] **Step 5: Update the menu**

In `hugo.toml`, replace the three `[[menu.main]]` entries with:

```toml
[menu]
  [[menu.main]]
    identifier = "whoami"
    name = "whoami"
    url = "/"
    weight = 10

  [[menu.main]]
    identifier = "til"
    name = "TIL"
    url = "/til/"
    weight = 20
```

- [ ] **Step 6: Run the checks**

Run: `bash scripts/check-site.sh`
Expected: every line `ok`, exit 0.

If `/pt/about/ redirects to the Portuguese home` fails, see where Hugo put the aliases: `hugo -d "$(mktemp -d)"` into a scratch folder, then `grep -o 'url=[^"]*'` its `about/index.html` and `pt/about/index.html`. If the Portuguese alias landed at `/about/` (overwriting the English one), change the pt front matter to `aliases = ['/pt/about/']`, rebuild and re-run the checks.

- [ ] **Step 7: Look at it**

Start `hugo serve --port 1313` in the background. With the Playwright MCP tools, open `http://localhost:1313/`: the typewriter types the boot log, then `guest@dario:~$ whoami`, the `whoami` heading and the bio. The menu reads `./whoami ./til`, `whoami` underlined as active; the header branch reads `git:(whoami)`; the window title `~/whoami`. Open `http://localhost:1313/about/`: it redirects to `/`. Repeat on `/pt/`.

- [ ] **Step 8: Commit**

```bash
git add content hugo.toml layouts/index.html layouts/_default/baseof.html scripts/check-site.sh
git commit -m "move the whoami bio onto the home page and drop the boot menu item"
```

---

### Task 2: Generate `/terminal.json` and the terminal strings

**Files:**
- Modify: `hugo.toml` (new `[outputFormats.terminal]` and `[outputs]`)
- Create: `layouts/index.terminal.json`
- Modify: `i18n/en.toml`, `i18n/pt.toml` (append `term_*` keys)
- Modify: `scripts/check-site.sh` (new `terminal` group)

**Interfaces:**
- Consumes: the menu from Task 1.
- Produces: `/terminal.json` and `/pt/terminal.json` with this exact shape, used by Tasks 3–6 as `data`:

```json
{
  "home": "/",
  "langs": ["en", "pt"],
  "pages": [{"name": "whoami", "url": "/"}, {"name": "til", "url": "/til/"}],
  "posts": [{"slug": "go-errgroup", "title": "Go: errgroup - …", "url": "/til/go-errgroup/", "date": "2025-06-03", "tags": ["go", "til"]}],
  "contact": [{"label": "LinkedIn", "url": "https://linkedin.com/in/dpcamargo"}, {"label": "GitHub", "url": "https://github.com/dpcamargo"}],
  "neofetch": {"stack": "Go, Java, Python", "location": "Brazil", "countries": 2},
  "strings": {"input_label": "…", "placeholder": "…", "offline": "…", "enoent": "…", "notfound": "zsh: command not found: %s", "help_intro": "…", "help_help": "…", "help_ls": "…", "help_cd": "…", "help_cat": "…", "help_whoami": "…", "help_neofetch": "…", "help_contact": "…", "help_theme": "…", "help_lang": "…", "help_clear": "…", "help_exit": "…", "whoami": "…", "sudo": "…", "vim": "…", "rm_denied": "rm: cannot remove '%s': Permission denied", "cat_usage": "…", "theme_usage": "…", "lang_usage": "…", "logout": "logout", "panic": "…", "nf_host": "host", "nf_stack": "stack", "nf_location": "location", "nf_visitors": "visitor countries"}
}
```

`strings` values containing `%s` get exactly one substitution.

- [ ] **Step 1: Write the failing checks**

Add this group to `scripts/check-site.sh` above `group_jsonld`, and add `terminal` to the `# Groups:` comment and to `ALL=` (after `home`):

```bash
group_terminal() {
    echo "terminal"
    for lang in en pt; do
        prefix=$([ "$lang" = pt ] && echo "pt/" || echo "")
        expect "$lang terminal.json has the expected shape" python3 -c "
import json
d = json.load(open('$OUT/${prefix}terminal.json'))
assert set(d) == {'home', 'langs', 'pages', 'posts', 'contact', 'neofetch', 'strings'}, set(d)
assert d['home'] == '/$prefix', d['home']
assert d['langs'] == ['en', 'pt'], d['langs']
assert [p['name'] for p in d['pages']] == ['whoami', 'til'], d['pages']
assert [p['url'] for p in d['pages']] == ['/$prefix', '/${prefix}til/'], d['pages']
assert len(d['posts']) >= 8, len(d['posts'])
for p in d['posts']:
    assert set(p) == {'slug', 'title', 'url', 'date', 'tags'}, p
    assert p['url'] == '/${prefix}til/' + p['slug'] + '/', p
assert all(isinstance(v, str) and v for v in d['strings'].values()), d['strings']
assert d['strings']['notfound'].count('%s') == 1 and d['strings']['rm_denied'].count('%s') == 1
assert isinstance(d['neofetch']['countries'], int)
"
    done
    expect "terminal strings exist in both languages" bash -c 'diff <(grep "^\[term_" i18n/en.toml) <(grep "^\[term_" i18n/pt.toml) && [ "$(grep -c "^\[term_" i18n/en.toml)" -eq 32 ]'
    expect "Portuguese terminal strings are Portuguese" grep -q "comando não encontrado" "$OUT/pt/terminal.json"
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `bash scripts/check-site.sh terminal`
Expected: `FAIL  en terminal.json has the expected shape` (file missing), `FAIL  pt terminal.json…`, `FAIL  terminal strings exist in both languages`; exit 1.

- [ ] **Step 3: Declare the output format**

Append to `hugo.toml`, above `[markup.goldmark.renderer]`:

```toml
# /terminal.json (and /pt/terminal.json): what the terminal prompt needs to know about the site,
# rendered by layouts/index.terminal.json and fetched by assets/js/terminal.js on first use
[outputFormats.terminal]
  mediaType = "application/json"
  baseName = "terminal"
  isPlainText = true
  notAlternative = true

[outputs]
  home = ["html", "rss", "terminal"]
```

- [ ] **Step 4: Write the template**

Create `layouts/index.terminal.json`:

```go-html-template
{{- /* Read by assets/js/terminal.js. Keys under "strings" are the i18n keys without their term_ prefix. */ -}}
{{- $langs := slice -}}
{{- range hugo.Sites }}{{ $langs = $langs | append .Language.Lang }}{{ end -}}
{{- $pages := slice -}}
{{- range site.Menus.main }}{{ $pages = $pages | append (dict "name" (lower .Name) "url" (.URL | relLangURL)) }}{{ end -}}
{{- $posts := slice -}}
{{- range where site.RegularPages "Section" "til" -}}
{{- $posts = $posts | append (dict "slug" .File.ContentBaseName "title" .Title "url" .RelPermalink "date" (.Date.Format "2006-01-02") "tags" (.Params.tags | default (slice))) -}}
{{- end -}}
{{- $keys := slice "input_label" "placeholder" "offline" "enoent" "notfound" "help_intro" "help_help" "help_ls" "help_cd" "help_cat" "help_whoami" "help_neofetch" "help_contact" "help_theme" "help_lang" "help_clear" "help_exit" "whoami" "sudo" "vim" "rm_denied" "cat_usage" "theme_usage" "lang_usage" "logout" "panic" "nf_host" "nf_stack" "nf_location" "nf_visitors" "neofetch_title" "segfault" -}}
{{- $strings := dict -}}
{{- range $keys }}{{ $strings = merge $strings (dict . (i18n (printf "term_%s" .))) }}{{ end -}}
{{- $visitors := hugo.Data.visitor_countries -}}
{{- $neofetch := dict "stack" "Go, Java, Python" "location" (i18n "location_value") "countries" (int ($visitors.total_countries | default 0)) -}}
{{- $contact := slice (dict "label" "LinkedIn" "url" "https://linkedin.com/in/dpcamargo") (dict "label" "GitHub" "url" "https://github.com/dpcamargo") -}}
{{- dict "home" ("/" | relLangURL) "langs" $langs "pages" $pages "posts" $posts "contact" $contact "neofetch" $neofetch "strings" $strings | jsonify -}}
```

The 32 keys in `$keys` are exactly the 32 `term_*` keys added in Step 5. (`input_label`, `placeholder` and `segfault` are also rendered into the page by Task 4, so the prompt has them even when this file fails to load.)

- [ ] **Step 5: Add the strings**

Append to `i18n/en.toml`:

```toml

[term_input_label]
other = "terminal: type a command, help for the list"

[term_placeholder]
other = "type help"

[term_offline]
other = "terminal: offline, try reloading"

[term_enoent]
other = "no such file or directory"

[term_notfound]
other = "zsh: command not found: %s"

[term_help_intro]
other = "available commands (Tab completes, ↑/↓ recall history):"

[term_help_help]
other = "this list"

[term_help_ls]
other = "list pages, or the posts inside til (ls -l for details)"

[term_help_cd]
other = "go to a page: cd til, cd .., cd ~"

[term_help_cat]
other = "open a TIL post: cat go-errgroup"

[term_help_whoami]
other = "who is Dario"

[term_help_neofetch]
other = "system info, sort of"

[term_help_contact]
other = "LinkedIn and GitHub"

[term_help_theme]
other = "theme dark | light"

[term_help_lang]
other = "lang en | pt"

[term_help_clear]
other = "clear the screen"

[term_help_exit]
other = "log out of this session"

[term_whoami]
other = "Dario Camargo, software engineer building distributed backend systems in Go, Java, and Python. At Mercado Livre since 2024."

[term_sudo]
other = "guest is not in the sudoers file. This incident will be reported."

[term_vim]
other = "you are now trapped. type :q to exit"

[term_rm_denied]
other = "rm: cannot remove '%s': Permission denied"

[term_cat_usage]
other = "usage: cat <post> (try ls in til)"

[term_theme_usage]
other = "usage: theme dark | light"

[term_lang_usage]
other = "usage: lang en | pt"

[term_logout]
other = "logout"

[term_panic]
other = "Kernel panic - not syncing: attempted to kill dario"

[term_nf_host]
other = "host"

[term_nf_stack]
other = "stack"

[term_nf_location]
other = "location"

[term_nf_visitors]
other = "visitor countries"

[term_neofetch_title]
other = "guest@dario"

[term_segfault]
other = "segfault (core dumped)"
```

Append to `i18n/pt.toml`:

```toml

[term_input_label]
other = "terminal: digite um comando, help para a lista"

[term_placeholder]
other = "digite help"

[term_offline]
other = "terminal: offline, tente recarregar"

[term_enoent]
other = "arquivo ou diretório inexistente"

[term_notfound]
other = "zsh: comando não encontrado: %s"

[term_help_intro]
other = "comandos disponíveis (Tab completa, ↑/↓ percorre o histórico):"

[term_help_help]
other = "esta lista"

[term_help_ls]
other = "lista as páginas, ou os posts dentro de til (ls -l para detalhes)"

[term_help_cd]
other = "vai para uma página: cd til, cd .., cd ~"

[term_help_cat]
other = "abre um post de TIL: cat go-errgroup"

[term_help_whoami]
other = "quem é o Dario"

[term_help_neofetch]
other = "informações do sistema, mais ou menos"

[term_help_contact]
other = "LinkedIn e GitHub"

[term_help_theme]
other = "theme dark | light"

[term_help_lang]
other = "lang en | pt"

[term_help_clear]
other = "limpa a tela"

[term_help_exit]
other = "sai desta sessão"

[term_whoami]
other = "Dario Camargo, engenheiro de software que constrói sistemas distribuídos de backend em Go, Java e Python. No Mercado Livre desde 2024."

[term_sudo]
other = "guest não está no arquivo sudoers. Este incidente será reportado."

[term_vim]
other = "agora você está preso. digite :q para sair"

[term_rm_denied]
other = "rm: não foi possível remover '%s': Permissão negada"

[term_cat_usage]
other = "uso: cat <post> (tente ls em til)"

[term_theme_usage]
other = "uso: theme dark | light"

[term_lang_usage]
other = "uso: lang en | pt"

[term_logout]
other = "logout"

[term_panic]
other = "Kernel panic - not syncing: tentativa de matar o dario"

[term_nf_host]
other = "host"

[term_nf_stack]
other = "stack"

[term_nf_location]
other = "local"

[term_nf_visitors]
other = "países visitantes"

[term_neofetch_title]
other = "guest@dario"

[term_segfault]
other = "segfault (core dumped)"
```

- [ ] **Step 6: Run the checks**

Run: `bash scripts/check-site.sh`
Expected: every line `ok`, exit 0. If `hugo builds` fails on the template name, check that Hugo 0.166 picks up `layouts/index.terminal.json` (the project's `layouts/index.html` proves the `index.*` lookup works); if not, rename it to `layouts/home.terminal.json` and re-run.

- [ ] **Step 7: Commit**

```bash
git add hugo.toml layouts/index.terminal.json i18n/en.toml i18n/pt.toml scripts/check-site.sh
git commit -m "generate /terminal.json and add the terminal strings in both languages"
```

---

### Task 3: Command logic in `terminal-core.js`, unit-tested

**Files:**
- Create: `assets/js/terminal-core.js`
- Create: `scripts/terminal-core.test.js`
- Modify: `scripts/check-site.sh` (`terminal` group: run the unit tests)

**Interfaces:**
- Consumes: the `data` shape from Task 2 (plus `offline: true` on the fallback object built by Task 4).
- Produces `window.TerminalCore` (and `module.exports` under Node) with:
  - `parse(line) → {cmd: string (lowercased), args: string[]} | null`
  - `cwdFromPath(pathname, home) → "~" | "~/til" | "~/til/<slug>" | …`
  - `promptString(cwd) → "guest@dario:<cwd>$"`
  - `isPagePath(pathname, home, homes: string[]) → boolean`
  - `resolveCd(arg, cwd, data) → {url} | {error: arg}`
  - `complete(line, cwd, data) → {value: string, options: string[]}`
  - `execute(line, {cwd, data}) → Action[]`
  - `loadHistory(storage, key) → string[]`, `saveHistory(storage, key, list)`, `pushHistory(list, line) → string[]`
  - Action types: `{type:"text", text}`, `{type:"list", long: bool, items:[{label, fill}]}`, `{type:"links", items:[{label, url}]}`, `{type:"neofetch", title, art: string[], rows: [[label, value]]}`, `{type:"navigate", url, missing}`, `{type:"clear"}`, `{type:"exit", text}`, `{type:"theme", value}`, `{type:"lang", value}`, `{type:"rmrf", lines: string[], panic}`

- [ ] **Step 1: Write the failing tests**

Create `scripts/terminal-core.test.js`:

```js
// Unit tests for assets/js/terminal-core.js. Run: node --test scripts/terminal-core.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../assets/js/terminal-core.js");

const strings = {
    offline: "OFFLINE", enoent: "no such file or directory", notfound: "zsh: command not found: %s",
    help_intro: "INTRO", help_help: "h", help_ls: "l", help_cd: "c", help_cat: "k", help_whoami: "w",
    help_neofetch: "n", help_contact: "ct", help_theme: "t", help_lang: "lg", help_clear: "cl", help_exit: "e",
    whoami: "WHO", sudo: "SUDO", vim: "VIM", rm_denied: "rm: cannot remove '%s': Permission denied",
    cat_usage: "CATUSAGE", theme_usage: "THEMEUSAGE", lang_usage: "LANGUSAGE", logout: "logout", panic: "PANIC",
    nf_host: "host", nf_stack: "stack", nf_location: "location", nf_visitors: "visitor countries",
    neofetch_title: "guest@dario", segfault: "SEGFAULT"
};
const data = {
    home: "/",
    langs: ["en", "pt"],
    pages: [{ name: "whoami", url: "/" }, { name: "til", url: "/til/" }],
    posts: [
        { slug: "go-errgroup", title: "Go: errgroup", url: "/til/go-errgroup/", date: "2025-06-03", tags: ["go"] },
        { slug: "go-sorting", title: "Go: sorting", url: "/til/go-sorting/", date: "2025-06-01", tags: ["go"] },
        { slug: "mongo-crud", title: "MongoDB", url: "/til/mongo-crud/", date: "2025-05-30", tags: [] }
    ],
    contact: [{ label: "GitHub", url: "https://github.com/dpcamargo" }],
    neofetch: { stack: "Go, Java, Python", location: "Brazil", countries: 2 },
    strings: strings
};
const run = (line, cwd = "~", d = data) => core.execute(line, { cwd, data: d });

test("parse splits on whitespace and lowercases the command", () => {
    assert.deepEqual(core.parse("  LS   -l  til "), { cmd: "ls", args: ["-l", "til"] });
    assert.equal(core.parse("   "), null);
});

test("cwdFromPath maps URLs to ~ paths in both languages", () => {
    assert.equal(core.cwdFromPath("/", "/"), "~");
    assert.equal(core.cwdFromPath("/til/", "/"), "~/til");
    assert.equal(core.cwdFromPath("/til/go-errgroup/", "/"), "~/til/go-errgroup");
    assert.equal(core.cwdFromPath("/pt/", "/pt/"), "~");
    assert.equal(core.cwdFromPath("/pt/til/go-errgroup/", "/pt/"), "~/til/go-errgroup");
    assert.equal(core.promptString("~/til"), "guest@dario:~/til$");
});

test("isPagePath accepts this language's pages only", () => {
    const homes = ["/", "/pt/"];
    assert.equal(core.isPagePath("/til/", "/", homes), true);
    assert.equal(core.isPagePath("/pt/til/", "/", homes), false);
    assert.equal(core.isPagePath("/pt/til/", "/pt/", homes), true);
    assert.equal(core.isPagePath("/til/", "/pt/", homes), false);
    assert.equal(core.isPagePath("/index.xml", "/", homes), false);
    assert.equal(core.isPagePath("/images/standing.png", "/", homes), false);
});

test("resolveCd handles ~, .., page names, paths and slugs", () => {
    assert.deepEqual(core.resolveCd(undefined, "~/til", data), { url: "/" });
    assert.deepEqual(core.resolveCd("~", "~/til", data), { url: "/" });
    assert.deepEqual(core.resolveCd("/", "~/til", data), { url: "/" });
    assert.deepEqual(core.resolveCd("..", "~/til/go-errgroup", data), { url: "/til/" });
    assert.deepEqual(core.resolveCd("..", "~/til", data), { url: "/" });
    assert.deepEqual(core.resolveCd("..", "~", data), { url: "/" });
    assert.deepEqual(core.resolveCd("TIL", "~", data), { url: "/til/" });
    assert.deepEqual(core.resolveCd("~/til/", "~", data), { url: "/til/" });
    assert.deepEqual(core.resolveCd("whoami", "~/til", data), { url: "/" });
    assert.deepEqual(core.resolveCd("go-sorting", "~/til", data), { url: "/til/go-sorting/" });
    assert.deepEqual(core.resolveCd("til/go-sorting", "~", data), { url: "/til/go-sorting/" });
    assert.deepEqual(core.resolveCd("go-sorting", "~", data), { error: "go-sorting" });
    assert.deepEqual(core.resolveCd("nope", "~", data), { error: "nope" });
});

test("complete fills a unique match and lists several", () => {
    assert.deepEqual(core.complete("ne", "~", data), { value: "neofetch ", options: [] });
    assert.deepEqual(core.complete("c", "~", data), { value: "c", options: ["cd", "cat", "contact", "clear"] });
    assert.deepEqual(core.complete("cat go-e", "~", data), { value: "cat go-errgroup ", options: [] });
    assert.deepEqual(core.complete("cat go-", "~", data), { value: "cat go-", options: ["go-errgroup", "go-sorting"] });
    assert.deepEqual(core.complete("cd t", "~", data), { value: "cd til ", options: [] });
    assert.deepEqual(core.complete("cd go-s", "~/til", data), { value: "cd go-sorting ", options: [] });
    assert.deepEqual(core.complete("cd go-s", "~", data), { value: "cd go-s", options: [] });
    assert.deepEqual(core.complete("theme l", "~", data), { value: "theme light ", options: [] });
    assert.deepEqual(core.complete("xyz q", "~", data), { value: "xyz q", options: [] });
});

test("unknown commands and HTML are echoed as plain text", () => {
    assert.deepEqual(run("<img src=x onerror=alert(1)>"), [{ type: "text", text: "zsh: command not found: <img" }]);
    assert.deepEqual(run("constructor"), [{ type: "text", text: "zsh: command not found: constructor" }]);
    assert.deepEqual(run("   "), []);
});

test("help lists every command with its description", () => {
    const [action] = run("help");
    assert.equal(action.type, "text");
    assert.match(action.text, /^INTRO\n/);
    for (const name of ["help", "ls", "cd", "cat", "whoami", "neofetch", "contact", "theme", "lang", "clear", "exit"]) {
        assert.match(action.text, new RegExp("^" + name + " +", "m"));
    }
});

test("ls lists pages at ~ and posts in til", () => {
    assert.deepEqual(run("ls"), [{ type: "list", long: false, items: [
        { label: "whoami/", fill: "cd whoami" }, { label: "til/", fill: "cd til" }] }]);
    const inTil = run("ls", "~/til")[0];
    assert.deepEqual(inTil.items[0], { label: "go-errgroup", fill: "cat go-errgroup" });
    assert.deepEqual(run("ls til")[0].items.length, 3);
    assert.deepEqual(run("ls -l", "~/til")[0], { type: "list", long: true, items: [
        { label: "2025-06-03  go-errgroup  Go: errgroup", fill: "cat go-errgroup" },
        { label: "2025-06-01  go-sorting  Go: sorting", fill: "cat go-sorting" },
        { label: "2025-05-30  mongo-crud  MongoDB", fill: "cat mongo-crud" }] });
    assert.deepEqual(run("ls nope"), [{ type: "text", text: "ls: nope: no such file or directory" }]);
});

test("cd and cat navigate or explain why not", () => {
    assert.deepEqual(run("cd til"), [{ type: "navigate", url: "/til/", missing: "cd: no such file or directory: til" }]);
    assert.deepEqual(run("cd"), [{ type: "navigate", url: "/", missing: "cd: no such file or directory: ~" }]);
    assert.deepEqual(run("cd nope"), [{ type: "text", text: "cd: no such file or directory: nope" }]);
    assert.deepEqual(run("cat go-errgroup"), [{ type: "navigate", url: "/til/go-errgroup/", missing: "cat: go-errgroup: no such file or directory" }]);
    assert.deepEqual(run("cat til/go-errgroup/"), [{ type: "navigate", url: "/til/go-errgroup/", missing: "cat: til/go-errgroup/: no such file or directory" }]);
    assert.deepEqual(run("cat"), [{ type: "text", text: "CATUSAGE" }]);
    assert.deepEqual(run("cat nope"), [{ type: "text", text: "cat: nope: no such file or directory" }]);
});

test("simple commands", () => {
    assert.deepEqual(run("clear"), [{ type: "clear" }]);
    assert.deepEqual(run("exit"), [{ type: "exit", text: "logout" }]);
    assert.deepEqual(run("whoami"), [{ type: "text", text: "WHO" }]);
    assert.deepEqual(run("contact"), [{ type: "links", items: data.contact }]);
    assert.deepEqual(run("vim"), [{ type: "text", text: "VIM" }]);
    assert.deepEqual(run("nano notes.txt"), [{ type: "text", text: "VIM" }]);
    assert.deepEqual(run(":q"), []);
    assert.deepEqual(run(":wq"), []);
});

test("neofetch reports the site's numbers", () => {
    const [action] = run("neofetch");
    assert.equal(action.type, "neofetch");
    assert.equal(action.title, "guest@dario");
    assert.ok(action.art.length >= 6);
    assert.deepEqual(action.rows, [["host", "dario.dev.br"], ["stack", "Go, Java, Python"], ["location", "Brazil"], ["visitor countries", "2"]]);
});

test("theme and lang validate their argument", () => {
    assert.deepEqual(run("theme LIGHT"), [{ type: "theme", value: "light" }]);
    assert.deepEqual(run("theme pink"), [{ type: "text", text: "THEMEUSAGE" }]);
    assert.deepEqual(run("lang pt"), [{ type: "lang", value: "pt" }]);
    assert.deepEqual(run("lang"), [{ type: "text", text: "LANGUSAGE" }]);
});

test("sudo and rm", () => {
    assert.deepEqual(run("sudo ls"), [{ type: "text", text: "SUDO" }]);
    assert.deepEqual(run("rm notes.txt"), [{ type: "text", text: "rm: cannot remove 'notes.txt': Permission denied" }]);
    assert.deepEqual(run("rm -rf /tmp"), [{ type: "text", text: "rm: cannot remove '/tmp': Permission denied" }]);
    for (const line of ["rm -rf /", "rm -fr /", "rm -r -f ~", "sudo rm -rf /", "rm -rf /*", "rm -rf ~/"]) {
        const [action] = run(line);
        assert.equal(action.type, "rmrf", line);
        assert.equal(action.panic, "PANIC");
        assert.ok(action.lines.length >= 6);
    }
});

test("offline: only cd, clear and vim's exits work", () => {
    const offline = { home: "/", langs: [], pages: data.pages, posts: [], contact: [], neofetch: {},
        strings: { offline: "OFFLINE", enoent: "no such file or directory", notfound: "zsh: command not found: %s" }, offline: true };
    assert.deepEqual(run("help", "~", offline), [{ type: "text", text: "OFFLINE" }]);
    assert.deepEqual(run("theme light", "~", offline), [{ type: "text", text: "OFFLINE" }]);
    assert.deepEqual(run("cd til", "~", offline)[0].url, "/til/");
    assert.deepEqual(run("clear", "~", offline), [{ type: "clear" }]);
    assert.deepEqual(run("zzz", "~", offline), [{ type: "text", text: "zsh: command not found: zzz" }]);
});

test("history survives storage that throws, and dedupes and caps", () => {
    const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
    assert.deepEqual(core.loadHistory(broken, "k"), []);
    assert.doesNotThrow(() => core.saveHistory(broken, "k", ["ls"]));
    assert.deepEqual(core.loadHistory(null, "k"), []);
    const memory = { value: null, getItem() { return this.value; }, setItem(k, v) { this.value = v; } };
    core.saveHistory(memory, "k", ["ls", "cd til"]);
    assert.deepEqual(core.loadHistory(memory, "k"), ["ls", "cd til"]);
    memory.value = "{not json";
    assert.deepEqual(core.loadHistory(memory, "k"), []);
    assert.deepEqual(core.pushHistory(["ls"], "ls"), ["ls"]);
    assert.deepEqual(core.pushHistory(["ls"], "  "), ["ls"]);
    let list = [];
    for (let i = 0; i < 60; i++) list = core.pushHistory(list, "cmd " + i);
    assert.equal(list.length, 50);
    assert.equal(list[0], "cmd 10");
});
```

Note the first assertion of "unknown commands": `parse` splits on whitespace, so the command is `<img` and the rest are arguments. That is the expected, literal output.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/terminal-core.test.js`
Expected: FAIL, `Cannot find module '../assets/js/terminal-core.js'`.

- [ ] **Step 3: Write the implementation**

Create `assets/js/terminal-core.js`:

```js
// The terminal prompt's logic, with no DOM: parsing, paths, completion, and what each command does, returned as
// a list of actions that assets/js/terminal.js performs. Unit tests: node --test scripts/terminal-core.test.js
(function () {
    var HELP = ["help", "ls", "cd", "cat", "whoami", "neofetch", "contact", "theme", "lang", "clear", "exit"];
    // Without /terminal.json only these still work; the rest print the offline message
    var OFFLINE_OK = ["cd", "clear", ":q", ":q!", ":wq"];
    var THEMES = ["dark", "light"];
    var RM_TARGETS = ["/", "/*", "~", "~/"];
    var HISTORY_MAX = 50;
    var RM_LINES = [
        "removed '/usr/bin/go'",
        "removed '/usr/lib/jvm'",
        "removed '/usr/lib/python3'",
        "removed '/home/dario/til'",
        "removed '/home/dario/career'",
        "removed '/home/dario/.coffee'",
        "removed '/etc/sanity.conf'",
        "removed '/boot/vmlinuz'"
    ];
    var ART = [
        "   .-''''-.   ",
        "  /        \\  ",
        " |  o    o  | ",
        " |    __    | ",
        "  \\  \\__/  /  ",
        "   '-.__.-'   ",
        "   /|    |\\   ",
        "  /_|____|_\\  "
    ];

    function has(list, value) {
        return list.indexOf(value) !== -1;
    }

    function findBy(list, key, value) {
        for (var i = 0; i < list.length; i++) if (list[i][key] === value) return list[i];
        return null;
    }

    function fmt(template, value) {
        return String(template).replace("%s", value);
    }

    function text(value) {
        return { type: "text", text: value };
    }

    function pad(value, width) {
        while (value.length < width) value += " ";
        return value;
    }

    function parse(line) {
        var words = String(line).trim().split(/\s+/).filter(Boolean);
        if (!words.length) return null;
        return { cmd: words[0].toLowerCase(), args: words.slice(1) };
    }

    // "/pt/til/go-errgroup/" with home "/pt/" -> "~/til/go-errgroup"
    function cwdFromPath(pathname, home) {
        var rest = pathname.indexOf(home) === 0 ? pathname.slice(home.length) : pathname.replace(/^\//, "");
        rest = rest.replace(/\/+$/, "");
        return rest ? "~/" + rest : "~";
    }

    function promptString(cwd) {
        return "guest@dario:" + cwd + "$";
    }

    // A page of this language that the terminal may fetch: not another language's pages, not a file
    function isPagePath(pathname, home, homes) {
        if (pathname.indexOf(home) !== 0) return false;
        for (var i = 0; i < homes.length; i++) {
            if (homes[i].length > home.length && pathname.indexOf(homes[i]) === 0) return false;
        }
        return !/\.[a-z0-9]+$/i.test(pathname);
    }

    function resolveCd(arg, cwd, data) {
        var home = data.home;
        if (!arg || arg === "~" || arg === "/" || arg === "~/") return { url: home };
        var target = arg.replace(/\/+$/, "");
        if (target === "..") {
            var parts = cwd.split("/");
            return { url: parts.length <= 2 ? home : home + parts.slice(1, -1).join("/") + "/" };
        }
        if (target === ".") return { url: cwd === "~" ? home : home + cwd.slice(2) + "/" };
        target = target.replace(/^~?\//, "").toLowerCase();
        var page = findBy(data.pages, "name", target);
        if (page) return { url: page.url };
        var slug = target.replace(/^til\//, "");
        if (slug !== target || cwd.indexOf("~/til") === 0) {
            var post = findBy(data.posts, "slug", slug);
            if (post) return { url: post.url };
        }
        return { error: arg };
    }

    function slugs(data) {
        return data.posts.map(function (post) { return post.slug; });
    }

    function argCandidates(cmd, cwd, data) {
        if (cmd === "cat") return slugs(data);
        if (cmd === "cd") {
            var names = data.pages.map(function (page) { return page.name; });
            return cwd.indexOf("~/til") === 0 ? names.concat(slugs(data)) : names;
        }
        if (cmd === "theme") return THEMES;
        if (cmd === "lang") return data.langs;
        return [];
    }

    function commonPrefix(words) {
        var prefix = words[0];
        words.forEach(function (word) {
            while (word.indexOf(prefix) !== 0) prefix = prefix.slice(0, -1);
        });
        return prefix;
    }

    function complete(line, cwd, data) {
        var trimmed = line.trim();
        if (!trimmed) return { value: line, options: [] };
        var words = trimmed.split(/\s+/);
        var open = /\s$/.test(line);
        var candidates, prefix, head;
        if (words.length === 1 && !open) {
            candidates = HELP;
            prefix = words[0];
            head = "";
        } else {
            candidates = argCandidates(words[0].toLowerCase(), cwd, data);
            prefix = open ? "" : words[words.length - 1];
            head = (open ? words : words.slice(0, -1)).join(" ") + " ";
        }
        var matches = candidates.filter(function (candidate) { return candidate.indexOf(prefix) === 0; });
        if (!matches.length) return { value: line, options: [] };
        if (matches.length === 1) return { value: head + matches[0] + " ", options: [] };
        return { value: head + commonPrefix(matches), options: matches };
    }

    function isRmrf(args) {
        var flags = args.filter(function (arg) { return arg.charAt(0) === "-"; }).join("");
        var targets = args.filter(function (arg) { return arg.charAt(0) !== "-"; });
        return /r/i.test(flags) && /f/.test(flags) && targets.some(function (target) { return has(RM_TARGETS, target); });
    }

    function rmrf(ctx) {
        return [{ type: "rmrf", lines: RM_LINES, panic: ctx.data.strings.panic }];
    }

    var HANDLERS = {
        help: function (args, ctx) {
            var s = ctx.data.strings;
            var lines = HELP.map(function (name) { return pad(name, 10) + s["help_" + name]; });
            return [text(s.help_intro + "\n" + lines.join("\n"))];
        },
        ls: function (args, ctx) {
            var long = has(args, "-l");
            var target = args.filter(function (arg) { return arg.charAt(0) !== "-"; })[0];
            var inTil = target ? /^(~\/|\/)?til\/?$/.test(target) : ctx.cwd.indexOf("~/til") === 0;
            if (target && !inTil && !/^(~|\/|~\/)$/.test(target)) {
                return [text("ls: " + target + ": " + ctx.data.strings.enoent)];
            }
            if (inTil) {
                return [{ type: "list", long: long, items: ctx.data.posts.map(function (post) {
                    return { label: long ? post.date + "  " + post.slug + "  " + post.title : post.slug, fill: "cat " + post.slug };
                }) }];
            }
            return [{ type: "list", long: long, items: ctx.data.pages.map(function (page) {
                return { label: page.name + "/", fill: "cd " + page.name };
            }) }];
        },
        cd: function (args, ctx) {
            var enoent = ctx.data.strings.enoent;
            var result = resolveCd(args[0], ctx.cwd, ctx.data);
            if (result.error) return [text("cd: " + enoent + ": " + result.error)];
            return [{ type: "navigate", url: result.url, missing: "cd: " + enoent + ": " + (args[0] || "~") }];
        },
        cat: function (args, ctx) {
            var s = ctx.data.strings;
            if (!args[0]) return [text(s.cat_usage)];
            var slug = args[0].replace(/^(~\/|\/)?til\//, "").replace(/\/+$/, "");
            var post = findBy(ctx.data.posts, "slug", slug);
            var missing = "cat: " + args[0] + ": " + s.enoent;
            if (!post) return [text(missing)];
            return [{ type: "navigate", url: post.url, missing: missing }];
        },
        clear: function () {
            return [{ type: "clear" }];
        },
        exit: function (args, ctx) {
            return [{ type: "exit", text: ctx.data.strings.logout }];
        },
        whoami: function (args, ctx) {
            return [text(ctx.data.strings.whoami)];
        },
        neofetch: function (args, ctx) {
            var s = ctx.data.strings;
            var n = ctx.data.neofetch;
            return [{ type: "neofetch", title: s.neofetch_title, art: ART, rows: [
                [s.nf_host, "dario.dev.br"],
                [s.nf_stack, n.stack],
                [s.nf_location, n.location],
                [s.nf_visitors, String(n.countries)]
            ] }];
        },
        contact: function (args, ctx) {
            return [{ type: "links", items: ctx.data.contact }];
        },
        theme: function (args, ctx) {
            var value = (args[0] || "").toLowerCase();
            return has(THEMES, value) ? [{ type: "theme", value: value }] : [text(ctx.data.strings.theme_usage)];
        },
        lang: function (args, ctx) {
            var value = (args[0] || "").toLowerCase();
            return has(ctx.data.langs, value) ? [{ type: "lang", value: value }] : [text(ctx.data.strings.lang_usage)];
        },
        sudo: function (args, ctx) {
            if (args[0] === "rm" && isRmrf(args.slice(1))) return rmrf(ctx);
            return [text(ctx.data.strings.sudo)];
        },
        rm: function (args, ctx) {
            if (isRmrf(args)) return rmrf(ctx);
            var targets = args.filter(function (arg) { return arg.charAt(0) !== "-"; });
            return [text(fmt(ctx.data.strings.rm_denied, targets[0] || ""))];
        },
        vim: function (args, ctx) {
            return [text(ctx.data.strings.vim)];
        },
        ":q": function () {
            return [];
        }
    };
    HANDLERS.vi = HANDLERS.vim;
    HANDLERS.nano = HANDLERS.vim;
    HANDLERS[":q!"] = HANDLERS[":q"];
    HANDLERS[":wq"] = HANDLERS[":q"];

    function execute(line, ctx) {
        var parsed = parse(line);
        if (!parsed) return [];
        var s = ctx.data.strings;
        if (!Object.prototype.hasOwnProperty.call(HANDLERS, parsed.cmd)) return [text(fmt(s.notfound, parsed.cmd))];
        if (ctx.data.offline && !has(OFFLINE_OK, parsed.cmd)) return [text(s.offline)];
        return HANDLERS[parsed.cmd](parsed.args, ctx);
    }

    function loadHistory(storage, key) {
        try {
            var list = JSON.parse(storage.getItem(key));
            return Array.isArray(list) ? list.filter(function (item) { return typeof item === "string"; }) : [];
        } catch (e) {
            return [];
        }
    }

    function saveHistory(storage, key, list) {
        try { storage.setItem(key, JSON.stringify(list)); } catch (e) {}
    }

    function pushHistory(list, line) {
        var entry = line.trim();
        if (!entry || list[list.length - 1] === entry) return list;
        return list.concat(entry).slice(-HISTORY_MAX);
    }

    var TerminalCore = {
        HELP: HELP,
        parse: parse,
        cwdFromPath: cwdFromPath,
        promptString: promptString,
        isPagePath: isPagePath,
        resolveCd: resolveCd,
        complete: complete,
        execute: execute,
        loadHistory: loadHistory,
        saveHistory: saveHistory,
        pushHistory: pushHistory
    };

    if (typeof module === "object" && module.exports) module.exports = TerminalCore;
    else window.TerminalCore = TerminalCore;
})();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/terminal-core.test.js`
Expected: all tests pass, `# fail 0`.

- [ ] **Step 5: Hook the tests into check-site**

Append to `group_terminal` in `scripts/check-site.sh`:

```bash
    expect "terminal-core unit tests pass" node --test scripts/terminal-core.test.js
```

Run: `bash scripts/check-site.sh terminal`
Expected: every line `ok`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add assets/js/terminal-core.js scripts/terminal-core.test.js scripts/check-site.sh
git commit -m "add the terminal's command logic with node unit tests"
```

---

### Task 4: The prompt, the scrollback and the REPL

In this task `navigate` actions do a normal page load; Task 5 swaps that for in-place navigation.

**Files:**
- Modify: `layouts/_default/baseof.html` (prompt form after `.win__scroll`)
- Modify: `layouts/partials/head.html` (bundle `terminal` CSS, load `terminal-core.js` and `terminal.js`)
- Modify: `assets/js/typewriter.js` (`finish()` announces it is done)
- Create: `assets/css/terminal.css`
- Create: `assets/js/terminal.js`
- Modify: `scripts/check-site.sh` (`terminal` group)

**Interfaces:**
- Consumes: `window.TerminalCore` (Task 3), `/terminal.json` (Task 2), `.term__echo`/`.term__ps` classes (Task 1).
- Produces for Task 5 and 6, all inside the `terminal.js` IIFE: `makeBlock(url) → HTMLElement`, `appendBlock(block, align: "start"|"end")`, `echo(line) → HTMLElement`, `textNode(value) → HTMLElement`, `navigate(url, block) → Promise<boolean|undefined>` (true: appended, false: 404, undefined: fell back to a page load), `perform(actions, block, data) → Promise`, `metas: Map<HTMLElement, Meta>`, `readMeta(doc) → Meta`, `applyMeta(meta)`, `home()`, `homes()`, `cwd()`, `wait(ms) → Promise`, `reducedMotion() → boolean`, the `storage`, `HISTORY_KEY` and `root` variables. `typewriter.js` adds class `typed` to `<html>` and dispatches `typewriter:done` on `document` when it finishes.

- [ ] **Step 1: Write the failing checks**

Append to `group_terminal` in `scripts/check-site.sh`:

```bash
    expect "every page carries a hidden prompt" sh -c 'for f in index.html til/index.html til/go-errgroup/index.html pt/index.html; do grep -q "<form class=\"term__prompt\" hidden" "$0/$f" || exit 1; done' "$OUT"
    expect "the prompt points at this language's terminal.json" sh -c 'grep -q "data-json=\"/terminal.json\"" "$0/index.html" && grep -q "data-json=\"/pt/terminal.json\"" "$0/pt/index.html"' "$OUT"
    expect "the prompt input is labelled in each language" sh -c 'grep -q "aria-label=\"terminal: type a command" "$0/index.html" && grep -q "aria-label=\"terminal: digite um comando" "$0/pt/index.html"' "$OUT"
    expect "only the home page autofocuses the prompt" sh -c 'grep -q "data-autofocus" "$0/index.html" && ! grep -q "data-autofocus" "$0/til/index.html"' "$OUT"
    expect "terminal.css is bundled" grep -q '"terminal"' layouts/partials/head.html
    expect "terminal-core.js loads before terminal.js" python3 -c "
import re
html = open('$OUT/index.html').read()
core = re.search(r'terminal-core[^\"]*\.js', html)
term = re.search(r'/js/terminal\.[^\"]*\.js', html)
assert core and term and core.start() < term.start()
"
    expect "the typewriter announces when it is done" grep -q 'typewriter:done' assets/js/typewriter.js
    forbid "terminal.js never sets innerHTML from command output" grep -Eq 'innerHTML *= *(action|line|value|text)' assets/js/terminal.js
```

Run: `bash scripts/check-site.sh terminal`
Expected: FAIL on the seven new `expect` lines; the `forbid` line passes (grep on a missing file fails). Exit 1.

- [ ] **Step 2: Add the prompt form**

In `layouts/_default/baseof.html`, right after the closing `</div>` of `.win__scroll` (still inside `.win__body`), add:

```html
                        {{- /* Terminal prompt (assets/js/terminal.js). Hidden until the script shows it, so the site is unchanged
                               without JavaScript. The data-* strings are what the prompt needs even when terminal.json fails. */}}
                        <form class="term__prompt" hidden
                              data-json="{{ "terminal.json" | relLangURL }}"
                              data-home="{{ "/" | relLangURL }}"
                              data-homes="{{ range hugo.Sites }}{{ .Home.RelPermalink }} {{ end }}"
                              data-offline="{{ i18n "term_offline" }}"
                              data-enoent="{{ i18n "term_enoent" }}"
                              data-notfound="{{ i18n "term_notfound" }}"
                              data-segfault="{{ i18n "term_segfault" }}"{{ if .IsHome }}
                              data-autofocus{{ end }}>
                            <label class="term__ps" for="term-input">guest@dario:~$</label>
                            <input id="term-input" class="term__input" type="text" name="command" autocomplete="off"
                                   autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send"
                                   aria-label="{{ i18n "term_input_label" }}" placeholder="{{ i18n "term_placeholder" }}">
                        </form>
```

(`check-site.sh` builds without `--minify`, so `<form class="term__prompt" hidden` stays on one line for the check to grep.)

- [ ] **Step 3: Bundle the CSS and load the scripts**

In `layouts/partials/head.html`, add `"terminal"` to the stylesheet list, right after `"typewriter"`:

```
{{ range slice "spacing" "colours" "window" "button" "header" "layout" "social" "typography" "side_image" "crt" "chroma" "boot" "scrollbar" "background" "typewriter" "terminal" "notfound" "minimize" }}
```

After the `minimize.js` script line, add:

```html
{{ $termCore := resources.Get "js/terminal-core.js" | minify | fingerprint }}
<script defer src="{{ $termCore.RelPermalink }}" integrity="{{ $termCore.Data.Integrity }}"></script>
{{ $terminal := resources.Get "js/terminal.js" | minify | fingerprint }}
<script defer src="{{ $terminal.RelPermalink }}" integrity="{{ $terminal.Data.Integrity }}"></script>
```

(Deferred scripts run in document order, so `typewriter.js` has already started when `terminal.js` runs.)

- [ ] **Step 4: Make the typewriter announce the end**

In `assets/js/typewriter.js`, at the end of `finish()`, after `root.classList.remove("typing");`, add:

```js
        // assets/js/terminal.js waits for this before it wraps the page into its scrollback
        root.classList.add("typed");
        document.dispatchEvent(new CustomEvent("typewriter:done"));
```

- [ ] **Step 5: Write the CSS**

Create `assets/css/terminal.css`:

```css
/* Terminal prompt and scrollback (assets/js/terminal.js). The prompt sits under the content window's scroller,
   so it stays in view while older blocks scroll up; on a phone it is fixed to the bottom of the screen. */
.term__prompt:not([hidden]) {
    display: flex;
    flex: none;
    align-items: baseline;
    gap: 0.6rem;
    padding: var(--space-2) calc(var(--space-4) - var(--frame-inset));
    border-top: 1px dashed var(--win-border);
}

.term__prompt:focus-within {
    border-top-color: var(--text-header);
}

.term__ps {
    flex: none;
    color: var(--off-fg);
}

.term__input {
    flex: 1;
    min-width: 0;
    padding: 0;
    font: inherit;
    color: var(--text-body);
    background: transparent;
    border: 0;
    caret-color: var(--text-header);
}

.term__input:focus {
    outline: none;
}

.term__input::placeholder {
    color: var(--muted);
}

.term__block + .term__block {
    margin-top: var(--space-4);
}

.term__echo {
    margin: 0 0 var(--space-2);
    color: var(--text-body);
}

.term__echo .term__ps {
    margin-right: 0.6rem;
}

.term__out {
    margin: 0 0 var(--space-2);
    font: inherit;
    color: var(--text-body);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.term__list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.5rem;
    margin: 0 0 var(--space-2);
    padding: 0;
    list-style: none;
}

.term__list--long {
    display: block;
}

.term__fill {
    padding: 0;
    font: inherit;
    text-align: left;
    color: var(--link);
    background: none;
    border: 0;
    cursor: pointer;
}

.term__fill:hover,
.term__fill:focus-visible {
    color: var(--hover);
    text-decoration: underline;
}

.term__neofetch {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    margin: 0 0 var(--space-2);
}

.term__art {
    margin: 0;
    font: inherit;
    line-height: 1.15;
    color: var(--text-header);
}

.term__neofetch dl {
    margin: 0;
}

.term__neofetch dt {
    color: var(--off-fg);
}

.term__neofetch dd {
    margin: 0 0 0.25rem;
}

@media screen and (max-width: 768px) {
    /* room under the last block for the fixed prompt */
    .term-ready .page__body {
        padding-bottom: calc(var(--gutter) + 3.5rem);
    }

    .term__prompt:not([hidden]) {
        position: fixed;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 5;
        padding: var(--space-2) var(--gutter);
        background-color: var(--win-bg);
        border-top: 2px solid var(--win-border);
    }

    /* 16px keeps iOS from zooming in when the input gets focus */
    .term__input {
        font-size: 16px;
    }
}
```

- [ ] **Step 6: Write the script**

Create `assets/js/terminal.js`:

```js
// Terminal session in the content window (docs/superpowers/specs/2026-09-25-terminal-prompt-design.md).
// assets/js/terminal-core.js decides what a command does; this file owns the DOM: the scrollback of blocks,
// the prompt, fetching /terminal.json, and performing the actions a command returns.
(function () {
    var core = window.TerminalCore;
    var root = document.documentElement;
    var form = document.querySelector(".term__prompt");
    var scroll = document.querySelector(".page__content .win__scroll");
    if (!core || !form || !scroll) return;

    var input = form.querySelector(".term__input");
    var ps = form.querySelector(".term__ps");
    var winTitle = document.querySelector(".page__content > .win__title");
    var MAX_BLOCKS = 20;
    var HISTORY_KEY = "term-history";
    var storage = null;
    try { storage = window.sessionStorage; } catch (e) {}
    var past = core.loadHistory(storage, HISTORY_KEY);
    var pastIndex = past.length;
    var metas = new Map();   // page block -> the header details to restore when Back/Forward lands on it
    var dataPromise = null;
    var busy = false;
    var started = false;

    function home() {
        return form.getAttribute("data-home");
    }

    function homes() {
        return form.getAttribute("data-homes").trim().split(/\s+/);
    }

    function cwd() {
        return core.cwdFromPath(location.pathname, home());
    }

    function wait(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function reducedMotion() {
        return matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    // What the prompt can still do when /terminal.json cannot be fetched: cd through the header menu
    function fallbackData() {
        return {
            home: home(),
            langs: [],
            pages: Array.from(document.querySelectorAll(".main-nav a.nav-main-item")).map(function (link) {
                return { name: link.textContent.trim().toLowerCase(), url: new URL(link.href).pathname };
            }),
            posts: [],
            contact: [],
            neofetch: {},
            strings: {
                offline: form.getAttribute("data-offline"),
                enoent: form.getAttribute("data-enoent"),
                notfound: form.getAttribute("data-notfound")
            },
            offline: true
        };
    }

    function loadData() {
        if (!dataPromise) {
            dataPromise = fetch(form.getAttribute("data-json"))
                .then(function (response) {
                    if (!response.ok) throw new Error("terminal.json: " + response.status);
                    return response.json();
                })
                .catch(function (error) {
                    console.error("terminal:", error);
                    return fallbackData();
                });
        }
        return dataPromise;
    }

    function updatePrompt() {
        ps.textContent = core.promptString(cwd());
    }

    function makeBlock(url) {
        var block = document.createElement("section");
        block.className = "term__block";
        block.setAttribute("data-url", url);
        return block;
    }

    function appendBlock(block, align) {
        scroll.appendChild(block);
        var blocks = scroll.querySelectorAll(".term__block");
        for (var i = 0; i < blocks.length - MAX_BLOCKS; i++) {
            metas.delete(blocks[i]);
            blocks[i].remove();
        }
        block.scrollIntoView({ block: align || "end" });
    }

    function echo(line) {
        var p = document.createElement("p");
        p.className = "term__echo";
        var prompt = document.createElement("span");
        prompt.className = "term__ps";
        prompt.textContent = core.promptString(cwd());
        p.appendChild(prompt);
        p.appendChild(document.createTextNode(line));
        return p;
    }

    function textNode(value) {
        var pre = document.createElement("pre");
        pre.className = "term__out";
        pre.textContent = value;
        return pre;
    }

    function listNode(action) {
        var list = document.createElement("ul");
        list.className = "term__list" + (action.long ? " term__list--long" : "");
        action.items.forEach(function (item) {
            var li = document.createElement("li");
            var button = document.createElement("button");
            button.type = "button";
            button.className = "term__fill";
            button.setAttribute("data-fill", item.fill);
            button.textContent = item.label;
            li.appendChild(button);
            list.appendChild(li);
        });
        return list;
    }

    function linksNode(items) {
        var list = document.createElement("ul");
        list.className = "term__list";
        items.forEach(function (item) {
            var li = document.createElement("li");
            var link = document.createElement("a");
            link.href = item.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = item.label;
            li.appendChild(link);
            list.appendChild(li);
        });
        return list;
    }

    function neofetchNode(action) {
        var box = document.createElement("div");
        box.className = "term__neofetch";
        var art = document.createElement("pre");
        art.className = "term__art";
        art.setAttribute("aria-hidden", "true");
        art.textContent = action.art.join("\n");
        var facts = document.createElement("dl");
        var title = document.createElement("dt");
        title.textContent = action.title;
        facts.appendChild(title);
        facts.appendChild(document.createElement("dd"));
        action.rows.forEach(function (row) {
            var term = document.createElement("dt");
            term.textContent = row[0];
            var value = document.createElement("dd");
            value.textContent = row[1];
            facts.appendChild(term);
            facts.appendChild(value);
        });
        box.appendChild(art);
        box.appendChild(facts);
        return box;
    }

    // Header details that change from page to page
    function readMeta(doc) {
        var title = doc.querySelector(".page__content > .win__title");
        var branch = doc.querySelector(".head-branch");
        var langs = doc.querySelector(".lang-popup .win__body");
        return {
            path: null,
            title: doc.title,
            win: title ? title.textContent : "",
            branch: branch ? branch.textContent : "",
            active: Array.from(doc.querySelectorAll(".main-nav a.nav-main-item")).map(function (link) {
                return link.classList.contains("active");
            }),
            langs: langs ? langs.innerHTML : null
        };
    }

    function applyMeta(meta) {
        document.title = meta.title;
        if (winTitle) winTitle.textContent = meta.win;
        var branch = document.querySelector(".head-branch");
        if (branch) branch.textContent = meta.branch;
        document.querySelectorAll(".main-nav a.nav-main-item").forEach(function (link, index) {
            link.classList.toggle("active", !!meta.active[index]);
        });
        var langs = document.querySelector(".lang-popup .win__body");
        // same-origin, server-rendered markup of the language picker, not command output
        if (langs && meta.langs !== null) langs.innerHTML = meta.langs;
        updatePrompt();
    }

    // Replaced by in-place navigation in Task 5
    function navigate(url) {
        location.assign(url);
        return Promise.resolve(undefined);
    }

    function clearAll() {
        metas.clear();
        scroll.textContent = "";
    }

    // Keep only the current page's newest block, the way exit leaves a terminal back at the page
    function exitToPage() {
        var blocks = Array.from(scroll.querySelectorAll(".term__block"));
        var keep = null;
        for (var i = blocks.length - 1; i >= 0; i--) {
            if (metas.has(blocks[i]) && blocks[i].getAttribute("data-url") === location.pathname) {
                keep = blocks[i];
                break;
            }
        }
        blocks.forEach(function (block) {
            if (block !== keep) {
                metas.delete(block);
                block.remove();
            }
        });
        if (keep) keep.scrollIntoView({ block: "start" });
    }

    function perform(actions, block, data) {
        return actions.reduce(function (chain, action) {
            return chain.then(function () { return apply(action, block, data); });
        }, Promise.resolve());
    }

    function apply(action, block, data) {
        switch (action.type) {
        case "text":
            block.appendChild(textNode(action.text));
            break;
        case "list":
            block.appendChild(listNode(action));
            break;
        case "links":
            block.appendChild(linksNode(action.items));
            break;
        case "neofetch":
            block.appendChild(neofetchNode(action));
            break;
        case "navigate":
            return navigate(action.url, block).then(function (found) {
                if (found === false) {
                    block.appendChild(textNode(action.missing));
                    block.scrollIntoView({ block: "end" });
                }
            });
        case "clear":
            clearAll();
            return;
        case "exit":
            block.appendChild(textNode(action.text));
            return wait(500).then(exitToPage);
        case "theme":
            var option = document.querySelector('[data-palette-value="' + action.value + '"]');
            if (option) option.click();
            input.focus();
            break;
        case "lang":
            var link = document.querySelector('.lang-option[hreflang="' + action.value + '"]');
            if (link) location.assign(link.href);
            return;
        case "rmrf":
            // Task 6 adds the effect; until then it only prints the lines
            block.appendChild(textNode(action.lines.join("\n")));
            break;
        }
        block.scrollIntoView({ block: "end" });
    }

    function run(line) {
        busy = true;
        var block = makeBlock(location.pathname);
        block.appendChild(echo(line));
        appendBlock(block, "end");
        past = core.pushHistory(past, line);
        core.saveHistory(storage, HISTORY_KEY, past);
        pastIndex = past.length;
        return loadData()
            .then(function (data) {
                return perform(core.execute(line, { cwd: cwd(), data: data }), block, data);
            })
            .catch(function (error) {
                console.error("terminal:", error);
                block.appendChild(textNode(form.getAttribute("data-segfault")));
            })
            .then(function () { busy = false; });
    }

    // The page as loaded becomes the first block of the scrollback
    function wrapInitial() {
        var block = makeBlock(location.pathname);
        while (scroll.firstChild) block.appendChild(scroll.firstChild);
        scroll.appendChild(block);
        metas.set(block, readMeta(document));
    }

    function start() {
        if (started) return;
        started = true;
        wrapInitial();
        scroll.setAttribute("aria-live", "polite");
        updatePrompt();
        form.hidden = false;
        root.classList.add("term-ready");
        // Only on the home page and only with a mouse: on a phone this would pop up the keyboard
        if (form.hasAttribute("data-autofocus") && matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (busy) return;
        var line = input.value;
        input.value = "";
        run(line);
    });

    input.addEventListener("focus", loadData, { once: true });

    input.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            input.blur();
        } else if (event.key === "Tab") {
            if (!input.value.trim()) return;   // let Tab move focus on
            event.preventDefault();
            loadData().then(function (data) {
                var result = core.complete(input.value, cwd(), data);
                if (result.options.length) {
                    var block = makeBlock(location.pathname);
                    block.appendChild(echo(input.value));
                    block.appendChild(listNode({ long: false, items: result.options.map(function (option) {
                        return { label: option, fill: result.value.replace(/\S*$/, option) };
                    }) }));
                    appendBlock(block, "end");
                }
                input.value = result.value;
            });
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (pastIndex > 0) input.value = past[--pastIndex];
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            pastIndex = Math.min(past.length, pastIndex + 1);
            input.value = past[pastIndex] || "";
        }
    });

    // Tapping a name in ls output (or a completion option) puts it in the prompt
    scroll.addEventListener("click", function (event) {
        var fill = event.target.closest(".term__fill");
        if (!fill) return;
        input.value = fill.getAttribute("data-fill");
        input.focus();
    });

    // Wait for the typewriter (it rewraps the page's text), with a failsafe in case it never finishes
    var typing = root.classList.contains("typing") ||
        (root.classList.contains("typewriter") && !root.classList.contains("typed"));
    if (typing) {
        document.addEventListener("typewriter:done", start, { once: true });
        setTimeout(start, 4000);
    } else {
        start();
    }
})();
```

- [ ] **Step 7: Run the checks**

Run: `bash scripts/check-site.sh`
Expected: every line `ok`, exit 0.

- [ ] **Step 8: Try it in the browser**

`hugo serve --port 1313` in the background. Playwright MCP, window 1280×800, `http://localhost:1313/`:

1. The typewriter runs; then the prompt `guest@dario:~$` with placeholder `type help` appears at the bottom of the main window, and the input has focus (`document.activeElement.id === "term-input"`).
2. Type `help` + Enter: a block with `guest@dario:~$ help` and the command list appears; the window scrolls to it.
3. `ls` shows `whoami/ til/` as buttons; clicking `til/` fills `cd til` into the prompt.
4. `neofetch`, `whoami`, `contact`, `sudo make me a sandwich`, `vim`, `:q`, `rm foo`, `foo` each print what the spec table says.
5. `theme light` switches the palette and the header button reads `light`; `theme dark` switches back.
6. Type `ne` + Tab → `neofetch `; `c` + Tab lists `cd cat contact clear` in a block.
7. ↑ recalls the previous commands in order; ↓ walks back to an empty prompt.
8. `clear` empties the window; `exit` after a few commands prints `logout`, then leaves only the whoami block.
9. `cd til` loads `/til/` (a normal page load for now); the prompt there reads `guest@dario:~/til$` and has no focus.
10. **Early submit (Review Focus 4):** reload `/til/`, and immediately run in the page `document.querySelector('#term-input').value = 'help'; document.querySelector('.term__prompt').requestSubmit();` as soon as the form is visible. The block shows the help list, not `terminal: offline, try reloading`.
11. **Offline:** load `/til/` (no autofocus there, so `terminal.json` has not been fetched yet), run `window.fetch = () => Promise.reject(new Error('x'))` with `browser_evaluate`, then run `help` in the prompt: prints `terminal: offline, try reloading`; `cd whoami` still loads `/`.
12. Console has no errors except the deliberate one from step 11.

- [ ] **Step 9: Commit**

```bash
git add layouts/_default/baseof.html layouts/partials/head.html assets/js/typewriter.js assets/css/terminal.css assets/js/terminal.js scripts/check-site.sh
git commit -m "add the terminal prompt and scrollback to the content window"
```

---

### Task 5: In-place navigation

**Files:**
- Modify: `assets/js/terminal.js` (replace `navigate`, add link interception and `popstate`)
- Modify: `scripts/check-site.sh` (`terminal` group)

**Interfaces:**
- Consumes: from Task 4 `makeBlock`, `appendBlock`, `echo`, `metas`, `readMeta`, `applyMeta`, `home`, `homes`, `run`'s block flow; from Task 3 `core.isPagePath`, `core.cwdFromPath`.
- Produces: `navigate(url, block) → Promise<true | false | undefined>`: `true` appended in place, `false` the page is a 404 (caller prints the message), `undefined` fell back to a full page load. A module-level `currentPath` string.

- [ ] **Step 1: Write the failing checks**

Append to `group_terminal`:

```bash
    expect "terminal.js navigates in place" sh -c 'grep -q "history.pushState" assets/js/terminal.js && grep -q "popstate" assets/js/terminal.js && grep -q "DOMParser" assets/js/terminal.js'
    expect "terminal.js leaves modified clicks alone" grep -q "event.metaKey || event.ctrlKey || event.shiftKey || event.altKey" assets/js/terminal.js
```

Run: `bash scripts/check-site.sh terminal` → both FAIL, exit 1.

- [ ] **Step 2: Replace `navigate`**

In `assets/js/terminal.js`, add `var currentPath = location.pathname;` next to `var started = false;`, then replace the whole `// Replaced by in-place navigation in Task 5` function with:

```js
    // Fetch a page of this site and append its content window to `block`, like a terminal printing it.
    // Resolves true when appended, false on a 404 (the caller says so), undefined when it fell back to a page load.
    function navigate(url, block) {
        var target = new URL(url, location.href);
        function fullLoad() {
            location.assign(target.href);
            return undefined;
        }
        return fetch(target.href)
            .then(function (response) {
                if (response.status === 404) return false;
                if (!response.ok) throw new Error(target.pathname + ": " + response.status);
                return response.text().then(function (html) {
                    var doc = new DOMParser().parseFromString(html, "text/html");
                    var content = doc.querySelector(".page__content .win__scroll");
                    // A page that needs its own scripts (KaTeX) would not run them when appended
                    if (!content || !content.querySelector(".page__main") || content.querySelector("script")) return fullLoad();
                    // The boot log belongs to a fresh load only
                    content.querySelectorAll(".boot").forEach(function (boot) { boot.remove(); });
                    while (content.firstChild) block.appendChild(content.firstChild);
                    block.setAttribute("data-url", target.pathname);
                    var meta = readMeta(doc);
                    metas.set(block, meta);
                    history.pushState({ term: true }, "", target.pathname + target.search + target.hash);
                    currentPath = target.pathname;
                    applyMeta(meta);
                    block.scrollIntoView({ block: "start" });
                    return true;
                });
            })
            .catch(function (error) {
                console.error("terminal:", error);
                return fullLoad();
            });
    }
```

Note: the echo line inside the block was printed with the old cwd before `navigate` ran, which is what a terminal shows (`guest@dario:~$ cd til`); `applyMeta` then updates the prompt to `~/til`.

- [ ] **Step 3: Intercept links to this site's pages**

Add above the `// Wait for the typewriter` comment:

```js
    // Links to this language's pages append like `cd`; everything a normal link should do stays normal
    document.addEventListener("click", function (event) {
        if (!started || event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        var link = event.target.closest("a[href]");
        if (!link || link.target || link.hasAttribute("download") || link.closest(".lang-picker")) return;
        var url = new URL(link.href, location.href);
        if (url.origin !== location.origin) return;
        if (url.pathname === location.pathname && url.hash) return;   // an anchor on this page
        if (!core.isPagePath(url.pathname, home(), homes())) return;
        event.preventDefault();
        if (busy) return;
        busy = true;
        var line = "cd " + core.cwdFromPath(url.pathname, home());
        var block = makeBlock(location.pathname);
        block.appendChild(echo(line));
        appendBlock(block, "end");
        navigate(url.href, block).then(function (found) {
            if (found === false) block.appendChild(textNode("cd: " + form.getAttribute("data-enoent") + ": " + url.pathname));
            busy = false;
        });
    });

    // Back and Forward: show the matching page block again, or load the page if it has scrolled out
    window.addEventListener("popstate", function () {
        if (location.pathname === currentPath) return;   // only the #hash changed
        currentPath = location.pathname;
        var blocks = scroll.querySelectorAll(".term__block");
        for (var i = blocks.length - 1; i >= 0; i--) {
            if (metas.has(blocks[i]) && blocks[i].getAttribute("data-url") === location.pathname) {
                applyMeta(metas.get(blocks[i]));
                blocks[i].scrollIntoView({ block: "start" });
                return;
            }
        }
        location.reload();
    });
```

- [ ] **Step 4: Run the checks**

Run: `bash scripts/check-site.sh`
Expected: every line `ok`, exit 0.

- [ ] **Step 5: Try it in the browser**

`hugo serve --port 1313`, Playwright MCP at 1280×800, start at `http://localhost:1313/`:

1. `cd til`: a block `guest@dario:~$ cd til` followed by the TIL list appears under the whoami block; URL is `/til/`; tab title `today i learned – Dario Camargo`; window title `~/til`; header `git:(today_i_learned)` (same text as a fresh load of `/til/` shows — compare with it); `./til` is the active menu item; the prompt reads `guest@dario:~/til$`. Scrolling the window up shows the whoami bio.
2. `ls` lists slugs; `cat go-errgroup` appends the post; URL `/til/go-errgroup/`.
3. `cd ..` appends the TIL list again; `cd ~` appends the whoami bio **without** the boot log (`document.querySelectorAll('.term__block .boot').length === 1`, only the first block).
4. Click `./whoami` in the header, then a post in the sidebar's `latest_til`: both append (echo `cd ~` and `cd ~/til/<slug>`).
5. Browser Back three times: the URL, titles and active menu item follow, and the window scrolls to the matching block each time. Forward works too.
6. **KaTeX (Review Focus 2):** `cat using-katex` → a full page load (URL `/til/using-katex/`, only one `.term__block`), and `document.querySelectorAll('.katex').length > 0`.
7. **Links left alone (Review Focus 3):** on `/til/`, `browser_evaluate`: dispatch `new MouseEvent('click', {bubbles: true, cancelable: true, ctrlKey: true})` on the first post link and check the returned event was not `defaultPrevented` and no block was added. Then add `<a id="t" href="#x">x</a>` into the last block via `insertAdjacentHTML` and click it: no block added. Clicking the language picker's `pt` goes to `/pt/til/` with a fresh page (one block). The `LinkedIn` link in the sidebar opens in a new tab (it has `target`).
8. `cd nope` prints `cd: no such file or directory: nope` without fetching anything. For a real 404: insert `<a href="/til/nothing-here/">gone</a>` into the last block with `insertAdjacentHTML` and click it: the block shows `cd: no such file or directory: /til/nothing-here/` and the URL does not change.
9. Run `cd til` 25 times with a loop in `browser_evaluate` (set value, `requestSubmit()`, await 300ms each): at the end `document.querySelectorAll('.term__block').length === 20`.
10. Repeat 1–3 on `/pt/`: echo `cd til`, URL `/pt/til/`, Portuguese titles.
11. Console: no errors.

- [ ] **Step 6: Commit**

```bash
git add assets/js/terminal.js scripts/check-site.sh
git commit -m "navigate in place: append pages to the terminal scrollback"
```

---

### Task 6: `rm -rf /`

**Files:**
- Modify: `assets/js/terminal.js` (the `rmrf` case)
- Modify: `assets/css/terminal.css` (effect animations and the panic screen)
- Modify: `scripts/check-site.sh` (`terminal` group)

**Interfaces:**
- Consumes: from Task 4 `wait`, `reducedMotion`, `textNode`, `home`, `storage`, `HISTORY_KEY`, `root`; the `rmrf` action `{lines, panic}` from Task 3.
- Produces: nothing new for other tasks.

- [ ] **Step 1: Write the failing checks**

Append to `group_terminal`:

```bash
    expect "rm -rf has its effect styles" sh -c 'grep -q "\.term-rmrf" assets/css/terminal.css && grep -q "\.term__panic" assets/css/terminal.css'
    expect "the rm -rf animation is off under reduced motion" python3 -c "
css = open('assets/css/terminal.css').read()
start = css.index('prefers-reduced-motion: no-preference')
assert css.index('.term-rmrf .page__body .win') > start
"
```

Run: `bash scripts/check-site.sh terminal` → both FAIL, exit 1.

- [ ] **Step 2: Add the styles**

Append to `assets/css/terminal.css`:

```css
/* rm -rf /: the page flickers, the windows shake and fall one after another (--fall is each window's index),
   then .term__panic covers the screen until the home page reloads and the boot log plays again */
@media (prefers-reduced-motion: no-preference) {
    .term-rmrf .page {
        animation: term-flicker 0.12s steps(2) 8;
    }

    .term-rmrf .page__body .win {
        animation: term-shake 0.1s steps(2) 8, term-fall 0.9s ease-in forwards;
        animation-delay: 0s, calc(1s + var(--fall, 0) * 0.12s);
    }
}

@keyframes term-shake {
    from { transform: translate(-3px, 1px); }
    to   { transform: translate(3px, -1px); }
}

@keyframes term-flicker {
    from { filter: none; }
    to   { filter: invert(1) hue-rotate(90deg); }
}

@keyframes term-fall {
    to { transform: translateY(120vh) rotate(8deg); opacity: 0; }
}

.term__panic {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--gutter);
    font-family: var(--font-body);
    text-align: center;
    color: #e0e0e0;
    background: #000;
}
```

- [ ] **Step 3: Replace the `rmrf` case**

In `assets/js/terminal.js`, add this function above `function perform`:

```js
    // rm -rf /: print the removals, let the windows fall, panic, then reload the home page so the boot log plays
    function rmrf(action, block) {
        return action.lines.reduce(function (chain, line) {
            return chain.then(function () {
                block.appendChild(textNode(line));
                block.scrollIntoView({ block: "end" });
                return wait(80);
            });
        }, Promise.resolve()).then(function () {
            try { if (storage) storage.removeItem(HISTORY_KEY); } catch (e) {}
            if (reducedMotion()) return wait(600);
            input.blur();
            document.querySelectorAll(".page__body .win").forEach(function (win, index) {
                win.style.setProperty("--fall", index);
            });
            root.classList.add("term-rmrf");
            return wait(2200).then(function () {
                var panic = document.createElement("div");
                panic.className = "term__panic";
                panic.textContent = action.panic;
                document.body.appendChild(panic);
                return wait(1200);
            });
        }).then(function () {
            location.assign(home());
        });
    }
```

and replace the `case "rmrf":` block in `apply` (the two comment/`appendChild` lines and its `break;`) with:

```js
        case "rmrf":
            return rmrf(action, block);
```

`busy` stays true for the whole sequence because `run` only clears it after `perform` resolves, so the prompt ignores input meanwhile.

- [ ] **Step 4: Run the checks**

Run: `bash scripts/check-site.sh`
Expected: every line `ok`, exit 0.

- [ ] **Step 5: Try it in the browser**

Playwright MCP at 1280×800 on `http://localhost:1313/til/`:

1. Run `ls`, then `rm -rf /`. Take screenshots at ~0.5s (removal lines), ~1.8s (windows falling), ~3s (black `Kernel panic - not syncing: attempted to kill dario`). Around 4s the browser is on `/` and the boot log types again; `sessionStorage.getItem('term-history')` is `null`, so ↑ in the prompt recalls nothing.
2. `sudo rm -rf /` and `rm -fr ~` do the same; `rm -rf /tmp` prints `Permission denied`.
3. Pressing Enter with text in the prompt during the effect does nothing.
4. With `browser_emulate_media` `reducedMotion: "reduce"`: `rm -rf /` prints the lines, nothing shakes or falls, no panic screen, then `/` loads with no typing animation.
5. On `/pt/`: the panic text is Portuguese and the reload goes to `/pt/`.

- [ ] **Step 6: Commit**

```bash
git add assets/js/terminal.js assets/css/terminal.css scripts/check-site.sh
git commit -m "add the rm -rf / effect"
```

---

### Task 7: Whole-feature verification: mobile, no JavaScript, security

**Files:**
- Modify only if a check below fails; each fix gets its own commit with a message saying what broke.

**Interfaces:**
- Consumes: everything above.
- Produces: nothing new.

- [ ] **Step 1: Full check**

Run: `bash scripts/check-site.sh && node --test scripts/terminal-core.test.js && python3 scripts/check-translations.py`
Expected: all `ok`, `# fail 0`, `translations in sync`.

- [ ] **Step 2: Mobile (390×844)**

Playwright MCP, `browser_resize` 390×844, `http://localhost:1313/`:

1. After the boot, the prompt is fixed at the bottom of the viewport (`getBoundingClientRect().bottom` of `.term__prompt` equals `innerHeight` within 1px) and does **not** have focus.
2. Scroll to the end of the page: the last line of the bio is fully above the prompt (its `bottom` < the prompt's `top`).
3. `document.documentElement.scrollWidth === document.documentElement.clientWidth` and the same for `.page__body` (no horizontal overflow) after running `help`, `ls -l` in `~/til`, and `neofetch`.
4. The input's computed `font-size` is `16px`.
5. Tap `til/` in `ls` output: the prompt gets `cd til`.

- [ ] **Step 3: XSS (Review Focus 1)**

On `/`, run the command `<img src=x onerror=alert(1)>` and then `cat <svg onload=alert(1)>`. The output reads literally `zsh: command not found: <img` and `cat: <svg: no such file or directory`; `document.querySelectorAll('.term__block img, .term__block svg').length === 0`; no dialog opened.

- [ ] **Step 4: No JavaScript**

Playwright: `browser_run_code_unsafe` with `const ctx = await page.context().browser().newContext({ javaScriptEnabled: false }); const p = await ctx.newPage(); await p.goto('http://localhost:1313/'); return { prompt: await p.isVisible('.term__prompt'), bio: await p.isVisible('text=distributed backend systems'), boot: await p.isVisible('.boot') };`
Expected: `{ prompt: false, bio: true, boot: true }`. Header links navigate normally in that context (`/til/` loads).

- [ ] **Step 5: Screen reader basics**

On `/`: `document.querySelector('#term-input').getAttribute('aria-label')` is `terminal: type a command, help for the list`; `.win__scroll` has `aria-live="polite"`; the neofetch `<pre>` has `aria-hidden="true"`; after Esc in the prompt, Tab moves focus to the next focusable element (not trapped).

- [ ] **Step 6: Report**

Summarize for the human partner: what was verified, screenshots of desktop and mobile, anything that needed a fix. Do not push; ask first.
