# Impulse Wallet UI Revamp - Visual Design System

## Executive Summary
This document outlines a comprehensive visual design system for transforming Impulse Wallet into a gamified, mobile-first experience that leverages the wallet metaphor for habit tracking. The design emphasizes positive psychology, smooth animations, and competitive-yet-encouraging social dynamics.

## Core Design Philosophy

### Visual Style Foundation
- **Primary Aesthetic**: Soft animated graphics with modern, playful elements
- **Color Psychology**: Warm gradients that evoke growth and positivity
- **Typography**: Clean, readable fonts with strategic weight variations
- **Animation Approach**: Smooth, purposeful motion that reinforces the wallet metaphor

### User Experience Principles
1. **Gamification Without Overwhelm**: Game elements feel natural, not forced
2. **Positive Reinforcement**: Every interaction should feel encouraging
3. **Immediate Feedback**: Visual response to all user actions
4. **Mobile-First Accessibility**: Touch-friendly targets, thumb-reachable zones

## Mobile Layout Architecture (Primary Design)

### Screen Hierarchy (Top to Bottom)
```
┌─────────────────────────────┐
│ Header Bar (Simplified)      │
├─────────────────────────────┤
│                            │
│     WALLET CENTER STAGE     │
│      (Visual Focus)         │
│                            │
├─────────────────────────────┤
│ Focus Areas │ Balance/Action │
│  (3 badges)  │   Section     │
├─────────────────────────────┤
│     Competitive Board       │
│    (Progress Indicators)    │
├─────────────────────────────┤
│    Quick Access Panel       │
├─────────────────────────────┤
│         Footer             │
└─────────────────────────────┘
```

## Detailed Component Specifications

### 1. Wallet Header Section (Hero Area)
**Dimensions**: Full width × 240px height
**Position**: Top center, prominent placement

#### Wallet Visual Design
- **Base Image**: wallet.png positioned at center
- **Size**: 120px × 90px on mobile, scales to 180px × 135px on tablet+
- **Shadow**: Soft drop shadow (0 8px 25px rgba(0,0,0,0.12))
- **Border**: Subtle rounded border with gradient outline

#### Dollar Bill System
**Bill Positioning Logic**:
- $1-4: Single bill visible, slight peek from wallet opening
- $5-9: Two bills, staggered layering effect
- $10-14: Three bills, fan pattern
- $15-19: Four bills, more dramatic fan
- $20+: Bills cascade with celebration sparkles

**Bill Animation States**:
```css
/* Example CSS for bill entrance */
.dollar-bill {
  transform: translateY(-20px) rotate(-5deg);
  opacity: 0;
  animation: billEnter 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes billEnter {
  to { 
    transform: translateY(0) rotate(0deg); 
    opacity: 1; 
  }
}
```

#### Animation Zones
- **Entry Zone**: 40px above wallet for incoming bills
- **Exit Zone**: 40px below wallet for outgoing bills
- **Celebration Zone**: 80px radius around wallet for milestone effects

### 2. Focus Areas Section (Left of Wallet)
**Layout**: Vertical stack or horizontal row (responsive)
**Badge Count**: Exactly 3 focus areas displayed

#### Focus Badge Design
**Base State**:
- Dimensions: 80px × 80px (mobile), 100px × 100px (desktop)
- Shape: Rounded rectangle (border-radius: 16px)
- Background: Soft gradient based on focus type
- Border: 2px solid with subtle glow effect

**Color Mapping**:
```scss
$focus-colors: (
  'health': linear-gradient(135deg, #10b981 0%, #059669 100%),
  'work': linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%), 
  'mindfulness': linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%),
  'habits': linear-gradient(135deg, #f59e0b 0%, #d97706 100%)
);
```

**Interactive States**:
1. **Default**: Soft shadow, subtle pulse animation
2. **Hover/Touch**: Scale(1.05), stronger shadow, glow intensifies
3. **Active**: Scale(0.98), inner shadow effect
4. **With Controls**: +/- buttons slide in from sides

#### Badge Content Design
- **Icon**: 24px emoji or simple icon at top
- **Label**: 12px font, truncated if needed
- **Counter**: Bottom right corner, small badge with current streak

**Interaction Pattern**:
```
[Tap Badge] → [Controls Appear] → [+] [-] buttons
                                     ↓
[Tap +/-] → [Animation] → [Update Display] → [Hide Controls]
```

### 3. Balance & Action Section (Right of Wallet)
**Layout**: Vertical stack, right-aligned

#### Balance Display
- **Typography**: 32px bold, gradient text effect
- **Format**: "$XX" with green for positive, red for negative
- **Animation**: Number counting animation on changes
- **Background**: Subtle card background with rounded corners

#### Action Buttons Design
**Deposit Button (+$1)**:
```css
.deposit-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
  border-radius: 12px;
  padding: 16px 24px;
  font-weight: 600;
  color: white;
  position: relative;
  overflow: hidden;
}

.deposit-btn::before {
  content: '💰';
  position: absolute;
  left: 16px;
  font-size: 20px;
}
```

**Withdrawal Button (-$1)**:
```css
.withdrawal-btn {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
  /* Similar styling to deposit, different colors */
}

.withdrawal-btn::before {
  content: '💸';
  /* Red-themed emoji */
}
```

**Button Interactions**:
- **Hover**: translateY(-2px), stronger shadow
- **Active**: scale(0.98), inner glow effect
- **Success**: Ripple animation + floating number

### 4. Leaderboard Section (Competitive Board)
**Purpose**: Show weekly progress toward $20 goal (NOT actual balances)

#### Progress Bar Design
**Individual User Row**:
```
[Avatar] [Name] [Progress Bar ████████░░] [$15/20]
```

**Progress Bar Specifications**:
- **Height**: 12px
- **Background**: Linear gradient track
- **Fill**: Animated gradient based on progress
- **Border Radius**: 6px (pill-shaped)
- **Animation**: Smooth fill on updates

**Progress Bar Colors**:
- 0-25% (Red zone): `linear-gradient(90deg, #fee2e2 0%, #fecaca 100%)`
- 26-75% (Yellow zone): `linear-gradient(90deg, #fef3c7 0%, #fde68a 100%)`
- 76-99% (Green zone): `linear-gradient(90deg, #d1fae5 0%, #a7f3d0 100%)`
- 100% (Winner): `linear-gradient(90deg, #10b981 0%, #059669 100%)` with sparkle effect

#### Ranking Indicators
- **Crown**: Gold crown emoji for #1 position
- **Medals**: Silver/Bronze for 2nd/3rd
- **Progress**: Percentage completion shown
- **Streaks**: Small flame emoji + number for current streaks

### 5. Quick Access Panel (Relocated Elements)
**Layout**: Horizontal scrollable row of quick actions

**Button Design Pattern**:
```css
.quick-action {
  min-width: 120px;
  height: 48px;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  font-weight: 500;
}
```

**Relocated Elements**:
1. **My History**: 📊 + "History"
2. **Room Settings**: ⚙️ + "Room" 
3. **Weekly Focus**: 🎯 + "Focus"
4. **Instructions**: ❓ + "Help"
5. **Undo Last**: ↶ + "Undo" (conditional visibility)

### 6. Animation System Specifications

#### Dollar Bill Movement Animations
**Deposit Animation Sequence**:
1. New bill appears above wallet (scale: 0, opacity: 0)
2. Bill drops into wallet with bounce (duration: 0.8s)
3. Wallet slightly "opens" to receive bill
4. Success particle effect around wallet
5. Balance counter animates upward

**Withdrawal Animation Sequence**:
1. Bill slides out of wallet with slight rotation
2. Bill fades and scales down as it falls
3. Wallet slightly "deflates" or darkens
4. Balance counter animates downward with red tint

#### Milestone Animations
**$20 Achievement**:
- Wallet glows with golden aura
- Confetti particles burst from wallet
- Progress bar fills with rainbow gradient
- Celebration modal with crown animation

#### Micro-Interactions
```css
/* Focus badge pulse */
@keyframes focusPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Progress bar fill animation */
@keyframes progressFill {
  from { width: 0%; }
  to { width: var(--progress-width); }
}

/* Floating success text */
@keyframes floatUp {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-60px) scale(1.2); }
}
```

## Responsive Breakpoints

### Mobile (320-768px)
- Single column layout
- Wallet: 120px × 90px
- Focus badges: 3 in horizontal row
- Action buttons: Full width, stacked
- Leaderboard: Simplified, 4 visible users

### Tablet (769-1024px)
- Two-column layout emerges
- Wallet: 150px × 112px
- Focus badges: Larger, more spacing
- Side-by-side action buttons
- Leaderboard: 6-8 visible users

### Desktop (1025px+)
- Three-column layout
- Wallet: 180px × 135px maximum
- All elements have breathing room
- Hover states become prominent
- Leaderboard: Full list visible

## Color Palette System

### Primary Gradients
```scss
$primary-green: linear-gradient(135deg, #10b981 0%, #059669 100%);
$primary-red: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
$primary-blue: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
$primary-purple: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
```

### Neutral Foundation
```scss
$background: #f6f7f9;
$card-white: rgba(255, 255, 255, 0.95);
$text-primary: #111827;
$text-secondary: #6b7280;
$border-light: rgba(0, 0, 0, 0.08);
```

### State Colors
```scss
$success: #10b981;
$warning: #f59e0b;
$error: #ef4444;
$info: #3b82f6;
```

## Typography Scale

```scss
$font-display: 2rem; // Wallet balance
$font-large: 1.25rem; // Section headings  
$font-base: 1rem; // Body text, buttons
$font-small: 0.875rem; // Labels, metadata
$font-tiny: 0.75rem; // Captions, counters

$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;
```

## Implementation Priority

### Phase 1: Core Wallet Experience
1. Wallet visual with dollar bill system
2. Balance display with animations
3. Deposit/Withdrawal buttons with feedback
4. Basic dollar bill enter/exit animations

### Phase 2: Gamification Elements
1. Focus area badges with interactions
2. Progress bar system for leaderboard
3. Milestone celebration system
4. Competitive ranking indicators

### Phase 3: Polish & Optimization
1. Advanced micro-animations
2. Responsive refinements  
3. Performance optimizations
4. Accessibility improvements

This design system creates a cohesive, engaging experience that transforms habit tracking into a delightful game while maintaining the core functionality and expanding it thoughtfully for mobile-first usage.