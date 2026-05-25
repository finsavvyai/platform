# PushCI Installation Guide

## Quick Install (Recommended)

```bash
curl -sSL https://pushci.dev/install | bash
```

## npm / npx

```bash
npx pushci init
```

Or install globally:

```bash
npm install -g pushci
pushci init
```

## Homebrew (macOS / Linux)

```bash
brew install finsavvyai/tap/pushci
```

## Docker

```bash
docker run --rm -v $(pwd):/workspace finsavvyai/pushci agent
```

With docker-compose:

```bash
PUSHCI_TOKEN=your-token docker compose -f dist/docker/docker-compose.yml up
```

## Go Install

```bash
go install github.com/finsavvyai/pushci/cmd/pushci@latest
```

## From Source

```bash
git clone https://github.com/finsavvyai/pushci.git
cd pushci
go build -o pushci ./cmd/pushci
sudo mv pushci /usr/local/bin/
```

## Running as a Service

### Linux (systemd)

```bash
sudo cp dist/systemd/pushci-agent.service /etc/systemd/system/
sudo mkdir -p /etc/pushci /opt/pushci
echo "PUSHCI_TOKEN=your-token" | sudo tee /etc/pushci/agent.env
sudo useradd -r -s /bin/false pushci
sudo systemctl enable --now pushci-agent
```

### macOS (launchd)

```bash
mkdir -p ~/Library/Logs/pushci
cp dist/launchd/dev.pushci.agent.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/dev.pushci.agent.plist
```

## Verify Installation

```bash
pushci version
```

## Uninstall

```bash
sudo rm /usr/local/bin/pushci
# macOS: launchctl unload ~/Library/LaunchAgents/dev.pushci.agent.plist
# Linux: sudo systemctl disable --now pushci-agent
```
