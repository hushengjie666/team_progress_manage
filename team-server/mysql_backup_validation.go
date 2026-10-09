package main

import (
	"bufio"
	"compress/gzip"
	"context"
	"database/sql"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
)

var dumpCreateTable = regexp.MustCompile("^CREATE TABLE(?: IF NOT EXISTS)? `([^`]+)` ")
var dumpColumn = regexp.MustCompile("^\\s+`([^`]+)` ")
var dumpInsert = regexp.MustCompile("^INSERT INTO `([^`]+)`(?: \\((.*?)\\))? VALUES (.*);$")
var dumpIdentifier = regexp.MustCompile("`([^`]+)`")

func verifyMySQLBackupDump(ctx context.Context, db *sql.DB, path string) error {
	cursor, err := db.QueryContext(ctx, "SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION")
	if err != nil {
		return err
	}
	expected := map[string][]string{}
	for cursor.Next() {
		var table, column string
		if err := cursor.Scan(&table, &column); err != nil {
			cursor.Close()
			return err
		}
		expected[table] = append(expected[table], column)
	}
	err = cursor.Err()
	cursor.Close()
	if err != nil {
		return err
	}
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	reader, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer reader.Close()
	return validateMySQLDump(reader, expected)
}
func validateMySQLDump(source io.Reader, expected map[string][]string) error {
	reader := bufio.NewReader(source)
	seen := map[string]bool{}
	table := ""
	columns := []string{}
	for {
		line, err := reader.ReadString('\n')
		if err != nil && err != io.EOF {
			return err
		}
		line = strings.TrimRight(line, "\r\n")
		if match := dumpCreateTable.FindStringSubmatch(line); match != nil {
			table = match[1]
			columns = nil
		}
		if table != "" {
			if match := dumpColumn.FindStringSubmatch(line); match != nil {
				columns = append(columns, match[1])
			}
			if strings.HasPrefix(line, ")") {
				if want, ok := expected[table]; ok {
					if strings.Join(want, "\x00") != strings.Join(columns, "\x00") {
						return fmt.Errorf("backup table %s has incomplete column definitions", table)
					}
					seen[table] = true
				}
				table = ""
			}
		}
		if strings.HasPrefix(line, "INSERT INTO ") {
			match := dumpInsert.FindStringSubmatch(line)
			if match == nil {
				return fmt.Errorf("unsupported backup INSERT format")
			}
			want, ok := expected[match[1]]
			if !ok {
				return fmt.Errorf("unexpected backup table %s", match[1])
			}
			if match[2] != "" {
				names := []string{}
				for _, column := range dumpIdentifier.FindAllStringSubmatch(match[2], -1) {
					names = append(names, column[1])
				}
				if strings.Join(names, "\x00") != strings.Join(want, "\x00") {
					return fmt.Errorf("backup INSERT for %s omits columns", match[1])
				}
			}
			counts, parseErr := dumpValueCounts(match[3])
			if parseErr != nil {
				return fmt.Errorf("backup INSERT for %s: %w", match[1], parseErr)
			}
			for _, count := range counts {
				if count != len(want) {
					return fmt.Errorf("backup INSERT for %s has %d values for %d columns", match[1], count, len(want))
				}
			}
		}
		if err == io.EOF {
			break
		}
	}
	for table := range expected {
		if !seen[table] {
			return fmt.Errorf("backup is missing table %s", table)
		}
	}
	return nil
}
func dumpValueCounts(source string) ([]int, error) {
	counts := []int{}
	depth, count := 0, 0
	var quote byte
	for index := 0; index < len(source); index++ {
		ch := source[index]
		if quote != 0 {
			if ch == '\\' {
				index++
				continue
			}
			if ch == quote {
				if index+1 < len(source) && source[index+1] == quote {
					index++
				} else {
					quote = 0
				}
			}
			continue
		}
		if ch == '\'' || ch == '"' {
			quote = ch
			continue
		}
		switch ch {
		case '(':
			if depth == 0 {
				count = 1
			}
			depth++
		case ')':
			depth--
			if depth < 0 {
				return nil, fmt.Errorf("unbalanced tuple")
			}
			if depth == 0 {
				counts = append(counts, count)
			}
		case ',':
			if depth == 1 {
				count++
			}
		default:
			if depth == 0 && ch != ' ' && ch != '\t' {
				return nil, fmt.Errorf("invalid tuple separator")
			}
		}
	}
	if quote != 0 || depth != 0 || len(counts) == 0 {
		return nil, fmt.Errorf("incomplete SQL tuple")
	}
	return counts, nil
}
