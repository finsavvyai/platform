package migrate

import (
	"fmt"
	"strings"
)

// writeAntStages emits the canonical clean → compile → test → build
// sequence, skipping any stage whose target the build.xml doesn't
// declare. StepsConverted / StagesConverted are maintained on r so
// the init flow can show the right counts.
func writeAntStages(b *strings.Builder, known map[string]bool, def, dir string, r *AntConvertResult) {
	emit := emitAntStage(b, dir, r)
	if known["clean"] {
		emit("clean", "ant clean")
	}
	if known["compile"] {
		emit("compile", "ant compile")
	} else if def != "" && def != "clean" && def != "test" {
		emit("compile", "ant "+def)
	}
	if known["test"] {
		emit("test", "ant test")
	}
	if t := pickAntBuildTarget(keysOf(known)); t != "" {
		emit("build", "ant "+t)
	}
}

// emitAntStage returns a closure that writes one Ant stage into b
// and bumps the result counters. Extracted so writeAntStages stays
// scannable — the closure is allocated once per ConvertAnt call.
func emitAntStage(b *strings.Builder, dir string, r *AntConvertResult) func(string, string) {
	return func(name, cmd string) {
		fmt.Fprintf(b, "  - name: %s\n", name)
		if dir != "" {
			fmt.Fprintf(b, "    dir: %s\n", dir)
		}
		b.WriteString("    checks:\n")
		fmt.Fprintf(b, "      - name: %s\n", cmd)
		r.StagesConverted++
		r.StepsConverted++
	}
}

// appendAntUnknownWarnings surfaces every declared target that is
// NOT in the standard set AND not already auto-wired as a deploy.
// Keeps the generated YAML minimal while documenting the rest.
func appendAntUnknownWarnings(targets []string, r *AntConvertResult) {
	std := map[string]bool{
		"clean": true, "compile": true, "test": true,
		"dist": true, "jar": true, "war": true, "package": true,
		"build": true, "assemble": true, "init": true, "prepare": true,
	}
	wired := map[string]bool{}
	for _, d := range r.Deploys {
		wired[d.Name] = true
	}
	for _, t := range targets {
		if std[t] || wired[t] {
			continue
		}
		r.Warnings = append(r.Warnings,
			fmt.Sprintf("Ant target %q not in standard set — add `ant %s` to pushci.yml manually if needed", t, t))
	}
}
