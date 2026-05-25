package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/skill"
)

func skillInstall(args []string, reg *skill.Registry, inst *skill.Installer, root string) error {
	if len(args) < 2 {
		return fmt.Errorf("usage: pushci skill add <skill-id>")
	}
	skillID := args[1]
	cli.Header("PushCI Skill Install")

	s, ok := reg.Get(skillID)
	if !ok {
		return fmt.Errorf("skill %q not found. Run: pushci skill list", skillID)
	}
	if err := inst.Install(skillID, root); err != nil {
		return err
	}

	cli.Success(fmt.Sprintf("Installed %s (%s)", s.Name, s.ID))
	cli.Info(fmt.Sprintf("  %d step(s) added to pipeline:", len(s.Steps)))
	for i, step := range s.Steps {
		block := ""
		if step.OnFail == "block" {
			block = cli.Red(" [blocks]")
		}
		fmt.Printf("    %d. %s: %s%s\n", i+1, step.Name, cli.Dim(step.Run), block)
	}
	if len(s.Config) > 0 {
		fmt.Println()
		cli.Warn("Config required:")
		for k, v := range s.Config {
			if v == "" {
				fmt.Printf("    %s = (set this value)\n", cli.Blue(k))
			} else {
				fmt.Printf("    %s = %s\n", cli.Blue(k), v)
			}
		}
	}
	fmt.Println()
	cli.Info("Skill steps run automatically on: pushci run")
	return nil
}

func skillList(reg *skill.Registry, inst *skill.Installer, root string) error {
	cli.Header("Installed Skills")
	ids, err := inst.ListInstalled(root)
	if err != nil {
		return err
	}
	if len(ids) == 0 {
		cli.Info("No skills installed. Browse: pushci skill catalog")
		return nil
	}
	for _, id := range ids {
		s, ok := reg.Get(id)
		if ok {
			fmt.Printf("  %s %s — %s (%d steps)\n", cli.Dot(), cli.Green(s.Name), s.Description, len(s.Steps))
		} else {
			fmt.Printf("  %s %s (unknown)\n", cli.Dot(), id)
		}
	}
	return nil
}

func skillCatalog(reg *skill.Registry, inst *skill.Installer, root string) error {
	cli.Header("Skill Catalog")
	all := reg.List()
	for _, s := range all {
		installed := ""
		if inst.IsInstalled(s.ID, root) {
			installed = cli.Green(" [installed]")
		}
		fmt.Printf("  %-22s %s%s\n", cli.Blue(s.ID), s.Description, installed)
	}
	fmt.Printf("\n  %d skills available. Install: pushci skill add <id>\n", len(all))
	return nil
}
