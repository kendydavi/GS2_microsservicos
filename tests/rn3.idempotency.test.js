const { handleAlert } = require('../src/notifier-service/src/handler');

// Fake mínimo do Redis: simula SET ... NX (atômico) com Map em memória.
function createRedisFake() {
  const store = new Map();
  return {
    store,
    async set(key, value, ...args) {
      const nx = args.includes('NX');
      if (nx && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    async del(key) {
      store.delete(key);
    },
  };
}

describe('RN3 - Idempotência por event_id', () => {
  test('o mesmo event_id é processado (notificado) uma única vez', async () => {
    const redis = createRedisFake();
    const notify = jest.fn().mockResolvedValue(true);
    const message = {
      event_id: 'evt-abc-001',
      kp_index: 8,
      classification: 'severe',
      emergency_notification: true,
    };

    const first = await handleAlert(message, { redis, notify });
    const second = await handleAlert(message, { redis, notify });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  test('event_ids diferentes são processados independentemente', async () => {
    const redis = createRedisFake();
    const notify = jest.fn().mockResolvedValue(true);

    await handleAlert({ event_id: 'evt-001', classification: 'low' }, { redis, notify });
    await handleAlert({ event_id: 'evt-002', classification: 'severe' }, { redis, notify });

    expect(notify).toHaveBeenCalledTimes(2);
  });
});
