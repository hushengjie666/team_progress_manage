package main

import (
	"context"
	"log"
	"os"
)

func main() {
	invocation, err := parseInvocation(os.Args[1:])
	if err != nil {
		log.Fatal(err)
	}

	switch invocation.command {
	case "serve":
		if err := runHTTPServer(context.Background(), invocation.config); err != nil {
			log.Fatal(err)
		}
	case "service":
		if err := runWindowsService(invocation.config); err != nil {
			log.Fatal(err)
		}
	case "install":
		if err := installWindowsService(invocation.configPath); err != nil {
			log.Fatal(err)
		}
	case "uninstall":
		if err := uninstallWindowsService(); err != nil {
			log.Fatal(err)
		}
	case "start":
		if err := startWindowsService(); err != nil {
			log.Fatal(err)
		}
	case "stop":
		if err := stopWindowsService(); err != nil {
			log.Fatal(err)
		}
	case "db-status", "db-up", "db-backup", "db-rollback", "db-restore":
		if err := runDatabaseCommand(context.Background(), invocation); err != nil {
			log.Fatal(err)
		}
	default:
		log.Fatalf("unknown command %q; use serve, service, install, uninstall, start, stop or db", invocation.command)
	}
}
