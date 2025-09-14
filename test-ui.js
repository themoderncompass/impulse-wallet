const puppeteer = require('puppeteer');

async function testUI() {
  console.log('Starting UI test...');

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

    console.log('Page loaded, taking screenshot...');
    await page.screenshot({ path: 'screenshot-initial.png' });

    // Wait a moment for any dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test all main buttons and elements
    const elements = {
      // Main room buttons
      create: await page.$('#create'),
      join: await page.$('#join'),

      // Action buttons
      plus: await page.$('#plus'),
      minus: await page.$('#minus'),
      undo: await page.$('#undo'),

      // Settings menu
      settingsToggle: await page.$('.settings-toggle'),
      settingsDropdown: await page.$('#settingsDropdown'),

      // Modal triggers
      historyOpen: await page.$('#history-open'),
      focusOpen: await page.$('#focus-open'),
      instructionsOpen: await page.$('#instructions-open'),
      roomManageOpen: await page.$('#room-manage-open'),

      // Modals
      historyModal: await page.$('#history-modal'),
      focusModal: await page.$('#focus-modal'),
      instructionsModal: await page.$('#instructions-modal'),
      roomManageModal: await page.$('#room-manage-modal'),

      // Balance and wallet
      currentBalance: await page.$('#current-balance'),
      walletDisplay: await page.$('#wallet-display'),

      // Input fields
      roomInput: await page.$('#room'),
      nameInput: await page.$('#name'),
      impulseInput: await page.$('#impulse'),
      noteInput: await page.$('#note-input')
    };

    console.log('=== ELEMENT TEST RESULTS ===');
    for (const [name, element] of Object.entries(elements)) {
      console.log(`${name}: ${element ? '✅ Found' : '❌ Missing'}`);
    }

    // Test hamburger menu interaction
    console.log('=== TESTING HAMBURGER MENU ===');
    if (elements.settingsToggle) {
      try {
        await elements.settingsToggle.click();
        await page.waitForTimeout(500);

        const dropdownVisible = await page.evaluate(() => {
          const dropdown = document.getElementById('settingsDropdown');
          return dropdown && dropdown.classList.contains('active');
        });

        console.log('Hamburger menu toggle result:', dropdownVisible ? '✅ Working' : '❌ Not working');
        await page.screenshot({ path: 'screenshot-hamburger-test.png' });
      } catch (error) {
        console.log('Hamburger menu test failed:', error.message);
      }
    }

    // Test modal opens (if elements exist)
    console.log('=== TESTING MODAL FUNCTIONALITY ===');
    if (elements.instructionsOpen) {
      try {
        await elements.instructionsOpen.click();
        await page.waitForTimeout(500);

        const modalVisible = await page.evaluate(() => {
          const modal = document.getElementById('instructions-modal');
          return modal && !modal.hasAttribute('hidden');
        });

        console.log('Instructions modal test:', modalVisible ? '✅ Opens' : '❌ Does not open');
        await page.screenshot({ path: 'screenshot-instructions-modal.png' });
      } catch (error) {
        console.log('Instructions modal test failed:', error.message);
      }
    }

    // Take final screenshot
    await page.screenshot({ path: 'screenshot-final.png' });

  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'screenshot-error.png' });
  }

  console.log('Test complete - check screenshots and console output');
  // Keep browser open for manual inspection
  // await browser.close();
}

testUI().catch(console.error);