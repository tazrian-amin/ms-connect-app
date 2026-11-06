/*
 * The sign-in pages proxy.ts serves to visitors without access. Each is one self-contained HTML
 * document (inline styles and script, no Next.js bundles), so the app's JavaScript never has to
 * be served to anyone who has not signed in.
 */

export const LOCK_PAGE_PATH = "/locked";

const BASE_STYLES = `
  :root { color-scheme: light; --bg:#fafafa; --fg:#18181b; --muted:#6b7280; --panel:#ffffff; --border:#e5e7eb;
    --skeleton:#e5e7eb; --chrome:#191919; --primary:#ffc502; --danger:#b91c1c; --backdrop:rgba(250,250,250,.45); }
  :root.dark { color-scheme: dark; --bg:#09090b; --fg:#fafafa; --muted:#a1a1aa; --panel:#18181b; --border:#27272a;
    --skeleton:#27272a; --danger:#f87171; --backdrop:rgba(9,9,11,.5); }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--bg); color: var(--fg); }
  .dialog { width: min(100%, 400px); background: var(--panel); border: 1px solid var(--border); border-radius: 16px;
    padding: 28px; box-shadow: 0 24px 64px rgba(0,0,0,.25); }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; font-weight: 700; font-size: 1.125rem; }
  .brand img { width: 36px; height: 36px; border-radius: 8px; background: #fff; }
  h1 { margin: 0 0 6px; font-size: 1.25rem; }
  p { margin: 0 0 20px; color: var(--muted); font-size: .9375rem; line-height: 1.5; }
  label { display: block; font-size: .875rem; font-weight: 500; margin: 0 0 6px; }
  input { width: 100%; padding: 12px 14px; font: inherit; color: inherit; background: transparent;
    border: 1px solid var(--border); border-radius: 10px; outline: none; margin-bottom: 14px; }
  input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(255,197,2,.3); }
  .submit { width: 100%; padding: 12px; font: inherit; font-weight: 600; border: 0; border-radius: 10px;
    background: var(--primary); color: #000; cursor: pointer; }
  .submit:disabled { opacity: .6; cursor: default; }
  .secondary { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px;
    padding: 11px; border: 1px solid var(--border); border-radius: 10px; color: inherit; font-weight: 500;
    text-decoration: none; }
  .secondary:hover { border-color: var(--muted); }
  .secondary svg { width: 20px; height: 20px; fill: currentColor; }
  .password-field { position: relative; }
  .password-field input { padding-right: 48px; }
  .toggle { position: absolute; top: 4px; right: 4px; width: 40px; height: 40px; display: grid; place-items: center;
    padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--muted); cursor: pointer; }
  .toggle:hover { color: var(--fg); }
  .toggle:focus-visible { outline: 2px solid var(--primary); }
  .toggle svg { width: 22px; height: 22px; fill: currentColor; }
  /* The icon shows the field's current state: crossed-out eye while hidden, open eye while shown. */
  .toggle .show-icon, .toggle[aria-pressed="true"] .hide-icon { display: none; }
  .toggle[aria-pressed="true"] .show-icon { display: block; }
  .error { min-height: 1.25em; margin: 12px 0 0; color: var(--danger); font-size: .875rem; }
`;

// Follows the theme picked in the app (MUI keeps it in localStorage), else the system setting.
const THEME_SCRIPT = `
  (function () {
    var mode = null;
    try { mode = localStorage.getItem("mui-mode"); } catch (e) {}
    var dark = mode === "dark" || (mode !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  })();
`;

function htmlDocument(title: string, styles: string, body: string, script: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0a0a0a">
<title>${title}</title>
<link rel="icon" href="/favicon.ico">
<link rel="manifest" href="/manifest.webmanifest">
<script>${THEME_SCRIPT}</script>
<style>${BASE_STYLES}${styles}</style>
</head>
<body>
${body}
<script>${script}</script>
</body>
</html>`;
}

// Material "Visibility", "VisibilityOff" and "Home" icons, as in the app.
const SHOW_ICON = `<svg class="show-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5m0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3"/></svg>`;
const HIDE_ICON = `<svg class="hide-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7M2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2m4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3z"/></svg>`;
const HOME_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 5.69 5 4.5V18h-2v-6H9v6H7v-7.81zM12 3 2 12h3v8h6v-6h2v6h6v-8h3z"/></svg>`;

/** A password input with a button that shows what was typed. */
function passwordField(autofocus: boolean): string {
  return `<div class="password-field">
    <input id="password" name="password" type="password" autocomplete="current-password" required${autofocus ? " autofocus" : ""}>
    <button type="button" class="toggle" aria-label="Show password" aria-pressed="false" aria-controls="password">${SHOW_ICON}${HIDE_ICON}</button>
  </div>`;
}

// Shared by both pages: the password toggle, and posting the form as JSON with the server's
// error message shown on failure.
const FORM_SCRIPT = `
  document.querySelectorAll(".toggle").forEach(function (toggle) {
    var input = document.getElementById(toggle.getAttribute("aria-controls"));
    // Keeps the cursor in the field when the button is clicked.
    toggle.addEventListener("mousedown", function (event) { event.preventDefault(); });
    toggle.addEventListener("click", function () {
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(show));
      toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  function wireForm(form, endpoint, onSuccess) {
    var error = form.querySelector(".error");
    var button = form.querySelector(".submit");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      error.textContent = "";
      button.disabled = true;
      var body = {};
      new FormData(form).forEach(function (value, key) { body[key] = value; });
      fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (response) {
          if (response.ok) return onSuccess();
          return response.json().catch(function () { return {}; }).then(function (data) {
            error.textContent = data.error || "Something went wrong. Please try again.";
            button.disabled = false;
            var input = form.querySelector("#password");
            if (input) { input.select(); input.focus(); }
          });
        })
        .catch(function () {
          error.textContent = "You're offline. Connect to the internet to sign in.";
          button.disabled = false;
        });
    });
  }
`;

const LOCK_STYLES = `
  .placeholder { filter: blur(7px); pointer-events: none; user-select: none; min-height: 100vh; }
  .bar { height: 64px; background: var(--chrome); }
  .main { max-width: 1280px; margin: 0 auto; padding: 32px 24px; }
  .line { background: var(--skeleton); border-radius: 8px; }
  .grid { display: grid; gap: 16px; margin-top: 28px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 20px; height: 190px; }
  .tile { width: 48px; height: 48px; border-radius: 12px; background: var(--primary); opacity: .55; }
  .overlay { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; background: var(--backdrop); }
`;

const PLACEHOLDER_CARD = `<div class="card"><div class="tile"></div><div class="line" style="width:70%;height:16px;margin-top:20px"></div><div class="line" style="width:95%;height:12px;margin-top:12px"></div><div class="line" style="width:60%;height:12px;margin-top:8px"></div></div>`;

/** The password dialog over a blurred sketch of the app. Served at whatever URL was opened. */
export function lockPage(): string {
  return htmlDocument(
    "Sign in · MS Connect",
    LOCK_STYLES,
    `<div class="placeholder" aria-hidden="true">
  <div class="bar"></div>
  <div class="main">
    <div class="line" style="width:300px;max-width:80%;height:30px"></div>
    <div class="line" style="width:460px;max-width:95%;height:16px;margin-top:14px"></div>
    <div class="grid">${PLACEHOLDER_CARD.repeat(6)}</div>
  </div>
</div>
<div class="overlay">
  <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="title" novalidate>
    <div class="brand"><img src="/icons/icon.svg" alt="">MS Connect</div>
    <h1 id="title">Enter the access password</h1>
    <p>This site is private. Enter the password you were given to continue.</p>
    <label for="password">Password</label>
    ${passwordField(true)}
    <button type="submit" class="submit">Continue</button>
    <div class="error" role="alert"></div>
  </form>
</div>`,
    `${FORM_SCRIPT}
  // An installed app can land here with a valid cookie that its service worker has not seen yet
  // (for example right after an update); checking first skips the dialog in that case.
  fetch("/api/session", { cache: "no-store" }).then(function (response) {
    if (response.ok) location.reload();
  }).catch(function () {});
  wireForm(document.querySelector("form"), "/api/session", function () { location.reload(); });`,
  );
}

/** The admin sign-in form, served at /admin until the admin signs in. */
export function adminLoginPage(): string {
  return htmlDocument(
    "Admin sign in · MS Connect",
    `body { min-height: 100vh; display: grid; place-items: center; padding: 16px; }`,
    `<form class="dialog" novalidate>
  <div class="brand"><img src="/icons/icon.svg" alt="">MS Connect Admin</div>
  <h1>Sign in</h1>
  <p>Manage the website access password.</p>
  <label for="username">Username</label>
  <input id="username" name="username" autocomplete="username" required autofocus>
  <label for="password">Password</label>
  ${passwordField(false)}
  <button type="submit" class="submit">Sign in</button>
  <div class="error" role="alert"></div>
  <a class="secondary" href="/">${HOME_ICON}Go to home</a>
</form>`,
    `${FORM_SCRIPT}
  wireForm(document.querySelector("form"), "/api/admin/session", function () { location.reload(); });`,
  );
}
