(function () {
    var PALETTES = ["dark", "light"];
    var root = document.documentElement;
    var button = document.getElementById("palette-btn");
    var popup = document.getElementById("palette-popup");
    var label = button && button.querySelector(".palette-btn__label");
    var options = popup ? popup.querySelectorAll("[data-palette-value]") : [];
    var query = matchMedia("(prefers-color-scheme: light)");

    function valid(value) {
        if (value === "pink") value = "light";   // the pink palette was renamed light
        return PALETTES.indexOf(value) !== -1 ? value : null;
    }

    // The visitor's own choice, if any ("theme" is the key an older version of the site used)
    function stored() {
        try { return valid(localStorage.getItem("palette")) || valid(localStorage.getItem("theme")); } catch (e) { return null; }
    }

    function apply(palette) {
        root.setAttribute("data-palette", palette);
        options.forEach(function (option) {
            var active = option.getAttribute("data-palette-value") === palette;
            option.setAttribute("aria-pressed", String(active));
            // the option buttons carry the translated palette names, so the label needs no text of its own
            if (active && label) label.textContent = option.textContent;
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

        // A mouse press on the trigger is a toggle (its click handler), not focus leaving the popup
        var pressingButton = false;
        button.addEventListener("mousedown", function () { pressingButton = true; });
        document.addEventListener("mouseup", function () { pressingButton = false; });

        // Tabbing out of the popup closes it and leaves focus where the browser put it. A null relatedTarget
        // (window blur, a click on something unfocusable) is left to the click-outside handler above.
        popup.addEventListener("focusout", function (event) {
            var next = event.relatedTarget;
            if (popup.hidden || !next || popup.contains(next)) return;
            if (button.contains(next) && pressingButton) return;
            setOpen(false);
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
