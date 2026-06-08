import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBVTxlZQxLL5SLWqKYpzv0HXd-6wByCAOQ",
  authDomain: "kai-ke-fit-dashboard.firebaseapp.com",
  projectId: "kai-ke-fit-dashboard",
  storageBucket: "kai-ke-fit-dashboard.firebasestorage.app",
  messagingSenderId: "585365049265",
  appId: "1:585365049265:web:6b4c7468627d0dba94b790",
  measurementId: "G-T5E7VSDKN3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const usersCollection = collection(db, "users");
const checkinsCollection = collection(db, "checkins");

let users = [];
let checkins = [];
let currentWinIndex = 0;

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  document.getElementById(pageId).classList.add("active");

  renderUsers();
  renderDashboard();
}

window.showPage = showPage;

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
  return new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

function calculatePoints(checkin) {
  let points = 0;
  if (checkin.workout) points++;
  if (checkin.diet) points++;
  if (checkin.wonDay) points++;
  return points;
}

function populateMonthFilter() {
  const monthFilter = document.getElementById("monthFilter");
  if (!monthFilter) return;

  const selectedValue = monthFilter.value;
  let months = [...new Set(checkins.map(c => getMonthKey(c.date)))];

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

  if (selectedValue) {
    monthFilter.value = selectedValue;
  }
}

function renderDashboard() {
  populateMonthFilter();

  const monthFilter = document.getElementById("monthFilter");
  const selectedMonth = monthFilter?.value || getCurrentMonthKey();

  const monthCheckins = checkins.filter(c => getMonthKey(c.date) === selectedMonth);

  const scores = users.map(user => {
    const userCheckins = monthCheckins.filter(c => c.userId === user.id);

    return {
      name: user.name,
      points: userCheckins.reduce((sum, c) => sum + calculatePoints(c), 0)
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

  if (!checkinUser || !userList) return;

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

document.getElementById("newUserForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const name = document.getElementById("newUserName").value.trim();
  if (!name) return;

  await addDoc(usersCollection, {
    name,
    createdAt: serverTimestamp()
  });

  document.getElementById("newUserName").value = "";
  alert("User added successfully!");
});

document.getElementById("checkinForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const fileInput = document.getElementById("imageUpload");

  await addDoc(checkinsCollection, {
    userId: document.getElementById("checkinUser").value,
    workout: document.getElementById("workout").checked,
    diet: document.getElementById("diet").checked,
    wonDay: document.getElementById("wonDay").checked,
    win: document.getElementById("dailyWin").value.trim(),
    imageName: fileInput?.files?.[0]?.name || null,
    date: new Date().toISOString(),
    createdAt: serverTimestamp()
  });

  document.getElementById("checkinForm").reset();
  alert("Check in submitted!");
});

function updateWinsSlider() {
  const rotatingWin = document.getElementById("rotatingWin");
  if (!rotatingWin) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toDateString();

  const yesterdayWins = checkins
    .filter(c => new Date(c.date).toDateString() === yesterdayKey && c.win)
    .map(c => {
      const user = users.find(u => u.id === c.userId);
      return `${user?.name || "Someone"}: "${c.win}"`;
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

onSnapshot(query(usersCollection), snapshot => {
  users = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  renderUsers();
  renderDashboard();
});

onSnapshot(query(checkinsCollection), snapshot => {
  checkins = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  renderDashboard();
});

console.log("Kai Ke Fit Firebase dashboard loaded.");