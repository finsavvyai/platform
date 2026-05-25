// Configuration Management Example
import { IntelligentConfigurationManager } from '../../backend/src/services/IntelligentConfigurationManager.js';

const configManager = new IntelligentConfigurationManager();
const configs = await configManager.createOptimizedConfiguration(
  projectConfiguration,
  { performancePriority: true, securityPriority: true }
);

console.log('⚙️ Generated Configuration Profiles:');
configs.profiles.forEach(profile => {
  console.log(`- ${profile.environment}: ${Object.keys(profile.settings).length} settings`);
});