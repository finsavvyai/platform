package skill

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSkillValidate(t *testing.T) {
	tests := []struct {
		name    string
		skill   Skill
		wantErr bool
	}{
		{
			name: "valid skill",
			skill: Skill{
				ID: "test", Name: "Test", Version: "1.0.0",
				Steps: []Step{{Name: "Run", Run: "echo ok"}},
			},
		},
		{
			name:    "missing id",
			skill:   Skill{Name: "Test", Version: "1.0.0", Steps: []Step{{Run: "echo"}}},
			wantErr: true,
		},
		{
			name:    "missing name",
			skill:   Skill{ID: "test", Version: "1.0.0", Steps: []Step{{Run: "echo"}}},
			wantErr: true,
		},
		{
			name:    "missing version",
			skill:   Skill{ID: "test", Name: "Test", Steps: []Step{{Run: "echo"}}},
			wantErr: true,
		},
		{
			name:    "no steps",
			skill:   Skill{ID: "test", Name: "Test", Version: "1.0.0"},
			wantErr: true,
		},
		{
			name: "step missing run",
			skill: Skill{
				ID: "test", Name: "Test", Version: "1.0.0",
				Steps: []Step{{Name: "Empty"}},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.skill.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSkillMatchesQuery(t *testing.T) {
	s := &Skill{
		ID: "nextjs-vercel", Name: "Next.js + Vercel",
		Description: "Full CI/CD pipeline for Next.js",
		Category:    CategoryTemplate,
		Tags:        []string{"Next.js", "Vercel", "React"},
	}

	tests := []struct {
		query string
		want  bool
	}{
		{"next", true},
		{"vercel", true},
		{"react", true},
		{"pipeline", true},
		{"template", true},
		{"django", false},
		{"NEXT", true},
		{"", true},
	}

	for _, tt := range tests {
		t.Run(tt.query, func(t *testing.T) {
			if got := s.MatchesQuery(tt.query); got != tt.want {
				t.Errorf("MatchesQuery(%q) = %v, want %v", tt.query, got, tt.want)
			}
		})
	}
}

func TestParseSkill(t *testing.T) {
	tests := []struct {
		name    string
		yaml    string
		wantErr bool
		wantID  string
	}{
		{
			name: "valid yaml",
			yaml: `id: test-skill
name: Test Skill
version: 1.0.0
category: checks
steps:
  - name: Run Test
    run: echo hello
    on_fail: block`,
			wantID: "test-skill",
		},
		{
			name:    "invalid yaml",
			yaml:    `{{{invalid`,
			wantErr: true,
		},
		{
			name: "missing required fields",
			yaml: `id: test
steps: []`,
			wantErr: true,
		},
		{
			name: "with config",
			yaml: `id: configured
name: Configured Skill
version: 1.0.0
steps:
  - name: Deploy
    run: deploy --target $TARGET
config:
  TARGET: production`,
			wantID: "configured",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s, err := ParseSkill([]byte(tt.yaml))
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParseSkill() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err == nil && s.ID != tt.wantID {
				t.Errorf("ID = %q, want %q", s.ID, tt.wantID)
			}
		})
	}
}

func TestParseSkillFile(t *testing.T) {
	dir := t.TempDir()

	// Valid file
	valid := filepath.Join(dir, "valid.yml")
	os.WriteFile(valid, []byte(`id: file-test
name: File Test
version: 1.0.0
steps:
  - name: Run
    run: echo ok`), 0644)

	s, err := ParseSkillFile(valid)
	if err != nil {
		t.Fatalf("ParseSkillFile() error: %v", err)
	}
	if s.ID != "file-test" {
		t.Errorf("ID = %q, want %q", s.ID, "file-test")
	}

	// Missing file
	_, err = ParseSkillFile(filepath.Join(dir, "missing.yml"))
	if err == nil {
		t.Error("expected error for missing file")
	}
}

func TestRegistryRegisterAndGet(t *testing.T) {
	r := NewRegistry()

	s := &Skill{
		ID: "test", Name: "Test", Version: "1.0.0",
		Steps: []Step{{Name: "Run", Run: "echo ok"}},
	}

	if err := r.Register(s); err != nil {
		t.Fatalf("Register() error: %v", err)
	}

	got, ok := r.Get("test")
	if !ok || got.Name != "Test" {
		t.Error("Get() didn't return registered skill")
	}

	_, ok = r.Get("nonexistent")
	if ok {
		t.Error("Get() returned true for nonexistent skill")
	}
}

func TestRegistryRejectsInvalid(t *testing.T) {
	r := NewRegistry()
	err := r.Register(&Skill{ID: ""})
	if err == nil {
		t.Error("Register() should reject invalid skill")
	}
}

func TestRegistryList(t *testing.T) {
	r := NewRegistry()
	r.Register(&Skill{ID: "a", Name: "A", Version: "1.0.0", Steps: []Step{{Run: "echo"}}})
	r.Register(&Skill{ID: "b", Name: "B", Version: "1.0.0", Steps: []Step{{Run: "echo"}}})

	if r.Count() != 2 {
		t.Errorf("Count() = %d, want 2", r.Count())
	}

	list := r.List()
	if len(list) != 2 {
		t.Errorf("List() returned %d skills, want 2", len(list))
	}
}

func TestRegistrySearch(t *testing.T) {
	r := NewRegistry()
	r.Register(&Skill{
		ID: "a", Name: "Next.js Deploy", Version: "1.0.0",
		Tags: []string{"Next.js", "Vercel"}, Steps: []Step{{Run: "echo"}},
	})
	r.Register(&Skill{
		ID: "b", Name: "Django Test", Version: "1.0.0",
		Tags: []string{"Python", "Django"}, Steps: []Step{{Run: "echo"}},
	})

	tests := []struct {
		query string
		count int
	}{
		{"next", 1},
		{"django", 1},
		{"deploy", 1},
		{"nonexistent", 0},
	}

	for _, tt := range tests {
		t.Run(tt.query, func(t *testing.T) {
			results := r.Search(tt.query)
			if len(results) != tt.count {
				t.Errorf("Search(%q) returned %d, want %d", tt.query, len(results), tt.count)
			}
		})
	}
}

func TestRegistryListByCategory(t *testing.T) {
	r := NewRegistry()
	r.Register(&Skill{
		ID: "a", Name: "A", Version: "1.0.0", Category: CategorySecurity,
		Steps: []Step{{Run: "echo"}},
	})
	r.Register(&Skill{
		ID: "b", Name: "B", Version: "1.0.0", Category: CategoryDeploy,
		Steps: []Step{{Run: "echo"}},
	})
	r.Register(&Skill{
		ID: "c", Name: "C", Version: "1.0.0", Category: CategorySecurity,
		Steps: []Step{{Run: "echo"}},
	})

	sec := r.ListByCategory(CategorySecurity)
	if len(sec) != 2 {
		t.Errorf("ListByCategory(security) = %d, want 2", len(sec))
	}

	dep := r.ListByCategory(CategoryDeploy)
	if len(dep) != 1 {
		t.Errorf("ListByCategory(deploy) = %d, want 1", len(dep))
	}

	ai := r.ListByCategory(CategoryAI)
	if len(ai) != 0 {
		t.Errorf("ListByCategory(ai) = %d, want 0", len(ai))
	}
}

func TestRegistryRemove(t *testing.T) {
	r := NewRegistry()
	r.Register(&Skill{ID: "rm", Name: "Remove", Version: "1.0.0", Steps: []Step{{Run: "echo"}}})

	if !r.Remove("rm") {
		t.Error("Remove() returned false for existing skill")
	}
	if r.Remove("rm") {
		t.Error("Remove() returned true for already-removed skill")
	}
	if r.Count() != 0 {
		t.Error("Count() should be 0 after removal")
	}
}

func TestInstallerInstall(t *testing.T) {
	r := NewRegistry()
	r.Register(&Skill{
		ID: "test-skill", Name: "Test", Version: "1.0.0",
		Steps: []Step{{Name: "Run", Run: "echo ok"}},
	})

	inst := NewInstaller(r)
	dir := t.TempDir()

	// Install
	if err := inst.Install("test-skill", dir); err != nil {
		t.Fatalf("Install() error: %v", err)
	}

	// Verify file was created
	path := filepath.Join(dir, ".pushci", "skills", "test-skill.yml")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Error("skill file not created")
	}

	// Verify content is valid YAML
	data, _ := os.ReadFile(path)
	s, err := ParseSkill(data)
	if err != nil {
		t.Fatalf("installed skill is not valid YAML: %v", err)
	}
	if s.ID != "test-skill" {
		t.Errorf("installed skill ID = %q, want %q", s.ID, "test-skill")
	}
}

func TestInstallerInstallNotFound(t *testing.T) {
	r := NewRegistry()
	inst := NewInstaller(r)
	err := inst.Install("nonexistent", t.TempDir())
	if err == nil {
		t.Error("Install() should error for nonexistent skill")
	}
}

func TestInstallerUninstall(t *testing.T) {
	r := NewRegistry()
	r.Register(&Skill{
		ID: "removable", Name: "Removable", Version: "1.0.0",
		Steps: []Step{{Run: "echo"}},
	})

	inst := NewInstaller(r)
	dir := t.TempDir()

	// Install first
	inst.Install("removable", dir)

	// Uninstall
	if err := inst.Uninstall("removable", dir); err != nil {
		t.Fatalf("Uninstall() error: %v", err)
	}

	// Verify file removed
	path := filepath.Join(dir, ".pushci", "skills", "removable.yml")
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Error("skill file should be removed after uninstall")
	}

	// Uninstall again should error
	if err := inst.Uninstall("removable", dir); err == nil {
		t.Error("Uninstall() should error for not-installed skill")
	}
}

func TestInstallerListInstalled(t *testing.T) {
	r := NewRegistry()
	r.Register(&Skill{ID: "a", Name: "A", Version: "1.0.0", Steps: []Step{{Run: "echo"}}})
	r.Register(&Skill{ID: "b", Name: "B", Version: "1.0.0", Steps: []Step{{Run: "echo"}}})

	inst := NewInstaller(r)
	dir := t.TempDir()

	// Empty initially
	installed, _ := inst.ListInstalled(dir)
	if len(installed) != 0 {
		t.Errorf("ListInstalled() = %d, want 0", len(installed))
	}

	// Install two
	inst.Install("a", dir)
	inst.Install("b", dir)

	installed, err := inst.ListInstalled(dir)
	if err != nil {
		t.Fatalf("ListInstalled() error: %v", err)
	}
	if len(installed) != 2 {
		t.Errorf("ListInstalled() = %d, want 2", len(installed))
	}
}

func TestInstallerIsInstalled(t *testing.T) {
	r := NewRegistry()
	r.Register(&Skill{ID: "check-me", Name: "Check", Version: "1.0.0", Steps: []Step{{Run: "echo"}}})

	inst := NewInstaller(r)
	dir := t.TempDir()

	if inst.IsInstalled("check-me", dir) {
		t.Error("should not be installed initially")
	}

	inst.Install("check-me", dir)

	if !inst.IsInstalled("check-me", dir) {
		t.Error("should be installed after Install()")
	}
}

func TestCatalogLoadsAllSkills(t *testing.T) {
	cat := NewCatalog()

	if cat.Count() != 24 {
		t.Errorf("catalog has %d skills, want 24", cat.Count())
	}

	// Verify each category has skills
	categories := map[Category]int{
		CategoryTemplate: 6,
		CategorySecurity: 4,
		CategoryNotify:   3,
		CategoryDeploy:   3,
		CategoryCheck:    4,
		CategoryAI:       4,
	}

	for cat_type, wantCount := range categories {
		got := cat.ListByCategory(cat_type)
		if len(got) != wantCount {
			t.Errorf("category %s: got %d skills, want %d", cat_type, len(got), wantCount)
		}
	}
}

func TestCatalogSkillsAreValid(t *testing.T) {
	cat := NewCatalog()
	for _, s := range cat.List() {
		t.Run(s.ID, func(t *testing.T) {
			if err := s.Validate(); err != nil {
				t.Errorf("invalid skill: %v", err)
			}
			if s.Name == "" {
				t.Error("missing name")
			}
			if s.Description == "" {
				t.Error("missing description")
			}
			if s.Author == "" {
				t.Error("missing author")
			}
			if len(s.Tags) == 0 {
				t.Error("missing tags")
			}
			if s.Category == "" {
				t.Error("missing category")
			}
		})
	}
}

func TestCatalogSearchByKeyword(t *testing.T) {
	cat := NewCatalog()

	tests := []struct {
		query    string
		minCount int
	}{
		{"AI", 4},
		{"security", 4},
		{"deploy", 3},
		{"Next.js", 1},
		{"Docker", 1},
		{"Slack", 1},
		{"Kubernetes", 2},
	}

	for _, tt := range tests {
		t.Run(tt.query, func(t *testing.T) {
			results := cat.Search(tt.query)
			if len(results) < tt.minCount {
				t.Errorf("Search(%q) = %d results, want >= %d", tt.query, len(results), tt.minCount)
			}
		})
	}
}

func TestCatalogVerifiedSkills(t *testing.T) {
	cat := NewCatalog()
	verified := 0
	for _, s := range cat.List() {
		if s.Verified {
			verified++
		}
	}
	// Most official skills should be verified
	if verified < 15 {
		t.Errorf("only %d verified skills, expected >= 15", verified)
	}
}

func TestCatalogInstallAndUse(t *testing.T) {
	cat := NewCatalog()
	inst := NewInstaller(cat)
	dir := t.TempDir()

	// Install from catalog
	if err := inst.Install("nextjs-vercel", dir); err != nil {
		t.Fatalf("Install() error: %v", err)
	}

	// Read back and verify
	path := filepath.Join(dir, ".pushci", "skills", "nextjs-vercel.yml")
	s, err := ParseSkillFile(path)
	if err != nil {
		t.Fatalf("ParseSkillFile() error: %v", err)
	}

	if s.Name != "Next.js + Vercel" {
		t.Errorf("Name = %q, want %q", s.Name, "Next.js + Vercel")
	}
	if len(s.Steps) != 5 {
		t.Errorf("Steps = %d, want 5", len(s.Steps))
	}
	if s.Steps[0].Run != "npm ci" {
		t.Errorf("first step run = %q, want %q", s.Steps[0].Run, "npm ci")
	}
}
