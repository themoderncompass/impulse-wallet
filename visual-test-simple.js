const puppeteer = require('puppeteer');

async function simpleVisualTest() {
  let browser;

  try {
    console.log('🚀 Starting Simple Visual Test...');

    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--no-sandbox', '--start-maximized']
    });

    const page = await browser.newPage();

    // Set mobile viewport
    await page.setViewport({ width: 375, height: 667 });

    console.log('📱 Opening app in mobile view...');
    await page.goto('http://localhost:8788/', { waitUntil: 'networkidle0' });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\\n🔍 Testing what you actually see...');

    // Check what's actually visible
    const visibility = await page.evaluate(() => {
      const results = {};

      // Check wallet
      const wallet = document.querySelector('.wallet-image');
      if (wallet) {
        const rect = wallet.getBoundingClientRect();
        results.wallet = {
          visible: rect.width > 0 && rect.height > 0,
          width: rect.width,
          height: rect.height
        };
      }

      // Check mobile focus areas
      const mobileAreas = document.querySelector('.mobile-focus-areas');
      if (mobileAreas) {
        const style = getComputedStyle(mobileAreas);
        const rect = mobileAreas.getBoundingClientRect();
        results.mobileAreas = {
          display: style.display,
          visible: rect.width > 0 && rect.height > 0,
          position: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        };
      }

      // Check desktop focus areas
      const desktopAreas = document.querySelector('.focus-areas');
      if (desktopAreas) {
        const style = getComputedStyle(desktopAreas);
        results.desktopAreas = {
          display: style.display,
          visible: style.display !== 'none'
        };
      }

      // Check footer
      const footer = document.querySelector('.site-footer');
      if (footer) {
        const style = getComputedStyle(footer);
        results.footer = {
          fontSize: style.fontSize,
          padding: style.padding,
          height: footer.getBoundingClientRect().height
        };
      }

      return results;
    });

    console.log('\\n📊 ACTUAL UI STATE:');
    console.log('='.repeat(50));
    console.log('Wallet:', visibility.wallet);
    console.log('Mobile Focus Areas:', visibility.mobileAreas);
    console.log('Desktop Focus Areas:', visibility.desktopAreas);
    console.log('Footer:', visibility.footer);

    console.log('\\n🏠 Testing room creation...');

    // Test room creation
    await page.type('#name', 'RealTest');
    await page.type('#room', 'RT' + Math.floor(Math.random() * 9999));
    await page.click('#create');

    await new Promise(resolve => setTimeout(resolve, 4000));

    // Check state after room creation
    const afterRoom = await page.evaluate(() => {
      const results = {};

      // Check if in room
      const play = document.querySelector('#play');
      const join = document.querySelector('.join');
      results.inRoom = play && !play.classList.contains('hidden') &&
                      join && join.classList.contains('hidden');

      // Check mobile focus areas after entering room
      const mobileAreas = document.querySelector('.mobile-focus-areas');
      if (mobileAreas) {
        const style = getComputedStyle(mobileAreas);
        results.mobileAreasAfterRoom = {
          display: style.display,
          visible: style.display !== 'none'
        };
      }

      return results;
    });

    console.log('\\n📊 AFTER ROOM CREATION:');
    console.log('='.repeat(50));
    console.log('In Room:', afterRoom.inRoom);
    console.log('Mobile Areas After Room:', afterRoom.mobileAreasAfterRoom);

    // Take screenshot
    await page.screenshot({
      path: './test-screenshot.png',
      fullPage: true
    });

    console.log('\\n📸 Screenshot saved as test-screenshot.png');
    console.log('\\n⏳ Browser will stay open for 30 seconds for manual inspection...');

    setTimeout(() => {
      browser.close();
      console.log('\\n✅ Test complete!');
    }, 30000);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (browser) {
      browser.close();
    }
  }
}

simpleVisualTest();