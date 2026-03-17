# App Version Tracker

A full-stack application to track and check for updates for Android applications from various sources.

## Features

- Track apps from GitHub, APKMirror, F-Droid, APKPure, Google Play, and Samsung Store.
- Automatic update checking with priority-based strategies.
- Side-by-side version comparison (current vs. latest).
- Import apps from JSON files.
- Responsive UI built with React and Tailwind CSS.

## Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example` and add your `GITHUB_TOKEN` if needed.
4. Start the development server:
   ```bash
   npm run dev
   ```

## Built With

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Express](https://expressjs.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/)
