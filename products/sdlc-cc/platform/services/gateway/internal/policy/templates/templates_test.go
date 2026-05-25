// Tests for the static template registry. Cheap because templates
// are Go literals — we just assert each canonical name resolves
// and the regexes compile.
package templates

import (
	"regexp"
	"testing"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
)

func TestAll_ReturnsFourTemplates(t *testing.T) {
	got := All()
	if len(got) != 4 {
		t.Fatalf("All() returned %d templates, want 4", len(got))
	}
	wantNames := []string{"hipaa-strict", "pci-dss", "gdpr-eu", "soc2-code-reviewer"}
	for i, name := range wantNames {
		if got[i].Name != name {
			t.Errorf("templates[%d].Name = %q, want %q", i, got[i].Name, name)
		}
	}
}

func TestByName_ResolvesEachTemplate(t *testing.T) {
	for _, name := range []string{"hipaa-strict", "pci-dss", "gdpr-eu", "soc2-code-reviewer"} {
		t.Run(name, func(t *testing.T) {
			tpl, ok := ByName(name)
			if !ok {
				t.Fatalf("ByName(%q) not found", name)
			}
			if tpl.Name != name {
				t.Errorf("name mismatch: got %q", tpl.Name)
			}
		})
	}
}

func TestByName_UnknownReturnsFalse(t *testing.T) {
	_, ok := ByName("not-a-template")
	if ok {
		t.Error("expected (Template{}, false) for unknown template")
	}
}

func TestAllRegexesCompile(t *testing.T) {
	for _, tpl := range All() {
		for _, p := range tpl.CustomPatterns {
			if _, err := regexp.Compile(p.Regex); err != nil {
				t.Errorf("template %s pattern %s regex invalid: %v",
					tpl.Name, p.Name, err)
			}
		}
	}
}

func TestEachTemplateHasReasonableDefaults(t *testing.T) {
	for _, tpl := range All() {
		t.Run(tpl.Name, func(t *testing.T) {
			if tpl.Action == "" {
				t.Error("Action must be set")
			}
			if tpl.ImagePolicy == "" {
				t.Error("ImagePolicy must be set")
			}
			validAction := false
			for _, a := range []middleware.Action{
				middleware.ActionAllow, middleware.ActionMask,
				middleware.ActionRedact, middleware.ActionBlock,
				middleware.ActionTokenize,
			} {
				if tpl.Action == a {
					validAction = true
				}
			}
			if !validAction {
				t.Errorf("invalid Action %q", tpl.Action)
			}
		})
	}
}
