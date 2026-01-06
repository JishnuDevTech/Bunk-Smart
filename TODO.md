# Task: Fix Login Layout - Center Alignment, Proper Borders, and Margin Containment

## Overview
Fix overflow issues in login.html by updating css/auth.css: Center the full layout, reduce max-width/padding for fit, constrain image overlay, adjust form padding for logo (title) alignment, and add/enhance borders for proper containment. Test in browser.

## Steps
1. **Update .full-screen-card**: Set max-width to 1200px, add margin: 0 auto for explicit centering, enhance border for visibility (e.g., 2px solid rgba(255,255,255,0.3)).
2. **Update .image-overlay**: Reduce margins (left/right: 30px, bottom: 40px), add max-width constraint, ensure text centers within overlay.
3. **Update .auth-card**: Reduce padding to 80px 60px for better logo centering, ensure flex centering.
4. **Add borders to sections**: Add subtle borders to .form-section and .image-section (e.g., 1px solid rgba(255,255,255,0.1)) to define boundaries and prevent perceived overflow.
5. **Enhance responsive queries**: Add @media (max-width: 1024px) for intermediate centering adjustments (e.g., max-width: 100%, reduced paddings).
6. **Test layout**: Use browser_action to open login.html, verify centering/borders/no clipping on resized window, close browser.

## Progress
- [ ] Step 1: Update .full-screen-card
- [ ] Step 2: Update .image-overlay
- [ ] Step 3: Update .auth-card
- [ ] Step 4: Add borders to sections
- [ ] Step 5: Enhance responsive queries
- [ ] Step 6: Test layout
