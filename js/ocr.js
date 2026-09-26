/**
 * Client-Side OCR & Smart Indonesian Receipt Parser
 * Supports Tesseract.js browser OCR, heuristic text parsing,
 * and built-in realistic receipt presets for quick testing.
 */

export const PRESET_RECEIPTS = {
  padang: {
    merchant: 'Restoran Padang Garuda',
    taxRate: 11,
    serviceRate: 5,
    discount: { type: 'percent', value: 0, mode: 'proportional' },
    rounding: 1000,
    items: [
      { id: 'item-1', name: 'Ayam Bakar', price: 42000, qty: 1, lowConfidence: false },
      { id: 'item-2', name: 'Nasi Goreng', price: 28000, qty: 1, lowConfidence: false },
      { id: 'item-3', name: 'Es Teh Manis', price: 8000, qty: 1, lowConfidence: false },
      { id: 'item-4', name: 'Sate Ayam (10 tsk)', price: 35000, qty: 1, lowConfidence: false },
      { id: 'item-5', name: 'Es Jeruk Murni', price: 10000, qty: 1, lowConfidence: false },
      { id: 'item-6', name: 'Kentang Goreng', price: 25000, qty: 1, lowConfidence: true }, // Marked for OCR review
      { id: 'item-7', name: 'Air Mineral 600ml', price: 5000, qty: 1, lowConfidence: false }
    ]
  },
  cafe: {
    merchant: 'Kopi & Roti Kenangan',
    taxRate: 10,
    serviceRate: 0,
    discount: { type: 'amount', value: 10000, mode: 'proportional' },
    rounding: 500,
    items: [
      { id: 'item-c1', name: 'Es Kopi Kenangan Mantan', price: 22000, qty: 2, lowConfidence: false },
      { id: 'item-c2', name: 'Almond Croissant', price: 28000, qty: 1, lowConfidence: false },
      { id: 'item-c3', name: 'Avocado Toast Egg', price: 45000, qty: 1, lowConfidence: true },
      { id: 'item-c4', name: 'Iced Matcha Latte', price: 32000, qty: 1, lowConfidence: false },
      { id: 'item-c5', name: 'French Fries Truffle', price: 35000, qty: 1, lowConfidence: false }
    ]
  }
};

/**
 * Heuristically parses raw OCR text into structured items, taxes, and merchant name.
 */
export function parseReceiptText(text) {
  if (!text || typeof text !== 'string') {
    return { merchant: 'Struk Belanja', items: [], taxRate: 11, serviceRate: 0 };
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) {
    return { merchant: 'Struk Belanja', items: [], taxRate: 11, serviceRate: 0 };
  }

  let merchant = 'Restoran / Kafe';
  let taxRate = 11;
  let serviceRate = 0;
  const items = [];

  // Identify merchant from first 3 non-empty lines that don't look like dates or numbers
  for (let i = 0; i < Math.min(4, lines.length); i++) {
    const l = lines[i];
    if (!l.match(/\d{2,}/) && !l.toLowerCase().includes('jl') && !l.toLowerCase().includes('telp')) {
      merchant = l.replace(/[#*=\-_]/g, '').trim();
      break;
    }
  }

  // Regex patterns
  // Pattern 1: [Item Name] ... [Qty] ... [Price]
  // e.g. "Ayam Bakar 1 42.000" or "Ayam Bakar 42.000" or "2x Nasi Goreng 56000"
  const priceRegex = /(?:rp\.?|idr)?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?|[0-9]{4,7})/i;
  const qtyRegex = /(?:(\d+)\s*[xX*]\s*|\s*(\d+)\s*(?:pcs|porsi|cup)?$)/i;

  // Ignore lines with subtotal, total, cash, date, change, footer
  const ignoreKeywords = ['subtotal', 'sub total', 'grand total', 'total', 'tunai', 'cash', 'kembalian', 'change', 'kartu', 'debit', 'qris', 'telp', 'meja', 'table', 'kasir', 'waktu', 'tanggal', 'date', 'terima kasih', 'thank you'];

  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();

    // Check for tax / PPN
    if (lower.includes('ppn') || lower.includes('pajak') || lower.includes('pb1')) {
      const match = line.match(/(\d+)\s*%/);
      if (match) taxRate = parseInt(match[1], 10);
      return;
    }

    // Check for service
    if (lower.includes('service') || lower.includes('layanan') || lower.includes('svc')) {
      const match = line.match(/(\d+)\s*%/);
      if (match) serviceRate = parseInt(match[1], 10);
      return;
    }

    // Check if line should be ignored
    if (ignoreKeywords.some(kw => lower.includes(kw))) {
      return;
    }

    // Attempt to extract price from the right of the string
    const tokens = line.split(/\s+/);
    let foundPrice = null;
    let priceTokenIndex = -1;

    for (let j = tokens.length - 1; j >= 0; j--) {
      const token = tokens[j];
      const match = token.match(priceRegex);
      if (match) {
        let rawNum = match[1].replace(/[.,]/g, '');
        // handle decimal cents if needed (rare in IDR receipts)
        const val = parseInt(rawNum, 10);
        if (val >= 1000 && val <= 5000000) {
          foundPrice = val;
          priceTokenIndex = j;
          break;
        }
      }
    }

    if (foundPrice !== null && priceTokenIndex > 0) {
      // Name is tokens before price
      let nameTokens = tokens.slice(0, priceTokenIndex);
      let qty = 1;

      // Check if first token or any token is quantity e.g. "2x" or "2"
      if (nameTokens.length > 0) {
        const firstToken = nameTokens[0];
        const qtyMatch = firstToken.match(/^(\d+)[xX*]?$/);
        if (qtyMatch && parseInt(qtyMatch[1], 10) > 0 && parseInt(qtyMatch[1], 10) <= 50) {
          qty = parseInt(qtyMatch[1], 10);
          nameTokens.shift();
        }
      }

      let itemName = nameTokens.join(' ').replace(/[#*=\-_:,]/g, '').trim();
      if (itemName.length >= 2 && !itemName.match(/^\d+$/)) {
        // unit price
        const unitPrice = qty > 1 && foundPrice > 1000 ? Math.round(foundPrice / qty) : foundPrice;
        items.push({
          id: `item-${Date.now()}-${idx}`,
          name: itemName,
          price: unitPrice,
          qty: qty,
          lowConfidence: itemName.length < 4 || (foundPrice % 500 !== 0 && foundPrice % 100 !== 0)
        });
      }
    }
  });

  return {
    merchant: merchant || 'Restoran / Kafe',
    taxRate,
    serviceRate,
    items
  };
}

/**
 * Runs OCR on an image file using Tesseract.js (if available in window)
 * or falls back gracefully.
 */
export async function runOcrOnFile(file, onProgress) {
  if (typeof window.Tesseract === 'undefined') {
    throw new Error('Library OCR belum termuat. Pastikan koneksi internet aktif.');
  }

  const { createWorker } = window.Tesseract;
  const worker = await createWorker('ind+eng', 1, {
    logger: m => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    }
  });

  const ret = await worker.recognize(file);
  await worker.terminate();

  const text = ret.data.text;
  return parseReceiptText(text);
}
