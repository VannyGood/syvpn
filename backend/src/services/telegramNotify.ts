import axios from 'axios';
import { env } from '../config/env.js';

export async function notifyAdmin(text: string) {
  // Telegram Bot API: sendMessage
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: env.ADMIN_TELEGRAM_CHAT_ID,
    text,
    disable_web_page_preview: true,
  };

  try {
    const resp = await axios.post(url, payload);
    const messageId = resp.data?.result?.message_id;
    console.log('[telegramNotify] sent', {
      chat_id: env.ADMIN_TELEGRAM_CHAT_ID,
      message_id: messageId,
    });
    return resp.data;
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error('[telegramNotify] failed', {
      chat_id: env.ADMIN_TELEGRAM_CHAT_ID,
      status,
      data,
    });
    throw err;
  }
}

export async function notifyUser(telegramId: string, text: string) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: telegramId,
    text,
    disable_web_page_preview: true,
  };

  try {
    const resp = await axios.post(url, payload);
    const messageId = resp.data?.result?.message_id;
    console.log('[telegramNotify] sent to user', { telegram_id: telegramId, message_id: messageId });
    return resp.data;
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error('[telegramNotify] failed to user', { telegram_id: telegramId, status, data });
    throw err;
  }
}

