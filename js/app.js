// ==================== STATE ====================
let state = {
    user: null,
    months: 1,
    tier: 'premium',
    totalPrice: 300,
    paymentMethod: 'cryptopay',
    trafficPkg: null,
    giftTier: 'premium',
    giftMonths: 1,
    currentView: 'main'
};

const tg = window.Telegram?.WebApp || { 
    initDataUnsafe: { user: { id: 0 } },
    MainButton: { show:()=>{}, hide:()=>{}, setText:()=>{}, showProgress:()=>{}, hideProgress:()=>{}, onClick:()=>{} },
    showAlert: alert, showConfirm: (m,cb) => cb(confirm(m)),
    openLink: url => window.open(url,'_blank'), openTelegramLink: url => window.open(url,'_blank'),
    ready: ()=>{}, expand: ()=>{}, close: ()=>{}
};

const BASE_PRICES = { premium: 300, standard: 100 };
const GB_LIMITS = { 1: 100, 3: 350, 6: 800, 12: 2048 };
const GIFT_PRICES = {
    standard: { 1: 150, 3: 400, 6: 700, 12: 1200 },
    premium: { 1: 400, 3: 1050, 6: 1900, 12: 3500 }
};
const GB_LIMITS_GIFT = { 1: 100, 3: 350, 6: 800, 12: 2048 };
const TRAFFIC_PACKAGES = [
    { gb: 50, price: 100 },
    { gb: 100, price: 200 },
    { gb: 300, price: 600 },
    { gb: 500, price: 1000 }
];

// ==================== INIT ====================
async function init() {
    tg.ready();
    tg.expand();
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    try {
        const data = await apiGetUser(tg_id);
        if (data.user) {
            state.user = data.user;
            updateProfileUI();
            updateDurationUI();
            updatePrice();
            updateGiftPrice();
        }
    } catch (err) {
        console.error('Init error:', err);
    }
}

function updateProfileUI() {
    const u = state.user;
    if (!u) return;

    document.getElementById('user-name').innerText = u.username ? `@${u.username}` : u.tg_id;
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username||'U')}&background=3b82f6&color=fff`;
    
    const tier = u.tier || 'standard';
    document.getElementById('badge-tier').innerText = tier === 'premium' ? 'VIP' : 'STD';
    document.getElementById('profile-tier').innerText = tier === 'premium' ? '🚀 VIP' : '🛡 Стандарт';

    // Days left
    if (u.expire_date) {
        const exp = new Date(u.expire_date);
        const now = new Date();
        const days = Math.max(0, Math.ceil((exp - now) / 86400000));
        document.getElementById('days-left').innerText = days;
        document.getElementById('status-text').innerText = days > 0 ? 'Активен' : 'Истёк';
    } else {
        document.getElementById('days-left').innerText = '0';
        document.getElementById('status-text').innerText = 'Нет подписки';
    }

    // Traffic
    const used = u.used_traffic || 0;
    const limit = u.gb_limit || 0;
    document.getElementById('used-gb').innerText = used.toFixed(1);
    document.getElementById('total-gb').innerText = limit > 0 ? limit.toFixed(0) : '∞';
    
    const barContainer = document.getElementById('traffic-bar-container');
    if (limit > 0) {
        const pct = Math.min(100, (used / limit) * 100);
        document.getElementById('traffic-bar').style.width = pct + '%';
        barContainer.style.display = 'block';
    } else {
        barContainer.style.display = 'none';
    }

    // Referral
    const refBalanceEl = document.getElementById('ref-balance-amount');
    if (refBalanceEl) refBalanceEl.innerText = (u.referral_balance || 0).toFixed(0) + '₽';
    const payRefEl = document.getElementById('pay-ref-balance');
    if (payRefEl) payRefEl.innerText = (u.referral_balance || 0).toFixed(0) + '₽';

    // Ref link
    if (u.ref_link) document.getElementById('ref-url').value = u.ref_link;
    updateRefIcons(u.refs_paid_count);
}

function updateDurationUI() {
    const tier = state.tier || 'premium';
    // Update GB labels for durations
    if (tier === 'standard') {
        document.getElementById('dur-1-gb').innerText = '♾️ Безлимит';
        document.getElementById('dur-3-gb').innerText = '♾️ Безлимит';
        document.getElementById('dur-6-gb').innerText = '♾️ Безлимит';
        document.getElementById('dur-12-gb').innerText = '♾️ Безлимит';
    } else {
        document.getElementById('dur-1-gb').innerText = '100 ГБ';
        document.getElementById('dur-3-gb').innerText = '350 ГБ';
        document.getElementById('dur-6-gb').innerText = '800 ГБ';
        document.getElementById('dur-12-gb').innerText = '2 ТБ';
    }
}

// ==================== VIEWS ====================
function showView(view) {
    state.currentView = view;
    const nav = document.getElementById('main-nav');
    
    if (view === 'main') {
        nav.style.display = 'flex';
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = '');
        document.querySelectorAll('.view-content').forEach(el => el.style.display = 'none');
        tg.MainButton.show();
    } else {
        nav.style.display = 'none';
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.view-content').forEach(el => el.style.display = 'none');
        document.getElementById(`view-${view}`).style.display = 'block';
        tg.MainButton.hide();
        
        // Update traffic view data
        if (view === 'traffic' && state.user) {
            const u = state.user;
            document.getElementById('traffic-used').innerText = (u.used_traffic || 0).toFixed(1) + ' ГБ';
            document.getElementById('traffic-limit').innerText = (u.gb_limit || 0).toFixed(0) + ' ГБ';
            state.trafficPkg = null;
            document.getElementById('traffic-pay-section').style.display = 'none';
            [50,100,300,500].forEach(gb => document.getElementById(`tpkg-${gb}`).classList.remove('glass-active'));
        }
    }
}

// ==================== TABS ====================
function switchTab(tabName) {
    if (state.currentView !== 'main') showView('main');
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('[id^="tab-"]').forEach(el => {
        el.classList.remove('text-blue-400');
        el.classList.add('text-gray-400');
    });

    const content = document.getElementById(`content-${tabName}`);
    if (content) content.classList.add('active');
    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) { tab.classList.remove('text-gray-400'); tab.classList.add('text-blue-400'); }

    if (tabName === 'tariff') {
        tg.MainButton.show();
    } else {
        tg.MainButton.hide();
    }
}

// ==================== TIER ====================
function selectTier(tier) {
    state.tier = tier;
    document.getElementById('tier-premium').classList.toggle('glass-active', tier === 'premium');
    document.getElementById('tier-standard').classList.toggle('glass-active', tier === 'standard');
    updateDurationUI();
    
    const trialEl = document.getElementById('trial-gb-price');
    if (trialEl) {
        trialEl.innerText = tier === 'premium' ? '3 ГБ за 100₽' : '10₽';
    }
    updatePrice();
}

// ==================== DURATION ====================
function selectDuration(m) {
    const isTrial = m === 0.1;
    if (isTrial) {
        state.months = 0.1;
        [1, 3, 6, 12].forEach(val => document.getElementById(`dur-${val}`).classList.remove('glass-active'));
        document.getElementById('dur-trial').classList.add('glass-active');
    } else {
        state.months = parseInt(m, 10);
        [1, 3, 6, 12].forEach(val => {
            document.getElementById(`dur-${val}`).classList.toggle('glass-active', val === state.months);
        });
        document.getElementById('dur-trial').classList.remove('glass-active');
    }
    updatePrice();
}

// ==================== PAYMENT ====================
function selectPayment(method) {
    state.paymentMethod = method;
    ['pay-cryptopay', 'pay-platega'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('glass-active', id.includes(method));
    });
    const giftCrypto = document.getElementById('gift-pay-crypto');
    const giftCard = document.getElementById('gift-pay-card');
    if (giftCrypto) giftCrypto.classList.toggle('glass-active', method === 'cryptopay');
    if (giftCard) giftCard.classList.toggle('glass-active', method === 'platega');
}

// ==================== PRICE ====================
function updatePrice() {
    const tier = state.tier || 'premium';
    
    if (state.months === 0.1) {
        state.totalPrice = tier === 'premium' ? 100 : 10;
        state.gbLimit = tier === 'premium' ? 3 : 0;
    } else {
        const months = parseInt(state.months, 10) || 1;
        const base = BASE_PRICES[tier] || 300;
        let discount = 1.0;
        if (months === 3) discount = 0.90;
        else if (months === 6) discount = 0.83;
        else if (months === 12) discount = 0.75;
        state.totalPrice = Math.round(base * months * discount);
        state.gbLimit = tier === 'premium' ? (GB_LIMITS[months] || months * 100) : 0;
    }
    
    tg.MainButton.setText(`ОФОРМИТЬ ЗА ${state.totalPrice} ₽`);
}

// ==================== CREATE INVOICE ====================
async function createInvoice() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    tg.MainButton.showProgress();

    try {
        const data = await apiCreateInvoice({
            tg_id: tg_id,
            days: state.months === 0.1 ? 3 : state.months * 30,
            amount: state.totalPrice,
            payment_method: state.paymentMethod,
            device_count: 1,
            gb_limit: state.gbLimit || 0,
            tier: state.tier || 'premium'
        });
        if (data.status === "success" && data.pay_url) {
            if (data.pay_url.includes('t.me/')) {
                tg.openTelegramLink(data.pay_url);
            } else {
                tg.openLink(data.pay_url);
            }
        } else {
            tg.showAlert("Ошибка: " + (data.error || "Не удалось получить ссылку"));
        }
    } catch (err) {
        tg.showAlert("Сервер временно недоступен");
    } finally {
        tg.MainButton.hideProgress();
    }
}

// ==================== REFERRAL BALANCE PAYMENT ====================
async function payFromReferralBalance() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    
    const price = state.totalPrice;
    const balance = state.user?.referral_balance || 0;
    
    if (balance < price) {
        tg.showAlert(`❌ Недостаточно средств на реферальном балансе.\n\nБаланс: ${balance.toFixed(0)}₽\nНужно: ${price}₽`);
        return;
    }
    
    const confirmed = await new Promise(resolve => {
        tg.showConfirm(`Списать ${price}₽ с реферального баланса (${balance.toFixed(0)}₽)?`, resolve);
    });
    if (!confirmed) return;
    
    tg.MainButton.showProgress();
    try {
        const days = state.months === 0.1 ? 3 : state.months * 30;
        const data = await apiPayFromReferral(tg_id, days, state.tier || 'premium', price);
        if (data.status === "success") {
            tg.showAlert("✅ Подписка оформлена из реферального баланса!");
            init();
        } else {
            tg.showAlert("Ошибка: " + (data.error || "Недостаточно средств"));
        }
    } catch (err) {
        tg.showAlert(err.message || "Ошибка оплаты");
    } finally {
        tg.MainButton.hideProgress();
    }
}

// ==================== TRAFFIC TOP-UP ====================
function selectTrafficPkg(gb, price) {
    state.trafficPkg = { gb, price };
    [50,100,300,500].forEach(g => document.getElementById(`tpkg-${g}`).classList.toggle('glass-active', g === gb));
    document.getElementById('traffic-pay-section').style.display = 'block';
}

async function buyTrafficPay(method) {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id || !state.trafficPkg) return;
    
    const { gb, price } = state.trafficPkg;
    
    try {
        const data = await apiCreateInvoice({
            tg_id: tg_id,
            days: 0,
            amount: price,
            payment_method: method,
            device_count: 1,
            gb_limit: 0,
            tier: state.user?.tier || 'premium',
            type: 'traffic',
            traffic_gb: gb
        });
        if (data.status === "success" && data.pay_url) {
            if (data.pay_url.includes('t.me/')) tg.openTelegramLink(data.pay_url);
            else tg.openLink(data.pay_url);
        } else {
            tg.showAlert("Ошибка: " + (data.error || "Не удалось создать счёт"));
        }
    } catch (err) {
        tg.showAlert("Сервер временно недоступен");
    }
}

async function buyTrafficFromReferral() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id || !state.trafficPkg) return;
    
    const { gb, price } = state.trafficPkg;
    const balance = state.user?.referral_balance || 0;
    
    if (balance < price) {
        tg.showAlert(`❌ Недостаточно средств на реферальном балансе.\n\nБаланс: ${balance.toFixed(0)}₽\nНужно: ${price}₽`);
        return;
    }
    
    const confirmed = await new Promise(resolve => {
        tg.showConfirm(`Списать ${price}₽ с реферального баланса за +${gb} ГБ?`, resolve);
    });
    if (!confirmed) return;
    
    try {
        const data = await apiBuyTrafficReferral(tg_id, gb, price);
        if (data.status === "success") {
            tg.showAlert(`✅ +${gb} ГБ добавлено!`);
            showView('main');
            init();
        } else {
            tg.showAlert("Ошибка: " + (data.error || "Недостаточно средств"));
        }
    } catch (err) {
        tg.showAlert("Ошибка: " + (err.message || "Сервер недоступен"));
    }
}

// ==================== GIFT ====================
function selectGiftTier(tier) {
    state.giftTier = tier;
    document.getElementById('gift-tier-premium').classList.toggle('glass-active', tier === 'premium');
    document.getElementById('gift-tier-standard').classList.toggle('glass-active', tier === 'standard');
    updateGiftPrice();
}

function selectGiftDuration(m) {
    state.giftMonths = parseInt(m, 10);
    [1, 3, 6, 12].forEach(val => {
        document.getElementById(`gift-dur-${val}`).classList.toggle('glass-active', val === state.giftMonths);
    });
    updateGiftPrice();
}

function updateGiftPrice() {
    const prices = GIFT_PRICES[state.giftTier] || GIFT_PRICES.premium;
    const price = prices[state.giftMonths] || prices[1];
    
    const priceEl = document.getElementById('gift-total-price');
    if (priceEl) priceEl.innerText = price;
    const gbEl = document.getElementById('gift-total-gb');
    if (gbEl) gbEl.innerText = GB_LIMITS_GIFT[state.giftMonths] || 100;
    return price;
}

async function createGift() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    
    try {
        const price = updateGiftPrice();
        const data = await apiCreateGift(tg_id, state.giftTier, state.giftMonths, price, state.paymentMethod);
        if (data.status === "success" && data.pay_url) {
            if (data.pay_url.includes('t.me/')) tg.openTelegramLink(data.pay_url);
            else tg.openLink(data.pay_url);
        } else if (data.status === "success" && data.gift_code) {
            tg.showAlert(`🎁 Подарочный код: ${data.gift_code}\nОтправьте ссылку другу:\nhttps://t.me/nemo_vpn_bot?start=gift_${data.gift_code}`);
        } else {
            tg.showAlert("Ошибка: " + (data.error || "Не удалось создать подарок"));
        }
    } catch (err) {
        tg.showAlert("Сервер временно недоступен");
    }
}

// ==================== TASKS ====================
async function checkSubscription() {
    tg.showAlert("Функция проверки подписки будет доступна скоро!");
}

function updateRefIcons(count) {
    count = count || 0;
    [1, 5, 10].forEach(t => {
        const icon = document.getElementById(`ref-icon-${t}`);
        if (icon && count >= t) {
            icon.classList.remove('bg-white/5', 'text-gray-500');
            icon.classList.add('bg-blue-500/20', 'text-blue-400');
        }
    });
}

function copyRefLink() {
    const input = document.getElementById('ref-url');
    if (input && input.value) {
        navigator.clipboard.writeText(input.value).then(() => {
            tg.showAlert("✅ Ссылка скопирована!");
        });
    }
}

// ==================== MAIN BUTTON ====================
tg.MainButton.onClick(() => {
    if (state.currentView === 'main') {
        createInvoice();
    }
});

// ==================== START ====================
init();
