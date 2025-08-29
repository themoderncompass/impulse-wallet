// API base on your main domain (Worker is routed there)
const API_BASE = "https://themoderncompass.io/impulse-api";

// sound hooks
const SOUND_GOOD = "https://cdn.pixabay.com/download/audio/2022/08/02/audio_2a1f1b.mp3?filename=new-notification-017-352293.mp3";
const SOUND_BAD  = "https://cdn.pixabay.com/download/audio/2021/08/04/audio_0a2e6b.mp3?filename=windows-error-sound-effect-35894.mp3";
let audioEnabled=false; const sndGood=new Audio(SOUND_GOOD), sndBad=new Audio(SOUND_BAD);
document.addEventListener("click",()=>{audioEnabled=true},{once:true});

// el refs
const el = {
  room: q("#room"), name: q("#name"), create: q("#create"), join: q("#join"),
  play: q("#play"), week: q("#week"), impulse: q("#impulse"),
  plus: q("#plus"), minus: q("#minus"), banner: q("#banner"),
  board: q("#board tbody"), undo: q("#undo"), months: q("#months"),
  mine: q("#mine tbody"), csv: q("#csv")
};

// helpers
function q(s){return document.querySelector(s)}
async function api(path, opts){ const r = await fetch(API_BASE+path,{credentials:"include",...opts}); if(!r.ok) throw new Error((await r.json()).error||r.status); return r.json(); }
function h(text){return String(text).replace(/[&<>\"']/g,c=>({ \"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",\"\\\"\":\"&quot;\",\"'\":\"&#39;\" }[c]))}

let roomCode=null;

async function createRoom(){
  const data = await api("/room",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  roomCode = data.roomCode; el.room.value = roomCode;
}

async function doJoin(){
  roomCode = (el.room.value||"").trim().toUpperCase();
  const name = (el.name.value||"").trim();
  if(!roomCode||!name) return alert("Enter room code and display name");
  await api("/join",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roomCode,displayName:name})});
  document.querySelector(".join").classList.add("hidden");
  el.play.classList.remove("hidden");
  refresh(); loadHistory();
}

async function submit(amount){
  const impulse = el.impulse.value.trim();
  try {
    const data = await api("/entry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roomCode,amount,impulse})});
    paint(data);
    el.impulse.value="";
    if(audioEnabled){ try{ (amount===1?sndGood:sndBad).currentTime=0; (amount===1?sndGood:sndBad).play(); }catch{} }
  } catch(e){ alert(e.message); }
}

async function undoLast(){
  try { const data = await api("/undo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roomCode})}); paint(data); }
  catch(e){ alert(e.message); }
}

async function refresh(){
  if(!roomCode) return;
  try { const data = await api(`/state?roomCode=${encodeURIComponent(roomCode)}`); paint(data); } catch(e){ /* ignore */ }
}

function paint(s){
  el.week.textContent = `Week ${s.weekKey}`;
  el.banner.classList.add("hidden"); el.banner.classList.remove("banner-loss");
  if(s.milestone==="win"){ el.banner.textContent=\"You hit +$20 this week. Keep going.\"; el.banner.classList.remove(\"hidden\"); }
  if(s.milestone==="loss"){ el.banner.textContent=\"You hit −$20 this week. Keep tracking.\"; el.banner.classList.add(\"banner-loss\"); el.banner.classList.remove(\"hidden\"); }
  el.board.innerHTML=\"\"; for(const r of s.leaderboard){ const tr=document.createElement(\"tr\"); tr.innerHTML=`<td>${h(r.name)}</td><td>${r.balance}</td><td>${(r.depositRate||0).toFixed(2)}</td><td>${r.longestStreak}</td>`; el.board.appendChild(tr); }
}

async function loadHistory(){
  if(!roomCode) return;
  const n = Number(el.months.value||12);
  try {
    const data = await api(`/history?roomCode=${encodeURIComponent(roomCode)}&months=${n}`);
    el.mine.innerHTML=\"\";
    for(const row of data.entries){
      const tr=document.createElement(\"tr\");
      const when = new Date(row.created_at).toLocaleString(\"en-US\",{timeZone:\"America/Chicago\"});
      tr.innerHTML=`<td>${h(when)}</td><td>${row.amount}</td><td>${h(row.impulse||\"\")}</td><td>${h(row.note||\"\")}</td>`;
      el.mine.appendChild(tr);
    }
  } catch(e){ /* ignore */ }
}

function exportCSV(){
  const rows=[[\"When\",\"Amount\",\"Impulse\",\"Note\"]];
  for(const tr of el.mine.querySelectorAll(\"tr\")){ const cells=[...tr.children].map(td=>`\"${td.textContent.replace(/\\\"/g,'\\\"')}\"`); rows.push(cells.join(\",\")); }
  const blob=new Blob([rows.join(\"\\n\")],{type:\"text/csv\"}); const a=document.createElement(\"a\"); a.href=URL.createObjectURL(blob); a.download=\"impulse_wallet_history.csv\"; a.click(); URL.revokeObjectURL(a.href);
}

document.querySelector(\"#create\").addEventListener(\"click\", createRoom);
document.querySelector(\"#join\").addEventListener(\"click\", doJoin);
document.querySelector(\"#plus\").addEventListener(\"click\", ()=>submit(1));
document.querySelector(\"#minus\").addEventListener(\"click\", ()=>submit(-1));
document.querySelector(\"#undo\").addEventListener(\"click\", undoLast);
document.querySelector(\"#months\").addEventListener(\"change\", loadHistory);
document.querySelector(\"#csv\").addEventListener(\"click\", exportCSV);

setInterval(()=>{refresh(); loadHistory();}, 5000);
