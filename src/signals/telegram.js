import { log } from '../lib/logger.js';

/**
 * Telegram Bot API delivery. Without TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID
 * the engine runs in dry-run mode and prints messages instead — the
 * scanner works end-to-end before any bot exists.
 */
const token = () => process.env.TELEGRAM_BOT_TOKEN || null;
const chatId = () => process.env.TELEGRAM_CHAT_ID || null;

export const telegramEnabled = () => !!(token() && chatId());

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  const json = await res.json().catch(() => null);
  if (!json?.ok) throw new Error(json?.description || `HTTP ${res.status}`);
  return json.result;
}

/** Sends HTML-formatted text. Never throws — a failed alert must not kill the scanner. */
export async function sendTelegram(html) {
  if (!telegramEnabled()) {
    console.log('\n[telegram dry-run]\n' + html.replace(/<[^>]+>/g, '') + '\n');
    return { dryRun: true };
  }
  try {
    return await call('sendMessage', { chat_id: chatId(), text: html, parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (e) {
    log.error(`telegram send failed: ${e.message}`);
    return null;
  }
}

/** Chats that have messaged the bot — how the user finds their TELEGRAM_CHAT_ID. */
export async function recentChats() {
  if (!token()) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const updates = await call('getUpdates', { timeout: 0 });
  const chats = new Map();
  for (const u of updates) {
    const c = (u.message || u.channel_post || u.my_chat_member)?.chat;
    if (c) chats.set(c.id, { id: c.id, type: c.type, name: c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username });
  }
  return [...chats.values()];
}
