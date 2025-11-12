const ARABIC_NAMES = [
  "Aaliyah", "Abdul", "Abdullah", "Abed", "Abir", "Abu", "Adel", "Adnan",
  "Afra", "Ahmad", "Aisha", "Akram", "Alaa", "Ali", "Alia", "Amal",
  "Amira", "Amr", "Anas", "Asim", "Aya", "Ayman", "Aziza", "Basel",
  "Basima", "Bilal", "Dalal", "Dina", "Ehab", "Fadi", "Farah", "Faris",
  "Fatima", "Ghassan", "Habib", "Hadeel", "Hadi", "Hala", "Hamid", "Hanin",
  "Hassan", "Haya", "Husam", "Iman", "Jamal", "Jasmine", "Kamal", "Karim",
  "Khaled", "Laila", "Leen", "Lubna", "Maha", "Maher", "Malak", "Mansour",
  "Mariam", "Marwan", "Maya", "Miral", "Nabil", "Nadia", "Nadir", "Noura",
  "Omar", "Qasim", "Rana", "Rania", "Rashid", "Rayan", "Reem", "Saad",
  "Sami", "Samira", "Selim", "Shadi", "Sumaya", "Tala", "Tariq", "Wafa",
  "Waheed", "Yara", "Yasin", "Yousef", "Yumna", "Zain", "Zainab", "Ziad"
];

const MAX_FEED_SIZE = 50;
const ONE_MINUTE = 60_000;

function randomAmount() {
  const base = Math.random() * (750 - 25) + 25;
  return Number(base.toFixed(2));
}

function randomAsset() {
  const assets = ["BTC", "ETH", "Gold", "Silver"];
  return assets[Math.floor(Math.random() * assets.length)];
}

function randomName() {
  return ARABIC_NAMES[Math.floor(Math.random() * ARABIC_NAMES.length)];
}

class NotificationService {
  constructor() {
    this.feed = [];
    this.listeners = new Set();
    this.timer = null;
    this.start();
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.generateFake(), ONE_MINUTE);
    this.generateFake();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  onBroadcast(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  generateFake() {
    const notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: randomName(),
      asset: randomAsset(),
      amount: randomAmount(),
      type: Math.random() > 0.5 ? "deposit" : "profit",
      createdAt: new Date().toISOString(),
      fake: true
    };
    this.add(notification);
    return notification;
  }

  add(notification) {
    this.feed.push(notification);
    if (this.feed.length > MAX_FEED_SIZE) {
      this.feed = this.feed.slice(-MAX_FEED_SIZE);
    }
    const payload = JSON.stringify({ type: "notification", data: notification });
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        // ignore listener errors to keep feed healthy
      }
    });
  }

  all(limit = 20) {
    return this.feed.slice(-limit).reverse();
  }
}

export const notificationService = new NotificationService();
