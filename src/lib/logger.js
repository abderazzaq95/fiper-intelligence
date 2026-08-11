const ts = () => new Date().toISOString().slice(11, 23);
const c = { dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', reset: '\x1b[0m' };

export const log = {
  info:  (...a) => console.log(`${c.dim}${ts()}${c.reset}`, ...a),
  ok:    (...a) => console.log(`${c.dim}${ts()}${c.reset} ${c.green}✓${c.reset}`, ...a),
  warn:  (...a) => console.warn(`${c.dim}${ts()}${c.reset} ${c.yellow}!${c.reset}`, ...a),
  error: (...a) => console.error(`${c.dim}${ts()}${c.reset} ${c.red}✗${c.reset}`, ...a)
};
