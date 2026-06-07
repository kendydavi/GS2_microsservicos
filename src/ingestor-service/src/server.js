const express = require('express');
const { classifyKp } = require('./classify');
const { fetchDonkiGst, fetchHazardousNeoCount, nasa } = require('./nasaClient');
const { getCached, setCached } = require('./cache');
const { connectPublisher, publishAlert } = require('./publisher');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function lastWeekWindow() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function plusMinusOneDay(dateStr) {
  const base = new Date(dateStr);
  const start = new Date(base.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(base.getTime() + 24 * 60 * 60 * 1000);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ingestor-service' });
});

// Cache-aside: GET /current. TTL de 60s — ver justificativa no README.
app.get('/api/space-weather/current', async (req, res) => {
  try {
    const cached = await getCached();
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const { startDate, endDate } = lastWeekWindow();
    const result = await fetchDonkiGst(startDate, endDate);

    if (!result) {
      return res.status(503).json({ error: 'sem_dados_donki', retry_after: 60 });
    }

    const { classification, emergency_notification } = classifyKp(result.kp);
    const payload = {
      kp_index: result.kp,
      classification,
      emergency_notification,
      captured_at: new Date().toISOString(),
      source: 'NASA DONKI',
      cache: 'HIT',
    };

    await setCached(payload);
    res.setHeader('X-Cache', 'MISS');
    return res.json(payload);
  } catch (err) {
    console.error('[GET /current] erro:', err.message);
    return res.status(503).json({ error: 'upstream_unavailable' });
  }
});

// POST /ingest: busca DONKI + NEO, classifica (RN1 + RN2) e publica na fila
app.post('/api/space-weather/ingest', async (req, res) => {
  try {
    const { startDate, endDate } = lastWeekWindow();
    const result = await fetchDonkiGst(startDate, endDate);

    if (!result) {
      return res.status(503).json({ error: 'sem_dados_donki' });
    }

    const { event, kp } = result;
    const { classification, emergency_notification } = classifyKp(kp);
    const eventId = event.gstID || event.messageID || `evt-${Date.now()}`;

    let neoHazardousCount;
    if (classification === 'severe') {
      const window = plusMinusOneDay(event.startTime || new Date().toISOString());
      neoHazardousCount = await fetchHazardousNeoCount(window.startDate, window.endDate);
    }

    const occurredAt = event.startTime || new Date().toISOString();
    const capturedAt = new Date().toISOString();

    const payload = {
      kp_index: kp,
      classification,
      emergency_notification,
      ...(neoHazardousCount !== undefined ? { neo_hazardous_count: neoHazardousCount } : {}),
      captured_at: capturedAt,
      occurred_at: occurredAt,
    };

    publishAlert(eventId, payload);

    return res.status(202).json({ event_id: eventId, status: 'queued' });
  } catch (err) {
    console.error('[POST /ingest] erro:', err.message);
    return res.status(503).json({ error: 'upstream_unavailable' });
  }
});

// GET /neo/feed - leitura direta da NASA, sem cache
app.get('/api/neo/feed', async (req, res) => {
  try {
    const date = req.query.date || isoDate(new Date());
    const { data } = await nasa.get('/neo/rest/v1/feed', {
      params: { start_date: date, end_date: date },
    });
    return res.json(data);
  } catch (err) {
    console.error('[GET /neo/feed] erro:', err.message);
    return res.status(503).json({ error: 'upstream_unavailable' });
  }
});

async function start() {
  await connectPublisher();
  app.listen(PORT, () => {
    console.log(`[ingestor-service] ouvindo na porta ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[ingestor-service] falha ao iniciar:', err);
  process.exit(1);
});

module.exports = app;
