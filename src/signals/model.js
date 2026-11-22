/**
 * L2-regularised logistic regression, from scratch.
 *
 * Chosen over gradient-boosted trees on purpose: with a few hundred
 * labelled trades per instrument, a low-variance linear model overfits
 * far less, and every prediction decomposes into per-feature
 * contributions — the "keep it explainable" rule in CLAUDE.md.
 */
const sigmoid = z => 1 / (1 + Math.exp(-z));

export function train(X, y, { l2 = 1.0, epochs = 600, lr = 0.2 } = {}) {
  const n = X.length, d = X[0].length;
  const mean = new Array(d).fill(0), std = new Array(d).fill(0);
  for (const row of X) row.forEach((v, j) => { mean[j] += v / n; });
  for (const row of X) row.forEach((v, j) => { std[j] += (v - mean[j]) ** 2 / n; });
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j]) || 1;
  const Z = X.map(r => r.map((v, j) => (v - mean[j]) / std[j]));

  const w = new Array(d).fill(0);
  let b = Math.log((y.reduce((s, v) => s + v, 0) + 1) / (n - y.reduce((s, v) => s + v, 0) + 1));
  for (let e = 0; e < epochs; e++) {
    const gw = new Array(d).fill(0); let gb = 0;
    for (let i = 0; i < n; i++) {
      let z = b; for (let j = 0; j < d; j++) z += w[j] * Z[i][j];
      const err = sigmoid(z) - y[i];
      gb += err; for (let j = 0; j < d; j++) gw[j] += err * Z[i][j];
    }
    b -= lr * gb / n;
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j] / n);
  }
  return { w, b, mean, std };
}

export function predict(m, x) {
  let z = m.b;
  for (let j = 0; j < x.length; j++) z += m.w[j] * (x[j] - m.mean[j]) / m.std[j];
  return sigmoid(z);
}

/** Per-feature push on the log-odds, largest first. */
export function explain(m, x, names) {
  return x.map((v, j) => ({ name: names[j], c: m.w[j] * (v - m.mean[j]) / m.std[j] }))
    .sort((a, b) => Math.abs(b.c) - Math.abs(a.c));
}

/** Wilson score lower bound — the win rate we can claim with 95% confidence, not the one we observed. */
export function wilsonLower(wins, n, z = 1.96) {
  if (!n) return 0;
  const p = wins / n, den = 1 + z * z / n;
  return (p + z * z / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / den;
}
