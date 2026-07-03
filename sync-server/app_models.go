package main

import "database/sql"

type app struct {
	cfg config
	db  *sql.DB
}
