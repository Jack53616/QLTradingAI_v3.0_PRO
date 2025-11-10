async function apiFetch(url, options = {}) {
  // 🧩 تحديد الـ base URL حسب بيئة التشغيل
  const base =
    window.API_BASE_URL ||
    document.querySelector('meta[name="api-base"]')?.content ||
    (window.location.hostname.includes("localhost") ||
    window.location.hostname.includes("127.0.0.1")
      ? "http://localhost:10000"
      : "https://qltrading-render.onrender.com");

  // 🧠 إعداد الترويسات headers بشكل ذكي
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    ...(options.headers || {}),
  };

  // ✅ تمرير بيانات التلغرام دائماً إن وُجدت
  if (state.initData) {
    headers["x-telegram-initdata"] = state.initData;
  } else {
    console.warn("⚠️ Telegram initData غير موجود — سيتم الإرسال بدونها.");
  }

  const fullUrl = url.startsWith("http") ? url : `${base}${url}`;

  // 🔍 سجل معلومات الطلب بالكونسول
  console.log("🌐 apiFetch →", {
    url: fullUrl,
    method: options.method || "GET",
    hasInitData: !!state.initData,
    headers,
    body: options.body || null,
  });

  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers,
      credentials: "include",
    });

    // 🧾 تسجيل النتيجة بالكونسول
    if (!res.ok) {
      console.error(
        `❌ API Error (${res.status}): ${res.statusText}`,
        await res.text()
      );
    } else {
      console.log(`✅ API Response ${res.status}: ${fullUrl}`);
    }

    return res;
  } catch (err) {
    console.error("🚨 Network or Fetch Error:", err);
    throw err;
  }
}

// 🧠 تشغيل التطبيق بعد تحميل الصفحة// 🧠 تشغيل التطبيق بعد تحميل الصفحة
async function bootstrap() {
  console.log("🚀 Bootstrapping QL Trading AI...");
  await setLanguage(state.lang);

  // تأخير بسيط للتحميل السلس
  await new Promise((resolve) => setTimeout(resolve, 900));

  let profileLoaded = false;

  try {
    console.log("🔍 Checking user profile via /api/users/me...");
    const res = await apiFetch("/api/users/me", { method: "GET" });

    if (!res) {
      console.warn("⚠️ No response from API");
    } else {
      console.log("🧾 Response status:", res.status);
      const data = await safeJson(res);
      console.log("📦 Response data:", data);

      if (data?.ok && data.user) {
        state.user = data.user;
        profileLoaded = true;
        updateProfile();
        console.log("✅ Profile loaded for:", data.user.name || data.user.id);
      } else {
        console.warn("⚠️ No valid user returned, showing subscription screen");
      }
    }
  } catch (err) {
    console.error("❌ Error fetching user profile:", err);
  }

  // دايمًا نغلق شاشة التحميل مهما صار
  dismissLoader();

  if (profileLoaded) {
    showElement(app);
    hideElement(subscriptionScreen);
    loadDashboard();
    startLiveFeed();
    scheduleDashboardRefresh();
  } else {
    hideElement(app);
    showElement(subscriptionScreen);
    startLiveFeed();
  }
}

// 🚀 استدعاء التشغيل مباشرة عند تحميل الصفحة
bootstrap();

