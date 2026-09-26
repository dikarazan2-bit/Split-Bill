/**
 * Patungan - Split Bill Calculator Engine
 * Implements Proportional Tax/Service/Discount and Largest-Remainder Rounding Algorithm
 * As defined in PRD Section 6.4
 */

export function formatRupiah(amount, withPrefix = true) {
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('id-ID').format(rounded);
  return withPrefix ? `Rp ${formatted}` : formatted;
}

export function parseRupiah(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const cleaned = str.toString().replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

export function calculateSplit(state) {
  const {
    items = [],
    participants = [],
    taxRate = 11, // in percent
    serviceRate = 0, // in percent
    discount = { type: 'percent', value: 0, mode: 'proportional' },
    rounding = 1000 // 0, 500, or 1000
  } = state;

  // Validate participants
  if (!participants || participants.length === 0) {
    return {
      isValid: false,
      error: 'Peserta belum ditambahkan',
      participantsSummary: [],
      grandTotal: 0,
      subtotal: 0
    };
  }

  // Check unassigned items
  const unassignedItems = items.filter(item => {
    if (!item.assignments || item.assignments.length === 0) return true;
    return false;
  });

  // Calculate Subtotals per participant and track assigned item details
  const participantMap = {};
  participants.forEach(p => {
    participantMap[p.id] = {
      id: p.id,
      name: p.name,
      color: p.color || 'emerald',
      subtotal: 0,
      items: [],
      tax: 0,
      service: 0,
      discount: 0,
      unroundedTotal: 0,
      roundedTotal: 0,
      adjustment: 0,
      finalTotal: 0,
      remainder: 0
    };
  });

  let totalItemsCost = 0;

  items.forEach(item => {
    const itemTotal = (item.price || 0) * (item.qty || 1);
    totalItemsCost += itemTotal;

    if (!item.assignments || item.assignments.length === 0) {
      return; // unassigned
    }

    // Check if assignments are qty-based or array of participant IDs
    const isQtyBased = typeof item.assignments[0] === 'object' && item.assignments[0].participantId;

    if (isQtyBased) {
      item.assignments.forEach(assign => {
        const p = participantMap[assign.participantId];
        if (p) {
          const cost = (assign.qty || 1) * (item.price || 0);
          p.subtotal += cost;
          p.items.push({
            itemId: item.id,
            name: item.name,
            qty: assign.qty,
            unitPrice: item.price,
            portionCost: cost,
            shareDescription: `${assign.qty} porsi`
          });
        }
      });
    } else {
      // Split equally among selected participant IDs
      const count = item.assignments.length;
      const portionCost = count > 0 ? (itemTotal / count) : 0;
      item.assignments.forEach(pId => {
        const p = participantMap[pId];
        if (p) {
          p.subtotal += portionCost;
          const shareStr = count === 1 ? '1 porsi' : `1/${count} bagian`;
          p.items.push({
            itemId: item.id,
            name: item.name,
            qty: item.qty,
            unitPrice: item.price,
            portionCost: portionCost,
            shareDescription: count > 1 ? `Dibagi ${count} (${shareStr})` : 'Porsi penuh'
          });
        }
      });
    }
  });

  // Calculate total discount
  let totalDiscount = 0;
  if (discount.type === 'percent') {
    totalDiscount = totalItemsCost * ((discount.value || 0) / 100);
  } else {
    totalDiscount = Math.min(discount.value || 0, totalItemsCost);
  }
  totalDiscount = Math.max(0, totalDiscount);

  // Calculate Tax & Service from subtotal
  const totalTax = totalItemsCost * ((taxRate || 0) / 100);
  const totalService = totalItemsCost * ((serviceRate || 0) / 100);

  // Grand total according to receipt
  const receiptGrandTotal = Math.max(0, totalItemsCost - totalDiscount + totalTax + totalService);

  // Proportional distribution
  const activeParticipants = Object.values(participantMap).filter(p => p.subtotal > 0);
  const activeCount = activeParticipants.length || participants.length;

  Object.values(participantMap).forEach(p => {
    const ratio = totalItemsCost > 0 ? (p.subtotal / totalItemsCost) : (1 / participants.length);

    p.tax = totalTax * ratio;
    p.service = totalService * ratio;

    if (discount.mode === 'equal') {
      p.discount = p.subtotal > 0 ? (totalDiscount / activeCount) : 0;
    } else {
      p.discount = totalDiscount * ratio;
    }

    p.unroundedTotal = Math.max(0, p.subtotal - p.discount + p.tax + p.service);
  });

  // Rounding & Largest-Remainder Algorithm (PRD 6.4.4 & 6.4.5)
  const roundMultiple = parseInt(rounding, 10) || 0;
  const pList = Object.values(participantMap);

  if (roundMultiple <= 1) {
    // No specific rounding, nearest integer Rupiah
    let sumRounded = 0;
    pList.forEach(p => {
      p.roundedTotal = Math.round(p.unroundedTotal);
      p.remainder = p.unroundedTotal - Math.floor(p.unroundedTotal);
      sumRounded += p.roundedTotal;
      p.finalTotal = p.roundedTotal;
    });

    const diff = Math.round(receiptGrandTotal) - sumRounded;
    if (diff !== 0 && activeParticipants.length > 0) {
      // Allocate to highest remainder
      const sorted = [...activeParticipants].sort((a, b) => b.remainder - a.remainder);
      sorted[0].adjustment = diff;
      sorted[0].finalTotal += diff;
    }
  } else {
    // Round to multiple of 500 or 1000
    let sumRounded = 0;
    pList.forEach(p => {
      // Standard nearest multiple
      p.roundedTotal = Math.round(p.unroundedTotal / roundMultiple) * roundMultiple;
      // Remainder for Largest-Remainder allocation: unrounded mod rounding
      // For instance, 41.760 % 1000 = 760
      p.remainder = p.unroundedTotal % roundMultiple;
      sumRounded += p.roundedTotal;
      p.finalTotal = p.roundedTotal;
    });

    // Difference between exact receipt grand total and sum of rounded amounts
    const delta = Math.round(receiptGrandTotal - sumRounded);

    if (delta !== 0 && activeParticipants.length > 0) {
      // Person with largest remainder absorbs the delta (nombok sisa pembulatan)
      const sorted = [...activeParticipants].sort((a, b) => b.remainder - a.remainder);
      sorted[0].adjustment = delta;
      sorted[0].finalTotal += delta;
    }
  }

  return {
    isValid: unassignedItems.length === 0,
    unassignedItems,
    subtotal: totalItemsCost,
    totalDiscount,
    totalTax,
    totalService,
    receiptGrandTotal,
    rounding: roundMultiple,
    participantsSummary: pList
  };
}
