package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"
)

func runHTTPServer(ctx context.Context, cfg config) error {
	db, err := openMySQLStore(cfg.mysqlDSN)
	if err != nil {
		return fmt.Errorf("load mysql store: %w", err)
	}
	defer db.Close()
	api := newApp(cfg, db)
	mux := http.NewServeMux()
	api.registerRoutes(mux)

	log.Printf("TimeManage backend service listening on http://%s", cfg.addr)
	log.Printf("Storage: MySQL")
	server := &http.Server{Addr: cfg.addr, Handler: withCORS(mux), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func newApp(cfg config, db *sql.DB) *app {
	return &app{cfg: cfg, db: db}
}
