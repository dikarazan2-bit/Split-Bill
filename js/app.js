/**
 * Patungan - Split Bill Web Application Controller
 * Handles UI interactions, screens navigation, OCR integration,
 * participant assignments, live calculation meters, and sharing.
 */

import { calculateSplit, formatRupiah, parseRupiah } from './calculator.js';
import { PRESET_RECEIPTS, runOcrOnFile, parseReceiptText } from './ocr.js';
import { serializeState, deserializeState, generateShareUrl, formatWhatsAppMessage, copyToClipboard } from './share.js';

// Default Application State
const state = {
  merchant: 'Restoran Padang Garuda',
  items: [],
  participants: [
    { id: 'p-1', name: 'Arief', color: 'emerald' },
    { id: 'p-2', name: 'Budi', color: 'indigo' },
    { id: 'p-3', name: 'Citra', color: 'purple' },
    { id: 'p-4', name: 'Dina', color: 'amber' }
  ],
  taxRate: 11,
  serviceRate: 5,
  discount: {
    type: 'percent', // 'percent' | 'amount'
    value: 0,
    mode: 'proportional' // 'proportional' | 'equal'
  },
  rounding: 1000, // 0, 500, or 1000
  paymentNote: 'BCA 1234567890 a/n Arief',
  currentScreen: 'home',
  isReadOnly: false,
  qtySplitTargetItemId: null,
  paidStatus: {} // { [participantId]: boolean }
};

// Available participant colors
const AVATAR_COLORS = {
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-800 dark:text-emerald-300', dot: 'bg-emerald-500', border: 'border-emerald-300 dark:border-emerald-700' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-800 dark:text-indigo-300', dot: 'bg-indigo-500', border: 'border-indigo-300 dark:border-indigo-700' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-950/60', text: 'text-purple-800 dark:text-purple-300', dot: 'bg-purple-500', border: 'border-purple-300 dark:border-purple-700' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-800 dark:text-amber-300', dot: 'bg-amber-500', border: 'border-amber-300 dark:border-amber-700' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-800 dark:text-rose-300', dot: 'bg-rose-500', border: 'border-rose-300 dark:border-rose-700' },
  cyan: { bg: 'bg-cyan-100 dark:bg-cyan-950/60', text: 'text-cyan-800 dark:text-cyan-300', dot: 'bg-cyan-500', border: 'border-cyan-300 dark:border-cyan-700' }
};

// DOM Elements
const DOM = {
  // Screens & Navigation
  screenHome: document.getElementById('screenHome'),
  screenReview: document.getElementById('screenReview'),
  screenAssignment: document.getElementById('screenAssignment'),
  screenSummary: document.getElementById('screenSummary'),
  headerSubtitle: document.getElementById('headerSubtitle'),
  btnHeaderBack: document.getElementById('btnHeaderBack'),
  btnResetApp: document.getElementById('btnResetApp'),
  btnThemeToggle: document.getElementById('btnThemeToggle'),
  themeIcon: document.getElementById('themeIcon'),
  brandLogo: document.getElementById('brandLogo'),
  stepperNav: document.getElementById('stepperNav'),
  stepTabHome: document.getElementById('stepTabHome'),
  stepTabReview: document.getElementById('stepTabReview'),
  stepTabAssignment: document.getElementById('stepTabAssignment'),
  stepTabSummary: document.getElementById('stepTabSummary'),

  // Screen 1: Home
  cardOcrTrigger: document.getElementById('cardOcrTrigger'),
  cardManualInput: document.getElementById('cardManualInput'),
  fileReceiptInput: document.getElementById('fileReceiptInput'),
  btnTriggerCamera: document.getElementById('btnTriggerCamera'),
  btnPresetPadang: document.getElementById('btnPresetPadang'),
  btnPresetCafe: document.getElementById('btnPresetCafe'),

  // Screen 2: Review
  displayMerchantName: document.getElementById('displayMerchantName'),
  displayItemCountBadge: document.getElementById('displayItemCountBadge'),
  badgeMenuCount: document.getElementById('badgeMenuCount'),
  reviewItemList: document.getElementById('reviewItemList'),
  btnEditMerchant: document.getElementById('btnEditMerchant'),
  btnAddNewItem: document.getElementById('btnAddNewItem'),
  txtStickySubtotal2: document.getElementById('txtStickySubtotal2'),
  btnProceedToAssignment: document.getElementById('btnProceedToAssignment'),

  // Screen 3: Assignment
  btnQuickAssignAll: document.getElementById('btnQuickAssignAll'),
  txtParticipantCount: document.getElementById('txtParticipantCount'),
  participantChipsList: document.getElementById('participantChipsList'),
  txtAssignmentStatusCount: document.getElementById('txtAssignmentStatusCount'),
  barAssignmentProgress: document.getElementById('barAssignmentProgress'),
  iconAssignmentStatus: document.getElementById('iconAssignmentStatus'),
  boxUnassignedWarning: document.getElementById('boxUnassignedWarning'),
  txtUnassignedMessage: document.getElementById('txtUnassignedMessage'),
  btnAssignAllToEveryone: document.getElementById('btnAssignAllToEveryone'),
  assignmentItemsList: document.getElementById('assignmentItemsList'),
  txtSummaryChargesPreview: document.getElementById('txtSummaryChargesPreview'),
  labelTaxValue: document.getElementById('labelTaxValue'),
  inputCustomTax: document.getElementById('inputCustomTax'),
  labelServiceValue: document.getElementById('labelServiceValue'),
  inputCustomService: document.getElementById('inputCustomService'),
  btnDiscountPercent: document.getElementById('btnDiscountPercent'),
  btnDiscountAmount: document.getElementById('btnDiscountAmount'),
  inputDiscountValue: document.getElementById('inputDiscountValue'),
  selectDiscountMode: document.getElementById('selectDiscountMode'),
  txtStickyTotal3: document.getElementById('txtStickyTotal3'),
  btnProceedToSummary: document.getElementById('btnProceedToSummary'),

  // Screen 4: Summary
  btnModeCreator: document.getElementById('btnModeCreator'),
  btnModeReceiver: document.getElementById('btnModeReceiver'),
  bannerReadOnlyNotice: document.getElementById('bannerReadOnlyNotice'),
  btnDuplicateAndEdit: document.getElementById('btnDuplicateAndEdit'),
  summaryMerchantName: document.getElementById('summaryMerchantName'),
  summaryParticipantCountBadge: document.getElementById('summaryParticipantCountBadge'),
  txtSummaryGrandTotal: document.getElementById('txtSummaryGrandTotal'),
  txtSummarySubtotal: document.getElementById('txtSummarySubtotal'),
  lblSummaryTax: document.getElementById('lblSummaryTax'),
  txtSummaryTax: document.getElementById('txtSummaryTax'),
  lblSummaryService: document.getElementById('lblSummaryService'),
  txtSummaryService: document.getElementById('txtSummaryService'),
  txtSummaryRounding: document.getElementById('txtSummaryRounding'),
  rowSummaryDiscount: document.getElementById('rowSummaryDiscount'),
  txtSummaryDiscount: document.getElementById('txtSummaryDiscount'),
  txtPaidProgress: document.getElementById('txtPaidProgress'),
  btnToggleAllAccordions: document.getElementById('btnToggleAllAccordions'),
  summaryParticipantsList: document.getElementById('summaryParticipantsList'),
  inputPaymentNote: document.getElementById('inputPaymentNote'),
  btnCopyPaymentNote: document.getElementById('btnCopyPaymentNote'),
  txtWaPreview: document.getElementById('txtWaPreview'),
  btnShareWhatsApp: document.getElementById('btnShareWhatsApp'),
  btnCopyShareLink: document.getElementById('btnCopyShareLink'),
  btnCopyTextSummary: document.getElementById('btnCopyTextSummary'),
  btnBackToEditFromSummary: document.getElementById('btnBackToEditFromSummary'),
  btnStickyShare: document.getElementById('btnStickyShare'),

  // Sticky Bars
  stickyBarScreen2: document.getElementById('stickyBarScreen2'),
  stickyBarScreen3: document.getElementById('stickyBarScreen3'),
  stickyBarScreen4: document.getElementById('stickyBarScreen4'),

  // Modals
  modalOcrProgress: document.getElementById('modalOcrProgress'),
  txtOcrStatus: document.getElementById('txtOcrStatus'),
  barOcrProgress: document.getElementById('barOcrProgress'),
  btnCancelOcr: document.getElementById('btnCancelOcr'),
  modalEditItem: document.getElementById('modalEditItem'),
  modalItemTitle: document.getElementById('modalItemTitle'),
  formEditItem: document.getElementById('formEditItem'),
  inputEditItemId: document.getElementById('inputEditItemId'),
  inputItemName: document.getElementById('inputItemName'),
  inputItemPrice: document.getElementById('inputItemPrice'),
  inputItemQty: document.getElementById('inputItemQty'),
  inputItemLowConf: document.getElementById('inputItemLowConf'),
  modalParticipant: document.getElementById('modalParticipant'),
  modalParticipantTitle: document.getElementById('modalParticipantTitle'),
  formParticipant: document.getElementById('formParticipant'),
  inputParticipantId: document.getElementById('inputParticipantId'),
  inputParticipantName: document.getElementById('inputParticipantName'),
  modalQtySplit: document.getElementById('modalQtySplit'),
  txtQtySplitItemName: document.getElementById('txtQtySplitItemName'),
  txtQtySplitSubtitle: document.getElementById('txtQtySplitSubtitle'),
  qtySplitParticipantsContainer: document.getElementById('qtySplitParticipantsContainer'),
  txtQtyAllocatedStatus: document.getElementById('txtQtyAllocatedStatus'),
  btnResetToEqualSplit: document.getElementById('btnResetToEqualSplit'),
  btnSaveQtySplit: document.getElementById('btnSaveQtySplit'),

  // Toast
  toast: document.getElementById('toast'),
  toastMsg: document.getElementById('toastMsg'),
  toastIcon: document.getElementById('toastIcon')
};

// -------------------------------------------------------------
// Toast Notification Utility
// -------------------------------------------------------------
function showToast(message, icon = 'check_circle', duration = 3000) {
  if (!DOM.toast) return;
  DOM.toastMsg.textContent = message;
  DOM.toastIcon.textContent = icon;
  DOM.toast.classList.add('show');
  clearTimeout(DOM.toast._timer);
  DOM.toast._timer = setTimeout(() => {
    DOM.toast.classList.remove('show');
  }, duration);
}

// -------------------------------------------------------------
// Theme Management (Light / Dark)
// -------------------------------------------------------------
function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    DOM.themeIcon.textContent = 'light_mode';
    localStorage.setItem('patungan_theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    DOM.themeIcon.textContent = 'dark_mode';
    localStorage.setItem('patungan_theme', 'light');
  }
}

function initTheme() {
  const saved = localStorage.getItem('patungan_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved === 'dark' || (!saved && prefersDark);
  applyTheme(isDark);
}

function toggleTheme() {
  const isCurrentlyDark = document.documentElement.classList.contains('dark');
  applyTheme(!isCurrentlyDark);
  showToast(!isCurrentlyDark ? 'Mode gelap aktif' : 'Mode terang aktif', !isCurrentlyDark ? 'dark_mode' : 'light_mode');
}

// -------------------------------------------------------------
// Screen Navigation & Stepper Wizard
// -------------------------------------------------------------
function updateStepperTabs(screenName) {
  const tabs = [
    { el: DOM.stepTabHome, name: 'home' },
    { el: DOM.stepTabReview, name: 'review' },
    { el: DOM.stepTabAssignment, name: 'assignment' },
    { el: DOM.stepTabSummary, name: 'summary' }
  ];

  tabs.forEach(t => {
    if (!t.el) return;
    if (t.name === screenName) {
      t.el.classList.add('active');
    } else {
      t.el.classList.remove('active');
    }
  });
}

function navigateTo(screenName) {
  // Validate steps if navigating forward
  if (screenName === 'assignment' && state.items.length === 0) {
    showToast('Tambahkan minimal 1 menu sebelum lanjut!', 'warning');
    screenName = 'review';
  } else if (screenName === 'summary') {
    const calc = calculateSplit(state);
    if (!calc.isValid) {
      showToast(`Ada ${calc.unassignedItems.length} menu belum dibagi!`, 'warning');
      screenName = 'assignment';
    }
  }

  state.currentScreen = screenName;
  updateStepperTabs(screenName);

  // Hide all screens
  DOM.screenHome.classList.add('hidden');
  DOM.screenReview.classList.add('hidden');
  DOM.screenAssignment.classList.add('hidden');
  DOM.screenSummary.classList.add('hidden');

  // Hide all sticky action bars
  DOM.stickyBarScreen2.classList.add('hidden');
  DOM.stickyBarScreen3.classList.add('hidden');
  DOM.stickyBarScreen4.classList.add('hidden');

  // Configure back button & headers
  if (screenName === 'home') {
    DOM.screenHome.classList.remove('hidden');
    DOM.btnHeaderBack.classList.add('hidden');
    DOM.btnResetApp.classList.add('hidden');
    DOM.headerSubtitle.textContent = 'Split bill cepat tanpa ribet';
  } else if (screenName === 'review') {
    DOM.screenReview.classList.remove('hidden');
    DOM.stickyBarScreen2.classList.remove('hidden');
    DOM.btnHeaderBack.classList.remove('hidden');
    DOM.btnResetApp.classList.remove('hidden');
    DOM.headerSubtitle.textContent = 'Langkah 1 dari 3: Koreksi Item';
    renderReviewScreen();
  } else if (screenName === 'assignment') {
    DOM.screenAssignment.classList.remove('hidden');
    DOM.stickyBarScreen3.classList.remove('hidden');
    DOM.btnHeaderBack.classList.remove('hidden');
    DOM.btnResetApp.classList.remove('hidden');
    DOM.headerSubtitle.textContent = 'Langkah 2 dari 3: Bagi Pesanan';
    renderAssignmentScreen();
  } else if (screenName === 'summary') {
    DOM.screenSummary.classList.remove('hidden');
    DOM.stickyBarScreen4.classList.remove('hidden');
    DOM.btnHeaderBack.classList.remove('hidden');
    DOM.btnResetApp.classList.remove('hidden');
    DOM.headerSubtitle.textContent = 'Langkah 3 dari 3: Rincian & Bagikan';
    renderSummaryScreen();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleHeaderBack() {
  if (state.currentScreen === 'review') {
    navigateTo('home');
  } else if (state.currentScreen === 'assignment') {
    navigateTo('review');
  } else if (state.currentScreen === 'summary') {
    navigateTo('assignment');
  }
}

// -------------------------------------------------------------
// Load Presets & OCR Handling
// -------------------------------------------------------------
function loadPreset(presetKey) {
  const preset = PRESET_RECEIPTS[presetKey];
  if (!preset) return;

  state.merchant = preset.merchant;
  state.taxRate = preset.taxRate;
  state.serviceRate = preset.serviceRate;
  state.discount = { ...preset.discount };
  state.rounding = preset.rounding;
  
  // Clone items and clear assignments
  state.items = preset.items.map(it => ({
    ...it,
    assignments: []
  }));

  // Auto assign for padang preset to match PRD table exactly if in assignment step
  if (presetKey === 'padang') {
    state.items[0].assignments = ['p-1']; // Ayam Bakar -> Arief
    state.items[1].assignments = ['p-2']; // Nasi Goreng -> Budi
    state.items[2].assignments = ['p-2']; // Es Teh -> Budi
    state.items[3].assignments = ['p-3']; // Sate Ayam -> Citra
    state.items[4].assignments = ['p-3']; // Es Jeruk -> Citra
    state.items[5].assignments = ['p-1', 'p-4']; // Kentang Goreng -> Arief & Dina
    state.items[6].assignments = ['p-4']; // Air Mineral -> Dina
  }

  showToast(`Struk ${preset.merchant} dimuat!`, 'check_circle');
  navigateTo('review');
}

async function handleReceiptUpload(file) {
  if (!file) return;

  // Show modal
  DOM.modalOcrProgress.classList.remove('hidden');
  DOM.barOcrProgress.style.width = '15%';
  DOM.txtOcrStatus.textContent = 'Mempersiapkan OCR di browser...';

  try {
    let result = null;
    if (window.Tesseract) {
      result = await runOcrOnFile(file, progress => {
        DOM.barOcrProgress.style.width = `${progress}%`;
        DOM.txtOcrStatus.textContent = `Memproses teks struk: ${progress}%`;
      });
    } else {
      // Fallback simulation if Tesseract script didn't load (offline)
      await new Promise(r => setTimeout(r, 1200));
      result = PRESET_RECEIPTS.padang;
    }

    DOM.modalOcrProgress.classList.add('hidden');

    if (result && result.items && result.items.length > 0) {
      state.merchant = result.merchant || 'Restoran / Kafe';
      state.taxRate = result.taxRate ?? 11;
      state.serviceRate = result.serviceRate ?? 0;
      state.items = result.items.map(it => ({
        ...it,
        assignments: []
      }));
      showToast(`${state.items.length} menu berhasil dideteksi!`, 'verified');
    } else {
      showToast('OCR tidak mendeteksi teks dengan jelas. Beralih ke input manual.', 'info', 4000);
      state.merchant = 'Restoran / Kafe';
      state.items = [
        { id: `item-${Date.now()}-1`, name: 'Menu 1', price: 25000, qty: 1, assignments: [], lowConfidence: true }
      ];
    }

    navigateTo('review');
  } catch (err) {
    console.error('OCR Error:', err);
    DOM.modalOcrProgress.classList.add('hidden');
    showToast('Gagal memproses struk otomatis. Menggunakan input manual.', 'warning', 4000);
    state.merchant = 'Restoran / Kafe';
    state.items = [
      { id: `item-${Date.now()}-1`, name: 'Menu 1', price: 25000, qty: 1, assignments: [], lowConfidence: true }
    ];
    navigateTo('review');
  }
}

// -------------------------------------------------------------
// SCREEN 2: OCR REVIEW & ITEM EDITOR
// -------------------------------------------------------------
function renderReviewScreen() {
  DOM.displayMerchantName.textContent = state.merchant;
  DOM.displayItemCountBadge.textContent = `${state.items.length} Menu Terbaca`;
  DOM.badgeMenuCount.textContent = `${state.items.length} Jenis`;

  DOM.reviewItemList.innerHTML = '';

  let totalDraft = 0;

  if (state.items.length === 0) {
    DOM.reviewItemList.innerHTML = `
      <div class="text-center py-10 px-4 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant/50">
        <span class="material-symbols-outlined text-outline text-4xl mb-2">receipt</span>
        <p class="text-xs text-on-surface font-bold">Belum ada menu yang tercatat</p>
        <p class="text-[11px] text-on-surface-variant mt-1">Tap tombol Tambah Menu untuk mulai mengisi tagihan</p>
      </div>
    `;
  }

  state.items.forEach(item => {
    const itemSubtotal = (item.price || 0) * (item.qty || 1);
    totalDraft += itemSubtotal;

    const card = document.createElement('div');
    card.className = `bg-surface-container-lowest rounded-xl p-3 border transition-all shadow-xs interactive-card ${
      item.lowConfidence ? 'border-amber-300 dark:border-amber-700/80 bg-amber-50/20' : 'border-outline-variant/30 hover:border-outline-variant'
    }`;

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <h4 class="text-sm font-bold text-on-surface truncate cursor-pointer hover:text-primary transition-colors btn-edit-item" data-id="${item.id}" title="Klik untuk edit nama">${item.name}</h4>
            ${
              item.lowConfidence
                ? `<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200">
                    <span class="material-symbols-outlined text-[12px] mr-0.5">warning</span>
                    Perlu Dicek
                   </span>`
                : `<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/10 text-primary">
                    <span class="material-symbols-outlined text-[12px] mr-0.5 material-symbols-fill">check_circle</span>
                    Cocok
                   </span>`
            }
          </div>
          <p class="text-xs text-on-surface-variant mt-0.5 cursor-pointer hover:text-primary transition-colors btn-edit-item" data-id="${item.id}" title="Klik untuk edit harga">
            ${formatRupiah(item.price)} / porsi
          </p>
        </div>
        <div class="text-right shrink-0">
          <div class="text-sm font-extrabold text-on-surface">${formatRupiah(itemSubtotal)}</div>
          <span class="text-[10px] text-outline">Subtotal</span>
        </div>
      </div>

      <!-- Controls: Qty and Actions -->
      <div class="mt-2.5 pt-2 border-t border-surface-container flex items-center justify-between">
        <div class="flex items-center bg-surface-container rounded-lg p-0.5">
          <button type="button" class="btn-dec-qty w-7 h-7 rounded flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant active:scale-90 transition-transform" data-id="${item.id}" title="Kurangi">
            <span class="material-symbols-outlined text-sm">remove</span>
          </button>
          <span class="w-8 text-center text-xs font-bold text-on-surface">${item.qty}</span>
          <button type="button" class="btn-inc-qty w-7 h-7 rounded flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant active:scale-90 transition-transform" data-id="${item.id}" title="Tambah">
            <span class="material-symbols-outlined text-sm">add</span>
          </button>
        </div>

        <div class="flex items-center gap-1">
          <button type="button" class="btn-edit-item px-2 py-1 rounded-lg text-xs font-semibold text-outline hover:text-primary hover:bg-surface-container transition-colors flex items-center gap-0.5" title="Edit Menu" data-id="${item.id}">
            <span class="material-symbols-outlined text-base">edit</span>
            <span>Edit</span>
          </button>
          <button type="button" class="btn-del-item w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-error hover:bg-error-container/20 transition-colors" title="Hapus Menu" data-id="${item.id}">
            <span class="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>
    `;

    DOM.reviewItemList.appendChild(card);
  });

  DOM.txtStickySubtotal2.textContent = formatRupiah(totalDraft);
}

function handleItemQtyChange(itemId, delta) {
  const item = state.items.find(it => it.id === itemId);
  if (!item) return;
  const newQty = (item.qty || 1) + delta;
  if (newQty < 1) {
    handleDeleteItem(itemId);
    return;
  }
  item.qty = newQty;
  renderReviewScreen();
}

function handleDeleteItem(itemId) {
  const idx = state.items.findIndex(it => it.id === itemId);
  if (idx !== -1) {
    const deleted = state.items.splice(idx, 1)[0];
    renderReviewScreen();
    showToast(`"${deleted.name}" dihapus`, 'delete');
  }
}

function openItemModal(item = null) {
  if (item) {
    DOM.modalItemTitle.textContent = 'Edit Menu';
    DOM.inputEditItemId.value = item.id;
    DOM.inputItemName.value = item.name;
    DOM.inputItemPrice.value = item.price;
    DOM.inputItemQty.value = item.qty || 1;
    DOM.inputItemLowConf.checked = !!item.lowConfidence;
  } else {
    DOM.modalItemTitle.textContent = 'Tambah Menu Baru';
    DOM.inputEditItemId.value = '';
    DOM.inputItemName.value = '';
    DOM.inputItemPrice.value = '';
    DOM.inputItemQty.value = 1;
    DOM.inputItemLowConf.checked = false;
  }
  DOM.modalEditItem.classList.remove('hidden');
  DOM.inputItemName.focus();
}

function saveItemForm(e) {
  e.preventDefault();
  const id = DOM.inputEditItemId.value;
  const name = DOM.inputItemName.value.trim();
  const price = parseInt(DOM.inputItemPrice.value, 10) || 0;
  const qty = parseInt(DOM.inputItemQty.value, 10) || 1;
  const lowConfidence = DOM.inputItemLowConf.checked;

  if (!name) return;

  if (id) {
    const item = state.items.find(it => it.id === id);
    if (item) {
      item.name = name;
      item.price = price;
      item.qty = qty;
      item.lowConfidence = lowConfidence;
    }
  } else {
    state.items.push({
      id: `item-${Date.now()}`,
      name,
      price,
      qty,
      lowConfidence,
      assignments: []
    });
  }

  DOM.modalEditItem.classList.add('hidden');
  renderReviewScreen();
  showToast('Menu berhasil disimpan!', 'check_circle');
}

// -------------------------------------------------------------
// SCREEN 3: ASSIGNMENT & CHARGES
// -------------------------------------------------------------
function renderAssignmentScreen() {
  const calc = calculateSplit(state);
  const pMap = {};
  if (calc.participantsSummary) {
    calc.participantsSummary.forEach(p => { pMap[p.id] = p; });
  }

  // 1. Participant Chips with Live Balances
  DOM.txtParticipantCount.textContent = `Daftar Peserta (${state.participants.length} Orang)`;
  DOM.participantChipsList.innerHTML = '';

  state.participants.forEach(p => {
    const col = AVATAR_COLORS[p.color] || AVATAR_COLORS.emerald;
    const initial = (p.name || 'P').charAt(0).toUpperCase();
    const pSummary = pMap[p.id];
    const liveTotal = pSummary ? pSummary.finalTotal : 0;

    const chip = document.createElement('div');
    chip.className = `flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full ${col.bg} border ${col.border} shadow-xs transition-all active:scale-95 cursor-pointer avatar-chip`;
    chip.innerHTML = `
      <span class="w-5 h-5 rounded-full ${col.dot} text-white text-[10px] flex items-center justify-center font-bold">${initial}</span>
      <div class="flex flex-col text-left">
        <span class="text-xs font-bold ${col.text} leading-tight">${p.name}</span>
        <span class="text-[9px] font-bold text-on-surface-variant tabular-nums">${formatRupiah(liveTotal)}</span>
      </div>
      <button type="button" class="btn-del-participant text-outline hover:text-error ml-1 text-xs" data-id="${p.id}" title="Hapus ${p.name}">
        <span class="material-symbols-outlined text-[14px]">close</span>
      </button>
    `;

    // Click chip to edit name
    chip.addEventListener('click', (e) => {
      if (e.target.closest('.btn-del-participant')) return;
      const newName = prompt(`Ubah nama "${p.name}":`, p.name);
      if (newName && newName.trim() && newName.trim() !== p.name) {
        p.name = newName.trim();
        renderAssignmentScreen();
        showToast('Nama peserta diperbarui', 'edit');
      }
    });

    DOM.participantChipsList.appendChild(chip);
  });

  // Add friend button
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-full border border-dashed border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary hover:text-primary transition-all active:scale-95 text-xs font-bold';
  addBtn.innerHTML = `
    <span class="material-symbols-outlined text-base">person_add</span>
    <span>+ Teman</span>
  `;
  addBtn.addEventListener('click', () => openParticipantModal());
  DOM.participantChipsList.appendChild(addBtn);

  // 2. Status & Unassigned Guard (PRD 6.3.3)
  const totalItems = state.items.length;
  const assignedItems = state.items.filter(it => it.assignments && it.assignments.length > 0);
  const unassignedList = state.items.filter(it => !it.assignments || it.assignments.length === 0);

  const pct = totalItems > 0 ? Math.round((assignedItems.length / totalItems) * 100) : 0;
  DOM.txtAssignmentStatusCount.textContent = `${assignedItems.length} dari ${totalItems} menu sudah dibagi`;
  DOM.barAssignmentProgress.style.width = `${pct}%`;

  if (unassignedList.length > 0) {
    DOM.boxUnassignedWarning.classList.remove('hidden');
    DOM.txtUnassignedMessage.textContent = `${unassignedList.length} menu belum dibagi: ${unassignedList[0].name}${unassignedList.length > 1 ? ', dll.' : ''}`;
    DOM.iconAssignmentStatus.className = 'material-symbols-outlined text-amber-600 text-base material-symbols-fill';
    DOM.iconAssignmentStatus.textContent = 'pending';
    DOM.btnProceedToSummary.disabled = true;
    DOM.btnProceedToSummary.classList.add('opacity-50', 'cursor-not-allowed');
  } else {
    DOM.boxUnassignedWarning.classList.add('hidden');
    DOM.iconAssignmentStatus.className = 'material-symbols-outlined text-primary text-base material-symbols-fill';
    DOM.iconAssignmentStatus.textContent = 'check_circle';
    DOM.btnProceedToSummary.disabled = false;
    DOM.btnProceedToSummary.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  // 3. Item Assignment Cards
  DOM.assignmentItemsList.innerHTML = '';

  state.items.forEach(item => {
    const itemTotal = (item.price || 0) * (item.qty || 1);
    const card = document.createElement('div');
    const isAssigned = item.assignments && item.assignments.length > 0;
    
    card.className = `bg-surface-container-lowest p-3.5 rounded-2xl border transition-all shadow-xs interactive-card ${
      !isAssigned ? 'border-amber-300 dark:border-amber-700/80 bg-amber-50/15' : 'border-outline-variant/30 hover:border-outline-variant'
    }`;

    // Format assigned names text
    let assignedNamesStr = '⚠️ Belum ditentukan';
    if (isAssigned) {
      if (item.assignments.length === state.participants.length) {
        assignedNamesStr = 'Dibagi rata semua orang';
      } else {
        const names = item.assignments.map(assign => {
          const pId = typeof assign === 'object' ? assign.participantId : assign;
          const p = state.participants.find(x => x.id === pId);
          if (!p) return '';
          if (typeof assign === 'object' && assign.qty) {
            return `${p.name} (${assign.qty}x)`;
          }
          return p.name;
        }).filter(Boolean);
        assignedNamesStr = names.join(', ');
      }
    }

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold text-outline">${item.qty}x</span>
            <h4 class="text-sm font-bold text-on-surface">${item.name}</h4>
          </div>
          <p class="text-xs text-on-surface-variant mt-0.5">
            ${formatRupiah(item.price)} / porsi
          </p>
        </div>
        <div class="text-right">
          <span class="text-sm font-extrabold text-on-surface">${formatRupiah(itemTotal)}</span>
          ${item.qty > 1 ? `
            <button type="button" class="btn-open-qty-split block text-[10px] text-primary font-bold hover:underline mt-0.5 ml-auto" data-id="${item.id}">
              Bagi per porsi (${item.qty}x)
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Quick Assignment Participant Avatars -->
      <div class="mt-3 pt-2 border-t border-surface-container">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[10px] text-outline font-semibold">Tanggung renteng:</span>
          <span class="text-[10px] text-on-surface-variant font-medium truncate max-w-[200px] text-right">${assignedNamesStr}</span>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          ${state.participants.map(p => {
            const col = AVATAR_COLORS[p.color] || AVATAR_COLORS.emerald;
            const isSelected = item.assignments && item.assignments.some(a => (typeof a === 'object' ? a.participantId === p.id : a === p.id));
            const initial = p.name.charAt(0).toUpperCase();

            return `
              <button type="button" class="btn-toggle-assignment flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                isSelected
                  ? `${col.bg} ${col.border} ${col.text} ring-1 ring-primary/40`
                  : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:border-outline'
              }" data-item-id="${item.id}" data-p-id="${p.id}" title="Pilih ${p.name}">
                <span class="w-4 h-4 rounded-full ${isSelected ? col.dot : 'bg-outline'} text-white text-[9px] flex items-center justify-center font-bold">${initial}</span>
                <span>${p.name}</span>
              </button>
            `;
          }).join('')}

          <button type="button" class="btn-assign-everyone px-2.5 py-1 rounded-full text-[11px] font-bold border border-dashed border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-primary hover:text-primary transition-all active:scale-95" data-item-id="${item.id}" title="Bagi rata ke semua peserta">
            Semua
          </button>
        </div>
      </div>
    `;

    DOM.assignmentItemsList.appendChild(card);
  });

  // 4. Update Summary Charges Preview & Live Total
  updateChargesPreview();
}

function toggleItemAssignment(itemId, participantId) {
  const item = state.items.find(it => it.id === itemId);
  if (!item) return;

  if (!item.assignments) item.assignments = [];

  // If assignment is object-based, normalize to string IDs on simple toggle
  if (typeof item.assignments[0] === 'object') {
    item.assignments = item.assignments.map(a => a.participantId);
  }

  const idx = item.assignments.indexOf(participantId);
  if (idx !== -1) {
    item.assignments.splice(idx, 1);
  } else {
    item.assignments.push(participantId);
  }

  renderAssignmentScreen();
}

function assignItemToEveryone(itemId) {
  const item = state.items.find(it => it.id === itemId);
  if (!item) return;

  // If already assigned to everyone, clear; otherwise assign to everyone
  if (item.assignments && item.assignments.length === state.participants.length) {
    item.assignments = [];
  } else {
    item.assignments = state.participants.map(p => p.id);
  }

  renderAssignmentScreen();
}

function updateChargesPreview() {
  DOM.labelTaxValue.textContent = `${state.taxRate}%`;
  DOM.labelServiceValue.textContent = `${state.serviceRate}%`;
  DOM.txtSummaryChargesPreview.textContent = `PPN ${state.taxRate}% • Service ${state.serviceRate}% • Bulat ${state.rounding > 0 ? formatRupiah(state.rounding) : 'Tanpa Bulat'}`;

  // Update preset active classes
  document.querySelectorAll('.btn-tax-preset').forEach(btn => {
    const val = parseInt(btn.dataset.val, 10);
    if (val === state.taxRate) {
      btn.className = 'btn-tax-preset flex-1 py-1 rounded-lg border border-primary bg-primary/10 text-primary text-xs font-bold active:scale-95';
    } else {
      btn.className = 'btn-tax-preset flex-1 py-1 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-xs font-bold hover:border-primary active:scale-95';
    }
  });

  document.querySelectorAll('.btn-svc-preset').forEach(btn => {
    const val = parseInt(btn.dataset.val, 10);
    if (val === state.serviceRate) {
      btn.className = 'btn-svc-preset flex-1 py-1 rounded-lg border border-primary bg-primary/10 text-primary text-xs font-bold active:scale-95';
    } else {
      btn.className = 'btn-svc-preset flex-1 py-1 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-xs font-bold hover:border-primary active:scale-95';
    }
  });

  document.querySelectorAll('.btn-rounding-preset').forEach(btn => {
    const val = parseInt(btn.dataset.val, 10);
    if (val === state.rounding) {
      btn.className = 'btn-rounding-preset py-1.5 px-1 rounded-lg border border-primary bg-primary/10 text-primary text-[11px] font-bold active:scale-95';
    } else {
      btn.className = 'btn-rounding-preset py-1.5 px-1 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-[11px] font-bold hover:border-primary active:scale-95';
    }
  });

  // Run quick calculation for sticky bar
  const res = calculateSplit(state);
  DOM.txtStickyTotal3.textContent = formatRupiah(res.receiptGrandTotal);
}

// -------------------------------------------------------------
// Participant Modal (Add & Delete)
// -------------------------------------------------------------
function openParticipantModal() {
  DOM.inputParticipantId.value = '';
  DOM.inputParticipantName.value = '';
  DOM.modalParticipant.classList.remove('hidden');
  DOM.inputParticipantName.focus();
}

function saveParticipantForm(e) {
  e.preventDefault();
  const name = DOM.inputParticipantName.value.trim();
  const color = document.querySelector('input[name="pcolor"]:checked')?.value || 'emerald';

  if (!name) return;

  const newId = `p-${Date.now()}`;
  state.participants.push({ id: newId, name, color });

  DOM.modalParticipant.classList.add('hidden');
  renderAssignmentScreen();
  showToast(`Peserta "${name}" ditambahkan!`, 'person_add');
}

function deleteParticipant(participantId) {
  // Guard: minimum 2 participants (PRD 6.2.2 & Edge cases)
  if (state.participants.length <= 2) {
    showToast('Minimal 2 orang peserta diperlukan untuk patungan!', 'warning');
    return;
  }

  const p = state.participants.find(x => x.id === participantId);
  const name = p ? p.name : 'Peserta';

  state.participants = state.participants.filter(x => x.id !== participantId);

  // Remove participant from item assignments
  state.items.forEach(it => {
    if (it.assignments) {
      it.assignments = it.assignments.filter(a => {
        if (typeof a === 'object') return a.participantId !== participantId;
        return a !== participantId;
      });
    }
  });

  renderAssignmentScreen();
  showToast(`"${name}" dihapus`, 'delete');
}

// -------------------------------------------------------------
// Split by Quantity Modal (PRD 6.3.2)
// -------------------------------------------------------------
function openQtySplitModal(itemId) {
  const item = state.items.find(it => it.id === itemId);
  if (!item) return;

  state.qtySplitTargetItemId = itemId;
  DOM.txtQtySplitItemName.textContent = `Bagi Porsi: ${item.name}`;
  DOM.txtQtySplitSubtitle.textContent = `Total ${item.qty} porsi • Harga satuan ${formatRupiah(item.price)}`;

  DOM.qtySplitParticipantsContainer.innerHTML = '';

  // Get current qty per participant if already assigned
  const currentAlloc = {};
  if (item.assignments && typeof item.assignments[0] === 'object') {
    item.assignments.forEach(a => {
      currentAlloc[a.participantId] = a.qty;
    });
  }

  state.participants.forEach(p => {
    const val = currentAlloc[p.id] || 0;
    const col = AVATAR_COLORS[p.color] || AVATAR_COLORS.emerald;
    const initial = p.name.charAt(0).toUpperCase();

    const row = document.createElement('div');
    row.className = 'flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30';
    row.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-6 h-6 rounded-full ${col.dot} text-white text-[11px] flex items-center justify-center font-bold">${initial}</span>
        <span class="text-xs font-bold text-on-surface">${p.name}</span>
      </div>
      <div class="flex items-center bg-surface-container rounded-lg p-0.5">
        <button type="button" class="btn-qty-split-dec w-7 h-7 rounded flex items-center justify-center text-on-surface-variant active:scale-90" data-p-id="${p.id}">
          <span class="material-symbols-outlined text-sm">remove</span>
        </button>
        <span class="w-8 text-center text-xs font-bold text-on-surface qty-split-val" id="qty-val-${p.id}">${val}</span>
        <button type="button" class="btn-qty-split-inc w-7 h-7 rounded flex items-center justify-center text-on-surface-variant active:scale-90" data-p-id="${p.id}">
          <span class="material-symbols-outlined text-sm">add</span>
        </button>
      </div>
    `;
    DOM.qtySplitParticipantsContainer.appendChild(row);
  });

  updateQtyAllocStatus();
  DOM.modalQtySplit.classList.remove('hidden');
}

function updateQtyAllocStatus() {
  const item = state.items.find(it => it.id === state.qtySplitTargetItemId);
  if (!item) return;

  let allocated = 0;
  state.participants.forEach(p => {
    const el = document.getElementById(`qty-val-${p.id}`);
    if (el) allocated += parseInt(el.textContent, 10) || 0;
  });

  DOM.txtQtyAllocatedStatus.textContent = `${allocated} / ${item.qty} Porsi`;
  if (allocated === item.qty) {
    DOM.txtQtyAllocatedStatus.className = 'font-extrabold text-primary';
  } else {
    DOM.txtQtyAllocatedStatus.className = 'font-extrabold text-amber-600';
  }
}

function saveQtySplit() {
  const item = state.items.find(it => it.id === state.qtySplitTargetItemId);
  if (!item) return;

  const assignments = [];
  state.participants.forEach(p => {
    const el = document.getElementById(`qty-val-${p.id}`);
    const q = parseInt(el?.textContent, 10) || 0;
    if (q > 0) {
      assignments.push({ participantId: p.id, qty: q });
    }
  });

  if (assignments.length === 0) {
    showToast('Pilih minimal 1 porsi untuk peserta!', 'warning');
    return;
  }

  item.assignments = assignments;
  DOM.modalQtySplit.classList.add('hidden');
  renderAssignmentScreen();
  showToast('Alokasi porsi berhasil disimpan!', 'check_circle');
}

// -------------------------------------------------------------
// SCREEN 4: SUMMARY & WHATSAPP SHARING
// -------------------------------------------------------------
function renderSummaryScreen() {
  const calc = calculateSplit(state);

  // Update Merchant & Grand Total
  DOM.summaryMerchantName.textContent = state.merchant;
  DOM.summaryParticipantCountBadge.textContent = `${state.participants.length} Orang Terlibat`;
  DOM.txtSummaryGrandTotal.textContent = formatRupiah(calc.receiptGrandTotal);
  DOM.txtSummarySubtotal.textContent = formatRupiah(calc.subtotal);
  DOM.lblSummaryTax.textContent = `PPN (${state.taxRate}%):`;
  DOM.txtSummaryTax.textContent = formatRupiah(calc.totalTax);
  DOM.lblSummaryService.textContent = `Service (${state.serviceRate}%):`;
  DOM.txtSummaryService.textContent = formatRupiah(calc.totalService);
  DOM.txtSummaryRounding.textContent = state.rounding > 0 ? `${formatRupiah(state.rounding)} Presisi` : 'Tanpa Pembulatan';

  if (calc.totalDiscount > 0) {
    DOM.rowSummaryDiscount.classList.remove('hidden');
    DOM.txtSummaryDiscount.textContent = `-${formatRupiah(calc.totalDiscount)}`;
  } else {
    DOM.rowSummaryDiscount.classList.add('hidden');
  }

  // Update Payment Status Tracker
  updatePaymentProgress();

  // Render Participants Breakdown Accordion Stack
  DOM.summaryParticipantsList.innerHTML = '';

  calc.participantsSummary.forEach(p => {
    const col = AVATAR_COLORS[p.color] || AVATAR_COLORS.emerald;
    const initial = p.name.charAt(0).toUpperCase();
    const isPaid = !!state.paidStatus[p.id];

    const details = document.createElement('details');
    details.className = 'participant-details-card group bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden transition-all duration-200 open:shadow-md';

    const hasRoundingDiff = p.adjustment !== 0;
    const isRounded = p.roundedTotal !== p.unroundedTotal;

    details.innerHTML = `
      <summary class="list-none p-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-surface-container-low transition-colors">
        <div class="flex items-center gap-2.5">
          <!-- Paid Checkbox -->
          <button type="button" class="btn-toggle-paid w-6 h-6 rounded-lg border ${isPaid ? 'bg-primary border-primary text-white' : 'border-outline-variant bg-surface'} flex items-center justify-center transition-all active:scale-90" data-id="${p.id}" title="${isPaid ? 'Tandai belum bayar' : 'Tandai sudah bayar'}">
            ${isPaid ? '<span class="material-symbols-outlined text-sm font-bold">check</span>' : ''}
          </button>

          <div class="w-9 h-9 rounded-full ${col.bg} ${col.text} flex items-center justify-center font-bold text-xs shrink-0 border ${col.border}">
            ${initial}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-bold ${isPaid ? 'line-through opacity-70 text-on-surface-variant' : 'text-on-surface'}">${p.name}</span>
              ${isPaid ? '<span class="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold rounded-full">Lunas</span>' : ''}
              <span class="text-[10px] px-2 py-0.2 bg-surface-container text-on-surface-variant rounded-full font-semibold">
                ${p.items.length} menu
              </span>
            </div>
            <span class="text-[10px] text-on-surface-variant">
              ${hasRoundingDiff ? `Sisa bulat: ${p.adjustment > 0 ? '+' : ''}${formatRupiah(p.adjustment)}` : (isRounded ? 'Dibulatkan presisi' : 'Sesuai pesanan')}
            </span>
          </div>
        </div>

        <div class="text-right flex items-center gap-2">
          <div>
            <div class="text-sm font-extrabold ${isPaid ? 'text-primary' : 'text-on-surface'}">${formatRupiah(p.finalTotal)}</div>
            ${isRounded ? `<div class="text-[10px] text-outline line-through">${formatRupiah(p.unroundedTotal)}</div>` : ''}
          </div>
          <span class="material-symbols-outlined text-outline transition-transform duration-200 group-open:rotate-180 text-lg">expand_more</span>
        </div>
      </summary>

      <!-- Collapsible Detailed Item Breakdown -->
      <div class="px-3.5 pb-3 pt-2 bg-surface-container-low/40 border-t border-dashed border-outline-variant/40 space-y-2 text-xs">
        <div class="font-bold text-[11px] text-on-surface-variant">Rincian Menu:</div>
        
        <div class="space-y-1">
          ${p.items.map(it => `
            <div class="flex justify-between items-center text-[11px]">
              <span class="text-on-surface truncate flex-1 pr-2">
                ${it.name} <span class="text-[10px] text-outline">(${it.shareDescription})</span>
              </span>
              <span class="font-semibold text-on-surface shrink-0">${formatRupiah(it.portionCost)}</span>
            </div>
          `).join('')}
        </div>

        <div class="pt-2 border-t border-dashed border-outline-variant/40 space-y-1 text-[11px]">
          <div class="flex justify-between items-center text-on-surface-variant">
            <span>Subtotal Menu:</span>
            <span class="font-bold text-on-surface">${formatRupiah(p.subtotal)}</span>
          </div>
          ${p.tax > 0 ? `
            <div class="flex justify-between items-center text-on-surface-variant">
              <span>Pajak PPN (${state.taxRate}% Proporsional):</span>
              <span class="font-semibold text-on-surface">${formatRupiah(p.tax)}</span>
            </div>
          ` : ''}
          ${p.service > 0 ? `
            <div class="flex justify-between items-center text-on-surface-variant">
              <span>Service (${state.serviceRate}% Proporsional):</span>
              <span class="font-semibold text-on-surface">${formatRupiah(p.service)}</span>
            </div>
          ` : ''}
          ${p.discount > 0 ? `
            <div class="flex justify-between items-center text-emerald-600">
              <span>Diskon (${state.discount.mode === 'equal' ? 'Bagi Rata' : 'Proporsional'}):</span>
              <span class="font-bold">-${formatRupiah(p.discount)}</span>
            </div>
          ` : ''}
          ${hasRoundingDiff ? `
            <div class="flex justify-between items-center text-amber-700 dark:text-amber-300">
              <span>Penyesuaian Pembulatan (Sisa Terbesar):</span>
              <span class="font-bold">${p.adjustment > 0 ? '+' : ''}${formatRupiah(p.adjustment)}</span>
            </div>
          ` : ''}
          <div class="flex justify-between items-center pt-1 font-extrabold text-xs text-on-surface border-t border-surface-container">
            <span>Total Ditagih:</span>
            <span class="text-primary">${formatRupiah(p.finalTotal)}</span>
          </div>
        </div>
      </div>
    `;

    DOM.summaryParticipantsList.appendChild(details);
  });

  // Pre-fill payment note and update live WhatsApp preview
  DOM.inputPaymentNote.value = state.paymentNote;
  updateWhatsAppPreview();

  // Configure Read-only Banner vs Creator Tools
  if (state.isReadOnly) {
    DOM.bannerReadOnlyNotice.classList.remove('hidden');
    DOM.btnModeReceiver.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs text-center transition-all bg-surface-container-lowest text-primary font-bold shadow-xs';
    DOM.btnModeCreator.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs text-on-surface-variant text-center transition-all hover:text-on-surface';
  } else {
    DOM.bannerReadOnlyNotice.classList.add('hidden');
    DOM.btnModeCreator.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs text-center transition-all bg-surface-container-lowest text-primary font-bold shadow-xs';
    DOM.btnModeReceiver.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs text-on-surface-variant text-center transition-all hover:text-on-surface';
  }
}

function updatePaymentProgress() {
  const total = state.participants.length;
  const paidCount = state.participants.filter(p => !!state.paidStatus[p.id]).length;
  DOM.txtPaidProgress.textContent = `${paidCount} dari ${total} orang lunas (${Math.round((paidCount / total) * 100)}%)`;
}

function updateWhatsAppPreview() {
  const calc = calculateSplit(state);
  const shareUrl = generateShareUrl(state);
  const msg = formatWhatsAppMessage(state, calc, shareUrl);
  if (DOM.txtWaPreview) {
    DOM.txtWaPreview.textContent = msg;
  }
}

function handleShareWhatsApp() {
  state.paymentNote = DOM.inputPaymentNote.value.trim();
  const calc = calculateSplit(state);
  const shareUrl = generateShareUrl(state);
  const msg = formatWhatsAppMessage(state, calc, shareUrl);

  const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
}

async function handleCopyShareLink() {
  state.paymentNote = DOM.inputPaymentNote.value.trim();
  const shareUrl = generateShareUrl(state);
  const ok = await copyToClipboard(shareUrl);
  if (ok) {
    showToast('Link berhasil disalin! Siap dibagikan ke teman.', 'link');
  } else {
    showToast('Gagal menyalin link otomatis.', 'warning');
  }
}

async function handleCopyTextSummary() {
  state.paymentNote = DOM.inputPaymentNote.value.trim();
  const calc = calculateSplit(state);
  const shareUrl = generateShareUrl(state);
  const msg = formatWhatsAppMessage(state, calc, shareUrl);
  const ok = await copyToClipboard(msg);
  if (ok) {
    showToast('Rincian teks tersalin ke clipboard!', 'content_copy');
  } else {
    showToast('Gagal menyalin teks.', 'warning');
  }
}

function handleDuplicateAndEdit() {
  state.isReadOnly = false;
  navigateTo('assignment');
  showToast('Tagihan siap diedit!', 'edit');
}

// -------------------------------------------------------------
// Initialization & Event Listeners
// -------------------------------------------------------------
function setupEventListeners() {
  // Theme Toggle Button
  DOM.btnThemeToggle.addEventListener('click', toggleTheme);

  // Stepper Tabs Navigation
  document.querySelectorAll('.stepper-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;
      navigateTo(target);
    });
  });

  // Header Back, Reset & Brand Logo
  DOM.btnHeaderBack.addEventListener('click', handleHeaderBack);
  DOM.brandLogo.addEventListener('click', () => navigateTo('home'));
  DOM.btnResetApp.addEventListener('click', () => {
    if (confirm('Mulai ulang dari awal? Semua input akan direset.')) {
      state.items = [];
      state.paidStatus = {};
      navigateTo('home');
      showToast('Aplikasi direset', 'refresh');
    }
  });

  // Screen 1: Home triggers
  DOM.cardOcrTrigger.addEventListener('click', () => DOM.fileReceiptInput.click());
  DOM.btnTriggerCamera.addEventListener('click', e => {
    e.stopPropagation();
    DOM.fileReceiptInput.click();
  });
  DOM.fileReceiptInput.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) handleReceiptUpload(file);
  });

  DOM.cardManualInput.addEventListener('click', () => {
    state.merchant = 'Restoran / Kafe';
    state.items = [
      { id: `item-${Date.now()}-1`, name: 'Menu 1', price: 30000, qty: 1, assignments: [], lowConfidence: false }
    ];
    navigateTo('review');
  });

  DOM.btnPresetPadang.addEventListener('click', () => loadPreset('padang'));
  DOM.btnPresetCafe.addEventListener('click', () => loadPreset('cafe'));

  // Cancel OCR
  DOM.btnCancelOcr.addEventListener('click', () => {
    DOM.modalOcrProgress.classList.add('hidden');
    state.merchant = 'Restoran / Kafe';
    state.items = [
      { id: `item-${Date.now()}-1`, name: 'Menu 1', price: 25000, qty: 1, assignments: [], lowConfidence: true }
    ];
    navigateTo('review');
  });

  // Screen 2: Review Item List Clicks
  DOM.reviewItemList.addEventListener('click', e => {
    const decBtn = e.target.closest('.btn-dec-qty');
    if (decBtn) {
      handleItemQtyChange(decBtn.dataset.id, -1);
      return;
    }
    const incBtn = e.target.closest('.btn-inc-qty');
    if (incBtn) {
      handleItemQtyChange(incBtn.dataset.id, 1);
      return;
    }
    const editBtn = e.target.closest('.btn-edit-item');
    if (editBtn) {
      const item = state.items.find(it => it.id === editBtn.dataset.id);
      if (item) openItemModal(item);
      return;
    }
    const delBtn = e.target.closest('.btn-del-item');
    if (delBtn) {
      handleDeleteItem(delBtn.dataset.id);
      return;
    }
  });

  DOM.btnAddNewItem.addEventListener('click', () => openItemModal(null));
  DOM.btnEditMerchant.addEventListener('click', () => {
    const newName = prompt('Ubah Nama Restoran / Kafe:', state.merchant);
    if (newName && newName.trim()) {
      state.merchant = newName.trim();
      renderReviewScreen();
    }
  });

  DOM.btnProceedToAssignment.addEventListener('click', () => {
    if (state.items.length === 0) {
      showToast('Tambahkan minimal 1 menu sebelum lanjut!', 'warning');
      return;
    }
    navigateTo('assignment');
  });

  // Screen 3: Assignment & Charges
  DOM.btnQuickAssignAll.addEventListener('click', () => {
    state.items.forEach(it => {
      it.assignments = state.participants.map(p => p.id);
    });
    renderAssignmentScreen();
    showToast('Semua menu dibagi rata ke semua orang!', 'check_circle');
  });

  DOM.participantChipsList.addEventListener('click', e => {
    const delBtn = e.target.closest('.btn-del-participant');
    if (delBtn) {
      e.stopPropagation();
      deleteParticipant(delBtn.dataset.id);
    }
  });

  DOM.assignmentItemsList.addEventListener('click', e => {
    const assignBtn = e.target.closest('.btn-toggle-assignment');
    if (assignBtn) {
      toggleItemAssignment(assignBtn.dataset.itemId, assignBtn.dataset.pId);
      return;
    }

    const everyoneBtn = e.target.closest('.btn-assign-everyone');
    if (everyoneBtn) {
      assignItemToEveryone(everyoneBtn.dataset.itemId);
      return;
    }

    const qtySplitBtn = e.target.closest('.btn-open-qty-split');
    if (qtySplitBtn) {
      openQtySplitModal(qtySplitBtn.dataset.id);
      return;
    }
  });

  DOM.btnAssignAllToEveryone.addEventListener('click', () => {
    state.items.forEach(it => {
      if (!it.assignments || it.assignments.length === 0) {
        it.assignments = state.participants.map(p => p.id);
      }
    });
    renderAssignmentScreen();
    showToast('Menu yang belum di-assign berhasil dibagi rata!', 'check_circle');
  });

  // Tax Presets & Custom
  document.querySelectorAll('.btn-tax-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      state.taxRate = parseInt(btn.dataset.val, 10);
      DOM.inputCustomTax.value = '';
      updateChargesPreview();
    });
  });
  DOM.inputCustomTax.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      state.taxRate = val;
      updateChargesPreview();
    }
  });

  // Service Presets & Custom
  document.querySelectorAll('.btn-svc-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      state.serviceRate = parseInt(btn.dataset.val, 10);
      DOM.inputCustomService.value = '';
      updateChargesPreview();
    });
  });
  DOM.inputCustomService.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      state.serviceRate = val;
      updateChargesPreview();
    }
  });

  // Discount Controls
  DOM.btnDiscountPercent.addEventListener('click', () => {
    state.discount.type = 'percent';
    DOM.btnDiscountPercent.className = 'px-2 py-0.5 rounded font-bold bg-surface-container-lowest text-primary shadow-xs';
    DOM.btnDiscountAmount.className = 'px-2 py-0.5 rounded font-bold text-on-surface-variant';
    updateChargesPreview();
  });
  DOM.btnDiscountAmount.addEventListener('click', () => {
    state.discount.type = 'amount';
    DOM.btnDiscountAmount.className = 'px-2 py-0.5 rounded font-bold bg-surface-container-lowest text-primary shadow-xs';
    DOM.btnDiscountPercent.className = 'px-2 py-0.5 rounded font-bold text-on-surface-variant';
    updateChargesPreview();
  });
  DOM.inputDiscountValue.addEventListener('input', e => {
    state.discount.value = parseInt(e.target.value, 10) || 0;
    updateChargesPreview();
  });
  DOM.selectDiscountMode.addEventListener('change', e => {
    state.discount.mode = e.target.value;
    updateChargesPreview();
  });

  // Rounding Presets
  document.querySelectorAll('.btn-rounding-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      state.rounding = parseInt(btn.dataset.val, 10);
      updateChargesPreview();
    });
  });

  DOM.btnProceedToSummary.addEventListener('click', () => {
    const calc = calculateSplit(state);
    if (!calc.isValid) {
      showToast(`Ada ${calc.unassignedItems.length} menu belum dibagi!`, 'warning');
      return;
    }
    navigateTo('summary');
  });

  // Screen 4: Summary Actions
  DOM.summaryParticipantsList.addEventListener('click', e => {
    const togglePaidBtn = e.target.closest('.btn-toggle-paid');
    if (togglePaidBtn) {
      e.preventDefault();
      e.stopPropagation();
      const pId = togglePaidBtn.dataset.id;
      state.paidStatus[pId] = !state.paidStatus[pId];
      renderSummaryScreen();
      showToast(state.paidStatus[pId] ? 'Ditandai sudah lunas!' : 'Ditandai belum lunas', 'task_alt');
    }
  });

  DOM.btnToggleAllAccordions.addEventListener('click', () => {
    const detailsList = document.querySelectorAll('.participant-details-card');
    const anyClosed = Array.from(detailsList).some(d => !d.open);
    detailsList.forEach(d => { d.open = anyClosed; });
    DOM.btnToggleAllAccordions.textContent = anyClosed ? 'Tutup Semua' : 'Buka Semua';
  });

  DOM.inputPaymentNote.addEventListener('input', () => {
    state.paymentNote = DOM.inputPaymentNote.value;
    updateWhatsAppPreview();
  });

  DOM.btnCopyPaymentNote.addEventListener('click', async () => {
    const val = DOM.inputPaymentNote.value.trim();
    if (!val) {
      showToast('Masukkan info rekening dulu', 'warning');
      return;
    }
    const ok = await copyToClipboard(val);
    if (ok) showToast('Info rekening disalin!', 'content_copy');
  });

  DOM.btnShareWhatsApp.addEventListener('click', handleShareWhatsApp);
  DOM.btnStickyShare.addEventListener('click', handleShareWhatsApp);
  DOM.btnCopyShareLink.addEventListener('click', handleCopyShareLink);
  DOM.btnCopyTextSummary.addEventListener('click', handleCopyTextSummary);
  DOM.btnDuplicateAndEdit.addEventListener('click', handleDuplicateAndEdit);
  DOM.btnBackToEditFromSummary.addEventListener('click', () => navigateTo('assignment'));

  DOM.btnModeCreator.addEventListener('click', () => {
    state.isReadOnly = false;
    renderSummaryScreen();
  });
  DOM.btnModeReceiver.addEventListener('click', () => {
    state.isReadOnly = true;
    renderSummaryScreen();
  });

  // Modal Closers
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.modalEditItem.classList.add('hidden');
      DOM.modalParticipant.classList.add('hidden');
      DOM.modalQtySplit.classList.add('hidden');
    });
  });

  // Form Submissions
  DOM.formEditItem.addEventListener('submit', saveItemForm);
  DOM.formParticipant.addEventListener('submit', saveParticipantForm);

  // Qty Split Steppers
  DOM.qtySplitParticipantsContainer.addEventListener('click', e => {
    const incBtn = e.target.closest('.btn-qty-split-inc');
    if (incBtn) {
      const pId = incBtn.dataset.pId;
      const el = document.getElementById(`qty-val-${pId}`);
      if (el) {
        el.textContent = (parseInt(el.textContent, 10) || 0) + 1;
        updateQtyAllocStatus();
      }
      return;
    }
    const decBtn = e.target.closest('.btn-qty-split-dec');
    if (decBtn) {
      const pId = decBtn.dataset.pId;
      const el = document.getElementById(`qty-val-${pId}`);
      if (el) {
        const cur = parseInt(el.textContent, 10) || 0;
        if (cur > 0) el.textContent = cur - 1;
        updateQtyAllocStatus();
      }
      return;
    }
  });

  DOM.btnResetToEqualSplit.addEventListener('click', () => {
    const item = state.items.find(it => it.id === state.qtySplitTargetItemId);
    if (item) {
      item.assignments = state.participants.map(p => p.id);
    }
    DOM.modalQtySplit.classList.add('hidden');
    renderAssignmentScreen();
  });

  DOM.btnSaveQtySplit.addEventListener('click', saveQtySplit);
}

// -------------------------------------------------------------
// Check Initial URL Hash for Share State
// -------------------------------------------------------------
function checkUrlHashState() {
  const hash = window.location.hash || window.location.search;
  if (hash && (hash.includes('data=') || hash.includes('#'))) {
    const loaded = deserializeState(hash);
    if (loaded && loaded.items && loaded.items.length > 0) {
      Object.assign(state, loaded);
      state.isReadOnly = true;
      navigateTo('summary');
      showToast('Data patungan berhasil dimuat dari link!', 'verified');
      return true;
    }
  }
  return false;
}

// -------------------------------------------------------------
// Bootstrap Application
// -------------------------------------------------------------
function initApp() {
  initTheme();
  setupEventListeners();

  const loadedFromUrl = checkUrlHashState();
  if (!loadedFromUrl) {
    navigateTo('home');
  }
}

document.addEventListener('DOMContentLoaded', initApp);
