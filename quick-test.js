const puppeteer = require('puppeteer');

async function quickTest() {
  let browser;

  try {
    console.log('🚀 Starting quick mobile test...');

    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 375, height: 667 },
      devtools: false,
      args: ['--no-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 667 });

    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ JS Error:', msg.text());
      }
    });

    console.log('📱 Opening app...');
    await page.goto('http://localhost:8788/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait a bit for everything to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check what elements exist
    console.log('\n🔍 Checking elements...');

    const elements = await page.evaluate(() => {
      return {
        walletImage: !!document.querySelector('.wallet-image'),
        mobileAreas: !!document.querySelector('.mobile-focus-areas'),
        desktopAreas: !!document.querySelector('.focus-areas'),
        footer: !!document.querySelector('.site-footer'),
        playSection: !!document.querySelector('#play'),
        joinSection: !!document.querySelector('.join')
      };
    });

    console.log('Elements found:', elements);

    // Check CSS computed styles
    const styles = await page.evaluate(() => {
      const wallet = document.querySelector('.wallet-image');
      const mobileAreas = document.querySelector('.mobile-focus-areas');
      const desktopAreas = document.querySelector('.focus-areas');

      return {
        wallet: wallet ? {
          width: getComputedStyle(wallet).width,
          height: getComputedStyle(wallet).height,
          display: getComputedStyle(wallet).display
        } : null,
        mobileAreas: mobileAreas ? {
          display: getComputedStyle(mobileAreas).display
        } : null,
        desktopAreas: desktopAreas ? {
          display: getComputedStyle(desktopAreas).display
        } : null
      };
    });

    console.log('\n🎨 CSS Styles:', styles);

    // Test room creation
    console.log('\n🏠 Testing room creation...');

    // Fill form with random room code to avoid conflicts
    await page.type('#name', 'TestUser');
    const randomRoom = 'TEST' + Math.floor(Math.random() * 9999);
    await page.type('#room', randomRoom);
    console.log(`Using room code: ${randomRoom}`);

    // Click create
    await page.click('#create');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we entered the room
    const inRoom = await page.evaluate(() => {
      const play = document.querySelector('#play');
      return play && !play.classList.contains('hidden');
    });

    console.log(`Room created successfully: ${inRoom}`);

    if (inRoom) {
      console.log('\n🎯 Testing focus areas...');

      // Check if mobile focus areas are shown
      const mobileAreasVisible = await page.evaluate(() => {
        const areas = document.querySelector('.mobile-focus-areas');
        return areas && getComputedStyle(areas).display !== 'none';
      });

      console.log(`Mobile focus areas visible: ${mobileAreasVisible}`);

      // Check for focus prompt
      const promptExists = await page.evaluate(() => {
        return !!document.querySelector('#focus-selection-prompt-mobile');
      });

      console.log(`Mobile focus prompt exists: ${promptExists}`);
    }

    console.log('\n✅ Quick test completed!');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    if (browser) {
      setTimeout(() => browser.close(), 10000); // Auto-close after 10 seconds
    }
  }
}

quickTest().catch(console.error);