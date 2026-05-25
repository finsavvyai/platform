package voice

import (
	"context"
	"fmt"
	"net/url"
)

// maxVoicesFileBytes caps the response body size for `voice install`
// downloads. 256KB fits ~hundreds of personas with prose phrases —
// anything bigger looks like a misconfigured upload, not a voices
// file, and shouldn't be silently merged into the user's home dir.
const maxVoicesFileBytes = 256 * 1024

// InstallFromURL fetches a remote voices.yml, validates it, and
// merges its personas into the user's local file (default
// ~/.pushci/voices.yml). User-existing personas with the same name
// are KEPT — installs add only new entries so a remote file can't
// silently override a user's customization.
//
// Only https:// URLs are accepted. Response body must parse as the
// userVoicesFile schema. Returns the count of newly added personas
// and the resolved local file path so the CLI can report both.
func InstallFromURL(ctx context.Context, src string) (int, string, error) {
	if err := validateURL(src); err != nil {
		return 0, "", err
	}
	body, err := fetchYAML(ctx, src)
	if err != nil {
		return 0, "", err
	}
	incoming, err := parseRemoteVoicesFile(body)
	if err != nil {
		return 0, "", err
	}
	dest := userPersonasPath()
	if dest == "" {
		return 0, "", fmt.Errorf("voice install: no writable user home")
	}
	added, err := mergeIntoLocalFile(dest, incoming)
	if err != nil {
		return 0, dest, err
	}
	return added, dest, nil
}

func validateURL(src string) error {
	u, err := url.Parse(src)
	if err != nil {
		return fmt.Errorf("voice install: invalid URL: %w", err)
	}
	if u.Scheme != "https" {
		return fmt.Errorf("voice install: only https:// URLs allowed; got %q", u.Scheme)
	}
	return nil
}
