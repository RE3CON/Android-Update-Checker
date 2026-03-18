# Android Update Checker v2.8

A sleek, universal web-based dashboard for tracking, managing, and updating your Android applications across multiple sources.

## 🌟 Features

*   **Universal Tracking:** Track apps from Google Play, GitHub, APKMirror, APKPure, F-Droid, Samsung Galaxy Store, Aurora Store, Neo Store, and more.
*   **Smart Auto-Categorization:** Automatically groups your apps into categories (e.g., Productivity, Games, System Apps) using a sophisticated mapping system.
*   **Update Monitoring:** Checks for updates across various sources to ensure you're always running the latest versions.
*   **Import & Export:** Easily import your existing app lists via JSON (compatible with App Manager), and export your inventory to Excel, CSV, or PDF.
*   **GitHub Integration:** Directly fetch the latest releases and beta artifacts from GitHub repositories.
*   **Modern UI:** A beautiful, responsive, "One UI" inspired interface with dark mode support.
*   **Detailed App Insights:** View package names, installation dates, Min/Target SDK versions, version codes, and signatures.

## 🚀 How It Works

1.  **Add Apps:** Manually add apps by entering their name, package name, and update URL, or import a bulk JSON file.
2.  **Categorization:** The system will automatically analyze the package name and assign a relevant category. You can manually override this at any time or use the "Auto-Sort" button.
3.  **Check for Updates:** Click "Check All" or check individual apps. The app will query the respective sources (like GitHub APIs or store pages) to find the latest version.
4.  **Manage:** Sort, filter, and export your inventory to keep your Android device organized.

## ❓ FAQ

**Q: How do I get my app list into the tracker?**
A: The easiest way is to use [App Manager](https://github.com/MuntashirAkon/AppManager). To export your inventory correctly:
1. Open **App Manager** on your Android device.
2. **Select one app** in the list by long-pressing it.
3. A selection bar appears at the bottom. Tap the **"Select All"** button (checkbox icon) on the far left of the bottom bar.
4. Tap the **"More" (3-dots)** button on the far right of the bottom bar.
5. Choose **"App List export"**.
6. Select **"JSON"** as the export format.
7. Save the file and then use the **"Import JSON"** button in this dashboard.

**Q: Does this app actually install updates on my phone?**
A: No, this is a tracking dashboard. It provides direct links to the update sources (like Play Store or GitHub) where you can download and install the updates manually.

**Q: Is my data shared with anyone?**
A: Your inventory is stored locally in your browser's session. No data is sent to external servers except for update checks and resolving package names.

**Q: Why are some apps marked as "Other"?**
A: If the automatic mapping doesn't recognize the app, it defaults to "Other". You can use the "Auto-Sort" button or manually assign a category in the app details.

## 🙏 Credits

Special thanks and credits to [MuntashirAkon/AppManager](https://github.com/MuntashirAkon/AppManager) for the inspiration and foundational concepts in Android app management.

## 📄 License

This project is licensed under the [MIT License](https://github.com/RE3CON/Android-Update-Checker/blob/main/LICENSE).
