package detect

import "testing"

// TestDogfood_NinjaSplitFileGradleOnly captures the shape of a
// Gradle-only Java repo (NinjaSplitFile / NinjaEmbeddedSIM) that broke
// `pushci init` in the telia v1.6.1 dogfood: the scanner tagged them
// as Java+Maven and the generator emitted `mvn dependency:resolve -q`
// even though no pom.xml existed. Every pipeline failed instantly.
//
// Expected after the fix:
//   - exactly one Java project at the root
//   - BuildTool == ToolGradle (driven by build.gradle + settings.gradle)
//   - no Maven anywhere in the resolved tool
func TestDogfood_NinjaSplitFileGradleOnly(t *testing.T) {
	root := t.TempDir()

	writeFile(t, root, "build.gradle", `plugins { id 'java' }
group = 'com.telia'
version = '1.0.0'
`)
	writeFile(t, root, "settings.gradle", `rootProject.name = 'NinjaSplitFile'`)
	writeFile(t, root, "gradle.properties", `org.gradle.jvmargs=-Xmx2g`)
	writeFile(t, root, "gradlew", `#!/bin/sh
exit 0
`)
	writeFile(t, root, "src/main/java/com/telia/Main.java", `class Main {}`)

	projects := Scan(root)
	javas := filterStack(projects, Java)
	if len(javas) != 1 {
		t.Fatalf("expected 1 Java project, got %d: %+v", len(javas), javas)
	}
	p := javas[0]
	if p.BuildTool != ToolGradle {
		t.Fatalf("expected BuildTool=gradle, got %q (maven regression!)", p.BuildTool)
	}
	if p.Dir != "." {
		t.Errorf("expected root project dir='.', got %q", p.Dir)
	}
}
