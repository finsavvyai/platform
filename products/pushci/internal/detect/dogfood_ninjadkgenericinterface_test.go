package detect

import (
	"path/filepath"
	"testing"
)

// TestDogfood_NinjaDKGenericInterfaceAggregator captures the shape of
// a Maven multi-module repo (NinjaDKGenericInterface, NinjaDKSPInterface,
// NinjaServiceLayerCommon) that broke `pushci init` in the telia
// v1.6.1 dogfood: the scanner enumerated the aggregator root pom AND
// every child as separate projects. The root reactor pom then ran a
// second `mvn verify` across every child, doubling CI time.
//
// Expected after the fix:
//   - root aggregator pom is NOT emitted as a project
//   - each of three child modules IS emitted
//   - every child is Java+Maven
//   - no "." project in the Java set
func TestDogfood_NinjaDKGenericInterfaceAggregator(t *testing.T) {
	root := t.TempDir()

	writeFile(t, root, "pom.xml", `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.telia</groupId>
  <artifactId>NinjaDKGenericInterface</artifactId>
  <version>1.0.0</version>
  <packaging>pom</packaging>
  <modules>
    <module>generic-core</module>
    <module>generic-adapter</module>
    <module>generic-rest</module>
  </modules>
</project>`)

	for _, child := range []string{"generic-core", "generic-adapter", "generic-rest"} {
		writeFile(t, filepath.Join(root, child), "pom.xml", `<?xml version="1.0"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.telia</groupId>
    <artifactId>NinjaDKGenericInterface</artifactId>
    <version>1.0.0</version>
  </parent>
  <artifactId>`+child+`</artifactId>
</project>`)
		writeFile(t, filepath.Join(root, child), "src/main/java/App.java", `class App {}`)
	}

	projects := Scan(root)
	javas := filterStack(projects, Java)

	if len(javas) != 3 {
		t.Fatalf("expected 3 child modules, got %d: %+v", len(javas), javas)
	}
	for _, p := range javas {
		if p.Dir == "." || p.Dir == "" {
			t.Errorf("aggregator root leaked into projects: %+v", p)
		}
		if p.BuildTool != ToolMaven {
			t.Errorf("expected Maven for child %q, got %q", p.Dir, p.BuildTool)
		}
	}
}
