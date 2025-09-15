const puppeteer = require('puppeteer');

async function setupAndTestUser() {
  console.log('🧪 Setting up Test User with LocalStorage');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 375, height: 667 }
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });

  try {
    // Navigate to the app
    await page.goto('http://localhost:8788/', { waitUntil: 'networkidle0' });

    // Set up localStorage with fixed test data
    console.log('📦 Setting up localStorage with test data...');
    await page.evaluate(() => {
      // Set session data for consistent room/user
      localStorage.setItem('session', JSON.stringify({
        roomCode: 'TESTROOM',
        displayName: 'TestBot'
      }));

      // Set pre-selected focus areas
      localStorage.setItem('weeklyFocus', JSON.stringify([
        'Exercise', 'Eat Healthy', 'Scrolling'
      ]));

      // Set fixed user ID
      localStorage.setItem('impulse_user_id', 'test-user-12345');

      console.log('✅ LocalStorage setup complete');
    });

    // Refresh to load with the test data
    console.log('🔄 Refreshing page to load test state...');
    await page.reload({ waitUntil: 'networkidle0' });

    // Wait a moment for the page to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if we need to go through create/join flow
    const needsJoin = await page.evaluate(() => {
      const play = document.querySelector('#play');
      return !play || play.classList.contains('hidden');
    });

    if (needsJoin) {
      console.log('🚪 Session restoration didn\'t work, going through join flow...');

      // Fill in the form with our test data
      await page.evaluate(() => {
        document.querySelector('#name').value = 'TestBot';
        document.querySelector('#room').value = 'TESTROOM';
      });

      // Try to join the existing room first
      console.log('🔗 Attempting to join room TESTROOM...');
      await page.click('#join');
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Check if join succeeded
      let stillNeedsJoin = await page.evaluate(() => {
        const play = document.querySelector('#play');
        return !play || play.classList.contains('hidden');
      });

      if (stillNeedsJoin) {
        console.log('🏗️ Join failed, trying with random room code...');
        // Generate a random room code to avoid conflicts
        const randomRoom = 'TEST' + Math.floor(Math.random() * 10000);
        await page.evaluate((roomCode) => {
          document.querySelector('#room').value = roomCode;
          // Update localStorage with new room code
          const session = JSON.parse(localStorage.getItem('session') || '{}');
          session.roomCode = roomCode;
          localStorage.setItem('session', JSON.stringify(session));
        }, randomRoom);

        console.log(`🎲 Using random room code: ${randomRoom}`);
        await page.click('#create');
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }

    // Check the state after reload
    const pageState = await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('session') || '{}');
      const focus = JSON.parse(localStorage.getItem('weeklyFocus') || '[]');
      const userId = localStorage.getItem('impulse_user_id');

      const playElement = document.querySelector('#play');
      const joinElement = document.querySelector('.join');
      const focusChips = document.querySelectorAll('.focus-chips .chip');
      const focusPrompt = document.querySelector('.focus-selection-prompt');

      return {
        localStorage: {
          session,
          focus,
          userId
        },
        ui: {
          inRoom: playElement && !playElement.classList.contains('hidden'),
          joinHidden: joinElement && joinElement.classList.contains('hidden'),
          focusChipCount: focusChips.length,
          focusChipTexts: Array.from(focusChips).map(chip => chip.textContent.trim()),
          promptVisible: focusPrompt && getComputedStyle(focusPrompt).display !== 'none'
        }
      };
    });

    console.log('\n📊 Test State Results:');
    console.log('LocalStorage:');
    console.log(`  Session: ${JSON.stringify(pageState.localStorage.session)}`);
    console.log(`  Focus Areas: ${JSON.stringify(pageState.localStorage.focus)}`);
    console.log(`  User ID: ${pageState.localStorage.userId}`);

    console.log('\nUI State:');
    console.log(`  In Room: ${pageState.ui.inRoom ? '✅' : '❌'}`);
    console.log(`  Join Hidden: ${pageState.ui.joinHidden ? '✅' : '❌'}`);
    console.log(`  Focus Chips: ${pageState.ui.focusChipCount} found`);
    console.log(`  Chip Texts: ${pageState.ui.focusChipTexts.join(', ')}`);
    console.log(`  Prompt Visible: ${pageState.ui.promptVisible ? '❌ (should be hidden)' : '✅ (correctly hidden)'}`);

    // Take screenshot
    await page.screenshot({
      path: 'test-user-setup-result.png',
      fullPage: true
    });
    console.log('\n📸 Screenshot saved: test-user-setup-result.png');

    // Overall success check
    const success = pageState.ui.inRoom &&
                   pageState.ui.focusChipCount === 3 &&
                   !pageState.ui.promptVisible;

    console.log(`\n🎯 Overall Test: ${success ? '✅ SUCCESS' : '❌ NEEDS WORK'}`);

    if (success) {
      console.log('🚀 Test user setup is working perfectly!');
      console.log('📋 You can now test UI changes by:');
      console.log('   1. Running this script');
      console.log('   2. Refreshing the browser');
      console.log('   3. Making your changes');
      console.log('   4. Refreshing again to test');
    }

    // Keep browser open for manual verification
    console.log('\n🔍 Browser staying open for 15 seconds for manual verification...');
    setTimeout(() => browser.close(), 15000);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await browser.close();
  }
}

setupAndTestUser();