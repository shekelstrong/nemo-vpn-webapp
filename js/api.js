/* =========================================================
   Nemo VPN VIP - API Service
   Отвечает за связь Mini App с Python-бэкендом
========================================================= */

const BACKEND_URL = "https://nemovpn.cfd"; 

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

/**
 * Докупка трафика — создать инвойс
 * @param {number} tg_id
 * @param {number} gb - сколько ГБ докупить
 * @param {number} price - цена в рублях
 * @param {string} payment_method - 'cryptopay' или 'platega'
 */
async function apiBuyTraffic(tg_id, gb, price, payment_method) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/buy_traffic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tg_id, gb, price, payment_method })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ошибка при покупке трафика.");
        return data;
    } catch (error) {
        console.error("API Error (buyTraffic):", error);
        throw error;
    }
}

/**
 * Создать подарочную подписку
 * @param {number} tg_id - кто дарит
 * @param {string} tier - 'standard' или 'premium'
 * @param {number} days - кол-во дней
 * @param {string} payment_method
 */
async function apiCreateGift(tg_id, tier, days, payment_method) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/create_gift`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tg_id, tier, days, payment_method })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ошибка при создании подарка.");
        return data;
    } catch (error) {
        console.error("API Error (createGift):", error);
        throw error;
    }
}

/**
 * Оплатить подписку из реферального баланса
 * @param {number} tg_id
 * @param {number} days
 * @param {string} tier
 */
async function apiPayFromReferral(tg_id, days, tier) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/pay_referral`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tg_id, days, tier })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Недостаточно средств на балансе.");
        return data;
    } catch (error) {
        console.error("API Error (payFromReferral):", error);
        throw error;
    }
}
