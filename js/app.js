// ==================== STATE ====================
let state = {
    user: null,
    months: 1,
    totalPrice: 500,
    paymentMethod: 'cryptopay',
    trafficPkg: null,
    giftMonths: 1,
    currentView: 'main',
    isStandalone: false,
    guestUserId: null,
    selectedStandalonePlan: null
};

const tg = window.Telegram?.WebApp || { 
    initDataUnsafe: { user: { id: 0 } },
    MainButton: { show:()=>{}, hide:()=>{}, setText:()=>{}, showProgress:()=>{}, hideProgress:()=>{}, onClick:()=>{} },
    showAlert: alert, showConfirm: (m,cb) => cb(confirm(m)),
    openLink: url => window.open(url,'_blank'), openTelegramLink: url => window.open(url,'_blank'),
    ready: ()=>{}, expand: ()=>{}, close: ()=>{}
};

// ==================== UNIFIED PRICING ====================
// Subscriptions: days -> price in ₽
const SUBSCRIPTION_PRICES = { 3: 200, 30: 500, 90: 1500, 180: 2500, 365: 4500 };
// Subscriptions: days -> GB limit
const SUBSCRIPTION_GB = { 3: 10, 30: 100, 90: 350, 180: 800, 365: 2048 };
// Gifts: months -> price in ₽ (unified — same for both configs)
const GIFT_PRICES = { 1: 700, 3: 1800, 6: 3000, 12: 5500 };
// Gift GB: months -> GB limit
const GIFT_GB = { 1: 100, 3: 350, 6: 800, 12: 2048 };
// Traffic top-up packages
const TRAFFIC_PACKAGES = [
    { gb: 50, price: 200 },
    { gb: 100, price: 400 },
    { gb: 300, price: 1000 },
    { gb: 500, price: 2000 }
];

// ==================== INIT ====================
async function init() {
    tg.ready();
    tg.expand();
    const tg_id = tg.initDataUnsafe?.user?.id;

    // Check for standalone mode (no Telegram or tg_id=0 or /pay path)
    const isPayRoute = window.location.pathname === '/pay' || window.location.hash === '#pay';
    if ((!tg_id || tg_id === 0) && !isPayRoute) {
        // No Telegram context — show standalone checkout
        state.isStandalone = true;
        document.getElementById('main-nav').style.display = 'none';
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.view-content').forEach(el => el.style.display = 'none');
        const standalone = document.getElementById('standalone-checkout');
        if (standalone) standalone.style.display = 'block';
        initStandaloneCheckout();
        return;
    }
    if (isPayRoute && (!tg_id || tg_id === 0)) {
        state.isStandalone = true;
        document.getElementById('main-nav').style.display = 'none';
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.view-content').forEach(el => el.style.display = 'none');
        const standalone = document.getElementById('standalone-checkout');
        if (standalone) standalone.style.display = 'block';
        initStandaloneCheckout();
        return;
    }

    if (!tg_id) return;
    try {
        const data = await apiGetUser(tg_id);
        if (data.user) {
            state.user = data.user;
            switchTab('profile');
            updateProfileUI();
            updateDurationUI();
            updatePrice();
            updateGiftPrice();
        }
    } catch (err) {
        console.error('Init error:', err);
    }
}

// Check for /pay_success route
function checkPaySuccess() {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user_id');
    if (userId && (window.location.pathname === '/pay_success' || window.location.hash === '#pay_success')) {
        state.isStandalone = true;
        document.getElementById('main-nav').style.display = 'none';
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.view-content').forEach(el => el.style.display = 'none');
        const successDiv = document.getElementById('standalone-success');
        if (successDiv) {
            successDiv.style.display = 'block';
            document.getElementById('success-user-id').innerText = userId;
            document.getElementById('success-sub-link').innerText = `https://nemovpn.cfd/api/sub/${userId}`;
        }
        return true;
    }
    return false;
}

function updateProfileUI() {
    const u = state.user;
    if (!u) return;

    // Имя из Telegram
    const tgUser = tg.initDataUnsafe?.user;
    const displayName = tgUser?.first_name || tgUser?.username || u.username || `ID: ${u.user_id}`;
    document.getElementById('user-name').innerText = displayName;
    
    // Аватар из Telegram
    if (tgUser?.photo_url) {
        document.getElementById('user-avatar').src = tgUser.photo_url;
    }
    
    const tier = u.tier || 'standard';
    document.getElementById('badge-tier').innerText = tier === 'premium' ? 'VIP' : 'STD';
    document.getElementById('profile-tier').innerText = tier === 'premium' ? '🚀 VIP' : '🛡 Стандарт';

    // Days left
    const days = u.days_left || 0;
    document.getElementById('days-left').innerText = days;
    const statusText = document.getElementById('status-text');
    if (days > 0) {
        statusText.innerText = 'Активен';
    } else {
        statusText.innerText = 'Нет подписки';
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
    
    // Show regenerate key button for users with subscription
    const btnRegen = document.getElementById('btn-regenerate-key');
    if (btnRegen) {
        btnRegen.style.display = (u.sub_url || u.vless_link) ? 'flex' : 'none';
    }
    
    // Subscriptions card
    const subCard = document.getElementById('subscriptions-card');
    const subStd = document.getElementById('sub-standard');
    const subPrem = document.getElementById('sub-premium');
    const hasStandard = u.standard_days > 0;
    const hasPremium = u.premium_days > 0;
    
    if (hasStandard || hasPremium) {
        subCard.style.display = 'block';
        if (hasStandard) {
            subStd.style.display = 'flex';
            document.getElementById('sub-standard-days').innerText = u.standard_days + ' дн.';
            document.getElementById('sub-standard-date').innerText = 'до ' + (u.standard_expire || '');
        } else {
            subStd.style.display = 'none';
        }
        if (hasPremium) {
            subPrem.style.display = 'flex';
            document.getElementById('sub-premium-days').innerText = u.premium_days + ' дн.';
            document.getElementById('sub-premium-date').innerText = 'до ' + (u.premium_expire || '');
        } else {
            subPrem.style.display = 'none';
        }
    } else {
        subCard.style.display = 'none';
    }
    
    // Show traffic topup button for users with subscription and limit > 0
    const btnTraffic = document.getElementById('btn-buy-traffic');
    if (btnTraffic) {
        btnTraffic.style.display = (limit > 0) ? 'flex' : 'none';
    }
    
    // VK subscription card
    const vkCard = document.getElementById('vk-subscription-card');
    if (vkCard) {
        const hasVkSub = u.vk_sub_url && u.vk_sub_url.length > 0;
        if (hasVkSub) {
            vkCard.style.display = 'block';
            const vkTrafficInfo = document.getElementById('vk-sub-traffic-info');
            const vkExpire = document.getElementById('vk-sub-expire');
            const vkUsedGb = document.getElementById('vk-used-gb');
            const vkTotalGb = document.getElementById('vk-total-gb');
            const vkTrafficSection = document.getElementById('vk-traffic-section');
            
            // VK sub expire - same user, so show same dates as TG
            const vkExpireStr = u.premium_expire || u.standard_expire || '';
            const vkDaysLeft = Math.max(u.premium_days || 0, u.standard_days || 0, u.days_left || 0);
            vkExpire.innerText = vkDaysLeft > 0 ? vkExpireStr : 'Истекла';
            
            if (vkTrafficInfo) {
                if (u.vk_gb_limit > 0) {
                    vkTrafficInfo.innerText = `${(u.vk_used_traffic || 0).toFixed(1)} / ${u.vk_gb_limit.toFixed(0)} ГБ`;
                } else {
                    vkTrafficInfo.innerText = 'Безлимитный трафик';
                }
            }
            
            if (u.vk_gb_limit > 0) {
                vkTrafficSection.style.display = 'block';
                vkUsedGb.innerText = (u.vk_used_traffic || 0).toFixed(1);
                vkTotalGb.innerText = u.vk_gb_limit.toFixed(0);
                const vkPct = Math.min(100, ((u.vk_used_traffic || 0) / u.vk_gb_limit) * 100);
                document.getElementById('vk-traffic-bar').style.width = vkPct + '%';
            } else {
                vkTrafficSection.style.display = 'none';
            }
        } else {
            vkCard.style.display = 'none';
        }
    }
    
    // VPN ключи
    renderVPNKeys(u);
}

function updateDurationUI() {
    // Unified model — always show GB limits per plan
    const gbLabels = { 1: '100 ГБ', 3: '350 ГБ', 6: '800 ГБ', 12: '2 ТБ' };
    [1, 3, 6, 12].forEach(m => {
        const el = document.getElementById(`dur-${m}-gb`);
        if (el) el.innerText = gbLabels[m];
    });
}

// ==================== VIEWS ====================
function renderVPNKeys(u) {
    let keysContainer = document.getElementById('vpn-keys-container');
    if (!keysContainer) {
        keysContainer = document.createElement('div');
        keysContainer.id = 'vpn-keys-container';
        keysContainer.className = 'mt-2 mb-2';
        const refSection = document.getElementById('referral-balance-section');
        if (refSection) refSection.after(keysContainer);
    }
    
    if (!u.sub_url && !u.vless_link) {
        keysContainer.innerHTML = '';
        return;
    }
    
    let html = '<h2 class="text-sm uppercase tracking-wider text-gray-400 mb-3 pl-1">Ваши ключи доступа</h2>';
    
    if (u.sub_url) {
        html += `
        <div class="glass rounded-2xl p-4 mb-3 cursor-pointer transition hover:bg-white/10" onclick="copyVpnKey('sub_url')">
            <div class="flex justify-between items-center mb-2">
                <div class="font-bold text-sm">\u{1F511} Ключ подписки (Auto)</div>
                <i class="fa-solid fa-copy text-gray-500"></i>
            </div>
            <div class="bg-black/20 rounded p-2 text-xs text-blue-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">${u.sub_url || ''}</div>
        </div>`;
    }
    if (u.vless_link) {
        html += `
        <div class="glass rounded-2xl p-4 mb-3 cursor-pointer transition hover:bg-white/10" onclick="copyVpnKey('vless_link')">
            <div class="flex justify-between items-center mb-2">
                <div class="font-bold text-sm">\u{1F517} VLESS Ключ (Прямой)</div>
                <i class="fa-solid fa-copy text-gray-500"></i>
            </div>
            <div class="bg-black/20 rounded p-2 text-xs text-blue-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">${u.vless_link}</div>
        </div>`;
    }

    // VK VPN keys
    if (u.vk_sub_url) {
        html += `
        <h2 class="text-sm uppercase tracking-wider text-purple-400 mt-5 mb-3 pl-1">\u{1F517} VK: Ключ подписки</h2>
        <div class="glass rounded-2xl p-4 mb-3 cursor-pointer transition hover:bg-white/10 border-purple-500/20" onclick="copyVpnKey('vk_sub_url')">
            <div class="flex justify-between items-center mb-2">
                <div class="font-bold text-sm text-purple-300">\u{1F511} VK Авто-ключ</div>
                <i class="fa-solid fa-copy text-gray-500"></i>
            </div>
            <div class="bg-black/20 rounded p-2 text-xs text-purple-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">${u.vk_sub_url}</div>
        </div>`;
    }
    if (u.vk_vless_link) {
        html += `
        <div class="glass rounded-2xl p-4 mb-3 cursor-pointer transition hover:bg-white/10 border-purple-500/20" onclick="copyVpnKey('vk_vless_link')">
            <div class="flex justify-between items-center mb-2">
                <div class="font-bold text-sm text-purple-300">\u{1F517} VK VLESS Ключ</div>
                <i class="fa-solid fa-copy text-gray-500"></i>
            </div>
            <div class="bg-black/20 rounded p-2 text-xs text-purple-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">${u.vk_vless_link}</div>
        </div>`;
    }

    keysContainer.innerHTML = html;
}

function copyVpnKey(key) {
    const u = state.user;
    const keys = {
        sub_url: u?.sub_url,
        vless_link: u?.vless_link,
        vk_sub_url: u?.vk_sub_url,
        vk_vless_link: u?.vk_vless_link
    };
    const val = keys[key];
    if (val) {
        navigator.clipboard.writeText(val).then(() => tg.showAlert('\u2705 Скопировано!'));
    }
}

function toggleKeyBlur(el) {
    el.classList.toggle('blur-sm');
}

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
            document.getElementById('traffic-total').style.display = 'none';
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

// ==================== PRICE (UNIFIED) ====================
function updatePrice() {
    if (state.months === 0.1) {
        // Trial: 3 дня, 200₽, 10ГБ
        state.totalPrice = 200;
        state.gbLimit = 10;
    } else {
        const months = parseInt(state.months, 10) || 1;
        const days = months * 30;
        state.totalPrice = SUBSCRIPTION_PRICES[days] || 500;
        state.gbLimit = SUBSCRIPTION_GB[days] || months * 100;
    }
    
    tg.MainButton.setText(`ОФОРМИТЬ ЗА ${state.totalPrice} ₽`);
}

// ==================== CREATE INVOICE ====================
async function createInvoice() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    tg.MainButton.showProgress();

    try {
        const days = state.months === 0.1 ? 3 : state.months * 30;
        const data = await apiCreateInvoice({
            tg_id: tg_id,
            days: days,
            amount: state.totalPrice,
            payment_method: state.paymentMethod,
            device_count: 1,
            gb_limit: state.gbLimit || 0,
            tier: 'premium'  // unified — always premium (both configs)
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
        const data = await apiPayFromReferral(tg_id, days, 'premium', price);
        if (data.status === "success") {
            tg.showAlert("✅ Подписка оформлена из реферального баланса!");
            tg.MainButton.hide();
            switchTab('profile');
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
    document.getElementById('traffic-total').style.display = 'block';
    document.getElementById('traffic-price').innerText = price;
    document.getElementById('traffic-gb-display').innerText = gb;
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

// ==================== GIFT (UNIFIED) ====================
function selectGiftDuration(m) {
    state.giftMonths = parseInt(m, 10);
    [1, 3, 6, 12].forEach(val => {
        document.getElementById(`gift-dur-${val}`).classList.toggle('glass-active', val === state.giftMonths);
    });
    updateGiftPrice();
}

function updateGiftPrice() {
    const price = GIFT_PRICES[state.giftMonths] || GIFT_PRICES[1];
    
    const priceEl = document.getElementById('gift-total-price');
    if (priceEl) priceEl.innerText = price;
    const gbEl = document.getElementById('gift-total-gb');
    const gbParent = document.getElementById('gift-gb-info');
    if (gbParent) {
        const gb = GIFT_GB[state.giftMonths] || 100;
        gbParent.innerHTML = '<div class="text-sm text-blue-400 mt-1">+ <span id="gift-total-gb">' + gb + '</span> ГБ</div>';
    }
    return price;
}

async function createGift() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    
    try {
        const price = updateGiftPrice();
        const data = await apiCreateGift(tg_id, 'premium', state.giftMonths, price, state.paymentMethod);
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

async function giftFromReferral() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    
    const price = updateGiftPrice();
    const balance = state.user?.referral_balance || 0;
    
    if (balance < price) {
        tg.showAlert(`❌ Недостаточно средств на реферальном балансе.\n\nБаланс: ${balance.toFixed(0)}₽\nНужно: ${price}₽`);
        return;
    }
    
    const confirmed = await new Promise(resolve => {
        tg.showConfirm(`Списать ${price}₽ с реферального баланса за подарок?`, resolve);
    });
    if (!confirmed) return;
    
    try {
        const days = state.giftMonths * 30;
        // Create gift code directly via referral balance
        const data = await fetch(`${BACKEND_URL || 'https://nemovpn.cfd'}/api/gift_referral`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ tg_id, tier: 'premium', days, amount: price })
        }).then(r => r.json());
        
        if (data.status === "success" && data.gift_link) {
            tg.showAlert(`🎁 Подарок оплачен!\n\nОтправьте ссылку другу:\n${data.gift_link}`);
            showView('main');
            init();
        } else {
            tg.showAlert("Ошибка: " + (data.error || "Недостаточно средств"));
        }
    } catch (err) {
        tg.showAlert("Ошибка: " + (err.message || "Сервер недоступен"));
    }
}

// ==================== TASKS ====================
async function checkSubscription() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    
    const btn = document.getElementById('btn-check-sub');
    if (btn) btn.innerText = 'Проверяем...';
    
    try {
        const data = await apiCheckTask(tg_id);
        if (data.status === 'success') {
            tg.showAlert('🎉 Спасибо за подписку! Вам начислено +3 бонусных дня.');
            init();
            if (btn) btn.innerText = '✅ Выполнено';
        } else if (data.status === 'already_done') {
            tg.showAlert('Вы уже получили бонус за подписку.');
            if (btn) btn.innerText = '✅ Выполнено';
        } else if (data.status === 'not_subscribed') {
            tg.showAlert('❌ Вы ещё не подписаны на канал. Подпишитесь и попробуйте снова.');
            if (btn) btn.innerText = 'Проверить подписку';
        }
    } catch (err) {
        tg.showAlert('Ошибка проверки. Попробуйте позже.');
        if (btn) btn.innerText = 'Проверить подписку';
    }
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

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
        headers['X-Telegram-InitData'] = window.Telegram.WebApp.initData;
    }
    return headers;
}

// ==================== REGENERATE KEY ====================
function confirmRegenerateKey() {
    tg.showConfirm("Старая ссылка перестанет работать. Вам придётся обновить подписку в Happ. Срок и ГБ сохраняются. Перегенерировать?", (confirmed) => {
        if (confirmed) {
            regenerateKey();
        }
    });
}

async function regenerateKey() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    tg.showAlert("⏳ Перегенерация ключа...");
    try {
        const response = await fetch(`${BACKEND_URL}/api/regenerate_key`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ tg_id })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ошибка");
        
        if (data.sub_url) {
            tg.showAlert("✅ Ключ перегенерирован! Обновите подписку в Happ.");
            if (state.user) {
                state.user.sub_url = data.sub_url;
                updateProfileUI();
            }
        }
    } catch (err) {
        tg.showAlert("❌ " + (err.message || "Ошибка перегенерации"));
    }
}

// ==================== STANDALONE CHECKOUT (NON-TG) ====================
function initStandaloneCheckout() {
    // Select 1 month by default
    selectStandalonePlan('30');
}

const STANDALONE_PLANS = [
    { days: 3, label: '3 дня', price: 200, gb: 10 },
    { days: 30, label: '1 месяц', price: 500, gb: 100 },
    { days: 90, label: '3 месяца', price: 1500, gb: 350 },
    { days: 180, label: '6 месяцев', price: 2500, gb: 800 },
    { days: 365, label: '1 год', price: 4500, gb: 2048 }
];

function selectStandalonePlan(days) {
    state.selectedStandalonePlan = STANDALONE_PLANS.find(p => p.days === parseInt(days));
    document.querySelectorAll('.standalone-plan').forEach(el => {
        el.classList.toggle('glass-active', el.dataset.days === String(days));
    });
    const plan = state.selectedStandalonePlan;
    if (plan) {
        const priceEl = document.getElementById('standalone-total');
        if (priceEl) priceEl.innerText = plan.price + ' ₽';
        const gbEl = document.getElementById('standalone-gb');
        if (gbEl) gbEl.innerText = plan.gb >= 1024 ? (plan.gb / 1024) + ' ТБ' : plan.gb + ' ГБ';
    }
}

async function standaloneCheckout() {
    const plan = state.selectedStandalonePlan;
    if (!plan) return alert('Выберите план');

    const method = state.paymentMethod;
    if (!method) return alert('Выберите способ оплаты');

    // Step 1: Register as guest
    const regBtn = document.getElementById('standalone-pay-btn');
    if (regBtn) { regBtn.disabled = true; regBtn.innerText = 'Регистрация...'; }

    try {
        const regData = await apiRegisterGuest();
        if (!regData.user_id) {
            alert('Ошибка регистрации. Попробуйте позже.');
            if (regBtn) { regBtn.disabled = false; regBtn.innerText = '💰 Оплатить'; }
            return;
        }
        state.guestUserId = regData.user_id;

        // Step 2: Create invoice
        if (regBtn) regBtn.innerText = 'Создание счёта...';
        const invoiceData = await apiCreateInvoice({
            user_id: regData.user_id,
            days: plan.days,
            amount: plan.price,
            payment_method: method,
            device_count: 1,
            gb_limit: plan.gb,
            tier: 'premium',
            is_guest: true
        });

        if (invoiceData.status === 'success' && invoiceData.pay_url) {
            // Redirect to payment page; on success, the callback will redirect to /pay_success
            window.location.href = invoiceData.pay_url;
        } else {
            alert('Ошибка: ' + (invoiceData.error || 'Не удалось создать счёт'));
            if (regBtn) { regBtn.disabled = false; regBtn.innerText = '💰 Оплатить'; }
        }
    } catch (err) {
        alert('Ошибка: ' + (err.message || 'Сервер недоступен'));
        if (regBtn) { regBtn.disabled = false; regBtn.innerText = '💰 Оплатить'; }
    }
}

function standaloneSelectPayment(method) {
    state.paymentMethod = method;
    document.getElementById('sa-pay-cryptopay').classList.toggle('glass-active', method === 'cryptopay');
    document.getElementById('sa-pay-platega').classList.toggle('glass-active', method === 'platega');
}

function copySubLink() {
    const el = document.getElementById('success-sub-link');
    if (el && el.innerText) {
        navigator.clipboard.writeText(el.innerText).then(() => alert('✅ Ссылка скопирована!'));
    }
}

// ==================== MAIN BUTTON ====================
tg.MainButton.onClick(() => {
    if (state.currentView === 'main') {
        createInvoice();
    }
});

// ==================== START ====================
if (!checkPaySuccess()) {
    init();
}