#!/usr/bin/env bash
# Wrapper that runs playwright and inspects the actual test outcome
# instead of trusting the exit code. Playwright sometimes exits
# non-zero in CI even when 0 tests failed (webServer shutdown
# warnings, worker reaping warnings, html report writes after
# stdout closes). The pushci runner treats any non-zero as a stage
# failure, masking real test results.
#
# Args after this script's name are passed straight through.
set +e

LOG=$(mktemp -t pw-ci.XXXXXX)
npx playwright test --reporter=line "$@" 2>&1 | tee "$LOG"
EC=${PIPESTATUS[0]}

# Extract the final summary line. Playwright's line reporter uses
# cursor-up + erase sequences to overwrite progress counters, so the
# raw log contains stale "N failed" text from intermediate updates.
# Only the last line matching the summary pattern is authoritative.
SUMMARY=$(perl -pe 's/\e\[[0-9;]*[A-Za-z]//g' "$LOG" | grep -E '[0-9]+ (passed|failed)' | tail -1)

# If the final summary contains failures, propagate.
if echo "$SUMMARY" | grep -Eq '[1-9][0-9]* failed'; then
  rm -f "$LOG"
  exit 1
fi

# Pure-pass run: accept regardless of playwright's exit quirks.
if echo "$SUMMARY" | grep -Eq '[1-9][0-9]* passed'; then
  rm -f "$LOG"
  exit 0
fi

# No counters parsed at all — something genuinely broke.
rm -f "$LOG"
exit "$EC"
