package domain

import "fmt"

type SeatLimit struct {
	BaseSeatCount     int
	PricePerSeatCents int
	MaxSeats          int
}

func NewSeatLimit(baseSeatCount, pricePerSeatCents, maxSeats int) (SeatLimit, error) {
	if baseSeatCount <= 0 || pricePerSeatCents < 0 {
		return SeatLimit{}, fmt.Errorf("invalid seat limit parameters")
	}
	return SeatLimit{
		BaseSeatCount:     baseSeatCount,
		PricePerSeatCents: pricePerSeatCents,
		MaxSeats:          maxSeats,
	}, nil
}

func (sl SeatLimit) CostForSeats(count int) int {
	if count <= sl.BaseSeatCount {
		return 0
	}
	additionalSeats := count - sl.BaseSeatCount
	return additionalSeats * sl.PricePerSeatCents
}

func (sl SeatLimit) TotalMonthlyForSeats(count, baseMonthlyPrice int) int {
	return baseMonthlyPrice + sl.CostForSeats(count)
}
