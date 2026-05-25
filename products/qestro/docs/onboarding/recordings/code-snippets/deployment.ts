// Deployment Example
import { AIDeploymentService } from '../../backend/src/services/AIDeploymentService.js';

const deploymentService = new AIDeploymentService();
const strategies = await deploymentService.generateDeploymentStrategy({
  technologyStack,
  requirements,
  preferences: { cloudProvider: 'vercel' }
});

console.log('☁️ Deployment Strategies:');
strategies.forEach(strategy => {
  console.log(`- ${strategy.name}: $${strategy.estimatedCosts.monthly}/month`);
});