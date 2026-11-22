/**
 * Standalone signal scanner (no web server needed).
 *
 * npm run signals            scan every 5 minutes, forever
 * npm run signals -- --once  one scan, then exit (good for cron / Task Scheduler)
 *
 * Bars are hourly and daily, so checking every 5 minutes means an alert
 * arrives within minutes of the bar closing without hammering the feeds.
 */
import 'dotenv/config';
import { scanOnce } from '../src/signals/scanner.js';
import { telegramEnabled } from '../src/signals/telegram.js';
import { log } from '../src/lib/logger.js';

const once = process.argv.includes('--once');
log.info(`signal scanner ${once ? '(single pass)' : 'running every 5 min'} — telegram ${telegramEnabled() ? 'ON' : 'DRY-RUN (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)'}`);

const tick = async () => {
  const msgs = await scanOnce().catch(e => { log.error(e.message); return []; });
  log.info(`scan done — ${msgs.length} message(s)`);
};
await tick();
if (!once) setInterval(tick, 5 * 60_000);
