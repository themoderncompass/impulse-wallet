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

    // Try to find create/join room elements
    const createButton = await page.$('#create-room-btn');
    const joinButton = await page.$('#join-room-btn');

    console.log('Create button found:', !!createButton);
    console.log('Join button found:', !!joinButton);

    // Take another screenshot after waiting
    await page.screenshot({ path: 'screenshot-after-wait.png' });

  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'screenshot-error.png' });
  }

  console.log('Test complete - check screenshots and console output');
  // Keep browser open for manual inspection
  // await browser.close();
}

testUI().catch(console.error);