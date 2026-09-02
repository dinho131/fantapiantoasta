// Fantasy Soccer Auction Manager - Renderer Logic

let appState = {
  config: {
    auctioners: [
      { num: 1, name: "Mario" },
      { num: 2, name: "Luigi" },
      { num: 3, name: "Bowser" },
      { num: 4, name: "Peach" }
    ],
    countdown: 60,
    credits: 330,
    total_players: 25,
    language: "it"
  },
  players: [],
  auctionersState: {},
  callOrderIndex: 0,
  currentAuction: null,
  history: [],
  currentLocale: {},
  lang: 'it'
};

let timerInterval = null;

// DOM Elements Cache
const elements = {
  langSelect: document.getElementById('langSelect'),
  btnToggleSound: document.getElementById('btnToggleSound'),
  soundIcon: document.getElementById('soundIcon'),
  btnLoadConfig: document.getElementById('btnLoadConfig'),
  btnLoadPlayers: document.getElementById('btnLoadPlayers'),
  btnLoadSave: document.getElementById('btnLoadSave'),
  btnExportCsv: document.getElementById('btnExportCsv'),

  // Header
  currentCallerName: document.getElementById('currentCallerName'),
  auctionStatusBadge: document.getElementById('auctionStatusBadge'),
  activePlayerDisplay: document.getElementById('activePlayerDisplay'),
  playerRoleBadge: document.getElementById('playerRoleBadge'),
  playerNameDisplay: document.getElementById('playerNameDisplay'),
  playerTeamBadge: document.getElementById('playerTeamBadge'),
  currentBidAmount: document.getElementById('currentBidAmount'),
  leadingBidderName: document.getElementById('leadingBidderName'),
  activeBidderName: document.getElementById('activeBidderName'),
  playerSelectBox: document.getElementById('playerSelectBox'),
  playerCallInput: document.getElementById('playerCallInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  autocompleteDropdown: document.getElementById('autocompleteDropdown'),
  
  // Timer
  timerCircle: document.getElementById('timerCircle'),
  timerValue: document.getElementById('timerValue'),
  btnPauseResume: document.getElementById('btnPauseResume'),
  btnResetTimer: document.getElementById('btnResetTimer'),

  // Controls
  btnStartRound: document.getElementById('btnStartRound'),
  btnPass: document.getElementById('btnPass'),
  customBidInput: document.getElementById('customBidInput'),
  btnBid: document.getElementById('btnBid'),
  quickBidBtns: document.querySelectorAll('.btn-quick-bid'),
  btnAssign: document.getElementById('btnAssign'),
  btnUndo: document.getElementById('btnUndo'),

  // Main
  totalSquadSizeDisplay: document.getElementById('totalSquadSizeDisplay'),
  auctionersGrid: document.getElementById('auctionersGrid'),

  // Sidebar
  tabPlayers: document.getElementById('tabPlayers'),
  tabHistory: document.getElementById('tabHistory'),
  playersTabContent: document.getElementById('playersTabContent'),
  historyTabContent: document.getElementById('historyTabContent'),
  sidebarSearchInput: document.getElementById('sidebarSearchInput'),
  filterRoleSelect: document.getElementById('filterRoleSelect'),
  filterStatusSelect: document.getElementById('filterStatusSelect'),
  sidebarPlayerList: document.getElementById('sidebarPlayerList'),
  historyList: document.getElementById('historyList'),

  // Modal & Toast
  modalOverlay: document.getElementById('modalOverlay'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  toastNotification: document.getElementById('toastNotification')
};

// ==================== Initialization ====================
async function initApp() {
  bindEvents();
  await loadLanguage(appState.lang);

  // Try auto-loading default config and players
  if (window.electronAPI) {
    try {
      const cfg = await window.electronAPI.readConfigFile();
      if (cfg) applyConfig(cfg);

      const ply = await window.electronAPI.readPlayersFile();
      if (ply && ply.length > 0) {
        appState.players = ply;
      }
    } catch (e) {
      console.warn('Auto-load defaults warning:', e);
    }
  }

  // Setup initial auctioners state if empty
  if (Object.keys(appState.auctionersState).length === 0) {
    initAuctionersState();
  }

  updateUI();
  showToast(t('dialogs.loadSuccess') || 'Sistema pronto!');
}

function initAuctionersState() {
  appState.auctionersState = {};
  appState.config.auctioners.forEach(auc => {
    appState.auctionersState[auc.num] = {
      num: auc.num,
      name: auc.name,
      initialCredits: appState.config.credits,
      remainingCredits: appState.config.credits,
      boughtPlayers: []
    };
  });
}

function applyConfig(cfg) {
  if (cfg.auctioners && Array.isArray(cfg.auctioners)) {
    appState.config.auctioners = cfg.auctioners;
  }
  if (cfg.countdown) {
    const parsedCountdown = parseInt(String(cfg.countdown).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsedCountdown) && parsedCountdown > 0) {
      appState.config.countdown = parsedCountdown;
    }
  }
  if (cfg.credits && !isNaN(cfg.credits)) {
    appState.config.credits = parseInt(cfg.credits, 10);
  }
  if (cfg.total_players && !isNaN(cfg.total_players)) {
    appState.config.total_players = parseInt(cfg.total_players, 10);
  }
  if (cfg.language && ['it', 'en'].includes(cfg.language)) {
    appState.lang = cfg.language;
    elements.langSelect.value = cfg.language;
    loadLanguage(cfg.language);
  }

  initAuctionersState();
  elements.totalSquadSizeDisplay.textContent = appState.config.total_players;
  elements.timerValue.textContent = appState.config.countdown;
}

// ==================== Localization ====================
async function loadLanguage(lang) {
  appState.lang = lang;
  if (window.electronAPI) {
    try {
      appState.currentLocale = await window.electronAPI.loadLocale(lang);
    } catch (err) {
      console.error('Error loading locale via IPC:', err);
    }
  }
  translatePage();
}

function t(path, placeholders = {}) {
  const parts = path.split('.');
  let curr = appState.currentLocale;
  for (let p of parts) {
    if (curr && curr[p] !== undefined) {
      curr = curr[p];
    } else {
      return path;
    }
  }
  let str = String(curr);
  for (let [k, v] of Object.entries(placeholders)) {
    str = str.replace(new RegExp(`{${k}}`, 'g'), v);
  }
  return str;
}

function translatePage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
}

// ==================== Calculations ====================
function calculateMaxExpendable(auctionerState) {
  const targetTotal = appState.config.total_players || 25;
  const boughtCount = auctionerState.boughtPlayers.length;
  const remainingSlots = Math.max(0, targetTotal - boughtCount);

  if (remainingSlots <= 0) return 0;
  // Formula: Remaining credits - (Remaining players needed - 1)
  const maxExp = auctionerState.remainingCredits - (remainingSlots - 1);
  return Math.max(0, maxExp);
}

function getCallerAuctioner() {
  if (!appState.config.auctioners || appState.config.auctioners.length === 0) return null;
  const aucMeta = appState.config.auctioners[appState.callOrderIndex];
  return appState.auctionersState[aucMeta.num];
}

function getActiveBidderAuctioner() {
  if (!appState.currentAuction || appState.currentAuction.activeBidderIndex === null) return null;
  const aucMeta = appState.config.auctioners[appState.currentAuction.activeBidderIndex];
  return appState.auctionersState[aucMeta.num];
}

function getLeadingBidderAuctioner() {
  if (!appState.currentAuction || !appState.currentAuction.leadingBidderNum) return null;
  return appState.auctionersState[appState.currentAuction.leadingBidderNum];
}

// ==================== Auction Workflow ====================
function selectPlayerForAuction(player) {
  if (player.status === 'assigned') {
    showToast('Calciatore già assegnato!', 'error');
    return;
  }

  const caller = getCallerAuctioner();
  if (!caller) return;

  const callerMax = calculateMaxExpendable(caller);
  if (callerMax < 1) {
    showToast(t('dialogs.maxExpendableExceeded', { max: 0 }), 'error');
    return;
  }

  appState.currentAuction = {
    player: player,
    currentBid: 1,
    leadingBidderNum: caller.num,
    activeBidderIndex: appState.callOrderIndex, // starts with caller
    skippedAuctioners: new Set(),
    isStarted: false,
    isPaused: false,
    timerSeconds: appState.config.countdown
  };

  elements.playerCallInput.value = '';
  elements.autocompleteDropdown.classList.add('hidden');
  elements.btnClearSearch.classList.add('hidden');

  updateUI();
  if (window.soundFX) window.soundFX.playBid();
}

function startAuctionRound() {
  if (!appState.currentAuction || !appState.currentAuction.player) return;

  appState.currentAuction.isStarted = true;
  appState.currentAuction.isPaused = false;
  appState.currentAuction.timerSeconds = appState.config.countdown;

  // Move active bidder to the next eligible auctioner after the caller
  advanceToNextBidder(false);

  startTimer();
  updateUI();
  if (window.soundFX) window.soundFX.playTick();
}

function advanceToNextBidder(allowSingleWinnerCheck = true) {
  if (!appState.currentAuction) return;

  const totalAuctioners = appState.config.auctioners.length;
  let nextIdx = appState.currentAuction.activeBidderIndex;

  // Find next active auctioner who hasn't skipped and has open slots
  for (let i = 1; i <= totalAuctioners; i++) {
    const candidateIdx = (appState.currentAuction.activeBidderIndex + i) % totalAuctioners;
    const candidateMeta = appState.config.auctioners[candidateIdx];
    const candidateState = appState.auctionersState[candidateMeta.num];
    const maxExp = calculateMaxExpendable(candidateState);
    const slots = (appState.config.total_players || 25) - candidateState.boughtPlayers.length;

    // Check if eligible
    const isSkipped = appState.currentAuction.skippedAuctioners.has(candidateMeta.num);
    const canAfford = maxExp > appState.currentAuction.currentBid;
    const hasSlots = slots > 0;

    if (!isSkipped && hasSlots && canAfford) {
      nextIdx = candidateIdx;
      break;
    } else if (!isSkipped && (!hasSlots || !canAfford)) {
      // Auto-skip if they cannot afford or have no slots
      appState.currentAuction.skippedAuctioners.add(candidateMeta.num);
    }
  }

  appState.currentAuction.activeBidderIndex = nextIdx;
  appState.currentAuction.timerSeconds = appState.config.countdown;

  // Check if only leading bidder remains active
  const remainingActiveCount = appState.config.auctioners.filter(auc => {
    const st = appState.auctionersState[auc.num];
    const slots = (appState.config.total_players || 25) - st.boughtPlayers.length;
    return !appState.currentAuction.skippedAuctioners.has(auc.num) && slots > 0;
  }).length;

  if (allowSingleWinnerCheck && remainingActiveCount <= 1) {
    // Only 1 bidder left - they win!
    assignCurrentPlayer();
    return;
  }
}

function handleBid(bidAmount) {
  if (!appState.currentAuction || !appState.currentAuction.isStarted) return;

  const activeAuctioner = getActiveBidderAuctioner();
  if (!activeAuctioner) return;

  const maxExp = calculateMaxExpendable(activeAuctioner);

  if (bidAmount <= appState.currentAuction.currentBid) {
    showToast(t('dialogs.bidTooLow', { current: appState.currentAuction.currentBid }), 'error');
    return;
  }

  if (bidAmount > maxExp) {
    showToast(t('dialogs.maxExpendableExceeded', { max: maxExp }), 'error');
    return;
  }

  appState.currentAuction.currentBid = bidAmount;
  appState.currentAuction.leadingBidderNum = activeAuctioner.num;
  elements.customBidInput.value = '';

  if (window.soundFX) window.soundFX.playBid();

  advanceToNextBidder(true);
  updateUI();
}

function handlePass() {
  if (!appState.currentAuction || !appState.currentAuction.isStarted) return;

  const activeAuctioner = getActiveBidderAuctioner();
  if (!activeAuctioner) return;

  // Mark this auctioner as skipped for this player
  appState.currentAuction.skippedAuctioners.add(activeAuctioner.num);
  if (window.soundFX) window.soundFX.playPass();

  advanceToNextBidder(true);
  updateUI();
}

async function assignCurrentPlayer() {
  if (!appState.currentAuction || !appState.currentAuction.player) return;

  stopTimer();

  const leadingBidder = getLeadingBidderAuctioner();
  const player = appState.currentAuction.player;
  const cost = appState.currentAuction.currentBid;

  if (!leadingBidder) {
    showToast('Nessun offerente valido per l\'assegnazione.', 'error');
    return;
  }

  // Deduct credits and add player to squad
  leadingBidder.remainingCredits -= cost;
  const boughtItem = {
    id: player.id,
    name: player.name,
    role: player.role,
    team: player.team,
    cost: cost,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
  leadingBidder.boughtPlayers.push(boughtItem);

  // Update player database entry
  player.status = 'assigned';
  player.cost = cost;
  player.assignedTo = leadingBidder.name;

  // Add to undo history
  appState.history.unshift({
    action: 'assign',
    player: player,
    auctionerNum: leadingBidder.num,
    cost: cost,
    time: boughtItem.time
  });

  if (window.soundFX) window.soundFX.playAssign();

  showToast(`${player.name} assegnato a ${leadingBidder.name} per ${cost} crediti!`, 'success');

  // Advance caller turn to next auctioner with open slots
  advanceCallerTurn();

  // Reset current auction
  appState.currentAuction = null;

  // Auto-save state to disk
  await autoSaveState();

  updateUI();
}

function advanceCallerTurn() {
  const total = appState.config.auctioners.length;
  for (let i = 1; i <= total; i++) {
    const nextIdx = (appState.callOrderIndex + i) % total;
    const aucMeta = appState.config.auctioners[nextIdx];
    const aucState = appState.auctionersState[aucMeta.num];
    const remainingSlots = (appState.config.total_players || 25) - aucState.boughtPlayers.length;
    if (remainingSlots > 0 && aucState.remainingCredits > 0) {
      appState.callOrderIndex = nextIdx;
      return;
    }
  }
}

async function handleUndo() {
  if (appState.history.length === 0) return;

  const lastAction = appState.history.shift();
  if (lastAction.action === 'assign') {
    const aucState = appState.auctionersState[lastAction.auctionerNum];
    if (aucState) {
      aucState.remainingCredits += lastAction.cost;
      aucState.boughtPlayers = aucState.boughtPlayers.filter(p => p.id !== lastAction.player.id);
    }
    const ply = appState.players.find(p => p.id === lastAction.player.id);
    if (ply) {
      ply.status = 'available';
      ply.cost = 0;
      ply.assignedTo = null;
    }
    showToast(`Acquisto di ${lastAction.player.name} annullato!`, 'warning');
    await autoSaveState();
    updateUI();
  }
}

// ==================== Timer Engine ====================
function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    if (!appState.currentAuction || !appState.currentAuction.isStarted || appState.currentAuction.isPaused) return;

    appState.currentAuction.timerSeconds--;
    elements.timerValue.textContent = appState.currentAuction.timerSeconds;

    if (appState.currentAuction.timerSeconds <= 5 && appState.currentAuction.timerSeconds > 0) {
      elements.timerCircle.classList.add('warning');
      if (window.soundFX) window.soundFX.playWarning();
    } else if (appState.currentAuction.timerSeconds > 5) {
      elements.timerCircle.classList.remove('warning');
      if (window.soundFX) window.soundFX.playTick();
    }

    if (appState.currentAuction.timerSeconds <= 0) {
      stopTimer();
      elements.timerCircle.classList.remove('warning');
      // Timer expired: assign player to current high bidder
      assignCurrentPlayer();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  elements.timerCircle.classList.remove('warning');
}

function togglePauseResume() {
  if (!appState.currentAuction || !appState.currentAuction.isStarted) return;
  appState.currentAuction.isPaused = !appState.currentAuction.isPaused;
  elements.btnPauseResume.textContent = appState.currentAuction.isPaused ? '▶' : '⏸';
  elements.auctionStatusBadge.textContent = appState.currentAuction.isPaused ? t('auctionHeader.statusPaused') : t('auctionHeader.statusBidding');
  elements.auctionStatusBadge.className = `status-badge ${appState.currentAuction.isPaused ? 'paused' : 'bidding'}`;
}

function resetCurrentTimer() {
  if (!appState.currentAuction) return;
  appState.currentAuction.timerSeconds = appState.config.countdown;
  elements.timerValue.textContent = appState.currentAuction.timerSeconds;
  elements.timerCircle.classList.remove('warning');
}

// ==================== Auto-Save & Export ====================
async function autoSaveState() {
  if (!window.electronAPI) return;
  const stateData = {
    timestamp: new Date().toISOString(),
    config: appState.config,
    callOrderIndex: appState.callOrderIndex,
    auctionersState: appState.auctionersState,
    players: appState.players,
    history: appState.history,
    lang: appState.lang
  };
  const res = await window.electronAPI.saveAuctionState(stateData);
  if (!res.success) {
    console.error('Save error:', res.error);
  }
}

async function exportSummaryCsv() {
  if (!window.electronAPI) return;
  const exportData = [];
  Object.values(appState.auctionersState).forEach(auc => {
    auc.boughtPlayers.forEach(p => {
      exportData.push({
        auctioner: auc.name,
        playerName: p.name,
        role: p.role,
        team: p.team,
        cost: p.cost,
        time: p.time
      });
    });
  });

  const res = await window.electronAPI.exportCsv(exportData);
  if (res && res.success) {
    showToast(`${t('dialogs.exportSuccess')} ${res.filePath}`, 'success');
  }
}

// ==================== UI Rendering ====================
function updateUI() {
  // 1. Caller display
  const caller = getCallerAuctioner();
  elements.currentCallerName.textContent = caller ? `${caller.num}. ${caller.name}` : '-';

  // 2. Active Auction & Header state
  if (appState.currentAuction && appState.currentAuction.player) {
    elements.playerSelectBox.classList.add('hidden');
    elements.activePlayerDisplay.classList.remove('hidden');

    const p = appState.currentAuction.player;
    elements.playerRoleBadge.textContent = p.role;
    elements.playerRoleBadge.className = `role-badge role-${p.role}`;
    elements.playerNameDisplay.textContent = p.name;
    elements.playerTeamBadge.textContent = p.team;

    elements.currentBidAmount.textContent = appState.currentAuction.currentBid;
    
    const lead = getLeadingBidderAuctioner();
    elements.leadingBidderName.textContent = lead ? lead.name : '-';

    const active = getActiveBidderAuctioner();
    elements.activeBidderName.textContent = active ? active.name : '-';

    elements.timerValue.textContent = appState.currentAuction.timerSeconds;

    if (!appState.currentAuction.isStarted) {
      elements.auctionStatusBadge.textContent = t('auctionHeader.statusIdle');
      elements.auctionStatusBadge.className = 'status-badge idle';
      elements.btnStartRound.disabled = false;
      elements.btnPass.disabled = true;
      elements.btnBid.disabled = true;
      elements.customBidInput.disabled = true;
      elements.quickBidBtns.forEach(b => b.disabled = true);
      elements.btnAssign.disabled = false;
    } else {
      elements.auctionStatusBadge.textContent = appState.currentAuction.isPaused ? t('auctionHeader.statusPaused') : t('auctionHeader.statusBidding');
      elements.auctionStatusBadge.className = `status-badge ${appState.currentAuction.isPaused ? 'paused' : 'bidding'}`;
      elements.btnStartRound.disabled = true;
      elements.btnPass.disabled = false;
      elements.btnBid.disabled = false;
      elements.customBidInput.disabled = false;
      elements.quickBidBtns.forEach(b => b.disabled = false);
      elements.btnAssign.disabled = false;
    }
  } else {
    elements.playerSelectBox.classList.remove('hidden');
    elements.activePlayerDisplay.classList.add('hidden');

    elements.auctionStatusBadge.textContent = t('auctionHeader.statusIdle');
    elements.auctionStatusBadge.className = 'status-badge idle';

    elements.timerValue.textContent = appState.config.countdown;
    elements.timerCircle.classList.remove('warning');

    elements.btnStartRound.disabled = true;
    elements.btnPass.disabled = true;
    elements.btnBid.disabled = true;
    elements.customBidInput.disabled = true;
    elements.quickBidBtns.forEach(b => b.disabled = true);
    elements.btnAssign.disabled = true;
  }

  elements.btnUndo.disabled = appState.history.length === 0;

  // 3. Auctioners Grid & Max-Expendable
  renderAuctionersGrid();

  // 4. Sidebar Lists
  renderSidebarPlayers();
  renderHistoryList();
}

function renderAuctionersGrid() {
  elements.auctionersGrid.innerHTML = '';
  const targetTotal = appState.config.total_players || 25;

  appState.config.auctioners.forEach((aucMeta, idx) => {
    const auc = appState.auctionersState[aucMeta.num];
    if (!auc) return;

    const maxExp = calculateMaxExpendable(auc);
    const boughtCount = auc.boughtPlayers.length;
    const remainingSlots = Math.max(0, targetTotal - boughtCount);
    const spentCredits = auc.initialCredits - auc.remainingCredits;

    const isCurrentCaller = appState.callOrderIndex === idx;
    const isActiveBidder = appState.currentAuction && appState.currentAuction.activeBidderIndex === idx && appState.currentAuction.isStarted;
    const isSkipped = appState.currentAuction && appState.currentAuction.skippedAuctioners.has(auc.num);
    const isLeading = appState.currentAuction && appState.currentAuction.leadingBidderNum === auc.num;

    const card = document.createElement('div');
    card.className = `auctioner-card ${isActiveBidder ? 'active-turn' : ''} ${isSkipped ? 'is-skipped' : ''} ${isCurrentCaller ? 'is-caller' : ''}`;

    let tagHtml = '';
    if (isLeading) {
      tagHtml = `<span class="round-tag lead">Leader: ${appState.currentAuction.currentBid} cr</span>`;
    } else if (isSkipped) {
      tagHtml = `<span class="round-tag skipped">Passato</span>`;
    } else if (isActiveBidder) {
      tagHtml = `<span class="round-tag" style="background: #3b82f6; color: #fff;">Turno Offerta</span>`;
    }

    card.innerHTML = `
      <div class="card-header-row">
        <div class="auctioner-title">
          <span class="auctioner-num">#${auc.num}</span>
          <span class="auctioner-name">${auc.name}</span>
        </div>
        ${tagHtml}
      </div>

      <div class="card-metrics-grid">
        <div class="metric-box">
          <span class="metric-lbl" data-i18n="stats.remainingCredits">Crediti Rimasti</span>
          <span class="metric-val" style="color: #34d399;">${auc.remainingCredits}</span>
        </div>
        <div class="metric-box">
          <span class="metric-lbl" data-i18n="stats.spentCredits">Spesi</span>
          <span class="metric-val" style="color: #fbbf24;">${spentCredits}</span>
        </div>
        <div class="metric-box">
          <span class="metric-lbl" data-i18n="stats.boughtPlayers">Calciatori</span>
          <span class="metric-val">${boughtCount} / ${targetTotal}</span>
        </div>
        <div class="metric-box">
          <span class="metric-lbl" data-i18n="stats.remainingSlots">Slot Liberi</span>
          <span class="metric-val">${remainingSlots}</span>
        </div>
        <div class="max-expendable-box" title="${t('stats.maxExpendableTooltip')}">
          <div class="metric-box">
            <span class="metric-lbl" data-i18n="stats.maxExpendable">Max Spendibile</span>
            <span class="metric-val max-expendable-val">${maxExp}</span>
          </div>
          <span style="font-size: 1.1rem; opacity: 0.8;">⚡</span>
        </div>
      </div>

      <div class="roster-drawer">
        <ul class="roster-list">
          ${auc.boughtPlayers.length === 0 
            ? `<li class="roster-empty" data-i18n="stats.noPlayersYet">Nessun calciatore acquistato finora.</li>`
            : auc.boughtPlayers.map(p => `
              <li class="roster-item">
                <div class="roster-left">
                  <span class="roster-role role-${p.role}">${p.role}</span>
                  <span class="roster-name">${p.name}</span>
                </div>
                <span class="roster-cost">${p.cost}</span>
              </li>
            `).join('')
          }
        </ul>
      </div>
    `;

    elements.auctionersGrid.appendChild(card);
  });

  translatePage();
}

function renderSidebarPlayers() {
  const query = elements.sidebarSearchInput.value.toLowerCase().trim();
  const roleFilter = elements.filterRoleSelect.value;
  const statusFilter = elements.filterStatusSelect.value;

  const filtered = appState.players.filter(p => {
    const matchesSearch = !query || p.name.toLowerCase().includes(query) || p.team.toLowerCase().includes(query);
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  elements.sidebarPlayerList.innerHTML = '';
  if (filtered.length === 0) {
    elements.sidebarPlayerList.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 0.85rem;" data-i18n="playerSearch.noResults">Nessun calciatore trovato</div>`;
    return;
  }

  filtered.slice(0, 100).forEach(p => {
    const item = document.createElement('div');
    item.className = `player-card-sidebar ${p.status === 'assigned' ? 'assigned' : ''}`;
    item.innerHTML = `
      <div class="sidebar-player-info">
        <span class="sp-role role-${p.role}">${p.role}</span>
        <div>
          <div class="sp-name">${p.name}</div>
          <div class="sp-team">${p.team} ${p.status === 'assigned' ? `• <span style="color: #34d399;">${p.assignedTo} (${p.cost} cr)</span>` : ''}</div>
        </div>
      </div>
      ${p.status === 'available' ? `
        <button class="btn-sidebar-call" data-id="${p.id}" data-i18n="playerSearch.callBtn">Metti all'Asta</button>
      ` : ''}
    `;

    const btnCall = item.querySelector('.btn-sidebar-call');
    if (btnCall) {
      btnCall.addEventListener('click', () => selectPlayerForAuction(p));
    }

    elements.sidebarPlayerList.appendChild(item);
  });
}

function renderHistoryList() {
  elements.historyList.innerHTML = '';
  if (appState.history.length === 0) {
    elements.historyList.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 0.85rem;" data-i18n="history.empty">Nessuna assegnazione recente.</div>`;
    return;
  }

  appState.history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-header">
        <span><strong style="color: #fff;">${item.player.name}</strong> (${item.player.role}, ${item.player.team})</span>
        <span class="history-cost">${item.cost} cr</span>
      </div>
      <div style="display: flex; justify-content: space-between; color: var(--text-muted);">
        <span>${t('history.assignedTo')} <span class="history-buyer">${appState.auctionersState[item.auctionerNum]?.name || item.auctionerNum}</span></span>
        <span>${item.time || ''}</span>
      </div>
    `;
    elements.historyList.appendChild(div);
  });
}

// ==================== Autocomplete Search ====================
function handleAutocompleteSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    elements.autocompleteDropdown.classList.add('hidden');
    elements.btnClearSearch.classList.add('hidden');
    return;
  }

  elements.btnClearSearch.classList.remove('hidden');

  const matches = appState.players.filter(p => 
    p.status === 'available' && (p.name.toLowerCase().includes(query) || p.team.toLowerCase().includes(query))
  ).slice(0, 10);

  if (matches.length === 0) {
    elements.autocompleteDropdown.innerHTML = `<div style="padding: 10px; color: var(--text-dim); font-size: 0.85rem;" data-i18n="playerSearch.noResults">Nessun calciatore disponibile trovato</div>`;
    elements.autocompleteDropdown.classList.remove('hidden');
    return;
  }

  elements.autocompleteDropdown.innerHTML = '';
  matches.forEach(p => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.innerHTML = `
      <div class="ac-left">
        <span class="role-badge role-${p.role}" style="width: 22px; height: 22px; font-size: 0.75rem;">${p.role}</span>
        <span class="ac-name">${p.name}</span>
      </div>
      <span class="ac-team">${p.team}</span>
    `;
    item.addEventListener('click', () => {
      selectPlayerForAuction(p);
    });
    elements.autocompleteDropdown.appendChild(item);
  });

  elements.autocompleteDropdown.classList.remove('hidden');
}

// ==================== Events & Handlers ====================
function bindEvents() {
  // Lang change
  elements.langSelect.addEventListener('change', (e) => {
    loadLanguage(e.target.value);
  });

  // Sound toggle
  elements.btnToggleSound.addEventListener('click', () => {
    if (window.soundFX) {
      const enabled = window.soundFX.toggle();
      elements.soundIcon.textContent = enabled ? '🔊' : '🔇';
      showToast(enabled ? 'Audio attivato' : 'Audio disattivato');
    }
  });

  // Autocomplete Input
  elements.playerCallInput.addEventListener('input', handleAutocompleteSearch);
  elements.playerCallInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const firstItem = elements.autocompleteDropdown.querySelector('.autocomplete-item');
      if (firstItem) firstItem.click();
    }
  });
  elements.btnClearSearch.addEventListener('click', () => {
    elements.playerCallInput.value = '';
    elements.autocompleteDropdown.classList.add('hidden');
    elements.btnClearSearch.classList.add('hidden');
  });

  // Header Actions
  elements.btnStartRound.addEventListener('click', startAuctionRound);
  elements.btnPass.addEventListener('click', handlePass);
  
  elements.btnBid.addEventListener('click', () => {
    const val = parseInt(elements.customBidInput.value, 10);
    if (!isNaN(val)) handleBid(val);
  });

  elements.customBidInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(elements.customBidInput.value, 10);
      if (!isNaN(val)) handleBid(val);
    }
  });

  elements.quickBidBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!appState.currentAuction) return;
      const inc = parseInt(btn.getAttribute('data-inc'), 10);
      handleBid(appState.currentAuction.currentBid + inc);
    });
  });

  elements.btnAssign.addEventListener('click', assignCurrentPlayer);
  elements.btnUndo.addEventListener('click', handleUndo);

  elements.btnPauseResume.addEventListener('click', togglePauseResume);
  elements.btnResetTimer.addEventListener('click', resetCurrentTimer);

  // File Nav
  elements.btnLoadConfig.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    const file = await window.electronAPI.selectFile([{ name: 'YAML Config', extensions: ['yaml', 'yml'] }]);
    if (file) {
      const cfg = await window.electronAPI.readConfigFile(file.filePath);
      if (cfg) {
        applyConfig(cfg);
        showToast(t('dialogs.loadSuccess'), 'success');
        updateUI();
      }
    }
  });

  elements.btnLoadPlayers.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    const file = await window.electronAPI.selectFile([{ name: 'CSV Players', extensions: ['csv', 'txt'] }]);
    if (file) {
      const ply = await window.electronAPI.readPlayersFile(file.filePath);
      if (ply && ply.length > 0) {
        appState.players = ply;
        showToast(`${ply.length} calciatori caricati con successo!`, 'success');
        updateUI();
      }
    }
  });

  elements.btnLoadSave.addEventListener('click', showSavedSessionsModal);
  elements.btnExportCsv.addEventListener('click', exportSummaryCsv);

  // Sidebar Tabs & Filters
  elements.tabPlayers.addEventListener('click', () => {
    elements.tabPlayers.classList.add('active');
    elements.tabHistory.classList.remove('active');
    elements.playersTabContent.classList.add('active');
    elements.historyTabContent.classList.remove('active');
  });

  elements.tabHistory.addEventListener('click', () => {
    elements.tabHistory.classList.add('active');
    elements.tabPlayers.classList.remove('active');
    elements.historyTabContent.classList.add('active');
    elements.playersTabContent.classList.remove('active');
  });

  elements.sidebarSearchInput.addEventListener('input', renderSidebarPlayers);
  elements.filterRoleSelect.addEventListener('change', renderSidebarPlayers);
  elements.filterStatusSelect.addEventListener('change', renderSidebarPlayers);

  // Modal close
  elements.btnCloseModal.addEventListener('click', () => {
    elements.modalOverlay.classList.add('hidden');
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (appState.currentAuction && !appState.currentAuction.isStarted) {
        startAuctionRound();
      } else if (appState.currentAuction && appState.currentAuction.isStarted) {
        togglePauseResume();
      }
    } else if (e.key === 's' || e.key === 'S') {
      if (appState.currentAuction && appState.currentAuction.isStarted) {
        handlePass();
      }
    } else if (e.key === 'a' || e.key === 'A') {
      if (appState.currentAuction) {
        assignCurrentPlayer();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      handleUndo();
    }
  });
}

// ==================== Modal Helpers ====================
async function showSavedSessionsModal() {
  if (!window.electronAPI) return;
  const sessions = await window.electronAPI.getSavedSessions();
  elements.modalTitle.textContent = t('topNav.loadSave');
  elements.modalBody.innerHTML = '';

  if (sessions.length === 0) {
    elements.modalBody.innerHTML = `<p style="color: var(--text-dim); text-align: center; padding: 20px;">Nessun salvataggio trovato nella cartella 'save'.</p>`;
  } else {
    sessions.forEach(sess => {
      const item = document.createElement('div');
      item.className = 'session-item';
      const dateFormatted = new Date(sess.mtime).toLocaleString();
      item.innerHTML = `
        <div>
          <strong style="color: #fff;">${sess.filename}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${dateFormatted}</div>
        </div>
        <button class="btn-nav" style="background: #3b82f6; color: #fff;">Carica</button>
      `;
      item.addEventListener('click', async () => {
        const savedState = await window.electronAPI.loadSavedState(sess.filePath);
        if (savedState) {
          appState.config = savedState.config || appState.config;
          appState.callOrderIndex = savedState.callOrderIndex || 0;
          appState.auctionersState = savedState.auctionersState || appState.auctionersState;
          appState.players = savedState.players || appState.players;
          appState.history = savedState.history || [];
          appState.currentAuction = null;
          if (savedState.lang) {
            elements.langSelect.value = savedState.lang;
            loadLanguage(savedState.lang);
          }
          elements.modalOverlay.classList.add('hidden');
          showToast('Sessione ripristinata con successo!', 'success');
          updateUI();
        }
      });
      elements.modalBody.appendChild(item);
    });
  }

  elements.modalOverlay.classList.remove('hidden');
}

function showToast(message, type = 'info') {
  elements.toastNotification.textContent = message;
  elements.toastNotification.className = `toast ${type}`;
  elements.toastNotification.classList.remove('hidden');

  setTimeout(() => {
    elements.toastNotification.classList.add('hidden');
  }, 3500);
}

// Start
window.addEventListener('DOMContentLoaded', initApp);
