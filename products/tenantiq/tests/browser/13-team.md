# Team Management Tests

> 7 tests | Priority: P1

## Prerequisites
- Signed in as admin user with team management permissions

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Team page | Go to /team | Member table with current user | |
| 2 | Current user | Check table | Shows "You" tag next to your entry | |
| 3 | Invite form | Check invite section | Email input + role dropdown + Send button | |
| 4 | Send invite | Enter email, select Viewer, click "Send Invite" | Toast: "Invitation sent", invite URL shown | |
| 5 | Copy invite | Click "Copy" on invite URL | Toast: "Invite link copied" | |
| 6 | Pending section | After invite | Shows pending invitation with email, role, revoke button | |
| 7 | Revoke invite | Click "Revoke" | Toast: "Invitation revoked", invite disappears | |
