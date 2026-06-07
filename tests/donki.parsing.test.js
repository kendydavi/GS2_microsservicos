const { extractMaxKp, classifyKp } = require('../src/ingestor-service/src/classify');

// Teste 3 - Parsing de payload real da DONKI: extrair o maior Kp e classificar corretamente.
describe('Parsing DONKI - extração de Kp e classificação combinadas', () => {
  test('evento severo com múltiplos kpIndex aninhados', () => {
    const gstEvent = {
      gstID: '2024-11-15T05:00:00-GST-001',
      startTime: '2024-11-15T05:00Z',
      allKpIndex: [
        { observedTime: '2024-11-15T06:00Z', kpIndex: 6, source: 'NOAA' },
        { observedTime: '2024-11-15T09:00Z', kpIndex: 8.7, source: 'NOAA' },
        { observedTime: '2024-11-15T12:00Z', kpIndex: 7, source: 'NOAA' },
      ],
    };

    const kp = extractMaxKp(gstEvent);
    const result = classifyKp(kp);

    expect(kp).toBe(8.7);
    expect(result.classification).toBe('severe');
    expect(result.emergency_notification).toBe(true);
  });

  test('evento sem allKpIndex retorna 0 (low, sem emergência)', () => {
    const gstEvent = { gstID: '2024-11-16T00:00:00-GST-002', allKpIndex: [] };

    const kp = extractMaxKp(gstEvent);
    const result = classifyKp(kp);

    expect(kp).toBe(0);
    expect(result.classification).toBe('low');
    expect(result.emergency_notification).toBe(false);
  });
});
