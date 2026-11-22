/**
 * npm run telegram -- chats   list chats that have messaged your bot (find TELEGRAM_CHAT_ID)
 * npm run telegram -- test    send a test message to TELEGRAM_CHAT_ID
 */
import 'dotenv/config';
import { recentChats, sendTelegram, telegramEnabled } from '../src/signals/telegram.js';

const cmd = process.argv[2];
if (cmd === 'chats') {
  const chats = await recentChats();
  if (!chats.length) console.log('No chats yet. Open your bot in Telegram, press Start, send any message, then re-run.');
  for (const c of chats) console.log(`TELEGRAM_CHAT_ID=${c.id}   (${c.type}: ${c.name})`);
} else if (cmd === 'test') {
  if (!telegramEnabled()) { console.log('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env first.'); process.exit(1); }
  const r = await sendTelegram('✅ <b>Fiper Signals</b> connected. You will receive validated trade signals here.');
  console.log(r ? 'Sent.' : 'Failed — see error above.');
} else {
  console.log('Usage: npm run telegram -- chats | test');
}
