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
    pages: [{ name: "whoami", url: "/whoami/" }, { name: "til", url: "/til/" }],
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
    assert.deepEqual(core.resolveCd("whoami", "~/til", data), { url: "/whoami/" });
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
    assert.deepEqual(run("whoami"), [{ type: "navigate", url: "/whoami/", missing: "cd: no such file or directory: whoami" }]);
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
