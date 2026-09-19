(function () {
    var root = document.documentElement;
    var button = document.querySelector(".theme-toggle");
    var query = matchMedia("(prefers-color-scheme: light)");

    function stored() {
        try { return localStorage.getItem("theme"); } catch (e) { return null; }
    }

    function apply(theme) {
        root.setAttribute("data-theme", theme);
        if (button) {
            var label = "Switch to " + (theme === "light" ? "dark" : "light") + " mode";
            button.setAttribute("aria-label", label);
            button.setAttribute("title", label);
        }
    }

    apply(root.getAttribute("data-theme") === "light" ? "light" : "dark");

    if (button) {
        button.addEventListener("click", function () {
            var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
            apply(next);
            try { localStorage.setItem("theme", next); } catch (e) {}
        });
    }

    // Follow the OS until the visitor picks a theme themselves
    query.addEventListener("change", function (event) {
        if (!stored()) apply(event.matches ? "light" : "dark");
    });
})();
