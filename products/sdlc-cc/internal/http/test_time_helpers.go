package http

import "time"

// Test-only time bounds for pulling every audit row from an
// InMemoryRepository regardless of when it was created. Live in
// the production package because Go's _test.go convention won't
// let us reuse them across both _test.go files in this package
// without duplicating; this file ships in test builds only as
// long as no production code imports zeroTime / farFuture.

func zeroTime() time.Time   { return time.Unix(0, 0) }
func farFuture() time.Time  { return time.Unix(1<<40, 0) }
