# Screenshot Capture Instructions

## Overview
This guide provides step-by-step instructions for capturing real screenshots to replace the placeholder SVG files in the onboarding guide.

## Prerequisites
1. Local development server running (`npm run dev`)
2. Application accessible at http://localhost:8788
3. Screenshot tool (built-in macOS Screenshot, Windows Snipping Tool, or browser dev tools)
4. Image optimization tool (optional but recommended)

## Screenshot Requirements

### Technical Specifications
- **Format**: PNG or JPG (PNG preferred for UI screenshots)
- **Resolution**: Minimum 400px width, maintain aspect ratio
- **File Size**: Optimize to under 200KB each for web performance
- **Naming**: Use descriptive filenames matching existing SVG files

### Quality Standards
- **Clean Interface**: Clear, readable text and UI elements
- **Representative Content**: Show realistic data, not empty states
- **Consistent Styling**: Capture screenshots with consistent lighting/contrast
- **Mobile Responsive**: Consider how images will display on mobile devices

## Step-by-Step Capture Instructions

### 1. First Screen Interface (`first-screen-interface.png`)

**Setup:**
1. Open fresh incognito/private browser window
2. Navigate to http://localhost:8788
3. Clear any existing data to show initial state

**Capture:**
- **Target**: The initial create/join room interface
- **Content**: Room code input, display name field, invite code field, Create/Join buttons
- **State**: Empty form with placeholder text visible
- **Browser Window**: Resize to ~800px width for optimal framing

**Replace**: `/screenshots/first-screen-interface.svg`

---

### 2. Focus Area Selection (`focus-area-selection.png`)

**Setup:**
1. Navigate to main app interface
2. Click "Weekly Focus" button to open modal

**Capture:**
- **Target**: The weekly focus picker modal
- **Content**: Grid of focus area checkboxes, some selected (2-3 areas)
- **State**: Show 2-3 areas selected to demonstrate proper usage
- **Suggested Selection**: "Eat Healthy" + "Scrolling" + "Gratitude"

**Replace**: `/screenshots/focus-area-selection.svg`

---

### 3. Main Wallet Interface (`main-wallet-interface.png`)

**Setup:**
1. Set up realistic demo data:
   - Balance: ~$5-12 (positive but not too high)
   - Focus areas: 2-3 selected areas
   - Room: Join or create demo room with 3-5 members

**Capture:**
- **Target**: Complete main interface
- **Content**:
  - Header with balance and week display
  - Wallet visual with current balance
  - Deposit/Withdrawal buttons
  - Focus areas section (left)
  - Room leaderboard (right)
  - Footer buttons (History, Undo)
- **State**: Active state with realistic data

**Replace**: `/screenshots/main-wallet-interface.svg`

---

### 4. Room Creation Flow (`room-creation-flow.png`)

**Setup:**
1. Create a room or access existing room settings
2. Open "Room Settings" from the header menu

**Capture:**
- **Target**: Room settings/management modal
- **Content**:
  - Room code display with copy button
  - Privacy settings (Open/Invite Only) - show "Open" selected
  - Member limit dropdown
  - Current members list (3-5 members)
  - Save/Cancel buttons
- **State**: Show populated room with members

**Replace**: `/screenshots/room-creation-flow.svg`

---

### 5. Room Leaderboard (`room-leaderboard.png`)

**Setup:**
1. Join a room with multiple members
2. Ensure room has varied balances and streaks

**Capture:**
- **Target**: Just the room leaderboard section
- **Content**:
  - Room name/code header
  - 4-6 member rankings
  - Mix of positive/negative balances
  - Varying streak lengths
  - Current user highlighted
- **State**: Show realistic ranking progression

**Replace**: `/screenshots/room-leaderboard.svg`

---

### 6. History Modal (`history-modal.png`)

**Setup:**
1. Create transaction history with varied entries
2. Include both deposits and withdrawals
3. Add descriptive notes to transactions
4. Click "My History" button

**Capture:**
- **Target**: Complete history modal
- **Content**:
  - Time period selector (show "This Week" selected)
  - Week summary stats
  - Transaction timeline with dates
  - Mix of +$1 and -$1 entries with notes
  - Export CSV button
  - Close button
- **State**: Show active week with 8-12 transactions

**Replace**: `/screenshots/history-modal.svg`

## Image Processing Steps

### After Capturing Screenshots:

1. **Crop Appropriately**
   - Remove unnecessary browser chrome
   - Focus on the specific interface element
   - Maintain reasonable padding/whitespace

2. **Optimize File Size**
   - Use tools like ImageOptim (Mac), TinyPNG (web), or Squoosh (web)
   - Target: Under 200KB per image
   - Maintain visual quality while reducing file size

3. **Test Responsiveness**
   - View images on mobile devices
   - Ensure text remains readable at smaller sizes
   - Check that important UI elements are visible

4. **Update Alt Text (if needed)**
   - Review existing alt text in HTML/markdown files
   - Update if actual screenshot content differs significantly
   - Maintain accessibility standards

## File Replacement Process

1. **Backup Originals**
   ```bash
   # Create backup of placeholder SVGs
   mkdir screenshots/svg-backups
   cp screenshots/*.svg screenshots/svg-backups/
   ```

2. **Replace Files**
   - Save new screenshots with exact same filenames as SVG placeholders
   - Place in `/ui-pages/public/screenshots/` directory
   - Verify file paths match existing references

3. **Test Integration**
   - Refresh onboarding guide pages
   - Verify screenshots load correctly
   - Check responsive behavior on mobile
   - Test both HTML and Markdown versions

## Quality Checklist

Before finalizing screenshots, verify:

- [ ] All screenshots show realistic, representative data
- [ ] Text is clearly readable at standard viewing sizes
- [ ] UI elements are properly visible and aligned
- [ ] File sizes are optimized for web performance
- [ ] Screenshots match the onboarding flow narrative
- [ ] Mobile responsiveness is maintained
- [ ] All placeholder SVGs have been replaced
- [ ] Both HTML and Markdown guides display correctly

## Troubleshooting

**Common Issues:**
- **Blurry screenshots**: Ensure high DPI/Retina display capture
- **Large file sizes**: Use image compression tools
- **Inconsistent styling**: Capture all screenshots in same session
- **Missing content**: Verify demo data is properly set up

**Browser Dev Tools Method:**
1. Open Developer Tools (F12)
2. Use device simulation for consistent viewport
3. Use "Screenshot" functionality in dev tools
4. Captures clean UI without browser chrome

## Notes for Future Updates

- Keep original SVG placeholders as backups
- Update screenshots when major UI changes occur
- Consider automating screenshot capture for CI/CD
- Document any specific demo data setup requirements
- Maintain consistent screenshot style and quality standards

---

*This process enhances the onboarding experience by providing visual context that reduces cognitive load and helps users quickly understand the interface and key functionality.*