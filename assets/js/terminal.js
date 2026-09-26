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
    var isLogin = false;
    var originalPromptHtml = ps.innerHTML;
    var originalPlaceholder = input.placeholder;

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
                    var code = document.createElement("code");
                    code.textContent = part.slice(1, -1);
                    p.appendChild(code);
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

    // Replaced by in-place navigation in Task 5
    function navigate(url) {
        location.assign(url);
        return Promise.resolve(undefined);
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
                block.scrollIntoView({ block: "end" });
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

    function forceFocus() {
        if (!window.getSelection().toString() && matchMedia("(pointer: fine)").matches) {
            input.focus({ preventScroll: true });
        }
    }

    function start() {
        if (started) return;
        started = true;
        wrapInitial();
        scroll.setAttribute("aria-live", "polite");
        form.hidden = false;
        root.classList.add("term-ready");
        forceFocus();
        document.addEventListener("click", forceFocus);
        // Only the home page's boot log is tall enough to need starting scrolled past the fold
        if (document.querySelector(".boot")) scroll.scrollTop = scroll.scrollHeight;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (busy) return;
        var line = input.value;
        input.value = "";
        if (isLogin) {
            if (line.trim().toLowerCase() === "login") {
                isLogin = false;
                root.classList.remove("term-locked");
                lockChrome(false);
                input.placeholder = originalPlaceholder;
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
                    appendBlock(block, "end");
                });
            }
            return;
        }
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
