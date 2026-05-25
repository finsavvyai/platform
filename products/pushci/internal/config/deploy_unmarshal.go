package config

import "gopkg.in/yaml.v3"

// rawPipeline mirrors Pipeline's fields WITHOUT the UnmarshalYAML
// method so we can delegate to default decoding for everything
// except the polymorphic `deploy:` field. The yaml.Node lets us
// inspect whether the user wrote a list or a mapping before
// re-decoding into the right Go type.
type rawPipeline struct {
	On     []string      `yaml:"on"`
	Stages []Stage       `yaml:"stages,omitempty"`
	Checks []Check       `yaml:"checks,omitempty"`
	Deploy yaml.Node     `yaml:"deploy,omitempty"`
	Notify *NotifyConfig `yaml:"notify,omitempty"`
}

// UnmarshalYAML accepts both the legacy mapping form and the
// v1.4.4+ list form of `deploy:`. It never errors on a missing
// field — a pipeline with no deploy block is perfectly valid.
//
// Accepted shapes:
//
//	# Legacy single-target form (pre-1.4.4 pushci init output):
//	deploy:
//	  trigger: push
//	  run: ./deploy.sh
//	  environments:
//	    - name: staging
//	      run: ./staging.sh
//
//	# v1.4.4 list form — one entry per deploy target:
//	deploy:
//	  - name: landing
//	    trigger: merge to main
//	    run: npx wrangler pages deploy ...
//	    verify: {url: https://..., expect: 200, retries: 6}
func (p *Pipeline) UnmarshalYAML(node *yaml.Node) error {
	var raw rawPipeline
	if err := node.Decode(&raw); err != nil {
		return err
	}
	p.On = raw.On
	p.Stages = raw.Stages
	p.Checks = raw.Checks
	p.Notify = raw.Notify

	switch raw.Deploy.Kind {
	case yaml.SequenceNode:
		return raw.Deploy.Decode(&p.Deploys)
	case yaml.MappingNode:
		var legacy legacyDeploy
		if err := raw.Deploy.Decode(&legacy); err != nil {
			return err
		}
		p.Deploys = legacy.toTargets()
	}
	return nil
}

// The legacyDeploy intermediate type lives in deploy_legacy.go so
// this file stays under the 100-line Go source cap.
