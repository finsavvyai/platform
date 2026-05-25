package api

import (
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

// CryptoScreenHandler handles wallet address screening.
type CryptoScreenHandler struct {
	cryptoIdx *screening.CryptoIndex
	engine    *screening.Engine
}

func NewCryptoScreenHandler(
	ci *screening.CryptoIndex, engine *screening.Engine,
) *CryptoScreenHandler {
	return &CryptoScreenHandler{cryptoIdx: ci, engine: engine}
}

type cryptoScreenRequest struct {
	WalletAddress      string `json:"wallet_address"`
	Chain              string `json:"chain,omitempty"`
	CounterpartyAddr   string `json:"counterparty_address,omitempty"`
	Amount             float64 `json:"amount,omitempty"`
	Currency           string `json:"currency,omitempty"`
	SenderName         string `json:"sender_name,omitempty"`
	ReceiverName       string `json:"receiver_name,omitempty"`
}

// Screen handles POST /api/v1/crypto/screen.
// Requires the "crypto" product add-on.
func (h *CryptoScreenHandler) Screen(
	w http.ResponseWriter, r *http.Request,
) {
	// Product gate: crypto is a paid add-on
	if !hasProduct(r, "crypto") {
		Error(w, "PRODUCT_REQUIRED",
			"Crypto screening requires the Crypto add-on. Upgrade at /billing",
			http.StatusPaymentRequired)
		return
	}

	var req cryptoScreenRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID_REQUEST", "bad json", http.StatusBadRequest)
		return
	}
	if req.WalletAddress == "" {
		Error(w, "VALIDATION", "wallet_address required",
			http.StatusBadRequest)
		return
	}

	start := time.Now()
	resp := h.screenWallets(req)
	resp.ProcessingMs = time.Since(start).Microseconds()

	status := http.StatusOK
	if resp.Decision == "BLOCKED" {
		status = http.StatusConflict
	}
	Success(w, resp, status)
}

type cryptoScreenResponse struct {
	Decision      string                   `json:"decision"`
	WalletAddress string                   `json:"wallet_address"`
	Chain         string                   `json:"chain"`
	Hits          []domain.CryptoEntry  `json:"hits"`
	NameHits      []map[string]interface{} `json:"name_hits,omitempty"`
	RiskFlags     []string                 `json:"risk_flags,omitempty"`
	ProcessingMs  int64                    `json:"processing_us"`
}

func (h *CryptoScreenHandler) screenWallets(
	req cryptoScreenRequest,
) cryptoScreenResponse {
	resp := cryptoScreenResponse{
		WalletAddress: req.WalletAddress,
		Chain:         req.Chain,
		Decision:      "CLEAR",
	}

	// Check primary wallet
	if entry, found := h.cryptoIdx.Lookup(req.WalletAddress); found {
		resp.Decision = "BLOCKED"
		resp.Hits = append(resp.Hits, entry)
		resp.RiskFlags = append(resp.RiskFlags,
			"SANCTIONED_WALLET:"+entry.ListID)
	}

	// Check counterparty
	if req.CounterpartyAddr != "" {
		if entry, found := h.cryptoIdx.Lookup(req.CounterpartyAddr); found {
			resp.Decision = "BLOCKED"
			resp.Hits = append(resp.Hits, entry)
			resp.RiskFlags = append(resp.RiskFlags,
				"SANCTIONED_COUNTERPARTY:"+entry.ListID)
		}
	}

	// Also screen sender/receiver names if provided
	if req.SenderName != "" {
		matches := screenNameQuick(h.engine, req.SenderName)
		if len(matches) > 0 {
			resp.Decision = "BLOCKED"
			for _, m := range matches {
				resp.NameHits = append(resp.NameHits,
					matchToDetailMap(m, nil))
			}
		}
	}

	return resp
}

func screenNameQuick(engine *screening.Engine, name string) []domain.MatchResult {
	query := screening.BuildQueryEntity(name)
	matches, err := engine.Screen(query, nil)
	if err != nil {
		return nil
	}
	return filterByThreshold(matches, 0.7)
}
