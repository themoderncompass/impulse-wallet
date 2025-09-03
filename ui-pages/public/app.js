// ===== Beta Gate (V5 — persistent across refresh, www/apex, and late DOM) =====
(function betaGateV5() {
  const CODE   = "IWBETA25";         // your single valid code
  const LS_KEY = "iw.beta.ok";       // local flag

  // ----- cookie helpers (cover host + parent domain, https-safe) -----
  function _parentCookieDomain() {
    const h = location.hostname;
    const parts = h.split(".");
    if (parts.length < 2) return null;                 // e.g., localhost
    return "." + parts.slice(-2).join(".");            // themoderncompass.io, example.com, etc.
  }
  function _setBetaCookie(days = 400) {
    const exp = new Date(Date.now() + days*24*60*60*1000).toUTCString();
    const secure = location.protocol === "https:" ? "; Secure" : "";
    const base = `iw_beta=ok; expires=${exp}; path=/; SameSite=Lax${secure}`;

    // host-only
    document.cookie = base;
    // parent domain (survives www <-> apex hops)
    try {
      const pd = _parentCookieDomain();
      if (pd) document.cookie = `${base}; domain=${pd}`;
    } catch {}
  }
  function _clearBetaCookie() {
    const gone = "expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.cookie = `iw_beta=; ${gone}`;
    try {
      const pd = _parentCookieDomain();
      if (pd) document.cookie = `iw_beta=; ${gone}; domain=${pd}`;
    } catch {}
  }
  function _hasCookie() {
    return document.cookie.split(";").some(s => s.trim().startsWith("iw_beta=ok"));
  }

  // ----- access flags -----
  function hasAccess() {
    try { if (_hasCookie()) return true; } catch {}
    try { if (localStorage.getItem(LS_KEY)   === "1") return true; } catch {}
    try { if (sessionStorage.getItem(LS_KEY) === "1") return true; } catch {}
    return false;
  }
  function grantAccess() {
    try { localStorage.setItem(LS_KEY, "1"); } catch {}
    try { sessionStorage.setItem(LS_KEY, "1"); } catch {}
    _setBetaCookie();

    const panel = document.getElementById("beta-gate");
    if (panel) { try { panel.remove(); } catch { panel.hidden = true; panel.style.display = "none"; } }
    console.log("[beta] granted");
  }

  // ----- URL controls -----
  (function urlControls() {
    try {
      const url = new URL(location.href);
      if (url.searchParams.get("wipebeta") === "1") {
        _clearBetaCookie();
        try { localStorage.removeItem(LS_KEY); } catch {}
        try { sessionStorage.removeItem(LS_KEY); } catch {}
        console.warn("[beta] wiped local gate");
      }
      const p = (url.searchParams.get("beta") || "").trim().toUpperCase();
      if (p && p === CODE) {
        grantAccess();
        url.searchParams.delete("beta"); url.searchParams.delete("wipebeta");
        history.replaceState(null, "", url.toString());
        return; // done
      }
    } catch {}
  })();

  // If already unlocked, bail out before wiring anything.
  if (hasAccess()) { console.log("[beta] already unlocked"); return; }

  // ----- panel wiring -----
  function wirePanel() {
    const panel = document.getElementById("beta-gate");
    if (!panel) { console.error("[beta] panel missing"); return; }
    panel.hidden = false;

    const form  = panel.querySelector("#beta-form");
    const input = panel.querySelector("#beta-input");
    const btn   = panel.querySelector("#beta-submit");
    const err   = panel.querySelector("#beta-error");

    function unlock() {
      const val = (input?.value || "").trim().toUpperCase();
      if (!val) return;
      if (val === CODE) {
        grantAccess();
      } else {
        if (err) err.textContent = "That code did not match. Try again.";
        input?.focus(); input?.select();
      }
    }

    form?.addEventListener("submit", (e) => { e.preventDefault(); unlock(); });
    btn?.addEventListener("click",   (e) => { e.preventDefault(); unlock(); });
    input?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); unlock(); } });

    console.log("[beta] V5 wired, waiting for input…");
    setTimeout(() => input?.focus(), 0);

    // tiny debug helpers
    window.iwBeta = {
      status: () => ({
        cookie: _hasCookie(),
        ls: localStorage.getItem(LS_KEY) === "1",
        ss: sessionStorage.getItem(LS_KEY) === "1"
      }),
      grant: () => grantAccess(),
      wipe:  () => {
        _clearBetaCookie();
        try { localStorage.removeItem(LS_KEY); } catch {}
        try { sessionStorage.removeItem(LS_KEY); } catch {}
        console.warn("[beta] wiped");
      }
    };
  }

  // ---- robust wiring: handle late DOM, Safari races, SSR inserts ----
  let __betaWired = false;
  function wireOnce() {
    if (__betaWired) return true;
    const panel = document.getElementById("beta-gate");
    if (!panel) return false;
    __betaWired = true;
    wirePanel();
    return true;
  }
  function ensureWired() {
    if (wireOnce()) return;
    document.addEventListener("DOMContentLoaded", wireOnce, { once: true });
    window.addEventListener("load", wireOnce, { once: true });
    const mo = new MutationObserver(() => { if (wireOnce()) mo.disconnect(); });
    try { mo.observe(document.documentElement || document.body, { childList: true, subtree: true }); } catch {}
    let tries = 0; const t = setInterval(() => { if (wireOnce() || ++tries > 40) clearInterval(t); }, 50);
  }
  ensureWired();

  // ---- last-resort capture fallback so the button ALWAYS works ----
  function _captureSubmit(e) {
    if (!(e && e.target && e.target.id === "beta-form")) return;
    e.preventDefault();
    const input = document.getElementById("beta-input");
    const err   = document.getElementById("beta-error");
    const val = (input?.value || "").trim().toUpperCase();
    if (!val) return;
    if (val === CODE) {
      grantAccess();
    } else {
      if (err) err.textContent = "That code did not match. Try again.";
      input?.focus(); input?.select();
    }
  }
  window.addEventListener("submit", _captureSubmit, true);
  window.addEventListener("click", (e) => {
    const btn = document.getElementById("beta-submit");
    if (btn && e.target === btn) _captureSubmit({ preventDefault(){}, target: document.getElementById("beta-form") });
  }, true);

  console.log("[beta] fallback armed");
})();
