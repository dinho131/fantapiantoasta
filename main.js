const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Lightweight robust YAML parser fallback if js-yaml is not installed
function parseYaml(text) {
  try {
    const yaml = require('js-yaml');
    return yaml.load(text);
  } catch (e) {
    // Basic YAML parser fallback for standard key-values and lists
    const result = { auctioners: [] };
    const lines = text.split(/\r?\n/);
    let currentAuctioner = null;

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('countdown:')) {
        result.countdown = line.replace('countdown:', '').trim().replace(/['"]/g, '');
      } else if (line.startsWith('credits:')) {
        result.credits = parseInt(line.replace('credits:', '').trim(), 10) || 300;
      } else if (line.startsWith('total_players:')) {
        result.total_players = parseInt(line.replace('total_players:', '').trim(), 10) || 25;
      } else if (line.startsWith('language:')) {
        result.language = line.replace('language:', '').trim().replace(/['"]/g, '');
      } else if (line.startsWith('- num:')) {
        const parts = line.replace('-', '').split(',');
        const numPart = parts[0].replace('num:', '').trim();
        let namePart = parts[1] ? parts[1].replace('name:', '').trim().replace(/['"]/g, '') : '';
        currentAuctioner = { num: parseInt(numPart, 10), name: namePart };
        result.auctioners.push(currentAuctioner);
      } else if (line.startsWith('num:') && currentAuctioner) {
        currentAuctioner.num = parseInt(line.replace('num:', '').trim().replace(',', ''), 10);
      } else if (line.startsWith('name:') && currentAuctioner) {
        currentAuctioner.name = line.replace('name:', '').trim().replace(/['",]/g, '');
      }
    }
    return result;
  }
}

// Robust CSV parser supporting ';' and ','
function parseCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().toUpperCase());
  
  const nameIdx = headers.findIndex(h => h.includes('NAME') || h.includes('NOME') || h.includes('GIOCATORE'));
  const roleIdx = headers.findIndex(h => h.includes('ROLE') || h.includes('RUOLO') || h.includes('R'));
  const teamIdx = headers.findIndex(h => h.includes('TEAM') || h.includes('SQUADRA') || h.includes('CLUB'));

  const players = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length >= 2) {
      const name = cols[nameIdx >= 0 ? nameIdx : 0] || `Player ${i}`;
      let role = (cols[roleIdx >= 0 ? roleIdx : 1] || 'A').toUpperCase().charAt(0);
      // Normalize role to P, D, C, A or G, D, M, F
      if (['P', 'G', 'POR'].includes(role)) role = 'P';
      else if (['D', 'DEF'].includes(role)) role = 'D';
      else if (['C', 'M', 'CEN', 'MID'].includes(role)) role = 'C';
      else if (['A', 'F', 'ATT', 'FWD'].includes(role)) role = 'A';
      else role = 'A';

      const team = cols[teamIdx >= 0 ? teamIdx : 2] || 'Serie A';
      players.push({
        id: `p_${i}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name,
        role,
        team,
        status: 'available', // 'available' | 'assigned'
        cost: 0,
        assignedTo: null
      });
    }
  }
  return players;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: 'Fanta Asta Manager',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  
  // Create 'save' folder if not exists
  const saveDir = path.join(__dirname, 'save');
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('select-file', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { filePath, content };
});

ipcMain.handle('read-config-file', async (event, filePath) => {
  const targetPath = filePath || path.join(__dirname, 'config.example.yaml');
  if (!fs.existsSync(targetPath)) return null;
  const content = fs.readFileSync(targetPath, 'utf-8');
  return parseYaml(content);
});

ipcMain.handle('read-players-file', async (event, filePath) => {
  const targetPath = filePath || path.join(__dirname, 'players.example.csv');
  if (!fs.existsSync(targetPath)) return [];
  const content = fs.readFileSync(targetPath, 'utf-8');
  return parseCsv(content);
});

ipcMain.handle('load-locale', async (event, lang) => {
  const localePath = path.join(__dirname, 'locales', `${lang}.json`);
  if (fs.existsSync(localePath)) {
    return JSON.parse(fs.readFileSync(localePath, 'utf-8'));
  }
  const defaultPath = path.join(__dirname, 'locales', 'it.json');
  return JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
});

ipcMain.handle('save-auction-state', async (event, stateData) => {
  try {
    const saveDir = path.join(__dirname, 'save');
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }
    
    // Save timestamped backup and latest session
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `save_${timestamp}.json`;
    const fullPath = path.join(saveDir, filename);
    const latestPath = path.join(saveDir, 'latest_save.json');

    const jsonStr = JSON.stringify(stateData, null, 2);
    fs.writeFileSync(fullPath, jsonStr, 'utf-8');
    fs.writeFileSync(latestPath, jsonStr, 'utf-8');

    return { success: true, path: fullPath, filename };
  } catch (error) {
    console.error('Save error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-saved-sessions', async () => {
  const saveDir = path.join(__dirname, 'save');
  if (!fs.existsSync(saveDir)) return [];
  const files = fs.readdirSync(saveDir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const stats = fs.statSync(path.join(saveDir, f));
    return {
      filename: f,
      filePath: path.join(saveDir, f),
      mtime: stats.mtime
    };
  }).sort((a, b) => b.mtime - a.mtime);
});

ipcMain.handle('load-saved-state', async (event, filePath) => {
  try {
    const targetPath = filePath || path.join(__dirname, 'save', 'latest_save.json');
    if (!fs.existsSync(targetPath)) return null;
    const content = fs.readFileSync(targetPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Load state error:', error);
    return null;
  }
});

ipcMain.handle('export-csv', async (event, data) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Auction Summary CSV',
      defaultPath: path.join(__dirname, 'save', `auction_summary_${new Date().toISOString().slice(0,10)}.csv`),
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (result.canceled || !result.filePath) return null;

    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    csvContent += 'AUCTIONER;PLAYER_NAME;ROLE;TEAM;COST;PURCHASE_TIME\n';

    for (const item of data) {
      csvContent += `"${item.auctioner}";"${item.playerName}";"${item.role}";"${item.team}";${item.cost};"${item.time || ''}"\n`;
    }

    fs.writeFileSync(result.filePath, csvContent, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
