package api

import (
	"context"
	"os"
	"strconv"
	"time"

	"github.com/aegis-aml/aegis/internal/cache"
)

// listCountsCache memoizes the `SELECT list_id, COUNT(*) FROM entities GROUP BY list_id`
// result for the /lists and /lists/marketplace endpoints. The query is
// tenant-agnostic so a single global entry is sufficient.
//
// TTL defaults to LIST_COUNTS_CACHE_TTL (seconds) or 2 hours. The daily
// refresh job and manual refresh handler call InvalidateListCounts() so the
// next request repopulates immediately after new data lands.
var listCountsCache = cache.NewTTLCache[map[string]int](listCountsTTL())

const listCountsKey = "global"

func listCountsTTL() time.Duration {
	if v := os.Getenv("LIST_COUNTS_CACHE_TTL"); v != "" {
		if secs, err := strconv.Atoi(v); err == nil && secs > 0 {
			return time.Duration(secs) * time.Second
		}
	}
	return 2 * time.Hour
}

// CachedListCounts returns entity counts per list_id, loading through the
// cache on miss. Errors from the loader are returned without caching.
func CachedListCounts(
	ctx context.Context,
	loader func(context.Context) (map[string]int, error),
) (map[string]int, error) {
	if v, ok := listCountsCache.Get(listCountsKey); ok {
		return v, nil
	}
	v, err := loader(ctx)
	if err != nil {
		return v, err
	}
	listCountsCache.Set(listCountsKey, v)
	return v, nil
}

// InvalidateListCounts clears the cached counts. Called after list sync /
// refresh completes so the next request sees fresh data.
func InvalidateListCounts() {
	listCountsCache.Invalidate(listCountsKey)
}
