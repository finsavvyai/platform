/**
 * Shared pipeline context for the VS Code extension.
 */

import * as vscode from 'vscode';
import { Booster, Packer, Telemetry } from 'clawpipe-ai';

export interface PipelineContext {
  booster: Booster;
  packer: Packer;
  telemetry: Telemetry;
  getApiKey: () => string;
  getProjectId: () => string;
}

export function createContext(): PipelineContext {
  const config = vscode.workspace.getConfiguration('clawpipe');

  return {
    booster: new Booster(),
    packer: new Packer(),
    telemetry: new Telemetry(),
    getApiKey: () => config.get<string>('apiKey', ''),
    getProjectId: () => config.get<string>('projectId', 'vscode-default'),
  };
}
