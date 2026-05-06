<div align="center">

# 🌊 Nemo VPN — Mini App

**Telegram Web App for VPN subscription management**

[![JavaScript](https://img.shields.io/badge/javascript-ES2022-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Tailwind CSS](https://img.shields.io/badge/tailwind-3.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/vercel-deployed-000?logo=vercel&logoColor=white)](https://vercel.com)
[![Telegram](https://img.shields.io/badge/telegram-mini_app-26A5E4?logo=telegram&logoColor=white)](https://core.telegram.org/bots/webapps)

**[→ Open Mini App](https://nemo-vpn-webapp.vercel.app)**

</div>

## ✨ Features

- 📱 **Profile** — subscription status, traffic usage, VPN keys
- 💳 **Purchase** — crypto & card/SBP payments
- 🚀 **Two tiers** — Standard & VIP with traffic limits
- 🔗 **VK Integration** — shows VK subscription data if linked
- 🎁 **Gift VPN** — buy subscriptions for friends
- 📦 **Traffic top-up** — add extra GB to premium plan
- 👥 **Referrals** — invite friends, track bonuses
- 🔑 **VPN Keys** — copy subscription URL & VLESS link with blur toggle
- 🔄 **Key regeneration** — rotate VPN keys securely

## 🏗 Architecture

```
┌──────────────────┐     ┌──────────────┐     ┌────────────┐
│  Telegram Mini   │────▶│  Backend API │────▶│  Marzban   │
│  App (this repo) │     │  (TG Bot)    │     │    API     │
│  Vercel CDN      │     │  Docker      │     │            │
└──────────────────┘     └──────────────┘     └────────────┘
```

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Vanilla JavaScript |
| Styling | Tailwind CSS (CDN) |
| Icons | Font Awesome 6 |
| Hosting | Vercel (auto-deploy from GitHub) |
| API | Nemo VPN Backend (aiohttp) |
| Auth | Telegram WebApp initData validation |

## 📁 Project Structure

```
nemo-vpn-webapp/
├── index.html          # Main SPA layout
├── css/
│   └── style.css       # Custom styles + glass morphism
├── js/
│   ├── api.js          # API service (fetch wrapper)
│   └── app.js          # App logic, state, UI rendering
└── vercel.json         # (auto-deploy from GitHub push)
```

## 🎨 UI Tabs

| Tab | Description |
|-----|------------|
| 🧑 **Profile** | User info, subscription status, traffic bar, VPN keys |
| 💳 **Subscription** | Tier selection, duration, payment methods |
| ✅ **Tasks** | Channel subscription bonus, referral link |
| ❓ **Help** | App links (Happ), support contact |

## 🔗 Related

- [Telegram Bot](https://github.com/shekelstrong/vpn_bot) — Backend + TG bot
- [VK Bot](https://github.com/shekelstrong/vpn-vk-bot) — VK Community version
- [Nemo VPN Landing](https://github.com/shekelstrong/nemo-landing) — Website

---

<div align="center">
<sub>Built with ❤️ by <a href="https://github.com/shekelstrong">shekelstrong</a></sub>
</div>
