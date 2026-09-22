// The language picker is a <details>, so it opens and closes on its own. This adds the ways the palette
// popup also closes: Esc (focus returns to the button), a click outside, and tabbing out of it. Opening the
// palette popup counts as a click outside, so only one of the two is open at a time.
(function () {
    var picker = document.querySelector(".lang-picker");
    if (!picker) return;
    var summary = picker.querySelector("summary");

    function close() {
        picker.open = false;
    }

    document.addEventListener("click", function (event) {
        if (picker.open && !picker.contains(event.target)) close();
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && picker.open) {
            close();
            summary.focus();
        }
    });

    picker.addEventListener("focusout", function (event) {
        if (picker.open && event.relatedTarget && !picker.contains(event.relatedTarget)) close();
    });
})();
