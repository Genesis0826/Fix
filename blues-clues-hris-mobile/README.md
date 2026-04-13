# Blue's Clues HR - Mobile

## Getting Started

This project uses **Expo SDK 54** for compatibility with Expo Go app

### IMPORTANT: Environment Setup

To avoid dependency conflicts with the latest Expo releases, follow these steps exactly:

1. Clone & Install:
   git clone https://github.com/AA-SyntaxError/blues-clues-hr-mobile
   cd blues-clues-hr-mobile
   npm install --legacy-peer-deps
2. Test Launch:
   npx expo start -c
   Then simply scan QR with the Expo Go app.

### Git Workflow

1. **Do not push directly to main**
2. Create a feature branch for your task:
   git checkout test
   git pull origin test
   git checkout -b feature/task-name

### Styling

We are using NativeWind (Tailwind CSS) to match our Web design.
Rule: Do not use standard StyleSheet.create. All styling must be done via className strings to
keep the codebase consistent with Next.js frontend.

### Folder Architecture

Please follow this structure:

- src/screens/: All main views (Login, Dashboards).
- src/components/: Reusable UI (Buttons, Cards, Inputs).
- src/navigation/: Navigation logic (React Navigation).
- src/services/: API calls and data fetching logic (we don't have APIs and backend integration yet, just hardcode mock data.)

## What Was Changed

### 1. package.json — upgraded NativeWind

nativewind: ^2.0.11 → ^4.0.0 (installed: 4.2.2)

### 2. metro.config.js — created (new file)

NativeWind v4 requires a Metro config wrapper to process the CSS pipeline.

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(\_\_dirname);
module.exports = withNativeWind(config, { input: "./global.css" });

### 3. babel.config.js — updated preset

NativeWind v4 uses `jsxImportSource` in the Expo preset instead of a separate Babel plugin.

Before:
presets: ["babel-preset-expo"],
plugins: ["nativewind/babel", "react-native-reanimated/plugin"]

After:
presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
plugins: ["react-native-reanimated/plugin"]

### 4. tailwind.config.js — added NativeWind preset

Required by NativeWind v4. Without it, `withNativeWind` throws an error at startup.

module.exports = {
content: [...],
presets: [require("nativewind/preset")],
...
}

### 5. App.tsx — added CSS import

import "./global.css";

### 6. tsconfig.json — fixed TypeScript extends path

TypeScript 5.x requires the explicit `.json` extension when the package does not expose the file via its exports map.

Before:
"extends": "expo/tsconfig.base"

After:
"extends": "expo/tsconfig.base.json"

### 7. nativewind-env.d.ts — auto-generated

Created automatically by NativeWind on first run.

Adds TypeScript support for `className` props on React Native components.

Do not delete this file.

---

## How to Run After Cloning

cd blues-clues-hris-mobile  
npm install  
npx expo start --clear

`--clear` is important on the first run after these changes.

Before you run it, do this:

1. Find your PC's local IP — run ipconfig in your terminal and look for the IPv4 address under your WiFi adapter (e.g., 192.168.1.5)
   Look for the entry under "Wireless LAN adapter Wi-Fi" → IPv4 Address. It'll look like 192.168.1.x or 192.168.0.x.
   ^^^^^ your Wi-Fi IPv4
2. Set it in src/lib/api.ts:
   export const API_BASE_URL = "http://192.168.1.5:5000/api/tribeX/auth/v1";
   // ^^^^^^^^^^^^^ your actual IP
3. Make sure your backend is running (npm run start:dev in tribeX-hris-auth-api)
4. Start the mobile app and test login with a real account from your DB
