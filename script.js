let users = JSON.parse(localStorage.getItem("users")) || [];
let checkins = JSON.parse(localStorage.getItem("checkins")) || [];

const defaultUsers = ["Joe", "Teagan", "Emma", "Lisi", "Coco"];

<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyBVTxlZQxLL5SLWqKYpzv0HXd-6wByCAOQ",
    authDomain: "kai-ke-fit-dashboard.firebaseapp.com",
    projectId: "kai-ke-fit-dashboard",
    storageBucket: "kai-ke-fit-dashboard.firebasestorage.app",
    messagingSenderId: "585365049265",
    appId: "1:585365049265:web:6b4c7468627d0dba94b790",
    measurementId: "G-T5E7VSDKN3"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>

if (users.length === 0) {
  users = defaultUsers.map(name => ({
    id: crypto.randomUUID(),
    name
  }));
  saveUsers();
}

function saveUsers() {
  localStorage.setItem("users", JSON.stringify(users));
}

function saveCheckins() {
  localStorage.setItem("checkins", JSON.stringify(checkins));
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  document.getElementById(pageId).classList.add("active");

  renderUsers();
  renderDashboard();
}

function getMonthKey(dateString) {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(monthKey) {
  const [year, month] = monthKey.split("-");
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

function populateMonthFilter() {
  const monthFilter = document.getElementById("monthFilter");

  const months = [...new Set(checkins.map(c => getMonthKey(c.date)))];

  if (!months.includes(getCurrentMonthKey())) {
    months.unshift(getCurrentMonthKey());
  }

  months.sort().reverse();

  monthFilter.innerHTML = "";

  months.forEach(month => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = formatMonth(month);
    monthFilter.appendChild(option);
  });
}

function calculatePoints(checkin) {
  let points = 0;

  if (checkin.workout) points += 1;
  if (checkin.diet) points += 1;
  if (checkin.wonDay) points += 1;

  return points;
}

function renderDashboard() {
  populateMonthFilter();

  const selectedMonth = document.getElementById("monthFilter").value || getCurrentMonthKey();

  const monthCheckins = checkins.filter(checkin => {
    return getMonthKey(checkin.date) === selectedMonth;
  });

  const scores = users.map(user => {
    const userCheckins = monthCheckins.filter(c => c.userId === user.id);

    const totalPoints = userCheckins.reduce((sum, checkin) => {
      return sum + calculatePoints(checkin);
    }, 0);

    return {
      name: user.name,
      points: totalPoints
    };
  });

  scores.sort((a, b) => b.points - a.points);

  document.getElementById("totalCheckins").textContent = monthCheckins.length;
  document.getElementById("totalUsers").textContent = users.length;
  document.getElementById("topScore").textContent = scores[0]?.points || 0;

  const leaderboard = document.getElementById("leaderboard");
  leaderboard.innerHTML = "";

  scores.forEach((user, index) => {
    const row = document.createElement("div");
    row.className = "leader-row";

    row.innerHTML = `
      <div class="rank">#${index + 1}</div>
      <div>${user.name}</div>
      <div class="points">${user.points} pts</div>
    `;

    leaderboard.appendChild(row);
  });

  updateWinsSlider();
}

function renderUsers() {
  const checkinUser = document.getElementById("checkinUser");
  const userList = document.getElementById("userList");

  checkinUser.innerHTML = "";
  userList.innerHTML = "";

  users.forEach(user => {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = user.name;
    checkinUser.appendChild(option);

    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <div>👤</div>
      <div>${user.name}</div>
      <div></div>
    `;
    userList.appendChild(row);
  });
}

document.getElementById("newUserForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const name = document.getElementById("newUserName").value.trim();

  if (!name) return;

  users.push({
    id: crypto.randomUUID(),
    name
  });

  saveUsers();

  document.getElementById("newUserName").value = "";

  renderUsers();
  renderDashboard();

  alert("User added successfully!");
});

document.getElementById("checkinForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const imageInput = document.getElementById("imageUpload");
  const file = imageInput.files[0];

  const checkin = {
    id: crypto.randomUUID(),
    userId: document.getElementById("checkinUser").value,
    workout: document.getElementById("workout").checked,
    diet: document.getElementById("diet").checked,
    wonDay: document.getElementById("wonDay").checked,
    win: document.getElementById("dailyWin").value.trim(),
    date: new Date().toISOString(),
    imageName: file ? file.name : null
  };

  checkins.push(checkin);
  saveCheckins();

  document.getElementById("checkinForm").reset();

  renderDashboard();

  alert("Check in submitted!");
});

let currentWinIndex = 0;

function updateWinsSlider() {
  const rotatingWin = document.getElementById("rotatingWin");

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayKey = yesterday.toDateString();

  const yesterdayWins = checkins
    .filter(checkin => {
      return new Date(checkin.date).toDateString() === yesterdayKey && checkin.win;
    })
    .map(checkin => {
      const user = users.find(u => u.id === checkin.userId);
      return `${user?.name || "Someone"}: "${checkin.win}"`;
    });

  if (yesterdayWins.length === 0) {
    rotatingWin.textContent = "No wins submitted from yesterday yet.";
    return;
  }

  rotatingWin.textContent = yesterdayWins[currentWinIndex % yesterdayWins.length];
}

setInterval(() => {
  currentWinIndex++;
  updateWinsSlider();
}, 4000);

renderUsers();
renderDashboard();