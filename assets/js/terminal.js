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
    var currentPath = location.pathname;
    var isLogin = false;
    var originalPromptHtml = ps.innerHTML;
    var originalPlaceholder = input.placeholder;
    // Touch (no fine pointer) runs the tap-driven terminal: commands are reached by clicking through
    // options, not typing. The bar keeps a tappable help button where the input would be.
    var tapMode = !matchMedia("(pointer: fine)").matches;
    var barChip = null;

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
                notfound: form.getAttribute("data-notfound"),
                suggest: form.getAttribute("data-suggest"),
                realcmd: form.getAttribute("data-realcmd")
            },
            offline: true
        };
    }

    function loadData() {
        if (!dataPromise) {
            // no-cache: terminal.json keeps a stable URL across deploys, so a returning visitor's cached
            // copy could be older than the fingerprinted JS asking for it (a new command would see
            // missing strings/data). Revalidate instead of serving from cache.
            dataPromise = fetch(form.getAttribute("data-json"), { cache: "no-cache" })
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
        // the prompt as it reads now, so earlier lines keep the page they were typed on
        var prompt = document.createElement("span");
        prompt.className = "term__ps";
        Array.from(ps.childNodes).forEach(function (node) { prompt.appendChild(node.cloneNode(true)); });
        p.appendChild(prompt);
        p.appendChild(document.createTextNode(" " + line));
        return p;
    }

    function textNode(value) {
        var pre = document.createElement("pre");
        pre.className = "term__out";
        pre.textContent = value;
        return pre;
    }

    function motdNode(value) {
        var div = document.createElement("div");
        div.className = "term__out term__motd";
        var paragraphs = value.split(/\n\n+/);
        paragraphs.forEach(function (para) {
            var p = document.createElement("p");
            var parts = para.split(/(`[^`]+`)/);
            parts.forEach(function (part) {
                if (part.charAt(0) === "`" && part.charAt(part.length - 1) === "`") {
                    var word = part.slice(1, -1);
                    // a backticked command (e.g. `help`) is clickable, like the help list; anything else stays plain code
                    if (core.HELP.indexOf(word) !== -1) {
                        var button = document.createElement("button");
                        button.type = "button";
                        button.className = "term__fill term__fill-inline";
                        button.setAttribute("data-fill", word);
                        var code = document.createElement("code");
                        code.textContent = word;
                        button.appendChild(code);
                        p.appendChild(button);
                    } else {
                        var plain = document.createElement("code");
                        plain.textContent = word;
                        p.appendChild(plain);
                    }
                } else if (part) {
                    p.appendChild(document.createTextNode(part));
                }
            });
            div.appendChild(p);
        });
        return div;
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
            li.appendChild(button);
            // when the label is "<fill><description>" (e.g. help's "ls    list pages..."), only the
            // command itself is the button (clickable and underlined); the description is plain,
            // inert text next to it
            if (item.label.indexOf(item.fill) === 0 && item.label.length > item.fill.length) {
                button.textContent = item.label.slice(0, item.fill.length);
                var desc = document.createElement("span");
                desc.className = "term__fill-desc";
                desc.textContent = item.label.slice(item.fill.length);
                li.appendChild(desc);
            } else {
                button.textContent = item.label;
            }
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
            if (item.url) {
                link.href = item.url;
                link.textContent = item.label;
                if (item.download) {
                    // a file to save (the CV PDFs), not a page to visit
                    link.setAttribute("download", item.download);
                } else {
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                }
            } else {
                // Obfuscated email entry (label + base64 user/domain, not a plain mailto: url): decode
                // here, at render time, so the address never sits as plain text in terminal.json.
                var address = atob(item.user) + "@" + atob(item.domain);
                link.href = "mailto:" + address;
                link.textContent = address;
            }
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
        var info = document.createElement("div");
        var title = document.createElement("p");
        title.className = "term__nf-title";
        title.textContent = action.title;
        var facts = document.createElement("dl");
        action.rows.forEach(function (row) {
            var term = document.createElement("dt");
            term.textContent = row[0];
            var value = document.createElement("dd");
            value.textContent = row[1];
            facts.appendChild(term);
            facts.appendChild(value);
        });
        info.appendChild(title);
        info.appendChild(facts);
        box.appendChild(art);
        box.appendChild(info);
        return box;
    }

    // Header details that change from page to page
    function readMeta(doc) {
        var title = doc.querySelector(".page__content > .win__title");
        var langs = doc.querySelector(".lang-popup .win__body");
        return {
            path: null,
            title: doc.title,
            win: title ? title.textContent : "",
            active: Array.from(doc.querySelectorAll(".main-nav a.nav-main-item")).map(function (link) {
                return link.classList.contains("active");
            }),
            langs: langs ? langs.innerHTML : null
        };
    }

    function applyMeta(meta) {
        document.title = meta.title;
        if (winTitle) winTitle.textContent = meta.win;
        var path = ps.querySelector(".term__path");
        if (path) path.textContent = cwd();
        document.querySelectorAll(".main-nav a.nav-main-item").forEach(function (link, index) {
            link.classList.toggle("active", !!meta.active[index]);
        });
        var langs = document.querySelector(".lang-popup .win__body");
        // same-origin, server-rendered markup of the language picker, not command output
        if (langs && meta.langs !== null) langs.innerHTML = meta.langs;
    }

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
                    // The page types itself out into the scrollback, the same signature effect as the
                    // boot log — but with the view left at the section's top and no auto-roll, so the
                    // reader scrolls down themselves
                    if (window.playTypewriter) window.playTypewriter(block);
                    return true;
                });
            })
            .catch(function (error) {
                console.error("terminal:", error);
                return fullLoad();
            });
    }

    function clearAll() {
        metas.clear();
        scroll.textContent = "";
    }

    // exit closes the sidebar windows and disables the language/theme buttons (mouse via .term-locked in
    // terminal.css, keyboard here); login reopens and re-enables them, same as a fresh page load.
    // whoami/projects/til and the language/theme buttons, while exit's fake login prompt is up
    var LOCKED_CONTROLS = ".nav-main-item, #palette-btn, .lang-picker > summary";

    // Closed sidebar windows, dimmed + tooltipped controls (terminal.css draws the tooltip from
    // data-locked-hint via ::before); the click blocker below is permanent and just checks term-locked.
    function lockChrome(locked) {
        document.querySelectorAll(".right__content > .win").forEach(function (win) { win.hidden = locked; });
        var hint = form.getAttribute("data-nav-locked");
        document.querySelectorAll(LOCKED_CONTROLS).forEach(function (el) {
            if (locked) {
                el.setAttribute("data-locked-hint", hint);
                el.setAttribute("aria-disabled", "true");
            } else {
                el.removeAttribute("data-locked-hint");
                el.removeAttribute("aria-disabled");
            }
        });
        var summary = document.querySelectorAll(".lang-picker > summary, .palette-picker > summary");
        summary.forEach(function (s) {
            if (locked) s.setAttribute("tabindex", "-1");
            else s.removeAttribute("tabindex");
        });
    }

    // A real click (mouse or keyboard) still reaches these controls under lockChrome — that's what lets them
    // stay hoverable for the tooltip instead of pointer-events:none. Swallow the click itself here, in the
    // capture phase so it runs before the palette toggle or the language <details>'s own default action.
    document.addEventListener("click", function (event) {
        if (!root.classList.contains("term-locked")) return;
        if (event.target.closest(LOCKED_CONTROLS)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

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
            return wait(500).then(function() {
                clearAll();
                ps.innerHTML = '<span class="head-text">dario.dev.br login:</span>';
                // where there is no bar chip to swap (a keyboard device), the login prompt carries
                // the way back itself
                if (barChip) setBarChip("login");
                else ps.appendChild(loginButton());
                input.placeholder = form.getAttribute("data-login-hint");
                root.classList.add("term-locked");
                lockChrome(true);
                if (winTitle) winTitle.textContent = "logged out";
                isLogin = true;
            });
        case "theme":
            var option = document.querySelector('[data-palette-value="' + action.value + '"]');
            if (option) option.click();
            input.focus({ preventScroll: true });
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

    function run(line, clicked) {
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
                block.scrollIntoView({ block: "end" });
            })
            .then(function () {
                // a touch result ends with the way back to the command menu
                if (clicked) appendMore(block, line);
                busy = false;
            });
    }

    // The page's own prose (e.g. the home motd) is static HTML; make any code span that names a
    // command (e.g. `help`, `whoami`) tappable like the rest of the terminal's fill buttons
    function makeProseCommandsClickable() {
        scroll.querySelectorAll("code").forEach(function (code) {
            var word = code.textContent.trim();
            if (core.HELP.indexOf(word) === -1 || code.parentNode.classList.contains("term__fill")) return;
            var button = document.createElement("button");
            button.type = "button";
            button.className = "term__fill term__fill-inline";
            button.setAttribute("data-fill", word);
            code.parentNode.insertBefore(button, code);
            button.appendChild(code);
        });
    }

    // The page as loaded becomes the first block of the scrollback
    function wrapInitial() {
        makeProseCommandsClickable();
        var block = makeBlock(location.pathname);
        while (scroll.firstChild) block.appendChild(scroll.firstChild);
        scroll.appendChild(block);
        metas.set(block, readMeta(document));
    }

    function forceFocus() {
        if (!window.getSelection().toString() && matchMedia("(pointer: fine)").matches) {
            input.focus({ preventScroll: true });
        }
    }

    // The bar chip (touch) is the always-there tappable help: "keep a clickable help on a fake terminal
    // so the user can click it to access the functions". While logged out it becomes the login button.
    function setBarChip(value) {
        if (!barChip) return;
        barChip.setAttribute("data-fill", value);
        barChip.textContent = value;
    }

    function setupTapBar() {
        input.hidden = true;
        barChip = document.createElement("button");
        barChip.type = "button";
        barChip.className = "term__fill term__tap";
        setBarChip("help");
        form.appendChild(barChip);
    }

    function helpOption() {
        return listNode({ long: false, items: [{ label: "help", fill: "help" }] });
    }

    // "Help must come back and show as an option for more navigation": on touch, every clicked output
    // ends with a tappable help row — except the command menu itself and screen-clearing commands.
    // The web version has the typing prompt instead and doesn't need the row.
    function appendMore(block, line) {
        var parsed = core.parse(line);
        if (parsed && (parsed.cmd === "help" || parsed.cmd === "clear" || parsed.cmd === "exit")) return;
        block.appendChild(helpOption());
    }

    // Clicking a command name sends it: a bare command that takes arguments (cd, cat, grep, ...)
    // first shows those arguments as more tappable options — "keep clicking until a result is
    // shown" — and anything already complete runs
    function clickCommand(value) {
        if (busy) return;
        if (isLogin) {
            if (String(value).trim().toLowerCase() === "login") login();
            return;
        }
        loadData().then(function (data) {
            var parsed = core.parse(value);
            if (parsed && !parsed.args.length && core.HELP.indexOf(parsed.cmd) !== -1) {
                var options = core.tapCandidates(parsed.cmd, cwd(), data);
                if (options.length) {
                    var block = makeBlock(location.pathname);
                    block.appendChild(echo(value));
                    block.appendChild(listNode({ long: false, items: options.map(function (option) {
                        return { label: option, fill: value + " " + option };
                    }) }));
                    if (tapMode) block.appendChild(helpOption());
                    appendBlock(block, "end");
                    return;
                }
            }
            run(value, tapMode);
        });
    }

    function start() {
        if (started) return;
        started = true;
        wrapInitial();
        scroll.setAttribute("aria-live", "polite");
        form.hidden = false;
        root.classList.add("term-ready");
        // Touch gets the fake terminal: the prompt bar stays, the typing input gives way to the
        // tappable help button, and every command is reached by clicking through options
        if (tapMode) setupTapBar();
        forceFocus();
        document.addEventListener("click", forceFocus);
        // Only the home page's boot log is tall enough to need starting scrolled past the fold
        if (document.querySelector(".boot")) scroll.scrollTop = scroll.scrollHeight;
    }

    // The fake login prompt's way back in: the bar chip on touch, a tappable login button in the
    // prompt itself where there is no bar chip, and the typed "login" everywhere
    function loginButton() {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "term__fill term__tap";
        button.setAttribute("data-fill", "login");
        button.textContent = "login";
        return button;
    }

    function login() {
        isLogin = false;
        root.classList.remove("term-locked");
        lockChrome(false);
        input.placeholder = originalPlaceholder;
        setBarChip("help");
        loadData().then(function (data) {
            clearAll();
            ps.innerHTML = originalPromptHtml;
            // The MOTD is the home page's welcome message, so relogin lands back home: same title,
            // path and nav state a real visit to "~" would show, without actually reloading the page.
            // The window title says "motd" (what's actually shown), not "boot" (the log we skip).
            history.replaceState(null, "", home());
            applyMeta({
                title: data.homeTitle || document.title,
                win: "motd",
                active: Array.from(document.querySelectorAll(".main-nav a.nav-main-item")).map(function () { return false; }),
                langs: null
            });
            var block = makeBlock(location.pathname);
            block.appendChild(motdNode(data.strings.motd));
            if (tapMode) block.appendChild(helpOption());
            appendBlock(block, "end");
        });
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (busy) return;
        var line = input.value;
        input.value = "";
        if (isLogin) {
            if (line.trim().toLowerCase() === "login") login();
            return;
        }
        run(line);
    });

    input.addEventListener("focus", loadData, { once: true });

    input.addEventListener("keydown", function (event) {
        if (event.ctrlKey && !event.metaKey && (event.key === "c" || event.key === "C")) {
            // ^C interrupts the line: the partial command is echoed with a caret C, like a real shell
            if (!input.value) return;
            event.preventDefault();
            var typed = input.value;
            input.value = "";
            pastIndex = past.length;
            if (isLogin || busy) return;
            var block = makeBlock(location.pathname);
            block.appendChild(echo(typed + "^C"));
            appendBlock(block, "end");
        } else if (event.ctrlKey && !event.metaKey && (event.key === "l" || event.key === "L")) {
            // ^L clears the screen, the same as typing clear
            event.preventDefault();
            if (isLogin || busy) return;
            input.value = "";
            pastIndex = past.length;
            clearAll();
        } else if (event.key === "Escape") {
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

    // Clicking a name in help/ls/grep output (or a completion option) sends it: a bare command that
    // takes arguments (cd, cat, grep, ...) first shows those arguments as more tappable options —
    // "keep clicking until a result is shown" — and anything already complete runs. The bar's
    // help/login chip is a .term__fill too, so one delegated handler covers the scrollback and the bar.
    document.addEventListener("click", function (event) {
        var fill = event.target.closest(".term__fill");
        if (!fill) return;
        clickCommand(fill.getAttribute("data-fill"));
    });

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
