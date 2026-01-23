/* Scarlett Isles – Notice Board Quest Generator (vanilla JS)
   Data model: data/quests.json
*/

const $ = (id) => document.getElementById(id);

const state = {
  all: [],
  provinces: new Set(),
  factions: new Set(),
  qtypes: new Set(),
};

function isClanFaction(faction){
  return String(faction || "").startsWith("Clan ");
}
function isTempleFaction(faction){
  return String(faction || "").startsWith("Temple of ");
}
function honourPass(q, clanHonour, templeHonour){
  if(!q.honour_required || !q.honour_type) return true;
  if(q.honour_type === "clan") return clanHonour >= q.honour_required;
  if(q.honour_type === "temple") return templeHonour >= q.honour_required;
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
    const inLevel = (level >= q.level_min && level <= q.level_max);
    const okHonour = honourPass(q, clanHonour, templeHonour);
    return inProvince && inFaction && inType && inLevel && okHonour;
  });

  updateActiveFilters({province, faction, qtype, level, clanHonour, templeHonour, poolCount: pool.length});
  $("poolCount").textContent = String(pool.length);
  return pool;
}

function updateActiveFilters(f){
  const rows = [
    ["Province", f.province],
    ["Faction", f.faction],
    ["Quest Type", f.qtype],
    ["Party Level", String(f.level)],
    ["Clan Honour", String(f.clanHonour)],
    ["Temple Honour", String(f.templeHonour)],
  ];
  const el = $("activeFilters");
  el.innerHTML = "";
  rows.forEach(([k,v]) => {
    const kEl = document.createElement("div");
    kEl.className = "k";
    kEl.textContent = k;
    const vEl = document.createElement("div");
    vEl.className = "v";
    vEl.textContent = v;
    el.appendChild(kEl);
    el.appendChild(vEl);
  });
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

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = q.title;

    const notice = document.createElement("p");
    notice.className = "notice";
    notice.textContent = q.notice || q.description || q.summary || "";

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

    const sig = document.createElement("div");
    sig.className = "sig";
    sig.textContent = `— ${q.posted_by || q.npc_name || q.npc || "Unsigned"}`;

    card.appendChild(nail1);
    card.appendChild(nail2);
    card.appendChild(title);
    card.appendChild(notice);
    card.appendChild(meta);
    card.appendChild(sig);

    wrap.appendChild(card);
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
    renderParchments(sample(pool, n));
  });

  $("btnClear").addEventListener("click", () => {
    $("parchments").innerHTML = "";
    $("emptyState").style.display = "block";
  });
}

(async function init(){
  populateHonour();
  bind();
  try{
    await loadData();
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
