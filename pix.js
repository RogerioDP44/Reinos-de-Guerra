const db = require('./database');

// Pacotes da Loja de Estratégia de Reino
const PACKAGES = {
  'vip_kingdom': { name: 'Passe Imperador VIP (30 dias + 300 Gemas)', price: 14.90, gems: 300, vipDays: 30 },
  'gems_small': { name: 'Saco com 150 Gemas 💎', price: 5.00, gems: 150, vipDays: 0 },
  'gems_medium': { name: 'Baú com 500 Gemas 💎', price: 15.00, gems: 500, vipDays: 0 },
  'gems_mega': { name: 'Tesouro Imperial (1.500 Gemas 💎)', price: 39.90, gems: 1500, vipDays: 0 }
};

class PixService {
  constructor() {
    this.mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || null;
  }

  getPackages() {
    return PACKAGES;
  }

  async createPixOrder(username, packageId) {
    const pkg = PACKAGES[packageId];
    if (!pkg) throw new Error('Pacote inválido.');

    const paymentId = 'PIX_KINGDOM_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    db.registerPayment(paymentId, username, pkg.price, pkg.gems);

    if (this.mpAccessToken) {
      try {
        const response = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.mpAccessToken}`
          },
          body: JSON.stringify({
            transaction_amount: pkg.price,
            description: `${pkg.name} - Imperador: ${username}`,
            payment_method_id: 'pix',
            payer: {
              email: `${username}@reinosdeguerra.com`,
              first_name: username
            },
            notification_url: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/pix/webhook`
          })
        });

        const data = await response.json();
        if (data.id) {
          return {
            paymentId: paymentId,
            mpId: data.id,
            qrCode: data.point_of_interaction?.transaction_data?.qr_code || 'PIX-CODE-MP-KINGDOM',
            amount: pkg.price,
            packageName: pkg.name,
            status: 'pending'
          };
        }
      } catch (err) {
        console.error('[PIX MP Error]:', err.message);
      }
    }

    const payloadPixSimulado = `00020126580014br.gov.bcb.pix0136${paymentId}520400005303986540${pkg.price.toFixed(2)}5802BR5918REINOS DE GUERRA6009SAO PAULO62070503***6304`;

    return {
      paymentId: paymentId,
      qrCode: payloadPixSimulado,
      amount: pkg.price,
      packageName: pkg.name,
      status: 'pending',
      isSandbox: true,
      message: 'PIX gerado em modo de teste. Você pode simular a aprovação instantânea pelo botão abaixo.'
    };
  }

  confirmPayment(paymentId) {
    const payment = db.getPayment(paymentId);
    if (!payment) throw new Error('Pagamento não encontrado.');
    if (payment.status === 'approved') return { success: true, message: 'Pagamento já aprovado.' };

    const pkg = Object.values(PACKAGES).find(p => p.price === payment.amount) || { gems: payment.gems, vipDays: 0 };

    db.addGemsAndVip(payment.username, payment.gems, pkg.vipDays);
    db.updatePaymentStatus(paymentId, 'approved');

    return {
      success: true,
      username: payment.username,
      gems: payment.gems,
      status: 'approved'
    };
  }
}

module.exports = new PixService();
