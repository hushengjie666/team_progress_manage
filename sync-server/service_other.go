//go:build !windows

package main

import (
	"context"
	"errors"
)

func runWindowsService(cfg config) error {
	return runHTTPServer(context.Background(), cfg)
}

func installWindowsService(configPath string) error {
	_ = configPath
	return errors.New("Windows service install is only available on Windows")
}

func uninstallWindowsService() error {
	return errors.New("Windows service uninstall is only available on Windows")
}

func startWindowsService() error {
	return errors.New("Windows service start is only available on Windows")
}

func stopWindowsService() error {
	return errors.New("Windows service stop is only available on Windows")
}
