# 📥 Importing Apps

The **Android Update Checker** supports importing app lists from two popular Android management tools: **App Manager** and **SD Maid SE**.

## 1. App Manager JSON

The most efficient way to import your app list is by using [App Manager](https://github.com/MuntashirAkon/AppManager).

### Steps:
1.  Open **App Manager** on your Android device.
2.  **Select one app** in the list by long-pressing it.
3.  A selection bar appears at the bottom. Tap the **"Select All"** button (checkbox icon) on the far left of the bottom bar.
4.  Tap the **"More" (3-dots)** button on the far right of the bottom bar.
5.  Choose **"App List export"**.
6.  Select **"JSON"** as the export format.
7.  Save the file and then use the **"Import"** button in this dashboard.

## 2. SD Maid SE Debug Log

If you can't use App Manager, you can also import your app list from an **SD Maid SE** debug log.

### Steps:
1.  In **SD Maid SE**, go to **Settings** → **Debug** → **Log to file**.
2.  Extract the resulting zip file (e.g., `eu.darken.sdmse_...zip`).
3.  Find the **`adb.log`** file inside the extracted folder.
4.  **Rename `adb.log` to `adb.log.txt`** (this ensures the browser can read it).
5.  Click the **"Import"** button in the app and select the `.txt` file.

The application will then automatically parse the log, extract the package IDs, and resolve them using the built-in database.

---
*Next: [🔗 GitHub Integration](GitHub-Integration)*
