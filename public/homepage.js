const HEALTH_CHECK_TIMEOUT_MS = 5000;

function initializeTheme(env) {
  const root = env.document?.documentElement;
  const toggle = env.document?.querySelector(".theme-toggle");
  const label = env.document?.querySelector(".theme-toggle__label");

  if (!root || !toggle || !label) {
    return;
  }

  function syncThemeUi(theme) {
    const nextTheme = theme === "dark" ? "light" : "dark";
    label.textContent = nextTheme === "dark" ? "Dark mode" : "Light mode";
    toggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
  }

  syncThemeUi(root.dataset.theme || "light");

  toggle.addEventListener("click", () => {
    const currentTheme = root.dataset.theme === "dark" ? "dark" : "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;
    env.localStorage?.setItem("theme-preference", nextTheme);
    syncThemeUi(nextTheme);
  });
}

function initializeHealthCheck(env) {
  const healthButton = env.document?.querySelector("[data-health-button]");
  const healthStatus = env.document?.querySelector("[data-health-status]");

  if (!healthButton || !healthStatus || typeof env.fetch !== "function") {
    return;
  }

  healthButton.addEventListener("click", async () => {
    const abortController = new env.AbortController();
    const timeoutId = env.setTimeout(() => {
      abortController.abort();
    }, HEALTH_CHECK_TIMEOUT_MS);

    healthButton.disabled = true;
    healthStatus.dataset.state = "loading";
    healthStatus.textContent = "Checking backend health...";

    try {
      const response = await env.fetch("/health", {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      const body = await response.json();
      const isHealthy = body?.status === "ok";

      healthStatus.dataset.state = isHealthy ? "success" : "error";
      healthStatus.textContent = isHealthy ? "Healthy" : "Unhealthy";
    } catch {
      healthStatus.dataset.state = "error";
      healthStatus.textContent = "Unhealthy";
    } finally {
      env.clearTimeout(timeoutId);
      healthButton.disabled = false;
    }
  });
}

function initializeHomepage(env = window) {
  initializeTheme(env);
  initializeHealthCheck(env);
}

if (typeof window !== "undefined") {
  initializeHomepage(window);
}

if (typeof module !== "undefined") {
  module.exports = {
    HEALTH_CHECK_TIMEOUT_MS,
    initializeHealthCheck,
    initializeHomepage,
    initializeTheme,
  };
}
