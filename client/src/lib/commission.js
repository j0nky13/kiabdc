export function computeCommission({ frontGross = 0, type = 'percent', percent = 0.35, flat = 75, split = 1, vehicleType = 'new' }) {
  if (frontGross <= 0) return 0;

  if (frontGross < 1701) {
    if (frontGross >= 1000) {
      flat = 100;
    } else {
      flat = 75;
    }
    const final = flat * (split || 1);
    return Math.max(0, Number(final.toFixed(2)));
  }

  let rate = 0;
  if (frontGross >= 701 && frontGross <= 1999) {
    rate = 0.25;
  } else if (frontGross >= 2000 && frontGross <= 2999) {
    rate = 0.30;
  } else if (frontGross >= 3000) {
    rate = 0.35;
  }

  const base = frontGross * rate;
  const final = base * (split || 1);
  return Math.max(0, Number(final.toFixed(2)));
}

export function sum(numbers = []) {
  return Number(numbers.reduce((a, b) => a + (Number(b) || 0), 0).toFixed(2));
}

export function projMonth(totalToDate, daysElapsed, daysInMonth) {
  if (!daysElapsed) return 0;
  return Number(((totalToDate / daysElapsed) * daysInMonth).toFixed(2));
}

export function projYear(totalToDate, dayOfYear) {
  if (!dayOfYear) return 0;
  return Number(((totalToDate / dayOfYear) * 365).toFixed(2));
}