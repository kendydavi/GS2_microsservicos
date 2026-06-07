const amqp = require('amqplib');

const EXCHANGE = 'space.events';
const ROUTING_KEY = 'space.weather.alert';

let channel = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// O healthcheck do RabbitMQ pode reportar "healthy" antes do listener AMQP
// (porta 5672) estar pronto para aceitar conexões — por isso o connect precisa
// de retry com backoff, não só depender do `depends_on: condition: service_healthy`.
async function connectWithRetry(url, retries = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await amqp.connect(url);
    } catch (err) {
      console.log(`[publisher] tentativa ${attempt}/${retries} de conexão ao RabbitMQ falhou: ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
  throw new Error('não foi possível conectar ao RabbitMQ');
}

async function connectPublisher() {
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  const conn = await connectWithRetry(url);
  channel = await conn.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  console.log('[publisher] conectado ao RabbitMQ e exchange declarada');
  return channel;
}

// Publica o evento já classificado. event_id deve ser o identificador real do evento
// (ex.: gstID da DONKI), nunca um UUID gerado aqui — é a chave de idempotência do consumer.
function publishAlert(eventId, payload) {
  if (!channel) throw new Error('publisher não conectado');

  const message = { event_id: eventId, ...payload };
  const body = Buffer.from(JSON.stringify(message));

  return channel.publish(EXCHANGE, ROUTING_KEY, body, {
    persistent: true,
    messageId: eventId,
    contentType: 'application/json',
    headers: { 'x-event-id': eventId },
  });
}

module.exports = { connectPublisher, publishAlert, EXCHANGE, ROUTING_KEY };
