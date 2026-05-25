package deploy

import "context"

const (
	TargetAnsible Target = "ansible"
)

func ansible(ctx context.Context, dir string, env map[string]string) *Result {
	inventory := env["ANSIBLE_INVENTORY"]
	playbook := env["ANSIBLE_PLAYBOOK"]
	if playbook == "" {
		playbook = "playbook.yml"
	}

	args := []string{}
	if inventory != "" {
		args = append(args, "-i", inventory)
	}
	args = append(args, playbook)

	r := run(ctx, dir, env, "ansible-playbook", args...)
	r.Target = TargetAnsible
	return r
}
