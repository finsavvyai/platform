# Distribution, Signing, and Notarization

This guide summarizes options for distributing PGDesk binaries and apps, and how to sign them.

## GitHub Releases (Binaries)

- Tag a release: `git tag v0.1.0 && git push --tags`
- CI builds PyInstaller binaries for macOS, Linux, and Windows and attaches them to the release.
  - Workflow: `.github/workflows/release-binaries.yml`

## macOS (codesign + notarize)

1) Prereqs
- Apple Developer account
- Xcode command line tools
- App-specific password for `notarytool`

2) Codesign the binary/app
```
codesign --deep --force --options runtime --timestamp \
  --sign "Developer ID Application: Your Name (TEAMID)" dist/pgdesk
```

3) Notarize
```
xcrun notarytool submit dist/pgdesk \
  --apple-id "you@example.com" \
  --team-id TEAMID \
  --password "@keychain:NOTARY_PASSWORD" \
  --wait
```

4) Staple (if app bundle)
```
xcrun stapler staple "dist/PostgreSQL Desktop Manager.app"
```

Tip: You can replicate these steps in a GitHub Action with secrets for Apple ID, team ID, and app password.

## Windows (code signing)

- Obtain a code signing certificate (EV recommended)
- Use `signtool`:
```
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 \
  /a /f path\to\cert.pfx /p <password> dist\pgdesk.exe
```

## Linux

- Provide GPG-signature alongside tarballs or rely on checksums published in the release.
- Example:
```
sha256sum dist/pgdesk > dist/pgdesk.sha256
gpg --armor --detach-sign dist/pgdesk
```

## PyPI

- Tag a release (vX.Y.Z) and push. If `PYPI_API_TOKEN` is configured, `.github/workflows/release.yml` builds and publishes.
- Consumers install via `pip install pgdesk`.

## macOS App Bundle

- Build GUI app: `bash build_macos_app.sh`
- Codesign and notarize the `.app` bundle using the steps above.

## Notes

- Signing requires secrets. Keep your private keys in secure storage (Keychain, Hardware token, or GH Encrypted Secrets) and restrict CI usage.
- For corporate environments, consider distributing via MDM or internal artifact repos.
