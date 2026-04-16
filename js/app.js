/* =========================================================
   Nemo VPN VIP - App Logic
   Полная интеграция Профиля, Тарифов и Оплаты
========================================================= */

const tg = window.Telegram.WebApp;
tg.expand();

// Состояние приложения
let state = {
    user: null,
    months: 1,
    devices: 1,
    totalPrice: 300,
    paymentMethod: 'cryptopay' // 'cryptopay' или 'platega'
};

const BASE_PRICE = 300;
const DEVICE_EXTRA_PRICE = 100;

// Статические ключи маршрутизации (для VIP)
const ROUTE_V2BOX = "v2box://routes?multi=W3sibGlzdCI6WyJnZW9zaXRlOnJ1IiwiZG9tYWluOnJ1IiwiZG9tYWluOtGA0YQiXSwiaXNFbmFibGUiOnRydWUsIm1hdGNoTW9kZSI6ImRvbWFpbiIsIm5hbWUiOiJyb3V0ZS4zRjFENTdBOS0xRkZELTQ5MkMtOTY2NS1BRTJDNDU4QzE0QUIiLCJyZW1hcmsiOiJEaXJlY3QgUlUiLCJsaXN0SVAiOlsiZ2VvaXA6cnUiLCJnZW9pcDpwcml2YXRlIl0sInR5cGUiOiJJUCIsInRhZyI6ImRpcmVjdCJ9XQ==";
const ROUTE_HAPP = "happ://routing/add/eyJEbnNIb3N0cyI6e30sIkRvbWFpblN0cmF0ZWd5IjoiSVBJZk5vbk1hdGNoIiwiQmxvY2tTaXRlcyI6W10sIkxhc3RVcGRhdGVkIjoxNzc1OTYwOTM0LCJEb21lc3RpY0ROU0RvbWFpbiI6Imh0dHBzOlwvXC9kbnMuZ29vZ2xlXC9kbnMtcXVlcnkiLCJEb21lc3RpY0ROU1R5cGUiOiJEb1UiLCJVc2VDaHVua0ZpbGVzIjp0cnVlLCJSb3V0ZU9yZGVyIjoiYmxvY2stZGlyZWN0LXByb3h5IiwiUmVtb3RlRE5TVHlwZSI6IkRvVSIsIk5hbWUiOiLQoNCkIiwiR2xvYmFsUHJveHkiOnRydWUsIlJlbW90ZUROU0lwIjoiMS4xLjEuMSIsIkdlb2lwVXJsIjoiaHR0cHM6XC9cL2dpdGh1Yi5jb21cL0xveWFsc29sZGllclwvdjJyYXktcnVsZXMtZGF0XC9yZWxlYXNlc1wvbGF0ZXN0XC9kb3dubG9hZFwvZ2VvaXAuZGF0IiwiRmFrZURucyI6ZmFsc2UsIkRpcmVjdFNpdGVzIjpbImdlb3NpdGU6Y2F0ZWdvcnktcnUiXSwiQmxvY2tJcCI6W10sIkRpcmVjdElwIjpbIjEwLjAuMC4wXC84IiwiMTcyLjE2LjAuMFwvMTIiLCIxOTIuMTY4LjAuMFwvMTYiLCIxNjkuMjU0LjAuMFwvMTYiLCIyMjQuMC4wLjBcLzQiLCIyNTUuMjU1LjI1NS4yNTUiLCJnZW9pcDpydSJdLCJEb21lc3RpY0ROU0lwIjoiOC44LjguOCIsIlJlbW90ZUROU0RvbWFpbiI6Imh0dHBzOlwvXC9jbG91ZGZsYXJlLWRucy5jb21cL2Rucy1xdWVyeSIsIlByb3h5SXAiOltdLCJQcm94eVNpdGVzIjpbXSwiR2Vvc2l0ZVVybCI6Imh0dHBzOlwvXC9naXRodWIuY29tXC9Mb3lhbHNvbGRpZXJcL3YycmF5LXJ1bGVzLWRhdFwvcmVsZWFzZXNcL2xhdGVzdFwvZG93bmxvYWRcL2dlb3NpdGUuZGF0In0=";

/**
 * Инициализация: Загрузка данных пользователя
 */
async function init() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    
    if (!tg_id) {
        // Для тестов в браузере (удали в продакшене или оставь для отладки)
        console.warn("Запущено вне Telegram");
        document.getElementById('user-name').innerText = "Developer Mode";
        return;
    }

    try {
        const data = await apiGetUser(tg_id);
        if (data.status === 'success') {
            state.user = data.user;
            updateProfileUI();
            
            // Если подписка активна, сразу показываем профиль
            if (state.user.days_left > 0) {
                switchTab('profile');
            } else {
                switchTab('tariff');
            }
        }
    } catch (err) {
        console.error("Ошибка инициализации:", err);
        switchTab('tariff'); // Если профиль не грузится, даем купить
    }

    updatePrice();
    setupMainButton();
}

/**
 * Обновление данных во вкладке Профиль и Задания
 */
function updateProfileUI() {
    const u = state.user;
    if (!u) return;

    // Имя и Аватар
    document.getElementById('user-name').innerText = u.username;
    if (tg.initDataUnsafe?.user?.photo_url) {
        document.getElementById('user-avatar').src = tg.initDataUnsafe.user.photo_url;
    }

    // Дни и Устройства
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

    // Трафик
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

    // Реферальная ссылка
    document.getElementById('ref-url').value = u.ref_link;

    // Достижения рефералов (Галочки)
    updateRefIcons(u.refs_paid_count);

    // === ВЫВОД КЛЮЧЕЙ VPN И МАРШРУТИЗАЦИИ ===
    if (u.sub_url || u.vless_link) {
        let keysContainer = document.getElementById('vpn-keys-container');
        
        // Если контейнера еще нет, создаем его
        if (!keysContainer) {
            keysContainer = document.createElement('div');
            keysContainer.id = 'vpn-keys-container';
            keysContainer.className = 'mt-6 mb-6';
            
            const profileTab = document.getElementById('content-profile');
            if (profileTab) {
                const mt8Elements = profileTab.querySelectorAll('.mt-8');
                if (mt8Elements.length > 0) {
                    profileTab.insertBefore(keysContainer, mt8Elements[0]);
                } else {
                    profileTab.appendChild(keysContainer);
                }
            }
        }

        // Заполняем контейнер ключами (Подписка + VLESS)
        let keysHTML = `
            <h2 class="text-sm uppercase tracking-wider text-gray-400 mb-3 pl-1">Ваши ключи доступа</h2>
            
            ${u.sub_url ? `
            <div class="glass rounded-2xl p-4 mb-3 cursor-pointer transition hover:bg-white/10" onclick="copyVpnKey('sub_url')">
                <div class="flex justify-between items-center mb-2">
                    <div class="font-bold text-sm">🔑 Ключ подписки (Auto)</div>
                    <i class="fa-solid fa-copy text-gray-500"></i>
                </div>
                <div class="text-[10px] text-gray-400 mb-2 leading-tight">
                    Нажмите на строку ключа, чтобы показать его. Нажмите на карточку, чтобы скопировать.
                </div>
                <div class="bg-black/20 rounded p-2 text-xs text-blue-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">
                    ${u.sub_url}
                </div>
            </div>` : ''}

            ${u.vless_link ? `
            <div class="glass rounded-2xl p-4 mb-3 cursor-pointer transition hover:bg-white/10" onclick="copyVpnKey('vless_link')">
                <div class="flex justify-between items-center mb-2">
                    <div class="font-bold text-sm">🔗 VLESS Ключ (Прямой)</div>
                    <i class="fa-solid fa-copy text-gray-500"></i>
                </div>
                <div class="bg-black/20 rounded p-2 text-xs text-blue-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">
                    ${u.vless_link}
                </div>
            </div>` : ''}
        `;

        // Если у пользователя VIP (premium) - добавляем ключи маршрутизации
        if (u.tier === 'premium') {
            keysHTML += `
            <h2 class="text-sm uppercase tracking-wider text-purple-400 mt-5 mb-3 pl-1">🚀 VIP: Обход белых списков</h2>
            
            <div class="glass rounded-2xl p-4 mb-3 cursor-pointer transition hover:bg-white/10 border-purple-500/30" onclick="copyVpnKey('route_v2box')">
                <div class="flex justify-between items-center mb-2">
                    <div class="font-bold text-sm text-purple-300">Маршрутизация V2Box</div>
                    <i class="fa-solid fa-copy text-gray-500"></i>
                </div>
                <div class="bg-black/20 rounded p-2 text-xs text-purple-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">
                    ${ROUTE_V2BOX}
                </div>
            </div>

            <div class="glass rounded-2xl p-4 cursor-pointer transition hover:bg-white/10 border-green-500/30" onclick="copyVpnKey('route_happ')">
                <div class="flex justify-between items-center mb-2">
                    <div class="font-bold text-sm text-green-300">Маршрутизация Happ</div>
                    <i class="fa-solid fa-copy text-gray-500"></i>
                </div>
                <div class="bg-black/20 rounded p-2 text-xs text-green-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">
                    ${ROUTE_HAPP}
                </div>
            </div>
            `;
        }

        keysContainer.innerHTML = keysHTML;
    }
}

/**
 * Раскрытие/скрытие ключа (блюр)
 */
function toggleKeyBlur(element) {
    if (element.classList.contains('blur-sm')) {
        // Раскрываем
        element.classList.remove('blur-sm', 'truncate');
        element.classList.add('break-all');
    } else {
        // Скрываем
        element.classList.add('blur-sm', 'truncate');
        element.classList.remove('break-all');
    }
}

/**
 * Копирование ключа в буфер
 */
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
            console.error("Ошибка копирования:", err);
            // Фолбэк для старых мобильных устройств
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

/**
 * Подсветка иконок рефералов
 */
function updateRefIcons(count) {
    const targets = [1, 5, 10];
    targets.forEach(t => {
        const icon = document.getElementById(`ref-icon-${t}`);
        if (count >= t) {
            icon.classList.remove('bg-white/5', 'text-gray-500');
            icon.classList.add('bg-green-500/20', 'text-green-400');
        }
    });
}

/**
 * Логика вкладок
 */
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

/**
 * Выбор тарифа и устройств
 */
function selectDuration(m) {
    // Защита от багов WebView (если m передается как объект Event)
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
    document.getElementById('pay-cryptopay').classList.toggle('glass-active', method === 'cryptopay');
    document.getElementById('pay-platega').classList.toggle('glass-active', method === 'platega');
}

function updatePrice() {
    const devices = parseInt(state.devices, 10) || 1;
    const months = parseInt(state.months, 10) || 1;

    const baseMonthPrice = BASE_PRICE + ((devices - 1) * DEVICE_EXTRA_PRICE);
    let discountMultiplier = 1.0; 
    
    if (months === 3) {
        discountMultiplier = 0.90; // Скидка 10%
    } else if (months === 6) {
        discountMultiplier = 0.83; // Скидка 17%
    } else if (months === 12) {
        discountMultiplier = 0.75; // Скидка 25%
    }

    let total = Math.round((baseMonthPrice * months) * discountMultiplier);
    
    // Защита от NaN
    if (isNaN(total)) total = BASE_PRICE;

    state.totalPrice = total;
    tg.MainButton.setText(`ОФОРМИТЬ ЗА ${state.totalPrice} ₽`);
}

/**
 * Создание инвойса и переход к оплате
 */
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
            device_count: state.devices
        });
        
        if (data.status === "success" && data.pay_url) {
            // === ИСПРАВЛЕНИЕ: Используем правильный метод для Telegram ссылок ===
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

/**
 * Проверка подписки
 */
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
            init(); // Обновляем данные профиля
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

/**
 * Рефералы: Копирование ссылки
 */
function copyRefLink() {
    const input = document.getElementById('ref-url');
    input.select();
    input.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(input.value).then(() => {
        tg.showAlert("Ссылка скопирована! Отправь её друзьям.");
    });
}

function setupMainButton() {
    tg.MainButton.setParams({
        text: `ОФОРМИТЬ`,
        color: "#3b82f6",
        text_color: "#ffffff"
    });
    tg.MainButton.onClick(createInvoice);
}

document.addEventListener("DOMContentLoaded", init);
