package main

import (
	"encoding/json"
	"flag"
	"os"
	"strings"
)

type config struct {
	addr          string
	mysqlDSN      string
	username      string
	password      string
	secret        string
	migrateSource string
	migrateAction string
	migrateTo     string
	migrateOutput string
	migrateInput  string
	replace       bool
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
		username: "demo",
		password: "demo",
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
	migrateAction := ""
	if command == "migrate" && len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		migrateAction = strings.ToLower(strings.TrimSpace(args[0]))
		args = args[1:]
	}
	fs := flag.NewFlagSet(command, flag.ContinueOnError)
	configPath := fs.String("config", "", "path to JSON config file")
	addr := fs.String("addr", "", "listen address")
	mysqlDSN := fs.String("mysql-dsn", "", "MySQL DSN, for example user:pass@tcp(127.0.0.1:3306)/timemanage_sync?parseTime=true")
	username := fs.String("user", "", "login username")
	password := fs.String("password", "", "login password")
	secret := fs.String("secret", "", "token signing secret")
	migrateSource := fs.String("source", "", "legacy JSON store path for migrate-file")
	migrateTo := fs.String("to", "", "target schema version when running migrate down")
	migrateOutput := fs.String("output", "", "backup output path when running migrate backup")
	migrateInput := fs.String("input", "", "backup input path when running migrate restore")
	replace := fs.Bool("replace", false, "replace existing MySQL data when running migrate-file")
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
	if provided["source"] {
		cfg.migrateSource = strings.TrimSpace(*migrateSource)
	}
	if command == "migrate" {
		cfg.migrateAction = migrateAction
		if cfg.migrateAction == "" {
			cfg.migrateAction = "status"
		}
		cfg.migrateTo = strings.TrimSpace(*migrateTo)
		cfg.migrateOutput = strings.TrimSpace(*migrateOutput)
		cfg.migrateInput = strings.TrimSpace(*migrateInput)
	}
	if provided["replace"] {
		cfg.replace = *replace
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
	cfg.addr = env("TM_SYNC_ADDR", cfg.addr)
	cfg.mysqlDSN = env("TM_SYNC_MYSQL_DSN", cfg.mysqlDSN)
	cfg.username = env("TM_SYNC_USER", cfg.username)
	cfg.password = env("TM_SYNC_PASSWORD", cfg.password)
	cfg.secret = env("TM_SYNC_SECRET", cfg.secret)
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
