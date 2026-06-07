const amqp = require('amqplib');
const Redis = require('ioredis');
const { handleAlert, notify } = require('./handler');

const EXCHANGE = 'space.events';
const QUEUE = 'notifier.alerts';
const ROUTING_KEY = 'space.weather.alert';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function start() {
  const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
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
