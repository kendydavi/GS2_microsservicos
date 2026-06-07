const axios = require('axios');
const axiosRetry = require('axios-retry').default || require('axios-retry');
const { extractMaxKp } = require('./classify');

const nasa = axios.create({
  baseURL: 'https://api.nasa.gov',
  timeout: 5000,
  params: { api_key: process.env.NASA_API_KEY || 'DEMO_KEY' },
});

axiosRetry(nasa, {
  retries: 3,
  retryDelay: (retryCount) => 500 * Math.pow(2, retryCount - 1),
  onRetry: (retryCount, error, requestConfig) => {
    console.log(
      `[nasa-retry] tentativa=${retryCount} url=${requestConfig.url} motivo=${error.message}`
    );
  },
  retryCondition: (err) => {
    if (axiosRetry.isNetworkOrIdempotentRequestError(err)) return true;
    const status = err.response ? err.response.status : 0;
    return status === 429 || (status >= 500 && status <= 599);
  },
});

// Busca eventos GST (tempestades geomagnéticas) e retorna o de maior Kp + o evento bruto
async function fetchDonkiGst(startDate, endDate) {
  const { data } = await nasa.get('/DONKI/notifications', {
    params: { startDate, endDate, type: 'GST' },
  });

  const events = Array.isArray(data) ? data : [];
  if (events.length === 0) return null;

  let best = null;
  let bestKp = -1;
  for (const ev of events) {
    const kp = extractMaxKp(ev);
    if (kp > bestKp) {
      bestKp = kp;
      best = ev;
    }
  }

  return { event: best, kp: bestKp };
}

// Conta NEOs perigosos (is_potentially_hazardous_asteroid = true) numa janela de datas
async function fetchHazardousNeoCount(startDate, endDate) {
  const { data } = await nasa.get('/neo/rest/v1/feed', {
    params: { start_date: startDate, end_date: endDate },
  });

  const neoByDate = data.near_earth_objects || {};
  let count = 0;
  for (const date of Object.keys(neoByDate)) {
    for (const neo of neoByDate[date]) {
      if (neo.is_potentially_hazardous_asteroid) count += 1;
    }
  }
  return count;
}

module.exports = { fetchDonkiGst, fetchHazardousNeoCount, nasa };
