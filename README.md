# Android Update Checker v2.7

A sleek, universal web-based dashboard for tracking, managing, and updating your Android applications across multiple sources.

## 🌟 Features

*   **Universal Tracking:** Track apps from Google Play, GitHub, APKMirror, APKPure, F-Droid, Samsung Galaxy Store, Aurora Store, Neo Store, and more.
*   **Smart Auto-Categorization:** Automatically groups your apps into categories (e.g., Productivity, Games, System Apps) using a sophisticated mapping system.
*   **Magic AI Categorization:** Uses Gemini AI to categorize even the most obscure apps automatically on import—no API key setup required!
*   **Update Monitoring:** Checks for updates across various sources to ensure you're always running the latest versions.
*   **Import & Export:** Easily import your existing app lists via JSON (compatible with App Manager), and export your inventory to Excel, CSV, or PDF.
*   **GitHub Integration:** Directly fetch the latest releases and beta artifacts from GitHub repositories.
*   **Modern UI:** A beautiful, responsive, "One UI" inspired interface with dark mode support.
*   **Detailed App Insights:** View package names, installation dates, Min/Target SDK versions, version codes, and signatures.

## 🚀 How It Works

1.  **Add Apps:** Manually add apps by entering their name, package name, and update URL, or import a bulk JSON file.
2.  **Categorization:** The system will automatically analyze the package name and assign a relevant category. 
3.  **Magic Sort:** For apps that are hard to categorize, the system uses "Magic Sort" powered by AI. This happens automatically when you import apps!
4.  **Check for Updates:** Click "Check All" or check individual apps. The app will query the respective sources (like GitHub APIs or store pages) to find the latest version.
5.  **Manage:** Sort, filter, and export your inventory to keep your Android device organized.

## ❓ FAQ

**Q: How do I get my app list into the tracker?**
A: The easiest way is to use [App Manager](https://github.com/MuntashirAkon/AppManager). Go to Settings > Backup > Backup apps info JSON. Then, use the "Import JSON" button in this dashboard.

**Q: Does this app actually install updates on my phone?**
A: No, this is a tracking dashboard. It provides direct links to the update sources (like Play Store or GitHub) where you can download and install the updates manually.

**Q: Do I need an API key for the AI features?**
A: No! The "Magic Sort" feature uses a built-in AI integration that works out of the box for everyone. You don't need to configure anything.

**Q: Is my data shared with anyone?**
A: Your inventory is stored locally in your browser's session. If you use the "Magic Sort" feature, only the app names and package names are sent to the AI for categorization. No personal data is ever shared.

**Q: Why are some apps marked as "Other"?**
A: If the automatic mapping doesn't recognize the app, it defaults to "Other". You can use the "Magic Sort" button or manually assign a category in the app details.

## 🙏 Credits

Special thanks and credits to [MuntashirAkon/AppManager](https://github.com/MuntashirAkon/AppManager) for the inspiration and foundational concepts in Android app management.

## 📄 License

This project is licensed under the [MIT License](https://github.com/RE3CON/Android-Update-Checker/blob/main/LICENSE).
