package domain

import "time"

func GetNowUTC() time.Time {
	return time.Now().UTC()
}
