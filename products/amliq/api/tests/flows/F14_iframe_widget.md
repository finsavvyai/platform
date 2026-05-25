# F14: iFrame Widget Integration

**Objective:** Verify iFrame widget embedding, functionality, and cross-origin communication.
**Prerequisites:** iFrame product subscription active, test page with widget integration

## Test Steps

1. **Embed Widget:** Create test HTML page with iFrame code: `<iframe src="https://aegis.local/embed/screen?apiKey=ik_test_xxx" width="100%" height="400" frameborder="0"></iframe>`. Verify page loads without errors
2. **Widget Renders:** Verify widget displays with AMLIQ branding, "Screen Entity" heading, entity name input field, "Screen Now" button. Verify styling matches AMLIQ theme. Verify responsive (resizes with container)
3. **Perform Screening:** Click into input field, type "Mohammed Al-Rashidi", click "Screen Now". Verify loading indicator, results appear in <2 seconds showing entity name, confidence score badge, match status, "View Details" link
4. **Widget Results:** Verify result card displays correctly. Click "View Details"—verify detail modal/lightbox opens within widget showing full evidence, buttons (Confirm, False Positive) available. Close detail—verify returns to form
5. **No Match:** Clear field, type "ZZZ Random No Match", click "Screen Now". Verify result shows "No Match Found". Verify monitoring button still available
6. **Invalid Input:** Leave field empty, click "Screen Now". Verify validation error "Please enter an entity name"
7. **API Key Validation:** Verify widget initialized with correct API key (iFrame product key). Try with wrong key format. Verify error "Invalid API key", no screening occurs
8. **CORS Headers:** Open DevTools > Network, perform screening, inspect XHR request. Verify response includes CORS headers: Access-Control-Allow-Origin, Access-Control-Allow-Methods (GET, POST), Access-Control-Allow-Credentials: true. Verify CORS preflight requests succeed
9. **Cross-Origin Domain:** Test widget on authorized domain (configured in API keys)—verify works. Test on unauthorized domain—verify CORS error in console. Verify screening fails with "Cross-origin request blocked" message to user (if configured)
10. **Usage Tracked:** Verify current iFrame usage before screening. Perform 10 screenings in widget. Navigate to `/billing`. Verify usage incremented by 10 calls. Verify lookups tracked per API key
11. **Dark Theme:** Embed with theme parameter: `?theme=dark`. Verify widget appearance changes to dark mode. Test with `?theme=light`—verify light mode applied. Test custom color: `?primaryColor=%23007bff`—verify button/accent color changes
12. **Responsive Sizing:** Embed in different container widths: 300px, 600px, 100%. Verify widget functional and readable at all sizes. Verify input and button responsive
13. **Mobile:** Embed on mobile test page (375px). Load in mobile browser. Verify full-width display, input touchable, keyboard appears when typing, button touchable (44px+). Perform screening—verify results display
14. **PostMessage API:** Monitor browser console. Perform screening. Verify postMessage events sent from widget. Test listening in parent page:
```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'screening-result') {
    console.log('Result:', event.data);
  }
});
```
15. **Error Handling:** Disable API key (admin panel). Attempt screening. Verify error "API key expired or invalid", no screening performed. Re-enable key—verify widget works again
16. **Session Persistence:** Perform screening, get result. Refresh page (iFrame refreshes). Verify form cleared (no persistence). Verify fresh screening can be performed. Navigate away and back—verify previous results not shown

## Validation

- Widget loads and displays correctly
- Screening functions within widget
- CORS headers correct
- Unauthorized domains blocked
- Usage tracked correctly
- Theming/customization works
- Mobile layout responsive
- Error handling appropriate

## Expected Result

iFrame widget successfully embeds on external pages, performs screenings via configured API key, respects CORS security, tracks usage, and supports customization via URL parameters.

---

*F14 | iFrame Widget | 2026-03-26*
