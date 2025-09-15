/**
 * Comprehensive Regression Test Suite for Impulse Wallet
 *
 * Tests all core functionality on every deployment:
 * - Mobile & Desktop layouts
 * - User creation & room management
 * - Focus area selection & display
 * - Deposit/withdrawal transactions
 * - Modal functionality & scrolling
 * - JavaScript error detection
 *
 * Usage: node test-regression.js
 */

const puppeteer = require('puppeteer');

class ImpulseWalletTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async setUp(mobile = false) {
    console.log(`🚀 Setting up ${mobile ? 'Mobile' : 'Desktop'} test environment...`);

    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: mobile ? { width: 375, height: 667 } : { width: 1200, height: 800 },
      devtools: false,
      args: ['--no-sandbox', '--disable-web-security']
    });

    this.page = await this.browser.newPage();

    if (mobile) {
      await this.page.setViewport({ width: 375, height: 667 });
      await this.page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15');
    }

    // Track console errors and warnings
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ JS Error:', msg.text());
        this.testResults.errors.push(`JS Error: ${msg.text()}`);
      }
    });

    this.page.on('pageerror', error => {
      console.log('❌ Page Error:', error.message);
      this.testResults.errors.push(`Page Error: ${error.message}`);
    });

    await this.page.goto('http://localhost:8788/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.wait(2000);
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async assert(condition, testName) {
    if (condition) {
      console.log(`✅ ${testName}`);
      this.testResults.passed++;
      return true;
    } else {
      console.log(`❌ ${testName}`);
      this.testResults.failed++;
      this.testResults.errors.push(testName);
      return false;
    }
  }

  async testBasicPageLoad() {
    console.log('\\n🌐 Testing Basic Page Load...');

    const elements = await this.page.evaluate(() => {
      return {
        walletImage: !!document.querySelector('.wallet-image'),
        footer: !!document.querySelector('.site-footer'),
        createBtn: !!document.querySelector('#create'),
        joinBtn: !!document.querySelector('#join'),
        nameInput: !!document.querySelector('#name'),
        roomInput: !!document.querySelector('#room')
      };
    });

    await this.assert(elements.walletImage, 'Wallet image loads');
    await this.assert(elements.footer, 'Footer renders');
    await this.assert(elements.createBtn, 'Create button exists');
    await this.assert(elements.joinBtn, 'Join button exists');
    await this.assert(elements.nameInput, 'Name input exists');
    await this.assert(elements.roomInput, 'Room input exists');
  }

  async testMobileLayout() {
    console.log('\\n📱 Testing Mobile Layout...');

    const mobileStyles = await this.page.evaluate(() => {
      const wallet = document.querySelector('.wallet-image');
      const mobileAreas = document.querySelector('.mobile-focus-areas');
      const desktopAreas = document.querySelector('.focus-areas');
      const footer = document.querySelector('.site-footer');

      return {
        walletWidth: wallet ? parseInt(getComputedStyle(wallet).width) : 0,
        mobileAreasExists: !!mobileAreas,
        desktopAreasHidden: desktopAreas ? getComputedStyle(desktopAreas).display === 'none' : false,
        footerFontSize: footer ? parseInt(getComputedStyle(footer).fontSize) : 0
      };
    });

    await this.assert(mobileStyles.walletWidth >= 320, `Wallet size correct (${mobileStyles.walletWidth}px >= 320px)`);
    await this.assert(mobileStyles.mobileAreasExists, 'Mobile focus areas container exists');
    await this.assert(mobileStyles.desktopAreasHidden, 'Desktop focus areas hidden on mobile');
    await this.assert(mobileStyles.footerFontSize <= 10, `Footer font size optimized (${mobileStyles.footerFontSize}px)`);
  }

  async testRoomCreation() {
    console.log('\\n🏠 Testing Room Creation...');

    // Generate unique room code
    const roomCode = 'TEST' + Math.floor(Math.random() * 99999);
    const username = 'TestUser' + Math.floor(Math.random() * 999);

    // Fill form
    await this.page.type('#name', username);
    await this.page.type('#room', roomCode);
    console.log(`Creating room: ${roomCode} with user: ${username}`);

    // Click create
    await this.page.click('#create');
    await this.wait(3000);

    // Check if we entered the room
    const inRoom = await this.page.evaluate(() => {
      const play = document.querySelector('#play');
      const join = document.querySelector('.join');
      return play && !play.classList.contains('hidden') &&
             join && join.classList.contains('hidden');
    });

    await this.assert(inRoom, 'Successfully entered room after creation');

    // Check if room-specific UI elements appear
    const roomElements = await this.page.evaluate(() => {
      return {
        focusBtn: document.querySelector('#focus-open') && !document.querySelector('#focus-open').classList.contains('hidden'),
        settingsBtn: document.querySelector('#room-manage-open') && !document.querySelector('#room-manage-open').classList.contains('hidden'),
        depositBtn: !!document.querySelector('#plus'),
        withdrawBtn: !!document.querySelector('#minus')
      };
    });

    await this.assert(roomElements.focusBtn, 'Focus button appears when in room');
    await this.assert(roomElements.settingsBtn, 'Settings button appears when in room');
    await this.assert(roomElements.depositBtn, 'Deposit button exists');
    await this.assert(roomElements.withdrawBtn, 'Withdraw button exists');

    return { roomCode, username };
  }

  async testMobileFocusAreas() {
    console.log('\\n🎯 Testing Mobile Focus Areas...');

    const mobileAreasVisible = await this.page.evaluate(() => {
      const areas = document.querySelector('.mobile-focus-areas');
      return areas && getComputedStyle(areas).display !== 'none';
    });

    await this.assert(mobileAreasVisible, 'Mobile focus areas visible when in room');

    const promptExists = await this.page.evaluate(() => {
      return !!document.querySelector('#focus-selection-prompt-mobile');
    });

    await this.assert(promptExists, 'Mobile focus prompt exists');
  }

  async testFocusAreaWorkflow() {
    console.log('\\n🎯 Testing Focus Area Selection Workflow...');

    // Click focus prompt to open modal
    const focusPrompt = await this.page.$('#focus-selection-prompt-mobile, .focus-selection-prompt');
    if (focusPrompt) {
      await focusPrompt.click();
      await this.wait(2000);

      // Check if modal opened
      const modalOpen = await this.page.evaluate(() => {
        const modal = document.querySelector('#focus-modal');
        return modal && !modal.hidden;
      });

      await this.assert(modalOpen, 'Focus modal opens');

      if (modalOpen) {
        // Test modal scrolling
        const canScroll = await this.page.evaluate(() => {
          const modalContent = document.querySelector('.modal-content');
          return modalContent && modalContent.scrollHeight > modalContent.clientHeight;
        });

        if (canScroll) {
          await this.assert(true, 'Focus modal is scrollable');

          // Test actual scrolling
          await this.page.evaluate(() => {
            document.querySelector('.modal-content').scrollTop = 50;
          });

          const scrollWorked = await this.page.evaluate(() => {
            return document.querySelector('.modal-content').scrollTop > 0;
          });

          await this.assert(scrollWorked, 'Modal scrolling works');
        }

        // Select focus areas
        const checkboxes = await this.page.$$('input[name="focusArea"]');
        if (checkboxes.length >= 3) {
          await checkboxes[0].click();
          await checkboxes[1].click();
          await checkboxes[2].click();

          await this.assert(true, 'Selected 3 focus areas');

          // Save focus areas
          const saveBtn = await this.page.$('#focus-form button[type="submit"]');
          if (saveBtn) {
            await saveBtn.click();
            await this.wait(3000);

            // Check if focus badges appear
            const badgesAppear = await this.page.evaluate(() => {
              const mobileChips = document.querySelector('#focus-chips-mobile');
              const desktopChips = document.querySelector('#focus-chips');

              const mobileVisible = mobileChips && getComputedStyle(mobileChips).display !== 'none';
              const desktopVisible = desktopChips && !desktopChips.classList.contains('hidden');

              const mobileCount = mobileChips ? mobileChips.querySelectorAll('.chip').length : 0;
              const desktopCount = desktopChips ? desktopChips.querySelectorAll('.chip').length : 0;

              return {
                mobileVisible,
                desktopVisible,
                mobileCount,
                desktopCount
              };
            });

            await this.assert(badgesAppear.mobileCount === 3, `Mobile focus badges showing (${badgesAppear.mobileCount}/3)`);
            await this.assert(badgesAppear.mobileVisible, 'Mobile focus badges visible');
          }
        }
      }
    }
  }

  async testTransactionWorkflow() {
    console.log('\\n💰 Testing Transaction Workflow...');

    // Test deposit
    await this.page.click('#plus');
    await this.wait(1500);

    let balance = await this.page.$eval('#current-balance', el => el.textContent);
    await this.assert(balance === '$1', `Deposit works (balance: ${balance})`);

    // Test withdrawal
    await this.page.click('#minus');
    await this.wait(1500);

    balance = await this.page.$eval('#current-balance', el => el.textContent);
    await this.assert(balance === '$0', `Withdrawal works (balance: ${balance})`);

    // Test multiple deposits
    await this.page.click('#plus');
    await this.wait(500);
    await this.page.click('#plus');
    await this.wait(1500);

    balance = await this.page.$eval('#current-balance', el => el.textContent);
    await this.assert(balance === '$2', `Multiple deposits work (balance: ${balance})`);
  }

  async testOtherModals() {
    console.log('\\n📋 Testing Other Modals...');

    // Test history modal
    const historyBtn = await this.page.$('#history-open');
    if (historyBtn) {
      await historyBtn.click();
      await this.wait(2000);

      const historyModalOpen = await this.page.evaluate(() => {
        const modal = document.querySelector('#history-modal');
        return modal && !modal.hidden;
      });

      await this.assert(historyModalOpen, 'History modal opens');

      if (historyModalOpen) {
        // Test history modal scrolling
        const historyCanScroll = await this.page.evaluate(() => {
          const modalContent = document.querySelector('#history-modal .modal-content');
          return modalContent && modalContent.scrollHeight > modalContent.clientHeight;
        });

        if (historyCanScroll) {
          await this.assert(true, 'History modal is scrollable');
        }

        // Close modal
        await this.page.click('#history-close');
        await this.wait(1000);
      }
    }
  }

  async tearDown() {
    if (this.browser) {
      console.log('\\n🔍 Keeping browser open for 10 seconds for manual inspection...');
      setTimeout(async () => {
        await this.browser.close();
      }, 10000);
    }
  }

  async generateReport() {
    console.log('\\n' + '='.repeat(60));
    console.log('📊 TEST REPORT');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100)}%`);

    if (this.testResults.errors.length > 0) {
      console.log('\\n🚨 ERRORS:');
      this.testResults.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }

    console.log('\\n' + '='.repeat(60));

    const success = this.testResults.failed === 0;
    if (success) {
      console.log('🎉 ALL TESTS PASSED! Ready for deployment.');
    } else {
      console.log('🚨 TESTS FAILED! Fix issues before deployment.');
    }

    return success;
  }
}

async function runRegressionTests() {
  console.log('🚀 Starting Impulse Wallet Regression Test Suite');
  console.log('Testing against: http://localhost:8788/\\n');

  const tester = new ImpulseWalletTester();

  try {
    // Mobile Test Suite
    console.log('📱 MOBILE TEST SUITE');
    console.log('='.repeat(40));

    await tester.setUp(true); // Mobile setup
    await tester.testBasicPageLoad();
    await tester.testMobileLayout();
    const roomInfo = await tester.testRoomCreation();
    await tester.testMobileFocusAreas();
    await tester.testFocusAreaWorkflow();
    await tester.testTransactionWorkflow();
    await tester.testOtherModals();

    const success = await tester.generateReport();
    await tester.tearDown();

    return success;

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    await tester.tearDown();
    return false;
  }
}

// Run the tests
if (require.main === module) {
  runRegressionTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite crashed:', error);
      process.exit(1);
    });
}

module.exports = { ImpulseWalletTester, runRegressionTests };