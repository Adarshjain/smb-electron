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

## Code Quality & Linting

This project uses ESLint 9 and Prettier for code quality and formatting.

### Available Commands

```bash
# Check for linting errors
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Type check
npm run type-check

# Run all checks
npm run check-all
```

### Documentation

- 📋 [Linting Guide](./LINTING_GUIDE.md) - Comprehensive linting documentation
- 🪝 [Git Hooks Setup](./SETUP_HOOKS.md) - Optional pre-commit hooks

### IDE Setup

For VSCode, the workspace settings are already configured. Just install the recommended extensions:

- ESLint
- Prettier

Configuration files:

- `eslint.config.js` - ESLint 9 flat config
- `.prettierrc.json` - Prettier configuration
- `.vscode/settings.json` - VSCode workspace settings

### Environment Setup

The app requires Supabase configuration for cloud sync functionality.

1. **Create a `.env` file** in the project root (already created with empty values)
2. **Get your Supabase credentials** from [Supabase Dashboard](https://app.supabase.com/project/_/settings/api)
3. **Fill in the `.env` file** with your credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

> **Note:** A `.env.example` file is provided as a template. The `.env` file is gitignored for security.

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
  description: 'Description',
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

## Tech Stack

- ⚛️ React 19 with TypeScript
- ⚡️ Vite for fast development
- 🔌 Electron for desktop app
- 🗄️ SQLite with better-sqlite3
- 🎨 Tailwind CSS for styling
- ☁️ Supabase for cloud sync
- 🔍 ESLint 9 + Prettier for code quality
