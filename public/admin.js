const tokenInput = document.getElementById("adminToken");
const loginBtn = document.getElementById("loginBtn");
const dashboard = document.getElementById("dashboard");
const loginBox = document.getElementById("loginBox");
const refreshBtn = document.getElementById("refreshUsers");
const tbody = document.querySelector("#usersTable tbody");
const loader = document.getElementById("loadingIndicator");

let jwt = localStorage.getItem("admin_jwt") || "";

// 🔹 إظهار أو إخفاء مؤشر التحميل
function showLoader(show = true) {
  if (!loader) return;
  loader.style.display = show ? "block" : "none";
}

// ✅ تسجيل دخول الأدمن
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
        <td>${u.balance}$</td>
        <td>${u.sub_expires ? new Date(u.sub_expires).toLocaleDateString() : "-"}</td>
        <td><button class="viewBtn" data-id="${u.id}">👁 View</button></td>
      `;
      tbody.appendChild(tr);
    });

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

// ✅ عرض تفاصيل المستخدم
async function showUserDetails(id) {
  showLoader(true);
  try {
    const res = await fetch(`/api/admin/user/${id}`, {
      headers: { Authorization: "Bearer " + jwt },
    });
    const data = await res.json();
    if (!data.ok) return alert("Failed to load user data.");

    const u = data.user;
    const action = prompt(`
👤 User ID: ${u.id}
📛 Name: ${u.name || "-"}
💰 Balance: ${u.balance}$
⭐ Level: ${u.level}
📅 Subscription: ${u.sub_expires ? new Date(u.sub_expires).toLocaleDateString() : "-"}
📈 Trades: ${u.trades_count || 0}

اكتب:
1️⃣ لتمديد الاشتراك
2️⃣ لحذف المستخدم
3️⃣ لإلغاء
    `);

    if (action === "1") {
      const days = prompt("كم يوم تريد تمديد الاشتراك؟");
      if (!days) return;
      await extendSubscription(u.id, days);
    } else if (action === "2") {
      const confirmDelete = confirm(`هل أنت متأكد أنك تريد حذف المستخدم ${u.id}?`);
      if (confirmDelete) await deleteUser(u.id);
    }
  } catch (err) {
    console.error("User details error:", err);
  } finally {
    showLoader(false);
  }
}

// ✅ تمديد الاشتراك
async function extendSubscription(id, days) {
  showLoader(true);
  try {
    const res = await fetch(`/api/admin/extend/${id}`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + jwt,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ days }),
    });
    const data = await res.json();
    if (data.ok) {
      alert(`✅ تم تمديد الاشتراك ${days} يوم بنجاح.`);
      loadUsers();
    } else alert("❌ فشل تمديد الاشتراك.");
  } catch (err) {
    console.error("Extend error:", err);
  } finally {
    showLoader(false);
  }
}

// ✅ حذف المستخدم
async function deleteUser(id) {
  showLoader(true);
  try {
    const res = await fetch(`/api/admin/delete/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + jwt },
    });
    const data = await res.json();
    if (data.ok) {
      alert(`🗑️ تم حذف المستخدم ${id}`);
      loadUsers();
    } else alert("❌ فشل حذف المستخدم.");
  } catch (err) {
    console.error("Delete user error:", err);
  } finally {
    showLoader(false);
  }
}

// ✅ أحداث الأزرار
loginBtn.addEventListener("click", login);
refreshBtn.addEventListener("click", loadUsers);

// ✅ تسجيل الدخول التلقائي في حال وجود JWT محفوظ
if (jwt) {
  loginBox.classList.add("hidden");
  dashboard.classList.remove("hidden");
  loadUsers();
}
