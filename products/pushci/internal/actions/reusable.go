package actions

// reusable.go centralises everything related to GitHub Actions
// reusable-workflow resolution (`uses: org/repo/.github/workflows/foo.yml@ref`).
// act handles the actual fetching; our job is to forward the right flags
// and to inject GITHUB_TOKEN into the secret file so private repos resolve.

// appendLocalRepositories forwards each RunOptions.LocalRepositories
// entry to act as a `--local-repository KEY=PATH` flag. When act
// resolves a `uses:` whose ref matches KEY it will read the workflow
// from PATH on disk instead of cloning from github.com. Ordering is
// deterministic so argv diffs stay stable.
func appendLocalRepositories(args []string, opts RunOptions) []string {
	for _, k := range sortedKeys(opts.LocalRepositories) {
		args = append(args, "--local-repository", k+"="+opts.LocalRepositories[k])
	}
	return args
}

// mergedSecretsForToken returns a copy of opts.Secrets with GITHUB_TOKEN
// set from opts.GitHubToken when:
//
//  1. The caller supplied a token, and
//  2. The caller did NOT already set GITHUB_TOKEN in opts.Secrets.
//
// Passing the token through the secret file (instead of --secret on the
// command line) keeps it out of `ps` output and shell history. act
// picks it up as ${{ secrets.GITHUB_TOKEN }} automatically, and uses it
// when fetching private remote reusable workflows.
func mergedSecretsForToken(opts RunOptions) map[string]string {
	if opts.GitHubToken == "" {
		return opts.Secrets
	}
	if _, present := opts.Secrets["GITHUB_TOKEN"]; present {
		return opts.Secrets
	}
	merged := make(map[string]string, len(opts.Secrets)+1)
	for k, v := range opts.Secrets {
		merged[k] = v
	}
	merged["GITHUB_TOKEN"] = opts.GitHubToken
	return merged
}
