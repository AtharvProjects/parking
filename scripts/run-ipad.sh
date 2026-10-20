#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "📱 ====================================================="
echo "📱 Sant Wamanbhau Parking — iPadOS Simulator Runner"
echo "📱 ====================================================="

# 1. Identify preferred iPad simulator
IPAD_UDID=$(xcrun simctl list devices available | grep -E "iPad Air|iPad Pro|iPad" | head -n 1 | grep -o -E "[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}")
IPAD_NAME=$(xcrun simctl list devices available | grep "$IPAD_UDID" | sed 's/ (.*//' | xargs)

if [ -z "$IPAD_UDID" ]; then
  echo "❌ No available iPad simulator found. Please install an iPad simulator in Xcode."
  exit 1
fi

echo "🔍 Target Simulator: $IPAD_NAME ($IPAD_UDID)"

# 2. Boot iPad simulator if needed
echo "🚀 Booting iPad simulator..."
xcrun simctl boot "$IPAD_UDID" 2>/dev/null || true
open -a Simulator

# 3. Build Next.js web bundle & sync to iOS
echo "📦 Building Next.js static export..."
npm run build

echo "🔄 Syncing Capacitor iOS platform..."
npx cap sync ios

# 4. Compile Xcode project for iPad simulator
echo "🛠️ Compiling for $IPAD_NAME..."
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App \
  -destination "id=$IPAD_UDID" \
  -configuration Debug \
  -derivedDataPath ios/DerivedData \
  build

APP_PATH="ios/DerivedData/Build/Products/Debug-iphonesimulator/App.app"
if [ ! -d "$APP_PATH" ]; then
  # Fallback to standard Xcode DerivedData
  APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/App-*/Build/Products/Debug-iphonesimulator/App.app -maxdepth 0 2>/dev/null | head -n 1)
fi

if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo "❌ Could not find compiled App.app bundle."
  exit 1
fi

# 5. Install & Launch on iPad
echo "📲 Installing on $IPAD_NAME..."
xcrun simctl install "$IPAD_UDID" "$APP_PATH"

echo "✨ Launching Sant Wamanbhau Parking on iPad..."
xcrun simctl launch "$IPAD_UDID" com.santwamanbhau.parking

echo "✅ App is now running on $IPAD_NAME!"
