const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'data_store.json');

const initialData = {
  users: {},
  clans: {},
  payments: {}
};

class Database {
  constructor() {
    this.data = initialData;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
      } else {
        this.save();
      }
    } catch (err) {
      console.error('[DB] Erro ao carregar banco:', err.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[DB] Erro ao salvar banco:', err.message);
    }
  }

  async registerUser(username, password) {
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || cleanUser.length < 3) throw new Error('Nome do Imperador deve ter pelo menos 3 caracteres.');
    if (this.data.users[cleanUser]) throw new Error('Este Reino já existe.');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const isFirstUser = Object.keys(this.data.users).length === 0;

    const newUser = {
      username: cleanUser,
      kingdomName: `Império de ${cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1)}`,
      passwordHash,
      gold: 500,
      maxGold: 5000,
      wood: 500,
      maxWood: 5000,
      gems: 50,
      trophies: 100,
      isVip: false,
      shieldUntil: null, // Escudo de Paz contra saques
      clan: null,
      role: isFirstUser ? 'admin' : 'player',
      buildings: [
        { id: 'townhall', name: 'Centro da Vila', level: 1, icon: '🏰', x: 2, y: 2, isUpgrading: false, finishTime: null, reqLevel: 1 },
        { id: 'goldmine', name: 'Mina de Ouro', level: 1, icon: '⛏️', x: 1, y: 1, isUpgrading: false, finishTime: null, reqLevel: 1 },
        { id: 'sawmill', name: 'Serraria', level: 1, icon: '🪓', x: 3, y: 1, isUpgrading: false, finishTime: null, reqLevel: 1 },
        { id: 'barracks', name: 'Quartel de Tropas', level: 1, icon: '⚔️', x: 1, y: 3, isUpgrading: false, finishTime: null, reqLevel: 2 },
        { id: 'tower', name: 'Torre de Defesa', level: 1, icon: '🏹', x: 3, y: 3, isUpgrading: false, finishTime: null, reqLevel: 2 },
        { id: 'wall', name: 'Muralhas de Pedra', level: 0, icon: '🧱', x: 2, y: 4, isUpgrading: false, finishTime: null, reqLevel: 2 },
        { id: 'alchemy', name: 'Academia de Alquimia', level: 0, icon: '🧪', x: 0, y: 2, isUpgrading: false, finishTime: null, reqLevel: 3 },
        { id: 'gemmine', name: 'Mina de Gemas', level: 0, icon: '💎', x: 4, y: 2, isUpgrading: false, finishTime: null, reqLevel: 4 }
      ],
      army: {
        warrior: 10,
        archer: 5,
        wizard: 0,
        dragon: 0
      },
      spells: {
        meteor: 0,
        heal: 0
      },
      battleLogs: [],
      lastResourceUpdate: Date.now(),
      createdAt: new Date().toISOString()
    };

    this.data.users[cleanUser] = newUser;
    this.save();
    return newUser;
  }

  async loginUser(username, password) {
    const cleanUser = username.trim().toLowerCase();
    const user = this.data.users[cleanUser];
    if (!user) throw new Error('Reino não encontrado.');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Senha incorreta.');

    this.calculatePassiveResources(cleanUser);
    return user;
  }

  calculatePassiveResources(username) {
    const cleanUser = username.toLowerCase();
    const user = this.data.users[cleanUser];
    if (!user) return;

    if (!user.kingdomName) user.kingdomName = `Império de ${cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1)}`;
    if (user.gold === undefined || user.gold === null) user.gold = 500;
    if (user.wood === undefined || user.wood === null) user.wood = 500;
    if (!user.maxGold) user.maxGold = 5000;
    if (!user.maxWood) user.maxWood = 5000;
    if (!user.gems) user.gems = 50;
    if (!user.trophies) user.trophies = 100;
    if (!user.spells) user.spells = { meteor: 0, heal: 0 };
    
    // Garantir presença de todos os edifícios novos no usuário existente
    const defaultBuildings = [
      { id: 'townhall', name: 'Centro da Vila', level: 1, icon: '🏰', x: 2, y: 2, isUpgrading: false, finishTime: null, reqLevel: 1 },
      { id: 'goldmine', name: 'Mina de Ouro', level: 1, icon: '⛏️', x: 1, y: 1, isUpgrading: false, finishTime: null, reqLevel: 1 },
      { id: 'sawmill', name: 'Serraria', level: 1, icon: '🪓', x: 3, y: 1, isUpgrading: false, finishTime: null, reqLevel: 1 },
      { id: 'barracks', name: 'Quartel de Tropas', level: 1, icon: '⚔️', x: 1, y: 3, isUpgrading: false, finishTime: null, reqLevel: 2 },
      { id: 'tower', name: 'Torre de Defesa', level: 1, icon: '🏹', x: 3, y: 3, isUpgrading: false, finishTime: null, reqLevel: 2 },
      { id: 'wall', name: 'Muralhas de Pedra', level: 0, icon: '🧱', x: 2, y: 4, isUpgrading: false, finishTime: null, reqLevel: 2 },
      { id: 'alchemy', name: 'Academia de Alquimia', level: 0, icon: '🧪', x: 0, y: 2, isUpgrading: false, finishTime: null, reqLevel: 3 },
      { id: 'gemmine', name: 'Mina de Gemas', level: 0, icon: '💎', x: 4, y: 2, isUpgrading: false, finishTime: null, reqLevel: 4 }
    ];

    if (!user.buildings) {
      user.buildings = defaultBuildings;
    } else {
      defaultBuildings.forEach(def => {
        if (!user.buildings.some(b => b.id === def.id)) {
          user.buildings.push({ ...def });
        }
      });
    }

    if (!user.army) user.army = { warrior: 10, archer: 5, wizard: 0, dragon: 0 };
    if (!user.battleLogs) user.battleLogs = [];

    const now = Date.now();
    const elapsedSeconds = Math.min(86400, Math.floor((now - (user.lastResourceUpdate || now)) / 1000));

    if (elapsedSeconds > 0) {
      const goldMine = user.buildings.find(b => b.id === 'goldmine');
      const sawmill = user.buildings.find(b => b.id === 'sawmill');
      const gemMine = user.buildings.find(b => b.id === 'gemmine');

      const goldRate = (goldMine ? goldMine.level : 1) * 4;
      const woodRate = (sawmill ? sawmill.level : 1) * 4;

      user.gold = Math.min(user.maxGold, user.gold + goldRate * elapsedSeconds);
      user.wood = Math.min(user.maxWood, user.wood + woodRate * elapsedSeconds);
      
      // Produção passiva de Gemas da Mina de Gemas (1 gema a cada 12h por nível)
      if (gemMine && gemMine.level > 0) {
        const gemsEarned = Math.floor((elapsedSeconds / 43200) * gemMine.level);
        if (gemsEarned > 0) user.gems += gemsEarned;
      }

      user.lastResourceUpdate = now;

      // Verificar Conclusão de Obras (Timers de Construção)
      user.buildings.forEach(b => {
        if (b.isUpgrading && b.finishTime && now >= b.finishTime) {
          b.isUpgrading = false;
          b.finishTime = null;
          b.level += 1;
          if (b.id === 'townhall') {
            user.maxGold += 5000;
            user.maxWood += 5000;
          }
        }
      });

      this.save();
    }
  }

  getUser(username) {
    this.calculatePassiveResources(username);
    return this.data.users[username.toLowerCase()] || null;
  }

  startBuildingUpgrade(username, buildingId) {
    const cleanUser = username.toLowerCase();
    const user = this.data.users[cleanUser];
    if (!user) throw new Error('Usuário não encontrado.');

    const b = user.buildings.find(item => item.id === buildingId);
    if (!b) throw new Error('Construção não encontrada.');
    if (b.isUpgrading) throw new Error('Este edifício já está sendo melhorado!');

    const townhall = user.buildings.find(item => item.id === 'townhall');
    const townhallLevel = townhall ? townhall.level : 1;

    // Regras de Nível Mínimo do Centro da Vila para Desbloqueio
    const REQ_TOWNHALL_LEVEL = {
      townhall: 1,
      goldmine: 1,
      sawmill: 1,
      barracks: 2,
      tower: 2,
      wall: 2,
      alchemy: 3,
      gemmine: 4
    };

    const minTownhallReq = REQ_TOWNHALL_LEVEL[b.id] || 1;
    if (townhallLevel < minTownhallReq) {
      throw new Error(`🔒 Requer Centro da Vila Nível ${minTownhallReq} para desbloquear a construção de ${b.name}!`);
    }

    // Nível dos edifícios não pode superar o nível do Centro da Vila
    if (b.id !== 'townhall' && b.level >= townhallLevel) {
      throw new Error(`👑 Você precisa evoluir o Centro da Vila para o Nível ${b.level + 1} para liberar novas melhorias para ${b.name}!`);
    }

    const baseCost = b.level === 0 ? 300 : b.level * 250;
    const costGold = baseCost;
    const costWood = baseCost;

    if (user.gold < costGold || user.wood < costWood) {
      throw new Error(`Recursos insuficientes! Requer 🪙 ${costGold} Ouro e 🪓 ${costWood} Madeira.`);
    }

    user.gold -= costGold;
    user.wood -= costWood;

    // Tempo de construção baseado no nível (ex: Nível 1 = 20 seg)
    const durationMs = b.level * 20000;
    b.isUpgrading = true;
    b.finishTime = Date.now() + durationMs;

    this.save();
    return user;
  }

  finishBuildingWithGems(username, buildingId) {
    const cleanUser = username.toLowerCase();
    const user = this.data.users[cleanUser];
    if (!user) throw new Error('Usuário não encontrado.');

    const b = user.buildings.find(item => item.id === buildingId);
    if (!b || !b.isUpgrading) throw new Error('Nenhuma obra pendente para este edifício.');

    const gemCost = Math.max(10, b.level * 15);
    if (user.gems < gemCost) throw new Error(`Requer ${gemCost} Gemas para concluir instantaneamente!`);

    user.gems -= gemCost;
    b.isUpgrading = false;
    b.finishTime = null;
    b.level += 1;

    if (b.id === 'townhall') {
      user.maxGold += 5000;
      user.maxWood += 5000;
    }

    this.save();
    return user;
  }

  buyShieldWithGems(username, hours = 12) {
    const cleanUser = username.toLowerCase();
    const user = this.data.users[cleanUser];
    if (!user) throw new Error('Usuário não encontrado.');

    const gemCost = hours === 12 ? 30 : 50;
    if (user.gems < gemCost) throw new Error(`Requer ${gemCost} Gemas para ativar o Escudo de Paz!`);

    user.gems -= gemCost;
    const shieldUntil = new Date(Date.now() + hours * 3600 * 1000);
    user.shieldUntil = shieldUntil.toISOString();

    this.save();
    return user;
  }

  trainTroop(username, troopType, count = 1) {
    const cleanUser = username.toLowerCase();
    const user = this.data.users[cleanUser];
    if (!user) throw new Error('Usuário não encontrado.');

    const COSTS = {
      warrior: { gold: 20, wood: 10 },
      archer: { gold: 35, wood: 25 },
      wizard: { gold: 90, wood: 60 },
      dragon: { gold: 350, wood: 250 }
    };

    const cost = COSTS[troopType];
    if (!cost) throw new Error('Tipo de tropa inválido.');

    const totalGold = cost.gold * count;
    const totalWood = cost.wood * count;

    if (user.gold < totalGold || user.wood < totalWood) {
      throw new Error(`Recursos insuficientes! Requer 🪙 ${totalGold} Ouro e 🪓 ${totalWood} Madeira.`);
    }

    user.gold -= totalGold;
    user.wood -= totalWood;
    user.army[troopType] = (user.army[troopType] || 0) + count;

    this.save();
    return user;
  }

  executeRaid(attackerName, defenderName) {
    const attacker = this.getUser(attackerName);
    const defender = this.getUser(defenderName);

    if (!attacker || !defender) throw new Error('Reino não encontrado.');
    if (attackerName === defenderName) throw new Error('Você não pode atacar seu próprio reino!');

    // Verificar Escudo de Paz Ativo no Defensor
    if (defender.shieldUntil && new Date(defender.shieldUntil) > new Date()) {
      throw new Error(`🛡️ Este Reino está sob o Escudo de Paz e não pode ser atacado agora!`);
    }

    const attackerPower = (attacker.army.warrior || 0) * 10 +
                          (attacker.army.archer || 0) * 16 +
                          (attacker.army.wizard || 0) * 45 +
                          (attacker.army.dragon || 0) * 160;

    if (attackerPower <= 0) throw new Error('Você precisa treinar tropas no Quartel antes de marchar para a guerra!');

    const tower = defender.buildings.find(b => b.id === 'tower');
    const townhall = defender.buildings.find(b => b.id === 'townhall');
    const wall = defender.buildings.find(b => b.id === 'wall');
    const defenderPower = (tower ? tower.level * 90 : 60) +
                          (townhall ? townhall.level * 60 : 40) +
                          (wall ? wall.level * 120 : 0);

    const isVictory = attackerPower > defenderPower;

    let lootedGold = 0;
    let lootedWood = 0;

    if (isVictory) {
      lootedGold = Math.floor(defender.gold * 0.35);
      lootedWood = Math.floor(defender.wood * 0.35);

      defender.gold -= lootedGold;
      defender.wood -= lootedWood;
      attacker.gold = Math.min(attacker.maxGold, attacker.gold + lootedGold);
      attacker.wood = Math.min(attacker.maxWood, attacker.wood + lootedWood);

      attacker.trophies += 30;
      defender.trophies = Math.max(0, defender.trophies - 20);

      // Concede Escudo de Proteção Automático de 8h ao Defensor Saqueado
      defender.shieldUntil = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
    } else {
      attacker.trophies = Math.max(0, attacker.trophies - 15);
    }

    // Registra Log no Histórico de Batalhas do Defensor
    defender.battleLogs.unshift({
      attacker: attackerName,
      isVictory: !isVictory, // vitória para o defensor se atacante perdeu
      lootedGold,
      lootedWood,
      date: new Date().toISOString()
    });
    if (defender.battleLogs.length > 10) defender.battleLogs.pop();

    this.save();

    return {
      isVictory,
      attackerPower,
      defenderPower,
      lootedGold,
      lootedWood,
      attackerTrophies: attacker.trophies
    };
  }

  addGemsAndVip(username, gemsToAdd, vipDays = 0) {
    const cleanUser = username.toLowerCase();
    const user = this.data.users[cleanUser];
    if (!user) return false;

    user.gems = (user.gems || 0) + gemsToAdd;

    if (vipDays > 0) {
      const now = new Date();
      const currentVipEnd = user.vipUntil ? new Date(user.vipUntil) : now;
      const baseDate = currentVipEnd > now ? currentVipEnd : now;
      baseDate.setDate(baseDate.getDate() + vipDays);
      user.vipUntil = baseDate.toISOString();
      user.isVip = true;
    }

    this.save();
    return user;
  }

  registerPayment(paymentId, username, amount, gems, status = 'pending') {
    this.data.payments[paymentId] = {
      id: paymentId,
      username: username.toLowerCase(),
      amount,
      gems,
      status,
      createdAt: new Date().toISOString()
    };
    this.save();
    return this.data.payments[paymentId];
  }

  updatePaymentStatus(paymentId, status) {
    if (this.data.payments[paymentId]) {
      this.data.payments[paymentId].status = status;
      this.save();
      return this.data.payments[paymentId];
    }
    return null;
  }

  getPayment(paymentId) {
    return this.data.payments[paymentId] || null;
  }

  getKingdomList(excludeUsername) {
    return Object.values(this.data.users)
      .filter(u => u.username !== excludeUsername.toLowerCase())
      .map(u => ({
        username: u.username,
        kingdomName: u.kingdomName,
        trophies: u.trophies,
        gold: Math.floor(u.gold),
        wood: Math.floor(u.wood),
        townHallLevel: (u.buildings || []).find(b => b.id === 'townhall')?.level || 1,
        isShielded: u.shieldUntil && new Date(u.shieldUntil) > new Date(),
        isVip: u.isVip
      }));
  }

  getTopRanking(limit = 10) {
    return Object.values(this.data.users)
      .map(u => ({ username: u.username, kingdomName: u.kingdomName, trophies: u.trophies || 0, isVip: u.isVip }))
      .sort((a, b) => b.trophies - a.trophies)
      .slice(0, limit);
  }
}

module.exports = new Database();
