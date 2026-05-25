"use strict";

(function (CH) {
  /**
   * Show an empty state with optional CTA button.
   * @param {HTMLElement} el - Container element
   * @param {string} message - Message to display
   * @param {string} [ctaText] - Button label
   * @param {Function} [ctaAction] - Button click handler
   */
  function showEmpty(el, message, ctaText, ctaAction) {
    if (!el) return;
    var html = '<div class="state-empty">';
    html += '<div class="state-empty-icon" aria-hidden="true">&#9744;</div>';
    html += '<p class="state-empty-message">' + CH.escapeHtml(message) + '</p>';
    if (ctaText && typeof ctaAction === "function") {
      html += '<button class="state-empty-cta" aria-label="' + CH.escapeHtml(ctaText) + '">';
      html += CH.escapeHtml(ctaText) + '</button>';
    }
    html += '</div>';
    el.innerHTML = html;
    if (ctaText && typeof ctaAction === "function") {
      var btn = el.querySelector(".state-empty-cta");
      if (btn) btn.addEventListener("click", ctaAction);
    }
  }

  /**
   * Show a skeleton loading state.
   * @param {HTMLElement} el - Container element
   * @param {number} [lines=4] - Number of skeleton lines
   */
  function showLoading(el, lines) {
    if (!el) return;
    var count = lines || 4;
    var html = '<div class="state-loading" role="status" aria-label="Loading">';
    html += '<span class="sr-only">Loading content...</span>';
    for (var i = 0; i < count; i++) {
      html += '<div class="skeleton-line"></div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  /**
   * Show an error state with optional retry button.
   * @param {HTMLElement} el - Container element
   * @param {string} message - Error message
   * @param {Function} [retryFn] - Retry click handler
   */
  function showError(el, message, retryFn) {
    if (!el) return;
    var html = '<div class="state-error" role="alert">';
    html += '<div class="state-error-icon" aria-hidden="true">&#9888;</div>';
    html += '<p class="state-error-message">' + CH.escapeHtml(message) + '</p>';
    if (typeof retryFn === "function") {
      html += '<button class="state-error-retry" aria-label="Retry">';
      html += 'Retry</button>';
    }
    html += '</div>';
    el.innerHTML = html;
    if (typeof retryFn === "function") {
      var btn = el.querySelector(".state-error-retry");
      if (btn) btn.addEventListener("click", retryFn);
    }
  }

  CH.showEmpty = showEmpty;
  CH.showLoading = showLoading;
  CH.showError = showError;
})(window.ControlHub);
