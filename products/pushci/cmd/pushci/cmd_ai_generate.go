package main

import (
	"context"
	"fmt"
	"os"

	"gopkg.in/yaml.v3"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/detect"
)

func cmdGenerate(ctx context.Context) error {
	if !requireProFeature("generate") {
		return fmt.Errorf("AI feature gated")
	}
	root, _ := os.Getwd()
	client, err := getAIClient()
	if err != nil {
		return err
	}

	cli.Header("PushCI Generate")

	sp := cli.NewSpinner()
	sp.Start("Detecting stack...")
	projects := detect.Scan(root)
	sp.Stop(len(projects) > 0)

	sp.Start("AI generating pipeline...")
	generated, err := ai.GeneratePipeline(ctx, client, projects)
	sp.Stop(err == nil)

	if err != nil {
		return fmt.Errorf("generate failed: %w", err)
	}

	var pipe interface{}
	if yaml.Unmarshal([]byte(generated), &pipe) != nil {
		return fmt.Errorf("AI returned invalid YAML")
	}

	path := root + "/pushci.yml"
	if err := os.WriteFile(path, []byte(generated), 0644); err != nil {
		return fmt.Errorf("write pushci.yml: %w", err)
	}

	cli.Success("Generated pushci.yml")
	fmt.Println(cli.Dim(generated))
	return nil
}
