/* DATTA — the only client-side script. Progressive enhancement; every page works without it. */
(function () {
  "use strict";
  var doc = document, body = doc.body;

  /* ---- analytics (privacy-conscious; only if a provider script is present) ---- */
  function track(name, props) {
    try {
      if (window.plausible) window.plausible(name, { props: props || {} });
      else if (window.umami && window.umami.track) window.umami.track(name, props || {});
    } catch (e) { /* never break the page for analytics */ }
  }
  doc.addEventListener("click", function (e) {
    var el = e.target.closest("[data-track]");
    if (el) track(el.getAttribute("data-track"), { project: el.getAttribute("data-project") || "", path: location.pathname });
  });

  /* ---- mobile menu ---- */
  var menuBtn = doc.querySelector("[data-menu-toggle]");
  var menu = doc.getElementById("mobile-menu");
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () {
      var open = body.hasAttribute("data-menu-open");
      if (open) { body.removeAttribute("data-menu-open"); menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); menuBtn.querySelector(".menu-label").textContent = menuBtn.getAttribute("data-label-menu") || menuBtn.querySelector(".menu-label").textContent; }
      else { body.setAttribute("data-menu-open", ""); menu.hidden = false; menuBtn.setAttribute("aria-expanded", "true"); menu.querySelector("a").focus(); }
    });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && body.hasAttribute("data-menu-open")) menuBtn.click(); });
  }

  /* ---- search (⌘K / Ctrl+K) ---- */
  var dialog = doc.getElementById("search");
  if (dialog && typeof dialog.showModal === "function") {
    var input = dialog.querySelector("[data-search-input]");
    var results = dialog.querySelector("[data-search-results]");
    var empty = dialog.querySelector("[data-search-empty]");
    var index = null, loading = null, active = -1;
    function load() {
      if (index) return Promise.resolve(index);
      if (!loading) loading = fetch(dialog.getAttribute("data-index")).then(function (r) { return r.json(); }).then(function (d) { index = d; return d; });
      return loading;
    }
    function open() { dialog.showModal(); input.value = ""; render([]); input.focus(); load().then(function () { render(search("")); }); track("search-open"); }
    function score(row, q) {
      if (!q) return row.type === "project" || row.type === "projects" ? 2 : 1;
      var s = 0, t = row.title.toLowerCase(), i = t.indexOf(q);
      if (i === 0) s += 10; else if (i > 0) s += 6;
      if ((row.summary || "").toLowerCase().indexOf(q) >= 0) s += 3;
      if ((row.category || "").toLowerCase().indexOf(q) >= 0) s += 2;
      if ((row.text || "").indexOf(q) >= 0) s += 1;
      return s;
    }
    function search(q) {
      q = q.trim().toLowerCase();
      var rows = (index || []).map(function (r) { return { r: r, s: score(r, q) }; }).filter(function (x) { return x.s > 0; });
      rows.sort(function (a, b) { return b.s - a.s; });
      return rows.slice(0, 12).map(function (x) { return x.r; });
    }
    function render(rows) {
      results.innerHTML = "";
      active = -1;
      rows.forEach(function (r) {
        var li = doc.createElement("li"), a = doc.createElement("a");
        a.href = new URL(r.path, new URL(dialog.getAttribute("data-index"), location.href)).href;
        var k = doc.createElement("span"); k.className = "mono"; k.textContent = (r.type === "projects" ? "project" : r.type).toUpperCase();
        var t = doc.createElement("span"); t.className = "search-result-title"; t.textContent = r.title;
        var s = doc.createElement("span"); s.className = "search-result-summary"; s.textContent = [r.summary, r.status].filter(Boolean).join(" · ");
        a.appendChild(k); a.appendChild(t); a.appendChild(s); li.appendChild(a); results.appendChild(li);
      });
      empty.hidden = rows.length > 0 || !index;
    }
    input.addEventListener("input", function () { load().then(function () { render(search(input.value)); }); });
    input.addEventListener("keydown", function (e) {
      var links = results.querySelectorAll("a");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!links.length) return;
        if (active >= 0) links[active].removeAttribute("data-active");
        active = e.key === "ArrowDown" ? (active + 1) % links.length : (active - 1 + links.length) % links.length;
        links[active].setAttribute("data-active", "");
        links[active].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && active >= 0) { e.preventDefault(); location.href = links[active].href; }
    });
    doc.querySelectorAll("[data-search-open]").forEach(function (b) { b.addEventListener("click", open); });
    doc.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dialog.open ? dialog.close() : open(); }
      if (e.key === "/" && !/input|textarea/i.test(doc.activeElement.tagName) && !dialog.open) { e.preventDefault(); open(); }
    });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
  }

  /* ---- index filter ---- */
  var filter = doc.querySelector("[data-index-filter]");
  var table = doc.querySelector("[data-index-table]");
  if (filter && table) {
    var rows = Array.prototype.slice.call(table.querySelectorAll("tbody tr"));
    var count = doc.querySelector("[data-index-count]");
    filter.addEventListener("input", function () {
      var q = filter.value.trim().toLowerCase(), n = 0;
      rows.forEach(function (tr) { var hit = !q || tr.textContent.toLowerCase().indexOf(q) >= 0; tr.hidden = !hit; if (hit) n++; });
      if (count) count.textContent = n;
    });
  }

  /* ---- contact form ---- */
  var form = doc.querySelector("[data-contact-form]");
  if (form) {
    var params = new URLSearchParams(location.search);
    var intent = params.get("intent");
    if (intent) { var radio = form.querySelector('input[name="intent"][value="' + intent + '"]'); if (radio) radio.checked = true; }
    var topic = form.querySelector("[data-topic]");
    if (topic) {
      var parts = [];
      if (params.get("project")) parts.push(params.get("project"));
      if (params.get("topic")) parts.push(params.get("topic"));
      if (parts.length && !topic.value) topic.value = parts.join(" · ");
    }
    var started = form.querySelector("[data-started]");
    if (started) started.value = String(Date.now());
    var endpoint = form.getAttribute("data-endpoint");
    var email = form.getAttribute("data-email");
    form.addEventListener("submit", function (e) {
      // Spam guard: honeypot filled, or submitted in under 3 seconds → drop silently.
      var hp = form.querySelector('input[name="website"]');
      var fast = started && Date.now() - Number(started.value) < 3000;
      if ((hp && hp.value) || fast) { e.preventDefault(); return; }
      var data = new FormData(form);
      var chosen = form.querySelector('input[name="intent"]:checked');
      track("contact-submit", { intent: chosen ? chosen.value : "" });
      if (endpoint) {
        e.preventDefault();
        var btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
          .then(function (r) { if (!r.ok) throw new Error(r.status); status(form.getAttribute("data-sent") || "Sent. Thank you — expect a reply within a few days."); form.reset(); })
          .catch(function () { status("Could not send. Please e-mail instead."); })
          .then(function () { btn.disabled = false; });
      } else if (email) {
        e.preventDefault();
        var subject = "[DATTA] " + (chosen ? chosen.value : "contact") + (data.get("topic") ? " — " + data.get("topic") : "");
        var bodyText = "Name: " + data.get("name") + "\nEmail: " + data.get("email") + "\nOrganization: " + (data.get("organization") || "") + "\n\n" + data.get("message");
        location.href = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(bodyText);
      } else {
        e.preventDefault();
        status("The form is not connected yet. Please use the links below.");
      }
    });
    function status(text) {
      var p = form.querySelector(".form-status");
      if (!p) { p = doc.createElement("p"); p.className = "form-status"; p.setAttribute("role", "status"); form.appendChild(p); }
      p.textContent = text;
    }
  }
})();
