/**
 * Import Validation Script
 * Validates that all LAM system components can be imported correctly
 */

console.log('🔍 Validating LAM System Imports...');

const importResults = {
  lamSystem: false,
  lamCoreIntelligence: false,
  lamKnowledgeBase: false,
  lamFeedbackLoop: false,
  lamPatternSharing: false,
  baseAgent: false,
  policyLearner: false,
  riskAssessor: false,
  providerRouter: false
};

try {
  // Test LAM System
  const { LAMSystem } = await import('./lam-system.js');
  console.log('✅ LAM System imported successfully');
  importResults.lamSystem = true;
} catch (error) {
  console.error('❌ LAM System import failed:', error.message);
}

try {
  // Test LAM Core Intelligence
  const { LAMCoreService } = await import('./lam-core-intelligence.js');
  console.log('✅ LAM Core Intelligence imported successfully');
  importResults.lamCoreIntelligence = true;
} catch (error) {
  console.error('❌ LAM Core Intelligence import failed:', error.message);
}

try {
  // Test Knowledge Base
  const { LAMKnowledgeBase } = await import('./lam-knowledge-base.js');
  console.log('✅ LAM Knowledge Base imported successfully');
  importResults.lamKnowledgeBase = true;
} catch (error) {
  console.error('❌ LAM Knowledge Base import failed:', error.message);
}

try {
  // Test Feedback Loop
  const { LAMFeedbackLoop } = await import('./lam-feedback-loop.js');
  console.log('✅ LAM Feedback Loop imported successfully');
  importResults.lamFeedbackLoop = true;
} catch (error) {
  console.error('❌ LAM Feedback Loop import failed:', error.message);
}

try {
  // Test Pattern Sharing
  const { LAMPatternSharing } = await import('./lam-pattern-sharing.js');
  console.log('✅ LAM Pattern Sharing imported successfully');
  importResults.lamPatternSharing = true;
} catch (error) {
  console.error('❌ LAM Pattern Sharing import failed:', error.message);
}

try {
  // Test Base Agent
  const { LAMBaseAgent } = await import('./agents/base-agent.js');
  console.log('✅ LAM Base Agent imported successfully');
  importResults.baseAgent = true;
} catch (error) {
  console.error('❌ LAM Base Agent import failed:', error.message);
}

try {
  // Test Policy Learner
  const { PolicyLearnerAgent } = await import('./agents/policy-learner.js');
  console.log('✅ Policy Learner Agent imported successfully');
  importResults.policyLearner = true;
} catch (error) {
  console.error('❌ Policy Learner Agent import failed:', error.message);
}

try {
  // Test Risk Assessor
  const { RiskAssessorAgent } = await import('./agents/risk-assessor.js');
  console.log('✅ Risk Assessor Agent imported successfully');
  importResults.riskAssessor = true;
} catch (error) {
  console.error('❌ Risk Assessor Agent import failed:', error.message);
}

try {
  // Test Provider Router
  const { ProviderRouterAgent } = await import('./agents/provider-router.js');
  console.log('✅ Provider Router Agent imported successfully');
  importResults.providerRouter = true;
} catch (error) {
  console.error('❌ Provider Router Agent import failed:', error.message);
}

// Print summary
console.log('\n📊 Import Validation Summary:');
console.log('=============================');

const totalImports = Object.keys(importResults).length;
const successfulImports = Object.values(importResults).filter(Boolean).length;
const successRate = ((successfulImports / totalImports) * 100).toFixed(1);

for (const [component, success] of Object.entries(importResults)) {
  const status = success ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${component}`);
}

console.log('=============================');
console.log(`Total: ${totalImports}, Successful: ${successfulImports}, Failed: ${totalImports - successfulImports}`);
console.log(`Success Rate: ${successRate}%`);

if (successfulImports === totalImports) {
  console.log('🎉 All imports successful! LAM System is ready for use.');
} else {
  console.log('⚠️ Some imports failed. Please check the errors above.');
}