package main

import (
	"fmt"
	"regexp"
	"strconv"
)

// expectMatcher closes over the user's `expect:` string and
// decides whether a given response counts as a verify pass.
type expectMatcher func(status int, body string) (bool, string)

// buildExpectMatcher interprets `expect:` as either a numeric
// status code ("200") or a regex matched against the body. An
// empty expect defaults to "status in [200, 399]".
func buildExpectMatcher(expect string) expectMatcher {
	if expect == "" {
		return func(status int, _ string) (bool, string) {
			ok := status >= 200 && status < 400
			return ok, fmt.Sprintf("status=%d", status)
		}
	}
	if code, err := strconv.Atoi(expect); err == nil {
		return func(status int, _ string) (bool, string) {
			return status == code, fmt.Sprintf("status=%d want %d", status, code)
		}
	}
	re, err := regexp.Compile(expect)
	if err != nil {
		return func(_ int, _ string) (bool, string) {
			return false, "invalid expect regex: " + expect
		}
	}
	return func(status int, body string) (bool, string) {
		if re.MatchString(body) {
			return true, "body matches " + expect
		}
		return false, fmt.Sprintf("status=%d body no match", status)
	}
}
