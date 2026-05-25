package server

import (
	"time"
)

// getCurrentTime returns the current time
func getCurrentTime() time.Time {
	return time.Now().UTC()
}

// getCurrentTimestamp returns the current timestamp in ISO format
func getCurrentTimestamp() string {
	return getCurrentTime().Format("2006-01-02T15:04:05.000Z")
}