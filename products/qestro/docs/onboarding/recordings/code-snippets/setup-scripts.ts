// Setup Script Generation Example
import { AutomatedSetupScriptsGenerator } from '../../backend/src/services/AutomatedSetupScriptsGenerator.js';

const scriptsGenerator = new AutomatedSetupScriptsGenerator();
const scriptPackage = await scriptsGenerator.generateSetupScriptPackage(
  configuration,
  profiles,
  { includeDatabaseScripts: true, includeMonitoring: true }
);

console.log('🔧 Generated Scripts:');
console.log(`- Total Scripts: ${scriptPackage.scripts.length}`);
console.log(`- Categories: ${scriptPackage.metadata.categories.join(', ')}`);