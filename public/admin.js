const tokenInput = document.getElementById("adminToken");
const loginBtn = document.getElementById("loginBtn");
const dashboard = document.getElementById("dashboard");
const loginBox = document.getElementById("loginBox");
const refreshBtn = document.getElementById("refreshUsers");
const tbody = document.querySelector("#usersTable tbody");
const loader = document.getElementById("loadingIndicator");

let jwt = localStorage.getItem("admin_jwt") || "";

// 🔹 إظهار/إخفاء التحميل
function showLoader(show = true) {
  if (!loader) return;
  loader.style.display = show ? "block" : "none";
}

// ✅ تسجيل الدخول للأدمن
async function login() {
  const token = tokenInput.value.trim();
  if (!token) return alert("Please enter admin token");

  showLoader(true);
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    if (data.ok) {
      jwt = data.jwt;
      localStorage.setItem("admin_jwt", jwt);
      loginBox.classList.add("hidden");
      dashboard.classList.remove("hidden");
      loadUsers();
    } else {
      alert("❌ Invalid admin token");
    }
  } catch (err) {
    console.error("Login error:", err);
    alert("Server error while logging in");
  } finally {
    showLoader(false);
  }
}

// ✅ تحميل المستخدمين
async function loadUsers() {
  showLoader(true);
  try {
    const res = await fetch("/api/admin/users", {
      headers: { Authorization: "Bearer " + jwt },
    });
    const data = await res.json();

    if (!data.ok) {
      alert("Session expired. Please login again.");
      localStorage.removeItem("admin_jwt");
      dashboard.classList.add("hidden");
      loginBox.classList.remove("hidden");
      return;
    }

    tbody.innerHTML = "";
    data.users.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.name || "-"}</td>
        <td>${u.level}</td>
        <td>${u.sub_expires ? new Date(u.sub_expires).toLocaleDateString() : "-"}</td>
        <td><button class="viewBtn" data-id="${u.id}">👁 View</button></td>
      `;
      tbody.appendChild(tr);
    });

    // ✅ أزرار عرض التفاصيل
    document.querySelectorAll(".viewBtn").forEach((btn) => {
      btn.addEventListener("click", () => showUserDetails(btn.dataset.id));
    });
  } catch (err) {
    console.error("Error loading users:", err);
    alert("Error loading users");
  } finally {
    showLoader(false);
  }
}

// ✅ عرض تفاصيل المستخدم في نافذة بسيطة
async function showUserDetails(id) {
  showLoader(true);
  try {
    const res = await fetch(`/api/admin/user/${id}`, {
      headers: { Authorization: "Bearer " + jwt },
    });
    const data = await res.json();
    if (!data.ok) return alert("Failed to load user data.");

    const u = data.user;
    alert(`
👤 User ID: ${u.id}
📛 Name: ${u.name || "-"}
💰 Balance: ${u.balance}$
⭐ Level: ${u.level}
📅 Subscription: ${u.sub_expires ? new Date(u.sub_expires).toLocaleDateString() : "-"}
📈 Trades: ${u.trades_count || 0}
    `);
  } catch (err) {
    console.error("User details error:", err);
  } finally {
    showLoader(false);
  }
}

// ✅ أحداث الأزرار
loginBtn.addEventListener("click", login);
refreshBtn.addEventListener("click", loadUsers);

// ✅ تسجيل الدخول التلقائي في حال وجود توكن محفوظ
if (jwt) {
  loginBox.classList.add("hidden");
  dashboard.classList.remove("hidden");
  loadUsers();
}
