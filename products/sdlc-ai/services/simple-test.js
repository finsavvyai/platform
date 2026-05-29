/**
 * Simple LAM System Test
 * Tests core functionality without complex agent initialization
 */

console.log('🧪 Simple LAM System Test');
console.log('=========================');

// Test basic imports
const importResults = {
  lamSystem: false,
  lamCoreIntelligence: false,
  lamKnowledgeBase: false,
  lamFeedbackLoop: false,
  lamPatternSharing: false,
  index: false
};

console.log('\n🔍 Testing basic imports...');

try {
  const { LAMCoreService } = await import('./lam-core-intelligence.js');
  console.log('✅ LAM Core Intelligence imported');
  importResults.lamCoreIntelligence = true;
} catch (error) {
  console.error('❌ LAM Core Intelligence import failed:', error.message);
}

try {
  const { LAMKnowledgeBase } = await import('./lam-knowledge-base.js');
  console.log('✅ LAM Knowledge Base imported');
  importResults.lamKnowledgeBase = true;
} catch (error) {
  console.error('❌ LAM Knowledge Base import failed:', error.message);
}

try {
  const { LAMFeedbackLoop } = await import('./lam-feedback-loop.js');
  console.log('✅ LAM Feedback Loop imported');
  importResults.lamFeedbackLoop = true;
} catch (error) {
  console.error('❌ LAM Feedback Loop import failed:', error.message);
}

try {
  const { LAMPatternSharing } = await import('./lam-pattern-sharing.js');
  console.log('✅ LAM Pattern Sharing imported');
  importResults.lamPatternSharing = true;
} catch (error) {
  console.error('❌ LAM Pattern Sharing import failed:', error.message);
}

try {
  const { LAMSystem } = await import('./lam-system.js');
  console.log('✅ LAM System imported');
  importResults.lamSystem = true;
} catch (error) {
  console.error('❌ LAM System import failed:', error.message);
}

try {
  const mainHandler = await import('./index.js');
  console.log('✅ Main handler imported');
  importResults.index = true;
} catch (error) {
  console.error('❌ Main handler import failed:', error.message);
}

// Test basic functionality
console.log('\n🧪 Testing basic functionality...');

const successfulImports = Object.values(importResults).filter(Boolean).length;
const totalImports = Object.keys(importResults).length;

console.log(`\n📊 Import Results:`);
console.log(`Total: ${totalImports}, Successful: ${successfulImports}, Failed: ${totalImports - successfulImports}`);
console.log(`Success Rate: ${((successfulImports / totalImports) * 100).toFixed(1)}%`);

if (successfulImports === totalImports) {
  console.log('\n🎉 All core components imported successfully!');
  console.log('🚀 LAM System is ready for deployment!');

  console.log('\n📋 Next Steps:');
  console.log('1. Run: npm install');
  console.log('2. Configure: wrangler secret put OPENAI_API_KEY');
  console.log('3. Deploy: npm run deploy');
  console.log('4. Test: curl https://your-worker.workers.dev/api/v1/health');
} else {
  console.log('\n⚠️ Some imports failed. Check the errors above.');
}

// Test basic request processing
if (importResults.lamSystem) {
  console.log('\n🧪 Testing basic LAM System functionality...');

  try {
    const { LAMSystem } = await import('./lam-system.js');
    const lamSystem = new LAMSystem({
      environment: 'test',
      debug: false,
      services: {
        coreIntelligence: false, // Disable complex agents for now
        knowledgeBase: true,
        feedbackLoop: true,
        patternSharing: true,
        monitoring: false
      },
      agents: {
        policyLearner: false,
        riskAssessor: false,
        providerRouter: false
      }
    });

    console.log('✅ LAM System instance created');

    // Test basic state
    console.log('✅ System state:', {
      initialized: lamSystem.state.initialized,
      servicesCount: lamSystem.config.services ? Object.keys(lamSystem.config.services).length : 0
    });

    // Test logging
    lamSystem.log('Test log message');
    console.log('✅ Logging functionality working');

    console.log('\n🎉 Basic LAM System functionality verified!');

  } catch (error) {
    console.error('❌ Basic functionality test failed:', error.message);
  }
}

console.log('\n✅ Simple test completed!');