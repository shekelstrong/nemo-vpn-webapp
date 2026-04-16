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
    state.months = m;
    [1, 3, 6, 12].forEach(val => {
        document.getElementById(`dur-${val}`).classList.toggle('glass-active', val === m);
    });
    updatePrice();
}

function changeDevices(delta) {
    const n = state.devices + delta;
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
    const pricePerMonth = BASE_PRICE + ((state.devices - 1) * DEVICE_EXTRA_PRICE);
    state.totalPrice = pricePerMonth * state.months;
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
            // Открываем платежную ссылку во внешнем браузере или внутри ТГ
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
