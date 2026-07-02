import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";

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
let storage = null;
try { storage = getStorage(app); } catch (_) { /* storage optional */ }

const usersCollection = collection(db, "users");
const checkinsCollection = collection(db, "checkins");

let users = [];
let checkins = [];
let currentWinIndex = 0;
let currentWins = [];
let currentPage = "dashboard";

// ⚠️ Change this passcode to your own. Note: this is a soft gate (the code is
// visible in this file). For real enforcement, use Firebase Auth + Security Rules.
const ADMIN_CODE = "kingdom2026";
const isAdmin = () => document.documentElement.dataset.admin === "true";

/* ---------------- Helpers ---------------- */
const $ = (id) => document.getElementById(id);
const monthKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
};
const currentMonthKey = () => monthKey(new Date());
const formatMonth = (key) => {
  const [y, m] = key.split("-");
  return new Date(y, m - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};
const initials = (name) =>
  name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const stepPoints = (c) => Math.floor((Number(c.steps) || 0) / 1000);
const points = (c) => (c.workout ? 1 : 0) + (c.diet ? 1 : 0) + (c.wonDay ? 1 : 0) + stepPoints(c);
const escapeHtml = (s = "") =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

function userById(id) { return users.find((u) => u.id === id); }

/* Current consecutive-day streak (ending today or yesterday) for a user */
function currentStreak(userId) {
  const days = new Set(
    checkins.filter((c) => c.userId === userId).map((c) => new Date(c.date).toDateString())
  );
  if (days.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  // allow streak to be "alive" if they logged today OR yesterday
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* Per-member stats for a given month */
function memberStats(userId, monthCheckins) {
  const mine = monthCheckins.filter((c) => c.userId === userId);
  const days = new Set(mine.map((c) => new Date(c.date).toDateString()));
  return {
    points: mine.reduce((s, c) => s + points(c), 0),
    checkins: mine.length,
    days: days.size,
    perfect: mine.filter((c) => c.workout && c.diet && c.wonDay).length,
    workouts: mine.filter((c) => c.workout).length,
    diets: mine.filter((c) => c.diet).length,
    wins: mine.filter((c) => c.wonDay).length,
    steps: mine.reduce((s, c) => s + (Number(c.steps) || 0), 0),
    streak: currentStreak(userId)
  };
}

function checkedInToday(userId) {
  const today = new Date().toDateString();
  return checkins.some((c) => c.userId === userId && new Date(c.date).toDateString() === today);
}

/* ---------------- Navigation ---------------- */
function showPage(pageId) {
  if (pageId === "import" && !isAdmin()) pageId = "settings";
  currentPage = pageId;
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  $(pageId)?.classList.add("active");
  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.page === pageId)
  );
  renderAll();
}
window.showPage = showPage;

document.querySelectorAll(".nav-btn").forEach((btn) =>
  btn.addEventListener("click", () => showPage(btn.dataset.page))
);

/* ---------------- Month filter ---------------- */
function populateMonthFilter() {
  const sel = $("monthFilter");
  if (!sel) return;
  const prev = sel.value;
  let months = [...new Set(checkins.map((c) => monthKey(c.date)))];
  if (!months.includes(currentMonthKey())) months.push(currentMonthKey());
  months.sort().reverse();
  sel.innerHTML = "";
  months.forEach((m) => {
    const o = document.createElement("option");
    o.value = m;
    o.textContent = formatMonth(m);
    sel.appendChild(o);
  });
  if (prev && months.includes(prev)) sel.value = prev;
}
$("monthFilter").addEventListener("change", renderDashboard);

/* ---------------- Dashboard ---------------- */
function renderDashboard() {
  if (currentPage !== "dashboard") return;
  populateMonthFilter();
  const selectedMonth = $("monthFilter").value || currentMonthKey();
  $("dashTitle").textContent = formatMonth(selectedMonth) + " Leaderboard";

  const monthCheckins = checkins.filter((c) => monthKey(c.date) === selectedMonth);

  const scores = users
    .map((u) => ({ id: u.id, name: u.name, ...memberStats(u.id, monthCheckins) }))
    .sort((a, b) => b.points - a.points || b.days - a.days);

  // Stat cards
  const activeCount = scores.filter((s) => s.checkins > 0).length;
  $("topScore").textContent = scores[0]?.points || 0;
  $("topScoreName").textContent = scores[0] && scores[0].points > 0 ? scores[0].name : "—";
  $("totalCheckins").textContent = monthCheckins.length;
  $("perfectDays").textContent = monthCheckins.filter((c) => c.workout && c.diet && c.wonDay).length;
  $("activeUsers").textContent = activeCount;
  $("totalUsers").textContent = "/" + users.length;

  $("sideStreak").textContent = "🔥 " + (users.reduce((m, u) => Math.max(m, currentStreak(u.id)), 0));

  // Winner banner for completed past months
  const banner = $("winnerBanner");
  if (selectedMonth < currentMonthKey() && scores[0]?.points > 0) {
    banner.hidden = false;
    banner.innerHTML = `<span class="crown">🏆</span><div>${formatMonth(selectedMonth)} champion: <b>${escapeHtml(scores[0].name)}</b> with ${scores[0].points} points</div>`;
  } else {
    banner.hidden = true;
  }

  renderPodium(scores);
  renderLeaderboard(scores);
  renderMomentum(monthCheckins, selectedMonth);
  renderWins();
}

function renderPodium(scores) {
  const el = $("podium");
  const top = scores.filter((s) => s.points > 0).slice(0, 3);
  if (top.length === 0) {
    el.innerHTML = `<div class="empty" style="grid-column:1/-1">No points logged yet this month — be the first on the board.</div>`;
    return;
  }
  const order = [top[1], top[0], top[2]]; // 2nd, 1st, 3rd visual order
  const medals = { 0: "🥇", 1: "🥈", 2: "🥉" };
  const rankOf = { 0: "p1", 1: "p2", 2: "p3" };
  el.innerHTML = order
    .map((s) => {
      if (!s) return `<div></div>`;
      const place = top.indexOf(s);
      return `
        <div class="podium-spot ${rankOf[place]}" data-profile="${s.id}">
          <div class="podium-medal">${medals[place]}</div>
          ${avatarHTML(userById(s.id), "podium-avatar")}
          <div class="podium-name">${escapeHtml(s.name)}</div>
          <div class="podium-points">${s.points}<small> pts</small></div>
          ${s.streak > 1 ? `<div class="podium-streak">🔥 ${s.streak} day streak</div>` : ""}
        </div>`;
    })
    .join("");
  el.querySelectorAll("[data-profile]").forEach((x) => x.addEventListener("click", () => openProfile(x.dataset.profile)));
}

function renderLeaderboard(scores) {
  const lb = $("leaderboard");
  if (scores.length === 0) {
    lb.innerHTML = `<div class="empty">No members yet. Add competitors on the Members page.</div>`;
    return;
  }
  lb.innerHTML = scores
    .map(
      (s, i) => `
      <div class="leader-row ${i < 3 && s.points > 0 ? "top" : ""}" data-profile="${s.id}">
        <div class="rank">${i + 1}</div>
        <div class="leader-name">
          ${avatarHTML(userById(s.id))}
          <span>${escapeHtml(s.name)}</span>
          ${s.streak > 1 ? `<span class="leader-streak">🔥${s.streak}</span>` : ""}
        </div>
        <div class="points">${s.points}<small> pts</small></div>
        <div class="leader-go">›</div>
      </div>`
    )
    .join("");
  lb.querySelectorAll("[data-profile]").forEach((row) =>
    row.addEventListener("click", () => openProfile(row.dataset.profile))
  );
}

/* SVG bar chart of total points per day in the month */
function renderMomentum(monthCheckins, selectedMonth) {
  const el = $("momentumChart");
  const [y, m] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const totals = Array(daysInMonth).fill(0);
  monthCheckins.forEach((c) => {
    const d = new Date(c.date).getDate();
    totals[d - 1] += points(c);
  });
  const max = Math.max(1, ...totals);
  const W = 100, H = 30, gap = 0.6;
  const bw = (W - gap * (daysInMonth - 1)) / daysInMonth;
  const today = new Date();
  const isCurrent = selectedMonth === currentMonthKey();

  if (totals.every((t) => t === 0)) {
    el.innerHTML = `<div class="empty">No activity logged this month yet.</div>`;
    return;
  }

  let bars = "";
  for (let i = 0; i < daysInMonth; i++) {
    const h = (totals[i] / max) * (H - 4);
    const x = i * (bw + gap);
    const isToday = isCurrent && i + 1 === today.getDate();
    const color = totals[i] === 0 ? "var(--line-strong)" : isToday ? "var(--flame)" : "var(--lime)";
    bars += `<rect class="bar" x="${x}" y="${H - h}" width="${bw}" height="${Math.max(h, 0.5)}" rx="0.4" style="fill:${color}"><title>Day ${i + 1}: ${totals[i]} pts</title></rect>`;
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H + 4}" preserveAspectRatio="none">${bars}</svg>
    <div style="display:flex;justify-content:space-between;color:var(--faint);font-size:11px;margin-top:6px">
      <span>Day 1</span><span>Day ${daysInMonth}</span></div>`;
}

/* ---------------- Avatars ---------------- */
function avatarHTML(user, cls = "mini-avatar") {
  if (user && user.photoUrl) {
    return `<span class="${cls} has-photo" style="background-image:url('${user.photoUrl}')" role="img" aria-label="${escapeHtml(user.name || "")}"></span>`;
  }
  return `<span class="${cls}">${initials(user?.name || "?")}</span>`;
}

/* ---------------- Member Profile ---------------- */
let profileUserId = null;
let profileOpenMonth = null;

function openProfile(id) {
  profileUserId = id;
  profileOpenMonth = null;
  showPage("profile");
  window.scrollTo({ top: 0 });
}

function renderProfile() {
  if (currentPage !== "profile") return;
  const u = userById(profileUserId);
  const nameEl = $("profileName");
  if (!nameEl) return;
  if (!u) { showPage("dashboard"); return; }

  $("profileAvatar").innerHTML = avatarHTML(u, "profile-avatar");
  nameEl.textContent = u.name;

  const allChk = checkins.filter((c) => c.userId === u.id);
  const totalSteps = allChk.reduce((s, c) => s + (Number(c.steps) || 0), 0);
  const totalPts = allChk.reduce((s, c) => s + points(c), 0);
  $("profileStats").innerHTML =
    `<span class="pstat"><b>&#128293; ${currentStreak(u.id)}</b> day streak</span>` +
    `<span class="pstat"><b>${totalPts.toLocaleString()}</b> total pts</span>` +
    `<span class="pstat"><b>${totalSteps.toLocaleString()}</b> total steps</span>`;

  const months = [...new Set(allChk.map((c) => monthKey(c.date)))].sort().reverse();
  const wrap = $("profileMonths");
  if (months.length === 0) {
    wrap.innerHTML = `<div class="empty">No check-ins logged yet.</div>`;
    return;
  }
  if (!profileOpenMonth || !months.includes(profileOpenMonth)) profileOpenMonth = months[0];

  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayPts = (o) => (o.workout ? 1 : 0) + (o.diet ? 1 : 0) + (o.wonDay ? 1 : 0) + Math.floor(o.steps / 1000);

  wrap.innerHTML = months
    .map((mk) => {
      const mChk = allChk.filter((c) => monthKey(c.date) === mk);
      const dayMap = {};
      mChk.forEach((c) => {
        const d = new Date(c.date).getDate();
        const o = (dayMap[d] = dayMap[d] || { steps: 0, workout: false, diet: false, wonDay: false });
        o.steps += Number(c.steps) || 0;
        o.workout = o.workout || !!c.workout;
        o.diet = o.diet || !!c.diet;
        o.wonDay = o.wonDay || !!c.wonDay;
      });
      const days = Object.keys(dayMap).map(Number).sort((a, b) => a - b);
      const [yy, mm] = mk.split("-").map(Number);
      const mSteps = days.reduce((s, d) => s + dayMap[d].steps, 0);
      const mPts = days.reduce((s, d) => s + dayPts(dayMap[d]), 0);
      const open = mk === profileOpenMonth;
      const rows = days
        .map((d) => {
          const o = dayMap[d];
          const wd = dow[new Date(yy, mm - 1, d).getDay()];
          return `<div class="pday">
            <div class="pday-date">${mm}/${d}<span>${wd}</span></div>
            <div class="pday-badges">
              <span class="badge ${o.workout ? "on" : ""}">&#127947;</span>
              <span class="badge ${o.diet ? "on" : ""}">&#129367;</span>
              <span class="badge ${o.wonDay ? "on" : ""}">&#127942;</span>
            </div>
            <div class="pday-steps">${o.steps > 0 ? o.steps.toLocaleString() + " &#128094;" : "&mdash;"}</div>
            <div class="pday-pts">+${dayPts(o)}</div>
          </div>`;
        })
        .join("");
      return `<div class="pmonth ${open ? "open" : ""}">
        <button class="pmonth-head" data-month="${mk}">
          <span class="pmonth-name">${formatMonth(mk)}</span>
          <span class="pmonth-meta">&#128094; ${mSteps.toLocaleString()} &middot; ${mPts} pts</span>
          <span class="pmonth-caret">&#9662;</span>
        </button>
        <div class="pmonth-days">${rows}</div>
      </div>`;
    })
    .join("");

  wrap.querySelectorAll(".pmonth-head").forEach((h) =>
    h.addEventListener("click", () => {
      profileOpenMonth = profileOpenMonth === h.dataset.month ? null : h.dataset.month;
      renderProfile();
    })
  );
}

/* ---------------- Profile photo (admin) ---------------- */
function resizeToDataUrl(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image load failed")); };
    img.src = url;
  });
}
async function handleProfilePhoto(file) {
  if (!isAdmin() || !profileUserId || !file) return;
  try {
    const dataUrl = await resizeToDataUrl(file, 256);
    await updateDoc(doc(db, "users", profileUserId), { photoUrl: dataUrl });
    toast("Photo updated");
  } catch (e) {
    toast("Couldn't process that image", true);
  }
}
$("profileBack")?.addEventListener("click", () => showPage("dashboard"));
$("profilePhotoBtn")?.addEventListener("click", () => $("profilePhotoInput")?.click());
$("profilePhotoInput")?.addEventListener("change", (e) => {
  handleProfilePhoto(e.target.files?.[0]);
  e.target.value = "";
});

/* ---------------- Coach bot ---------------- */
const COACH_WORKER_URL = ""; // paste your Cloudflare Worker URL here to enable the coach
let coachHistory = [];

function coachDataSummary() {
  const rows = users.map((u) => {
    const chk = checkins.filter((c) => c.userId === u.id);
    const steps = chk.reduce((s, c) => s + (Number(c.steps) || 0), 0);
    const pts = chk.reduce((s, c) => s + points(c), 0);
    const days = new Set(chk.map((c) => new Date(c.date).toDateString())).size;
    return `- ${u.name}: ${pts} points, ${steps.toLocaleString()} steps, ${days} active days, ${currentStreak(u.id)}-day current streak`;
  });
  return `Fit 4 The Kingdom is a group step and wellness competition. Scoring: workout = 1pt, diet = 1pt, "won the day" = 1pt, plus 1pt per 1,000 steps.\nMembers (${users.length}):\n${rows.join("\n")}`;
}
function coachSystem() {
  return `You are the friendly team coach for a group fitness competition. Answer questions about the group's data and give supportive, practical, evidence-based health, fitness, and nutrition guidance. Keep replies concise and encouraging. You are not a doctor; for medical concerns, gently suggest consulting a professional. Current group data:\n\n${coachDataSummary()}`;
}
function appendCoach(role, text, temp) {
  const log = $("coachLog");
  if (!log) return null;
  const el = document.createElement("div");
  el.className = `coach-msg ${role}${temp ? " temp" : ""}`;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}
async function coachSend() {
  const input = $("coachInput");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  appendCoach("user", text);
  input.value = "";
  coachHistory.push({ role: "user", content: text });

  if (!COACH_WORKER_URL) {
    appendCoach("assistant", "The coach isn't connected yet. An admin needs to deploy the Worker (see worker.js) and paste its URL into COACH_WORKER_URL near the top of script.js.");
    return;
  }
  const typing = appendCoach("assistant", "\u2026", true);
  try {
    const res = await fetch(COACH_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: coachSystem(), messages: coachHistory })
    });
    const data = await res.json();
    if (typing) typing.remove();
    const reply = data.reply || data.error || "Sorry, I couldn't come up with a response.";
    appendCoach("assistant", reply);
    coachHistory.push({ role: "assistant", content: reply });
  } catch (e) {
    if (typing) typing.remove();
    appendCoach("assistant", "I couldn't reach the coach service. Double-check the Worker URL and that it's deployed.");
  }
}
$("coachSend")?.addEventListener("click", coachSend);
$("coachInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); coachSend(); }
});

/* ---------------- Wins ---------------- */
function renderWins() {
  // Prefer yesterday's wins; fall back to most recent wins
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toDateString();

  const withWin = checkins.filter((c) => c.win && c.win.trim());
  const yWins = withWin.filter((c) => new Date(c.date).toDateString() === yKey);

  const source = yWins.length ? yWins : [...withWin].sort((a, b) => new Date(b.date) - new Date(a.date));
  $("spotlightTag").textContent = yWins.length ? "yesterday" : "recent";

  currentWins = source.map((c) => ({
    who: userById(c.userId)?.name || "Someone",
    text: c.win.trim()
  }));

  if (currentWinIndex >= currentWins.length) currentWinIndex = 0;
  paintSpotlight();

  // Recent wins list (latest 4, excluding the spotlighted ordering)
  const recent = [...withWin].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
  $("recentWins").innerHTML = recent.length
    ? recent
        .map(
          (c) =>
            `<div class="recent-win"><b>${escapeHtml(userById(c.userId)?.name || "Someone")}</b> — ${escapeHtml(c.win.trim())}</div>`
        )
        .join("")
    : "";
}

function paintSpotlight() {
  const el = $("rotatingWin");
  const dots = $("winDots");
  if (!el) return;
  if (currentWins.length === 0) {
    el.innerHTML = "No wins submitted yet — log one on your next check-in.";
    if (dots) dots.innerHTML = "";
    return;
  }
  const w = currentWins[currentWinIndex % currentWins.length];
  el.innerHTML = `“${escapeHtml(w.text)}”<span class="who">— ${escapeHtml(w.who)}</span>`;
  if (dots) {
    const n = Math.min(currentWins.length, 6);
    dots.innerHTML = Array.from({ length: n }, (_, i) =>
      `<i class="${i === currentWinIndex % n ? "on" : ""}"></i>`
    ).join("");
  }
}

setInterval(() => {
  if (currentWins.length <= 1) return;
  const el = $("rotatingWin");
  el?.classList.add("fade");
  setTimeout(() => {
    currentWinIndex++;
    paintSpotlight();
    el?.classList.remove("fade");
  }, 350);
}, 5000);

/* ---------------- Members page ---------------- */
function renderUsers() {
  const sel = $("checkinUser");
  const list = $("userList");

  if (sel) {
    const prev = sel.value;
    sel.innerHTML = "";
    users.forEach((u) => {
      const o = document.createElement("option");
      o.value = u.id;
      o.textContent = u.name;
      sel.appendChild(o);
    });
    if (prev && users.some((u) => u.id === prev)) sel.value = prev;
  }

  if (list) {
    $("memberCount").textContent = `${users.length} member${users.length === 1 ? "" : "s"}`;
    list.innerHTML = users.length
      ? users
          .map((u) => {
            const mc = checkins.filter((c) => monthKey(c.date) === currentMonthKey());
            const st = memberStats(u.id, mc);
            return `
            <div class="user-row" data-profile="${u.id}">
              ${avatarHTML(u)}
              <span class="uname">${escapeHtml(u.name)}</span>
              <span class="user-meta"><b>${st.points}</b> pts · 🔥${st.streak}</span>
              <button class="del-btn admin-only" data-del-user="${u.id}" title="Remove member">✕</button>
            </div>`;
          })
          .join("")
      : `<div class="empty">No members yet. Add your first competitor above.</div>`;

    list.querySelectorAll("[data-profile]").forEach((row) =>
      row.addEventListener("click", () => openProfile(row.dataset.profile))
    );
    list.querySelectorAll("[data-del-user]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isAdmin()) return;
        const u = userById(btn.dataset.delUser);
        confirmAction(
          "Remove member?",
          `This removes ${u?.name || "this member"} from the roster. Their past check-ins stay in history.`,
          async () => {
            await deleteDoc(doc(db, "users", btn.dataset.delUser));
            toast("Member removed");
          }
        );
      })
    );
  }

  updateUserStatus();
}

/* ---------------- Check-in history ---------------- */
function renderHistory() {
  const el = $("checkinHistory");
  if (!el) return;
  const recent = [...checkins].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
  el.innerHTML = recent.length
    ? recent
        .map((c) => {
          const name = userById(c.userId)?.name || "Unknown";
          const when = new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const stepStr = Number(c.steps) ? ` · 👟 ${Number(c.steps).toLocaleString()}` : "";
          const thumb = c.imageUrl
            ? `<img class="history-thumb" src="${c.imageUrl}" alt="" />`
            : `<div class="history-thumb">${c.imageName ? "🖼️" : "💪"}</div>`;
          return `
          <div class="history-row">
            ${thumb}
            <div class="history-main">
              <b>${escapeHtml(name)} <span style="color:var(--lime);font-family:'Space Mono'">+${points(c)}</span></b>
              <span>${when}${stepStr}${c.win ? " · " + escapeHtml(c.win.trim()) : ""}</span>
            </div>
            <div class="history-badges">
              <span class="badge ${c.workout ? "on" : ""}">🏋️</span>
              <span class="badge ${c.diet ? "on" : ""}">🥗</span>
              <span class="badge ${c.wonDay ? "on" : ""}">🏆</span>
            </div>
            <button class="del-btn admin-only" data-del-checkin="${c.id}" title="Delete check-in">🗑</button>
          </div>`;
        })
        .join("")
    : `<div class="empty">No check-ins yet.</div>`;

  el.querySelectorAll("[data-del-checkin]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (!isAdmin()) return;
      confirmAction("Delete check-in?", "This permanently removes the entry and its points.", async () => {
        await deleteDoc(doc(db, "checkins", btn.dataset.delCheckin));
        toast("Check-in deleted");
      });
    })
  );
}

/* ---------------- Check-in status card + live points ---------------- */
function updateLivePoints() {
  let p = 0;
  if ($("workout")?.checked) p++;
  if ($("diet")?.checked) p++;
  if ($("wonDay")?.checked) p++;
  $("livePoints").textContent = p;
}
["workout", "diet", "wonDay"].forEach((id) =>
  $(id)?.addEventListener("change", updateLivePoints)
);

function updateUserStatus() {
  const card = $("userStatus");
  const sel = $("checkinUser");
  if (!card || !sel) return;
  const id = sel.value;
  if (!id) {
    card.innerHTML = "Select a member to see their stats.";
    return;
  }
  const mc = checkins.filter((c) => monthKey(c.date) === currentMonthKey());
  const st = memberStats(id, mc);
  const done = checkedInToday(id);
  card.innerHTML = `
    <div class="status-pill ${done ? "done" : "pending"}">${done ? "✓ Logged today" : "○ Not logged today"}</div>
    <div class="status-row"><span>Current streak</span><b>🔥 ${st.streak}</b></div>
    <div class="status-row"><span>Points this month</span><b>${st.points}</b></div>
    <div class="status-row"><span>Steps this month</span><b>${st.steps.toLocaleString()}</b></div>
    <div class="status-row"><span>Days active</span><b>${st.days}</b></div>
    <div class="status-row"><span>Perfect days</span><b>${st.perfect}</b></div>`;
}
$("checkinUser")?.addEventListener("change", updateUserStatus);

/* Image preview */
$("imageUpload")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  const preview = $("imagePreview");
  const hint = $("fileHint");
  if (file) {
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    hint.textContent = file.name;
  } else {
    preview.hidden = true;
    hint.textContent = "Tap to attach a progress pic";
  }
});

/* ---------------- Forms ---------------- */
$("newUserForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("newUserName").value.trim();
  if (!name) return;
  if (users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
    toast("That member already exists", true);
    return;
  }
  await addDoc(usersCollection, { name, createdAt: serverTimestamp() });
  $("newUserName").value = "";
  toast(`${name} added to the crew`);
});

$("checkinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const userId = $("checkinUser").value;
  if (!userId) { toast("Pick a member first", true); return; }

  const submitBtn = $("checkinForm").querySelector(".primary-btn");

  const doSubmit = async () => {
    submitBtn.disabled = true;
    const file = $("imageUpload")?.files?.[0] || null;
    let imageName = file?.name || null;
    let imageUrl = null;

    // Attempt real upload to Firebase Storage; fall back gracefully if unavailable
    if (file && storage) {
      try {
        const r = storageRef(storage, `checkins/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        imageUrl = await getDownloadURL(r);
      } catch (err) {
        console.warn("Image upload skipped (Storage not available):", err?.code || err);
      }
    }

    try {
      await addDoc(checkinsCollection, {
        userId,
        workout: $("workout").checked,
        diet: $("diet").checked,
        wonDay: $("wonDay").checked,
        win: $("dailyWin").value.trim(),
        imageName,
        imageUrl,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      $("checkinForm").reset();
      $("imagePreview").hidden = true;
      $("fileHint").textContent = "Tap to attach a progress pic";
      updateLivePoints();
      updateUserStatus();
      toast("Check-in submitted 💪");
    } catch (err) {
      toast("Something went wrong saving that", true);
    } finally {
      submitBtn.disabled = false;
    }
  };

  // Guard against duplicate same-day check-ins
  if (checkedInToday(userId)) {
    const name = userById(userId)?.name || "This member";
    confirmAction(
      "Already logged today",
      `${name} already has a check-in today. Add another anyway?`,
      doSubmit,
      "Add anyway"
    );
  } else {
    doSubmit();
  }
});

/* ---------------- Toast + confirm ---------------- */
let toastTimer;
function toast(msg, isErr = false) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("err", isErr);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

let confirmCallback = null;
function confirmAction(title, body, cb, okLabel = "Delete") {
  $("confirmTitle").textContent = title;
  $("confirmBody").textContent = body;
  $("confirmOk").textContent = okLabel;
  confirmCallback = cb;
  $("confirmModal").hidden = false;
}
$("confirmCancel").addEventListener("click", () => { $("confirmModal").hidden = true; confirmCallback = null; });
$("confirmModal").addEventListener("click", (e) => {
  if (e.target.id === "confirmModal") { $("confirmModal").hidden = true; confirmCallback = null; }
});
$("confirmOk").addEventListener("click", async () => {
  $("confirmModal").hidden = true;
  const cb = confirmCallback;
  confirmCallback = null;
  if (cb) await cb();
});

/* ---------------- CSV Step Import ---------------- */
let csvHeaders = [];
let csvRows = [];
let importPlan = [];

// RFC-4180-ish CSV parser: handles quoted fields, embedded commas/newlines, escaped quotes
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function parseImportDate(s) {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  // ISO date (YYYY-MM-DD or YYYY/MM/DD): parse as LOCAL, not UTC, to avoid a
  // one-day shift in timezones behind UTC. new Date("2026-06-01") is UTC midnight.
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
  // DD/MM/YYYY and DD-MM-YYYY
  m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = "20" + y;
    const dd = new Date(+y, +b - 1, +a, 12);
    if (!isNaN(dd)) return dd;
  }
  // Fallback for text dates like "Jun 1, 2026"; normalize to local noon
  const d = new Date(t);
  if (!isNaN(d)) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  return null;
}

const isDateHeader = (h) => parseImportDate(h) !== null && /\d/.test(h);
const cleanSteps = (v) => parseInt(String(v).replace(/[^0-9]/g, ""), 10);

function fillColSelect(sel, headers, chosen) {
  if (!sel) return;
  sel.innerHTML = "";
  headers.forEach((h, i) => {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = h.trim() || `Column ${i + 1}`;
    sel.appendChild(o);
  });
  if (chosen >= 0) sel.value = chosen;
}

function handleCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) { toast("That CSV looks empty", true); return; }

  csvHeaders = rows[0];
  csvRows = rows.slice(1);

  const lower = csvHeaders.map((h) => h.toLowerCase().trim());
  const findCol = (...keys) => lower.findIndex((h) => keys.some((k) => h.includes(k)));
  const nameIdx = findCol("name", "member", "user", "participant", "player");
  const dateIdx = findCol("date", "day");
  const stepsIdx = findCol("step");

  const dateHeaderCount = csvHeaders.filter(isDateHeader).length;
  const wide = dateHeaderCount >= 2;

  fillColSelect($("mapName"), csvHeaders, nameIdx >= 0 ? nameIdx : 0);
  fillColSelect($("mapDate"), csvHeaders, dateIdx);
  fillColSelect($("mapSteps"), csvHeaders, stepsIdx);
  $("wideMode").checked = wide;
  toggleWideUI();

  $("formatTag").textContent = `${csvRows.length} rows · ${csvHeaders.length} columns`;
  $("importConfig").hidden = false;
  $("importPreview").hidden = true;
  $("csvHint").textContent = "✓ File loaded — map the columns below";
}

function toggleWideUI() {
  const wide = $("wideMode").checked;
  $("mapDateWrap").style.display = wide ? "none" : "";
  $("mapStepsWrap").style.display = wide ? "none" : "";
}

function buildPlan() {
  const wide = $("wideMode").checked;
  const dupeMode = $("dupeMode").value;
  const createMissing = $("createMissing").checked;
  const nameIdx = +$("mapName").value;
  const raw = [];

  if (wide) {
    const dateCols = csvHeaders
      .map((h, i) => ({ i, date: parseImportDate(h) }))
      .filter((o) => o.i !== nameIdx && o.date);
    csvRows.forEach((r) => {
      const name = (r[nameIdx] || "").trim();
      if (!name) return;
      dateCols.forEach((dc) => {
        const steps = cleanSteps(r[dc.i]);
        if (steps) raw.push({ name, date: dc.date, steps });
      });
    });
  } else {
    const dateIdx = +$("mapDate").value;
    const stepsIdx = +$("mapSteps").value;
    csvRows.forEach((r) => {
      const name = (r[nameIdx] || "").trim();
      const date = parseImportDate(r[dateIdx]);
      const steps = cleanSteps(r[stepsIdx]);
      if (name && date && steps) raw.push({ name, date, steps });
    });
  }

  // Dedupe within the CSV by name+day (last value wins)
  const map = new Map();
  raw.forEach((e) => map.set(e.name.toLowerCase() + "|" + e.date.toDateString(), e));

  importPlan = [...map.values()].map((e) => {
    const member = users.find((u) => u.name.toLowerCase() === e.name.toLowerCase());
    const existing = member
      ? checkins.find((c) => c.userId === member.id && new Date(c.date).toDateString() === e.date.toDateString())
      : null;
    let action;
    if (existing) {
      const hasSteps = (Number(existing.steps) || 0) > 0;
      // A check-in with no step data (e.g. a habit-only check-in) should get its
      // steps filled in, even in Skip mode. Skip only protects real step data.
      if (!hasSteps) action = "fill";
      else action = dupeMode === "overwrite" ? "update" : "skip";
    } else if (!member && !createMissing) action = "skip";
    else action = "add";
    return {
      name: e.name,
      memberId: member?.id || null,
      isNewMember: !member && createMissing,
      date: e.date,
      steps: e.steps,
      points: Math.floor(e.steps / 1000),
      action,
      existingId: existing?.id || null
    };
  });

  renderPreview();
}

function renderPreview() {
  const add = importPlan.filter((p) => p.action === "add").length;
  const fill = importPlan.filter((p) => p.action === "fill").length;
  const upd = importPlan.filter((p) => p.action === "update").length;
  const skip = importPlan.filter((p) => p.action === "skip").length;
  const newMembers = new Set(importPlan.filter((p) => p.isNewMember && p.action !== "skip").map((p) => p.name.toLowerCase())).size;
  const willWrite = add + fill + upd;

  $("previewSummary").textContent =
    `${add} new · ${fill} filled · ${upd} overwritten · ${skip} skipped` +
    (newMembers ? ` · ${newMembers} new member${newMembers === 1 ? "" : "s"}` : "");
  $("importCount").textContent = willWrite;

  const badge = { add: "add", fill: "add", update: "update", skip: "skip" };
  const label = { add: "Add", fill: "Add steps", update: "Overwrite", skip: "Skip" };
  const shown = importPlan.slice(0, 80);

  $("previewTable").innerHTML = `
    <table>
      <thead><tr><th>Member</th><th>Date</th><th class="num">Steps</th><th class="num">Pts</th><th>Action</th></tr></thead>
      <tbody>
        ${shown
          .map(
            (p) => `<tr>
              <td>${escapeHtml(p.name)}${p.isNewMember && p.action !== "skip" ? ' <span class="pbadge new">new</span>' : ""}</td>
              <td>${p.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
              <td class="num">${p.steps.toLocaleString()}</td>
              <td class="num">${p.points}</td>
              <td><span class="pbadge ${badge[p.action]}">${label[p.action]}</span></td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${importPlan.length > shown.length ? `<div class="preview-more">…and ${importPlan.length - shown.length} more</div>` : ""}`;

  $("importPreview").hidden = false;
  $("runImportBtn").disabled = willWrite === 0;
}

async function runImport() {
  const btn = $("runImportBtn");
  btn.disabled = true;
  const work = importPlan.filter((p) => p.action !== "skip");

  // Create any new members first, then map names -> ids
  const newNames = [...new Set(work.filter((p) => p.isNewMember).map((p) => p.name))];
  const nameToId = {};
  try {
    for (const name of newNames) {
      const ref = await addDoc(usersCollection, { name, createdAt: serverTimestamp() });
      nameToId[name.toLowerCase()] = ref.id;
    }
  } catch (e) {
    toast("Couldn't create members — check your Firestore rules", true);
    btn.disabled = false;
    return;
  }

  const writes = [];
  for (const p of work) {
    const memberId = p.memberId || nameToId[p.name.toLowerCase()];
    if (!memberId) continue;
    if ((p.action === "update" || p.action === "fill") && p.existingId) {
      writes.push(updateDoc(doc(db, "checkins", p.existingId), { steps: p.steps }));
    } else {
      writes.push(
        addDoc(checkinsCollection, {
          userId: memberId,
          workout: false, diet: false, wonDay: false,
          steps: p.steps,
          win: "",
          imageName: null, imageUrl: null,
          date: new Date(p.date).toISOString(),
          createdAt: serverTimestamp(),
          source: "csv"
        })
      );
    }
  }

  try {
    await Promise.all(writes);
    toast(`Imported ${writes.length} step entr${writes.length === 1 ? "y" : "ies"} 🎉`);
    $("importConfig").hidden = true;
    $("importPreview").hidden = true;
    $("csvUpload").value = "";
    $("csvHint").textContent = "Tap to choose your Step Up CSV export";
    importPlan = [];
  } catch (e) {
    toast("Some entries failed to save", true);
    btn.disabled = false;
  }
}

$("csvUpload")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => handleCSV(String(reader.result));
  reader.onerror = () => toast("Couldn't read that file", true);
  reader.readAsText(file);
});
$("wideMode")?.addEventListener("change", toggleWideUI);
$("previewBtn")?.addEventListener("click", buildPlan);
$("runImportBtn")?.addEventListener("click", runImport);
$("resetStepsBtn")?.addEventListener("click", () => {
  if (!isAdmin()) return;
  confirmAction(
    "Reset all step data?",
    "This deletes imported step entries and clears step counts from check-ins so you can re-import cleanly. Members and their workout / diet / won-the-day check-ins are kept. This can't be undone.",
    async () => {
      const dels = checkins.filter((c) => c.source === "csv").map((c) => deleteDoc(doc(db, "checkins", c.id)));
      const zeros = checkins
        .filter((c) => c.source !== "csv" && (Number(c.steps) || 0) > 0)
        .map((c) => updateDoc(doc(db, "checkins", c.id), { steps: 0 }));
      try {
        await Promise.all([...dels, ...zeros]);
        toast(`Step data cleared — re-import when ready`);
      } catch (e) {
        toast("Some entries couldn't be reset", true);
      }
    },
    "Reset"
  );
});


function renderAll() {
  renderUsers();
  renderHistory();
  renderDashboard();
  renderProfile();
}

/* ---------------- Admin ---------------- */
function setAdmin(on) {
  document.documentElement.dataset.admin = on ? "true" : "false";
  try { localStorage.setItem("f4k-admin", on ? "1" : "0"); } catch (e) { /* storage blocked */ }
  // If a guest somehow sits on the import page, bounce them out on logout
  if (!on && currentPage === "import") showPage("settings");
}

$("adminLoginBtn")?.addEventListener("click", () => {
  const code = $("adminCode").value;
  if (code === ADMIN_CODE) {
    setAdmin(true);
    $("adminCode").value = "";
    toast("Logged in as admin ✓");
  } else {
    toast("Incorrect passcode", true);
  }
});
$("adminCode")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); $("adminLoginBtn").click(); }
});
$("adminLogoutBtn")?.addEventListener("click", () => {
  setAdmin(false);
  toast("Logged out");
});
$("goImportBtn")?.addEventListener("click", () => showPage("import"));

/* ---------------- Theme ---------------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("f4k-theme", t); } catch (e) { /* storage blocked */ }
  const sw = $("themeSwitch");
  if (sw) {
    const dark = t === "dark";
    sw.classList.toggle("on", dark);
    sw.setAttribute("aria-checked", String(dark));
  }
}
$("themeSwitch")?.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
// Sync the switch UI with whatever the head script already applied
applyTheme(document.documentElement.dataset.theme || "light");

/* ---------------- Realtime sync ---------------- */
onSnapshot(query(usersCollection), (snap) => {
  users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderAll();
});
onSnapshot(query(checkinsCollection), (snap) => {
  checkins = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderAll();
});

// Start on dashboard
showPage("dashboard");
console.log("Fit 4 The Kingdom dashboard loaded.");
