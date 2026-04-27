import WebApp from '@twa-dev/sdk';

export async function copyText(text: string) {
  // Telegram WebApp supports clipboard in many clients.
  try {
    const tg = WebApp as any;
    if (typeof tg?.clipboard?.writeText === 'function') {
      await tg.clipboard.writeText(text);
      return;
    }
  } catch {
    // ignore
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for restricted WebViews
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', 'true');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  ta.style.left = '-1000px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

