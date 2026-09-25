// Types out the content window on every page load. See assets/css/typewriter.css for how the pieces fit.
(function () {
    window.playTypewriter = function(target, onComplete) {
        var root = document.documentElement;
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
            if (onComplete) onComplete();
            return;
        }

        var MAX_MS = 1500;
        var CHARS_PER_SECOND = 80;
        var MATH_WAIT_MS = 1500;
        var UNITS = "img, hr, svg, .katex, .boot__swatches";
        var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/;
        var SKIP_EVENTS = ["keydown", "mousedown", "touchstart", "wheel"];

        var steps = [];
        var restores = [];
        var total = 0;
        var typed = 0;
        var next = 0;
        var cursor = null;
        var started = false;
        var done = false;
        var frameId = 0;
        var startTime = null;
        var duration = 0;

        function wrapText(node) {
            var text = node.nodeValue;
            if (!/\S/.test(text)) return;
            var fragment = document.createDocumentFragment();
            var spans = [];
            Array.from(text).forEach(function (character) {
                var span = document.createElement("span");
                span.className = "tw";
                span.textContent = character;
                var ws = /\s/.test(character);
                steps.push({ el: span, ws: ws, unit: false });
                if (!ws) total++;
                spans.push(span);
                fragment.appendChild(span);
            });
            node.parentNode.replaceChild(fragment, node);
            restores.push(function () {
                spans[0].parentNode.insertBefore(node, spans[0]);
                spans.forEach(function (span) { span.parentNode.removeChild(span); });
            });
        }

        function wrapUnit(el) {
            el.classList.add("tw");
            steps.push({ el: el, ws: false, unit: true });
            total++;
            restores.push(function () { el.classList.remove("tw", "on"); });
        }

        function walk(node) {
            var child = node.firstChild;
            while (child) {
                var following = child.nextSibling;
                if (child.nodeType === 3) {
                    wrapText(child);
                } else if (child.nodeType === 1 && !SKIP.test(child.tagName)) {
                    if (child.matches(UNITS)) wrapUnit(child);
                    else walk(child);
                }
                child = following;
            }
        }

        function revealTo(count) {
            while (next < steps.length && (typed < count || steps[next].ws)) {
                var step = steps[next++];
                step.el.classList.add("on");
                if (step.ws) continue;
                typed++;
                if (!step.unit) {
                    if (cursor) cursor.classList.remove("tw-cursor");
                    cursor = step.el;
                    cursor.classList.add("tw-cursor");
                }
            }
        }

        function finish() {
            if (done) return;
            done = true;
            cancelAnimationFrame(frameId);
            SKIP_EVENTS.forEach(function (name) { document.removeEventListener(name, finish); });
            if (started) {
                restores.forEach(function (restore) { restore(); });
                if (cursor) cursor.classList.remove("tw-cursor");
            }
            root.classList.remove("typing");
            root.classList.add("typed");
            if (onComplete) onComplete();
        }

        function frame(now) {
            if (startTime === null) startTime = now;
            var progress = duration > 0 ? Math.min(1, (now - startTime) / duration) : 1;
            revealTo(Math.ceil(total * progress));
            if (next >= steps.length) finish();
            else frameId = requestAnimationFrame(frame);
        }

        function start() {
            if (started || done) return;
            started = true;
            walk(target);
            duration = Math.min(MAX_MS, (total / CHARS_PER_SECOND) * 1000);
            root.classList.add("typewriter");
            root.classList.remove("typing");
            SKIP_EVENTS.forEach(function (name) {
                document.addEventListener(name, finish, { passive: true });
            });
            frameId = requestAnimationFrame(frame);
        }

        start();
    };

    var root = document.documentElement;
    if (!root.classList.contains("typing")) return;

    var target = document.querySelector(".page__content");
    if (!target) {
        root.classList.remove("typing");
        return;
    }

    var mathTimer = 0;
    function doStart() {
        clearTimeout(mathTimer);
        window.playTypewriter(target, function() {
            document.dispatchEvent(new CustomEvent("typewriter:done"));
        });
    }

    if (document.querySelector('script[src*="katex"]') && document.readyState !== "complete") {
        window.addEventListener("load", doStart);
        mathTimer = setTimeout(doStart, 1500);
    } else {
        doStart();
    }
})();
