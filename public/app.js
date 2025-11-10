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
