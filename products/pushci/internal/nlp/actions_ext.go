package nlp

import (
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/secrets"
)

func execConfig(action *Action, root string) (string, error) {
	key := action.Params["key"]
	value := action.Params["value"]
	if key == "" {
		cfg, err := config.Load(root + "/pushci.yml")
		if err != nil {
			return "No pushci.yml found. Run `pushci init`.", nil
		}
		return fmt.Sprintf("Current config: %d checks, triggers: %v",
			len(cfg.Checks), cfg.On), nil
	}
	return fmt.Sprintf("Updated config: %s = %s", key, value), nil
}

func execSecret(action *Action, root string) (string, error) {
	store, err := secrets.New(root)
	if err != nil {
		return "", fmt.Errorf("secret store: %w", err)
	}
	op := action.Params["operation"]
	key := action.Params["key"]
	switch op {
	case "set":
		return fmt.Sprintf("Stored secret: %s", key),
			store.Set(key, action.Params["value"])
	case "get":
		v, ok := store.Get(key)
		if !ok {
			return fmt.Sprintf("Secret %q not found", key), nil
		}
		return fmt.Sprintf("%s = %s", key, v), nil
	case "list":
		keys := store.List()
		return fmt.Sprintf("Secrets: %s", strings.Join(keys, ", ")), nil
	case "delete":
		return fmt.Sprintf("Deleted secret: %s", key), store.Delete(key)
	default:
		return "", fmt.Errorf("unknown secret op: %s", op)
	}
}
