# homebrew-pipewarden

Homebrew tap for [PipeWarden](https://pipewarden.io) CLI binaries.

## Install

```bash
brew tap finsavvyai/pipewarden
brew install pipewarden
```

## Updating the formula

After a tagged GitHub release (`vX.Y.Z`) publishes darwin/linux archives:

```bash
cd /path/to/pipewarden
scripts/update-homebrew-formula.sh vX.Y.Z
cp packaging/homebrew/pipewarden.rb ../homebrew-pipewarden/Formula/pipewarden.rb
cd ../homebrew-pipewarden
git commit -am "pipewarden vX.Y.Z"
git push
```

The formula downloads **darwin arm64/amd64** archives from GitHub Releases. Linux blocks are included for operators who install from the same tap on Linux.
