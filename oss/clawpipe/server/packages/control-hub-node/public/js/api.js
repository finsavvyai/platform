"use strict";

(function (CH) {
  async function openclawProxy(endpoint, method, payload) {
    method = method || "GET";
    var response = await fetch("/api/openclaw/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: CH.state.openclawBaseUrl,
        endpoint: endpoint,
        method: method,
        authMode: CH.state.authMode,
        authSecret: CH.state.authSecret,
        userId: CH.state.userId,
        payload: payload,
      }),
    });
    var data = await response.json();
    if (!data.ok) {
      throw new Error(data.body?.error || data.body?.message || "HTTP " + data.status);
    }
    return data.body;
  }

  async function finsavvyProxy(target, endpoint, method, payload) {
    method = method || "GET";
    var baseUrl = target === "master" ? CH.state.masterUrl : CH.state.gatewayUrl;
    var response = await fetch("/api/finsavvy/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: target, baseUrl: baseUrl, endpoint: endpoint, method: method, payload: payload }),
    });
    var data = await response.json();
    if (!data.ok) {
      throw new Error(data.body?.error || data.body?.message || "HTTP " + data.status);
    }
    return data.body;
  }

  async function facadePost(path, payload) {
    var response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    var data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid response from " + path);
    }
    if (!response.ok) {
      throw new Error(data?.error || "HTTP " + response.status);
    }
    return data;
  }

  function expectProxySuccess(result) {
    if (!result) throw new Error("Empty response");
    if (result.error) throw new Error(result.error);
    if (result.ok === false) {
      throw new Error(result.body?.error || result.body?.message || "HTTP " + result.status);
    }
    return result;
  }

  function saveConfig() {
    CH.state.openclawBaseUrl = (CH.els.openclawUrl.value || "").trim().replace(/\/+$/, "");
    CH.state.gatewayUrl = (CH.els.gatewayUrl.value || "").trim().replace(/\/+$/, "");
    CH.state.masterUrl = (CH.els.masterUrl.value || "").trim().replace(/\/+$/, "");
    CH.state.authMode = CH.els.authMode.value;
    CH.state.authSecret = CH.els.authSecret.value || "";
    CH.state.rememberAuthSecret = Boolean(CH.els.rememberAuthSecret.checked);
    CH.state.userId = CH.els.userId.value || "";
    localStorage.setItem(
      "control_hub_facade_config",
      JSON.stringify({
        openclawBaseUrl: CH.state.openclawBaseUrl,
        gatewayUrl: CH.state.gatewayUrl,
        masterUrl: CH.state.masterUrl,
        authMode: CH.state.authMode,
        authSecret: CH.state.rememberAuthSecret ? CH.state.authSecret : "",
        rememberAuthSecret: CH.state.rememberAuthSecret,
        userId: CH.state.userId,
      }),
    );
  }

  function loadConfig() {
    var raw = localStorage.getItem("control_hub_facade_config");
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        CH.state.openclawBaseUrl = parsed.openclawBaseUrl || "";
        CH.state.gatewayUrl = parsed.gatewayUrl || "";
        CH.state.masterUrl = parsed.masterUrl || "";
        CH.state.authMode = parsed.authMode || "none";
        CH.state.rememberAuthSecret = parsed.rememberAuthSecret === true;
        CH.state.authSecret = CH.state.rememberAuthSecret ? parsed.authSecret || "" : "";
        CH.state.userId = parsed.userId || "";
      } catch {
        // no-op
      }
    }

    fetch("/api/config/defaults")
      .then(function (r) { return r.json(); })
      .then(function (defaults) {
        if (!CH.state.openclawBaseUrl) CH.state.openclawBaseUrl = defaults.openclawBaseUrl || "";
        if (!CH.state.gatewayUrl) CH.state.gatewayUrl = defaults.gatewayUrl || "";
        if (!CH.state.masterUrl) CH.state.masterUrl = defaults.masterUrl || "";
        renderConfig();
      })
      .catch(function () { renderConfig(); });
  }

  function renderConfig() {
    CH.els.openclawUrl.value = CH.state.openclawBaseUrl || "";
    CH.els.gatewayUrl.value = CH.state.gatewayUrl || "";
    CH.els.masterUrl.value = CH.state.masterUrl || "";
    CH.els.authMode.value = CH.state.authMode || "none";
    CH.els.authSecret.value = CH.state.authSecret || "";
    CH.els.rememberAuthSecret.checked = CH.state.rememberAuthSecret === true;
    CH.els.userId.value = CH.state.userId || "";
  }

  async function loadServerHealth() {
    try {
      var response = await fetch("/api/health");
      if (!response.ok) return;
      var payload = await response.json();
      CH.state.dockerHelpersEnabled = payload?.dockerHelpersEnabled !== false;
      CH.renderOnboarding();
    } catch {
      // Keep previous defaults if health check fails.
    }
  }

  CH.openclawProxy = openclawProxy;
  CH.finsavvyProxy = finsavvyProxy;
  CH.facadePost = facadePost;
  CH.expectProxySuccess = expectProxySuccess;
  CH.saveConfig = saveConfig;
  CH.loadConfig = loadConfig;
  CH.renderConfig = renderConfig;
  CH.loadServerHealth = loadServerHealth;
})(window.ControlHub);
