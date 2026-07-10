package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/go-sql-driver/mysql"
)

func emptyStore() store {
	return store{
		Version:    2,
		Workspaces: map[string]workspaceData{},
		Accounts:   map[string]accountRecord{},
	}
}

func openMySQLStore(dsn string) (*sql.DB, error) {
	cfg := defaultConfig()
	cfg.mysqlDSN = dsn
	return openMySQLStoreWithConfig(cfg)
}

func openMySQLStoreWithConfig(cfg config) (*sql.DB, error) {
	db, err := openMySQLDB(cfg.mysqlDSN)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if err := migrateMySQLUp(ctx, db, cfg); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := ensureDefaultAdminAccount(ctx, db); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func openMySQLDB(dsn string) (*sql.DB, error) {
	if dsn == "" {
		return nil, errors.New("mysql_dsn is required")
	}
	if err := ensureMySQLDatabase(dsn); err != nil {
		return nil, err
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func ensureMySQLDatabase(dsn string) error {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return err
	}
	if cfg.DBName == "" {
		return errors.New("mysql_dsn must include a database name")
	}
	dbName := cfg.DBName
	cfg.DBName = ""
	serverDB, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return err
	}
	defer serverDB.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := serverDB.PingContext(ctx); err != nil {
		return err
	}
	_, err = serverDB.ExecContext(ctx, fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", escapeMySQLIdentifier(dbName)))
	return err
}

func resetMySQLDatabase(dsn string) error {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return err
	}
	if cfg.DBName == "" {
		return errors.New("mysql_dsn must include a database name")
	}
	dbName := cfg.DBName
	cfg.DBName = ""
	serverDB, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return err
	}
	defer serverDB.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if _, err := serverDB.ExecContext(ctx, fmt.Sprintf("DROP DATABASE IF EXISTS `%s`", escapeMySQLIdentifier(dbName))); err != nil {
		return err
	}
	_, err = serverDB.ExecContext(ctx, fmt.Sprintf("CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", escapeMySQLIdentifier(dbName)))
	return err
}

func escapeMySQLIdentifier(value string) string {
	escaped := ""
	for _, char := range value {
		if char == '`' {
			escaped += "``"
		} else {
			escaped += string(char)
		}
	}
	return escaped
}
