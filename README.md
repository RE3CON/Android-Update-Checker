# 📱 App Version Tracker (System Hub)

[![GitHub license](https://img.shields.io/github/license/RE3CON/Android-Update-Checker)](https://github.com/RE3CON/Android-Update-Checker/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/RE3CON/Android-Update-Checker)](https://github.com/RE3CON/Android-Update-Checker/issues)
[![GitHub stars](https://img.shields.io/github/stars/RE3CON/Android-Update-Checker)](https://github.com/RE3CON/Android-Update-Checker/stargazers)

A powerful full-stack application designed to track, manage, and check for updates for Android applications across multiple sources. Built with a focus on the **Samsung Galaxy S24 Ultra** ecosystem but compatible with all Android devices.

---

## 🚀 Features

- **Multi-Source Tracking**: Support for GitHub, APKMirror, F-Droid, APKPure, Google Play, and Samsung Galaxy Store.
- **Smart Update Engine**: Automatic priority-based checking (e.g., prefer GitHub over Play Store).
- **Visual Inventory**: High-quality app icons and source badges.
- **Side-by-Side Comparison**: Instantly see your current version vs. the latest available.
- **One UI 8.5 Aesthetic**: A clean, modern interface inspired by Samsung's latest design language.
- **PWA Support**: Install it as a native app on your desktop or mobile device.

---

## 🛠️ App Manager Integration

This tracker is fully compatible with [App Manager](https://github.com/MuntashirAkon/AppManager) by Muntashir Akon. Follow these steps to sync your device inventory:

### Step-by-Step Guide:

1.  **Export from App Manager**:
    - Open **App Manager** on your Android device.
    - Tap the **Menu** (three lines) -> **Settings**.
    - Navigate to **Backup**.
    - Select **Backup apps info (JSON)**.
    - Choose the apps you want to track (or select all).
    - Save the resulting `.json` file to your device or cloud storage.

2.  **Import to Tracker**:
    - Open the [App Version Tracker](https://ais-pre-krnbjvxhtxj63l5fteqdnx-75506219897.europe-west2.run.app).
    - Click the **Import JSON** button in the header.
    - Select the `.json` file exported from App Manager.
    - The tracker will automatically resolve package names, fetch icons, and check for updates!

---

## 💻 Setup & Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/RE3CON/Android-Update-Checker.git
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Environment Variables**:
   Create a `.env` file and add your `GITHUB_TOKEN` to avoid rate limits:
   ```env
   GITHUB_TOKEN=your_token_here
   ```
4. **Start the server**:
   ```bash
   npm run dev
   ```

---

## 🌐 Live Demo

- **Full Application (Cloud)**: [App Version Tracker](https://ais-pre-krnbjvxhtxj63l5fteqdnx-75506219897.europe-west2.run.app)
- **Static System Hub (GitHub Pages)**: [S24 Ultra System Hub](https://re3con.github.io/Android-Update-Checker/)

---

## 🤝 Feedback & Contributions

We welcome feedback and contributions!
- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/RE3CON/Android-Update-Checker/issues).
- **Discussions**: Join the conversation in [GitHub Discussions](https://github.com/RE3CON/Android-Update-Checker/discussions).

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---

## 🧰 Built With

- [React](https://react.dev/) & [Vite](https://vitejs.dev/)
- [Express](https://expressjs.com/) & [Node.js](https://nodejs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/)
- [Cheerio](https://cheerio.js.org/) (for web scraping)
