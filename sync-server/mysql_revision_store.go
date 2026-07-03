package main

import (
	"context"
	"database/sql"
)

func mysqlCurrentRevision(ctx context.Context, q sqlRunner) (int64, error) {
	var nextRevision int64
	if err := q.QueryRowContext(ctx, `SELECT value_bigint FROM sync_meta WHERE key_name = 'next_revision'`).Scan(&nextRevision); err != nil {
		return 0, err
	}
	if nextRevision < 1 {
		return 0, nil
	}
	return nextRevision - 1, nil
}

func mysqlNextRevisionForUpdate(ctx context.Context, tx *sql.Tx) (int64, error) {
	var nextRevision int64
	if err := tx.QueryRowContext(ctx, `SELECT value_bigint FROM sync_meta WHERE key_name = 'next_revision' FOR UPDATE`).Scan(&nextRevision); err != nil {
		return 0, err
	}
	if nextRevision < 1 {
		nextRevision = 1
	}
	return nextRevision, nil
}

func mysqlSetNextRevision(ctx context.Context, tx *sql.Tx, nextRevision int64) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO sync_meta (key_name, value_bigint) VALUES ('next_revision', ?) ON DUPLICATE KEY UPDATE value_bigint = VALUES(value_bigint)`,
		nextRevision,
	)
	return err
}
