/**
 * Pipeline factory — creates a shared ClawPipe instance for the MCP server.
 */

import { ClawPipe, Booster, Packer, Telemetry } from 'clawpipe-ai';
import type { ClawPipeConfig } from 'clawpipe-ai';

export interface PipelineContext {
  client: ClawPipe;
  booster: Booster;
  packer: Packer;
  telemetry: Telemetry;
}

export function createPipeline(apiKey: string, projectId: string): PipelineContext {
  const config: ClawPipeConfig = {
    apiKey,
    projectId,
    enableBooster: true,
    enablePacker: true,
    enableCache: true,
    enableTrace: true,
  };

  const client = new ClawPipe(config);
  const booster = new Booster();
  const packer = new Packer();
  const telemetry = new Telemetry();

  return { client, booster, packer, telemetry };
}
