package security

import (
	"context"
	"testing"
	"time"
)

func TestNewEvidence(t *testing.T) {
	tests := []struct {
		name       string
		evdType    EvidenceType
		collector  string
		tenantID   string
		start      time.Time
		end        time.Time
		wantErr    bool
	}{
		{
			name:       "valid evidence",
			evdType:    EvidenceTypeAccessLog,
			collector:  "audit",
			tenantID:   "tenant1",
			start:      time.Now().Add(-24 * time.Hour),
			end:        time.Now(),
			wantErr:    false,
		},
		{
			name:       "missing collector",
			evdType:    EvidenceTypeAccessLog,
			collector:  "",
			tenantID:   "tenant1",
			start:      time.Now().Add(-24 * time.Hour),
			end:        time.Now(),
			wantErr:    true,
		},
		{
			name:       "missing tenant",
			evdType:    EvidenceTypeAccessLog,
			collector:  "audit",
			tenantID:   "",
			start:      time.Now().Add(-24 * time.Hour),
			end:        time.Now(),
			wantErr:    true,
		},
		{
			name:       "invalid period",
			evdType:    EvidenceTypeAccessLog,
			collector:  "audit",
			tenantID:   "tenant1",
			start:      time.Time{},
			end:        time.Now(),
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			period := TimeRange{Start: tt.start, End: tt.end}
			got, err := NewEvidence(tt.evdType, tt.collector, tt.tenantID, period)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewEvidence() error = %v, wantErr %v",
					err, tt.wantErr)
			}
			if !tt.wantErr {
				if got.ID == "" {
					t.Error("evidence should have non-empty ID")
				}
				if got.Type != tt.evdType {
					t.Errorf("Type = %v, want %v", got.Type, tt.evdType)
				}
			}
		})
	}
}

func TestEvidenceHash(t *testing.T) {
	tests := []struct {
		name     string
		data1    string
		data2    string
		samehash bool
	}{
		{
			name:     "same data same hash",
			data1:    "test_data",
			data2:    "test_data",
			samehash: true,
		},
		{
			name:     "different data different hash",
			data1:    "test_data_1",
			data2:    "test_data_2",
			samehash: false,
		},
		{
			name:     "empty data",
			data1:    "",
			data2:    "",
			samehash: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			now := time.Now()
			period := TimeRange{Start: now.Add(-1 * time.Hour), End: now}

			evd1, _ := NewEvidence(EvidenceTypeAccessLog, "col", "t1", period)
			evd2, _ := NewEvidence(EvidenceTypeAccessLog, "col", "t1", period)

			evd1.SetHashString(tt.data1)
			evd2.SetHashString(tt.data2)

			if tt.samehash && evd1.Hash != evd2.Hash {
				t.Errorf("hashes should be same but got %s != %s",
					evd1.Hash, evd2.Hash)
			}
			if !tt.samehash && evd1.Hash == evd2.Hash {
				t.Errorf("hashes should differ but got %s == %s",
					evd1.Hash, evd2.Hash)
			}
		})
	}
}

func TestEvidenceIsValid(t *testing.T) {
	tests := []struct {
		name      string
		setupEvd  func() Evidence
		isValid   bool
	}{
		{
			name: "valid evidence",
			setupEvd: func() Evidence {
				now := time.Now()
				evd, _ := NewEvidence(EvidenceTypeAccessLog, "col", "t1",
					TimeRange{Start: now.Add(-1 * time.Hour), End: now})
				evd.SetHashString("data")
				return evd
			},
			isValid: true,
		},
		{
			name: "missing hash",
			setupEvd: func() Evidence {
				now := time.Now()
				evd, _ := NewEvidence(EvidenceTypeAccessLog, "col", "t1",
					TimeRange{Start: now.Add(-1 * time.Hour), End: now})
				return evd
			},
			isValid: false,
		},
		{
			name: "empty id",
			setupEvd: func() Evidence {
				now := time.Now()
				evd, _ := NewEvidence(EvidenceTypeAccessLog, "col", "t1",
					TimeRange{Start: now.Add(-1 * time.Hour), End: now})
				evd.SetHashString("data")
				evd.ID = ""
				return evd
			},
			isValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			evd := tt.setupEvd()
			if evd.IsValid() != tt.isValid {
				t.Errorf("IsValid() = %v, want %v",
					evd.IsValid(), tt.isValid)
			}
		})
	}
}

func TestDefaultCollectorCollect(t *testing.T) {
	tests := []struct {
		name         string
		evdType      EvidenceType
		tenantID     string
		wantErr      bool
	}{
		{
			name:     "collect access logs",
			evdType:  EvidenceTypeAccessLog,
			tenantID: "tenant1",
			wantErr:  false,
		},
		{
			name:     "collect change records",
			evdType:  EvidenceTypeChangeRecord,
			tenantID: "tenant2",
			wantErr:  false,
		},
		{
			name:     "missing tenant",
			evdType:  EvidenceTypeAccessLog,
			tenantID: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			collector := NewDefaultEvidenceCollector("audit")
			ctx := context.Background()

			now := time.Now()
			period := TimeRange{
				Start: now.Add(-24 * time.Hour),
				End:   now,
			}

			evd, err := collector.Collect(ctx, tt.evdType, tt.tenantID, period)
			if (err != nil) != tt.wantErr {
				t.Errorf("Collect() error = %v, wantErr %v",
					err, tt.wantErr)
			}
			if !tt.wantErr && evd.Hash == "" {
				t.Error("Collect() should set hash")
			}
		})
	}
}

func TestDefaultCollectorExport(t *testing.T) {
	tests := []struct {
		name      string
		setupEvd  func() Evidence
		wantErr   bool
	}{
		{
			name: "export valid evidence",
			setupEvd: func() Evidence {
				now := time.Now()
				evd, _ := NewEvidence(EvidenceTypeAccessLog, "col", "t1",
					TimeRange{Start: now.Add(-1 * time.Hour), End: now})
				evd.SetHashString("data")
				return evd
			},
			wantErr: false,
		},
		{
			name: "export with missing id",
			setupEvd: func() Evidence {
				return Evidence{}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			collector := NewDefaultEvidenceCollector("audit")
			ctx := context.Background()

			evd := tt.setupEvd()
			data, err := collector.Export(ctx, evd)

			if (err != nil) != tt.wantErr {
				t.Errorf("Export() error = %v, wantErr %v",
					err, tt.wantErr)
			}
			if !tt.wantErr && len(data) == 0 {
				t.Error("Export() should return data")
			}
		})
	}
}

func TestDefaultCollectorValidate(t *testing.T) {
	tests := []struct {
		name     string
		setupEvd func() Evidence
		wantErr  bool
	}{
		{
			name: "validate valid evidence",
			setupEvd: func() Evidence {
				now := time.Now()
				evd, _ := NewEvidence(EvidenceTypeAccessLog, "col", "t1",
					TimeRange{Start: now.Add(-1 * time.Hour), End: now})
				evd.SetHashString("data")
				return evd
			},
			wantErr: false,
		},
		{
			name: "invalid period end before start",
			setupEvd: func() Evidence {
				now := time.Now()
				period := TimeRange{Start: now, End: now.Add(-1 * time.Hour)}
				evd, _ := NewEvidence(EvidenceTypeAccessLog, "col", "t1", period)
				evd.SetHashString("data")
				return evd
			},
			wantErr: true,
		},
		{
			name: "missing hash",
			setupEvd: func() Evidence {
				now := time.Now()
				evd, _ := NewEvidence(EvidenceTypeAccessLog, "col", "t1",
					TimeRange{Start: now.Add(-1 * time.Hour), End: now})
				return evd
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			collector := NewDefaultEvidenceCollector("audit")
			ctx := context.Background()

			evd := tt.setupEvd()
			err := collector.Validate(ctx, evd)

			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v",
					err, tt.wantErr)
			}
		})
	}
}

func TestEvidenceRegistry(t *testing.T) {
	tests := []struct {
		name       string
		collector  string
		numCollect int
		wantErr    bool
	}{
		{
			name:       "collect single evidence",
			collector:  "audit",
			numCollect: 1,
			wantErr:    false,
		},
		{
			name:       "collect multiple evidence",
			collector:  "audit",
			numCollect: 5,
			wantErr:    false,
		},
		{
			name:       "unregistered collector",
			collector:  "unknown",
			numCollect: 1,
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			registry := NewEvidenceRegistry()
			registry.Register("audit", NewDefaultEvidenceCollector("audit"))

			ctx := context.Background()
			now := time.Now()
			period := TimeRange{
				Start: now.Add(-24 * time.Hour),
				End:   now,
			}

			for i := 0; i < tt.numCollect; i++ {
				_, err := registry.CollectEvidence(
					ctx, tt.collector, EvidenceTypeAccessLog, "t1", period)

				if (err != nil) != tt.wantErr {
					t.Errorf("CollectEvidence() error = %v, wantErr %v",
						err, tt.wantErr)
					return
				}
			}

			evds := registry.GetEvidence(tt.collector)
			if !tt.wantErr && len(evds) != tt.numCollect {
				t.Errorf("GetEvidence() count = %d, want %d",
					len(evds), tt.numCollect)
			}
		})
	}
}
