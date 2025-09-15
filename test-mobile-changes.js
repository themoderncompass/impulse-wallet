const puppeteer = require('puppeteer');

async function testMobileChanges() {
  let browser;
  let page;

  try {
    console.log('🚀 Starting Puppeteer test for mobile changes...');

    browser = await puppeteer.launch({
      headless: false, // Show browser for visual debugging
      defaultViewport: { width: 375, height: 667 }, // iPhone SE size for mobile testing
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();

    // Set mobile viewport and user agent
    await page.setViewport({ width: 375, height: 667 });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');

    console.log('📱 Mobile viewport set (375x667)');

    // Navigate to the app
    await page.goto('http://localhost:8788/', { waitUntil: 'networkidle2' });
    console.log('🌐 Navigated to app');

    // Wait for initial load
    await page.waitForSelector('.wallet-image', { timeout: 10000 });
    console.log('✅ App loaded successfully');

    // Check if JavaScript errors occurred
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console Error:', msg.text());
      }
    });

    page.on('pageerror', error => {
      console.log('❌ Page Error:', error.message);
    });

    // Test 1: Check wallet size (should be larger now - 360px on mobile)
    console.log('\n📏 Test 1: Checking wallet size...');
    const walletImage = await page.$('.wallet-image');
    if (walletImage) {
      const walletBounds = await walletImage.boundingBox();
      if (walletBounds) {
        console.log(`Wallet dimensions: ${walletBounds.width}x${walletBounds.height}`);

        if (walletBounds.width >= 320) {
          console.log('✅ Wallet size looks good (should be 320-360px wide)');
        } else {
          console.log('❌ Wallet might be too small');
        }
      } else {
        console.log('❌ Could not get wallet bounding box');
      }
    } else {
      console.log('❌ Wallet image element not found');
    }

    // Test 2: Check if mobile focus areas are visible and positioned correctly
    console.log('\n🎯 Test 2: Checking mobile focus areas layout...');
    const mobileAreas = await page.$('.mobile-focus-areas');
    if (mobileAreas) {
      const isVisible = await page.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none';
      }, mobileAreas);
      console.log(`Mobile focus areas visible: ${isVisible}`);

      // Check if it's positioned in wallet-balance-row
      const parent = await page.evaluateHandle(el => el.parentElement, mobileAreas);
      const parentClass = await page.evaluate(el => el.className, parent);
      console.log(`Parent container: ${parentClass}`);

      if (parentClass.includes('wallet-balance-row')) {
        console.log('✅ Mobile focus areas correctly positioned in wallet row');
      } else {
        console.log('❌ Mobile focus areas not in wallet row');
      }
    } else {
      console.log('❌ Mobile focus areas container not found');
    }

    // Test 3: Check if desktop focus areas are hidden on mobile
    console.log('\n🖥️ Test 3: Checking desktop focus areas are hidden...');
    const desktopAreas = await page.$('.focus-areas');
    if (desktopAreas) {
      const isVisible = await page.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none';
      }, desktopAreas);
      console.log(`Desktop focus areas visible: ${isVisible}`);

      if (!isVisible) {
        console.log('✅ Desktop focus areas correctly hidden on mobile');
      } else {
        console.log('❌ Desktop focus areas should be hidden on mobile');
      }
    }

    // Test 4: Check footer is tightened
    console.log('\n🦶 Test 4: Checking footer spacing...');
    const footer = await page.$('.site-footer');
    if (footer) {
      const footerStyle = await page.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          padding: style.padding,
          fontSize: style.fontSize,
          minHeight: style.minHeight
        };
      }, footer);
      console.log(`Footer styles:`, footerStyle);
      console.log('✅ Footer styles checked');
    }

    // Test 5: Create a room and test the full user flow
    console.log('\n🏠 Test 5: Testing room creation flow...');

    // Fill in username
    const nameInput = await page.$('#name');
    if (nameInput) {
      await nameInput.type('TestUser123');
      console.log('✅ Username entered');
    }

    // Fill in room code
    const roomInput = await page.$('#room');
    if (roomInput) {
      await roomInput.type('TEST1');
      console.log('✅ Room code entered');
    }

    // Click create room
    const createBtn = await page.$('#create');
    if (createBtn) {
      await createBtn.click();
      console.log('🎬 Create room button clicked');

      // Wait for room creation
      await page.waitForTimeout(3000);

      // Check if we're in the room (play section should be visible)
      const playSection = await page.$('#play');
      if (playSection) {
        const isVisible = await page.evaluate(el => {
          return !el.classList.contains('hidden');
        }, playSection);

        if (isVisible) {
          console.log('✅ Successfully entered room');

          // Test 6: Test focus area selection
          console.log('\n🎯 Test 6: Testing focus area selection...');

          // Look for focus selection prompt (either desktop or mobile)
          const focusPrompt = await page.$('.focus-selection-prompt, #focus-selection-prompt-mobile');
          if (focusPrompt) {
            console.log('✅ Focus selection prompt found');

            // Click to open focus modal
            await focusPrompt.click();
            console.log('🎬 Focus prompt clicked');

            // Wait for modal
            await page.waitForTimeout(2000);

            // Test 7: Modal scrolling test
            console.log('\n📜 Test 7: Testing modal scrolling...');
            const modal = await page.$('#focus-modal');
            if (modal) {
              const isModalVisible = await page.evaluate(el => !el.hidden, modal);
              if (isModalVisible) {
                console.log('✅ Focus modal opened');

                // Test modal scrolling by checking if content is accessible
                const modalContent = await page.$('.modal-content');
                const scrollHeight = await page.evaluate(el => el.scrollHeight, modalContent);
                const clientHeight = await page.evaluate(el => el.clientHeight, modalContent);
                console.log(`Modal scroll height: ${scrollHeight}, client height: ${clientHeight}`);

                if (scrollHeight > clientHeight) {
                  console.log('✅ Modal is scrollable');

                  // Try to scroll in the modal
                  await modalContent.evaluate(el => el.scrollTop = 50);
                  const scrollTop = await page.evaluate(el => el.scrollTop, modalContent);
                  if (scrollTop > 0) {
                    console.log('✅ Modal scrolling works');
                  } else {
                    console.log('❌ Modal scrolling might have issues');
                  }
                }

                // Select some focus areas
                const checkboxes = await page.$$('input[name="focusArea"]');
                if (checkboxes.length >= 3) {
                  await checkboxes[0].click(); // Exercise
                  await checkboxes[1].click(); // Eat Healthy
                  await checkboxes[2].click(); // Procrastination
                  console.log('✅ Selected 3 focus areas');

                  // Save focus areas
                  const saveBtn = await page.$('#focus-form button[type="submit"]');
                  if (saveBtn) {
                    await saveBtn.click();
                    console.log('🎬 Save focus areas clicked');

                    await page.waitForTimeout(3000);

                    // Test 8: Check if focus badges appear in mobile area
                    console.log('\n🏷️ Test 8: Checking focus badges in mobile area...');
                    const mobileChips = await page.$('#focus-chips-mobile');
                    if (mobileChips) {
                      const chipsVisible = await page.evaluate(el => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none';
                      }, mobileChips);

                      const chipCount = await page.$$eval('#focus-chips-mobile .chip', chips => chips.length);
                      console.log(`Mobile chips visible: ${chipsVisible}, count: ${chipCount}`);

                      if (chipsVisible && chipCount === 3) {
                        console.log('✅ Focus badges correctly showing in mobile area');
                      } else {
                        console.log('❌ Focus badges not showing properly in mobile area');
                      }
                    }
                  }
                }
              }
            }
          } else {
            console.log('❌ Focus selection prompt not found');
          }
        } else {
          console.log('❌ Failed to enter room');
        }
      }
    }

    // Test 9: Test deposit/withdrawal functionality
    console.log('\n💰 Test 9: Testing deposit/withdrawal buttons...');
    const depositBtn = await page.$('#plus');
    const withdrawBtn = await page.$('#minus');

    if (depositBtn && withdrawBtn) {
      console.log('✅ Action buttons found');

      // Test deposit
      await depositBtn.click();
      await page.waitForTimeout(1000);

      const balance = await page.$eval('#current-balance', el => el.textContent);
      console.log(`Balance after deposit: ${balance}`);

      if (balance === '$1') {
        console.log('✅ Deposit functionality works');
      } else {
        console.log('❌ Deposit might have issues');
      }
    }

    console.log('\n🎉 Test completed! Check results above for any issues.');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  } finally {
    if (browser) {
      // Keep browser open for manual inspection
      console.log('\n🔍 Browser will stay open for manual inspection. Close manually when done.');
      // Uncomment the line below to auto-close
      // await browser.close();
    }
  }
}

// Run the test
testMobileChanges().catch(console.error);