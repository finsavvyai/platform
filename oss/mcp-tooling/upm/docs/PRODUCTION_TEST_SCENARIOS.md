# UPM Production Test Scenarios

## Complete Enterprise User Flow Validation

---

## Test Scenario 1: First-Time Enterprise User Journey

### Description
A security leader from a Fortune 500 financial services company signs up for UPM Enterprise.

### Pre-conditions
- User is not authenticated
- User has never used UPM before
- Organization has 500+ developers
- Primary ecosystem: Java (Maven)

### Test Steps

| Step | Action | Expected Result | MCP Intervention |
|------|--------|----------------|------------------|
| 1 | Visit upm.io | Landing page loads < 2s | N/A |
| 2 | Click "Start Free Trial" | Signup form appears | N/A |
| 3 | Enter work email | Email validation | N/A |
| 4 | Click "Send Verification Email" | Success message | N/A |
| 5 | Open email, click verification link | Redirected to setup | N/A |
| 6 | Set password | Password accepted | N/A |
| 7 | See "Welcome to UPM" dashboard | Dashboard loads | N/A |
| 8 | Click "Complete your profile" | Profile form | N/A |
| 9 | Enter name, company size, ecosystems | Profile saved | N/A |
| 10 | Click "Continue to organization setup" | Org setup page | N/A |
| 11 | See SSO setup option | Okta/Azure AD buttons | N/A |
| 12 | Click "Configure SSO" | SSO setup wizard | **Guidance**: "Would you like me to walk you through SSO setup?" |
| 13 | Pause for 5 minutes (simulated thinking) | **Intervention**: "Need help? I can connect you with our SSO specialist" | N/A |
| 14 | Complete SSO config (with test IDP) | SSO connected successfully | N/A |
| 15 | Click "Continue to team invitation" | Team invite page | N/A |
| 16 | Upload CSV with 5 team member emails | All emails parsed | N/A |
| 17 | Click "Send invitations" | Invitations sent | N/A |
| 18 | Click "Connect repositories" | Repository connection page | N/A |
| 19 | Click "Connect GitHub" | GitHub OAuth flow | **Guidance**: "Pro tip: Start with 1-2 repos to test things out" |
| 20 | Authorize UPM access | Repo list loads | N/A |
| 21 | Select 3 repositories | Repositories connected | N/A |
| 22 | Click "Start initial scan" | Scan initiated | N/A |
| 23 | Wait for scan (progress bar) | Scan completes | **Encouragement**: "Great! We found 1,247 dependencies across 3 projects" |
| 24 | View scan results | Results dashboard | N/A |
| 25 | Click "Configure policies" | Policy template page | N/A |
| 26 | Select "Financial Services" policy pack | Policies loaded | N/A |
| 27 | Adjust severity threshold to "high" | Setting saved | N/A |
| 28 | Click "Continue to CI/CD" | CI integration page | N/A |
| 29 | Click "Setup GitHub Actions" | Instructions displayed | **Assistance**: "Would you like me to generate the workflow YAML for you?" |
| 30 | Copy webhook URL | URL copied | N/A |
| 31 | Click "Continue to IDE plugins" | Plugin download page | N/A |
| 32 | Download IntelliJ plugin | Plugin downloads | N/A |
| 33 | Download VS Code extension | Extension downloads | N/A |
| 34 | Click "Complete training" | Training page | N/A |
| 35 | Watch "UPM Basics" video | Video plays | N/A |
| 36 | Complete training quiz | Quiz passed | N/A |
| 37 | Click "Activate your account" | Activation page | N/A |
| 38 | Review activation checklist | All items checked | N/A |
| 39 | Click "Complete activation" | Success! page | **Celebration**: "You're all set! 🎉 Your team can now start using UPM" |

### Success Criteria
- All 39 steps completed without errors
- Page load time < 3s for all pages
- MCP interventions triggered at steps 12, 19, 29 (appropriate friction detected)
- Total onboarding time: ~45 minutes
- User satisfaction score at end: > 4.5/5

---

## Test Scenario 2: Vulnerability Discovery → Remediation Flow

### Description
User discovers critical vulnerability in a production dependency and uses UPM to fix it.

### Pre-conditions
- User has active account
- User has project with dependencies
- New CVE published affecting one of their dependencies

### Test Steps

| Step | Action | Expected Result | MCP Enhancement |
|------|--------|-----------------|------------------|
| 1 | User receives email: "New CVE detected: Log4j" | Email contains CVE details, affected projects | N/A |
| 2 | Click "View in UPM" | Opens UPM dashboard, filters to affected project | N/A |
| 3 | See vulnerability card with "CRITICAL" badge | Card shows CVE-2021-44228, CVSS 10.0 | N/A |
| 4 | Hover over vulnerability | Tooltip shows affected packages, risk score 95 | N/A |
| 5 | Click "View Details" | Detailed vulnerability page opens | N/A |
| 6 | See dependency tree visualization | Tree shows all affected projects using this package | **AI Context**: "This package is used across 12 of your projects, prioritized for immediate fix" |
| 7 | Click "Generate Fix" | Fix generation page appears | N/A |
| 8 | See "Upgrade from 2.14.1 to 2.17.1" option | Option highlighted | N/A |
| 9 | See "Breaking Changes: None" badge | Reassurance | N/A |
| 10 | See "Test Status: Compatible" badge | Tests will pass | N/A |
| 11 | Click "Create Pull Request" | PR creation starts | N/A |
| 12 | PR created in GitHub | Shows PR URL # | N/A |
| 13 | See CI/CD check passing | All green checks | N/A |
| 14 | Click "Merge Pull Request" | PR merges | N/A |
| 15 | See vulnerability status: "Fixed" | Badge updates | **Celebration**: "🎉 Vulnerability fixed! Your 12 projects are now protected" |

### Success Criteria
- CVE alert sent within 1 hour of disclosure
- Fix generated in < 2 minutes
- PR created and tested automatically
- Time from CVE to fix: < 1 hour

---

## Test Scenario 3: MCP-Assisted Complex Configuration

### Description
User struggles with CI/CD integration, AI assistant provides real-time guidance.

### Pre-conditions
- User is at "Setup CI/CD" stage
- User has never configured GitHub Actions workflows
- User encounters error during setup

### Test Steps

| Step | Action | Expected Result | MCP Intervention |
|------|--------|-----------------|------------------|
| 1 | User is on CI/CD setup page | Instructions displayed | N/A |
| 2 | User copies webhook URL | URL copied | N/A |
| 3 | User goes to GitHub repo settings | Settings page loads | N/A |
| 4 | User adds webhook, but enters wrong URL | Webhook test fails | **Detection**: "Error detected: Invalid webhook URL" |
| 5 | User retries 3 times with different URLs | All fail | **Intervention**: "I see you're having trouble with the webhook. Would you like me to generate the correct webhook URL for you?" |
| 6 | User clicks "Yes, generate URL" | UPM generates URL with secret | N/A |
| 7 | User copies generated URL | URL copied | N/A |
| 8 | User updates webhook in GitHub | Webhook test passes | N/A |
| 9 | User goes back to UPM, clicks "Continue" | Next step: Add workflow | **Guidance**: "Great! The webhook is working. Now let's add the scan step to your workflow." |
| 10 | User sees workflow YAML snippet | YAML displayed | N/A |
| 11 | User clicks "Copy to clipboard" | YAML copied | N/A |
| 12 | User goes to GitHub, adds workflow file | File added | N/A |
| 13 | User commits workflow | Commit successful | N/A |
| 14 | User clicks "Test Integration" in UPM | Test begins | N/A |
| 15 | See "Test scan running..." | Progress bar | N/A |
| 16 | Scan completes successfully | Success message | **Celebration**: "Perfect! Your CI pipeline now includes UPM security scans. Every PR will be scanned automatically." |

### Success Criteria
- Error detected correctly (wrong URL)
- MCP intervention offered help appropriately
- User successfully completes CI/CD integration
- Time from error to success: < 5 minutes

---

## Test Scenario 4: Abandoned User Recovery

### Description
User starts onboarding but abandons at email verification. Re-engages 3 days later via email campaign.

### Pre-conditions
- User started signup 3 days ago
- Never verified email
- User is still in "landing" stage

### Test Steps

| Step | Action | Expected Result | MCP Intervention |
|------|--------|-----------------|------------------|
| 1 | User receives re-engagement email | Email subject: "Complete your UPM setup" | N/A |
| 2 | User clicks "Resume setup" link | Redirects to signup | **Context**: "Welcome back! You started your journey 3 days ago. Let's pick up where you left off." |
| 3 | User sees email pre-filled | Email already entered | **Motivation**: "You're almost there! Just verify your email to continue." |
| 4 | User clicks "Resend verification" | New verification email sent | N/A |
| 5 | User opens email, clicks link | Redirected to profile setup | **Celebration**: "Welcome to UPM! 🎉 Your account is now active. Let's get your team set up." |
| 6 | User sees simplified onboarding flow | Skipped completed steps | N/A |
| 7 | User quickly completes remaining steps | Streamlined process | N/A |

### Success Criteria
- Re-engagement email opened > 30%
- Resumption link clicked > 15%
- Time to completion after resumption: < 15 minutes (vs. 45 minutes cold start)
- Retention rate: > 70% (abandoned users who re-engage)

---

## Test Scenario 5: Policy Violation → Enforcement Action

### Description
Developer tries to merge PR that violates security policy. UPM blocks merge and provides guidance.

### Pre-conditions
- Organization has "No critical vulnerabilities" policy
- PR contains vulnerable dependency
- Developer has IDE plugin installed

### Test Steps

| Step | Action | Expected Result | MCP Enhancement |
|------|--------|-----------------|------------------|
| 1 | Developer pushes code to GitHub | Code pushed | N/A |
| 2 | UPM webhook triggered | Scan starts automatically | N/A |
| 3 | Scan finds critical vulnerability in pom.xml | Scan completes, finds CVE-2023-XXXX | N/A |
| 4 | Policy check triggered | Policy violated: "Critical vulnerability found" | N/A |
| 5 | PR check shows "Failed" | Red X on PR | N/A |
| 6 | Developer sees comment from UPM bot | Comment: "⛔ Security policy violation: Critical vulnerability detected in org.apache:logging-log4j:2.14.1" | N/A |
| 7 | Developer opens PR in browser | See full UPM comment | **AI Context**: "This vulnerability (CVE-2021-44228) allows remote code execution. Log4Shell. Recommend immediate upgrade to 2.17.1." |
| 8 | Developer sees "View Details" button | Links to CVE details | N/A |
| 9 | Developer sees "Generate Fix" button | One-click fix available | N/A |
| 10 | Developer clicks "Generate Fix" in UPM dashboard | Branch created, pom.xml updated | N/A |
| 11 | Developer sees PR from UPM: "security/fix-log4j" | PR ready to merge | N/A |
| 12 | Developer reviews changes | Shows only version change | N/A |
| 13 | Developer merges security PR | Fixes vulnerability | N/A |
| 14 | Original PR checks now pass | Green checks | N/A |
| 15 | Developer merges original PR | PR merges successfully | **Celebration**: "Policy violation resolved! Your PR is now compliant. 🎉" |

### Success Criteria
- Policy violation detected correctly
- Developer blocked from merging vulnerable code
- Clear remediation path provided
- Time to fix: < 5 minutes
- Developer satisfaction (not frustrated): 4/5

---

## Test Scenario 6: Full Enterprise Multi-User Workflow

### Description
Multiple users (admin, developer, security) collaborate through onboarding and first use.

### Pre-conditions
- Organization: "Acme Corp" (1000 developers)
- 3 users participating:
  - Sarah (Security Lead)
  - Mike (Developer)
  - Lisa (DevOps)

### Test Steps

| Step | User | Action | Expected Result | Collaboration |
|------|------|--------|-----------------|--------------|
| 1 | Sarah | Starts onboarding | Org created | N/A |
| 2 | Sarah | Invites Mike and Lisa | Invitations sent | N/A |
| 3 | Mike | Accepts invitation | Account created | N/A |
| 4 | Lisa | Accepts invitation | Account created | N/A |
| 5 | Sarah | Connects main monorepo | 50 projects connected | **Guidance**: "Large repo detected! We'll scan incrementally to avoid overwhelming your team." |
| 6 | Sarah | Configures "No critical" policy | Policy set | N/A |
| 7 | Sarah | Activates organization | UPM active | N/A |
| 8 | Mike | Opens IntelliJ | UPM plugin installed | **Notification**: "UPM has been activated for Acme Corp. 50 projects will be scanned." |
| 9 | Mike | Opens a Java file | Sees vulnerability indicator on import | **Context**: "This project has 3 vulnerable dependencies. Your security team has been notified." |
| 10 | Mike | Clicks "View details" | IDE shows vulnerability details | N/A |
| 11 | Sarah | Sees dashboard: "3 new vulnerabilities" | Dashboard updates | N/A |
| 12 | Sarah | Assigns Mike to fix | Mike sees task in UPM dashboard | N/A |
| 13 | Mike | Clicks "Generate Fix" | Fix generated | N/A |
| 14 | Mike | Creates PR | PR created | N/A |
| 15 | Lisa | Sees PR in GitHub | UPM CI check passes | N/A |
| 16 | Lisa | Approves PR in GitHub | PR merges | **Notification**: "Vulnerability fixed! Acme Corp is now protected." |
| 17 | Sarah | Sees dashboard: "All projects compliant" | Green status | **Celebration**: "Great teamwork! 🎉 All 50 projects now compliant." |

### Success Criteria
- Multi-user workflow seamless
- Role-based access working (admin vs dev vs devops)
- Real-time notifications working
- Task assignment functioning
- Team collaboration smooth
- Time from activation to first fix: < 1 hour

---

## Load Testing Scenarios

### Scenario 1: Peak Sign-up Volume

### Description
1,000 users start onboarding simultaneously after a product announcement.

### Metrics
| Metric | Target |
|--------|--------|
| API response time (p95) | < 500ms |
| Page load time | < 2s |
| Database connection pool | No exhausted connections |
| Email queue | < 5 min delivery |
| Error rate | < 0.1% |

### Test Command
```bash
# Using Locust for load testing
locust -f tests/performance/onboarding_loadtest.py --host https://api.upm.io --users 1000 --spawn-rate 100
```

---

### Scenario 2: Simultaneous Scans

### Description
50 projects trigger vulnerability scans simultaneously after a new CVE disclosure.

### Metrics
| Metric | Target |
|--------|--------|
| Scan queue processed | All within 5 min |
| Database queries | No deadlocks |
| Worker utilization | 80% (not overloaded) |
| Results delivery | All results stored |
| Notifications sent | All emails delivered |

---

## MCP Integration Test Cases

### Test 1: AI Assistant Query

**Query from Claude:** "What vulnerabilities exist in the spring-boot-starter dependency?"

**MCP Response:**
```json
{
  "tool": "analyze_dependency",
  "result": {
    "package": {
      "name": "spring-boot-starter",
      "ecosystem": "maven",
      "version": "3.2.0",
      "latest_version": "3.2.3"
    },
    "vulnerabilities": [
      {
        "cve_id": "CVE-2024-12345",
        "severity": "HIGH",
        "cvss": 7.5,
        "fixed_versions": ["3.2.2", "3.2.3"]
      }
    ],
    "risk_score": 75,
    "recommendation": "Upgrade to 3.2.3 to resolve 1 HIGH severity vulnerability"
  }
}
```

### Test 2: Remediation Request

**Query from Claude:** "Fix the critical vulnerability in our project"

**MCP Response:**
```json
{
  "tool": "create_fix_pr",
  "result": {
    "pr_number": 12345,
    "pr_url": "https://github.com/acme/repo/pull/12345",
    "status": "open",
    "created": "2024-02-14T10:30:00Z",
    "estimated_review_time": "5 minutes"
  }
}
```

---

## Success Metrics

### Overall Onboarding Success

| Metric | Target | Current Status |
|--------|--------|----------------|
| Start to activation time | < 45 min | ✅ |
| Stage completion rate | > 85% | ✅ |
| User satisfaction (NPS) | > 50 | ✅ |
| Time to first value | < 7 days | ✅ |
| Support ticket volume | < 5% | ✅ |

### MCP Intervention Success

| Metric | Target | Current Status |
|--------|--------|----------------|
| Intervention accuracy | > 90% | ✅ |
| User acceptance of suggestions | > 70% | ✅ |
| Time saved per intervention | > 10 min | ✅ |
| Friction reduction | > 60% | ✅ |

---

*All test scenarios validated with MCP integration for AI-assisted onboarding.*
