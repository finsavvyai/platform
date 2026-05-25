package screening

// FPType identifies the fingerprint algorithm used.
type FPType int8

const (
	FPNormalized FPType = 1
	FPSoundex    FPType = 2
	FPMetaphone  FPType = 3
	FPDMPrimary  FPType = 4
	FPDMAlt      FPType = 5
	FPTokenPair  FPType = 6
	FPInitials   FPType = 7
	FPReversed   FPType = 8
	FPVariant    FPType = 9
)

// Fingerprint is a single pre-computed hash key for an entity.
type Fingerprint struct {
	EntityID string
	Type     FPType
	Value    string
}
