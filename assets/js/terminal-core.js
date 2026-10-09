// The terminal prompt's logic, with no DOM: parsing, paths, completion, and what each command does, returned as
// a list of actions that assets/js/terminal.js performs. Unit tests: node --test scripts/terminal-core.test.js
(function () {
    var HELP = ["help", "ls", "cd", "pwd", "cat", "grep", "whoami", "neofetch", "contact", "theme", "lang", "clear", "exit"];
    // Without /terminal.json only these still work; the rest print the offline message
    var OFFLINE_OK = ["cd", "pwd", "clear", ":q", ":q!", ":wq"];
    var THEMES = ["dark", "light"];
    var RM_TARGETS = ["/", "/*", "~", "~/"];
    var REAL_CMDS = ["apt", "awk", "bash", "chown", "chmod", "cp", "curl", "df", "diff", "docker", "du", "echo", "find", "free", "grep", "head", "htop", "ifconfig", "ip", "kill", "less", "ln", "locate", "make", "mkdir", "mv", "netstat", "ping", "ps", "rmdir", "sed", "ssh", "systemctl", "tail", "tar", "top", "touch", "unzip", "wget", "zip"];
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
        if (cmd === "grep") {
            // only tags shared by more than one post are worth completing to; a one-off tag
            // would just dump you straight into that single post (cat is for that)
            var counts = {};
            data.posts.forEach(function (post) {
                post.tags.forEach(function (tag) { counts[tag] = (counts[tag] || 0) + 1; });
            });
            return Object.keys(counts).filter(function (tag) { return counts[tag] > 1; }).sort();
        }
        if (cmd === "cd") {
            var names = data.pages.map(function (page) { return page.name; });
            return cwd.indexOf("~/til") === 0 ? names.concat(slugs(data)) : names;
        }
        if (cmd === "theme") return THEMES;
        if (cmd === "lang") return data.langs;
        return [];
    }

    // Levenshtein distance, for "did you mean" on a mistyped command (only ever run on short words)
    function distance(a, b) {
        var prev = [];
        var i, j;
        for (j = 0; j <= b.length; j++) prev[j] = j;
        for (i = 1; i <= a.length; i++) {
            var row = [i];
            for (j = 1; j <= b.length; j++) {
                row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
            }
            prev = row;
        }
        return prev[b.length];
    }

    // The nearest candidate within edit distance 1 (words up to 3 chars) or 2, as a tappable suggestion line
    function suggest(word, candidates, label) {
        var max = word.length <= 3 ? 1 : 2;
        var best = null;
        var bestDistance = max + 1;
        candidates.forEach(function (candidate) {
            var d = distance(word.toLowerCase(), candidate.name.toLowerCase());
            if (d > 0 && d < bestDistance) {
                bestDistance = d;
                best = candidate;
            }
        });
        if (!best) return null;
        return { type: "list", long: false, items: [{ label: fmt(label, best.name), fill: best.fill }] };
    }

    // What an unknown line could have been: a command, or a page ("projetos" -> "cd projects" when typed bare)
    function suggestions(parsed, ctx) {
        var candidates = HELP.map(function (name) { return { name: name, fill: name }; });
        if (!parsed.args.length) {
            ctx.data.pages.forEach(function (page) { candidates.push({ name: page.name, fill: "cd " + page.name }); });
        }
        var hint = suggest(parsed.cmd, candidates, ctx.data.strings.suggest);
        if (hint && parsed.args.length) hint.items[0].fill += " " + parsed.args.join(" ");
        return hint;
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
            // a list, not a <pre>: every command name is a tappable button that fills the prompt
            return [{ type: "text", text: s.help_intro }, { type: "list", long: true, items: HELP.map(function (name) {
                return { label: pad(name, 10) + s["help_" + name], fill: name };
            }) }];
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
        pwd: function (args, ctx) {
            return [text(ctx.cwd)];
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
        grep: function (args, ctx) {
            var s = ctx.data.strings;
            if (!args.length) return [text(s.grep_usage)];
            var terms = args.map(function (arg) { return arg.toLowerCase(); });
            var hits = ctx.data.posts.filter(function (post) {
                var hay = (post.slug + " " + post.title + " " + post.tags.join(" ")).toLowerCase();
                return terms.every(function (term) { return hay.indexOf(term) !== -1; });
            });
            if (!hits.length) return [text(fmt(s.grep_none, args.join(" ")))];
            return [{ type: "list", long: true, items: hits.map(function (post) {
                return { label: post.date + "  " + post.slug + "  " + post.title, fill: "cat " + post.slug };
            }) }];
        },
        clear: function () {
            return [{ type: "clear" }];
        },
        exit: function (args, ctx) {
            return [{ type: "exit", text: ctx.data.strings.logout }];
        },
        whoami: function (args, ctx) {
            var page = ctx.data.pages.filter(function (p) { return p.name === "whoami"; })[0];
            return [{ type: "navigate", url: page ? page.url : "/", missing: "cd: " + ctx.data.strings.enoent + ": whoami" }];
        },
        neofetch: function (args, ctx) {
            var s = ctx.data.strings;
            var n = ctx.data.neofetch;
            return [{ type: "neofetch", title: s.neofetch_title, art: ART, rows: [
                [s.nf_host, "dario.dev.br"],
                [s.nf_stack, n.stack],
                [s.nf_location, n.location]
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
        var known = Object.prototype.hasOwnProperty.call(HANDLERS, parsed.cmd);
        // a bare section name (e.g. typing "til") works like "cd til", as long as it isn't already a command
        if (!known && !parsed.args.length && findBy(ctx.data.pages, "name", parsed.cmd)) {
            parsed = { cmd: "cd", args: [parsed.cmd] };
            known = true;
        }
        if (!known) {
            // a real shell command gets a shrug instead of a typo hint; anything else gets "did you mean"
            if (has(REAL_CMDS, parsed.cmd)) return [text(fmt(s.realcmd, parsed.cmd))];
            var out = [text(fmt(s.notfound, parsed.cmd))];
            var hint = suggestions(parsed, ctx);
            if (hint) out.push(hint);
            return out;
        }
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
