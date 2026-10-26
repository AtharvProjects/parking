#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "📱 ====================================================="
echo "📱 Sant Wamanbhau Parking — Physical iPad Deployer"
echo "📱 ====================================================="

# 1. Identify connected physical iPad
PHYSICAL_IPAD_ID=$(xcrun devicectl list devices 2>/dev/null | grep -i "iPad" | grep -v "Simulator" | grep -E -o "[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}" | head -n 1)
if [ -z "$PHYSICAL_IPAD_ID" ]; then
  PHYSICAL_IPAD_ID="24D9C828-4879-5396-8490-CACA7F7CCEDB"
fi

echo "🔍 Target Physical iPad: $PHYSICAL_IPAD_ID"

APP_PATH="ios/DerivedData/Build/Products/Debug-iphoneos/App.app"

# 2. Check if re-compilation is requested or needed
if [ "$1" == "--rebuild" ] || [ ! -d "$APP_PATH" ]; then
  echo "📦 Building Next.js static export..."
  npm run build

  echo "🔄 Syncing Capacitor iOS platform..."
  npx cap sync ios

  echo "🛠️ Compiling for physical iPad..."
  xcodebuild -project ios/App/App.xcodeproj \
    -scheme App \
    -destination "generic/platform=iOS" \
    -configuration Debug \
    -derivedDataPath ios/DerivedData \
    build
fi

if [ ! -d "$APP_PATH" ]; then
  echo "❌ Could not find compiled App.app bundle at $APP_PATH"
  exit 1
fi

echo "📦 Verified compiled bundle: $APP_PATH"

# 3. Wait for device to be available (wake/unlock prompt)
echo "🔍 Checking device connectivity status..."
MAX_WAIT=30
WAITED=0
DEVICE_READY=0

while [ $WAITED -lt $MAX_WAIT ]; do
  DEVICE_STATUS=$(xcrun devicectl list devices 2>/dev/null | grep "$PHYSICAL_IPAD_ID" | grep -v "Simulator" || true)
  if echo "$DEVICE_STATUS" | grep -qi "available"; then
    DEVICE_READY=1
    break
  fi
  
  if [ $WAITED -eq 0 ]; then
    echo "⚠️  Ashitosh’s iPad is currently asleep / locked."
    echo "👉 Please UNLOCK your iPad screen (and connect USB cable if Wi-Fi is sleeping)..."
  fi
  
  sleep 3
  WAITED=$((WAITED + 3))
  echo "   Waiting for device... (${WAITED}s/${MAX_WAIT}s)"
done

if [ $DEVICE_READY -ne 1 ]; then
  echo ""
  echo "⚠️  iPad did not become available within ${MAX_WAIT}s."
  echo "💡 You have two immediate options:"
  echo "   1. Plug iPad into Mac via USB cable, unlock it, and re-run: ./scripts/deploy-to-physical-ipad.sh"
  echo "   2. Or test immediately in iPad Simulator: ./scripts/run-ipad.sh"
  echo "   3. Or open in Xcode: open ios/App/App.xcodeproj and click Run ▶️"
  exit 1
fi

# 4. Install & Launch on physical iPad via devicectl
echo "📲 Installing on physical iPad ($PHYSICAL_IPAD_ID)..."
xcrun devicectl device install app --device "$PHYSICAL_IPAD_ID" "$APP_PATH"

echo "✨ Launching Sant Wamanbhau Parking on physical iPad..."
xcrun devicectl device process launch --device "$PHYSICAL_IPAD_ID" com.santwamanbhau.parking

echo "✅ App successfully deployed and launched on your physical iPad!"
