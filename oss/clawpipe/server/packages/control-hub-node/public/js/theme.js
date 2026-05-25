"use strict";

(function (CH) {
  var THEME_KEY = "control_hub_theme";

  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function getSavedTheme() {
    return localStorage.getItem(THEME_KEY) || "";
  }

  function applyTheme(theme) {
    var resolved = theme || getSavedTheme() || getSystemTheme();
    document.documentElement.setAttribute("data-theme", resolved);
    return resolved;
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme") || getSystemTheme();
    var next = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    return applyTheme(next);
  }

  // Apply theme on load.
  applyTheme();

  // Listen for system theme changes.
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (!getSavedTheme()) applyTheme();
    });
  }

  CH.getSystemTheme = getSystemTheme;
  CH.getSavedTheme = getSavedTheme;
  CH.applyTheme = applyTheme;
  CH.toggleTheme = toggleTheme;
})(window.ControlHub);
