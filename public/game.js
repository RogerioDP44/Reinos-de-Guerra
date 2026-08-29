// --- MOTOR CLIENTE REINOS DE GUERRA PERFEITO (MULTIPLAYER REAL-TIME + BATALHAS + TIMERS) ---

let socket = null;
let canvas = null;
let ctx = null;

let currentUser = null;
let selfKingdom = null;

// Câmera Arrastável
let cameraOffset = { x: 0, y: 0 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };

// Efeitos Visuais Flutuantes
const floatingEffects = [];

// Sintetizador de Som (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;

  if (type === 'gold') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now);
    osc.frequency.setValueAtTime(1318.51, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'hammer') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.15);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'victory') {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, index) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.12);
      gain.gain.setValueAtTime(0.3, now + index * 0.12);
      gain.gain.linearRampToValueAtTime(0.01, now + index * 0.12 + 0.25);
      osc.start(now + index * 0.12);
      osc.stop(now + index * 0.12 + 0.25);
    });
  } else if (type === 'defeat') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

// INICIALIZAÇÃO
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  setupCameraDrag();
  setupSocket();
  setupCanvasHuntingClick();
  renderLoop();
  checkCookieConsent();
  runSplashScreen();
});

function runSplashScreen() {
  const fill = document.getElementById('splash-loader-fill');
  const btn = document.getElementById('btn-enter-splash');
  
  // Tenta auto-login com a sessão salva enquanto carrega a splash
  autoLoginSavedSession();

  if (fill) {
    setTimeout(() => { fill.style.width = '100%'; }, 100);
    setTimeout(() => {
      if (btn) btn.classList.remove('hidden');
    }, 1400);
  }
}

async function autoLoginSavedSession() {
  const savedUser = localStorage.getItem('reinos_auth_user');
  const savedPass = localStorage.getItem('reinos_auth_pass');

  if (savedUser && savedPass) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: savedUser, password: savedPass })
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        socket.emit('join_game', { username: data.user.username });
        return true;
      }
    } catch (err) {}
  }
  return false;
}

function closeSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.classList.add('hidden');
      if (!currentUser) {
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.classList.remove('hidden');
      }
    }, 400);
  }
}

function logoutUser() {
  if (confirm('Deseja realmente sair da sua conta do Império?')) {
    localStorage.removeItem('reinos_auth_user');
    localStorage.removeItem('reinos_auth_pass');
    location.reload();
  }
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// CONTROLE DE ARRASTAR A CÂMERA DO MAPA (MOUSE + TOUCH MOBILE)
function setupCameraDrag() {
  // Mouse (Desktop)
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStart = { x: e.clientX - cameraOffset.x, y: e.clientY - cameraOffset.y };
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      cameraOffset.x = e.clientX - dragStart.x;
      cameraOffset.y = e.clientY - dragStart.y;
    }
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  // Touch (Celulares & Tablets)
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      dragStart = { x: e.touches[0].clientX - cameraOffset.x, y: e.touches[0].clientY - cameraOffset.y };
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
      cameraOffset.x = e.touches[0].clientX - dragStart.x;
      cameraOffset.y = e.touches[0].clientY - dragStart.y;
    }
  }, { passive: true });

  window.addEventListener('touchend', () => { isDragging = false; });
}

function toggleChatCard() {
  const card = document.getElementById('chat-card');
  if (card) {
    card.classList.toggle('minimized');
    const btn = card.querySelector('.btn-chat-toggle');
    if (btn) btn.innerText = card.classList.contains('minimized') ? '+' : '–';
  }
}

// WEBSOCKETS (SOCKET.IO)
function setupSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('[Socket] Conectado ao servidor do Império.');
  });

  socket.on('init_kingdom', (kingdomData) => {
    selfKingdom = kingdomData;
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('game-hud').classList.remove('hidden');
    updateHud(kingdomData);
  });

  socket.on('resource_tick', (tickData) => {
    if (selfKingdom) {
      const prevGold = selfKingdom.gold;
      const prevWood = selfKingdom.wood;

      selfKingdom.gold = tickData.gold;
      selfKingdom.maxGold = tickData.maxGold;
      selfKingdom.wood = tickData.wood;
      selfKingdom.maxWood = tickData.maxWood;
      selfKingdom.gems = tickData.gems;
      selfKingdom.trophies = tickData.trophies;
      if (tickData.buildings) selfKingdom.buildings = tickData.buildings;
      selfKingdom.shieldUntil = tickData.shieldUntil;

      // Efeito de Moedas Subindo na Tela
      if (tickData.gold > prevGold) {
        floatingEffects.push({ x: canvas.width / 2 - 100, y: canvas.height / 2, text: `+${tickData.gold - prevGold} 🪙`, color: '#f59e0b', life: 40 });
      }

      updateHud(selfKingdom);
    }
  });

  socket.on('account_updated', ({ gems, isVip, message }) => {
    if (selfKingdom) {
      selfKingdom.gems = gems;
      selfKingdom.isVip = isVip;
      updateHud(selfKingdom);
    }
    if (message) alert(message);
  });

  socket.on('chat_message', (data) => {
    addChatMessage(data.sender, data.text, data.type, data.isVip, data.role);
  });
}

function switchAuthTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('auth-submit-btn').innerText = tab === 'login' ? 'ENTRAR NO IMPÉRIO ⚔️' : 'FUNDAR NOVO REINO 🏰';
  
  const lgpdGroup = document.getElementById('lgpd-checkbox-group');
  if (lgpdGroup) {
    lgpdGroup.classList.toggle('hidden', tab !== 'register');
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  document.getElementById('auth-error').innerText = '';

  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const isRegister = document.getElementById('tab-register').classList.contains('active');

  if (isRegister) {
    const lgpdChecked = document.getElementById('auth-lgpd-check')?.checked;
    if (!lgpdChecked) {
      document.getElementById('auth-error').innerText = 'Você precisa ler e aceitar os Termos de Uso & LGPD para fundar um reino!';
      return;
    }
  }

  const endpoint = isRegister ? '/api/register' : '/api/login';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('reinos_auth_user', username);
      localStorage.setItem('reinos_auth_pass', password);
      socket.emit('join_game', { username: data.user.username });
    } else {
      document.getElementById('auth-error').innerText = data.message;
    }
  } catch (err) {
    document.getElementById('auth-error').innerText = 'Erro ao conectar ao servidor.';
  }
}

// --- LGPD & COOKIES HELPERS ---
function toggleLgpdModal(e) {
  if (e) e.preventDefault();
  const modal = document.getElementById('lgpd-modal');
  if (modal) modal.classList.toggle('hidden');
}

function checkCookieConsent() {
  const accepted = localStorage.getItem('lgpd_cookies_accepted');
  if (!accepted) {
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.classList.remove('hidden');
  }
}

function acceptCookies() {
  localStorage.setItem('lgpd_cookies_accepted', 'true');
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.classList.add('hidden');
}

function updateHud(k) {
  document.getElementById('hud-kingdom-name').innerText = k.kingdomName || k.username;
  document.getElementById('hud-gold').innerText = `${Math.floor(k.gold)} / ${k.maxGold}`;
  document.getElementById('hud-wood').innerText = `${Math.floor(k.wood)} / ${k.maxWood}`;
  if (document.getElementById('hud-meat')) document.getElementById('hud-meat').innerText = k.meat || 0;
  if (document.getElementById('hud-leather')) document.getElementById('hud-leather').innerText = k.leather || 0;
  document.getElementById('hud-gems').innerText = k.gems;
  document.getElementById('hud-trophies').innerText = k.trophies;

  const vipBadge = document.getElementById('hud-vip-badge');
  if (k.isVip) vipBadge.classList.remove('hidden');
  else vipBadge.classList.add('hidden');

  const shieldBadge = document.getElementById('hud-shield-badge');
  if (k.shieldUntil && new Date(k.shieldUntil) > new Date()) {
    shieldBadge.classList.remove('hidden');
  } else {
    shieldBadge.classList.add('hidden');
  }
}

// CHAT DA GUERRA
function handleSendChat(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  if (input.value.trim()) {
    socket.emit('send_chat', input.value);
    input.value = '';
  }
}

function addChatMessage(sender, text, type = 'normal', isVip = false, role = 'player') {
  const box = document.getElementById('chat-messages');
  const line = document.createElement('div');
  line.className = `chat-msg-line ${type} ${isVip ? 'vip' : ''}`;
  if (type === 'system') {
    line.innerHTML = `<span>${text}</span>`;
  } else {
    const vipCrown = isVip ? '👑 ' : '';
    line.innerHTML = `<span class="sender">${vipCrown}${sender}:</span> ${text}`;
  }
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

// EDIFÍCIOS DA VILA & TIMERS DE CONSTRUÇÃO (COM DESBLOQUEIO POR NÍVEL DO CENTRO DA VILA)
function toggleBuildingsModal() {
  const modal = document.getElementById('buildings-modal');
  const isOpening = modal.classList.contains('hidden');
  modal.classList.toggle('hidden');

  if (isOpening && selfKingdom) {
    const grid = document.getElementById('buildings-grid');
    grid.innerHTML = '';

    const townhall = selfKingdom.buildings.find(b => b.id === 'townhall');
    const townhallLevel = townhall ? townhall.level : 1;

    const REQ_LEVELS = {
      townhall: 1,
      goldmine: 1,
      sawmill: 1,
      barracks: 2,
      tower: 2,
      wall: 2,
      alchemy: 3,
      gemmine: 4
    };

    selfKingdom.buildings.forEach(b => {
      const minReq = REQ_LEVELS[b.id] || 1;
      const isLocked = townhallLevel < minReq;
      const requiresTownhallUpgrade = (b.id !== 'townhall') && (b.level >= townhallLevel);

      const baseCost = b.level === 0 ? 300 : b.level * 250;
      const costGold = baseCost;
      const costWood = baseCost;
      const now = Date.now();
      const isUpgrading = b.isUpgrading && b.finishTime && now < b.finishTime;
      const remainingSec = isUpgrading ? Math.ceil((b.finishTime - now) / 1000) : 0;

      const card = document.createElement('div');
      card.className = `building-card ${isLocked ? 'locked-building' : ''}`;
      
      let buttonHtml = '';
      if (isLocked) {
        buttonHtml = `<button class="btn btn-secondary btn-sm" disabled>🔒 BLOQUEADO (REQUER VILA NÍVEL ${minReq})</button>`;
      } else if (requiresTownhallUpgrade) {
        buttonHtml = `<div style="font-size:11px; color:#f59e0b; margin-bottom:6px;">👑 Requer Centro da Vila Nível ${b.level + 1}</div>
                      <button class="btn btn-secondary btn-sm" disabled>MELHORE O CENTRO DA VILA 🏰</button>`;
      } else if (isUpgrading) {
        buttonHtml = `<div style="color:#38bdf8; font-weight:bold; font-size:13px; margin-bottom:8px;">⏳ Obras em Andamento: ${remainingSec}s</div>
                      <button class="btn btn-gold btn-sm" onclick="finishGemsBuilding('${b.id}')">CONCLUIR COM GEMAS ⚡</button>`;
      } else {
        const actionLabel = b.level === 0 ? 'CONSTRUIR 🔨' : 'EVOLUIR EDIFÍCIO 🔨';
        buttonHtml = `<div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">Custo: 🪙 ${costGold} | 🪓 ${costWood}</div>
                      <button class="btn btn-primary btn-sm" onclick="startUpgradeBuilding('${b.id}')">${actionLabel}</button>`;
      }

      card.innerHTML = `
        <div>
          <div class="building-icon">${b.icon}</div>
          <div style="font-weight:bold; font-size:16px;">${b.name} ${isLocked ? '🔒' : ''}</div>
          <div style="color:var(--gold-color); font-size:13px; margin:4px 0;">
            ${b.level > 0 ? `Nível ${b.level}` : '<span style="color:#94a3b8;">Não Construído</span>'}
          </div>
          <div style="font-size:11px; color:var(--text-muted);">Liberado no Centro da Vila Nível ${minReq}</div>
        </div>
        <div style="margin-top:12px;">
          ${buttonHtml}
        </div>
      `;
      grid.appendChild(card);
    });
  }
}

async function startUpgradeBuilding(buildingId) {
  if (!selfKingdom) return;
  try {
    const res = await fetch('/api/kingdom/start-upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: selfKingdom.username, buildingId })
    });
    const data = await res.json();
    if (data.success) {
      playSound('hammer');
      selfKingdom = data.user;
      updateHud(selfKingdom);
      alert('🔨 Obras iniciadas! Os pedreiros do Reino começaram a construir.');
      toggleBuildingsModal();
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Erro ao iniciar obra.');
  }
}

async function finishGemsBuilding(buildingId) {
  if (!selfKingdom) return;
  try {
    const res = await fetch('/api/kingdom/finish-gems-building', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: selfKingdom.username, buildingId })
    });
    const data = await res.json();
    if (data.success) {
      playSound('gold');
      selfKingdom = data.user;
      updateHud(selfKingdom);
      alert('⚡ Obra concluída instantaneamente com Gemas!');
      toggleBuildingsModal();
    } else {
      alert(data.message);
    }
  } catch (err) {}
}

async function buyShieldModal() {
  if (!selfKingdom) return;
  if (confirm('Deseja ativar o ESCUDO DE PAZ de 12 horas por 30 Gemas? Seu reino ficará imune a saques!')) {
    try {
      const res = await fetch('/api/kingdom/buy-shield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selfKingdom.username, hours: 12 })
      });
      const data = await res.json();
      if (data.success) {
        playSound('gold');
        selfKingdom = data.user;
        updateHud(selfKingdom);
        alert('🛡️ Escudo de Paz Ativado com Sucesso! Seu Reino está seguro contra invasões por 12 horas.');
      } else {
        alert(data.message);
      }
    } catch (err) {}
  }
}

// TROPAS DO EXÉRCITO
function toggleArmyModal() {
  const modal = document.getElementById('army-modal');
  const isOpening = modal.classList.contains('hidden');
  modal.classList.toggle('hidden');

  if (isOpening && selfKingdom) {
    const countsRow = document.getElementById('army-counts-row');
    const army = selfKingdom.army || {};
    countsRow.innerHTML = `
      <div>⚔️ Guerreiros: <b>${army.warrior || 0}</b></div>
      <div>🏹 Arqueiras: <b>${army.archer || 0}</b></div>
      <div>🧙‍♂️ Magos: <b>${army.wizard || 0}</b></div>
      <div>🐉 Dragões: <b>${army.dragon || 0}</b></div>
    `;

    const grid = document.getElementById('troops-grid');
    grid.innerHTML = '';

    const TROOPS = [
      { id: 'warrior', name: 'Guerreiro ⚔️', icon: '🗡️', gold: 20, wood: 10, power: 10 },
      { id: 'archer', name: 'Arqueira 🏹', icon: '🏹', gold: 35, wood: 25, power: 16 },
      { id: 'wizard', name: 'Mago de Fogo 🧙‍♂️', icon: '🔥', gold: 90, wood: 60, power: 45 },
      { id: 'dragon', name: 'Dragão de Elite 🐉', icon: '🐉', gold: 350, wood: 250, power: 160 }
    ];

    TROOPS.forEach(tr => {
      const card = document.createElement('div');
      card.className = 'troop-card';
      card.innerHTML = `
        <div>
          <div class="troop-icon">${tr.icon}</div>
          <div style="font-weight:bold; font-size:15px;">${tr.name}</div>
          <div style="color:var(--text-muted); font-size:12px; margin-top:4px;">Poder de Ataque: +${tr.power}</div>
        </div>
        <div style="margin-top:12px;">
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">
            Custo: 🪙 ${tr.gold} | 🪓 ${tr.wood}
          </div>
          <button class="btn btn-primary btn-sm" onclick="trainTroop('${tr.id}')">TREINAR (+1)</button>
        </div>
      `;
      grid.appendChild(card);
    });
  }
}

async function trainTroop(troopType) {
  if (!selfKingdom) return;
  try {
    const res = await fetch('/api/kingdom/train-troop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: selfKingdom.username, troopType, count: 1 })
    });
    const data = await res.json();
    if (data.success) {
      playSound('hammer');
      selfKingdom = data.user;
      updateHud(selfKingdom);
      toggleArmyModal();
    } else {
      alert(data.message);
    }
  } catch (err) {}
}

// ATAQUE E ANIMAÇÃO DE BATALHA MULTIPLAYER
async function toggleAttackModal() {
  const modal = document.getElementById('attack-modal');
  const isOpening = modal.classList.contains('hidden');
  modal.classList.toggle('hidden');

  if (isOpening && selfKingdom) {
    try {
      const res = await fetch(`/api/kingdom/list-enemies?username=${selfKingdom.username}`);
      const enemies = await res.json();
      const list = document.getElementById('enemies-list');
      list.innerHTML = '';

      if (enemies.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);">Nenhum outro Reino cadastrado no momento. Convide amigos para jogar!</p>';
        return;
      }

      enemies.forEach(en => {
        const card = document.createElement('div');
        card.className = 'enemy-card';
        card.innerHTML = `
          <div>
            <div style="font-weight:bold; font-size:16px; color:#fbbf24;">
              🏰 ${en.kingdomName} ${en.isVip ? '👑' : ''} ${en.isShielded ? '🛡️ [PROTEGIDO]' : ''}
            </div>
            <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">
              Imperador: <b>${en.username}</b> | 🏆 ${en.trophies} Troféus | Vila Nível ${en.townHallLevel}
            </div>
            <div style="font-size:12px; color:#34d399; margin-top:2px;">
              Recursos Disponíveis para Saque: ~🪙 ${Math.floor(en.gold * 0.35)} Ouro
            </div>
          </div>
          ${en.isShielded ? '<button class="btn btn-secondary btn-sm" disabled>PROTEGIDO 🛡️</button>' : 
            `<button class="btn btn-attack btn-sm" onclick="startBattle('${en.username}')">MARCHAR & ATACAR ⚔️</button>`}
        `;
        list.appendChild(card);
      });
    } catch (err) {}
  }
}

async function startBattle(defenderName) {
  if (!selfKingdom) return;
  toggleAttackModal();

  // Abre Modal de Animação de Batalha em Tempo Real
  const battleModal = document.getElementById('battle-modal');
  battleModal.classList.remove('hidden');
  document.getElementById('battle-title').innerText = '⚔️ BATALHA EM ANDAMENTO...';
  document.getElementById('battle-attacker-side').innerText = `⚔️ ${selfKingdom.kingdomName}`;
  document.getElementById('battle-defender-side').innerText = `🏰 Reino de ${defenderName}`;
  document.getElementById('battle-result-text').innerText = 'Marchando tropas para as muralhas inimigas...';
  document.getElementById('btn-close-battle').classList.add('hidden');

  const progressBar = document.getElementById('battle-progress-bar');
  progressBar.style.width = '0%';
  setTimeout(() => { progressBar.style.width = '100%'; }, 50);

  try {
    const res = await fetch('/api/kingdom/attack-enemy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attackerName: selfKingdom.username, defenderName })
    });
    const data = await res.json();

    setTimeout(() => {
      if (data.success) {
        const b = data.battle;
        if (b.isVictory) {
          playSound('victory');
          document.getElementById('battle-title').innerText = '🏆 VITÓRIA IMPERIAL!';
          document.getElementById('battle-result-text').innerHTML = `
            <span style="color:#34d399;">Seu exército destruiu o Reino de ${defenderName}!</span><br>
            <span style="color:#fbbf24;">Saqueado: 🪙 +${b.lootedGold} Ouro | 🪓 +${b.lootedWood} Madeira (+25 🏆)</span>
          `;
        } else {
          playSound('defeat');
          document.getElementById('battle-title').innerText = '☠️ DERROTA NAS MURALHAS!';
          document.getElementById('battle-result-text').innerHTML = `
            <span style="color:#f87171;">As defesas do Reino de ${defenderName} repeliram seu ataque!</span><br>
            <span style="color:#94a3b8;">Perdeu: -15 Troféus 🏆</span>
          `;
        }
        selfKingdom = data.user;
        updateHud(selfKingdom);
        document.getElementById('btn-close-battle').classList.remove('hidden');
      } else {
        alert(data.message);
        battleModal.classList.add('hidden');
      }
    }, 2000);
  } catch (err) {
    alert('Erro ao atacar reino.');
    battleModal.classList.add('hidden');
  }
}

function closeBattleModal() {
  document.getElementById('battle-modal').classList.add('hidden');
}

// LOJA PIX
async function toggleShopModal() {
  const modal = document.getElementById('shop-modal');
  const isOpening = modal.classList.contains('hidden');
  modal.classList.toggle('hidden');

  if (isOpening) {
    document.getElementById('pix-payment-area').classList.add('hidden');
    try {
      const res = await fetch('/api/pix/packages');
      const packages = await res.json();
      const list = document.getElementById('shop-packages-list');
      list.innerHTML = '';

      Object.keys(packages).forEach(pkgId => {
        const pkg = packages[pkgId];
        const card = document.createElement('div');
        card.className = 'package-card';
        card.innerHTML = `
          <div>
            <div class="package-icon">${pkg.vipDays > 0 ? '👑' : '💎'}</div>
            <div class="package-title">${pkg.name}</div>
          </div>
          <div>
            <div class="package-price">R$ ${pkg.price.toFixed(2)}</div>
            <button class="btn btn-gold btn-sm" onclick="buyPixPackage('${pkgId}')">GERAR PIX ⚡</button>
          </div>
        `;
        list.appendChild(card);
      });
    } catch (err) {}
  }
}

async function buyPixPackage(packageId) {
  if (!selfKingdom) return;
  try {
    const res = await fetch('/api/pix/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: selfKingdom.username, packageId })
    });
    const data = await res.json();
    if (data.success) {
      currentPixPaymentId = data.pix.paymentId;
      document.getElementById('pix-copy-paste').value = data.pix.qrCode;
      document.getElementById('pix-payment-area').classList.remove('hidden');
    }
  } catch (err) {}
}

function copyPixCode() {
  const textarea = document.getElementById('pix-copy-paste');
  textarea.select();
  document.execCommand('copy');
  alert('Código PIX copiado! Pague no aplicativo do seu banco.');
}

async function simulatePixPayment() {
  let paymentId = currentPixPaymentId;
  if (!paymentId) {
    const code = document.getElementById('pix-copy-paste').value;
    const match = code.match(/PIX_KINGDOM_\d+_\d+/);
    paymentId = match ? match[0] : null;
  }
  if (!paymentId) return alert('Nenhum pagamento PIX ativo.');

  try {
    const res = await fetch('/api/pix/simulate-approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId })
    });
    const data = await res.json();
    if (data.success) {
      alert('🎉 PAGAMENTO PIX CONFIRMADO! Gemas adicionadas ao seu Reino!');
      toggleShopModal();
    } else {
      alert(data.message || 'Erro ao processar PIX.');
    }
  } catch (err) {}
}

async function toggleRankingModal() {
  const modal = document.getElementById('ranking-modal');
  const isOpening = modal.classList.contains('hidden');
  modal.classList.toggle('hidden');

  if (isOpening) {
    try {
      const res = await fetch('/api/ranking');
      const rank = await res.json();
      const list = document.getElementById('ranking-list');
      list.innerHTML = rank.map((r, i) => `
        <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid rgba(255,255,255,0.1);">
          <span>#${i + 1} ${r.isVip ? '👑' : ''} <b>${r.kingdomName || r.username}</b></span>
          <span>🏆 ${r.trophies} Troféus</span>
        </div>
      `).join('');
    } catch (err) {}
  }
}

// ANIMAÇÕES 2D, ALDEÕES, FUMAÇA E CICLO DIA/NOITE
// =========================================================================
let frameCount = 0;
let villagers = [];
let smokeParticles = [];

function getDayNightCycle() {
  const cycleSeconds = 120;
  const progress = (Date.now() / 1000 % cycleSeconds) / cycleSeconds;

  let shadowColor = 'rgba(0, 0, 0, 0)';
  let bgGrassColor = '#14532d';
  let phaseName = '☀️ DIA';
  let isNight = false;

  if (progress < 0.45) {
    phaseName = '☀️ DIA';
    shadowColor = 'rgba(0, 0, 0, 0)';
    bgGrassColor = '#14532d';
  } else if (progress < 0.55) {
    const t = (progress - 0.45) / 0.10;
    phaseName = '🌅 PÔR DO SOL';
    shadowColor = `rgba(217, 119, 6, ${t * 0.35})`;
    bgGrassColor = '#164e28';
  } else if (progress < 0.90) {
    phaseName = '🌙 NOITE';
    shadowColor = 'rgba(9, 13, 22, 0.65)';
    bgGrassColor = '#0f3820';
    isNight = true;
  } else {
    const t = (progress - 0.90) / 0.10;
    phaseName = '🌅 AMANHECER';
    shadowColor = `rgba(9, 13, 22, ${0.65 * (1 - t)})`;
    bgGrassColor = '#14532d';
  }

  return { progress, phaseName, shadowColor, bgGrassColor, isNight };
}

function updateAndRenderVillagers(startX, startY) {
  if (villagers.length === 0 && selfKingdom) {
    const roles = [
      { icon: '🧑‍🌾' },
      { icon: '🔨' },
      { icon: '🧙‍♂️' },
      { icon: '💂‍♂️' }
    ];

    roles.forEach((r, idx) => {
      villagers.push({
        id: idx,
        icon: r.icon,
        x: startX + 100 + (idx * 60),
        y: startY + 120 + (idx * 40),
        targetX: startX + Math.random() * 450,
        targetY: startY + Math.random() * 350,
        speed: 0.7 + Math.random() * 0.5,
        stepOffset: Math.random() * 10
      });
    });
  }

  villagers.forEach(v => {
    const dx = v.targetX - v.x;
    const dy = v.targetY - v.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 8) {
      v.targetX = startX + Math.random() * 450;
      v.targetY = startY + Math.random() * 350;
    } else {
      v.x += (dx / dist) * v.speed;
      v.y += (dy / dist) * v.speed;
    }

    const bounce = Math.abs(Math.sin((frameCount + v.stepOffset) * 0.15)) * 5;

    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(v.icon, v.x, v.y - bounce);

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(v.x, v.y, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function updateAndRenderSmoke(buildings, startX, startY) {
  if (frameCount % 10 === 0) {
    buildings.forEach(b => {
      if (b.level > 0 && ['goldmine', 'sawmill', 'alchemy'].includes(b.id)) {
        const bx = startX + (b.x * 130);
        const by = startY + (b.y * 110);
        smokeParticles.push({
          x: bx + (Math.random() * 8 - 4),
          y: by - 35,
          radius: 3 + Math.random() * 3,
          alpha: 0.6,
          vx: Math.random() * 0.3 - 0.15,
          vy: -0.8 - Math.random() * 0.4
        });
      }
    });
  }

  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    const p = smokeParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.radius += 0.08;
    p.alpha -= 0.008;

    if (p.alpha <= 0) {
      smokeParticles.splice(i, 1);
      continue;
    }

    ctx.fillStyle = `rgba(226, 232, 240, ${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWavingFlag(bx, by) {
  const wave = Math.sin(frameCount * 0.12) * 4;
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(bx + 12, by - 55);
  ctx.quadraticCurveTo(bx + 26 + wave, by - 50, bx + 36, by - 55 + wave);
  ctx.lineTo(bx + 12, by - 38);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bx + 12, by - 60);
  ctx.lineTo(bx + 12, by - 30);
  ctx.stroke();
}

function drawBuildingTorch(bx, by) {
  const flamePulse = 3 + Math.sin(frameCount * 0.2 + bx) * 2;
  const grad = ctx.createRadialGradient(bx, by, 2, bx, by, 30);
  grad.addColorStop(0, 'rgba(251, 191, 36, 0.8)');
  grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.3)');
  grad.addColorStop(1, 'rgba(245, 158, 11, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(bx, by, 30, 0, Math.PI * 2);
  ctx.fill();
}

// SISTEMA DE RECURSOS NATURAIS (ÁRVORES 🌲 & ROCHAS 🪨) & ANIMAIS SELVAGENS 🦌
// =========================================================================
let wildAnimals = [];
let resourceNodes = [];

function spawnResourceNodes(startX, startY) {
  if (resourceNodes.length < 6 && selfKingdom) {
    const types = [
      { id: 'tree', icon: '🌲', name: 'Árvore de Madeira', badge: '🪓 CORTAR' },
      { id: 'rock', icon: '🪨', name: 'Rocha de Ouro & Minério', badge: '⛏️ MINERAR' }
    ];

    const typeObj = types[Math.floor(Math.random() * types.length)];
    resourceNodes.push({
      id: 'node_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      type: typeObj.id,
      icon: typeObj.icon,
      name: typeObj.name,
      badge: typeObj.badge,
      x: startX + (Math.random() * 700 - 150),
      y: startY + (Math.random() * 550 - 100)
    });
  }
}

function updateAndRenderResourceNodes(startX, startY) {
  if (frameCount % 200 === 0) {
    spawnResourceNodes(startX, startY);
  }

  resourceNodes.forEach(node => {
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(node.icon, node.x, node.y);

    ctx.fillStyle = '#34d399';
    ctx.font = '900 10px Outfit, sans-serif';
    ctx.fillText(node.badge, node.x, node.y - 38);
  });
}

function spawnWildAnimals(startX, startY) {
  if (wildAnimals.length < 5 && selfKingdom) {
    const types = [
      { id: 'deer', icon: '🦌', name: 'Cervo Selvagem' },
      { id: 'boar', icon: '🐗', name: 'Javali das Montanhas' },
      { id: 'wolf', icon: '🐺', name: 'Lobo Feroz' }
    ];

    const typeObj = types[Math.floor(Math.random() * types.length)];
    const animal = {
      id: 'animal_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      type: typeObj.id,
      icon: typeObj.icon,
      name: typeObj.name,
      x: startX + (Math.random() * 600 - 100),
      y: startY + (Math.random() * 500 - 100),
      targetX: startX + (Math.random() * 600 - 100),
      targetY: startY + (Math.random() * 500 - 100),
      speed: 0.5 + Math.random() * 0.4,
      stepOffset: Math.random() * 10
    };
    wildAnimals.push(animal);
  }
}

function updateAndRenderWildAnimals(startX, startY) {
  if (frameCount % 180 === 0) {
    spawnWildAnimals(startX, startY);
  }

  wildAnimals.forEach(a => {
    const dx = a.targetX - a.x;
    const dy = a.targetY - a.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 10) {
      a.targetX = startX + (Math.random() * 600 - 100);
      a.targetY = startY + (Math.random() * 500 - 100);
    } else {
      a.x += (dx / dist) * a.speed;
      a.y += (dy / dist) * a.speed;
    }

    const bounce = Math.abs(Math.sin((frameCount + a.stepOffset) * 0.12)) * 5;

    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(a.icon, a.x, a.y - bounce);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 10px Outfit, sans-serif';
    ctx.fillText('🎯 CAÇAR!', a.x, a.y - bounce - 22);
  });
}

function setupCanvasHuntingClick() {
  canvas.addEventListener('click', (e) => {
    if (!selfKingdom) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left - cameraOffset.x;
    const clickY = e.clientY - rect.top - cameraOffset.y;

    // 1. Clique em Recursos Naturais (Árvores 🌲 / Rochas 🪨)
    for (let i = resourceNodes.length - 1; i >= 0; i--) {
      const node = resourceNodes[i];
      const dist = Math.hypot(clickX - node.x, clickY - node.y);
      if (dist < 40) {
        gatherNode(node, i);
        return;
      }
    }

    // 2. Clique em Animais Selvagens (Cervos 🦌 / Javalis 🐗 / Lobos 🐺)
    for (let i = wildAnimals.length - 1; i >= 0; i--) {
      const a = wildAnimals[i];
      const dist = Math.hypot(clickX - a.x, clickY - a.y);
      if (dist < 38) {
        huntWildAnimal(a, i);
        return;
      }
    }
  });
}

async function gatherNode(node, index) {
  if (!selfKingdom) return;
  playSound('hammer');

  // Envia trabalhador mais próximo correndo até a fonte do recurso
  if (villagers.length > 0) {
    const worker = villagers[index % villagers.length];
    worker.targetX = node.x;
    worker.targetY = node.y;
  }

  floatingEffects.push({
    text: node.type === 'tree' ? '🪓 CORTANDO...' : '⛏️ MINERANDO...',
    x: node.x,
    y: node.y - 20,
    color: '#fbbf24',
    life: 45
  });

  resourceNodes.splice(index, 1);

  try {
    const res = await fetch('/api/kingdom/gather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: selfKingdom.username, nodeType: node.type })
    });
    const data = await res.json();
    if (data.success) {
      selfKingdom = data.user;
      updateHud(selfKingdom);

      floatingEffects.push({
        text: data.rewardText,
        x: node.x,
        y: node.y - 45,
        color: '#34d399',
        life: 75
      });
    }
  } catch (err) {}
}

async function huntWildAnimal(animal, index) {
  if (!selfKingdom) return;
  playSound('hammer');

  if (villagers.length > 0) {
    const hunter = villagers[0];
    hunter.targetX = animal.x;
    hunter.targetY = animal.y;
  }

  floatingEffects.push({
    text: `🏹 CAÇADO!`,
    x: animal.x,
    y: animal.y - 20,
    color: '#fbbf24',
    life: 50
  });

  wildAnimals.splice(index, 1);

  try {
    const res = await fetch('/api/kingdom/hunt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: selfKingdom.username, animalType: animal.type })
    });
    const data = await res.json();
    if (data.success) {
      selfKingdom = data.user;
      updateHud(selfKingdom);

      floatingEffects.push({
        text: data.rewardText,
        x: animal.x,
        y: animal.y - 45,
        color: '#34d399',
        life: 75
      });
    }
  } catch (err) {}
}

function renderLoop() {
  frameCount++;
  const cycle = getDayNightCycle();

  // Fundo do Terreno Imperial
  ctx.fillStyle = cycle.bgGrassColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(cameraOffset.x, cameraOffset.y);

  // Terreno e Grade do Reino
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  const gridSize = 70;
  for (let x = -2000; x < 4000; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, -2000);
    ctx.lineTo(x, 4000);
    ctx.stroke();
  }
  for (let y = -2000; y < 4000; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(-2000, y);
    ctx.lineTo(4000, y);
    ctx.stroke();
  }

  if (selfKingdom) {
    const startX = canvas.width / 2 - 200;
    const startY = canvas.height / 2 - 150;

    // Fumaça das Chaminés dos Edifícios
    updateAndRenderSmoke(selfKingdom.buildings, startX, startY);

    selfKingdom.buildings.forEach(b => {
      const bx = startX + (b.x * 130);
      const by = startY + (b.y * 110);
      const isUnbuilt = b.level === 0;

      // Base do Edifício 3D com Bordas Douradas
      ctx.fillStyle = isUnbuilt ? 'rgba(30, 41, 59, 0.5)' : '#334155';
      ctx.fillRect(bx - 48, by - 48, 96, 96);
      ctx.strokeStyle = isUnbuilt ? 'rgba(148, 163, 184, 0.4)' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - 48, by - 48, 96, 96);

      // Ícone com Animação Flutuante
      const pulse = isUnbuilt ? 0 : Math.sin(frameCount * 0.05 + b.x) * 3;
      ctx.font = '48px sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = isUnbuilt ? 0.4 : 1.0;
      ctx.fillText(b.icon, bx, by + 12 + pulse);
      ctx.globalAlpha = 1.0;

      // Bandeira no Centro da Vila
      if (b.id === 'townhall' && !isUnbuilt) {
        drawWavingFlag(bx, by);
      }

      // Tocha acesa no edifício se for noite
      if (cycle.isNight && !isUnbuilt) {
        drawBuildingTorch(bx, by);
      }

      // Nome do Edifício e Nível
      ctx.fillStyle = isUnbuilt ? '#94a3b8' : '#ffffff';
      ctx.font = 'bold 12px Outfit, sans-serif';
      const lvlText = isUnbuilt ? '(🔒 Não Construído)' : `(Lvl ${b.level})`;
      ctx.fillText(`${b.name} ${lvlText}`, bx, by + 62);

      // BARRA DE TEMPO DE OBRAS EM ANDAMENTO
      const now = Date.now();
      if (b.isUpgrading && b.finishTime && now < b.finishTime) {
        const remainingSec = Math.ceil((b.finishTime - now) / 1000);
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(bx - 45, by - 42, 90, 16);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px Outfit, sans-serif';
        ctx.fillText(`⏳ Obras: ${remainingSec}s`, bx, by - 30);
      }
    });

    // Aldeões Caminhando pela Vila
    updateAndRenderVillagers(startX, startY);

    // Fontes de Recursos Naturais (Árvores 🌲, Rochas de Ouro 🪨)
    updateAndRenderResourceNodes(startX, startY);

    // Animais Selvagens Caminhando pelo Mapa (Cervos 🦌, Javalis 🐗, Lobos 🐺)
    updateAndRenderWildAnimals(startX, startY);

    // Efeitos Flutuantes (+10 Ouro)
    for (let i = floatingEffects.length - 1; i >= 0; i--) {
      const ef = floatingEffects[i];
      ef.y -= 0.6;
      ef.life -= 1;

      ctx.fillStyle = ef.color;
      ctx.font = 'bold 16px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ef.text, ef.x, ef.y);

      if (ef.life <= 0) floatingEffects.splice(i, 1);
    }
  }

  // Camada de Sombra / Iluminação Dinâmica do Ciclo Dia/Noite
  if (cycle.shadowColor !== 'rgba(0, 0, 0, 0)') {
    ctx.fillStyle = cycle.shadowColor;
    ctx.fillRect(-2000, -2000, 6000, 6000);
  }

  ctx.restore();

  // Relógio do Ciclo no Canto Superior
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.fillRect(canvas.width - 150, 15, 135, 30);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.strokeRect(canvas.width - 150, 15, 135, 30);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cycle.phaseName, canvas.width - 82, 35);

  requestAnimationFrame(renderLoop);
}

// --- SISTEMA DE CLÃS & ALIANÇAS (GUILDAS) ---
function toggleClanModal() {
  if (!selfKingdom) return;
  const modal = document.getElementById('clan-modal');
  const isOpening = modal.classList.contains('hidden');
  modal.classList.toggle('hidden');

  if (isOpening) {
    switchClanTab('my-clan');
  }
}

function switchClanTab(tab) {
  document.getElementById('tab-my-clan').classList.toggle('active', tab === 'my-clan');
  document.getElementById('tab-search-clan').classList.toggle('active', tab === 'search-clan');
  document.getElementById('tab-create-clan').classList.toggle('active', tab === 'create-clan');

  document.getElementById('clan-view-my').classList.toggle('hidden', tab !== 'my-clan');
  document.getElementById('clan-view-search').classList.toggle('hidden', tab !== 'search-clan');
  document.getElementById('clan-view-create').classList.toggle('hidden', tab !== 'create-clan');

  if (tab === 'my-clan') loadMyClanView();
  if (tab === 'search-clan') loadSearchClansView();
}

async function loadMyClanView() {
  if (!selfKingdom) return;
  const detailsDiv = document.getElementById('my-clan-details');
  detailsDiv.innerHTML = '<p style="color:var(--text-muted);">Carregando informações da Aliança...</p>';

  try {
    const res = await fetch(`/api/clan/my-clan?username=${selfKingdom.username}`);
    const data = await res.json();

    if (!data.hasClan) {
      detailsDiv.innerHTML = `
        <div style="text-align:center; padding: 24px;">
          <div style="font-size:48px; margin-bottom:12px;">🛡️</div>
          <h3 style="color:#fbbf24; margin-bottom:8px;">Você não pertence a nenhum Clã!</h3>
          <p style="color:var(--text-muted); font-size:14px; margin-bottom:16px;">
            Junte-se a uma aliança de jogadores para compartilhar troféus, conversar no chat privado e dominar o mapa!
          </p>
          <div style="font-size:12px; color:#f59e0b; margin-bottom:16px;">
            🔒 Requer Centro da Vila Nível 3 para participar de Clãs.
          </div>
          <button class="btn btn-gold btn-glow" style="width:auto; padding:12px 24px;" onclick="switchClanTab('search-clan')">PROCURAR CLÃS EXISTENTES 🔍</button>
        </div>
      `;
      return;
    }

    const c = data.clan;
    let membersHtml = '';
    c.membersDetails.forEach(m => {
      membersHtml += `
        <div class="enemy-card" style="margin-bottom:8px; padding:10px 14px;">
          <div>
            <b>${m.isLeader ? '👑 LÍDER: ' : '⚔️ '} ${m.kingdomName}</b>
            <span style="font-size:12px; color:var(--text-muted);">(${m.username})</span>
          </div>
          <div>🏆 ${m.trophies} Troféus</div>
        </div>
      `;
    });

    detailsDiv.innerHTML = `
      <div class="glass-panel" style="padding:16px; margin-bottom:16px; border-color:var(--gold-color);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h2 style="color:#fbbf24; font-family:'Cinzel', serif;">[${c.tag}] ${c.name}</h2>
            <p style="color:var(--text-muted); font-size:13px; margin-top:4px;">${c.description || 'Aliança de Impérios Poderosos'}</p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:18px; font-weight:bold; color:#fbbf24;">🏆 ${c.totalTrophies}</div>
            <div style="font-size:12px; color:var(--text-muted);">${c.members.length} Membro(s)</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" style="margin-top:12px; width:auto;" onclick="leaveClan()">SAIR DO CLÃ 🚪</button>
      </div>

      <h3>Membros da Aliança:</h3>
      <div style="margin-top:10px;">${membersHtml}</div>
    `;
  } catch (err) {
    detailsDiv.innerHTML = '<p class="error-msg">Erro ao carregar Clã.</p>';
  }
}

async function loadSearchClansView() {
  const listDiv = document.getElementById('clans-list');
  listDiv.innerHTML = '<p style="color:var(--text-muted);">Buscando clãs...</p>';

  try {
    const res = await fetch('/api/clan/list');
    const clans = await res.json();
    listDiv.innerHTML = '';

    if (clans.length === 0) {
      listDiv.innerHTML = '<p style="color:var(--text-muted);">Nenhum Clã foi fundado ainda. Seja o primeiro a fundar uma Aliança!</p>';
      return;
    }

    clans.forEach(c => {
      const card = document.createElement('div');
      card.className = 'enemy-card';
      card.innerHTML = `
        <div>
          <div style="font-weight:bold; font-size:16px; color:#fbbf24;">
            🛡️ [${c.tag}] ${c.name}
          </div>
          <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">
            Líder: <b>${c.leader}</b> | 🏆 ${c.totalTrophies} Troféus Totais
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
            ${c.description || ''}
          </div>
        </div>
        <button class="btn btn-gold btn-sm" onclick="joinClan('${c.id}')">ENTRAR NO CLÃ ⚔️</button>
      `;
      listDiv.appendChild(card);
    });
  } catch (err) {
    listDiv.innerHTML = '<p class="error-msg">Erro ao buscar clãs.</p>';
  }
}

async function handleCreateClanSubmit(e) {
  e.preventDefault();
  if (!selfKingdom) return;
  document.getElementById('create-clan-error').innerText = '';

  const name = document.getElementById('create-clan-name').value;
  const tag = document.getElementById('create-clan-tag').value;
  const description = document.getElementById('create-clan-desc').value;

  try {
    const res = await fetch('/api/clan/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: selfKingdom.username, name, tag, description })
    });
    const data = await res.json();
    if (data.success) {
      playSound('gold');
      selfKingdom = data.user;
      updateHud(selfKingdom);
      alert('🎉 Clã fundado com sucesso! Seja bem-vindo, Líder!');
      switchClanTab('my-clan');
    } else {
      document.getElementById('create-clan-error').innerText = data.message;
    }
  } catch (err) {
    document.getElementById('create-clan-error').innerText = 'Erro ao criar clã.';
  }
}

async function joinClan(clanId) {
  if (!selfKingdom) return;
  try {
    const res = await fetch('/api/clan/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: selfKingdom.username, clanId })
    });
    const data = await res.json();
    if (data.success) {
      playSound('gold');
      selfKingdom = data.user;
      updateHud(selfKingdom);
      alert('⚔️ Você entrou para a Aliança!');
      switchClanTab('my-clan');
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Erro ao entrar no clã.');
  }
}

async function leaveClan() {
  if (!selfKingdom) return;
  if (confirm('Deseja realmente sair da sua Aliança?')) {
    try {
      const res = await fetch('/api/clan/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selfKingdom.username })
      });
      const data = await res.json();
      if (data.success) {
        selfKingdom = data.user;
        updateHud(selfKingdom);
        alert('Você saiu do Clã.');
        switchClanTab('my-clan');
      } else {
        alert(data.message);
      }
    } catch (err) {}
  }
}

// --- MISSÕES DIÁRIAS & PASSE DE BATALHA ---
function toggleQuestsModal() {
  if (!selfKingdom) return;
  const modal = document.getElementById('quests-modal');
  const isOpening = modal.classList.contains('hidden');
  modal.classList.toggle('hidden');

  if (isOpening) {
    renderQuestsAndBattlePass();
  }
}

function renderQuestsAndBattlePass() {
  if (!selfKingdom) return;

  // Passe Imperial
  const pass = selfKingdom.battlePass || { level: 1, xp: 0, maxXp: 100, claimedLevels: [] };
  document.getElementById('pass-level').innerText = pass.level;
  document.getElementById('pass-xp').innerText = pass.xp;
  document.getElementById('pass-max-xp').innerText = pass.maxXp;

  const pct = Math.min(100, Math.floor((pass.xp / pass.maxXp) * 100));
  document.getElementById('pass-xp-fill').style.width = `${pct}%`;

  const rewardsRow = document.getElementById('pass-rewards-row');
  rewardsRow.innerHTML = '';

  const LEVELS = [
    { lvl: 1, reward: '💎 25 Gemas' },
    { lvl: 2, reward: '🪙 1.000 Ouro' },
    { lvl: 3, reward: '💎 50 Gemas' },
    { lvl: 4, reward: '🛡️ Escudo 12h' },
    { lvl: 5, reward: '👑 VIP 3 Dias + 100 Gemas' }
  ];

  LEVELS.forEach(l => {
    const isUnlocked = pass.level >= l.lvl;
    const isClaimed = (pass.claimedLevels || []).includes(l.lvl);

    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.cssText = 'min-width:120px; padding:8px; text-align:center; flex-shrink:0; font-size:12px;';
    card.innerHTML = `
      <div style="font-weight:bold; color:#fbbf24;">Nível ${l.lvl}</div>
      <div style="margin:4px 0; color:var(--text-muted); font-size:11px;">${l.reward}</div>
      ${isClaimed ? `<span style="color:#34d399; font-weight:bold;">RESGATADO ✓</span>` :
        isUnlocked ? `<button class="btn btn-gold btn-sm" onclick="claimBattlePassReward(${l.lvl})">RESGATAR 🎁</button>` :
        `<span style="color:#94a3b8;">🔒 BLOQUEADO</span>`}
    `;
    rewardsRow.appendChild(card);
  });

  // Lista de Missões
  const quests = selfKingdom.quests || [];
  const list = document.getElementById('quests-list');
  list.innerHTML = '';

  quests.forEach(q => {
    const card = document.createElement('div');
    card.className = 'enemy-card';
    card.style.cssText = 'margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;';

    let rewardText = '';
    if (q.rewardGold) rewardText += ` 🪙 +${q.rewardGold}`;
    if (q.rewardWood) rewardText += ` 🪓 +${q.rewardWood}`;
    if (q.rewardGems) rewardText += ` 💎 +${q.rewardGems}`;
    if (q.rewardXp) rewardText += ` ⚡ +${q.rewardXp} XP`;

    let buttonHtml = '';
    if (q.isClaimed) {
      buttonHtml = `<button class="btn btn-secondary btn-sm" disabled>CONCLUÍDO ✓</button>`;
    } else if (q.isCompleted) {
      buttonHtml = `<button class="btn btn-gold btn-sm btn-glow" onclick="claimQuestReward('${q.id}')">RESGATAR RECOMPENSA 🎁</button>`;
    } else {
      buttonHtml = `<button class="btn btn-secondary btn-sm" disabled>EM ANDAMENTO ⏳</button>`;
    }

    card.innerHTML = `
      <div>
        <div style="font-weight:bold; font-size:15px; color:#fbbf24;">${q.title}</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${q.desc}</div>
        <div style="font-size:12px; color:#34d399; margin-top:4px;">Recompensa:${rewardText}</div>
      </div>
      <div>${buttonHtml}</div>
    `;
    list.appendChild(card);
  });
}

async function claimQuestReward(questId) {
  if (!selfKingdom) return;
  try {
    const res = await fetch('/api/quests/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: selfKingdom.username, questId })
    });
    const data = await res.json();
    if (data.success) {
      playSound('gold');
      selfKingdom = data.user;
      updateHud(selfKingdom);
      renderQuestsAndBattlePass();
    } else {
      alert(data.message);
    }
  } catch (err) {}
}

async function claimBattlePassReward(level) {
  if (!selfKingdom) return;
  try {
    const res = await fetch('/api/battlepass/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: selfKingdom.username, level })
    });
    const data = await res.json();
    if (data.success) {
      playSound('gold');
      selfKingdom = data.user;
      updateHud(selfKingdom);
      renderQuestsAndBattlePass();
      alert('🎉 Recompensa do Passe Imperial resgatada com sucesso!');
    } else {
      alert(data.message);
    }
  } catch (err) {}
}
