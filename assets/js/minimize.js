// Sidebar windows can be minimized to just their title bar, or closed entirely. Two delegated listeners, so
// neither needs per-button wiring. Neither is persisted: every load starts with every window open.
(function () {
    document.addEventListener("click", function (event) {
        var minimize = event.target.closest(".win__minimize");
        if (minimize) {
            var win = minimize.closest(".win");
            var body = win && win.querySelector(".win__body");
            if (!body) return;
            var expanded = minimize.getAttribute("aria-expanded") !== "false";
            minimize.setAttribute("aria-expanded", String(!expanded));
            body.hidden = expanded;
            return;
        }
        var close = event.target.closest(".win__close");
        if (close) {
            var target = close.closest(".win");
            if (target) target.hidden = true;
        }
    });
})();
