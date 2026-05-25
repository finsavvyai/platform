package main

import (
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/skill"
)

func cmdSkill(args []string) error {
	if wantsHelp(args) {
		return skillUsage()
	}
	if len(args) == 0 {
		return skillUsage()
	}

	root, _ := os.Getwd()
	reg := skill.NewRegistry()
	inst := skill.NewInstaller(reg)

	switch args[0] {
	case "add", "install":
		return skillInstall(args, reg, inst, root)
	case "remove", "uninstall":
		if len(args) < 2 {
			return fmt.Errorf("usage: pushci skill remove <skill-id>")
		}
		if err := inst.Uninstall(args[1], root); err != nil {
			return err
		}
		cli.Success(fmt.Sprintf("Removed skill %s", args[1]))
		return nil
	case "list", "ls":
		return skillList(reg, inst, root)
	case "catalog":
		return skillCatalog(reg, inst, root)
	case "stats":
		return cmdSkillStats(args[1:])
	default:
		return skillUsage()
	}
}

func skillUsage() error {
	fmt.Println(cli.Bold("pushci skill") + " — manage pipeline skills\n")
	fmt.Println("Commands:")
	fmt.Printf("  %-12s %s\n", cli.Green("add"), "Install a skill (pushci skill add trivy-scan)")
	fmt.Printf("  %-12s %s\n", cli.Green("remove"), "Remove an installed skill")
	fmt.Printf("  %-12s %s\n", cli.Green("list"), "Show installed skills")
	fmt.Printf("  %-12s %s\n", cli.Green("catalog"), "Browse all available skills")
	fmt.Printf("  %-12s %s\n", cli.Green("stats"), "Show marketplace stats for a skill")
	return nil
}
