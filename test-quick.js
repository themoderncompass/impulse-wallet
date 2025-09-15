/**
 * Quick Test Script for Impulse Wallet
 *
 * Runs essential tests quickly for development
 * Usage: npm run test:quick
 */

const { runRegressionTests } = require('./test-regression.js');

async function quickTest() {
  console.log('⚡ Running Quick Smoke Test...\n');

  const success = await runRegressionTests();

  if (success) {
    console.log('\n🎉 Quick test PASSED - All core functionality working!');
  } else {
    console.log('\n🚨 Quick test FAILED - Check issues above');
  }

  return success;
}

if (require.main === module) {
  quickTest()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Quick test crashed:', error);
      process.exit(1);
    });
}