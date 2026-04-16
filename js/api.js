/* =========================================================
   Nemo VPN VIP - API Service
   Отвечает за связь Mini App с Python-бэкендом
========================================================= */

// Наш основной домен для запросов
const BACKEND_URL = "https://nemovpn.cfd"; 

/**
 * Получает полные данные профиля пользователя.
 * @param {number} tg_id - Telegram ID пользователя
 * @returns {Promise<Object>} Данные профиля {user: {username, used_traffic, days_left, ...}}
 */
async function apiGetUser(tg_id) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/user?tg_id=${tg_id}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error("Пользователь не найден или ошибка сервера.");
        return await response.json();
    } catch (error) {
        console.error("API Error (getUser):", error);
        throw error;
    }
}

/**
 * Создает счет и получает реальную ссылку на оплату.
 * @param {Object} payload - {tg_id, days, amount, payment_method, device_count}
 * @returns {Promise<Object>} Ответ с pay_url
 */
async function apiCreateInvoice(payload) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ошибка при создании счета.");
        return data;
    } catch (error) {
        console.error("API Error (createInvoice):", error);
        throw error;
    }
}

/**
 * Проверяет подписку на Telegram-канал.
 * @param {number} tg_id - Telegram ID пользователя
 * @returns {Promise<Object>} Статус проверки
 */
async function apiCheckTask(tg_id) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/check_task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tg_id: tg_id })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ошибка связи с ботом.");
        return data;
    } catch (error) {
        console.error("API Error (checkTask):", error);
        throw error;
    }
}
