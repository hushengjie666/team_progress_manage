package main

import (
	"strings"
	"testing"
)

func TestBackupValidationRejectsTheMissingPayloadExport(t *testing.T) {
	expected := map[string][]string{"business_tasks": {"id", "status", "payload"}}
	ddl := "CREATE TABLE `business_tasks` (\n  `id` varchar(128),\n  `status` varchar(64),\n  `payload` json\n) ENGINE=InnoDB;\n"
	valid := ddl + "INSERT INTO `business_tasks` (`id`, `status`, `payload`) VALUES ('t', 'pool', '{\"title\":\"a,b (c)\"}');\n"
	if err := validateMySQLDump(strings.NewReader(valid), expected); err != nil {
		t.Fatal(err)
	}
	for _, source := range []string{ddl + "INSERT INTO `business_tasks` VALUES ('t', 'pool');\n", ddl + "INSERT INTO `business_tasks` (`id`, `status`) VALUES ('t', 'pool');\n", strings.ReplaceAll(valid, "  `payload` json\n", ""), ""} {
		if err := validateMySQLDump(strings.NewReader(source), expected); err == nil {
			t.Fatal("accepted incomplete backup")
		}
	}
}
func TestDumpTupleParserHandlesSQLStringsAndExpressions(t *testing.T) {
	counts, err := dumpValueCounts("('a,b', NULL, CAST('{\"x\":1}' AS JSON)), ('a\\'b', X'cafe', 'd''e')")
	if err != nil || len(counts) != 2 || counts[0] != 3 || counts[1] != 3 {
		t.Fatalf("tuple counts=%v err=%v", counts, err)
	}
	for _, source := range []string{"('open)", "(1,2", "(1)),(2)", "invalid"} {
		if _, err := dumpValueCounts(source); err == nil {
			t.Fatal("accepted incomplete tuple")
		}
	}
}
