/**
 * Patungan - Share & State Serialization Module
 * Encodes bill state into URL-safe strings (LZ-String / Base64)
 * and formats rich WhatsApp billing messages.
 */

import { formatRupiah } from './calculator.js';

export function serializeState(state) {
  try {
    const compact = {
      m: state.merchant || 'Patungan',
      i: (state.items || []).map(item => ({
        id: item.id,
        n: item.name,
        p: item.price,
        q: item.qty,
        a: item.assignments || []
      })),
      p: (state.participants || []).map(p => ({
        id: p.id,
        n: p.name,
        c: p.color
      })),
      t: state.taxRate,
      s: state.serviceRate,
      d: state.discount,
      r: state.rounding,
      note: state.paymentNote || ''
    };

    const jsonStr = JSON.stringify(compact);
    const hasWindow = typeof window !== 'undefined';
    const lz = hasWindow && window.LZString;

    if (lz && typeof lz.compressToEncodedURIComponent === 'function') {
      return 'lz_' + lz.compressToEncodedURIComponent(jsonStr);
    } else {
      const b64 = hasWindow && window.btoa 
        ? window.btoa(encodeURIComponent(jsonStr)) 
        : Buffer.from(encodeURIComponent(jsonStr)).toString('base64');
      return 'b64_' + b64;
    }
  } catch (err) {
    console.error('Failed to serialize state:', err);
    return null;
  }
}

export function deserializeState(hashString) {
  if (!hashString) return null;
  try {
    let clean = hashString;
    if (clean.startsWith('#')) clean = clean.slice(1);
    if (clean.startsWith('data=')) clean = clean.slice(5);

    const hasWindow = typeof window !== 'undefined';
    const lz = hasWindow && window.LZString;

    let jsonStr = '';
    if (clean.startsWith('lz_') && lz) {
      jsonStr = lz.decompressFromEncodedURIComponent(clean.slice(3));
    } else if (clean.startsWith('b64_')) {
      const raw = clean.slice(4);
      const decoded = hasWindow && window.atob 
        ? window.atob(raw) 
        : Buffer.from(raw, 'base64').toString('utf-8');
      jsonStr = decodeURIComponent(decoded);
    } else {
      // Try direct base64 or decode
      try {
        const decoded = hasWindow && window.atob 
          ? window.atob(clean) 
          : Buffer.from(clean, 'base64').toString('utf-8');
        jsonStr = decodeURIComponent(decoded);
      } catch (e) {
        jsonStr = decodeURIComponent(clean);
      }
    }

    if (!jsonStr) return null;
    const compact = JSON.parse(jsonStr);

    return {
      merchant: compact.m || 'Patungan',
      items: (compact.i || []).map(item => ({
        id: item.id || `item-${Math.random()}`,
        name: item.n,
        price: item.p,
        qty: item.q || 1,
        assignments: item.a || [],
        lowConfidence: false
      })),
      participants: (compact.p || []).map(p => ({
        id: p.id,
        name: p.n,
        color: p.c || 'emerald'
      })),
      taxRate: compact.t ?? 11,
      serviceRate: compact.s ?? 0,
      discount: compact.d || { type: 'percent', value: 0, mode: 'proportional' },
      rounding: compact.r ?? 1000,
      paymentNote: compact.note || ''
    };
  } catch (err) {
    console.error('Failed to deserialize state:', err);
    return null;
  }
}

export function generateShareUrl(state) {
  const code = serializeState(state);
  const origin = window.location.origin + window.location.pathname;
  return `${origin}#data=${code}`;
}

export function formatWhatsAppMessage(state, calculationResult, shareUrl) {
  const { merchant = 'Patungan', paymentNote = '' } = state;
  const { receiptGrandTotal, participantsSummary = [], totalTax, totalService, totalDiscount, rounding } = calculationResult;

  let msg = `🧾 *PATUNGAN — ${merchant.toUpperCase()}*\n`;
  msg += `Total Tagihan: *${formatRupiah(receiptGrandTotal)}*\n`;
  msg += `─────────────────────────\n\n`;

  participantsSummary.forEach(p => {
    msg += `👤 *${p.name}*: *${formatRupiah(p.finalTotal)}*\n`;
    if (p.items && p.items.length > 0) {
      p.items.forEach(it => {
        msg += `   • ${it.name} (${it.shareDescription}): ${formatRupiah(it.portionCost)}\n`;
      });
    }
    const extras = [];
    if (p.tax > 0) extras.push(`Pajak: ${formatRupiah(p.tax)}`);
    if (p.service > 0) extras.push(`Svc: ${formatRupiah(p.service)}`);
    if (p.discount > 0) extras.push(`Disc: -${formatRupiah(p.discount)}`);
    if (p.adjustment !== 0) {
      extras.push(`Penyesuaian bulat: ${p.adjustment > 0 ? '+' : ''}${formatRupiah(p.adjustment)}`);
    }
    if (extras.length > 0) {
      msg += `   _(${extras.join(', ')})_\n`;
    }
    msg += `\n`;
  });

  msg += `─────────────────────────\n`;
  if (paymentNote && paymentNote.trim().length > 0) {
    msg += `💳 *Tujuan Pembayaran:*\n${paymentNote.trim()}\n\n`;
  }

  msg += `🔗 *Cek rincian interaktif:*\n${shareUrl}`;
  return msg;
}

export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('navigator.clipboard failed, using fallback', e);
    }
  }

  // Fallback
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const success = document.execCommand('copy');
    textArea.remove();
    return success;
  } catch (err) {
    textArea.remove();
    return false;
  }
}
