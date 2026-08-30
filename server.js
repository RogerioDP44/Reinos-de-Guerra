const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const pixService = require('./pix');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- SEGURANÇA E PROTEÇÃO ANTI-HACK ---
// 1. Cabeçalhos HTTP de Segurança
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// 2. Rate Limiter Anti-Força-Bruta (Login/Registro)
const rateLimitStore = {};
function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
  const MAX_ATTEMPTS = 15;

  if (!rateLimitStore[ip] || now > rateLimitStore[ip].resetTime) {
    rateLimitStore[ip] = { count: 1, resetTime: now + WINDOW_MS };
    return next();
  }

  rateLimitStore[ip].count += 1;

  if (rateLimitStore[ip].count > MAX_ATTEMPTS) {
    const minutesLeft = Math.ceil((rateLimitStore[ip].resetTime - now) / 60000);
    return res.status(429).json({
      success: false,
      message: `🛑 Muitas tentativas de acesso! Bloqueado por segurança por mais ${minutesLeft} minuto(s).`
    });
  }

  next();
}

// 3. Sanitização Anti-XSS (Injeção de Scripts)
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const activeSockets = {}; // socketId -> username
const activePlayers = {}; // username -> { x, y, direction, isMoving, kingdomName, isVip }

// --- ROTAS DA API HTTP (PROTEGIDAS) ---

app.post('/api/register', rateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUsername = escapeHtml(username);
    const user = await db.registerUser(cleanUsername, password);
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/login', rateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUsername = escapeHtml(username);
    const user = await db.loginUser(cleanUsername, password);
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/kingdom/my-kingdom', (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ message: 'Username é obrigatório' });
  const kingdom = db.getUser(username);
  if (!kingdom) return res.status(404).json({ message: 'Reino não encontrado' });
  res.json(sanitizeUser(kingdom));
});

app.post('/api/kingdom/start-upgrade', (req, res) => {
  try {
    const { username, buildingId } = req.body;
    const updatedUser = db.startBuildingUpgrade(username, buildingId);
    res.json({ success: true, user: sanitizeUser(updatedUser) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/kingdom/finish-gems-building', (req, res) => {
  try {
    const { username, buildingId } = req.body;
    const updatedUser = db.finishBuildingWithGems(username, buildingId);
    res.json({ success: true, user: sanitizeUser(updatedUser) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/kingdom/buy-shield', (req, res) => {
  try {
    const { username, hours } = req.body;
    const updatedUser = db.buyShieldWithGems(username, hours || 12);
    res.json({ success: true, user: sanitizeUser(updatedUser) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/kingdom/train-troop', (req, res) => {
  try {
    const { username, troopType, count } = req.body;
    const updatedUser = db.trainTroop(username, troopType, count || 1);
    res.json({ success: true, user: sanitizeUser(updatedUser) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/kingdom/list-enemies', (req, res) => {
  const username = req.query.username || '';
  res.json(db.getKingdomList(username));
});

// --- ROTA DE CAÇA DE ANIMAIS SELVAGENS ---
app.post('/api/kingdom/hunt', (req, res) => {
  try {
    const { username, animalType } = req.body;
    const result = db.huntAnimal(username, animalType);
    res.json({ success: true, rewardText: result.rewardText, rewards: result.rewards, user: sanitizeUser(result.user) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/kingdom/sync-hero', (req, res) => {
  try {
    const { username, hp, maxHp, level, xp, maxXp, damage } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Usuário não informado.' });
    
    const user = db.getUser(username);
    if (!user) return res.status(404).json({ success: false, message: 'Reino não encontrado.' });
    
    if (hp !== undefined) user.hp = hp;
    if (maxHp !== undefined) user.maxHp = maxHp;
    if (level !== undefined) user.level = level;
    if (xp !== undefined) user.xp = xp;
    if (maxXp !== undefined) user.maxXp = maxXp;
    if (damage !== undefined) user.damage = damage;
    
    db.save();
    return res.json({ success: true, kingdom: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/kingdom/buy-skin', (req, res) => {
  try {
    const { username, skinIcon, cost } = req.body;
    const user = db.getUser(username);
    if (!user) return res.status(404).json({ success: false, message: 'Reino não encontrado.' });
    if (!user.unlockedSkins) user.unlockedSkins = ['👷'];

    if (user.unlockedSkins.includes(skinIcon)) {
      return res.status(400).json({ success: false, message: 'Você já possui esta Skin!' });
    }
    if (user.gems < cost) {
      return res.status(400).json({ success: false, message: 'Gemas insuficientes para comprar a Skin!' });
    }
    user.gems -= cost;
    user.unlockedSkins.push(skinIcon);
    user.currentSkin = skinIcon; // Auto-equipa
    db.save();
    return res.json({ success: true, kingdom: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/kingdom/equip-skin', (req, res) => {
  try {
    const { username, skinIcon } = req.body;
    const user = db.getUser(username);
    if (!user) return res.status(404).json({ success: false, message: 'Reino não encontrado.' });
    if (!user.unlockedSkins) user.unlockedSkins = ['👷'];

    if (!user.unlockedSkins.includes(skinIcon)) {
      return res.status(400).json({ success: false, message: 'Você não possui esta Skin!' });
    }
    user.currentSkin = skinIcon;
    db.save();
    return res.json({ success: true, kingdom: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/kingdom/gather', (req, res) => {
  try {
    const { username, nodeType } = req.body;
    const result = db.gatherResourceNode(username, nodeType);
    res.json({ success: true, rewardText: result.rewardText, user: sanitizeUser(result.user) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- ROTAS DE CLÃS & ALIANÇAS (GUILDAS) ---
app.post('/api/clan/create', (req, res) => {
  try {
    const { username, name, tag, description } = req.body;
    const cleanName = escapeHtml(name);
    const cleanTag = escapeHtml(tag);
    const cleanDesc = escapeHtml(description);
    const clan = db.createClan(username, cleanName, cleanTag, cleanDesc);
    const updatedUser = db.getUser(username);
    res.json({ success: true, clan, user: sanitizeUser(updatedUser) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/clan/join', (req, res) => {
  try {
    const { username, clanId } = req.body;
    const clan = db.joinClan(username, clanId);
    const updatedUser = db.getUser(username);
    res.json({ success: true, clan, user: sanitizeUser(updatedUser) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/clan/leave', (req, res) => {
  try {
    const { username } = req.body;
    db.leaveClan(username);
    const updatedUser = db.getUser(username);
    res.json({ success: true, user: sanitizeUser(updatedUser) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/clan/my-clan', (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ message: 'Username é obrigatório' });
  const user = db.getUser(username);
  if (!user || !user.clan) return res.json({ success: false, hasClan: false });
  const clan = db.getClanInfo(user.clan);
  res.json({ success: true, hasClan: true, clan });
});

app.get('/api/clan/list', (req, res) => {
  res.json(db.getClanList());
});

app.post('/api/kingdom/attack-enemy', (req, res) => {
  try {
    const { attackerName, defenderName } = req.body;
    const battleResult = db.executeRaid(attackerName, defenderName);

    if (battleResult.isVictory) {
      io.emit('chat_message', {
        sender: 'SISTEMA DE GUERRA ⚔️',
        text: `🔥 O Império de ${attackerName} DESTRUIU as defesas de ${defenderName} e saqueou 🪙 ${battleResult.lootedGold} Ouro e 🪓 ${battleResult.lootedWood} Madeira!`,
        type: 'system'
      });
    } else {
      io.emit('chat_message', {
        sender: 'SISTEMA DE GUERRA 🛡️',
        text: `🛡️ O Império de ${defenderName} REPELIU com sucesso as tropas de ${attackerName}!`,
        type: 'system'
      });
    }

    const updatedAttacker = db.getUser(attackerName);
    res.json({ success: true, battle: battleResult, user: sanitizeUser(updatedAttacker) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/ranking', (req, res) => {
  res.json(db.getTopRanking(10));
});

app.get('/api/pix/packages', (req, res) => {
  res.json(pixService.getPackages());
});

app.post('/api/pix/create', async (req, res) => {
  try {
    const { username, packageId } = req.body;
    const pixData = await pixService.createPixOrder(username, packageId);
    res.json({ success: true, pix: pixData });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/pix/simulate-approval', (req, res) => {
  try {
    const { paymentId } = req.body;
    const result = pixService.confirmPayment(paymentId);

    const socketId = Object.keys(activeSockets).find(sId => activeSockets[sId] === result.username);
    if (socketId && io.sockets.sockets.get(socketId)) {
      const user = db.getUser(result.username);
      io.sockets.sockets.get(socketId).emit('account_updated', {
        gems: user.gems,
        isVip: user.isVip,
        message: `🎉 PIX Aprovado! +${result.gems} Gemas e VIP adicionados ao seu Império!`
      });
    }

    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- ROTAS DE MISSÕES DIÁRIAS & PASSE DE BATALHA ---
app.post('/api/quests/claim', (req, res) => {
  try {
    const { username, questId } = req.body;
    const updatedUser = db.claimQuest(username, questId);
    res.json({ success: true, user: sanitizeUser(updatedUser) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/battlepass/claim', (req, res) => {
  try {
    const { username, level } = req.body;
    const updatedUser = db.claimBattlePassLevel(username, level);
    res.json({ success: true, user: sanitizeUser(updatedUser) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- WEBHOOK OFICIAL MERCADO PAGO / PIX REAL AUTOMÁTICO ---
app.post('/api/pix/webhook', (req, res) => {
  try {
    const { action, data, type } = req.body;
    if ((type === 'payment' || action === 'payment.created' || action === 'payment.updated') && data && data.id) {
      const paymentId = data.id.toString();
      const result = pixService.confirmPayment(paymentId);

      if (result && result.username) {
        const socketId = Object.keys(activeSockets).find(sId => activeSockets[sId] === result.username);
        if (socketId && io.sockets.sockets.get(socketId)) {
          const user = db.getUser(result.username);
          io.sockets.sockets.get(socketId).emit('account_updated', {
            gems: user.gems,
            isVip: user.isVip,
            message: `🎉 PIX Real Aprovado! +${result.gems} Gemas adicionadas!`
          });
        }
      }
    }
    res.status(200).send('OK');
  } catch (err) {
    res.status(200).send('OK');
  }
});

function sanitizeUser(user) {
  const copy = { ...user };
  delete copy.passwordHash;
  return copy;
}

// --- CONEXÃO WEBSOCKET (SOCKET.IO MULTIPLAYER) ---
io.on('connection', (socket) => {
  socket.on('join_game', ({ username }) => {
    const user = db.getUser(username);
    if (!user) return socket.emit('error_msg', 'Reino não encontrado.');

    activeSockets[socket.id] = user.username;
    activePlayers[user.username] = {
      x: 0, 
      y: 0, 
      direction: 'down', 
      isMoving: false,
      kingdomName: user.kingdomName,
      isVip: user.isVip
    };

    socket.emit('init_kingdom', sanitizeUser(user));

    io.emit('chat_message', {
      sender: 'SISTEMA DE GUERRA',
      text: `🏰 O Imperador de ${user.kingdomName} entrou no império!`,
      type: 'system'
    });

    // Envia estado inicial de todos os jogadores para quem acabou de entrar
    io.emit('players_update', activePlayers);
  });

  socket.on('player_move', (data) => {
    const username = activeSockets[socket.id];
    if (username && activePlayers[username]) {
      activePlayers[username].x = data.x;
      activePlayers[username].y = data.y;
      activePlayers[username].direction = data.direction;
      activePlayers[username].isMoving = data.isMoving;
      
      // Transmite a nova posição para todos
      io.emit('players_update', activePlayers);
    }
  });

  socket.on('send_chat', (text) => {
    const username = activeSockets[socket.id];
    if (!username) return;
    const cleanText = escapeHtml(text.trim().substring(0, 120));
    if (!cleanText) return;

    const user = db.getUser(username);

    io.emit('chat_message', {
      sender: user ? escapeHtml(user.kingdomName) : escapeHtml(username),
      text: cleanText,
      isVip: user ? user.isVip : false,
      role: user ? user.role : 'player'
    });
  });

  socket.on('disconnect', () => {
    const username = activeSockets[socket.id];
    if (username) {
      delete activePlayers[username];
      io.emit('players_update', activePlayers); // Atualiza os outros clientes
    }
    delete activeSockets[socket.id];
  });
});

// LOOP PASSIVO DE RECURSOS E TIMER DE OBRAS (1 TICK POR SEGUNDO)
setInterval(() => {
  Object.keys(activeSockets).forEach(socketId => {
    const username = activeSockets[socketId];
    if (username) {
      const user = db.getUser(username);
      if (user && io.sockets.sockets.get(socketId)) {
        io.sockets.sockets.get(socketId).emit('resource_tick', {
          gold: Math.floor(user.gold),
          maxGold: user.maxGold,
          wood: Math.floor(user.wood),
          maxWood: user.maxWood,
          gems: user.gems,
          trophies: user.trophies,
          buildings: user.buildings,
          shieldUntil: user.shieldUntil
        });
      }
    }
  });
}, 1000);

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` 🏰 REINOS DE GUERRA MULTIPLAYER ON PORT ${PORT} 🏰`);
  console.log(` 🌐 Acesse: http://localhost:${PORT}`);
  console.log(`===================================================`);
});
