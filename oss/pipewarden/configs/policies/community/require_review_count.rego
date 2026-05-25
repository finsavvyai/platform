package pipewarden.require_review_count

min_reviews := 2

default deny := []

deny contains msg if {
	count(input.run.reviews) < min_reviews
	msg := sprintf("PR has %d reviews; need at least %d", [count(input.run.reviews), min_reviews])
}
