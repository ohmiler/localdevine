# Migration Plan: LocalDevine (JS to TypeScript)

This document outlines the strategy for migrating the **LocalDevine** project from JavaScript to TypeScript. This plan is designed to be executed by an AI Agent (like Roo Code or Antigravity).

## 1. Project Overview
- **Type:** Desktop App (Electron)
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js (Electron Main Process)
- **Goal:** Improve type safety for IPC communication, service management, and configuration handling.

## 2. Phase 1: Environment Setup
- [ ] Install TypeScript dependencies:
  ```bash
  npm install -D typescript @types/react @types/react-dom @types/node
  ```
- [ ] Initialize `tsconfig.json` for both Renderer and Main processes.
- [ ] Update `vite.config.js` if necessary to support TS.

## 3. Phase 2: Backend (Main Process) Migration
Priority: **High**. This part manages child processes and system commands.
- [ ] Convert `electron/services/ServiceManager.js` to `ServiceManager.ts`.
  - Define interfaces for `ServiceStatus`, `LogEntry`, and `VHostConfig`.
- [ ] Convert `electron/main.js` and other utility scripts.
- [ ] Ensure IPC handlers are typed.

## 4. Phase 3: Frontend (Renderer Process) Migration
- [ ] Rename `src/main.jsx` to `src/main.tsx`.
- [ ] Rename `src/App.jsx` to `src/App.tsx`.
- [ ] Migrate components in `src/components/`:
  - `ServiceCard.tsx`
  - `ConsolePanel.tsx`
  - `Settings.tsx`
  - `VirtualHosts.tsx`
- [ ] **Critical:** Create a global type definition file (`src/types/electron.d.ts`) for `window.electronAPI` to enable IntelliSense in React components.

## 5. Phase 4: Refinement
- [ ] Fix any remaining `implicit any` errors.
- [ ] Replace `any` types with specific interfaces where applicable.
- [ ] Verify that the build process (`npm run build`) works without TS errors.

## 6. Important Notes for the Agent
- **IPC Safety:** Always ensure that `window.electronAPI` calls match the backend handlers.
- **Service Management:** The `ServiceManager.ts` should strictly type the ports and status strings (`'running' | 'stopped' | 'error'`).
- **Tailwind:** Ensure CSS modules or classes are still correctly inferred after migration.

---
*Created by Antigravity for Miler.*
