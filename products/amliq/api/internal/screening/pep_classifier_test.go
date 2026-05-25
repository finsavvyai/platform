package screening

import (
	"testing"
)

func TestPEPClassify(t *testing.T) {
	for _, tt := range pepClassifyTestCases {
		t.Run(tt.name, func(t *testing.T) {
			classifier := NewPEPClassifier(tt.screeningCountry)
			result := classifier.Classify(tt.profile)
			if result != tt.expectedClassType {
				t.Errorf("got %v, want %v", result, tt.expectedClassType)
			}
		})
	}
}
