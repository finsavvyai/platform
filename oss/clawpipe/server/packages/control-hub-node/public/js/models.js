"use strict";

(function (CH) {
  async function loadModels() {
    try {
      var data = await CH.finsavvyProxy("gateway", "/v1/models");
      var models = data.data || [];
      CH.els.models.textContent = models.map(function (m) { return m.id; }).join("\n") || "No models";
      CH.els.kpiModels.textContent = String(models.length);
    } catch (err) {
      CH.els.models.textContent = CH.pretty({ error: err.message });
      CH.els.kpiModels.textContent = "--";
    }
  }

  async function loadModelOnNode() {
    var nodeUrl = CH.getSelectedNodeUrl();
    var modelId = (CH.els.nodeModelId.value || "").trim();
    var modelPath = (CH.els.nodeModelPath.value || "").trim();
    if (!nodeUrl || !modelId || !modelPath) {
      CH.els.nodeModelResult.textContent = CH.pretty({
        error: "nodeUrl, modelId, and modelPath are required.",
      });
      return;
    }

    CH.els.nodeModelResult.textContent = "Loading model...";
    try {
      var result = CH.expectProxySuccess(
        await CH.facadePost("/api/facade/node/model/load", { nodeUrl: nodeUrl, modelId: modelId, modelPath: modelPath }),
      );
      CH.els.nodeModelResult.textContent = CH.pretty(result.body ?? result);
      await CH.inspectNode();
      await CH.refreshAll();
    } catch (err) {
      CH.els.nodeModelResult.textContent = CH.pretty({ error: err.message, nodeUrl: nodeUrl, modelId: modelId });
    }
  }

  async function unloadModelOnNode() {
    var nodeUrl = CH.getSelectedNodeUrl();
    var modelId = (CH.els.nodeModelId.value || "").trim();
    if (!nodeUrl || !modelId) {
      CH.els.nodeModelResult.textContent = CH.pretty({
        error: "nodeUrl and modelId are required.",
      });
      return;
    }

    CH.els.nodeModelResult.textContent = "Unloading model...";
    try {
      var result = CH.expectProxySuccess(
        await CH.facadePost("/api/facade/node/model/unload", { nodeUrl: nodeUrl, modelId: modelId }),
      );
      CH.els.nodeModelResult.textContent = CH.pretty(result.body ?? result);
      await CH.inspectNode();
      await CH.refreshAll();
    } catch (err) {
      CH.els.nodeModelResult.textContent = CH.pretty({ error: err.message, nodeUrl: nodeUrl, modelId: modelId });
    }
  }

  CH.loadModels = loadModels;
  CH.loadModelOnNode = loadModelOnNode;
  CH.unloadModelOnNode = unloadModelOnNode;
})(window.ControlHub);
