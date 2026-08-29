#!/bin/bash
# =================================================================
# SCRIPT DE INSTALAÇÃO E DEPLOY AUTOMÁTICO PARA UBUNTU SERVER
# =================================================================

echo "🚀 Iniciando configuração do Servidor MMORPG 2D no Ubuntu..."

# 1. Atualizar Pacotes do Sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar Node.js e NPM (se não estiver instalado)
if ! command -v node &> /dev/null
then
    echo "📦 Instalando Node.js v20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo "✅ Versão do Node.js: $(node -v)"
echo "✅ Versão do NPM: $(npm -v)"

# 3. Instalar PM2 (Gerenciador de Processos 24/7)
sudo npm install -g pm2

# 4. Instalar Dependências do Jogo
echo "📦 Instalando dependências do projeto..."
npm install

# 5. Liberar Porta 3000 no Firewall UFW (se o UFW estiver ativo)
sudo ufw allow 3000/tcp

# 6. Iniciar o Jogo com PM2 (Roda 24/7 em segundo plano)
echo "⚡ Iniciando o servidor do jogo..."
pm2 stop mmorpg-game 2>/dev/null || true
pm2 start server.js --name "mmorpg-game"

# 7. Configurar PM2 para inicializar junto com o Ubuntu (Auto-boot)
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME

echo ""
echo "=================================================================="
echo " 🎉 SERVIDOR DE JOGO INSTALADO E RODANDO COM SUCESSO! 🎉"
echo "=================================================================="
echo " 🌐 Seu jogo está online na porta 3000."
echo " 📌 Acesse pelo navegador: http://SEU_IP_DO_UBUNTU:3000"
echo " 📊 Para ver os logs em tempo real, digite no terminal: pm2 logs"
echo "=================================================================="
