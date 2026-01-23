// Mock Electron module for Jest tests

export const app = {
  isPackaged: false,
  getPath: jest.fn((name: string) => {
    switch (name) {
      case 'appData':
        return 'C:\\Users\\Test\\AppData\\Roaming';
      case 'userData':
        return 'C:\\Users\\Test\\AppData\\Roaming\\LocalDevine';
      case 'temp':
        return 'C:\\Users\\Test\\AppData\\Local\\Temp';
      default:
        return '';
    }
  }),
  quit: jest.fn(),
  on: jest.fn(),
  whenReady: jest.fn(() => Promise.resolve()),
};

export const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  removeHandler: jest.fn(),
};

export const ipcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  send: jest.fn(),
  removeListener: jest.fn(),
};

export const BrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn(),
  loadFile: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  close: jest.fn(),
  destroy: jest.fn(),
  webContents: {
    send: jest.fn(),
    on: jest.fn(),
    openDevTools: jest.fn(),
  },
}));

export const shell = {
  openExternal: jest.fn(),
  openPath: jest.fn(),
};

export const dialog = {
  showOpenDialog: jest.fn(),
  showSaveDialog: jest.fn(),
  showMessageBox: jest.fn(),
};

export const Notification = jest.fn().mockImplementation(() => ({
  show: jest.fn(),
  on: jest.fn(),
}));

export const Menu = {
  buildFromTemplate: jest.fn(),
  setApplicationMenu: jest.fn(),
};

export const Tray = jest.fn().mockImplementation(() => ({
  setToolTip: jest.fn(),
  setContextMenu: jest.fn(),
  on: jest.fn(),
  destroy: jest.fn(),
}));

export default {
  app,
  ipcMain,
  ipcRenderer,
  BrowserWindow,
  shell,
  dialog,
  Notification,
  Menu,
  Tray,
};
