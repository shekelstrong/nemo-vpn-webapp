/* =========================================================
   Nemo VPN VIP - API Service
   Отвечает за связь Mini App с Python-бэкендом
========================================================= */

// ВАЖНО: Укажи здесь URL/IP твоего сервера, где крутится бот
const BACKEND_URL = "https://ТВОЙ_ДОМЕН_ИЛИ_IP:8080"; 

/**
 * Создает счет на оплату в базе данных бота.
 * @param {Object} payload - Данные для инвойса {tg_id, days, tier, device_count, amount, payment_method}
 * @returns {Promise<Object>} Ответ сервера
 */
async function apiCreateInvoice(payload) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        return await response.json();
    } catch (error) {
        console.error("API Error (createInvoice):", error);
        throw new Error("Не удалось связаться с сервером.");
    }
}

/**
 * Проверяет подписку на Telegram-канал и начисляет бонусные дни.
 * @param {number} tg_id - Telegram ID пользователя
 * @returns {Promise<Object>} Ответ сервера
 */
async function apiCheckTask(tg_id) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/check_task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tg_id: tg_id })
        });
        
        return await response.json();
    } catch (error) {
        console.error("API Error (checkTask):", error);
        throw new Error("Не удалось связаться с сервером.");
    }
}