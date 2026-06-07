const IDEMPOTENCY_TTL_SECONDS = 86400; // 24h - cobre redelivery após restart/deploy

function idempotencyKey(eventId) {
  return `idem:notifier:${eventId}`;
}

// RN3 - Idempotência: usa SET NX EX (atômico) no Redis como guarda de processamento único.
// Recebe `redis` e `notify` por injeção para permitir testes unitários com fakes/mocks.
async function handleAlert(message, { redis, notify }) {
  const eventId = message.event_id;
  const key = idempotencyKey(eventId);

  const acquired = await redis.set(key, '1', 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');

  if (!acquired) {
    console.log(`[notifier] duplicado, ignorando event_id=${eventId}`);
    return { duplicate: true };
  }

  try {
    await notify(message);
    return { duplicate: false };
  } catch (err) {
    await redis.del(key); // libera reprocessamento em caso de falha no envio
    throw err;
  }
}

async function notify(message) {
  const tag = message.emergency_notification ? 'EMERGENCY' : 'info';
  console.log(
    `[alert:${tag}] event_id=${message.event_id} kp=${message.kp_index} ` +
      `classification=${message.classification} neo_hazardous_count=${message.neo_hazardous_count ?? 'n/a'}`
  );
  return true;
}

module.exports = { handleAlert, notify, idempotencyKey, IDEMPOTENCY_TTL_SECONDS };
