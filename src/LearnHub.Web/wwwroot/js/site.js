// LearnHub client-side enhancements. Everything here is progressive: the app works without JavaScript.
(function () {
    "use strict";

    // Ask before submitting destructive forms.
    document.querySelectorAll("form[data-confirm]").forEach(form => {
        form.addEventListener("submit", e => {
            if (!window.confirm(form.dataset.confirm)) e.preventDefault();
        });
    });

    // Filters that apply as soon as they change.
    document.querySelectorAll("select[data-autosubmit]").forEach(select => {
        select.addEventListener("change", () => select.form.submit());
    });

    // Selects whose option values are URLs (grading screen student switcher).
    document.querySelectorAll("select[data-nav-select]").forEach(select => {
        select.addEventListener("change", () => { window.location.href = select.value; });
    });

    // Show / hide password.
    document.querySelectorAll("[data-toggle-password]").forEach(btn => {
        btn.addEventListener("click", () => {
            const input = btn.parentElement.querySelector("input");
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
            btn.innerHTML = show ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
        });
    });

    // Demo environment: fill the sign-in form with a demo account.
    document.querySelectorAll("[data-demo-email]").forEach(btn => {
        btn.addEventListener("click", () => {
            const form = document.querySelector("form[action*='Login']");
            if (!form) return;
            form.querySelector("input[name='Email']").value = btn.dataset.demoEmail;
            form.querySelector("input[name='Password']").value = btn.dataset.demoPassword;
            form.querySelector("button[type=submit]").focus();
        });
    });

    // Live letter grade next to the score input.
    const letterFor = pct =>
        pct >= 93 ? "A" : pct >= 90 ? "A-" : pct >= 87 ? "B+" : pct >= 83 ? "B" : pct >= 80 ? "B-" :
        pct >= 77 ? "C+" : pct >= 73 ? "C" : pct >= 70 ? "C-" : pct >= 67 ? "D+" : pct >= 60 ? "D" : "F";
    document.querySelectorAll("[data-grade-input]").forEach(input => {
        const badge = document.querySelector("[data-grade-letter]");
        const max = Number(input.dataset.max);
        input.addEventListener("input", () => {
            const score = parseFloat(input.value);
            badge.textContent = isNaN(score) || score < 0 || score > max ? "–" : letterFor(score / max * 100);
        });
    });

    // Character counters for long text fields.
    document.querySelectorAll("textarea[data-counter]").forEach(area => {
        const max = area.getAttribute("maxlength") || area.dataset.valLengthMax;
        if (!max) return;
        const counter = document.createElement("div");
        counter.className = "char-counter";
        const update = () => counter.textContent = `${area.value.length} / ${max}`;
        area.insertAdjacentElement("afterend", counter);
        area.addEventListener("input", update);
        update();
    });

    // Reject oversized uploads before they are sent.
    document.querySelectorAll("input[type=file][data-max-mb]").forEach(input => {
        input.addEventListener("change", () => {
            const maxBytes = Number(input.dataset.maxMb) * 1024 * 1024;
            const file = input.files[0];
            if (file && file.size > maxBytes) {
                alert(`"${file.name}" is larger than ${input.dataset.maxMb} MB.`);
                input.value = "";
            }
        });
    });

    // Prevent double submits.
    document.querySelectorAll("form[method=post]").forEach(form => {
        form.addEventListener("submit", e => {
            if (e.defaultPrevented) return;
            if (window.jQuery && jQuery(form).data("validator") && !jQuery(form).valid()) return;
            form.querySelectorAll("button[type=submit]").forEach(b => setTimeout(() => b.disabled = true, 0));
        });
    });

    // Fade out success messages after a few seconds.
    document.querySelectorAll(".alert[data-autodismiss]").forEach(alert => {
        setTimeout(() => bootstrap.Alert.getOrCreateInstance(alert).close(), 6000);
    });
})();
