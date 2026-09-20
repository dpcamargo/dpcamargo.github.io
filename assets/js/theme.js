(function () {
    var PALETTES = ["dark", "light", "pink"];
    var root = document.documentElement;
    var button = document.getElementById("palette-btn");
    var popup = document.getElementById("palette-popup");
    var label = button && button.querySelector(".palette-btn__label");
    var options = popup ? popup.querySelectorAll("[data-palette-value]") : [];
    var query = matchMedia("(prefers-color-scheme: light)");

    function valid(value) {
        return PALETTES.indexOf(value) !== -1 ? value : null;
    }

    // The visitor's own choice, if any ("theme" is the key an older version of the site used)
    function stored() {
        try { return valid(localStorage.getItem("palette")) || valid(localStorage.getItem("theme")); } catch (e) { return null; }
    }

    function apply(palette) {
        root.setAttribute("data-palette", palette);
        if (label) label.textContent = palette;
        options.forEach(function (option) {
            option.setAttribute("aria-pressed", String(option.getAttribute("data-palette-value") === palette));
        });
    }

    function setOpen(open) {
        popup.hidden = !open;
        button.setAttribute("aria-expanded", String(open));
        if (open) {
            var current = popup.querySelector('[aria-pressed="true"]');
            if (current) current.focus();
        }
    }

    // theme_init.html already set the attribute before first paint; sync the button and options to it
    apply(valid(root.getAttribute("data-palette")) || "dark");

    if (button && popup) {
        button.addEventListener("click", function () {
            setOpen(popup.hidden);
        });

        options.forEach(function (option) {
            option.addEventListener("click", function () {
                var palette = option.getAttribute("data-palette-value");
                apply(palette);
                try { localStorage.setItem("palette", palette); } catch (e) {}
                setOpen(false);
                button.focus();
            });
        });

        document.addEventListener("click", function (event) {
            if (!popup.hidden && !popup.contains(event.target) && !button.contains(event.target)) setOpen(false);
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !popup.hidden) {
                setOpen(false);
                button.focus();
            }
        });
    }

    // Follow the OS until the visitor picks a palette themselves
    query.addEventListener("change", function (event) {
        if (!stored()) apply(event.matches ? "light" : "dark");
    });
})();
