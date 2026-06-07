const amqp = require('amqplib');
const Redis = require('ioredis');
const { handleAlert, notify } = require('./handler');

const EXCHANGE = 'space.events';
const QUEUE = 'notifier.alerts';
const ROUTING_KEY = 'space.weather.alert';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// O healthcheck do RabbitMQ pode reportar "healthy" antes do listener AMQP
// (porta 5672) estar pronto para aceitar conexões — por isso o connect precisa
// de retry com backoff, não só depender do `depends_on: condition: service_healthy`.
async function connectWithRetry(url, retries = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await amqp.connect(url);
    } catch (err) {
      console.log(`[notifier] tentativa ${attempt}/${retries} de conexão ao RabbitMQ falhou: ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
  throw new Error('não foi possível conectar ao RabbitMQ');
}

async function start() {
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  const conn = await connectWithRetry(url);
  const channel = await conn.createChannel();

  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
  channel.prefetch(10);

  console.log('[notifier-service] aguardando mensagens em', QUEUE);

  channel.consume(
    QUEUE,
    async (msg) => {
      if (!msg) return;

      try {
        const message = JSON.parse(msg.content.toString());
        const eventId = msg.properties.headers['x-event-id'] || msg.properties.messageId || message.event_id;
        message.event_id = eventId;

        const result = await handleAlert(message, { redis, notify });

        channel.ack(msg);
        if (!result.duplicate) {
          console.log(`[notifier] processado event_id=${eventId}`);
        }
      } catch (err) {
        console.error('[notifier] falha ao processar mensagem:', err.message);
        channel.nack(msg, false, false); // descarta / envia para DLQ se configurada
      }
    },
    { noAck: false }
  );
}

start().catch((err) => {
  console.error('[notifier-service] falha ao iniciar:', err);
  process.exit(1);
});
