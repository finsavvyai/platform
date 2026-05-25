package storage

import "fmt"

// SuppressFinding sets a finding's status to 'suppressed' with a reason and note.
func (s *DB) SuppressFinding(id int64, reason, note string) error {
	result, err := s.db.Exec(
		s.bind(`UPDATE security_findings
			SET status = 'suppressed', suppression_reason = ?, suppression_note = ?
			WHERE id = ?`),
		reason, note, id,
	)
	if err != nil {
		return fmt.Errorf("failed to suppress finding: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("finding %d not found", id)
	}
	return nil
}

// ReopenFinding resets a finding's status to 'open' and clears suppression fields.
func (s *DB) ReopenFinding(id int64) error {
	result, err := s.db.Exec(
		s.bind(`UPDATE security_findings
			SET status = 'open', suppression_reason = '', suppression_note = ''
			WHERE id = ?`),
		id,
	)
	if err != nil {
		return fmt.Errorf("failed to reopen finding: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("finding %d not found", id)
	}
	return nil
}
