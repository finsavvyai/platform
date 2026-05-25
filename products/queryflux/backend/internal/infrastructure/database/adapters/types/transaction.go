package types

// Transaction is the contract for databases that support transactions.
// Adapters returning a Transaction from BeginTransaction MUST guarantee that
// Commit and Rollback are safe to call exactly once, and that calling either
// after the other is a no-op (or returns a documented error).
type Transaction interface {
	Commit() error
	Rollback() error
	// ExecuteQuery is intentionally omitted from Phase 1 — adapters do not
	// implement it consistently yet. Re-introduce in Phase 2 with a contract
	// amendment if the runner needs in-transaction execution.
}
