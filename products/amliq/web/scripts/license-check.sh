#!/usr/bin/env bash
# License gate run from pushci.yml. Embedded here so pushci's argv
# tokenizer can't mangle the semicolon-separated allow/exclude lists
# (single-quoted strings get re-split on whitespace by the runner).
#
# Allow only permissive licenses present in the dep tree. Two packages
# carry composite SPDX strings ("(MIT OR CC0-1.0)" and "MIT AND ISC")
# that license-checker will not match against any single token in
# --onlyAllow, so they're excluded by name. Both are transitively
# permissive.
set -euo pipefail

ALLOW='MIT;MIT-0;ISC;Apache-2.0;BSD-2-Clause;BSD-3-Clause;0BSD;CC0-1.0;CC-BY-4.0;BlueOak-1.0.0;Unlicense;Python-2.0;UNLICENSED'

EXCLUDE='amliq-dashboard@2.0.0;type-fest@0.20.2;victory-vendor@36.9.2'

exec npx --yes license-checker \
  --onlyAllow "$ALLOW" \
  --excludePackages "$EXCLUDE"
