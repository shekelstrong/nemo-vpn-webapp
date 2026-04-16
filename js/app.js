/* =========================================================
   Nemo VPN VIP - App Logic
   Логика интерфейса, калькулятора и взаимодействия с Telegram
========================================================= */

// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand(); // Открываем приложение на весь экран

// Базовые константы цен
const BASE_PRICE = 300;
const DEVICE_EXTRA_PRICE = 100;

// Состояние приложения
let state = {
    months: 1,
    devices: 1,
    totalPrice: 300
};

const durations = [1, 3, 6, 12];

/**
 * Инициализация при старте
 */
function init() {
    updatePrice();
    setupMainButton();
}

/**
 * Переключение вкладок (Подписка / Задания / Помощь)
 * @param {string} tabName
 */
function switchTab(tabName) {
    // Скрываем все
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('[id^="tab-"]').forEach(el => {
        el.classList.remove('text-blue-400');
        el.classList.add('text-gray-400');
    });

    // Показываем нужный
    document.getElementById(`content-${tabName}`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.remove('text-gray-400');
    document.getElementById(`tab-${tabName}`).classList.add('text-blue-400');

    // Кнопка оплаты нужна только на главной вкладке тарифов
    if (tabName === 'tariff') {
        tg.MainButton.show();
    } else {
        tg.MainButton.hide();
    }
}

/**
 * Выбор длительности подписки
 * @param {number} months
 */
function selectDuration(months) {
    state.months = months;
    durations.forEach(d => {
        const el = document.getElementById(`dur-${d}`);
        if (d === months) {
            el.classList.add('glass-active');
        } else {
            el.classList.remove('glass-active');
        }
    });
    updatePrice();
}

/**
 * Изменение количества устройств (+ / -)
 * @param {number} delta
 */
function changeDevices(delta) {
    const newValue = state.devices + delta;
    // Ограничение от 1 до 10 устройств
    if (newValue >= 1 && newValue <= 10) {
        state.devices = newValue;
        document.getElementById('device-count').innerText = state.devices;
        updatePrice();
    }
}

/**
 * Перерасчет итоговой стоимости
 */
function updatePrice() {
    // Логика: (Базовая цена + (устройства - 1) * цена доп. устройства) * кол-во месяцев
    const pricePerMonth = BASE_PRICE + ((state.devices - 1) * DEVICE_EXTRA_PRICE);
    state.totalPrice = pricePerMonth * state.months;
    
    tg.MainButton.setText(`ОФОРМИТЬ ЗА ${state.totalPrice} ₽`);
}

/**
 * Настройка главной кнопки Telegram (MainButton)
 */
function setupMainButton() {
    tg.MainButton.setText(`ОФОРМИТЬ ЗА ${state.totalPrice} ₽`);
    tg.MainButton.textColor = "#ffffff";
    tg.MainButton.color = "#3b82f6";
    tg.MainButton.show();

    // Привязываем событие клика
    tg.MainButton.onClick(() => {
        createInvoice();
    });
}

/**
 * Создание инвойса при нажатии на кнопку оформления
 */
async function createInvoice() {
    const tg_id = tg.initDataUnsafe?.user?.id;
    
    // Защита: проверяем, что открыто именно в Telegram
    if (!tg_id) {
        tg.showAlert("Ошибка: Откройте приложение через Telegram.");
        return;
    }

    tg.MainButton.showProgress();

    try {
        // Переводим месяцы в дни
        const days = state.months * 30;

        // Вызываем функцию из api.js
        const data = await apiCreateInvoice({
            tg_id: tg_id,
            days: days,
            tier: "premium",
            device_count: state.devices,
            amount: state.totalPrice,
            payment_method: "cryptopay" // По умолчанию крипта (можно расширить)
        });
        
        if (data.status === "success") {
            tg.showAlert("Счет успешно создан! Пожалуйста, вернитесь в чат с ботом для оплаты.", () => {
                tg.close();
            });
        } else {
            tg.showAlert("Ошибка создания счета: " + (data.error || "Неизвестная ошибка"));
        }
    } catch (err) {
        tg.showAlert(err.message);
    } finally {
        tg.MainButton.hideProgress();
    }
}

/**
 * Проверка выполнения задания: Подписка на канал
 */
async function checkSubscription() {
    const btn = document.getElementById('btn-check-sub');
    const tg_id = tg.initDataUnsafe?.user?.id;
    
    if (!tg_id) {
        return tg.showAlert("Ошибка: Откройте приложение через Telegram.");
    }

    // Блокируем кнопку на время проверки
    btn.innerText = "Проверяем...";
    btn.disabled = true;

    try {
        // Вызываем функцию из api.js
        const data = await apiCheckTask(tg_id);
        
        if (data.status === "success") {
            btn.innerText = "Выполнено (+3 дня)";
            btn.classList.add("bg-green-500/20", "text-green-400");
            tg.showAlert("Успешно! Вам начислено 3 бонусных дня.");
        } else if (data.status === "already_done") {
            btn.innerText = "Уже выполнено";
            tg.showAlert("Вы уже получали этот бонус.");
        } else {
            // Если не подписан
            btn.innerText = "Проверить подписку";
            btn.disabled = false;
            tg.showAlert("Вы не подписаны на канал. Подпишитесь и попробуйте снова.");
        }
    } catch (err) {
        btn.innerText = "Проверить подписку";
        btn.disabled = false;
        tg.showAlert(err.message);
    }
}

// Запускаем приложение при загрузке DOM
document.addEventListener("DOMContentLoaded", () => {
    init();
});