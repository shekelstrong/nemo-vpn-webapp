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

/**
 * Инициализация: Загрузка данных пользователя
 */
async function init() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    
    if (!tg_id) {
        // Для тестов в браузере (удали в продакшене или оставь для отладки)
        console.warn("Запущено вне Telegram");
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.innerText = "Developer Mode";
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
    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.innerText = u.username;
    
    if (tg.initDataUnsafe?.user?.photo_url) {
        const avatarEl = document.getElementById('user-avatar');
        if (avatarEl) avatarEl.src = tg.initDataUnsafe.user.photo_url;
    }

    // Дни и Устройства
    const daysEl = document.getElementById('days-left');
    if (daysEl) daysEl.innerText = u.days_left;
    
    const devEl = document.getElementById('profile-devices');
    if (devEl) devEl.innerText = u.device_count;
    
    const statusText = document.getElementById('status-text');
    if (statusText) {
        if (u.days_left > 0) {
            statusText.innerText = "Активен";
            statusText.classList.remove('text-red-400');
            statusText.classList.add('text-blue-400');
        } else {
            statusText.innerText = "Истек";
            statusText.classList.remove('text-blue-400');
            statusText.classList.add('text-red-400');
        }
    }

    // Трафик
    const used = u.used_traffic || 0;
    const limit = u.gb_limit || 0;
    const usedEl = document.getElementById('used-gb');
    if (usedEl) usedEl.innerText = used;
    
    const totalEl = document.getElementById('total-gb');
    if (totalEl) totalEl.innerText = limit > 0 ? limit : "∞";
    
    const barEl = document.getElementById('traffic-bar');
    if (barEl) {
        if (limit > 0) {
            const percent = Math.min((used / limit) * 100, 100);
            barEl.style.width = `${percent}%`;
        } else {
            barEl.style.width = `0%`;
        }
    }

    // Реферальная ссылка
    const refUrlEl = document.getElementById('ref-url');
    if (refUrlEl) refUrlEl.value = u.ref_link;

    // Достижения рефералов (Галочки)
    updateRefIcons(u.refs_paid_count);

    // === ВЫВОД КЛЮЧЕЙ VPN (НОВЫЙ ФУНКЦИОНАЛ) ===
    if (u.sub_url || u.vless_link) {
        let keysContainer = document.getElementById('vpn-keys-container');
        
        // Если контейнера еще нет, создаем его
        if (!keysContainer) {
            keysContainer = document.createElement('div');
            keysContainer.id = 'vpn-keys-container';
            keysContainer.className = 'mt-6 mb-6';
            
            // Пытаемся найти куда вставить (перед блоком рефералки)
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

        // Заполняем контейнер ключами
        keysContainer.innerHTML = `
            <h2 class="text-sm uppercase tracking-wider text-gray-400 mb-3 pl-1">Ваши ключи доступа</h2>
            
            ${u.sub_url ? `
            <div class="glass rounded-2xl p-4 mb-3 cursor-pointer transition hover:bg-white/10" onclick="copyVpnKey('sub_url')">
                <div class="flex justify-between items-center mb-2">
                    <div class="font-bold text-sm">🔑 Ключ подписки (Auto)</div>
                    <i class="fa-solid fa-copy text-gray-500"></i>
                </div>
                <div class="text-[10px] text-gray-400 mb-2 leading-tight">
                    Нажмите на саму строку ключа, чтобы показать его. Нажмите на всю карточку, чтобы скопировать.
                </div>
                <div class="bg-black/20 rounded p-2 text-xs text-blue-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">
                    ${u.sub_url}
                </div>
            </div>` : ''}

            ${u.vless_link ? `
            <div class="glass rounded-2xl p-4 cursor-pointer transition hover:bg-white/10" onclick="copyVpnKey('vless_link')">
                <div class="flex justify-between items-center mb-2">
                    <div class="font-bold text-sm">🔗 VLESS Ключ (Прямой)</div>
                    <i class="fa-solid fa-copy text-gray-500"></i>
                </div>
                <div class="bg-black/20 rounded p-2 text-xs text-blue-400 blur-sm truncate transition-all duration-300" onclick="event.stopPropagation(); toggleKeyBlur(this)">
                    ${u.vless_link}
                </div>
            </div>` : ''}
        `;
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
    
    const textToCopy = keyType === 'sub_url' ? u.sub_url : u.vless_link;
    
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
        if (icon) {
            if (count >= t) {
                icon.classList.remove('bg-white/5', 'text-gray-500');
                icon.classList.add('bg-green-500/20', 'text-green-400');
            }
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

    const contentEl = document.getElementById(`content-${tabName}`);
    if (contentEl) contentEl.classList.add('active');
    
    const tabEl = document.getElementById(`tab-${tabName}`);
    if (tabEl) {
        tabEl.classList.remove('text-gray-400');
        tabEl.classList.add('text-blue-400');
    }

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
    state.months = parseInt(m);
    [1, 3, 6, 12].forEach(val => {
        const durEl = document.getElementById(`dur-${val}`);
        if (durEl) {
            durEl.classList.toggle('glass-active', val === state.months);
        }
    });
    updatePrice();
}

function changeDevices(delta) {
    const n = state.devices + delta;
    if (n >= 1 && n <= 10) {
        state.devices = n;
        const countEl = document.getElementById('device-count');
        if (countEl) countEl.innerText = n;
        updatePrice();
    }
}

function selectPayment(method) {
    state.paymentMethod = method;
    const cryptoEl = document.getElementById('pay-cryptopay');
    if (cryptoEl) cryptoEl.classList.toggle('glass-active', method === 'cryptopay');
    
    const plategaEl = document.getElementById('pay-platega');
    if (plategaEl) plategaEl.classList.toggle('glass-active', method === 'platega');
}

/**
 * Обновление цены с учетом математической модели скидок
 */
function updatePrice() {
    // 1. Базовая цена за месяц с учетом количества устройств
    const baseMonthPrice = BASE_PRICE + ((state.devices - 1) * DEVICE_EXTRA_PRICE);
    
    // 2. Определяем скидку в зависимости от длительности
    let discountMultiplier = 1.0; 
    
    if (state.months === 3) {
        discountMultiplier = 0.90; // Скидка 10%
    } else if (state.months === 6) {
        discountMultiplier = 0.83; // Скидка 17%
    } else if (state.months === 12) {
        discountMultiplier = 0.75; // Скидка 25%
    }

    // 3. Считаем итоговую цену: (Цена за 1 мес * Кол-во месяцев) * Скидку
    state.totalPrice = Math.round((baseMonthPrice * state.months) * discountMultiplier);
    
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
            // Открываем платежную ссылку
            tg.openLink(data.pay_url);
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
    
    if (btn) {
        btn.innerText = "Проверяем...";
        btn.disabled = true;
    }

    try {
        const data = await apiCheckTask(tg_id);
        if (data.status === "success") {
            if (btn) {
                btn.innerText = "Выполнено (+3 дня)";
                btn.classList.add("bg-green-500/20", "text-green-400");
            }
            tg.showAlert("🎉 3 бонусных дня начислены!");
            init(); // Обновляем данные профиля
        } else if (data.status === "already_done") {
            tg.showAlert("Вы уже получали этот бонус.");
            if (btn) btn.innerText = "Уже получено";
        } else {
            tg.showAlert("Вы еще не подписаны на канал.");
            if (btn) {
                btn.innerText = "Проверить подписку";
                btn.disabled = false;
            }
        }
    } catch (err) {
        if (btn) {
            btn.innerText = "Проверить подписку";
            btn.disabled = false;
        }
    }
}

/**
 * Рефералы: Копирование ссылки
 */
function copyRefLink() {
    const input = document.getElementById('ref-url');
    if (!input) return;
    
    input.select();
    input.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(input.value).then(() => {
        tg.showAlert("🔗 Ссылка скопирована! Отправь её друзьям.");
    }).catch(err => {
        document.execCommand("copy");
        tg.showAlert("🔗 Ссылка скопирована! Отправь её друзьям.");
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
