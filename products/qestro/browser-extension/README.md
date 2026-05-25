# Questro Browser Extension

This is a real browser extension package for Questro. It records clicks, inputs,
form submissions, key presses, scrolls, and navigation events on the active tab,
then exports the session as Playwright, Cypress, Selenium, JSON, or YAML.

## Development

Load unpacked from:

- `browser-extension/` for the source form
- `browser-extension/dist/chrome/unpacked/` after running the build

## Commands

```bash
npm run build
npm run health-check
npm run test
```

## Build Output

Running `npm run build` creates:

- `dist/chrome/unpacked/`
- `dist/firefox/unpacked/`
- `dist/edge/unpacked/`
- zipped artifacts per browser inside each browser directory

## Questro Integration

The popup can:

- start and stop local tab recording
- export the captured flow
- open the Questro recording studio

The default Questro target URL is `https://app.qestro.io/recording-studio`.
