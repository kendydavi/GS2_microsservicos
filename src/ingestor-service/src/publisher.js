const amqp = require('amqplib');

const EXCHANGE = 'space.events';
const ROUTING_KEY = 'space.weather.alert';

let channel = null;

async function connectPublisher() {
  const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
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
