// RN1 - Classificação de severidade por índice Kp
function classifyKp(kp) {
  let severityLevel;
  if (kp <= 4) severityLevel = 'low';
  else if (kp <= 7) severityLevel = 'moderate';
  else severityLevel = 'severe';

  return {
    classification: severityLevel,
    emergency_notification: kp >= 8,
  };
}

// Extrai o maior Kp de um payload DONKI: usa kpIndex direto ou o maior de allKpIndex[].kpIndex
function extractMaxKp(gstEvent) {
  if (typeof gstEvent.kpIndex === 'number') return gstEvent.kpIndex;

  const all = gstEvent.allKpIndex || [];
  if (all.length === 0) return 0;

  return all.reduce((max, item) => Math.max(max, item.kpIndex), 0);
}

module.exports = { classifyKp, extractMaxKp };
