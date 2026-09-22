// Sidebar windows (status, connect, stack, latest_til) can be minimized to just their title bar. One
// delegated listener, so it needs no per-button wiring. Not persisted: every load starts expanded.
(function () {
    document.addEventListener("click", function (event) {
        var button = event.target.closest(".win__minimize");
        if (!button) return;
        var win = button.closest(".win");
        var body = win && win.querySelector(".win__body");
        if (!body) return;
        var expanded = button.getAttribute("aria-expanded") !== "false";
        button.setAttribute("aria-expanded", String(!expanded));
        body.hidden = expanded;
    });
})();
