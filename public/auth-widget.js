(function () {
  const ASSET_ID = "regicide-auth-widget";

  if (document.getElementById(ASSET_ID)) {
    return;
  }

  function ensureStylesheet() {
    const existingLink = document.querySelector('link[href$="auth-widget.css"]');
    if (existingLink) {
      if (existingLink.sheet) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        existingLink.addEventListener("load", resolve, { once: true });
        existingLink.addEventListener("error", resolve, { once: true });
        window.setTimeout(resolve, 800);
      });
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "auth-widget.css";
    document.head.appendChild(link);

    return new Promise((resolve) => {
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", resolve, { once: true });
      window.setTimeout(resolve, 800);
    });
  }

  async function loadWidgetHtml() {
    const response = await fetch("auth-widget.html", { cache: "no-cache" });

    if (!response.ok) {
      throw new Error("Could not load auth-widget.html");
    }

    return response.text();
  }

  async function buildWidget() {
    const root = document.createElement("div");
    root.id = ASSET_ID;
    root.className = "auth-root";
    root.dataset.mode = "signup";
   root.innerHTML = await loadWidgetHtml();
root.querySelector("[data-auth-overlay]").setAttribute("inert", "");

    document.body.appendChild(root);
    return root;
  }

  function formValues(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function initWidget(root) {
    const overlay = root.querySelector("[data-auth-overlay]");
    const forms = Array.from(root.querySelectorAll("[data-auth-form]"));
    const title = root.querySelector("[data-auth-title]");
    const kicker = root.querySelector("[data-auth-kicker]");
    const copy = root.querySelector("[data-auth-copy]");
    const switchButton = root.querySelector("[data-auth-switch]");
    const dialogTitle = root.querySelector("#authDialogTitle");
    let switchTimer = null;
    const headbar = root.querySelector(".auth-headbar");

    function setFormMessage(form, message, isError) {
      let el = form.querySelector(".auth-form-message");
      if (!el) {  
        el = document.createElement("p");
        el.className = "auth-form-message";
        form.appendChild(el);
      }
      el.textContent = message || "";
      el.classList.toggle("is-error", Boolean(isError));
    }

    function renderUser(user) {
      if (!headbar) return;

      if (!user) {
        headbar.innerHTML = `
          <button class="auth-headbar-button" type="button" data-auth-open="login">Login</button>
          <button class="auth-headbar-button" type="button" data-auth-open="signup">Signup</button>
        `;
        return;
      }

      headbar.innerHTML = `
        <span class="auth-user-chip">${user.username}</span>
        <button class="auth-headbar-button" type="button" data-auth-logout>Logout</button>
      `;
    }

    async function requestJson(url, payload) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Request failed.");
      }
      return data;
    }

    const messageByMode = {
      signup: {
        kicker: "Welcome back",
        title: "Previously here?",
        copy: "Step through the gilded gate and continue your campaign.",
        button: "Login",
      },
      login: {
        kicker: "New here",
        title: "Welcome to the game",
        copy: "Create your account and claim a place at the board.",
        button: "Signup",
      },
    };

    function applyMode(mode) {
      const activeMode = mode === "login" ? "login" : "signup";
      const shouldAnimate = root.dataset.mode && root.dataset.mode !== activeMode;
      const message = messageByMode[activeMode];

      if (shouldAnimate) {
        window.clearTimeout(switchTimer);
        root.classList.remove("is-switching");
        root.offsetHeight;
        root.classList.add("is-switching");
        switchTimer = window.setTimeout(() => {
          root.classList.remove("is-switching");
        }, 520);
      }

      root.dataset.mode = activeMode;

      forms.forEach((form) => {
        form.classList.toggle("is-active", form.dataset.authForm === activeMode);
      });

      kicker.textContent = message.kicker;
      title.textContent = message.title;
      copy.textContent = message.copy;
      switchButton.textContent = message.button;
      dialogTitle.textContent = activeMode === "login" ? "Login" : "Create Account";
    }

    function open(mode) {
      root.querySelector("[data-auth-overlay]").removeAttribute("inert");
      applyMode(mode);
      root.classList.add("is-open");
      document.body.style.overflow = "hidden";
      const activeInput = root.querySelector(".auth-form.is-active input");
      if (activeInput) {
        window.setTimeout(() => activeInput.focus(), 240);
      }
    }

    function close() {
      root.classList.remove("is-open");
      document.body.style.overflow = "";
      root.querySelector("[data-auth-overlay]").setAttribute("inert", "");
    }

    root.addEventListener("click", (event) => {
      const openButton = event.target.closest("[data-auth-open]");
      const closeButton = event.target.closest("[data-auth-close]");
      const switchModeButton = event.target.closest("[data-auth-switch]");
      const logoutButton = event.target.closest("[data-auth-logout]");

      if (openButton) {
        open(openButton.dataset.authOpen);
      }

      if (closeButton) {
        close();
      }

      if (switchModeButton) {
        applyMode(root.dataset.mode === "signup" ? "login" : "signup");
        const activeInput = root.querySelector(".auth-form.is-active input");
        if (activeInput) {
          window.setTimeout(() => activeInput.focus(), 260);
        }
      }

      if (logoutButton) {
        requestJson("/api/auth/logout")
          .then(() => {
            renderUser(null);
            window.dispatchEvent(new CustomEvent("regicide:auth", { detail: { user: null } }));
          })
          .catch(() => {});
      }

      if (event.target === overlay) {
        close();
      }
    });

    root.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-auth-form]");
      if (!form) {
        return;
      }

      event.preventDefault();
      const mode = form.dataset.authForm;
      const detail = formValues(form);
      const submitButton = form.querySelector("button[type='submit']");
      const originalText = submitButton ? submitButton.textContent : "";

      try {
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = mode === "signup" ? "Creating..." : "Logging in...";
        }

        const data = await requestJson(`/api/auth/${mode}`, detail);
        renderUser(data.user);
        setFormMessage(form, "", false);
        root.dispatchEvent(new CustomEvent(`regicide:${mode}`, { detail: data, bubbles: true }));
        window.dispatchEvent(new CustomEvent("regicide:auth", { detail: data }));
        close();
      } catch (err) {
        setFormMessage(form, err.message, true);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && root.classList.contains("is-open")) {
        close();
      }
    });

    window.RegicideAuth = {
      open,
      close,
      showLogin: () => open("login"),
      showSignup: () => open("signup"),
    };

    applyMode("signup");

    fetch("/api/auth/me")
      .then(response => response.json())
      .then(data => renderUser(data.user))
      .catch(() => renderUser(null));
  }

  async function start() {
    await ensureStylesheet();
    initWidget(await buildWidget());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
