/* Scarlett Isles – Notice Board Quest Generator (vanilla JS)
   Data model: data/quests.json
*/

// ===================================
// FIREBASE CONFIG (same as shop)
// ===================================
const firebaseConfig = {
  apiKey: "AIzaSyCAtLDqghTbYhyhwcoTsefTiMecC30RMuQ",
  authDomain: "scarlett-isles-companion.firebaseapp.com",
  databaseURL: "https://scarlett-isles-companion-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "scarlett-isles-companion",
  storageBucket: "scarlett-isles-companion.firebasestorage.app",
  messagingSenderId: "1004879472877",
  appId: "1:1004879472877:web:a498908c2ccf362e8e7e63"
};

let firebaseApp = null;
let db = null;
let firebaseEnabled = false;

function initFirebase() {
  try {
    if (typeof firebase !== 'undefined') {
      firebaseApp = firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      firebaseEnabled = true;
      console.log('Firebase initialized successfully');
    } else {
      console.warn('Firebase SDK not loaded');
    }
  } catch (error) {
    console.warn('Firebase initialization failed:', error);
  }
}

// Sync accepted quests to Firebase for the shop to read
async function syncAcceptedToFirebase() {
  if (!firebaseEnabled || !db) return;
  
  try {
    // Create a simplified version of accepted quests for the shop
    const activeQuests = accepted.map(q => ({
      id: q.id,
      title: q.title,
      quest_type: q.quest_type,
      tags: q.tags || [],
      province: q.province,
      settlement: q.settlement,
      difficulty: q.difficulty,
      acceptedAt: Date.now()
    }));
    
    await db.ref('activeQuests').set({
      quests: activeQuests,
      updatedAt: Date.now()
    });
    console.log('Synced accepted quests to Firebase:', activeQuests.length);
  } catch (error) {
    console.warn('Failed to sync quests to Firebase:', error);
  }
}

const $ = (id) => document.getElementById(id);

const state = {
  all: [],
  provinces: new Set(),
  factions: new Set(),
  qtypes: new Set(),
};

const ACCEPTED_KEY = "si_noticeboard_accepted_v1";
const OUTLINE_KEY  = "si_noticeboard_outlines_v1";

let accepted = loadAccepted();
let currentShown = []; // tracks what's currently pinned

let selectedAcceptedId = null;
let outlineCache = loadOutlineCache();

function loadAccepted(){
  try { return JSON.parse(localStorage.getItem(ACCEPTED_KEY) || "[]"); }
  catch { return []; }
}
function saveAccepted(){
  localStorage.setItem(ACCEPTED_KEY, JSON.stringify(accepted));
}

function loadOutlineCache(){
  try { return JSON.parse(localStorage.getItem(OUTLINE_KEY) || "{}"); }
  catch { return {}; }
}
function saveOutlineCache(){
  localStorage.setItem(OUTLINE_KEY, JSON.stringify(outlineCache));
}

function setSelectedAccepted(id){
  selectedAcceptedId = id;
  renderAccepted(); // updates highlight
  const q = accepted.find(x => x.id === id);
  renderQuestOutline(q || null);
}

function seededRand(seedStr){
  // deterministic 0..1 based on string seed (stable per quest id)
  let h = 2166136261;
  for(let i=0;i<seedStr.length;i++){
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // convert to 0..1
  return ((h >>> 0) % 10000) / 10000;
}

function pick(seedStr, arr){
  if(!arr.length) return null;
  const r = seededRand(seedStr);
  return arr[Math.floor(r * arr.length)];
}

function getOrBuildOutline(q){
  if(!q) return null;
  const key = String(q.id);
  if(outlineCache[key]) return outlineCache[key];

  const outline = buildOutlineFromQuest(q);
  outlineCache[key] = outline;
  saveOutlineCache();
  return outline;
}

function buildOutlineFromQuest(q){
  const lvl = `${q.level_min}-${q.level_max}`;
  const faction = String(q.faction || "Unknown");
  const province = String(q.province || "Unknown");
  const settlement = String(q.settlement || "Unknown");
  const tags = Array.isArray(q.tags) ? q.tags : [];

  const enemyBanks = {
    Investigation: ["Root-Woken Scouts", "Vein-touched Wolves", "Smuggler Cutthroats", "Warden Renegades"],
    Intrigue: ["Blackmail Crew", "Counterfeit Ring", "Temple Agents", "Dockside Enforcers"],
    Escort: ["Road Ambushers", "Raiders", "Saboteur Cell", "Beast in the Brush"],
    Retrieval: ["Lockhouse Thieves", "Relic-Hunters", "Tomb-Robbers", "False Priests"],
    Diplomacy: ["Hotheaded Duelists", "Toll-Gang Lieutenants", "Rival Delegates (armed)", "Mob of Agitators"],
    Exploration: ["Boundary Wardens", "Reef Predators", "Cave Stalkers", "Lost Patrol (hostile from fear)"],
    Military: ["Bandit Toll-Fort", "Zealot Vanguard", "Warband Scouts", "Corrupted Brutes"],
    Bounty: ["Wanted Lieutenant", "Smuggler Captain", "Deserter Sergeant", "Fence's Bodyguards"],
    Trade: ["Tariff Forgers", "Registry Saboteurs", "Warehouse Breakers", "Rival Brokers"]
  };

  const encounterType = pick(`encType:${q.id}`, ["Combat", "Chase", "Standoff", "Ambush"]);
  const enemy = pick(`enemy:${q.id}`, enemyBanks[q.quest_type] || ["Unknown Threat"]);
  const twist = pick(`twist:${q.id}`, [
    "The ‘villain' is being coerced by someone higher up.",
    "The obvious suspect is a planted distraction.",
    "The target isn't malicious, just terrified and cornered.",
    "A faction witness arrives mid-scene and complicates everything."
  ]);

  const checkBanks = {
    Investigation: [
      {skill:"Investigation", dc:13, win:"Find the key clue that points to the real location."},
      {skill:"Perception", dc:12, win:"Spot the detail everyone else missed."},
      {skill:"Insight", dc:12, win:"Clock who's lying or withholding."}
    ],
    Intrigue: [
      {skill:"Insight", dc:13, win:"Read the room and identify leverage."},
      {skill:"Deception or Persuasion", dc:14, win:"Get access without raising alarms."},
      {skill:"Stealth", dc:13, win:"Tail the suspect unseen."}
    ],
    Escort: [
      {skill:"Survival", dc:13, win:"Choose the safe route and avoid the worst ground."},
      {skill:"Perception", dc:12, win:"Spot the ambush early."},
      {skill:"Animal Handling or Intimidation", dc:13, win:"Break enemy morale or calm mounts."}
    ],
    Retrieval: [
      {skill:"Investigation", dc:13, win:"Locate the item's last known trail."},
      {skill:"Thieves' Tools or Sleight of Hand", dc:14, win:"Bypass a lock, seal, or ward."},
      {skill:"Arcana or Religion", dc:13, win:"Identify the magical ‘catch' on the item."}
    ],
    Diplomacy: [
      {skill:"Persuasion", dc:14, win:"Get both sides to agree to terms."},
      {skill:"Insight", dc:12, win:"Identify what each side actually wants."},
      {skill:"Intimidation", dc:13, win:"Stop a fight from starting (briefly)."}
    ],
    Exploration: [
      {skill:"Survival", dc:13, win:"Navigate hazards without losing time."},
      {skill:"Nature", dc:13, win:"Understand what the environment is ‘doing'."},
      {skill:"Perception", dc:12, win:"Notice the danger before it's on you."}
    ],
    Military: [
      {skill:"Stealth", dc:13, win:"Approach unseen and choose your angle."},
      {skill:"Athletics", dc:13, win:"Force entry or reposition fast."},
      {skill:"Intimidation", dc:14, win:"Make the leader surrender instead of die."}
    ],
    Bounty: [
      {skill:"Investigation", dc:13, win:"Confirm the target's hideout."},
      {skill:"Perception", dc:12, win:"Spot escape routes and traps."},
      {skill:"Athletics or Acrobatics", dc:13, win:"Catch them when they bolt."}
    ],
    Trade: [
      {skill:"Investigation", dc:13, win:"Trace the paperwork or registry change."},
      {skill:"Persuasion", dc:12, win:"Get cooperation from a reluctant official."},
      {skill:"Insight", dc:13, win:"Identify who profits and why."}
    ]
  };

  const checks = checkBanks[q.quest_type] || [
    {skill:"Investigation", dc:13, win:"Find the thread that ties it together."}
  ];

  const premise = `${q.description || q.notice || "A notice calls for help."}`;

  const beats = [
    `Briefing: Meet ${q.npc || q.posted_by || "the contact"} in ${settlement}. Get the real constraint (time, secrecy, or politics).`,
    `Lead 1: Follow the first clue through ${province} rumours, records, or witnesses.`,
    `Pressure: A complication hits (a rival faction, a lie exposed, or the trail goes cold).`,
    `Lead 2: Identify the true location of the confrontation (warehouse, grove, dock, road choke-point).`,
    `Confrontation: Resolve the main obstacle, then decide what you report back to ${faction}.`,
    `Aftermath: The outcome shifts local tension in ${settlement} (favour gained, heat earned, or a new hook revealed).`
  ];

  const complication = pick(`comp:${q.id}`, [
    "A witness demands protection and won't talk otherwise.",
    "A faction messenger arrives with an ultimatum.",
    "The environment turns hostile (fog, roots, tide, tremor).",
    "The party is offered a bribe to walk away."
  ]);

  const resolution = pick(`res:${q.id}`, [
    "Return proof to the poster and claim the reward cleanly.",
    "Deliver the truth quietly, but take a side-effect (a rival now knows you).",
    "Solve it publicly to set an example, risking political backlash."
  ]);

  return {
    title: q.title,
    metaLine: `${settlement} • ${province} • ${faction} • Lv ${lvl} • ${q.reward_gp} gp`,
    premise,
    beats,
    encounter: {
      type: `${encounterType}`,
      setup: `${encounterType} featuring: ${enemy}.`,
      twist
    },
    checks: checks.map(c => ({...c})),
    complication,
    resolution: `${resolution} Reward: ${q.reward_gp} gp${(q.secondary_rewards && q.secondary_rewards.length) ? " + " + q.secondary_rewards.join(", ") : ""}.`,
    pills: [
      q.quest_type,
      q.difficulty,
      ...(tags.slice(0,3))
    ].filter(Boolean)
  };
}

function renderQuestOutline(q){
  const body = $("leftPanelBody");
  const titleEl = $("leftPanelTitle");
  if(!body) return;

  if(!q){
    if(titleEl) titleEl.textContent = "Quest Outline";
    body.innerHTML = `<div class="muted">Accept a quest, then click it to view an outline here.</div>`;
    return;
  }

  const o = getOrBuildOutline(q);
  if(titleEl) titleEl.textContent = "Quest Outline";

  body.innerHTML = `
    <div class="qoTitle">${escapeHtml(o.title)}</div>
    <div class="qoMetaLine">${escapeHtml(o.metaLine)}</div>

    <div class="qoSection">
      <h3>Premise</h3>
      <ul class="qoList"><li>${escapeHtml(o.premise)}</li></ul>
      ${o.pills?.length ? `<div class="qoPillRow">${o.pills.map(p=>`<span class="qoPill">${escapeHtml(p)}</span>`).join("")}</div>` : ""}
    </div>

    <div class="qoSection">
      <h3>Beats</h3>
      <ul class="qoList">${o.beats.map(b=>`<li>${escapeHtml(b)}</li>`).join("")}</ul>
    </div>

    <div class="qoSection">
      <h3>Encounter</h3>
      <ul class="qoList">
        <li><strong>${escapeHtml(o.encounter.type)}:</strong> ${escapeHtml(o.encounter.setup)}</li>
        <li><strong>Twist:</strong> ${escapeHtml(o.encounter.twist)}</li>
      </ul>
    </div>

    <div class="qoSection">
      <h3>Key checks</h3>
      <ul class="qoList">
        ${o.checks.map(c=>`<li><strong>${escapeHtml(c.skill)} (DC ${c.dc}):</strong> ${escapeHtml(c.win)}</li>`).join("")}
      </ul>
    </div>

    <div class="qoSection">
      <h3>Complication</h3>
      <ul class="qoList"><li>${escapeHtml(o.complication)}</li></ul>
    </div>

    <div class="qoSection">
      <h3>Resolution</h3>
      <ul class="qoList"><li>${escapeHtml(o.resolution)}</li></ul>
    </div>
  `;
}

// (Disabled for now) Cloudflare Worker quest expansion.
// Your app currently uses local deterministic outlines (buildOutlineFromQuest).
async function expandQuestOnce(quest){
  throw new Error("expandQuestOnce is disabled (not wired in yet).");
}

function acceptQuest(q){
  if(!q || typeof q.id === "undefined") return;

  if(!accepted.some(x => x.id === q.id)){
    accepted.push(q);
    saveAccepted();
    // build outline immediately so it's ready on click
    getOrBuildOutline(q);
    // Sync to Firebase for shop integration
    syncAcceptedToFirebase();
  }

  renderAccepted();
  setSelectedAccepted(q.id); // auto-select
}

function removeAccepted(id){
  accepted = accepted.filter(q => q.id !== id);
  saveAccepted();
  // Sync to Firebase for shop integration
  syncAcceptedToFirebase();
  renderAccepted();
}

function renderAccepted(){
  const box = $("acceptedList");
  if(!box) return;

  if(!accepted.length){
    box.innerHTML = `<div class="muted">No accepted quests yet.</div>`;
    return;
  }

  const byProv = accepted.reduce((acc, q) => {
    const p = q.province || "Unknown";
    (acc[p] ||= []).push(q);
    return acc;
  }, {});

  const provs = Object.keys(byProv).sort((a,b)=>a.localeCompare(b));

  box.innerHTML = provs.map(p => {
    const items = byProv[p]
      .sort((a,b)=>String(a.title).localeCompare(String(b.title)))
      .map(q => `
        <div class="accItem ${selectedAcceptedId===q.id ? "selected" : ""}" data-acc="${q.id}">
          <div class="accTitle">${escapeHtml(q.title)}</div>
          <div class="accMeta">
            ${escapeHtml(q.settlement)} • ${escapeHtml(q.faction)} • Lv ${q.level_min}-${q.level_max}
            <span style="float:right; cursor:pointer;" title="Remove" data-rm="${q.id}">✕</span>
          </div>
        </div>
      `).join("");

    return `<div class="accGroup">
      <div class="accProv">${escapeHtml(p)}</div>
      ${items}
    </div>`;
  }).join("");

  // bind select click
  box.querySelectorAll("[data-acc]").forEach(el => {
    el.addEventListener("click", () => {
      const id = parseInt(el.getAttribute("data-acc"), 10);
      setSelectedAccepted(id);
    });
  });

  // bind remove buttons (stop click bubbling)
  box.querySelectorAll("[data-rm]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const rid = parseInt(el.getAttribute("data-rm"), 10);
      removeAccepted(rid);
      if(selectedAcceptedId === rid){
        selectedAcceptedId = null;
        renderQuestOutline(null);
      }
    });
  });
}

function isClanFaction(faction){
  return String(faction || "").startsWith("Clan ");
}
function isTempleFaction(faction){
  return String(faction || "").startsWith("Temple of ");
}
function honourPass(q, clanHonour, templeHonour){
  const hr = q.honour_required;
  if(!hr) return true;

  // supports both formats:
  // 1) honour_required: { clan: 1 } / { temple: 2 }
  // 2) honour_required: 2 + honour_type: "clan"/"temple" (legacy)
  if(typeof hr === "object"){
    if(typeof hr.clan === "number") return clanHonour >= hr.clan;
    if(typeof hr.temple === "number") return templeHonour >= hr.temple;
    return true;
  }

  if(!q.honour_type) return true;
  if(q.honour_type === "clan") return clanHonour >= hr;
  if(q.honour_type === "temple") return templeHonour >= hr;
  return true;
}

function eligiblePool(){
  const province = $("province").value;
  const faction = $("faction").value;
  const qtype = $("qtype").value;
  const level = clampInt($("level").value, 7, 16);
  const clanHonour = parseInt($("clanHonour").value, 10);
  const templeHonour = parseInt($("templeHonour").value, 10);

  const pool = state.all.filter(q => {
    const inProvince = (province === "ALL") || (q.province === province);
    const inFaction = (faction === "ALL") || (q.faction === faction);
    const inType = (qtype === "ALL") || (q.quest_type === qtype);
    const inLevel = (q.quest_type === "Bounty")
  ? (level >= 7 && level <= 10)          // show bounties on party level 7–10 regardless
  : (level >= q.level_min && level <= q.level_max);
    const okHonour = honourPass(q, clanHonour, templeHonour);
    return inProvince && inFaction && inType && inLevel && okHonour;
  });

  updateActiveFilters({province, faction, qtype, level, clanHonour, templeHonour, poolCount: pool.length});
  $("poolCount").textContent = String(pool.length);
  return pool;
}

function updateActiveFilters(f){
  // Active Filters panel removed (intentionally).
  // Keep this function so other code can call it harmlessly.
  return;
}

function clampInt(v, min, max){
  const n = parseInt(v, 10);
  if(Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function sample(arr, n){
  const copy = arr.slice();
  // Fisher-Yates partial shuffle
  for(let i=copy.length-1; i>0; i--){
    const j = Math.floor(Math.random() * (i+1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function renderParchments(list){
  const wrap = $("parchments");
  const empty = $("emptyState");
  wrap.innerHTML = "";

  if(!list.length){
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  list.forEach((q, idx) => {
    const card = document.createElement("article");
    card.className = "parchment";
    const rot = ((Math.random()*2.4)-1.2).toFixed(2);
    card.style.setProperty("--rot", rot + "deg");

    const nail1 = document.createElement("div");
    nail1.className = "nail";
    const nail2 = document.createElement("div");
    nail2.className = "nail r";

    const isBounty = (q.quest_type === "Bounty");

// Title area (special formatting for bounties)
let headerEl, targetEl, rewardEl;

if(isBounty){
  headerEl = document.createElement("div");
  headerEl.className = "bountyHead";
  headerEl.textContent = "BOUNTY";

  targetEl = document.createElement("div");
  targetEl.className = "bountyTarget";
  targetEl.textContent = q.title; // target name/monster

  rewardEl = document.createElement("div");
  rewardEl.className = "bountyReward";
  rewardEl.textContent = `${q.reward_gp} gp`;

} else {
  headerEl = document.createElement("div");
  headerEl.className = "title";
  headerEl.textContent = q.title;

  targetEl = document.createElement("p");
  targetEl.className = "notice";
  targetEl.textContent = q.notice || q.description || q.summary || "";

  rewardEl = null;
}

    const meta = document.createElement("div");
    meta.className = "meta";
    const tags = [
      q.province,
      q.settlement,
      q.quest_type,
      q.faction,
      `Lv ${q.level_min}-${q.level_max}`,
      `${q.reward_gp} gp`
    ];
    tags.forEach(t => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = t;
      meta.appendChild(tag);
    });

    if(Array.isArray(q.secondary_rewards) && q.secondary_rewards.length){
      q.secondary_rewards.forEach(s => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = s;
        meta.appendChild(tag);
      });
    }

        const actions = document.createElement("div");
    actions.className = "actions";

    const btnAccept = document.createElement("button");
    btnAccept.className = "btn accept";
    btnAccept.type = "button";
    btnAccept.textContent = "Accept";
    btnAccept.addEventListener("click", () => acceptQuest(q));

    const btnDecline = document.createElement("button");
    btnDecline.className = "btn decline";
    btnDecline.type = "button";
    btnDecline.textContent = "Decline";
    btnDecline.addEventListener("click", () => {
      // remove from current shown and re-render
      currentShown = currentShown.filter(x => x.id !== q.id);
      renderParchments(currentShown);
    });

    actions.appendChild(btnAccept);
    actions.appendChild(btnDecline);

     const sig = document.createElement("div");
    sig.className = "sig";
    sig.textContent = `— ${q.posted_by || q.npc_name || q.npc || "Unsigned"}`;

    card.appendChild(nail1);
    card.appendChild(nail2);
    card.appendChild(headerEl);
card.appendChild(targetEl);
if(rewardEl) card.appendChild(rewardEl);
    card.appendChild(meta);
    card.appendChild(actions);
    card.appendChild(sig);

    wrap.appendChild(card);
    syncBoardToPopout(); 
  });
}

function populateSelect(selectEl, items, includeAll=true){
  selectEl.innerHTML = "";
  if(includeAll){
    const opt = document.createElement("option");
    opt.value = "ALL";
    opt.textContent = "All";
    selectEl.appendChild(opt);
  }
  [...items].sort().forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function populateHonour(){
  const clan = $("clanHonour");
  const temple = $("templeHonour");
  const vals = [];
  for(let i=-3;i<=3;i++) vals.push(i);
  [clan, temple].forEach(sel => {
    sel.innerHTML = "";
    vals.forEach(v => {
      const opt = document.createElement("option");
      opt.value = String(v);
      opt.textContent = String(v);
      sel.appendChild(opt);
    });
  });
  clan.value = "0";
  temple.value = "0";
}

async function loadData(){
  const res = await fetch("data/quests.json", {cache:"no-store"});
  if(!res.ok) throw new Error("Failed to load quests.json");
  const data = await res.json();
  state.all = (data.quests || []);

  state.all.forEach(q => {
    state.provinces.add(q.province);
    state.factions.add(q.faction);
    state.qtypes.add(q.quest_type);
  });

  const provSel = $("province");
  provSel.innerHTML = '<option value="ALL">All</option>' + [...state.provinces].sort().map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");

  populateSelect($("faction"), state.factions, true);
  populateSelect($("qtype"), state.qtypes, true);

  $("loadedCount").textContent = String(state.all.length);
  eligiblePool(); // initialize counts + filter display
   renderAccepted();
   renderQuestOutline(null);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[c]));
}

function bind(){
  const reroll = () => eligiblePool();

  ["province","faction","qtype","level","clanHonour","templeHonour"].forEach(id => {
    $(id).addEventListener("change", reroll);
    $(id).addEventListener("input", reroll);
  });

  $("btnGenerate").addEventListener("click", () => {
  const pool = eligiblePool();
  const n = clampInt($("count").value, 1, 6);

  const bounties = pool.filter(q => q.quest_type === "Bounty");
  const normal  = pool.filter(q => q.quest_type !== "Bounty");

  const picked = [];

  // allow at most ONE bounty per click
  if (bounties.length){
    picked.push(bounties[Math.floor(Math.random() * bounties.length)]);
  }

  // fill remaining slots with normal quests
  const remaining = n - picked.length;
  if (remaining > 0 && normal.length){
    picked.push(...sample(normal, remaining));
  }

  currentShown = picked;
  renderParchments(currentShown);
});
   
  $("btnClear").addEventListener("click", () => {
  currentShown = [];
  $("parchments").innerHTML = "";
  $("emptyState").style.display = "block";
});
}

let popWin = null;

function openBoardPopout(){
  // If already open, focus it
  if(popWin && !popWin.closed){
    popWin.focus();
    syncBoardToPopout();
    return;
  }

  popWin = window.open("", "si_board_popout", "width=1100,height=800");
  if(!popWin) return; // popup blocked

  // Build a simple standalone document that loads your same CSS
  popWin.document.open();
  popWin.document.write(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Scarlett Isles Noticeboard</title>
  <link rel="stylesheet" href="styles.css" />
  <style>
    /* Popout-only tweaks */
    body{ margin:0; }
    .stage{ padding:14px; }
    .centerRow{ grid-template-columns: 1fr; }
    /* hide side panels if they exist in copied HTML */
    #leftPanel, #rightPanel, #acceptedPanel, .sidePanel{ display:none !important; }
    /* make board fill the window nicely */
    .board{ max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="stage">
    <div id="popBoardHost"></div>
  </div>
</body>
</html>
  `);
  popWin.document.close();

  // Wait a tick for DOM to exist
  setTimeout(syncBoardToPopout, 50);
}

function syncBoardToPopout(){
  if(!popWin || popWin.closed) return;

  const board = document.querySelector(".board");
  const host = popWin.document.getElementById("popBoardHost");
  if(!board || !host) return;

  // Clone the noticeboard panel only
  host.innerHTML = "";
  host.appendChild(board.cloneNode(true));
}

document.getElementById("btnPopOut")?.addEventListener("click", openBoardPopout);


function moveTopPanels(){
  const slot = $("topRightPanels");
  const pool = $("poolPanel");
  const gates = $("gatesPanel");
  if(!slot) return;
  if(pool) slot.appendChild(pool);
  if(gates) slot.appendChild(gates);
}

(async function init(){
  // Initialize Firebase for shop sync
  initFirebase();
  
  populateHonour();
  bind();
  requestAnimationFrame(moveTopPanels);
  try{
    await loadData();
    // Sync any existing accepted quests to Firebase
    if (accepted.length > 0) {
      syncAcceptedToFirebase();
    }
  }catch(e){
    console.error(e);
    $("emptyState").style.display = "block";
    $("emptyState").innerHTML = `
      <div class="emptyCard">
        <div class="emptyTitle">Couldn't load quest data.</div>
        <div class="emptyText">Check that <code>data/quests.json</code> exists and that you're serving the folder (GitHub Pages is perfect).</div>
      </div>`;
  }
})();
