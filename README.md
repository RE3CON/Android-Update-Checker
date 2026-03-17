# App Version Tracker

A full-stack application to track and check for updates for Android applications from various sources.

## Features

- Track apps from GitHub, APKMirror, F-Droid, APKPure, Google Play, and Samsung Store.
- Automatic update checking with priority-based strategies.
- Side-by-side version comparison (current vs. latest).
- Import apps from JSON files.
- **App Manager Compatibility**: The JSON format used for device software inventory is compatible with [App Manager](https://github.com/MuntashirAkon/AppManager).
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

## Releases & Website

- **Releases**: Check the [Releases page](https://github.com/RE3CON/Android-Update-Checker/releases) for pre-built binaries and version history.
- **Website**: Visit the [GitHub repository page](https://github.com/RE3CON/Android-Update-Checker) for the latest documentation and updates.

## Feedback & Contributions

We welcome feedback and contributions!
- **Issues**: Use the [GitHub Issues](https://github.com/RE3CON/Android-Update-Checker/issues) to report bugs or request new features.
- **Discussions**: Join the [GitHub Discussions](https://github.com/RE3CON/Android-Update-Checker/discussions) to ask questions or share ideas.

> **Note**: This project has been developed with the assistance of AI tools to refactor code, improve UI/UX, and add PWA support.

## License

This project is licensed under the [MIT License](LICENSE).

## Built With

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Express](https://expressjs.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/)
