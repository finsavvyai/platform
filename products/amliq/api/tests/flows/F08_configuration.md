# F08: Screening Configuration

**Objective:** Verify configuration controls for screening algorithm parameters.
**Prerequisites:** Authenticated admin user, navigate to `/config`

## Test Steps

1. **Page Load:** Navigate to `/config`, verify title "Screening Configuration", page loads in <2 seconds, no errors
2. **Threshold Sliders:** Verify 5 sliders with labels and current values: Jaro-Winkler Sensitivity (0.85), Levenshtein Max Distance (2), Phonetic Match Weight (0.15), Token Set Min Overlap (0.70), Embedding Cosine Threshold (0.75). Verify ranges displayed
3. **Adjust Slider:** Click Jaro-Winkler slider, drag right to 0.90, verify value updates in real-time, release, verify final value displays
4. **Auto-Clear Threshold:** Verify "Auto-Clear Settings" section with slider (e.g., 0.95 = 95% confidence). Adjust to 0.90. Verify tooltip explains auto-clearing below threshold
5. **Auto-Escalate Threshold:** Verify "Auto-Escalate Threshold" slider (e.g., 0.75). Adjust to 0.80. Verify alerts above 80% will auto-escalate
6. **Matching Layer Toggles:** Verify toggles for: Phonetic Matching, Embedding-Based Matching, Graph/Network Matching, Fuzzy String Matching. Toggle "Phonetic" OFF, verify explanation appears. Toggle back ON
7. **Apply Conservative Preset:** Verify "Configuration Presets" buttons: Conservative, Balanced, Aggressive, Israeli Regulation. Click "Conservative", verify "Apply Conservative settings?" confirmation. Click "Apply", verify all sliders update to conservative values (Jaro-Winkler 0.90, Levenshtein 1, Auto-Clear 0.98). Verify description: "Optimized for precision - fewer false positives"
8. **Apply Israeli Regulation:** Click "Israeli Regulation" preset, verify confirmation, click "Apply", verify values change to regulatory-compliant settings
9. **Apply Aggressive Preset:** Click "Aggressive", verify values change (Jaro-Winkler 0.75, Auto-Clear 0.85). Verify description: "Optimized for sensitivity - catches more, more false positives"
10. **Impact Preview:** Verify impact metrics update in real-time: False Positive Rate (e.g., "3.2%"), Detection Rate (e.g., "94.5%"), Review Queue Impact (e.g., "24 alerts/day"), Auto-Clear Rate (e.g., "45%"). Adjust Jaro-Winkler slider, verify preview updates
11. **Test in Sandbox:** Click "Test in Sandbox", verify loading indicator, wait <10 seconds, verify results: entities tested (487), new matches detected (45), comparison to current settings (5 new matches). Verify "View Detailed Results" link opens report
12. **Save Configuration:** Verify all settings adjusted. Click "Save", verify "Configuration saved successfully" message with timestamp. Navigate away and back—verify settings persist
13. **Rollback:** Adjust settings dramatically. Click "Reset to Default", verify "Reset all settings to factory defaults?" confirmation. Click "Confirm", verify all sliders return to default values
14. **Configuration History:** Verify "Configuration History" section listing past changes: date/time, user, previous values, new values. Verify "Restore" option on historical config
15. **Mobile (375px):** Resize to mobile, verify sliders are draggable with touch, all controls visible without horizontal scroll, values update correctly, preset buttons accessible

## Validation

- All sliders adjust correctly; presets apply correct values
- Impact preview updates in real-time
- Sandbox testing completes and shows results
- Configuration saves and persists
- No console errors

## Expected Result

Configuration page allows admins to adjust algorithm parameters with real-time impact preview, apply presets, test configurations, and save changes with audit trail.

---

*F08 | Configuration | 2026-03-26*
