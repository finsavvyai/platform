package domain

import "testing"

func TestNewSeatLimit(t *testing.T) {
	tests := []struct {
		base    int
		price   int
		max     int
		wantErr bool
	}{
		{3, 4900, 100, false},
		{0, 4900, 100, true},
		{-1, 4900, 100, true},
		{3, -1, 100, true},
	}
	for _, tt := range tests {
		_, err := NewSeatLimit(tt.base, tt.price, tt.max)
		if (err != nil) != tt.wantErr {
			t.Errorf("NewSeatLimit(%d, %d, %d) error = %v, wantErr %v",
				tt.base, tt.price, tt.max, err, tt.wantErr)
		}
	}
}

func TestCostForSeats(t *testing.T) {
	sl, _ := NewSeatLimit(3, 4900, 100)
	tests := []struct {
		count int
		want  int
	}{
		{1, 0},
		{3, 0},
		{4, 4900},
		{5, 9800},
		{10, 34300},
	}
	for _, tt := range tests {
		if got := sl.CostForSeats(tt.count); got != tt.want {
			t.Errorf("CostForSeats(%d) = %d, want %d", tt.count, got, tt.want)
		}
	}
}

func TestTotalMonthlyForSeats(t *testing.T) {
	sl, _ := NewSeatLimit(3, 4900, 100)
	basePrice := 29900
	tests := []struct {
		count int
		want  int
	}{
		{3, 29900},
		{4, 34800},
		{5, 39700},
	}
	for _, tt := range tests {
		got := sl.TotalMonthlyForSeats(tt.count, basePrice)
		if got != tt.want {
			t.Errorf("TotalMonthlyForSeats(%d) = %d, want %d", tt.count, got, tt.want)
		}
	}
}
