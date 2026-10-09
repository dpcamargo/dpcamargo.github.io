// Reconstructs mailto: links the sidebar (side_socials.html) marks up as data-email-user/domain
// base64 pairs instead of a plain mailto: href, so a scraper reading the static HTML never sees a
// harvestable email address as plain text. Runs unconditionally (unlike terminal.js, which only
// starts on pointer:fine devices) so the sidebar link works everywhere, JS-rendered or not.
(function () {
    document.querySelectorAll("[data-email-user][data-email-domain]").forEach(function (link) {
        var address = atob(link.getAttribute("data-email-user")) + "@" + atob(link.getAttribute("data-email-domain"));
        link.href = "mailto:" + address;
        link.removeAttribute("data-email-user");
        link.removeAttribute("data-email-domain");
    });
})();
