"use strict";

window.ControlHub = window.ControlHub || {};

(function (CH) {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pretty(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function copyText(text) {
    var value = String(text || "");
    if (!value) return Promise.resolve(false);
    try {
      return navigator.clipboard.writeText(value).then(function () { return true; });
    } catch {
      return Promise.resolve(false);
    }
  }

  function setSelectOptions(el, options, emptyLabel) {
    var current = el.value;
    el.innerHTML = "";

    if (!options || options.length === 0) {
      var opt = document.createElement("option");
      opt.value = "";
      opt.textContent = emptyLabel;
      el.appendChild(opt);
      return;
    }

    for (var i = 0; i < options.length; i++) {
      var item = options[i];
      var opt = document.createElement("option");
      opt.value = item.value;
      opt.textContent = item.label;
      el.appendChild(opt);
    }

    if (current && options.some(function (item) { return item.value === current; })) {
      el.value = current;
    }
  }

  function renderList(container, items, mapper) {
    if (!items || items.length === 0) {
      container.innerHTML = '<div class="item"><div class="meta">No data</div></div>';
      return;
    }
    container.innerHTML = items.map(mapper).join("");
  }

  function focusInput(id) {
    var el = document.getElementById(id);
    if (!el || typeof el.focus !== "function") return;
    el.focus();
  }

  function toAgentOptions(rawBody) {
    var list = Array.isArray(rawBody)
      ? rawBody
      : Array.isArray(rawBody?.agents)
        ? rawBody.agents
        : Array.isArray(rawBody?.data)
          ? rawBody.data
          : Array.isArray(rawBody?.tools)
            ? rawBody.tools
            : [];
    var mapped = list
      .map(function (item) {
        if (typeof item === "string") {
          return { id: item, label: item };
        }
        if (!item || typeof item !== "object") return null;
        var id = item.agent || item.id || item.name || item.type;
        if (!id) return null;
        var label = item.name || item.label || id;
        return { id: String(id), label: String(label) };
      })
      .filter(Boolean);

    if (!mapped.some(function (x) { return x.id === "run"; })) {
      mapped.unshift({ id: "run", label: "run" });
    }
    var deduped = [];
    var seen = new Set();
    for (var i = 0; i < mapped.length; i++) {
      if (seen.has(mapped[i].id)) continue;
      seen.add(mapped[i].id);
      deduped.push(mapped[i]);
    }
    return deduped;
  }

  function toNodeOptions(rawBody) {
    var list = Array.isArray(rawBody)
      ? rawBody
      : Array.isArray(rawBody?.nodes)
        ? rawBody.nodes
        : Array.isArray(rawBody?.data)
          ? rawBody.data
          : [];
    return list
      .map(function (item) {
        if (!item || typeof item !== "object") return null;
        var id = item.id || item.node_id || item.name || item.host || "node";
        var status = item.status || item.state || "";
        var url = item.url || item.endpoint || item.worker_url || item.workerUrl || "";
        if (!url && item.host && item.port) {
          url = "http://" + item.host + ":" + item.port;
        }
        if (!url) return null;
        var label = status ? id + " (" + status + ")" : String(id);
        return { value: String(url), label: label };
      })
      .filter(Boolean);
  }

  function setStatus(text, isOk) {
    var el = CH.els.openclawStatus;
    el.textContent = text;
    el.className = "status " + (isOk ? "ok" : "err");
  }

  function setRuntimeMode(mode) {
    var normalized = mode === "local-facade" ? "local-facade" : "native";
    CH.state.runtimeMode = normalized;
    var label =
      normalized === "local-facade"
        ? "Compatibility Mode (LunaOS)"
        : "Native OpenClaw Mode";

    var chips = [CH.els.platformMode, CH.els.channelSetupMode].filter(Boolean);
    for (var i = 0; i < chips.length; i++) {
      chips[i].textContent = label;
      chips[i].classList.remove("local", "native");
      chips[i].classList.add(normalized === "local-facade" ? "local" : "native");
    }
  }

  function detectRuntimeMode(bootstrapResult) {
    var result = bootstrapResult || {};
    var sources = [
      result.channelTypes?.body?.mode,
      result.connections?.body?.mode,
      result.services?.body?.mode,
      result.agents?.body?.mode,
      result.providers?.body?.mode,
    ]
      .map(function (v) { return String(v || "").toLowerCase(); })
      .filter(Boolean);
    return sources.includes("local-facade") ? "local-facade" : "native";
  }

  CH.escapeHtml = escapeHtml;
  CH.pretty = pretty;
  CH.copyText = copyText;
  CH.setSelectOptions = setSelectOptions;
  CH.renderList = renderList;
  CH.focusInput = focusInput;
  CH.toAgentOptions = toAgentOptions;
  CH.toNodeOptions = toNodeOptions;
  CH.setStatus = setStatus;
  CH.setRuntimeMode = setRuntimeMode;
  CH.detectRuntimeMode = detectRuntimeMode;
})(window.ControlHub);
