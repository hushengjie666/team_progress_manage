package main

import "database/sql"

func mysqlRollback(tx *sql.Tx) {
	_ = tx.Rollback()
}
