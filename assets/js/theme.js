(function () {
    var PALETTES = ["dark", "light"];
    var root = document.documentElement;
    var picker = document.querySelector(".palette-picker");
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

    function close() {
        if (picker) picker.open = false;
    }

    // theme_init.html already set the attribute before first paint; sync the button and options to it
    apply(valid(root.getAttribute("data-palette")) || "dark");

    if (picker && popup) {
        options.forEach(function (option) {
            option.addEventListener("click", function (event) {
                event.stopPropagation();
                var palette = option.getAttribute("data-palette-value");
                apply(palette);
                try { localStorage.setItem("palette", palette); } catch (e) {}
                close();
                if (button) button.focus();
            });
        });

        document.addEventListener("click", function (event) {
            if (picker.open && !picker.contains(event.target)) close();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && picker.open) {
                close();
                if (button) button.focus();
            }
        });

        picker.addEventListener("focusout", function (event) {
            if (picker.open && event.relatedTarget && !picker.contains(event.relatedTarget)) close();
        });
    }

    // Follow the OS until the visitor picks a palette themselves
    query.addEventListener("change", function (event) {
        if (!stored()) apply(event.matches ? "light" : "dark");
    });
})();
