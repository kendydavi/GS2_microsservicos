const { classifyKp, extractMaxKp } = require('../src/ingestor-service/src/classify');

describe('RN1 - Classificação de severidade por Kp', () => {
  test.each([
    [0, 'low', false],
    [4, 'low', false],
    [5, 'moderate', false],
    [7, 'moderate', false],
    [8, 'severe', true],
    [9, 'severe', true],
  ])('Kp=%i deve classificar como %s (emergencyNotification=%s)', (kp, expectedLevel, expectedEmergency) => {
    const result = classifyKp(kp);
    expect(result.classification).toBe(expectedLevel);
    expect(result.emergency_notification).toBe(expectedEmergency);
  });

  test('extractMaxKp usa kpIndex direto quando presente', () => {
    expect(extractMaxKp({ kpIndex: 6 })).toBe(6);
  });

  test('extractMaxKp usa o maior valor de allKpIndex quando kpIndex está ausente', () => {
    const event = {
      allKpIndex: [{ kpIndex: 5 }, { kpIndex: 8 }, { kpIndex: 3 }],
    };
    expect(extractMaxKp(event)).toBe(8);
  });
});
