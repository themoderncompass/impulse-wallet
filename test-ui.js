const puppeteer = require('puppeteer');

async function testUI() {
  console.log('🧪 Starting comprehensive UI test...');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    devtools: true   // Open dev tools
  });

  const page = await browser.newPage();

  // Listen for console messages and errors
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  try {
    // Navigate to your local app
    await page.goto('http://localhost:8788', { waitUntil: 'networkidle2' });

    console.log('📸 Page loaded, taking initial screenshot...');
    await page.screenshot({ path: 'screenshot-01-initial.png' });

    // Wait for page to settle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // === STEP 1: CREATE ROOM AND USER ===
    console.log('🏠 Creating new room and user...');

    const testName = `TestUser${Date.now()}`;
    const testRoom = `TEST${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Fill in user details
    await page.type('#name', testName);
    await page.type('#room', testRoom);

    console.log(`Creating room: ${testRoom} with user: ${testName}`);
    await page.screenshot({ path: 'screenshot-02-form-filled.png' });

    // Click create room
    await page.click('#create');

    // Wait for room creation and page transition
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: 'screenshot-03-room-created.png' });

    // === STEP 2: VERIFY ROOM INTERFACE LOADED ===
    console.log('🔍 Checking if room interface loaded...');

    const playSection = await page.$('#play');
    const playVisible = await page.evaluate(() => {
      const playEl = document.getElementById('play');
      return playEl && !playEl.classList.contains('hidden');
    });

    if (!playVisible) {
      console.error('❌ Room interface did not load properly');
      await page.screenshot({ path: 'screenshot-ERROR-room-not-loaded.png' });
      return;
    }

    console.log('✅ Room interface loaded successfully');

    // === STEP 3: TEST BALANCE SYSTEM ===
    console.log('💰 Testing balance update system...');

    // Get initial balance
    const initialBalance = await page.evaluate(() => {
      const balanceEl = document.getElementById('current-balance');
      return balanceEl ? balanceEl.textContent : 'NOT FOUND';
    });

    console.log(`Initial balance: ${initialBalance}`);
    await page.screenshot({ path: 'screenshot-04-initial-balance.png' });

    // Test deposit (+1)
    console.log('➕ Testing deposit (+$1)...');
    await page.type('#impulse', 'Test deposit');
    await page.click('#plus');

    // Wait for API call and UI update
    await new Promise(resolve => setTimeout(resolve, 2000));

    const balanceAfterDeposit = await page.evaluate(() => {
      const balanceEl = document.getElementById('current-balance');
      return balanceEl ? balanceEl.textContent : 'NOT FOUND';
    });

    console.log(`Balance after deposit: ${balanceAfterDeposit}`);
    await page.screenshot({ path: 'screenshot-05-after-deposit.png' });

    // Test withdrawal (-1)
    console.log('➖ Testing withdrawal (-$1)...');
    await page.type('#impulse', 'Test withdrawal');
    await page.click('#minus');

    // Wait for API call and UI update
    await new Promise(resolve => setTimeout(resolve, 2000));

    const balanceAfterWithdrawal = await page.evaluate(() => {
      const balanceEl = document.getElementById('current-balance');
      return balanceEl ? balanceEl.textContent : 'NOT FOUND';
    });

    console.log(`Balance after withdrawal: ${balanceAfterWithdrawal}`);
    await page.screenshot({ path: 'screenshot-06-after-withdrawal.png' });

    // === STEP 4: TEST HISTORY MODAL BALANCE ===
    console.log('📊 Testing history modal balance...');

    await page.click('#history-open');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const historyModalBalance = await page.evaluate(() => {
      const historyBalanceEl = document.getElementById('history-balance');
      return historyBalanceEl ? historyBalanceEl.textContent : 'NOT FOUND';
    });

    console.log(`History modal balance: ${historyModalBalance}`);
    await page.screenshot({ path: 'screenshot-07-history-modal.png' });

    // Close modal
    await page.click('#history-close');
    await new Promise(resolve => setTimeout(resolve, 500));

    // === STEP 5: FINAL BALANCE CHECK ===
    const finalBalance = await page.evaluate(() => {
      const balanceEl = document.getElementById('current-balance');
      return balanceEl ? balanceEl.textContent : 'NOT FOUND';
    });

    console.log(`Final balance: ${finalBalance}`);

    // === ANALYSIS ===
    console.log('\n🔍 === BALANCE UPDATE ANALYSIS ===');
    console.log(`Initial: ${initialBalance}`);
    console.log(`After +$1: ${balanceAfterDeposit}`);
    console.log(`After -$1: ${balanceAfterWithdrawal}`);
    console.log(`History Modal: ${historyModalBalance}`);
    console.log(`Final: ${finalBalance}`);

    // Check if balance is updating in real-time
    const realTimeWorking = (
      initialBalance !== balanceAfterDeposit &&
      balanceAfterDeposit !== balanceAfterWithdrawal
    );

    console.log(`\n💡 Real-time balance updates: ${realTimeWorking ? '✅ WORKING' : '❌ BROKEN'}`);

    if (!realTimeWorking) {
      console.log('🚨 BALANCE ISSUE CONFIRMED: Balance only updates when history modal is opened');
    }

    // === STEP 6: TEST OTHER UI ELEMENTS ===
    console.log('\n🧪 Testing hamburger menu...');

    const settingsToggle = await page.$('.settings-toggle');
    if (settingsToggle) {
      await settingsToggle.click();
      await new Promise(resolve => setTimeout(resolve, 500));
      await page.screenshot({ path: 'screenshot-08-hamburger-test.png' });
    }

    // Take final screenshots
    await page.screenshot({ path: 'screenshot-09-final-state.png' });

    console.log('\n🎯 === TEST COMPLETE ===');
    console.log('Check screenshot files for visual confirmation');
    console.log('Check browser console for debugging logs');

    if (!realTimeWorking) {
      console.log('\n🔧 NEXT STEPS TO FIX BALANCE ISSUE:');
      console.log('1. Check debugging logs in browser console');
      console.log('2. Verify API returns updated data immediately');
      console.log('3. Check displayName matching in computeWeeklyStats');
      console.log('4. Verify current week filtering logic');
    }

  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'screenshot-error.png' });
  }

  console.log('Test complete - check screenshots and console output');
  // Keep browser open for manual inspection
  // await browser.close();
}

testUI().catch(console.error);