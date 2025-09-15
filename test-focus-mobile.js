const puppeteer = require('puppeteer');

async function testMobileFocusArea() {
  let browser;

  try {
    console.log('🧪 Testing Mobile Focus Area Behavior...');

    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--no-sandbox', '--start-maximized']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 667 });

    console.log('📱 Opening app in mobile view...');
    await page.goto('http://localhost:8788/', { waitUntil: 'networkidle0' });

    // Create room quickly
    await page.type('#name', 'TestUser');
    await page.type('#room', 'TEST' + Math.floor(Math.random() * 10000));
    await page.click('#create');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🎯 Checking initial focus area state...');

    let focusState = await page.evaluate(() => {
      const prompt = document.querySelector('#focus-selection-prompt');
      const chips = document.querySelector('#focus-chips');

      return {
        promptVisible: prompt ? getComputedStyle(prompt).display !== 'none' : false,
        chipsVisible: chips ? getComputedStyle(chips).display !== 'none' : false,
        promptText: prompt ? prompt.textContent.trim() : 'not found'
      };
    });

    console.log('Initial state:', focusState);

    if (focusState.promptVisible) {
      console.log('✅ Focus prompt is visible initially - correct');

      // Click on focus area to open modal
      console.log('🔍 Opening focus modal...');
      await page.click('#focus-selection-prompt');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Select 3 focus areas
      console.log('📝 Selecting focus areas...');
      const focusOptions = ['Exercise', 'Eat Healthy', 'Scrolling'];

      for (const option of focusOptions) {
        await page.evaluate((optionText) => {
          const labels = Array.from(document.querySelectorAll('.focus-grid label'));
          const targetLabel = labels.find(label => label.textContent.includes(optionText));
          if (targetLabel) {
            const checkbox = targetLabel.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.click();
          }
        }, option);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Save focus areas
      console.log('💾 Saving focus areas...');
      await page.click('button.primary[type="submit"]');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check state after saving
      console.log('🔍 Checking state after saving focus areas...');
      focusState = await page.evaluate(() => {
        const prompt = document.querySelector('#focus-selection-prompt');
        const chips = document.querySelector('#focus-chips');
        const focusAreas = document.querySelector('.focus-areas');
        const balanceActions = document.querySelector('.balance-actions');

        // Check alignment
        const focusRect = focusAreas ? focusAreas.getBoundingClientRect() : null;
        const actionsRect = balanceActions ? balanceActions.getBoundingClientRect() : null;

        // Get section titles
        const focusTitles = focusAreas ? focusAreas.querySelectorAll('.section-title') : [];
        const actionTitles = balanceActions ? balanceActions.querySelectorAll('.section-title') : [];

        // Get first focus chip and first action button positions
        const firstChip = chips ? chips.querySelector('.chip') : null;
        const firstAction = balanceActions ? balanceActions.querySelector('.action-button') : null;

        const chipRect = firstChip ? firstChip.getBoundingClientRect() : null;
        const actionRect = firstAction ? firstAction.getBoundingClientRect() : null;

        // Get container positions
        const chipsRect = chips ? chips.getBoundingClientRect() : null;

        return {
          promptVisible: prompt ? getComputedStyle(prompt).display !== 'none' : false,
          chipsVisible: chips ? getComputedStyle(chips).display !== 'none' : false,
          chipsCount: chips ? chips.children.length : 0,
          alignment: {
            focusAreaTop: focusRect ? focusRect.top : 'not found',
            actionsTop: actionsRect ? actionsRect.top : 'not found',
            firstChipTop: chipRect ? chipRect.top : 'not found',
            firstActionTop: actionRect ? actionRect.top : 'not found',
            topDifference: (chipRect && actionRect) ? Math.abs(chipRect.top - actionRect.top) : 'unknown',
            chipHeight: chipRect ? chipRect.height : 'not found',
            actionHeight: actionRect ? actionRect.height : 'not found',
            chipsContainerTop: chipsRect ? chipsRect.top : 'not found'
          }
        };
      });

      console.log('Final state:', focusState);

      if (!focusState.promptVisible && focusState.chipsVisible) {
        console.log('✅ SUCCESS: Focus prompt hidden, chips visible');
      } else {
        console.log('❌ FAILURE: Focus prompt should be hidden but chips visible');
        console.log('   Prompt visible:', focusState.promptVisible);
        console.log('   Chips visible:', focusState.chipsVisible);
      }
    } else {
      console.log('❌ Focus prompt not visible initially - something is wrong');
    }

    // Take final screenshot
    await page.screenshot({
      path: './mobile-focus-test.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved: mobile-focus-test.png');

    console.log('\n⏳ Browser will stay open for 15 seconds for inspection...');
    setTimeout(() => {
      browser.close();
      console.log('✅ Test complete!');
    }, 15000);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (browser) {
      browser.close();
    }
  }
}

testMobileFocusArea();