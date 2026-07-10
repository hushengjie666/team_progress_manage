package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type config struct {
	addr              string
	mysqlDSN          string
	username          string
	password          string
	secret            string
	backupDir         string
	mysqldumpPath     string
	mysqlPath         string
	backupMaxAgeHours int
}

type fileConfig struct {
	Addr                       string `json:"addr"`
	MySQLDSN                   string `json:"mysql_dsn"`
	Username                   string `json:"username"`
	Password                   string `json:"password"`
	Secret                     string `json:"secret"`
	BackupDir                  string `json:"backup_dir"`
	MysqldumpPath              string `json:"mysqldump_path"`
	MySQLPath                  string `json:"mysql_path"`
	MigrationBackupMaxAgeHours int    `json:"migration_backup_max_age_hours"`
}

type cliInvocation struct {
	command    string
	config     config
	configPath string
	outputPath string
	inputPath  string
	target     string
	confirm    bool
}

func defaultConfig() config {
	cfg := config{
		addr:              "127.0.0.1:8787",
		username:          "admin",
		password:          "hu626699",
		backupDir:         "backups",
		mysqldumpPath:     "mysqldump",
		mysqlPath:         "mysql",
		backupMaxAgeHours: 24,
	}
	cfg.secret = cfg.password + "-local-secret"
	return cfg
}

func parseCLI(args []string) (string, config, string, error) {
	invocation, err := parseInvocation(args)
	return invocation.command, invocation.config, invocation.configPath, err
}

func parseInvocation(args []string) (cliInvocation, error) {
	command := "serve"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		command = strings.ToLower(strings.TrimSpace(args[0]))
		args = args[1:]
	}
	if command == "db" && len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		command += "-" + strings.ToLower(strings.TrimSpace(args[0]))
		args = args[1:]
	}
	fs := flag.NewFlagSet(command, flag.ContinueOnError)
	configPath := fs.String("config", "", "path to JSON config file")
	addr := fs.String("addr", "", "listen address")
	mysqlDSN := fs.String("mysql-dsn", "", "MySQL DSN, for example user:pass@tcp(127.0.0.1:3306)/timemanage_team?parseTime=true")
	username := fs.String("user", "", "login username")
	password := fs.String("password", "", "login password")
	secret := fs.String("secret", "", "token signing secret")
	backupDir := fs.String("backup-dir", "", "directory for database backups")
	mysqldumpPath := fs.String("mysqldump-path", "", "path to mysqldump")
	mysqlPath := fs.String("mysql-path", "", "path to mysql client")
	backupMaxAgeHours := fs.Int("migration-backup-max-age-hours", 0, "maximum age of a migration backup")
	outputPath := fs.String("output", "", "backup output path")
	inputPath := fs.String("file", "", "backup input path")
	target := fs.String("to", "", "target release version")
	confirm := fs.Bool("confirm", false, "confirm a destructive database operation")
	if err := fs.Parse(args); err != nil {
		return cliInvocation{command: command}, err
	}

	cfg := defaultConfig()
	if *configPath != "" {
		if err := applyConfigFile(&cfg, *configPath); err != nil {
			return cliInvocation{command: command, configPath: *configPath}, err
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
	if provided["backup-dir"] {
		cfg.backupDir = *backupDir
	}
	if provided["mysqldump-path"] {
		cfg.mysqldumpPath = *mysqldumpPath
	}
	if provided["mysql-path"] {
		cfg.mysqlPath = *mysqlPath
	}
	if provided["migration-backup-max-age-hours"] {
		cfg.backupMaxAgeHours = *backupMaxAgeHours
	}
	if *configPath != "" && !filepath.IsAbs(cfg.backupDir) {
		absoluteConfigPath, err := filepath.Abs(*configPath)
		if err != nil {
			return cliInvocation{command: command, configPath: *configPath}, err
		}
		cfg.backupDir = filepath.Join(filepath.Dir(absoluteConfigPath), cfg.backupDir)
	}
	if cfg.secret == "" {
		cfg.secret = cfg.password + "-local-secret"
	}
	if cfg.backupMaxAgeHours <= 0 {
		return cliInvocation{command: command, configPath: *configPath}, fmt.Errorf("migration backup maximum age must be greater than zero")
	}
	return cliInvocation{
		command: command, config: cfg, configPath: *configPath,
		outputPath: *outputPath, inputPath: *inputPath, target: *target, confirm: *confirm,
	}, nil
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
	if strings.TrimSpace(file.BackupDir) != "" {
		cfg.backupDir = strings.TrimSpace(file.BackupDir)
	}
	if strings.TrimSpace(file.MysqldumpPath) != "" {
		cfg.mysqldumpPath = strings.TrimSpace(file.MysqldumpPath)
	}
	if strings.TrimSpace(file.MySQLPath) != "" {
		cfg.mysqlPath = strings.TrimSpace(file.MySQLPath)
	}
	if file.MigrationBackupMaxAgeHours > 0 {
		cfg.backupMaxAgeHours = file.MigrationBackupMaxAgeHours
	}
	return nil
}

func applyEnv(cfg *config) {
	cfg.addr = env("TM_BACKEND_ADDR", cfg.addr)
	cfg.mysqlDSN = env("TM_BACKEND_MYSQL_DSN", cfg.mysqlDSN)
	cfg.username = env("TM_BACKEND_USER", cfg.username)
	cfg.password = env("TM_BACKEND_PASSWORD", cfg.password)
	cfg.secret = env("TM_BACKEND_SECRET", cfg.secret)
	cfg.backupDir = env("TM_BACKEND_BACKUP_DIR", cfg.backupDir)
	cfg.mysqldumpPath = env("TM_BACKEND_MYSQLDUMP_PATH", cfg.mysqldumpPath)
	cfg.mysqlPath = env("TM_BACKEND_MYSQL_PATH", cfg.mysqlPath)
	if value, err := strconv.Atoi(env("TM_BACKEND_MIGRATION_BACKUP_MAX_AGE_HOURS", strconv.Itoa(cfg.backupMaxAgeHours))); err == nil && value > 0 {
		cfg.backupMaxAgeHours = value
	}
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
