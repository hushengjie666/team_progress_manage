package main

import (
	"encoding/json"
	"flag"
	"os"
	"strings"
)

type config struct {
	addr     string
	mysqlDSN string
	username string
	password string
	secret   string
}

type fileConfig struct {
	Addr     string `json:"addr"`
	MySQLDSN string `json:"mysql_dsn"`
	Username string `json:"username"`
	Password string `json:"password"`
	Secret   string `json:"secret"`
}

func defaultConfig() config {
	cfg := config{
		addr:     "127.0.0.1:8787",
		username: "admin",
		password: "hu626699",
	}
	cfg.secret = cfg.password + "-local-secret"
	return cfg
}

func parseCLI(args []string) (string, config, string, error) {
	command := "serve"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		command = strings.ToLower(strings.TrimSpace(args[0]))
		args = args[1:]
	}
	fs := flag.NewFlagSet(command, flag.ContinueOnError)
	configPath := fs.String("config", "", "path to JSON config file")
	addr := fs.String("addr", "", "listen address")
	mysqlDSN := fs.String("mysql-dsn", "", "MySQL DSN, for example user:pass@tcp(127.0.0.1:3306)/timemanage_team?parseTime=true")
	username := fs.String("user", "", "login username")
	password := fs.String("password", "", "login password")
	secret := fs.String("secret", "", "token signing secret")
	if err := fs.Parse(args); err != nil {
		return command, config{}, "", err
	}

	cfg := defaultConfig()
	if *configPath != "" {
		if err := applyConfigFile(&cfg, *configPath); err != nil {
			return command, config{}, *configPath, err
		}
	}
	applyEnv(&cfg)
	provided := map[string]bool{}
	fs.Visit(func(flag *flag.Flag) {
		provided[flag.Name] = true
	})
	if provided["addr"] {
		cfg.addr = *addr
	}
	if provided["mysql-dsn"] {
		cfg.mysqlDSN = *mysqlDSN
	}
	if provided["user"] {
		cfg.username = *username
	}
	if provided["password"] {
		cfg.password = *password
	}
	if provided["secret"] {
		cfg.secret = *secret
	}
	if cfg.secret == "" {
		cfg.secret = cfg.password + "-local-secret"
	}
	return command, cfg, *configPath, nil
}

func applyConfigFile(cfg *config, path string) error {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var file fileConfig
	if err := json.Unmarshal(bytes, &file); err != nil {
		return err
	}
	if strings.TrimSpace(file.Addr) != "" {
		cfg.addr = strings.TrimSpace(file.Addr)
	}
	if strings.TrimSpace(file.MySQLDSN) != "" {
		cfg.mysqlDSN = strings.TrimSpace(file.MySQLDSN)
	}
	if strings.TrimSpace(file.Username) != "" {
		cfg.username = strings.TrimSpace(file.Username)
	}
	if strings.TrimSpace(file.Password) != "" {
		cfg.password = strings.TrimSpace(file.Password)
	}
	if strings.TrimSpace(file.Secret) != "" {
		cfg.secret = strings.TrimSpace(file.Secret)
	}
	return nil
}

func applyEnv(cfg *config) {
	cfg.addr = env("TM_BACKEND_ADDR", cfg.addr)
	cfg.mysqlDSN = env("TM_BACKEND_MYSQL_DSN", cfg.mysqlDSN)
	cfg.username = env("TM_BACKEND_USER", cfg.username)
	cfg.password = env("TM_BACKEND_PASSWORD", cfg.password)
	cfg.secret = env("TM_BACKEND_SECRET", cfg.secret)
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
