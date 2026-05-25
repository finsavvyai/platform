package sql

import (
	"fmt"
	"strconv"
	"time"
)

// Helper functions for type conversion
func toInt32(v interface{}) (int32, error) {
	switch val := v.(type) {
	case int:
		return int32(val), nil
	case int32:
		return val, nil
	case int64:
		return int32(val), nil
	case float64:
		return int32(val), nil
	case string:
		i, err := strconv.Atoi(val)
		return int32(i), err
	default:
		return 0, fmt.Errorf("invalid type for int32")
	}
}

func toDuration(v interface{}) (time.Duration, error) {
	switch val := v.(type) {
	case string:
		return time.ParseDuration(val)
	case int:
		return time.Duration(val), nil
	case int64:
		return time.Duration(val), nil
	case float64:
		return time.Duration(val), nil
	default:
		return 0, fmt.Errorf("invalid type for duration")
	}
}
