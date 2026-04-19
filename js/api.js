/* =========================================================
   Nemo VPN - API Service
   Mini App ↔ Python backend
========================================================= */

const BACKEND_URL = "https://nemovpn.cfd"; 

async function apiGetUser(tg_id) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/user?tg_id=${tg_id}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error("Пользователь не найден");
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
        if (!response.ok) throw new Error(data.error || "Ошибка создания счёта");
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
            body: JSON.stringify({ tg_id })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ошибка");
        return data;
    } catch (error) {
        console.error("API Error (checkTask):", error);
        throw error;
    }
}

async function apiBuyTraffic(tg_id, gb, price, payment_method) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/buy_traffic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tg_id, gb, price, payment_method })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ошибка покупки трафика");
        return data;
    } catch (error) {
        console.error("API Error (buyTraffic):", error);
        throw error;
    }
}

async function apiBuyTrafficReferral(tg_id, gb, price) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/buy_traffic_referral`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tg_id, gb, price })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ошибка");
        return data;
    } catch (error) {
        console.error("API Error (buyTrafficReferral):", error);
        throw error;
    }
}

async function apiCreateGift(tg_id, tier, months, price, payment_method) {
    try {
        const days = months * 30;
        const response = await fetch(`${BACKEND_URL}/api/create_gift`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tg_id, tier, days, price, payment_method })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ошибка создания подарка");
        return data;
    } catch (error) {
        console.error("API Error (createGift):", error);
        throw error;
    }
}

async function apiPayFromReferral(tg_id, days, tier, amount) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/pay_referral`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tg_id, days, tier, amount })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Недостаточно средств");
        return data;
    } catch (error) {
        console.error("API Error (payFromReferral):", error);
        throw error;
    }
}
