// Repository Analysis Example
import { RepositoryIntegrationService } from '../../backend/src/services/RepositoryIntegrationService.js';

const repositoryService = new RepositoryIntegrationService();

// Analyze a repository
const analysis = await repositoryService.connectAndAnalyze({
  repositoryUrl: 'https://github.com/example/react-app',
  provider: 'github',
  branch: 'main',
  accessToken: process.env.GITHUB_TOKEN
});

console.log('📊 Repository Analysis Results:');
console.log(`- Languages: ${analysis.metadata.language.join(', ')}`);
console.log(`- Frameworks: ${analysis.technology.frameworks.join(', ')}`);
console.log(`- Architecture: ${analysis.patterns.architecture}`);
console.log(`- Test Coverage: ${analysis.testing.testCoverage}%`);