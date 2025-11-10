const tokenInput = document.getElementById("adminToken");
const loginBtn = document.getElementById("loginBtn");
const dashboard = document.getElementById("dashboard");
const loginBox = document.getElementById("loginBox");
const refreshBtn = document.getElementById("refreshUsers");
const tbody = document.querySelector("#usersTable tbody");
const loader = document.getElementById("loadingIndicator");

let jwt = localStorage.getItem("admin_jwt") || "";

function toggleLoader(show) {
  if (!loader) return;
  loader.classList.toggle("hidden", !show);
}

async function login() {
  const token = tokenInput.value.trim();
  if (!token) return alert("Please enter admin token");

  toggleLoader(true);
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    if (res.ok && data.ok) {
      jwt = data.jwt;
      localStorage.setItem("admin_jwt", jwt);
      loginBox.classList.add("hidden");
      dashboard.classList.remove("hidden");
      await loadUsers(false);
    } else {
      alert("❌ Invalid admin token");
    }
  } catch (err) {
    console.error("Login error", err);
    alert("Server error while logging in");
  } finally {
    toggleLoader(false);
  }
}

async function loadUsers(showSpinner = true) {
  if (showSpinner) toggleLoader(true);
  try {
    const res = await fetch("/api/admin/users", {
      headers: { Authorization: "Bearer " + jwt },
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
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
        <td>${u.name || u.username || "-"}</td>
        <td>${u.level}</td>
        <td>${Number(u.balance || 0).toFixed(2)}$</td>
        <td>${u.sub_expires ? new Date(u.sub_expires).toLocaleDateString() : "-"}</td>
        <td><button class="action-btn" data-id="${u.id}">View</button></td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".action-btn").forEach((btn) => {
      btn.addEventListener("click", () => showUserDetails(btn.dataset.id));
    });
  } catch (err) {
    console.error("Error loading users", err);
    alert("Error loading users");
  } finally {
    if (showSpinner) toggleLoader(false);
  }
}

async function showUserDetails(id) {
  toggleLoader(true);
  try {
    const res = await fetch(`/api/admin/user/${id}`, {
      headers: { Authorization: "Bearer " + jwt },
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return alert("Failed to load user data.");

    const u = data.user;
    const action = prompt(
      `👤 User ID: ${u.id}\n📛 Name: ${u.name || u.username || "-"}\n💰 Balance: ${Number(u.balance || 0).toFixed(2)}$\n⭐ Level: ${u.level}\n📅 Subscription: ${u.sub_expires ? new Date(u.sub_expires).toLocaleDateString() : "-"}\n📈 Trades: ${u.trades_count || 0}\n\nType 1 to extend subscription, 2 to delete user, 0 to cancel.`
    );

    if (action === "1") {
      const days = prompt("How many days to extend?");
      if (!days) return;
      await extendSubscription(u.id, days);
    } else if (action === "2") {
      if (confirm(`Are you sure you want to delete user ${u.id}?`)) {
        await deleteUser(u.id);
      }
    }
  } catch (err) {
    console.error("User details error", err);
  } finally {
    toggleLoader(false);
  }
}

async function extendSubscription(id, days) {
  toggleLoader(true);
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
    if (res.ok && data.ok) {
      alert(`✅ Subscription extended by ${days} days.`);
      loadUsers();
    } else {
      alert("❌ Failed to extend subscription.");
    }
  } catch (err) {
    console.error("Extend error", err);
  } finally {
    toggleLoader(false);
  }
}

async function deleteUser(id) {
  toggleLoader(true);
  try {
    const res = await fetch(`/api/admin/delete/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + jwt },
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      alert(`🗑️ User ${id} deleted.`);
      loadUsers();
    } else {
      alert("❌ Failed to delete user.");
    }
  } catch (err) {
    console.error("Delete user error", err);
  } finally {
    toggleLoader(false);
  }
}

loginBtn.addEventListener("click", login);
refreshBtn.addEventListener("click", loadUsers);

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !dashboard.classList.contains("hidden")) {
    loadUsers();
  }
});

if (jwt) {
  loginBox.classList.add("hidden");
  dashboard.classList.remove("hidden");
  loadUsers();
}
