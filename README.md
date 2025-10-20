# SMB Electron App

An Electron application built with React, TypeScript, and Vite, featuring integrated SQLite database support.

## Features

- ⚡️ React 19 + TypeScript + Vite
- 🗄️ SQLite database with better-sqlite3
- 🔄 Full CRUD operations
- 🎯 Type-safe database API
- 🪝 Custom React hook for database operations
- 📦 Electron for cross-platform desktop apps

## Getting Started

### Prerequisites

- Node.js v20 (use `nvm use 20`)
- npm

### Installation

```bash
# Install dependencies
npm install

# Note: better-sqlite3 is automatically rebuilt for Electron via postinstall script
# If you encounter issues, manually rebuild with: npm run rebuild
```

### Development

```bash
# Switch to Node v20
nvm use 20

# Run the development server
npm run dev
```

### Build

```bash
# Build for production
npm run build

# Build the Electron app
npm run build:app
```

## SQLite Database

The app includes a fully integrated SQLite database that's automatically created on launch.

### Quick Start

```typescript
// Direct API usage
const result = await window.api.db.create('items', {
    name: 'My Item',
    description: 'Description'
});

// Using the custom hook (recommended)
import { useDatabase } from './hooks/useDatabase';

const db = useDatabase('items');
const items = await db.read();
```

### Database Location

The `smb.db` file is stored in:
- **macOS**: `~/Library/Application Support/smb-electron/smb.db`
- **Windows**: `%APPDATA%/smb-electron/smb.db`
- **Linux**: `~/.config/smb-electron/smb.db`

### Documentation

- 📖 [Complete Database Guide](./DATABASE_GUIDE.md) - Detailed documentation
- 📋 [Quick Reference](./DATABASE_QUICK_REFERENCE.md) - Cheat sheet for common operations
- 💡 [Example Component](./src/pages/DatabaseDemo.tsx) - Working demo
- 🪝 [Hook Example](./src/pages/DatabaseDemoWithHook.tsx) - Using the custom hook

### Default Schema

The app comes with a sample `items` table:

```sql
CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## Project Structure

```
smb-electron/
├── electron/           # Electron main process
│   ├── main.ts        # Main process entry
│   ├── preload.ts     # Preload script (IPC bridge)
│   └── database.ts    # SQLite database module
├── src/               # React application
│   ├── pages/         # Page components
│   ├── hooks/         # Custom React hooks
│   └── App.tsx        # Main App component
└── dist-electron/     # Compiled Electron files
```

## Troubleshooting

### NODE_MODULE_VERSION mismatch error

If you see an error like:
```
The module '/path/to/better_sqlite3.node' was compiled against a different Node.js version
```

**Solution:** Rebuild the native module for Electron:
```bash
npm run rebuild
```

This happens because `better-sqlite3` is a native module that needs to be compiled for Electron's specific Node.js version. The `postinstall` script should handle this automatically, but you may need to run it manually if:
- You switch Node.js versions
- You update Electron
- You clone the repo on a different machine

### Database not found

The database is automatically created on first launch. Check the console output for the database path.

### App won't start in development

Make sure you:
1. Have Node.js v20 installed (`nvm use 20`)
2. Ran `npm install`
3. Have both Vite dev server and Electron running (`npm run dev`)

## Original Template Info

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
