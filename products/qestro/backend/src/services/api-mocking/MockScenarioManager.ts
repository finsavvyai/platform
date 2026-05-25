/**
 * Mock Scenario Manager
 * Pre-built scenarios: happy path, errors, slow network, auth failures
 */

import { v4 as uuid } from 'uuid';
import { MockEndpoint, MockScenario } from './types.js';
import { ScenarioPresets } from './ScenarioPresets.js';
import { logger } from '../../utils/logger.js';

class MockScenarioManager {
  private scenarios: Map<string, MockScenario> = new Map();
  private activeScenario: Map<string, string> = new Map();

  async createScenario(projectId: string, name: string, endpoints: MockEndpoint[]): Promise<MockScenario> {
    const scenarioId = uuid();
    const scenario: MockScenario = {
      id: scenarioId,
      projectId,
      name,
      endpoints: endpoints.map((ep) => ({ ...ep, id: ep.id || uuid() })),
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.scenarios.set(scenarioId, scenario);
    logger.info(`Scenario created: ${name} (${scenarioId})`);
    return scenario;
  }

  async activateScenario(scenarioId: string, projectId: string): Promise<void> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error(`Scenario not found: ${scenarioId}`);
    if (scenario.projectId !== projectId) throw new Error('Scenario does not belong to project');
    this.activeScenario.set(projectId, scenarioId);
    scenario.isActive = true;
    scenario.updatedAt = new Date();
    logger.info(`Scenario activated: ${scenario.name}`);
  }

  async getScenarios(projectId: string): Promise<MockScenario[]> {
    return Array.from(this.scenarios.values()).filter((s) => s.projectId === projectId);
  }

  async getActiveScenario(projectId: string): Promise<MockScenario | null> {
    const scenarioId = this.activeScenario.get(projectId);
    if (!scenarioId) return null;
    return this.scenarios.get(scenarioId) || null;
  }

  async createHappyPathScenario(projectId: string): Promise<MockScenario> {
    return this.createScenario(projectId, 'Happy Path', ScenarioPresets.getHappyPath());
  }

  async createErrorScenario(projectId: string): Promise<MockScenario> {
    return this.createScenario(projectId, 'Error Responses', ScenarioPresets.getErrors());
  }

  async createSlowNetworkScenario(projectId: string): Promise<MockScenario> {
    return this.createScenario(projectId, 'Slow Network', ScenarioPresets.getSlowNetwork());
  }

  async createAuthFailureScenario(projectId: string): Promise<MockScenario> {
    return this.createScenario(projectId, 'Auth Failures', ScenarioPresets.getAuthFailure());
  }

  async deleteScenario(scenarioId: string): Promise<void> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error(`Scenario not found: ${scenarioId}`);
    if (this.activeScenario.get(scenario.projectId) === scenarioId) {
      this.activeScenario.delete(scenario.projectId);
    }
    this.scenarios.delete(scenarioId);
    logger.info(`Scenario deleted: ${scenario.name}`);
  }
}

export const mockScenarioManager = new MockScenarioManager();
