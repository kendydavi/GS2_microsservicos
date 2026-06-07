import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const res = http.get('http://localhost:8080/api/space-weather/current');

  check(res, {
    'status 200': (r) => r.status === 200,
    'tem classification': (r) => r.json('classification') !== undefined,
  });

  sleep(1);
}
