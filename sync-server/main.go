package main

import (
	"context"
	"log"
	"os"
)

func main() {
	command, cfg, configPath, err := parseCLI(os.Args[1:])
	if err != nil {
		log.Fatal(err)
	}

	switch command {
	case "serve":
		if err := runHTTPServer(context.Background(), cfg); err != nil {
			log.Fatal(err)
		}
	case "service":
		if err := runWindowsService(cfg); err != nil {
			log.Fatal(err)
		}
	case "install":
		if err := installWindowsService(configPath); err != nil {
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
	default:
		log.Fatalf("unknown command %q; use serve, service, install, uninstall, start or stop", command)
	}
}
