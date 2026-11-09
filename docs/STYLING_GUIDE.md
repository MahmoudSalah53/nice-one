# Popup Styling Guide

This guide explains how to customize the styling of the LiveKit popup embed.

## Where to Edit Styling

### 1. Button/Trigger Colors (Blue Circle)

The trigger button styling is in:
**File:** `components/embed-popup/trigger.tsx`

**Current Colors:**

- Background when closed: `#002cf2` (blue - fgAccent)
- Background when connected: `#db1b06` (red - destructive)
- Background when connecting: `#f9f9f6` (light gray - bg1)
- Logo background: `#f9f9f6` (light gray - bg1)

**To change the button color when closed:**
Edit line 68 or 88 in `trigger.tsx`:

```typescript
...(!popupOpen && { backgroundColor: '#002cf2' }), // Change this color
```

**To change other colors:**

- Line 69: Color when connected/error
- Line 89: Inner circle color when closed
- Line 90: Inner circle color when connecting
- Line 108: Logo background color

### 2. Button Size and Position

The button size and position are controlled by inline styles:

- **Size:** Lines 85-86 (2.75rem = 44px)
- **Position:** Lines 47-51 in the className and style props
- **Logo size:** Lines 106-107 (20px × 20px)

### 3. Global CSS Variables

All color variables are defined in:
**File:** `public/css/globals_node.css`

Key variables:

```css
--fgAccent: #121c62; /* Main accent color (Noda Tech blue) */
--bg1: #f9f9f6; /* Background color 1 */
--bg2: #f3f3f1; /* Background color 2 */
--destructive: #db1b06; /* Error/destructive color (red) */
```

### 4. Logo

The logo is loaded via CSS mask-image. The logo files should be at:

- `public/lk-logo.svg` (light mode)
- `public/lk-logo-dark.svg` (dark mode)

The logo URL is constructed using the `sandboxId` prop in `trigger.tsx` lines 109-123.

## Debugging Styling Issues

1. **Check browser console:**
   - Look for "CSS injected into shadow DOM" message
   - Check CSS length (should be > 100,000)
   - Check if Tailwind variables are found

2. **Inspect the element:**
   - Open browser DevTools
   - Inspect the button element
   - Check if inline styles are applied
   - Check if CSS classes are recognized

3. **CSS not loading:**
   - If CSS is empty (length: 0), check webpack build
   - Run `pnpm build-embed-popup-script` to rebuild
   - Check `webpack.config.js` CSS loader configuration

## Quick Color Change Examples

### Change Button to Green

In `trigger.tsx`, replace:

```typescript
...(!popupOpen && { backgroundColor: '#002cf2' }), // blue
```

with:

```typescript
...(!popupOpen && { backgroundColor: '#00ff00' }), // green
```

### Change Button to Purple

```typescript
...(!popupOpen && { backgroundColor: '#800080' }), // purple
```

### Make Button Bigger

In `trigger.tsx`, change:

```typescript
width: '2.75rem',  // 44px
height: '2.75rem', // 44px
```

to:

```typescript
width: '4rem',     // 64px
height: '4rem',    // 64px
```

## Rebuilding After Changes

After making styling changes, rebuild the embed:

```bash
cd agent-starter-embed
pnpm build-embed-popup-script
```

Then refresh the page to see your changes.
