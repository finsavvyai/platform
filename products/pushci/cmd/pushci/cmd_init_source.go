package main

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/migrate"
)

// initMigrationSource holds the primary migrated pipeline plus
// "what format was it" flags so callers can append secondary
// framework stages and emit the right YAML header.
type initMigrationSource struct {
	Pipeline       *config.Pipeline
	FromBuildspec  bool
	FromChef       bool
	FromJenkins    bool
	FromAnt        bool
	FromWAR        bool
	FromShellOnly  bool
	FromGenericCI  bool
	GenericCIKind  string
	JenkinsfileRel string
	ChefCookbooks  []string
	AntSource      string
	AntTargets     []string
	WARDescriptor  string
	ShellScripts   []string
	DeployHints    []migrate.DeployHint
}

// pickMigrationSource runs the precedence chain for pipeline
// migration. Order:
//
//	buildspec > Chef > Jenkinsfile > Ant > generic CI > WAR-legacy > shell-only
//
// The `project:*` fallbacks (WAR, shell-only) run after the generic
// CI migrator so a repo with both a `.gitlab-ci.yml` and a loose
// `install.sh` still gets the real pipeline, not a shellcheck stub.
// Returns an empty source (Pipeline nil) when nothing matches —
// caller falls back to pure framework-heuristic generation.
func pickMigrationSource(root string) initMigrationSource {
	src := initMigrationSource{}
	if p := tryBuildspecMigrate(root); p != nil {
		src.Pipeline, src.FromBuildspec = p, true
		return src
	}
	if p := tryChefMigrate(root); p != nil {
		src.Pipeline, src.FromChef = p, true
		if r := migrate.ConvertChef(root); r != nil {
			src.ChefCookbooks = r.Cookbooks
		}
		return src
	}
	if p := tryJenkinsfileMigrate(root); p != nil {
		src.Pipeline, src.FromJenkins = p, true
		src.JenkinsfileRel = "Jenkinsfile"
		if prov := detect.ScanJenkins(root); len(prov) > 0 {
			src.JenkinsfileRel = prov[0].ConfigFile
		}
		return src
	}
	if p := tryAntMigrate(root); p != nil {
		src.Pipeline, src.FromAnt = p, true
		src.AntSource = firstAntConfig(root)
		src.AntTargets = antTargetsForHeader(root, src.AntSource)
		return src
	}
	if p, kind, hints := detectAndMigrateExistingCI(root); p != nil {
		src.Pipeline = p
		src.FromGenericCI = true
		src.GenericCIKind = kind
		src.DeployHints = hints
		return src
	}
	if p := tryWARFallback(root); p != nil {
		src.Pipeline, src.FromWAR = p, true
		if wp := detect.ScanLegacyWAR(root); wp != nil {
			src.WARDescriptor = wp.ConfigFile
		}
		return src
	}
	if p := tryShellOnlyFallback(root); p != nil {
		src.Pipeline, src.FromShellOnly = p, true
		if sp := detect.ScanShellOnly(root); sp != nil {
			src.ShellScripts = splitShellCSV(sp.ConfigFile)
		}
		return src
	}
	return src
}
