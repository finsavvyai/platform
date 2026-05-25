#!/usr/bin/env bash
# One-time Android release keystore generation.
# Run this BEFORE the first release build. Output goes into android/app/.
# DO NOT commit the resulting .keystore file — it's gitignored.

set -euo pipefail

cd "$(dirname "$0")/../android/app"

KEYSTORE="tenantiq-release.keystore"
ALIAS="tenantiq"

if [[ -f "$KEYSTORE" ]]; then
	echo "Keystore $KEYSTORE already exists — refusing to overwrite."
	echo "If you want a fresh one, mv $KEYSTORE $KEYSTORE.bak.$(date +%s) and rerun."
	exit 1
fi

if ! command -v keytool >/dev/null; then
	echo "keytool not found. Install JDK 17+ first."
	exit 1
fi

echo "Generating release keystore for app.tenantiq.app..."
echo "You'll be prompted for: keystore password, key password, name, org details."
echo "USE A STRONG PASSWORD — store it in your password manager."
echo ""

keytool -genkey -v -keystore "$KEYSTORE" \
	-alias "$ALIAS" \
	-keyalg RSA -keysize 2048 -validity 10000

# Write keystore.properties from template, prompting for passwords.
read -srp "Re-enter keystore password (for keystore.properties): " KSPW
echo
read -srp "Re-enter key password (for keystore.properties): " KPW
echo

cat > keystore.properties <<EOF
storeFile=$KEYSTORE
storePassword=$KSPW
keyAlias=$ALIAS
keyPassword=$KPW
EOF
chmod 600 keystore.properties

echo ""
echo "✅ Done. Files created:"
echo "   - android/app/$KEYSTORE  (the keystore — gitignored)"
echo "   - android/app/keystore.properties  (passwords — gitignored)"
echo ""
echo "Next steps:"
echo "  1. Drop google-services.json into android/app/  (from Firebase Console)"
echo "  2. cd .. && ./gradlew bundleRelease"
echo "  3. Output: android/app/build/outputs/bundle/release/app-release.aab"
echo "  4. Upload .aab to Play Console"
echo ""
echo "BACKUP THIS KEYSTORE NOW. If lost, you can never update the app on Play Store."
echo "Recommended: copy $KEYSTORE + keystore.properties to a password manager."
