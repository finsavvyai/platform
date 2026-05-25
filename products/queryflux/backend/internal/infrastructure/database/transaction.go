package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// TransactionManager manages database transactions with rollback support
type TransactionManager struct {
	pool   *pgxpool.Pool
	logger *zap.Logger
}

// Transaction represents a database transaction with additional functionality
type Transaction struct {
	tx        pgx.Tx
	manager   *TransactionManager
	ctx       context.Context
	timeout   time.Duration
	startTime time.Time
}

// TransactionOptions defines options for creating a transaction
type TransactionOptions struct {
	// Isolation level
	IsolationLevel pgx.TxIsoLevel

	// Access mode (read/write or read-only)
	ReadOnly bool

	// Deferrable mode
	Deferrable bool

	// Transaction timeout
	Timeout time.Duration

	// Rollback on error (default: true)
	RollbackOnError bool
}

// DefaultTransactionOptions returns default transaction options
func DefaultTransactionOptions() *TransactionOptions {
	return &TransactionOptions{
		IsolationLevel:  pgx.ReadCommitted,
		ReadOnly:        false,
		Deferrable:      false,
		Timeout:         30 * time.Second,
		RollbackOnError: true,
	}
}

// NewTransactionManager creates a new transaction manager
func NewTransactionManager(pool *pgxpool.Pool, logger *zap.Logger) *TransactionManager {
	if logger == nil {
		logger = zap.NewNop()
	}

	return &TransactionManager{
		pool:   pool,
		logger: logger,
	}
}

// Begin begins a new transaction with the given options
func (tm *TransactionManager) Begin(ctx context.Context, opts *TransactionOptions) (*Transaction, error) {
	if opts == nil {
		opts = DefaultTransactionOptions()
	}

	// Apply timeout if specified
	if opts.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, opts.Timeout)
		defer cancel()
	}

	// Begin transaction with options
	txOptions := pgx.TxOptions{
		IsoLevel:   opts.IsolationLevel,
		AccessMode: pgx.ReadWrite,
	}

	if opts.Deferrable {
		txOptions.DeferrableMode = pgx.Deferrable
	} else {
		txOptions.DeferrableMode = pgx.NotDeferrable
	}

	if opts.ReadOnly {
		txOptions.AccessMode = pgx.ReadOnly
	}

	tx, err := tm.pool.BeginTx(ctx, txOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	transaction := &Transaction{
		tx:        tx,
		manager:   tm,
		ctx:       ctx,
		timeout:   opts.Timeout,
		startTime: time.Now(),
	}

	tm.logger.Debug("Transaction begun",
		zap.String("isolation_level", string(opts.IsolationLevel)),
		zap.Bool("read_only", opts.ReadOnly),
		zap.Duration("timeout", opts.Timeout))

	return transaction, nil
}

// BeginReadCommitted begins a new transaction with Read Committed isolation level
func (tm *TransactionManager) BeginReadCommitted(ctx context.Context) (*Transaction, error) {
	opts := DefaultTransactionOptions()
	opts.IsolationLevel = pgx.ReadCommitted
	return tm.Begin(ctx, opts)
}

// BeginSerializable begins a new transaction with Serializable isolation level
func (tm *TransactionManager) BeginSerializable(ctx context.Context) (*Transaction, error) {
	opts := DefaultTransactionOptions()
	opts.IsolationLevel = pgx.Serializable
	return tm.Begin(ctx, opts)
}

// BeginRepeatableRead begins a new transaction with Repeatable Read isolation level
func (tm *TransactionManager) BeginRepeatableRead(ctx context.Context) (*Transaction, error) {
	opts := DefaultTransactionOptions()
	opts.IsolationLevel = pgx.RepeatableRead
	return tm.Begin(ctx, opts)
}

// BeginReadOnly begins a new read-only transaction
func (tm *TransactionManager) BeginReadOnly(ctx context.Context) (*Transaction, error) {
	opts := DefaultTransactionOptions()
	opts.ReadOnly = true
	return tm.Begin(ctx, opts)
}

// WithTransaction executes a function within a transaction
func (tm *TransactionManager) WithTransaction(ctx context.Context, fn func(*Transaction) error, opts *TransactionOptions) error {
	tx, err := tm.Begin(ctx, opts)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Ensure rollback if there's a panic
	defer func() {
		if r := recover(); r != nil {
			_ = tx.Rollback()
			panic(r) // re-throw the panic
		}
	}()

	// Execute the function
	if err := fn(tx); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			tm.logger.Error("Failed to rollback transaction", zap.Error(rbErr))
		}
		return err
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// ExecuteInTransaction is a convenience method to execute a function in a transaction
func ExecuteInTransaction[T any](ctx context.Context, tm *TransactionManager, fn func(*Transaction) (T, error), opts *TransactionOptions) (T, error) {
	var result T
	err := tm.WithTransaction(ctx, func(tx *Transaction) error {
		var err error
		result, err = fn(tx)
		return err
	}, opts)
	return result, err
}

// Transaction methods

// Exec executes a query that doesn't return rows
func (tx *Transaction) Exec(query string, args ...interface{}) (pgconn.CommandTag, error) {
	return tx.tx.Exec(tx.ctx, query, args...)
}

// Query executes a query that returns rows
func (tx *Transaction) Query(query string, args ...interface{}) (pgx.Rows, error) {
	return tx.tx.Query(tx.ctx, query, args...)
}

// QueryRow executes a query that returns a single row
func (tx *Transaction) QueryRow(query string, args ...interface{}) pgx.Row {
	return tx.tx.QueryRow(tx.ctx, query, args...)
}

// Commit commits the transaction
func (tx *Transaction) Commit() error {
	duration := time.Since(tx.startTime)

	err := tx.tx.Commit(tx.ctx)
	if err != nil {
		tx.manager.logger.Error("Failed to commit transaction",
			zap.Duration("duration", duration),
			zap.Error(err))
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	tx.manager.logger.Debug("Transaction committed",
		zap.Duration("duration", duration))

	return nil
}

// Rollback aborts the transaction
func (tx *Transaction) Rollback() error {
	duration := time.Since(tx.startTime)

	err := tx.tx.Rollback(tx.ctx)
	if err != nil {
		tx.manager.logger.Error("Failed to rollback transaction",
			zap.Duration("duration", duration),
			zap.Error(err))
		return fmt.Errorf("failed to rollback transaction: %w", err)
	}

	tx.manager.logger.Debug("Transaction rolled back",
		zap.Duration("duration", duration))

	return nil
}

// RollbackUnlessCommitted rolls back the transaction if it hasn't been committed
func (tx *Transaction) RollbackUnlessCommitted() {
	_ = tx.tx.Rollback(tx.ctx)
}

// Savepoint creates a savepoint within the transaction
func (tx *Transaction) Savepoint(name string) error {
	_, err := tx.tx.Exec(tx.ctx, fmt.Sprintf("SAVEPOINT %s", name))
	if err != nil {
		return fmt.Errorf("failed to create savepoint %s: %w", name, err)
	}

	tx.manager.logger.Debug("Savepoint created", zap.String("name", name))
	return nil
}

// RollbackToSavepoint rolls back to a savepoint
func (tx *Transaction) RollbackToSavepoint(name string) error {
	_, err := tx.tx.Exec(tx.ctx, fmt.Sprintf("ROLLBACK TO SAVEPOINT %s", name))
	if err != nil {
		return fmt.Errorf("failed to rollback to savepoint %s: %w", name, err)
	}

	tx.manager.logger.Debug("Rolled back to savepoint", zap.String("name", name))
	return nil
}

// ReleaseSavepoint releases a savepoint
func (tx *Transaction) ReleaseSavepoint(name string) error {
	_, err := tx.tx.Exec(tx.ctx, fmt.Sprintf("RELEASE SAVEPOINT %s", name))
	if err != nil {
		return fmt.Errorf("failed to release savepoint %s: %w", name, err)
	}

	tx.manager.logger.Debug("Savepoint released", zap.String("name", name))
	return nil
}

// GetTransactionID returns the transaction ID (if available)
func (tx *Transaction) GetTransactionID() (uint64, error) {
	var txID uint64
	err := tx.tx.QueryRow(tx.ctx, "SELECT txid_current()").Scan(&txID)
	if err != nil {
		return 0, fmt.Errorf("failed to get transaction ID: %w", err)
	}
	return txID, nil
}

// GetTransactionStartTime returns when the transaction started
func (tx *Transaction) GetStartTime() time.Time {
	return tx.startTime
}

// GetDuration returns how long the transaction has been active
func (tx *Transaction) GetDuration() time.Duration {
	return time.Since(tx.startTime)
}

// IsExpired checks if the transaction has exceeded its timeout
func (tx *Transaction) IsExpired() bool {
	if tx.timeout <= 0 {
		return false
	}
	return time.Since(tx.startTime) > tx.timeout
}

// BatchExecutor allows batch execution of SQL statements
type BatchExecutor struct {
	tx *Transaction
}

// NewBatchExecutor creates a new batch executor
func (tx *Transaction) NewBatchExecutor() *BatchExecutor {
	return &BatchExecutor{tx: tx}
}

// Batch represents a batch of SQL statements
type Batch struct {
	statements []BatchStatement
}

// BatchStatement represents a single statement in a batch
type BatchStatement struct {
	Query string
	Args  []interface{}
}

// Add adds a statement to the batch
func (b *Batch) Add(query string, args ...interface{}) {
	b.statements = append(b.statements, BatchStatement{
		Query: query,
		Args:  args,
	})
}

// Execute executes all statements in the batch
func (be *BatchExecutor) Execute(batch *Batch) ([]pgconn.CommandTag, error) {
	results := make([]pgconn.CommandTag, len(batch.statements))

	for i, stmt := range batch.statements {
		tag, err := be.tx.Exec(stmt.Query, stmt.Args...)
		if err != nil {
			return results[:i], fmt.Errorf("batch statement %d failed: %w", i+1, err)
		}
		results[i] = tag
	}

	return results, nil
}

// TransactionMetrics tracks transaction statistics
type TransactionMetrics struct {
	TotalTransactions      int64         `json:"total_transactions"`
	CommittedTransactions  int64         `json:"committed_transactions"`
	RolledBackTransactions int64         `json:"rolled_back_transactions"`
	AverageDuration        time.Duration `json:"average_duration"`
	MaxDuration            time.Duration `json:"max_duration"`
	MinDuration            time.Duration `json:"min_duration"`
	ActiveTransactions     int64         `json:"active_transactions"`
}

// GetMetrics returns transaction metrics for the pool
func (tm *TransactionManager) GetMetrics() *TransactionMetrics {
	// This is a placeholder implementation
	// In a real implementation, you would track these metrics
	return &TransactionMetrics{
		TotalTransactions:      0,
		CommittedTransactions:  0,
		RolledBackTransactions: 0,
		AverageDuration:        0,
		MaxDuration:            0,
		MinDuration:            0,
		ActiveTransactions:     0,
	}
}
