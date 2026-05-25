(function () {
  const state = {
    recording: false,
    startedAt: 0,
    sessionId: null,
    listenersAttached: false,
    scrollTimer: null,
  };

  function safeSendMessage(payload) {
    chrome.runtime.sendMessage(payload, () => {
      void chrome.runtime.lastError;
    });
  }

  function cleanText(value, maxLength) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  function cssPath(element) {
    const segments = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && segments.length < 5) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${CSS.escape(current.id)}`;
        segments.unshift(selector);
        break;
      }

      if (current.classList.length > 0) {
        selector += `.${Array.from(current.classList).slice(0, 2).map((item) => CSS.escape(item)).join('.')}`;
      }

      const siblings = Array.from(current.parentElement?.children || []).filter(
        (node) => node.tagName === current.tagName,
      );

      if (siblings.length > 1) {
        selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }

      segments.unshift(selector);
      current = current.parentElement;
    }

    return segments.join(' > ');
  }

  function selectorForElement(element) {
    const candidates = [];
    const dataTestId = element.getAttribute('data-testid') || element.getAttribute('data-test') || element.getAttribute('data-cy');
    const ariaLabel = element.getAttribute('aria-label');

    if (element.id) {
      candidates.push(`#${CSS.escape(element.id)}`);
    }

    if (dataTestId) {
      candidates.push(`[data-testid="${dataTestId}"]`);
    }

    if (element.name) {
      candidates.push(`[name="${element.name}"]`);
    }

    if (ariaLabel) {
      candidates.push(`[aria-label="${ariaLabel}"]`);
    }

    if (['BUTTON', 'A'].includes(element.tagName)) {
      const text = cleanText(element.textContent, 60);
      if (text) {
        candidates.push(`${element.tagName.toLowerCase()}:has-text("${text.replace(/"/g, '\\"')}")`);
      }
    }

    candidates.push(cssPath(element));

    return {
      primary: candidates[0],
      fallbacks: candidates.slice(1),
    };
  }

  function attributesForElement(element) {
    return {
      tagName: element.tagName.toLowerCase(),
      type: element.getAttribute('type') || '',
      name: element.getAttribute('name') || '',
      placeholder: element.getAttribute('placeholder') || '',
      text: cleanText(element.textContent, 100),
    };
  }

  function maskValue(element, value) {
    if (element instanceof HTMLInputElement && element.type === 'password') {
      return '********';
    }

    return cleanText(value, 200);
  }

  function buildAction(type, element, extra) {
    return {
      type,
      timestamp: Date.now() - state.startedAt,
      selector: selectorForElement(element),
      element: attributesForElement(element),
      title: document.title,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      ...extra,
    };
  }

  function record(action) {
    if (!state.recording) {
      return;
    }

    safeSendMessage({
      type: 'questro:action-recorded',
      action,
    });
  }

  function handleClick(event) {
    const target = event.target instanceof Element ? event.target.closest('button, a, input, textarea, select, [role="button"], [data-testid], [name]') || event.target : null;
    if (!target) {
      return;
    }

    record(
      buildAction('click', target, {
        coordinates: { x: event.clientX, y: event.clientY },
      }),
    );
  }

  function handleInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }

    record(
      buildAction('input', target, {
        value: maskValue(target, target.value),
      }),
    );
  }

  function handleChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }

    record(
      buildAction('change', target, {
        value: maskValue(target, target.value),
      }),
    );
  }

  function handleSubmit(event) {
    const target = event.target;
    if (!(target instanceof HTMLFormElement)) {
      return;
    }

    record(buildAction('submit', target, {}));
  }

  function handleKeydown(event) {
    const trackedKeys = ['Enter', 'Tab', 'Escape'];
    if (!trackedKeys.includes(event.key)) {
      return;
    }

    const element = event.target instanceof Element ? event.target : document.body;
    record(
      buildAction('keydown', element, {
        key: event.key,
      }),
    );
  }

  function handleScroll() {
    if (state.scrollTimer) {
      clearTimeout(state.scrollTimer);
    }

    state.scrollTimer = window.setTimeout(() => {
      record(
        buildAction('scroll', document.body, {
          x: Math.round(window.scrollX),
          y: Math.round(window.scrollY),
        }),
      );
    }, 200);
  }

  function notifyPageContext() {
    safeSendMessage({
      type: 'questro:page-context',
      context: {
        url: window.location.href,
        title: document.title,
      },
    });
  }

  function recordNavigation(kind) {
    record(
      buildAction('navigation', document.body, {
        navigationType: kind,
        url: window.location.href,
      }),
    );
    notifyPageContext();
  }

  function attachListeners() {
    if (state.listenersAttached) {
      return;
    }

    state.listenersAttached = true;
    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('hashchange', () => recordNavigation('hashchange'));
    window.addEventListener('popstate', () => recordNavigation('popstate'));
  }

  function patchHistory() {
    if (window.__questroHistoryPatched) {
      return;
    }

    window.__questroHistoryPatched = true;

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function pushState() {
      const result = originalPushState.apply(this, arguments);
      recordNavigation('pushState');
      return result;
    };

    history.replaceState = function replaceState() {
      const result = originalReplaceState.apply(this, arguments);
      recordNavigation('replaceState');
      return result;
    };
  }

  function startRecording(session) {
    state.recording = true;
    state.startedAt = session.startedAt || Date.now();
    state.sessionId = session.sessionId || null;
    attachListeners();
    patchHistory();
    notifyPageContext();
  }

  function stopRecording() {
    state.recording = false;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'questro:start-recording') {
      startRecording(message.session || {});
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'questro:stop-recording') {
      stopRecording();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'questro:get-page-context') {
      sendResponse({
        ok: true,
        context: {
          url: window.location.href,
          title: document.title,
        },
      });
    }
  });

  attachListeners();
  patchHistory();
  notifyPageContext();
})();
