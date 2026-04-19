/* =========================================================
   Nemo VPN VIP - App Logic
   Полная интеграция Профиля, Тарифов, Оплаты, Докупки, Подарков
========================================================= */

const tg = window.Telegram.WebApp;
tg.expand();

let state = {
    user: null,
    months: 1,
    devices: 1,
    totalPrice: 300,
    paymentMethod: 'cryptopay',
    // Докупка трафика
    trafficPkg: null, // {gb, price}
    // Подарок
    giftTier: 'premium',
    giftMonths: 1
};

const BASE_PRICE = 300;
const DEVICE_EXTRA_PRICE = 100;
const GIFT_PRICES = {
    standard: { 1: 150, 3: 400, 6: 700, 12: 1200 },
    premium: { 1: 400, 3: 1050, 6: 1900, 12: 3500 }
};
const GB_LIMITS_GIFT = { 1: 100, 3: 350, 6: 800, 12: 2048 };

// Пакеты докупки трафика
const TRAFFIC_PACKAGES = [
    { gb: 50, price: 100 },
    { gb: 100, price: 200 },
    { gb: 300, price: 600 },
    { gb: 500, price: 1000 }
];

const ROUTE_V2BOX = "v2box://routes?multi=W3sibGlzdCI6WyJnZW9zaXRlOnJ1IiwiZG9tYWluOnJ1IiwiZG9tYWluOtGA0YQiXSwiaXNFbmFibGUiOnRydWUsIm1hdGNoTW9kZSI6ImRvbWFpbiIsIm5hbWUiOiJyb3V0ZS4zRjFENTdBOS0xRkZELTQ5MkMtOTY2NS1BRTJDNDU4QzE0QUIiLCJyZW1hcmsiOiJEaXJlY3QgUlUiLCJsaXN0SVAiOlsiZ2VvaXA6cnUiLCJnZW9pcDpwcml2YXRlIl0sInR5cGUiOiJJUCIsInRhZyI6ImRpcmVjdCJ9XQ==";
const ROUTE_HAPP = "happ://routing/add/eyJEbnNIb3N0cyI6e30sIkRvbWFpblN0cmF0ZWd5IjoiSVBJZk5vbk1hdGNoIiwiQmxvY2tTaXRlcyI6W10sIkxhc3RVcGRhdGVkIjoxNzc1OTYwOTM0LCJEb21lc3RpY0ROU0RvbWFpbiI6Imh0dHBzOlwvXC9kbnMuZ29vZ2xlXC9kbnMtcXVlcnkiLCJEb21lc3RpY0ROU1R5cGUiOiJEb1UiLCJVc2VDaHVua0ZpbGVzIjp0cnVlLCJSb3V0ZU9yZGVyIjoiYmxvY2stZGlyZWN0LXByb3h5IiwiUmVtb3RlRE5TVHlwZSI6IkRvVSIsIk5hbWUiOiLQoNCkIiwiR2xvYmFsUHJveHkiOnRydWUsIlJlbW90ZUROU0lwIjoiMS4xLjEuMSIsIkdlb2lwVXJsIjoiaHR0cHM6XC9cL2dpdGh1Yi5jb21cL0xveWFsc29sZGllclwvdjJyYXktcnVsZXMtZGF0XC9yZWxlYXNlc1wvbGF0ZXN0XC9kb3dubG9hZFwvZ2VvaXAuZGF0IiwiRmFrZURucyI6ZmFsc2UsIkRpcmVjdFNpdGVzIjpbImdlb3NpdGU6Y2F0ZWdvcnktcnUiXSwiQmxvY2tJcCI6W10sIkRpcmVjdElwIjpbIjEwLjAuMC4wXC84IiwiMTcyLjE2LjAuMFwvMTIiLCIxOTIuMTY4LjAuMFwvMTYiLCIxNjkuMjU0LjAuMFwvMTYiLCIyMjQuMC4wLjBcLzQiLCIyNTUuMjU1LjI1NS4yNTUiLCJnZW9pcDpydSJdLCJEb21lc3RpY0ROU0lwIjoiOC44LjguOCIsIlJlbW90ZUROU0RvbWFpbiI6Imh0dHBzOlwvXC9jbG91ZGZsYXJlLWRucy5jb21cL2Rucy1xdWVyeSIsIlByb3h5SXAiOltdLCJQcm94eVNpdGVzIjpbXSwiR2Vvc2l0ZVVybCI6Imh0dHBzOlwvXC9naXRodWIuY29tXC9Mb3lhbHNvbGRpZXJcL3YycmF5LXJ1bGVzLWRhdFwvcmVsZWFzZXNcL2xhdGVzdFwvZG93bmxvYWRcL2dlb3NpdGUuZGF0In0=";

// ==================== INIT ====================

async function init() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) {
        console.warn("Запущено вне Telegram");
        document.getElementById('user-name').innerText = "Developer Mode";
        return;
    }

    try {
        const data = await apiGetUser(tg_id);
        if (data.status === 'success') {
            state.user = data.user;
            updateProfileUI();
            updateTrafficUI();
            
            if (state.user.days_left > 0) {
                switchTab('profile');
            } else {
                switchTab('tariff');
            }
        }
    } catch (err) {
        console.error("Ошибка инициализации:", err);
        switchTab('tariff');
    }

    updatePrice();
    setupMainButton();
}

// ==================== PROFILE ====================

function updateProfileUI() {
    const u = state.user;
    if (!u) return;

    document.getElementById('user-name').innerText = u.username;
    if (tg.initDataUnsafe?.user?.photo_url) {
        document.getElementById('user-avatar').src = tg.initDataUnsafe.user.photo_url;
    }

    document.getElementById('days-left').innerText = u.days_left;
    document.getElementById('profile-devices').innerText = u.device_count;

    const statusText = document.getElementById('status-text');
    if (u.days_left > 0) {
        statusText.innerText = "Активен";
        statusText.classList.replace('text-red-400', 'text-blue-400');
    } else {
        statusText.innerText = "Истек";
        statusText.classList.replace('text-blue-400', 'text-red-400');
    }

    const used = u.used_traffic || 0;
    const limit = u.gb_limit || 0;
    document.getElementById('used-gb').innerText = used;
    document.getElementById('total-gb').innerText = limit > 0 ? limit : "∞";

    if (limit > 0) {
        const percent = Math.min((used / limit) * 100, 100);
        document.getElementById('traffic-bar').style.width = `${percent}%`;
    } else {
        document.getElementById('traffic-bar').style.width = `0%`;
    }

    document.getElementById('ref-url').value = u.ref_link;
    updateRefIcons(u.refs_paid_count);

    // Реферальный баланс
    const refBalanceEl = document.getElementById('ref-balance-amount');
    if (refBalanceEl) refBalanceEl.innerText = (u.referral_balance || 0).toFixed(0) + '₽';
    const payRefEl = document.getElementById('pay-ref-balance');
    if (payRefEl) payRefEl.innerText = (u.referral_balance || 0).toFixed(0) + '₽';

    // VPN ключи
    if (u.sub_url || u.vless_link) {
        let keysContainer = document.getElementById('vpn-keys-container');
        if (!keysContainer) {
            keysContainer = document.createElement('div');
            keysContainer.id = 'vpn-keys-container';
            keysContainer.className = 'mt-6 mb-6';
            const profileTab = document.getElementById('content-profile');
            if (profileTab) profileTab.appendChild(keysContainer);
        }

        let keysHTML = `<h2 class="text-sm uppercase tracking-wider text-gray-400 mb-3 pl-1">Ваши ключи доступа</h2>`;
        
        if (u.sub_url) {
            keysHTML += `
            <div class="glass rounded-2xl p-4 mb-3 cursor-pointer transition hover:bg-white/10" onclick="copyVpnKey('sub_url')">
                <div class="flex justify-between items-center mb-2">
                    <div class="font-bold text-sm">🔑 Ключ подписки (Auto)</div>
                    <i class="fa-solid fa-copy text-gray-500"></i>
                </div>
                <div class="bg-black/20 rounded p-2 text-xs text-blue-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">${u.sub_url}</div>
            </div>`;
        }
        if (u.vless_link) {
            keysHTML += `
            <div class="glass rounded-2xl p-4 mb-3 cursor-pointer transition hover:bg-white/10" onclick="copyVpnKey('vless_link')">
                <div class="flex justify-between items-center mb-2">
                    <div class="font-bold text-sm">🔗 VLESS Ключ (Прямой)</div>
                    <i class="fa-solid fa-copy text-gray-500"></i>
                </div>
                <div class="bg-black/20 rounded p-2 text-xs text-blue-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">${u.vless_link}</div>
            </div>`;
        }

        if (u.tier === 'premium') {
            keysHTML += `
            <h2 class="text-sm uppercase tracking-wider text-purple-400 mt-5 mb-3 pl-1">🚀 VIP: Обход белых списков</h2>
            <div class="glass rounded-2xl p-4 mb-3 cursor-pointer transition hover:bg-white/10 border-purple-500/30" onclick="copyVpnKey('route_v2box')">
                <div class="flex justify-between items-center mb-2"><div class="font-bold text-sm text-purple-300">Маршрутизация V2Box</div><i class="fa-solid fa-copy text-gray-500"></i></div>
                <div class="bg-black/20 rounded p-2 text-xs text-purple-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">${ROUTE_V2BOX}</div>
            </div>
            <div class="glass rounded-2xl p-4 cursor-pointer transition hover:bg-white/10 border-green-500/30" onclick="copyVpnKey('route_happ')">
                <div class="flex justify-between items-center mb-2"><div class="font-bold text-sm text-green-300">Маршрутизация Happ</div><i class="fa-solid fa-copy text-gray-500"></i></div>
                <div class="bg-black/20 rounded p-2 text-xs text-green-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">${ROUTE_HAPP}</div>
            </div>`;
        }
        keysContainer.innerHTML = keysHTML;
    }
}

// ==================== TRAFFIC TOP-UP ====================

function updateTrafficUI() {
    const u = state.user;
    if (!u) return;
    
    const limit = u.gb_limit || 0;
    const used = u.used_traffic || 0;
    const trafficSection = document.getElementById('traffic-topup-section');
    
    if (trafficSection && limit > 0) {
        const percent = Math.round((used / limit) * 100);
        const isLow = percent >= 80;
        const isExhausted = used >= limit;
        
        trafficSection.style.display = 'block';
        
        let header, headerColor;
        if (isExhausted) {
            header = '🔴 Трафик исчерпан!';
            headerColor = 'text-red-400';
        } else if (isLow) {
            header = '⚠️ Трафик заканчивается';
            headerColor = 'text-yellow-400';
        } else {
            header = '📦 Докупить трафик';
            headerColor = 'text-blue-400';
        }
        
        trafficSection.innerHTML = `
            <div class="glass rounded-2xl p-4 ${isLow ? 'border-red-500/30' : ''}">
                <div class="flex items-center justify-between mb-3">
                    <div class="font-bold ${headerColor}">${header}</div>
                    <div class="text-xs text-gray-400">${used} / ${limit} ГБ (${percent}%)</div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    ${TRAFFIC_PACKAGES.map(pkg => `
                    <button onclick="buyTraffic(${pkg.gb}, ${pkg.price})" class="py-2 px-3 bg-white/5 hover:bg-blue-500/20 border border-white/10 rounded-xl text-sm font-bold transition">
                        +${pkg.gb} ГБ — ${pkg.price}₽
                    </button>`).join('')}
                </div>
            </div>`;
    } else if (trafficSection) {
        trafficSection.style.display = 'none';
    }
}

async function buyTraffic(gb, price) {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    
    const method = state.paymentMethod || 'cryptopay';
    tg.MainButton.showProgress();
    
    try {
        const data = await apiBuyTraffic(tg_id, gb, price, method);
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

// ==================== GIFT ====================

function selectGiftTier(tier) {
    state.giftTier = tier;
    document.getElementById('gift-tier-premium').classList.toggle('glass-active', tier === 'premium');
    document.getElementById('gift-tier-standard').classList.toggle('glass-active', tier === 'standard');
    updateGiftPrice();
}

function selectGiftDuration(m) {
    state.giftMonths = m;
    [1, 3, 6, 12].forEach(val => {
        const el = document.getElementById(`gift-dur-${val}`);
        if (el) el.classList.toggle('glass-active', val === m);
    });
    updateGiftPrice();
}

function updateGiftPrice() {
    const prices = GIFT_PRICES[state.giftTier] || GIFT_PRICES.premium;
    const price = prices[state.giftMonths] || prices[1];
    
    const priceEl = document.getElementById('gift-total-price');
    if (priceEl) priceEl.innerText = price;
    
    // Update GB display
    const gbEl = document.getElementById('gift-total-gb');
    if (gbEl) gbEl.innerText = GB_LIMITS_GIFT[state.giftMonths] || 100;
    
    return price;
}

async function createGift() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    
    const days = state.giftMonths * 30;
    const price = updateGiftPrice();
    const method = state.paymentMethod || 'cryptopay';
    
    tg.MainButton.showProgress();
    try {
        const data = await apiCreateGift(tg_id, state.giftTier, days, method);
        if (data.status === "success" && data.pay_url) {
            if (data.pay_url.includes('t.me/')) {
                tg.openTelegramLink(data.pay_url);
            } else {
                tg.openLink(data.pay_url);
            }
        } else if (data.status === "success" && data.gift_link) {
            tg.showAlert(`🎁 Подарок готов!\n\nОтправьте ссылку другу:\n${data.gift_link}`);
        } else {
            tg.showAlert("Ошибка: " + (data.error || "Не удалось создать подарок"));
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
    
    const days = state.months * 30;
    const tier = 'premium'; // по умолчанию VIP
    
    tg.MainButton.showProgress();
    try {
        const data = await apiPayFromReferral(tg_id, days, tier);
        if (data.status === "success") {
            tg.showAlert("✅ Подписка оформлена из реферального баланса!");
            init(); // обновляем профиль
        } else {
            tg.showAlert("Ошибка: " + (data.error || "Недостаточно средств"));
        }
    } catch (err) {
        tg.showAlert(err.message || "Ошибка оплаты");
    } finally {
        tg.MainButton.hideProgress();
    }
}

// ==================== TABS ====================

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('[id^="tab-"]').forEach(el => {
        el.classList.remove('text-blue-400');
        el.classList.add('text-gray-400');
    });

    document.getElementById(`content-${tabName}`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.remove('text-gray-400');
    document.getElementById(`tab-${tabName}`).classList.add('text-blue-400');

    if (tabName === 'tariff') {
        tg.MainButton.show();
    } else {
        tg.MainButton.hide();
    }
}

// ==================== TARIFF ====================

function selectDuration(m) {
    let parsedMonths = typeof m === 'object' ? parseInt(m.currentTarget?.id.replace('dur-', '') || 1, 10) : parseInt(m, 10);
    if (isNaN(parsedMonths)) return;
    state.months = parsedMonths;
    [1, 3, 6, 12].forEach(val => {
        document.getElementById(`dur-${val}`).classList.toggle('glass-active', val === state.months);
    });
    updatePrice();
}

function changeDevices(delta) {
    let current = parseInt(state.devices, 10) || 1;
    let diff = parseInt(delta, 10) || 0;
    const n = current + diff;
    if (n >= 1 && n <= 10) {
        state.devices = n;
        document.getElementById('device-count').innerText = n;
        updatePrice();
    }
}

function selectPayment(method) {
    state.paymentMethod = method;
    // Subscription tab
    const payCrypto = document.getElementById('pay-cryptopay');
    const payPlatega = document.getElementById('pay-platega');
    if (payCrypto) payCrypto.classList.toggle('glass-active', method === 'cryptopay');
    if (payPlatega) payPlatega.classList.toggle('glass-active', method === 'platega');
    // Gift tab
    const giftCrypto = document.getElementById('gift-pay-crypto');
    const giftCard = document.getElementById('gift-pay-card');
    if (giftCrypto) giftCrypto.classList.toggle('glass-active', method === 'cryptopay');
    if (giftCard) giftCard.classList.toggle('glass-active', method === 'platega');
}

function updatePrice() {
    const devices = parseInt(state.devices, 10) || 1;
    const months = parseInt(state.months, 10) || 1;
    const baseMonthPrice = BASE_PRICE + ((devices - 1) * DEVICE_EXTRA_PRICE);
    let discountMultiplier = 1.0;
    if (months === 3) discountMultiplier = 0.90;
    else if (months === 6) discountMultiplier = 0.83;
    else if (months === 12) discountMultiplier = 0.75;

    let total = Math.round((baseMonthPrice * months) * discountMultiplier);
    if (isNaN(total)) total = BASE_PRICE;

    state.totalPrice = total;
    state.gbLimit = GB_LIMITS_GIFT[months] || (months * 100);
    tg.MainButton.setText(`ОФОРМИТЬ ЗА ${state.totalPrice} ₽`);
}

async function createInvoice() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    tg.MainButton.showProgress();

    try {
        const data = await apiCreateInvoice({
            tg_id: tg_id,
            days: state.months * 30,
            amount: state.totalPrice,
            payment_method: state.paymentMethod,
            device_count: state.devices,
            gb_limit: state.gbLimit || 100
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

// ==================== TASKS ====================

async function checkSubscription() {
    const btn = document.getElementById('btn-check-sub');
    const tg_id = tg.initDataUnsafe?.user?.id;
    btn.innerText = "Проверяем...";
    btn.disabled = true;

    try {
        const data = await apiCheckTask(tg_id);
        if (data.status === "success") {
            btn.innerText = "Выполнено (+3 дня)";
            btn.classList.add("bg-green-500/20", "text-green-400");
            tg.showAlert("3 бонусных дня начислены!");
            init();
        } else if (data.status === "already_done") {
            tg.showAlert("Вы уже получали этот бонус.");
            btn.innerText = "Уже получено";
        } else {
            tg.showAlert("Вы еще не подписаны на канал.");
            btn.innerText = "Проверить подписку";
            btn.disabled = false;
        }
    } catch (err) {
        btn.innerText = "Проверить подписку";
        btn.disabled = false;
    }
}

// ==================== UTILS ====================

function toggleKeyBlur(element) {
    if (element.classList.contains('blur-sm')) {
        element.classList.remove('blur-sm', 'truncate');
        element.classList.add('break-all');
    } else {
        element.classList.add('blur-sm', 'truncate');
        element.classList.remove('break-all');
    }
}

function copyVpnKey(keyType) {
    const u = state.user;
    if (!u) return;
    let textToCopy = "";
    if (keyType === 'sub_url') textToCopy = u.sub_url;
    else if (keyType === 'vless_link') textToCopy = u.vless_link;
    else if (keyType === 'route_v2box') textToCopy = ROUTE_V2BOX;
    else if (keyType === 'route_happ') textToCopy = ROUTE_HAPP;
    
    if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            tg.showAlert("✅ Ключ скопирован в буфер обмена!");
        }).catch(err => {
            const tempInput = document.createElement("input");
            tempInput.value = textToCopy;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand("copy");
            document.body.removeChild(tempInput);
            tg.showAlert("✅ Ключ скопирован в буфер обмена!");
        });
    }
}

function updateRefIcons(count) {
    [1, 5, 10].forEach(t => {
        const icon = document.getElementById(`ref-icon-${t}`);
        if (count >= t) {
            icon.classList.remove('bg-white/5', 'text-gray-500');
            icon.classList.add('bg-green-500/20', 'text-green-400');
        }
    });
}

function copyRefLink() {
    const input = document.getElementById('ref-url');
    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value).then(() => {
        tg.showAlert("Ссылка скопирована! Отправь её друзьям.");
    });
}

function setupMainButton() {
    tg.MainButton.setParams({ text: `ОФОРМИТЬ`, color: "#3b82f6", text_color: "#ffffff" });
    tg.MainButton.onClick(createInvoice);
}

document.addEventListener("DOMContentLoaded", init);
