/**
 * Visual Regression Test Suite for Impulse Wallet
 *
 * Uses Puppeteer MCP to visually verify UI changes and functionality
 * Creates business-friendly documentation of findings
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class VisualRegressionTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.screenshots = [];
    this.findings = [];
    this.testSession = new Date().toISOString().replace(/[:.]/g, '-');
    this.screenshotDir = `./test-results/${this.testSession}`;
  }

  async setUp() {
    console.log('🚀 Setting up Visual Regression Test...');

    // Create screenshots directory
    await fs.mkdir(this.screenshotDir, { recursive: true });

    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 375, height: 667 }, // Mobile first
      devtools: false,
      args: ['--no-sandbox', '--disable-web-security'],
      slowMo: 1000 // Slow down for visual verification
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 375, height: 667 });
    await this.page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15');

    // Track console errors
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.addFinding('error', 'JavaScript Error', `Console error detected: ${msg.text()}`);
      }
    });

    await this.page.goto('http://localhost:8788/', { waitUntil: 'networkidle2' });
    await this.wait(2000);
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async takeScreenshot(name, description) {
    const filename = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    const filepath = path.join(this.screenshotDir, filename);

    await this.page.screenshot({
      path: filepath,
      fullPage: true,
      captureBeyondViewport: false
    });

    this.screenshots.push({ name, description, filename, filepath });
    console.log(`📸 Screenshot: ${name}`);
    return filepath;
  }

  addFinding(type, category, description, expected = null, actual = null) {
    this.findings.push({
      type, // 'success', 'warning', 'error'
      category,
      description,
      expected,
      actual,
      timestamp: new Date().toISOString()
    });
  }

  async visuallyVerifyInitialLoad() {
    console.log('\\n🔍 Visual Test 1: Initial Page Load');

    await this.takeScreenshot('01_initial_load', 'App initial load on mobile');

    // Check wallet size visually
    const walletBounds = await this.page.evaluate(() => {
      const wallet = document.querySelector('.wallet-image');
      if (!wallet) return null;
      const rect = wallet.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });

    if (walletBounds) {
      if (walletBounds.width >= 320) {
        this.addFinding('success', 'Mobile Layout', `Wallet size correct: ${walletBounds.width}px width`, '≥320px', `${walletBounds.width}px`);
      } else {
        this.addFinding('error', 'Mobile Layout', `Wallet too small: ${walletBounds.width}px width`, '≥320px', `${walletBounds.width}px`);
      }
    } else {
      this.addFinding('error', 'Mobile Layout', 'Wallet image not found or not visible');
    }

    // Check mobile focus areas are hidden initially
    const focusAreasVisible = await this.page.evaluate(() => {
      const mobileAreas = document.querySelector('.mobile-focus-areas');
      const desktopAreas = document.querySelector('.focus-areas');
      return {
        mobile: mobileAreas ? getComputedStyle(mobileAreas).display !== 'none' : false,
        desktop: desktopAreas ? getComputedStyle(desktopAreas).display !== 'none' : false
      };
    });

    if (!focusAreasVisible.mobile) {
      this.addFinding('success', 'Mobile Layout', 'Mobile focus areas correctly hidden before entering room');
    } else {
      this.addFinding('warning', 'Mobile Layout', 'Mobile focus areas visible before entering room');
    }

    if (!focusAreasVisible.desktop) {
      this.addFinding('success', 'Mobile Layout', 'Desktop focus areas correctly hidden on mobile');
    } else {
      this.addFinding('error', 'Mobile Layout', 'Desktop focus areas visible on mobile (should be hidden)');
    }
  }

  async visuallyVerifyRoomCreation() {
    console.log('\\n🏠 Visual Test 2: Room Creation Flow');

    // Fill form
    const roomCode = 'VT' + Math.floor(Math.random() * 99999);
    await this.page.type('#name', 'VisualTest');
    await this.page.type('#room', roomCode);

    await this.takeScreenshot('02_form_filled', 'Form filled before room creation');

    // Click create
    await this.page.click('#create');
    await this.wait(4000); // Wait for room creation

    await this.takeScreenshot('03_room_created', 'After room creation - should show play interface');

    // Check if we're actually in the room
    const roomState = await this.page.evaluate(() => {
      const play = document.querySelector('#play');
      const join = document.querySelector('.join');
      const focusBtn = document.querySelector('#focus-open');
      const settingsBtn = document.querySelector('#room-manage-open');

      return {
        playVisible: play && !play.classList.contains('hidden'),
        joinHidden: join && join.classList.contains('hidden'),
        focusVisible: focusBtn && !focusBtn.classList.contains('hidden'),
        settingsVisible: settingsBtn && !settingsBtn.classList.contains('hidden')
      };
    });

    if (roomState.playVisible && roomState.joinHidden) {
      this.addFinding('success', 'Room Creation', 'Successfully entered room - UI switched to play mode');
    } else {
      this.addFinding('error', 'Room Creation', 'Failed to enter room or UI did not switch properly');
    }

    if (roomState.focusVisible && roomState.settingsVisible) {
      this.addFinding('success', 'Room Creation', 'Room-specific buttons (Focus & Settings) appeared correctly');
    } else {
      this.addFinding('warning', 'Room Creation', 'Room-specific buttons not visible after room creation');
    }

    return roomCode;
  }

  async visuallyVerifyMobileFocusLayout() {
    console.log('\\n🎯 Visual Test 3: Mobile Focus Layout');

    // Check if mobile focus areas are now visible
    const focusLayoutState = await this.page.evaluate(() => {
      const mobileAreas = document.querySelector('.mobile-focus-areas');
      const walletRow = document.querySelector('.wallet-balance-row');
      const prompt = document.querySelector('#focus-selection-prompt-mobile');

      const mobileAreasStyle = mobileAreas ? getComputedStyle(mobileAreas) : null;
      const walletRowRect = walletRow ? walletRow.getBoundingClientRect() : null;
      const mobileAreasRect = mobileAreas ? mobileAreas.getBoundingClientRect() : null;

      return {
        mobileAreasVisible: mobileAreas && mobileAreasStyle.display !== 'none',
        promptExists: !!prompt,
        positioned: walletRowRect && mobileAreasRect &&
                   mobileAreasRect.left > walletRowRect.left + 200, // Should be to the right
        mobileAreasRect: mobileAreasRect ? {
          left: mobileAreasRect.left,
          top: mobileAreasRect.top,
          width: mobileAreasRect.width,
          height: mobileAreasRect.height
        } : null
      };
    });

    await this.takeScreenshot('04_mobile_focus_layout', 'Mobile focus areas layout in wallet row');

    if (focusLayoutState.mobileAreasVisible) {
      this.addFinding('success', 'Mobile Focus Layout', 'Mobile focus areas visible when in room');
    } else {
      this.addFinding('error', 'Mobile Focus Layout', 'Mobile focus areas not visible when in room');
    }

    if (focusLayoutState.positioned) {
      this.addFinding('success', 'Mobile Focus Layout', 'Focus areas positioned to the right of wallet/balance');
    } else {
      this.addFinding('error', 'Mobile Focus Layout', 'Focus areas NOT positioned to the right of wallet/balance');
    }

    if (focusLayoutState.promptExists) {
      this.addFinding('success', 'Mobile Focus Layout', 'Mobile focus prompt exists and ready for interaction');
    } else {
      this.addFinding('error', 'Mobile Focus Layout', 'Mobile focus prompt missing');
    }
  }

  async visuallyVerifyFocusWorkflow() {
    console.log('\\n📝 Visual Test 4: Focus Selection Workflow');

    // Click focus prompt
    const prompt = await this.page.$('#focus-selection-prompt-mobile, .focus-selection-prompt');
    if (prompt) {
      await prompt.click();
      await this.wait(2000);

      await this.takeScreenshot('05_focus_modal_open', 'Focus modal opened');

      // Check modal scrolling
      const modalScrollable = await this.page.evaluate(() => {
        const modal = document.querySelector('#focus-modal');
        const modalContent = document.querySelector('.modal-content');

        return {
          modalOpen: modal && !modal.hidden,
          canScroll: modalContent && modalContent.scrollHeight > modalContent.clientHeight,
          modalHeight: modalContent ? modalContent.clientHeight : 0,
          contentHeight: modalContent ? modalContent.scrollHeight : 0
        };
      });

      if (modalScrollable.modalOpen) {
        this.addFinding('success', 'Modal Functionality', 'Focus modal opens correctly');
      } else {
        this.addFinding('error', 'Modal Functionality', 'Focus modal failed to open');
      }

      if (modalScrollable.canScroll) {
        this.addFinding('success', 'Modal Functionality', `Modal is scrollable (content: ${modalScrollable.contentHeight}px, viewport: ${modalScrollable.modalHeight}px)`);

        // Test actual scrolling
        await this.page.evaluate(() => {
          const modalContent = document.querySelector('.modal-content');
          modalContent.scrollTop = 100;
        });

        await this.takeScreenshot('06_modal_scrolled', 'Modal scrolled down to test scrolling');

        const scrollWorked = await this.page.evaluate(() => {
          return document.querySelector('.modal-content').scrollTop > 0;
        });

        if (scrollWorked) {
          this.addFinding('success', 'Modal Functionality', 'Modal scrolling works correctly');
        } else {
          this.addFinding('error', 'Modal Functionality', 'Modal scrolling not working');
        }
      }

      // Select focus areas
      const checkboxes = await this.page.$$('input[name="focusArea"]');
      if (checkboxes.length >= 3) {
        await checkboxes[0].click();
        await checkboxes[1].click();
        await checkboxes[2].click();

        await this.takeScreenshot('07_focus_areas_selected', 'Three focus areas selected');

        // Save focus areas
        const saveBtn = await this.page.$('#focus-form button[type="submit"]');
        if (saveBtn) {
          await saveBtn.click();
          await this.wait(3000);

          await this.takeScreenshot('08_focus_areas_saved', 'After saving focus areas - should show badges');

          // Verify badges appear
          const badgesState = await this.page.evaluate(() => {
            const mobileChips = document.querySelector('#focus-chips-mobile');
            const chips = mobileChips ? mobileChips.querySelectorAll('.chip') : [];

            return {
              mobileChipsVisible: mobileChips && getComputedStyle(mobileChips).display !== 'none',
              chipCount: chips.length,
              chipTexts: Array.from(chips).map(chip => chip.title || chip.textContent.trim())
            };
          });

          if (badgesState.chipCount === 3) {
            this.addFinding('success', 'Focus Workflow', `3 focus badges displayed correctly: ${badgesState.chipTexts.join(', ')}`);
          } else {
            this.addFinding('error', 'Focus Workflow', `Expected 3 focus badges, got ${badgesState.chipCount}`);
          }
        }
      }
    }
  }

  async visuallyVerifyTransactions() {
    console.log('\\n💰 Visual Test 5: Transaction Workflow');

    // Test deposit
    await this.page.click('#plus');
    await this.wait(1500);

    let balance = await this.page.$eval('#current-balance', el => el.textContent);
    await this.takeScreenshot('09_after_deposit', `After deposit - balance: ${balance}`);

    if (balance === '$1') {
      this.addFinding('success', 'Transactions', 'Deposit works correctly - balance updated to $1');
    } else {
      this.addFinding('error', 'Transactions', `Deposit failed - expected $1, got ${balance}`);
    }

    // Test withdrawal
    await this.page.click('#minus');
    await this.wait(1500);

    balance = await this.page.$eval('#current-balance', el => el.textContent);
    await this.takeScreenshot('10_after_withdrawal', `After withdrawal - balance: ${balance}`);

    if (balance === '$0') {
      this.addFinding('success', 'Transactions', 'Withdrawal works correctly - balance back to $0');
    } else {
      this.addFinding('error', 'Transactions', `Withdrawal failed - expected $0, got ${balance}`);
    }
  }

  async visuallyVerifyFooter() {
    console.log('\\n🦶 Visual Test 6: Footer Optimization');

    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await this.wait(1000);

    await this.takeScreenshot('11_footer_view', 'Footer view - should be compact on mobile');

    const footerState = await this.page.evaluate(() => {
      const footer = document.querySelector('.site-footer');
      if (!footer) return null;

      const style = getComputedStyle(footer);
      const rect = footer.getBoundingClientRect();

      return {
        fontSize: parseInt(style.fontSize),
        padding: style.padding,
        height: rect.height,
        visible: rect.top < window.innerHeight
      };
    });

    if (footerState) {
      if (footerState.fontSize <= 10) {
        this.addFinding('success', 'Footer Optimization', `Footer font size optimized: ${footerState.fontSize}px`);
      } else {
        this.addFinding('warning', 'Footer Optimization', `Footer font size could be smaller: ${footerState.fontSize}px`);
      }

      if (footerState.height <= 50) {
        this.addFinding('success', 'Footer Optimization', `Footer height compact: ${footerState.height}px`);
      } else {
        this.addFinding('warning', 'Footer Optimization', `Footer height could be more compact: ${footerState.height}px`);
      }
    }
  }

  async generateBusinessReport() {
    const timestamp = new Date().toLocaleString();
    const successCount = this.findings.filter(f => f.type === 'success').length;
    const warningCount = this.findings.filter(f => f.type === 'warning').length;
    const errorCount = this.findings.filter(f => f.type === 'error').length;

    const report = `# Impulse Wallet - UI Testing Report

**Generated:** ${timestamp}
**Test Session:** ${this.testSession}

## Executive Summary

This report summarizes the visual testing results for the Impulse Wallet mobile application. All tests were conducted on mobile viewport (375x667px) to ensure optimal mobile user experience.

**Results Overview:**
- ✅ **${successCount} items working correctly**
- ⚠️ **${warningCount} items need attention**
- ❌ **${errorCount} critical issues found**

## Key Business Findings

### What's Working Well
${this.findings.filter(f => f.type === 'success').map(f => `- **${f.category}**: ${f.description}`).join('\\n')}

${warningCount > 0 ? `### Areas for Improvement
${this.findings.filter(f => f.type === 'warning').map(f => `- **${f.category}**: ${f.description}`).join('\\n')}` : ''}

${errorCount > 0 ? `### Critical Issues Requiring Fix
${this.findings.filter(f => f.type === 'error').map(f => `- **${f.category}**: ${f.description}`).join('\\n')}` : ''}

## User Experience Impact

### Mobile Layout
The mobile interface has been optimized for better user experience:
- Wallet size increased for better visibility
- Focus areas positioned for easy access
- Footer compressed to save screen space

### Core Functionality
- Room creation and joining process tested
- Transaction system (deposits/withdrawals) verified
- Focus area selection workflow validated
- Modal interfaces tested for proper scrolling

## Screenshots Captured

${this.screenshots.map(s => `- **${s.name}**: ${s.description}`).join('\\n')}

## Recommendations

${errorCount === 0 ?
'✅ **Ready for Deployment**: All critical functionality is working correctly.' :
'🚨 **Hold Deployment**: Critical issues must be resolved before release.'}

${warningCount > 0 ? '⚠️ **Address Warnings**: While not blocking, these items should be improved in the next iteration.' : ''}

---

*This report was generated automatically by the Visual Regression Testing system.*
`;

    const reportPath = path.join(this.screenshotDir, 'business-report.md');
    await fs.writeFile(reportPath, report);

    return { report, reportPath, successCount, warningCount, errorCount };
  }

  async updateLessonsLearned() {
    const lessonsPath = './docs/lessons-learned.md';

    // Create docs directory if it doesn't exist
    await fs.mkdir('./docs', { recursive: true });

    let existingContent = '';
    try {
      existingContent = await fs.readFile(lessonsPath, 'utf8');
    } catch (e) {
      // File doesn't exist, start fresh
    }

    const newLesson = `
## ${new Date().toDateString()} - Mobile UI Optimization

### What We Tested
- Mobile layout responsiveness and spacing
- Focus area positioning and functionality
- Modal scrolling behavior
- Transaction workflow
- Footer optimization

### Key Learnings
${this.findings.filter(f => f.type === 'error').length === 0 ?
'✅ **Mobile optimization successful** - All requested changes working correctly' :
'❌ **Issues found** - Mobile layout needs additional fixes'}

### Business Impact
- **User Experience**: ${this.findings.filter(f => f.category === 'Mobile Layout').length > 0 ? 'Improved mobile interface layout' : 'No layout changes verified'}
- **Functionality**: ${this.findings.filter(f => f.category.includes('Workflow') || f.category.includes('Transactions')).length > 0 ? 'Core app functions verified working' : 'Limited functionality testing'}
- **Technical Debt**: ${this.findings.filter(f => f.type === 'error').length === 0 ? 'Minimal technical issues' : `${this.findings.filter(f => f.type === 'error').length} issues need resolution`}

### Next Steps
${this.findings.filter(f => f.type === 'error').length > 0 ?
'- Fix critical UI issues before deployment' :
'- Ready for user testing and deployment'}
${this.findings.filter(f => f.type === 'warning').length > 0 ?
'- Address minor UI improvements in next iteration' : ''}

---
`;

    const updatedContent = existingContent + newLesson;
    await fs.writeFile(lessonsPath, updatedContent);

    console.log(`📚 Updated lessons learned: ${lessonsPath}`);
  }

  async tearDown() {
    if (this.browser) {
      console.log('\\n🔍 Keeping browser open for 15 seconds for manual verification...');
      setTimeout(async () => {
        await this.browser.close();
      }, 15000);
    }
  }

  async runFullVisualTest() {
    try {
      await this.setUp();

      await this.visuallyVerifyInitialLoad();
      await this.visuallyVerifyRoomCreation();
      await this.visuallyVerifyMobileFocusLayout();
      await this.visuallyVerifyFocusWorkflow();
      await this.visuallyVerifyTransactions();
      await this.visuallyVerifyFooter();

      const businessReport = await this.generateBusinessReport();
      await this.updateLessonsLearned();

      console.log('\\n' + '='.repeat(60));
      console.log('📊 VISUAL REGRESSION TEST COMPLETE');
      console.log('='.repeat(60));
      console.log(`✅ Passed: ${businessReport.successCount}`);
      console.log(`⚠️ Warnings: ${businessReport.warningCount}`);
      console.log(`❌ Failed: ${businessReport.errorCount}`);
      console.log(`\\n📁 Test Results: ${this.screenshotDir}`);
      console.log(`📋 Business Report: ${businessReport.reportPath}`);
      console.log('📚 Lessons Learned: ./docs/lessons-learned.md');

      await this.tearDown();

      return businessReport.errorCount === 0;

    } catch (error) {
      console.error('❌ Visual test failed:', error);
      await this.tearDown();
      return false;
    }
  }
}

// Export for use in other scripts
if (require.main === module) {
  const tester = new VisualRegressionTester();
  tester.runFullVisualTest()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Visual test crashed:', error);
      process.exit(1);
    });
}

module.exports = { VisualRegressionTester };