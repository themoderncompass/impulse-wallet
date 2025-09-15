const puppeteer = require('puppeteer');

async function quickMobileTest() {
  console.log('🔍 Quick Mobile Layout Test - Side by Side');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 375, height: 667 }
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });

  try {
    // Use URL parameters for instant room entry
    const testUrl = 'http://localhost:8788/?testUser=TestBot&testRoom=TESTROOM';
    await page.goto(testUrl, { waitUntil: 'networkidle0' });

    console.log('Testing with TestBot in TESTROOM via URL parameters');

    // Wait for automatic room entry
    await page.waitForSelector('#play:not(.hidden)', { timeout: 10000 });
    console.log('✅ Successfully entered room');

    // Take screenshot of the in-room mobile layout
    await page.screenshot({
      path: 'mobile-side-by-side-test.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved: mobile-side-by-side-test.png');

    // Check the layout structure
    const layoutInfo = await page.evaluate(() => {
      const mainContent = document.querySelector('.main-content');
      const actions = document.querySelector('.balance-actions');
      const focusAreas = document.querySelector('.focus-areas');

      if (!mainContent || !actions || !focusAreas) {
        return { error: 'Missing layout elements' };
      }

      const mainStyle = getComputedStyle(mainContent);
      const actionsRect = actions.getBoundingClientRect();
      const focusRect = focusAreas.getBoundingClientRect();

      return {
        mainContentDisplay: mainStyle.display,
        mainContentFlexDirection: mainStyle.flexDirection,
        actionsPosition: { left: actionsRect.left, width: actionsRect.width },
        focusPosition: { left: focusRect.left, width: focusRect.width },
        sideBySide: actionsRect.right <= focusRect.left + 10, // Small tolerance
        bothVisible: actionsRect.width > 0 && focusRect.width > 0
      };
    });

    console.log('📊 Layout Analysis:');
    console.log(`  Main Content: ${layoutInfo.mainContentDisplay}, ${layoutInfo.mainContentFlexDirection}`);
    console.log(`  Actions: ${layoutInfo.actionsPosition.width}px wide at ${layoutInfo.actionsPosition.left}px`);
    console.log(`  Focus: ${layoutInfo.focusPosition.width}px wide at ${layoutInfo.focusPosition.left}px`);
    console.log(`  Side by side: ${layoutInfo.sideBySide ? '✅' : '❌'}`);
    console.log(`  Both visible: ${layoutInfo.bothVisible ? '✅' : '❌'}`);

    // Keep browser open for manual inspection
    console.log('\n🔍 Browser staying open for 15 seconds for manual verification...');
    setTimeout(() => browser.close(), 15000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    await browser.close();
  }
}

quickMobileTest();