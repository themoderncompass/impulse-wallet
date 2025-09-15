const puppeteer = require('puppeteer');

async function comprehensiveHealthCheck() {
  let browser;
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  try {
    console.log('🔍 Starting Comprehensive Health Check...');
    console.log('='.repeat(60));

    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--no-sandbox', '--start-maximized']
    });

    const page = await browser.newPage();

    // Test 1: Basic page load
    console.log('📱 Testing basic page load...');
    try {
      await page.goto('http://localhost:8788/', { waitUntil: 'networkidle0', timeout: 10000 });
      results.passed.push('✅ Page loads successfully');
    } catch (error) {
      results.failed.push('❌ Page failed to load: ' + error.message);
      throw error;
    }

    // Test 2: Check for JavaScript errors
    console.log('🔧 Checking for JavaScript errors...');
    const jsErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    if (jsErrors.length === 0) {
      results.passed.push('✅ No JavaScript console errors');
    } else {
      results.failed.push('❌ JavaScript errors found: ' + jsErrors.join(', '));
    }

    // Test 3: Room creation flow
    console.log('🏠 Testing room creation...');
    try {
      const randomRoom = 'TEST' + Math.floor(Math.random() * 10000);
      await page.type('#name', 'HealthCheck');
      await page.type('#room', randomRoom);
      await page.click('#create');
      await new Promise(resolve => setTimeout(resolve, 4000));

      const inRoom = await page.evaluate(() => {
        const play = document.querySelector('#play');
        return play && !play.classList.contains('hidden');
      });

      if (inRoom) {
        results.passed.push('✅ Room creation works');
      } else {
        results.failed.push('❌ Room creation failed');
      }
    } catch (error) {
      results.failed.push('❌ Room creation error: ' + error.message);
    }

    // Test 4: Focus area selection
    console.log('🎯 Testing focus area functionality...');
    try {
      // Check initial state
      const initialState = await page.evaluate(() => {
        const prompt = document.querySelector('#focus-selection-prompt');
        return {
          promptVisible: prompt ? getComputedStyle(prompt).display !== 'none' : false
        };
      });

      if (initialState.promptVisible) {
        // Open focus modal and select areas
        await page.click('#focus-selection-prompt');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Select focus areas
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
        }

        await page.click('button.primary[type="submit"]');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check final state
        const finalState = await page.evaluate(() => {
          const prompt = document.querySelector('#focus-selection-prompt');
          const chips = document.querySelector('#focus-chips');
          return {
            promptHidden: prompt ? getComputedStyle(prompt).display === 'none' : false,
            chipsVisible: chips ? getComputedStyle(chips).display !== 'none' : false,
            chipsCount: chips ? chips.children.length : 0
          };
        });

        if (finalState.promptHidden && finalState.chipsVisible && finalState.chipsCount === 3) {
          results.passed.push('✅ Focus area selection works correctly');
        } else {
          results.failed.push('❌ Focus area selection has issues');
        }
      } else {
        results.warnings.push('⚠️ Focus prompt not visible - may already be set');
      }
    } catch (error) {
      results.failed.push('❌ Focus area selection error: ' + error.message);
    }

    // Test 5: Mobile responsiveness
    console.log('📱 Testing mobile responsiveness...');
    try {
      await page.setViewport({ width: 375, height: 667 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mobileLayout = await page.evaluate(() => {
        const mainContent = document.querySelector('.main-content');
        const focusAreas = document.querySelector('.focus-areas');
        const balanceActions = document.querySelector('.balance-actions');

        if (!mainContent || !focusAreas || !balanceActions) return null;

        const mainStyle = getComputedStyle(mainContent);
        const focusRect = focusAreas.getBoundingClientRect();
        const actionsRect = balanceActions.getBoundingClientRect();

        return {
          flexDirection: mainStyle.flexDirection,
          focusLeft: focusRect.left,
          actionsLeft: actionsRect.left,
          sideBySide: actionsRect.left > focusRect.left
        };
      });

      if (mobileLayout && mobileLayout.flexDirection === 'row' && mobileLayout.sideBySide) {
        results.passed.push('✅ Mobile layout is side-by-side');
      } else {
        results.failed.push('❌ Mobile layout not working correctly');
      }
    } catch (error) {
      results.failed.push('❌ Mobile responsiveness error: ' + error.message);
    }

    // Test 6: Desktop responsiveness
    console.log('🖥️ Testing desktop responsiveness...');
    try {
      await page.setViewport({ width: 1200, height: 800 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      const desktopLayout = await page.evaluate(() => {
        const wallet = document.querySelector('.wallet-image');
        const mainContent = document.querySelector('.main-content');

        return {
          walletVisible: wallet ? wallet.getBoundingClientRect().width > 0 : false,
          mainContentExists: !!mainContent
        };
      });

      if (desktopLayout.walletVisible && desktopLayout.mainContentExists) {
        results.passed.push('✅ Desktop layout working');
      } else {
        results.failed.push('❌ Desktop layout has issues');
      }
    } catch (error) {
      results.failed.push('❌ Desktop responsiveness error: ' + error.message);
    }

    // Test 7: Action buttons functionality
    console.log('💰 Testing action buttons...');
    try {
      const initialBalance = await page.evaluate(() => {
        const balanceEl = document.querySelector('.balance-amount');
        return balanceEl ? parseInt(balanceEl.textContent.replace('$', '')) : null;
      });

      if (initialBalance !== null) {
        // Test deposit
        await page.click('.deposit-btn');
        await new Promise(resolve => setTimeout(resolve, 500));

        const newBalance = await page.evaluate(() => {
          const balanceEl = document.querySelector('.balance-amount');
          return balanceEl ? parseInt(balanceEl.textContent.replace('$', '')) : null;
        });

        if (newBalance === initialBalance + 1) {
          results.passed.push('✅ Deposit button works');
        } else {
          results.failed.push('❌ Deposit button not working');
        }
      } else {
        results.failed.push('❌ Could not find balance element');
      }
    } catch (error) {
      results.failed.push('❌ Action buttons error: ' + error.message);
    }

    // Take final screenshot
    await page.screenshot({
      path: './health-check-final.png',
      fullPage: true
    });

    console.log('\n📊 HEALTH CHECK RESULTS:');
    console.log('='.repeat(60));

    console.log('\n✅ PASSED TESTS:');
    results.passed.forEach(test => console.log('  ' + test));

    if (results.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      results.warnings.forEach(warning => console.log('  ' + warning));
    }

    if (results.failed.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      results.failed.forEach(failure => console.log('  ' + failure));
    }

    console.log('\n📈 SUMMARY:');
    console.log(`  Passed: ${results.passed.length}`);
    console.log(`  Warnings: ${results.warnings.length}`);
    console.log(`  Failed: ${results.failed.length}`);

    const overallHealth = results.failed.length === 0 ? '🟢 HEALTHY' : '🔴 ISSUES FOUND';
    console.log(`  Overall: ${overallHealth}`);

    console.log('\n📸 Screenshot saved: health-check-final.png');
    console.log('\n⏳ Browser will stay open for 10 seconds...');

    setTimeout(() => {
      browser.close();
      console.log('\n✅ Health check complete!');
    }, 10000);

  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    results.failed.push('❌ Critical error: ' + error.message);

    if (browser) {
      browser.close();
    }
  }
}

comprehensiveHealthCheck();