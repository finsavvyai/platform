# LunaForge Extension - Onboarding Test Plan

## Test Date: 2025-11-27
## Version: 2.1.0
## Publisher: FinsavvyTechnologies

---

## 1. Marketplace Experience

### 1.1 Extension Discovery
- [ ] Extension appears in VS Code Marketplace search
- [ ] Extension listing shows correct metadata (name, description, version)
- [ ] Icon displays correctly
- [ ] Screenshots/images are visible and helpful
- [ ] README content is clear and informative

### 1.2 Installation
- [ ] "Install" button is visible and functional
- [ ] Extension installs without errors
- [ ] Installation completes in reasonable time
- [ ] Extension appears in Extensions sidebar after installation

---

## 2. First Activation

### 2.1 Initial Load
- [ ] Extension activates on first workspace open
- [ ] No errors in Developer Console
- [ ] Extension status shows as "Active"
- [ ] Activation time is acceptable (< 5 seconds)

### 2.2 Welcome Experience
- [ ] Welcome notification appears for first-time users
- [ ] Welcome message is clear and helpful
- [ ] Action buttons are functional:
  - [ ] "Take a Tour" button
  - [ ] "Learn More" button
  - [ ] "Dismiss" button

### 2.3 Command Palette
- [ ] All LunaForge commands appear in Command Palette
- [ ] Commands are properly categorized
- [ ] Command descriptions are clear
- [ ] Keyboard shortcuts work as expected

---

## 3. Control Center Onboarding

### 3.1 Opening Control Center
- [ ] Command: "LunaForge: Open Control Center" works
- [ ] Keyboard shortcut (Cmd+Shift+L L) works
- [ ] Control Center webview opens successfully
- [ ] UI loads without errors

### 3.2 First-Time UI
- [ ] Welcome notification appears in Control Center
- [ ] UI is responsive and interactive
- [ ] All sections are visible:
  - [ ] Status indicators
  - [ ] Graph metrics
  - [ ] Mode management
  - [ ] License information
  - [ ] Notifications panel

### 3.3 Interactive Tour (if implemented)
- [ ] Tour starts when "Take a Tour" is clicked
- [ ] Tour highlights key features
- [ ] Tour can be skipped
- [ ] Tour completion is tracked

---

## 4. Core Feature Discovery

### 4.1 Graph Building
- [ ] "Build Project Graph" command is discoverable
- [ ] First graph build shows progress indicator
- [ ] Success notification appears after build
- [ ] Graph metrics are displayed in Control Center

### 4.2 Mode Exploration
- [ ] "List Available Modes" command works
- [ ] Mode descriptions are clear
- [ ] Premium modes show upgrade prompt
- [ ] Free modes can be activated

### 4.3 Documentation Access
- [ ] "Open Documentation" command works
- [ ] Documentation link is valid
- [ ] Help resources are accessible
- [ ] "Show Welcome Guide" can be re-accessed

---

## 5. License & Payment Flow

### 5.1 Free Tier Experience
- [ ] Free tier limitations are clear
- [ ] Upgrade prompts are not intrusive
- [ ] Free features work as expected
- [ ] No payment required for basic functionality

### 5.2 Upgrade Discovery
- [ ] "Upgrade to Premium" command is visible
- [ ] Pricing information is accessible
- [ ] Upgrade flow is clear
- [ ] Payment options are presented

### 5.3 License Activation
- [ ] "Enter License Key" command works
- [ ] License validation provides feedback
- [ ] Premium features unlock after activation
- [ ] License status is visible in Control Center

---

## 6. User Experience Quality

### 6.1 Performance
- [ ] Extension doesn't slow down VS Code
- [ ] UI interactions are responsive
- [ ] No memory leaks detected
- [ ] Background tasks don't block UI

### 6.2 Error Handling
- [ ] Errors show helpful messages
- [ ] Recovery options are provided
- [ ] Errors don't crash the extension
- [ ] Error logs are accessible

### 6.3 Accessibility
- [ ] UI is keyboard navigable
- [ ] Color contrast is sufficient
- [ ] Screen reader compatible (if applicable)
- [ ] Focus indicators are visible

---

## 7. Post-Installation Engagement

### 7.1 Retention Features
- [ ] Status bar items provide quick access
- [ ] Notifications are timely and relevant
- [ ] Regular feature discovery prompts
- [ ] Update notifications work

### 7.2 Help & Support
- [ ] "Report Issue" command works
- [ ] Issue template is helpful
- [ ] Support resources are linked
- [ ] Community channels are accessible

---

## Test Results Summary

### Critical Issues
- [ ] None identified

### Major Issues
- [ ] None identified

### Minor Issues
- [ ] None identified

### Recommendations
1. 
2. 
3. 

---

## Next Steps
1. Execute manual testing
2. Document findings
3. Implement improvements
4. Re-test critical flows
5. Gather user feedback

---

## Notes
- Test environment: VS Code version ___
- Operating system: ___
- Workspace type: ___
- Additional observations:
