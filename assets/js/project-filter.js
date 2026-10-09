// Tech filter on the projects list (layouts/projects/list.html). The filter is driven by ?tech= in the
// URL, so the chips and the sidebar's stack links are ordinary shareable links — with JS off the page
// simply shows every project. Two integration points with the terminal's in-place navigation:
//   - chip clicks run in the capture phase and preventDefault, so terminal.js's link interceptor
//     (which skips events that are already defaultPrevented) leaves them alone and the filter happens
//     in place instead of appending a second copy of the list to the scrollback;
//   - terminal.js appends freshly fetched pages as raw HTML, so a MutationObserver re-applies the
//     filter whenever a new projects list lands in the scrollback.
(function () {
    var CARD = ".project__card";
    var CHIP = ".project__chip";

    function currentTech() {
        var match = /[?&]tech=([^&]*)/.exec(location.search);
        return match ? decodeURIComponent(match[1]).toLowerCase() : "";
    }

    // "java" matches a stack value of "Java 21" (prefix + word boundary), "go" matches only "Go",
    // never "MongoDB"
    function onStack(stack, tech) {
        return stack.split("|").some(function (value) {
            value = value.replace(/^\s+|\s+$/g, "");
            return value === tech || value.indexOf(tech + " ") === 0;
        });
    }

    function apply() {
        var tech = currentTech();
        document.querySelectorAll(CARD).forEach(function (card) {
            card.hidden = !!tech && !onStack((card.getAttribute("data-stack") || "").toLowerCase(), tech);
        });
        document.querySelectorAll(CHIP).forEach(function (chip) {
            if ((chip.getAttribute("data-tech") || "") === tech) chip.setAttribute("aria-current", "true");
            else chip.removeAttribute("aria-current");
        });
        // one message per projects list: shown only when that list has nothing left
        document.querySelectorAll(".project__empty").forEach(function (empty) {
            var body = empty.closest(".content__body");
            empty.hidden = !body || !!body.querySelector(CARD + ":not([hidden])");
        });
    }

    function filterTo(chip) {
        var tech = chip.getAttribute("data-tech") || "";
        var url = new URL(location.href);
        if (tech) url.searchParams.set("tech", tech);
        else url.searchParams.delete("tech");
        // replaceState: a filter is a view state of the same page, not a new history entry
        history.replaceState(null, "", url.pathname + url.search + url.hash);
        apply();
        // "select a tech" should land on the section itself: the pink title goes to the top of the window
        anchorTitle(titleNear(chip));
    }

    // The title of the projects section a chip belongs to (the scrollback can hold more than one)
    function titleNear(chip) {
        var scope = chip.closest(".term__block") || chip.closest(".win__scroll") || document;
        return scope.querySelector("h1");
    }

    // Whose scrollTop actually moves this element: .win__scroll on desktop, the stacked .page__body on
    // phones (where .win__scroll is overflow:visible)
    function scrollPaneFor(el) {
        for (var node = el.parentNode; node && node.nodeType === 1; node = node.parentNode) {
            if (/auto|scroll/.test(getComputedStyle(node).overflowY)) return node;
        }
        return null;
    }

    // Pin the pink title where a fresh page load shows it: at the top of the window, one pane inset
    // down. Delta math, not scrollIntoView — that aligns flush to the scroll port and lands the title a
    // different distance from the top depending on whether the filtered content is scrollable.
    function anchorTitle(title) {
        if (!title) return;
        var pane = scrollPaneFor(title);
        if (!pane) return;
        var inset = parseFloat(getComputedStyle(pane).paddingTop) || 0;
        pane.scrollTop += Math.round(title.getBoundingClientRect().top - pane.getBoundingClientRect().top - inset);
    }

    // Sidebar stack links select a tech through the terminal's in-place navigation, which appends the
    // fetched list under its "cd ~/projects" echo line and scrolls to that block start; when a tech is
    // active the freshly appended section gets the title anchoring instead, once per block
    function anchorAppended() {
        if (!currentTech()) return;
        var blocks = document.querySelectorAll(".term__block");
        var last = blocks[blocks.length - 1];
        if (!last || last.getAttribute("data-filter-anchored")) return;
        if (!last.querySelector(".project__filters")) return;
        last.setAttribute("data-filter-anchored", "1");
        anchorTitle(last.querySelector("h1"));
    }

    document.addEventListener("click", function (event) {
        var chip = event.target.closest(CHIP);
        if (!chip) return;
        event.preventDefault();
        filterTo(chip);
    }, true);

    apply();

    var scroll = document.querySelector(".win__scroll");
    new MutationObserver(function () {
        apply();
        anchorAppended();
    })
        .observe(scroll || document.body, { childList: true, subtree: true });
})();
