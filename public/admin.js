const tokenInput = document.getElementById("adminToken");
const loginBtn = document.getElementById("loginBtn");
const dashboard = document.getElementById("dashboard");
const loginBox = document.getElementById("loginBox");
const refreshBtn = document.getElementById("refreshUsers");
const tbody = document.querySelector("#usersTable tbody");

let jwt = localStorage.getItem("admin_jwt") || "";

async function login() {
  const token = tokenInput.value.trim();
  if (!token) return alert("Enter token");

  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  const data = await res.json();

  if (data.ok) {
    jwt = data.jwt;
    localStorage.setItem("admin_jwt", jwt);
    loginBox.classList.add("hidden");
    dashboard.classList.remove("hidden");
    loadUsers();
  } else alert("Invalid token");
}

async function loadUsers() {
  const res = await fetch("/api/admin/users", {
    headers: { Authorization: "Bearer " + jwt }
  });
  const data = await res.json();

  if (!data.ok) return alert("Session expired, please login again");

  tbody.innerHTML = "";
  data.users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.name || "-"}</td>
      <td>${u.level}</td>
      <td>${u.sub_expires ? new Date(u.sub_expires).toLocaleDateString() : "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

loginBtn.onclick = login;
refreshBtn.onclick = loadUsers;

if (jwt) {
  loginBox.classList.add("hidden");
  dashboard.classList.remove("hidden");
  loadUsers();
}
