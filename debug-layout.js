const puppeteer = require('puppeteer');

async function debugLayout() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });
  await page.goto('http://localhost:8788/');

  await page.type('#name', 'DebugUser');
  await page.type('#room', 'DEBUG1');
  await page.click('#create');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Debug the actual DOM structure and positioning
  const debug = await page.evaluate(() => {
    const results = {};

    // Check wallet-balance-row children
    const row = document.querySelector('.wallet-balance-row');
    if (row) {
      results.rowChildren = Array.from(row.children).map(child => ({
        tagName: child.tagName,
        className: child.className,
        id: child.id,
        visible: child.getBoundingClientRect().width > 0,
        rect: child.getBoundingClientRect()
      }));

      results.rowStyle = {
        display: getComputedStyle(row).display,
        flexDirection: getComputedStyle(row).flexDirection,
        justifyContent: getComputedStyle(row).justifyContent
      };
    }

    // Check mobile focus areas specifically
    const mobileAreas = document.querySelector('#mobile-focus-areas');
    if (mobileAreas) {
      const style = getComputedStyle(mobileAreas);
      const rect = mobileAreas.getBoundingClientRect();
      results.mobileAreas = {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        rect: rect,
        visible: rect.width > 0 && rect.height > 0,
        innerHTML: mobileAreas.innerHTML.substring(0, 200) + '...'
      };
    }

    return results;
  });

  console.log('\\n🔍 DEBUG RESULTS:');
  console.log('='.repeat(50));
  console.log('Row Style:', debug.rowStyle);
  console.log('Row Children:', debug.rowChildren);
  console.log('Mobile Areas:', debug.mobileAreas);

  await page.screenshot({ path: 'debug-layout.png', fullPage: true });

  setTimeout(() => browser.close(), 10000);
}

debugLayout();