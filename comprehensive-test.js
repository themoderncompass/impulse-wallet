/**
 * Comprehensive Test Suite for Impulse Wallet
 *
 * Visual verification + functional testing with randomized users
 * Creates business documentation automatically
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ComprehensiveTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testSession = new Date().toISOString().slice(0, 16).replace('T', '_');
    this.findings = [];
    this.screenshots = [];
  }

  async setUp() {
    console.log('🚀 Starting Comprehensive Test Suite...');

    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--no-sandbox', '--start-maximized'],
      slowMo: 500 // Slow down for visual verification
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 375, height: 667 });

    // Track console errors
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ JS Error:', msg.text());
        this.addFinding('error', 'JavaScript', msg.text());
      }
    });

    await this.page.goto('http://localhost:8788/', { waitUntil: 'networkidle0' });
    await this.wait(2000);
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  addFinding(type, category, description) {
    this.findings.push({ type, category, description, timestamp: new Date() });
    const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${category}: ${description}`);
  }

  async takeScreenshot(name, description) {
    const filename = `${this.testSession}_${name}.png`;
    await this.page.screenshot({ path: filename, fullPage: true });
    this.screenshots.push({ name, description, filename });
    console.log(`📸 ${name}: ${description}`);
    return filename;
  }

  async testInitialState() {
    console.log('\\n🔍 Test 1: Initial Mobile Layout');

    await this.takeScreenshot('01_initial', 'Initial mobile layout');

    const layout = await this.page.evaluate(() => {
      // Check all key elements
      const elements = {
        walletBalanceRow: document.querySelector('.wallet-balance-row'),
        walletGroup: document.querySelector('.wallet-balance-group'),
        mobileAreas: document.querySelector('.mobile-focus-areas'),
        desktopAreas: document.querySelector('.focus-areas'),
        wallet: document.querySelector('.wallet-image'),
        balance: document.querySelector('#current-balance')
      };

      const results = {};

      // Check wallet-balance-row
      if (elements.walletBalanceRow) {
        const style = getComputedStyle(elements.walletBalanceRow);
        const rect = elements.walletBalanceRow.getBoundingClientRect();
        results.walletBalanceRow = {
          display: style.display,
          flexDirection: style.flexDirection,
          justifyContent: style.justifyContent,
          visible: rect.width > 0 && rect.height > 0,
          rect: { width: rect.width, height: rect.height }
        };
      }

      // Check wallet group
      if (elements.walletGroup) {
        const rect = elements.walletGroup.getBoundingClientRect();
        results.walletGroup = {
          visible: rect.width > 0 && rect.height > 0,
          position: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        };
      }

      // Check mobile areas
      if (elements.mobileAreas) {
        const style = getComputedStyle(elements.mobileAreas);
        const rect = elements.mobileAreas.getBoundingClientRect();
        results.mobileAreas = {
          display: style.display,
          visible: style.display !== 'none' && rect.width > 0 && rect.height > 0,
          position: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        };
      }

      // Check desktop areas
      if (elements.desktopAreas) {
        const style = getComputedStyle(elements.desktopAreas);
        results.desktopAreas = {
          display: style.display,
          hiddenOnMobile: style.display === 'none'
        };
      }

      return results;
    });

    // Verify layout
    if (layout.walletBalanceRow?.flexDirection === 'row') {
      this.addFinding('success', 'Layout', 'Wallet-balance-row using horizontal flex layout');
    } else {
      this.addFinding('error', 'Layout', `Wallet-balance-row not horizontal: ${layout.walletBalanceRow?.flexDirection}`);
    }

    if (layout.desktopAreas?.hiddenOnMobile) {
      this.addFinding('success', 'Layout', 'Desktop focus areas hidden on mobile');
    } else {
      this.addFinding('error', 'Layout', 'Desktop focus areas not hidden on mobile');
    }

    if (!layout.mobileAreas?.visible) {
      this.addFinding('success', 'Layout', 'Mobile focus areas hidden before entering room');
    } else {
      this.addFinding('warning', 'Layout', 'Mobile focus areas visible before entering room');
    }

    return layout;
  }

  async testRoomCreation() {
    console.log('\\n🏠 Test 2: Room Creation with Random User');

    // Generate random user to avoid conflicts
    const randomUserId = 'User' + Math.floor(Math.random() * 999999);
    const roomCode = 'TEST' + Math.floor(Math.random() * 9999);

    console.log(`Creating room ${roomCode} with user ${randomUserId}`);

    await this.page.type('#name', randomUserId);
    await this.page.type('#room', roomCode);

    await this.takeScreenshot('02_before_create', 'Form filled before room creation');

    await this.page.click('#create');
    await this.wait(4000);

    await this.takeScreenshot('03_after_create', 'After room creation');

    // Check if room creation succeeded
    const roomState = await this.page.evaluate(() => {
      const play = document.querySelector('#play');
      const join = document.querySelector('.join');
      const mobileAreas = document.querySelector('.mobile-focus-areas');

      return {
        inRoom: play && !play.classList.contains('hidden') &&
                join && join.classList.contains('hidden'),
        mobileAreasNowVisible: mobileAreas && getComputedStyle(mobileAreas).display !== 'none'
      };
    });

    if (roomState.inRoom) {
      this.addFinding('success', 'Room Creation', `Successfully created room ${roomCode} with user ${randomUserId}`);
    } else {
      this.addFinding('error', 'Room Creation', 'Failed to create room or enter room state');
    }

    if (roomState.mobileAreasNowVisible) {
      this.addFinding('success', 'Mobile Focus', 'Mobile focus areas became visible after entering room');
    } else {
      this.addFinding('error', 'Mobile Focus', 'Mobile focus areas still not visible after entering room');
    }

    return { roomCode, randomUserId, inRoom: roomState.inRoom };
  }

  async testFocusAreaPositioning() {
    console.log('\\n🎯 Test 3: Focus Area Positioning');

    const positioning = await this.page.evaluate(() => {
      const walletGroup = document.querySelector('.wallet-balance-group');
      const mobileAreas = document.querySelector('.mobile-focus-areas');
      const walletBalanceRow = document.querySelector('.wallet-balance-row');

      if (!walletGroup || !mobileAreas) {
        return { error: 'Missing required elements' };
      }

      const walletRect = walletGroup.getBoundingClientRect();
      const areasRect = mobileAreas.getBoundingClientRect();
      const rowRect = walletBalanceRow.getBoundingClientRect();

      return {
        walletGroup: { left: walletRect.left, right: walletRect.right, width: walletRect.width },
        mobileAreas: { left: areasRect.left, right: areasRect.right, width: areasRect.width },
        row: { left: rowRect.left, right: rowRect.right, width: rowRect.width },
        areasToRightOfWallet: areasRect.left > walletRect.right,
        areasVisible: areasRect.width > 0 && areasRect.height > 0
      };
    });

    await this.takeScreenshot('04_focus_positioning', 'Focus areas positioning test');

    if (positioning.error) {
      this.addFinding('error', 'Focus Positioning', positioning.error);
    } else {
      if (positioning.areasToRightOfWallet && positioning.areasVisible) {
        this.addFinding('success', 'Focus Positioning', 'Focus areas correctly positioned to the RIGHT of wallet/balance');
      } else {
        this.addFinding('error', 'Focus Positioning', `Focus areas NOT to right of wallet. Areas left: ${positioning.mobileAreas.left}, Wallet right: ${positioning.walletGroup.right}`);
      }
    }

    return positioning;
  }

  async testFocusWorkflow() {
    console.log('\\n📝 Test 4: Focus Selection Workflow');

    // Look for focus prompt
    const prompt = await this.page.$('#focus-selection-prompt-mobile');
    if (prompt) {
      await prompt.click();
      await this.wait(2000);

      await this.takeScreenshot('05_focus_modal', 'Focus modal opened');

      // Select 3 areas
      const checkboxes = await this.page.$$('input[name="focusArea"]');
      if (checkboxes.length >= 3) {
        await checkboxes[0].click();
        await checkboxes[1].click();
        await checkboxes[2].click();

        const saveBtn = await this.page.$('#focus-form button[type="submit"]');
        if (saveBtn) {
          await saveBtn.click();
          await this.wait(3000);

          await this.takeScreenshot('06_focus_saved', 'After saving focus areas');

          // Check if badges appear
          const badges = await this.page.evaluate(() => {
            const mobileChips = document.querySelector('#focus-chips-mobile');
            return {
              visible: mobileChips && getComputedStyle(mobileChips).display !== 'none',
              count: mobileChips ? mobileChips.querySelectorAll('.chip').length : 0
            };
          });

          if (badges.count === 3) {
            this.addFinding('success', 'Focus Workflow', `3 focus badges displayed correctly`);
          } else {
            this.addFinding('error', 'Focus Workflow', `Expected 3 badges, got ${badges.count}`);
          }
        }
      }
    } else {
      this.addFinding('error', 'Focus Workflow', 'Mobile focus prompt not found');
    }
  }

  async generateReport() {
    const successCount = this.findings.filter(f => f.type === 'success').length;
    const errorCount = this.findings.filter(f => f.type === 'error').length;
    const warningCount = this.findings.filter(f => f.type === 'warning').length;

    const report = `# Comprehensive Test Report - ${this.testSession}

## Summary
- ✅ **${successCount}** tests passed
- ❌ **${errorCount}** tests failed
- ⚠️ **${warningCount}** warnings

## Test Results

### ✅ Successful Tests
${this.findings.filter(f => f.type === 'success').map(f => `- **${f.category}**: ${f.description}`).join('\\n')}

${errorCount > 0 ? `### ❌ Failed Tests
${this.findings.filter(f => f.type === 'error').map(f => `- **${f.category}**: ${f.description}`).join('\\n')}` : ''}

${warningCount > 0 ? `### ⚠️ Warnings
${this.findings.filter(f => f.type === 'warning').map(f => `- **${f.category}**: ${f.description}`).join('\\n')}` : ''}

## Screenshots
${this.screenshots.map(s => `- **${s.name}**: ${s.description} (${s.filename})`).join('\\n')}

## Deployment Status
${errorCount === 0 ? '🟢 **READY FOR DEPLOYMENT** - All critical tests passed' : '🔴 **HOLD DEPLOYMENT** - Critical issues must be fixed'}
`;

    const filename = `test-report-${this.testSession}.md`;
    await fs.writeFile(filename, report);

    console.log('\\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE TEST COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`⚠️ Warnings: ${warningCount}`);
    console.log(`📋 Report: ${filename}`);

    return errorCount === 0;
  }

  async tearDown() {
    if (this.browser) {
      console.log('\\n🔍 Browser staying open for 15 seconds for manual verification...');
      setTimeout(() => this.browser.close(), 15000);
    }
  }

  async run() {
    try {
      await this.setUp();
      await this.testInitialState();
      const roomInfo = await this.testRoomCreation();

      if (roomInfo.inRoom) {
        await this.testFocusAreaPositioning();
        await this.testFocusWorkflow();
      }

      const success = await this.generateReport();
      await this.tearDown();

      return success;
    } catch (error) {
      console.error('❌ Test failed:', error);
      await this.tearDown();
      return false;
    }
  }
}

if (require.main === module) {
  const test = new ComprehensiveTest();
  test.run()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { ComprehensiveTest };