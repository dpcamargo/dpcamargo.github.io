// Copy button on markdown code blocks. The button itself is rendered per block by
// layouts/_default/_markup/render-codeblock.html; its labels live in data attributes filled
// from i18n at build time, so no user-facing string is hardcoded here.
(function () {
    var RESET_MS = 2000;

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        // http pages and older browsers: the hidden-textarea + execCommand fallback
        return new Promise(function (resolve, reject) {
            var area = document.createElement("textarea");
            area.value = text;
            area.setAttribute("readonly", "");
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();
            var ok = false;
            try { ok = document.execCommand("copy"); } catch (error) { reject(error); }
            area.remove();
            if (ok) resolve();
            else reject(new Error("copy rejected"));
        });
    }

    document.addEventListener("click", function (event) {
        var button = event.target.closest(".codeblock__copy");
        if (!button) return;
        var block = button.closest(".codeblock");
        var code = block && block.querySelector(".highlight pre code, pre code, pre");
        if (!code) return;
        copyText(code.textContent).then(function () {
            var original = button.getAttribute("data-label") || button.textContent;
            button.setAttribute("data-label", original);
            button.textContent = button.getAttribute("data-copied");
            clearTimeout(button._resetTimer);
            button._resetTimer = setTimeout(function () {
                button.textContent = original;
            }, RESET_MS);
        }).catch(function (error) {
            console.error("copy:", error);
        });
    });
})();
