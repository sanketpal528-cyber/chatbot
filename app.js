/* ═══════════════════════════════════════════════════════
   Voxify AI — Complete Assistant  app.js
   ═══════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────────
let CFG = {
  key:       localStorage.getItem('vx_key')   || '',
  model:     localStorage.getItem('vx_model') || 'gemini-3.6-flash',
  theme:     localStorage.getItem('vx_theme') || 'dark',
  voice:     localStorage.getItem('vx_voice') || '',
  lang:      localStorage.getItem('vx_lang')  || 'en-US',
  persona:   localStorage.getItem('vx_persona') || 'helpful',
  voiceOut:  localStorage.getItem('vx_voiceOut') !== 'false',
  wakeword:  localStorage.getItem('vx_wakeword') === 'true',
};
let chatHistory  = JSON.parse(localStorage.getItem('vx_chat')   || '[]');
let memories     = JSON.parse(localStorage.getItem('vx_mem')    || '[]');
let notes        = JSON.parse(localStorage.getItem('vx_notes')  || '[]');
let tasks        = JSON.parse(localStorage.getItem('vx_tasks')  || '[]');
let goals        = JSON.parse(localStorage.getItem('vx_goals')  || '[]');
let calEvents    = JSON.parse(localStorage.getItem('vx_cal')    || '[]');
let analytics    = JSON.parse(localStorage.getItem('vx_stats')  || '{"chats":0,"voice":0,"study":0,"code":0,"files":0,"tasks":0}');
let activeNote   = null;
let pdfText      = '';
let fileText     = '';
let curSection   = 'home';
let calDate      = new Date();
let studyTab     = 'explain';
let voiceActive  = false;
let wakeListener = null;
const OLD_MODELS = ['gemini-1.5-flash','gemini-1.5-pro','gemini-2.0-flash','gemini-2.5-flash','gemini-2.5-pro','gemini-2.5-flash-lite'];

const API = () => `https://generativelanguage.googleapis.com/v1beta/models/${CFG.model}:generateContent?key=${CFG.key}`;

// ── Init ─────────────────────────────────────────────────
window.addEventListener('load', () => {
  if (OLD_MODELS.includes(CFG.model)) { CFG.model = 'gemini-3.6-flash'; save('vx_model', CFG.model); }
  applyTheme(CFG.theme);
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  if (!CFG.key) { document.getElementById('setupModal').style.display='flex'; return; }
  launchApp();
});

function launchApp() {
  document.getElementById('setupModal').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('sbModel').textContent = CFG.model;
  go('home');
  if (CFG.wakeword) startWakeWord();
  checkReminders();
  setInterval(checkReminders, 60000);
}

// ── Save helpers ─────────────────────────────────────────
const save = (k,v) => localStorage.setItem(k, typeof v==='string' ? v : JSON.stringify(v));
const saveCFG = () => { Object.entries(CFG).forEach(([k,v]) => save('vx_'+k, v)); };

// ── Theme ─────────────────────────────────────────────────
function applyTheme(t) {
  document.body.className = t;
  document.getElementById('themeBtn').innerHTML = t==='dark' ? '<i class="fa fa-sun"></i>' : '<i class="fa fa-moon"></i>';
}
function toggleTheme() {
  CFG.theme = CFG.theme==='dark' ? 'light' : 'dark';
  applyTheme(CFG.theme); save('vx_theme', CFG.theme);
}

// ── API Key ───────────────────────────────────────────────
function saveKey() {
  const k = document.getElementById('apiKeyInput').value.trim();
  if (!k || k.length < 10) { toast('Enter a valid API key','err'); return; }
  CFG.key = k; save('vx_key', k);
  launchApp();
}
function toggleVis() {
  const i = document.getElementById('apiKeyInput');
  const b = document.getElementById('visBtn');
  i.type = i.type==='password' ? 'text' : 'password';
  b.innerHTML = i.type==='password' ? '<i class="fa fa-eye"></i>' : '<i class="fa fa-eye-slash"></i>';
}

// ── Sidebar ───────────────────────────────────────────────
function toggleSB() {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth <= 768) sb.classList.toggle('open');
  else sb.classList.toggle('hidden');
}
function closeSB() { document.getElementById('sidebar').classList.remove('open'); }

// ── Navigation ────────────────────────────────────────────
const TITLES = {
  home:'<i class="fa fa-house"></i> Home', chat:'<i class="fa fa-message"></i> Chat',
  memory:'<i class="fa fa-brain"></i> Memory', voice:'<i class="fa fa-microphone"></i> Voice',
  study:'<i class="fa fa-graduation-cap"></i> Study', coding:'<i class="fa fa-code"></i> Coding',
  files:'<i class="fa fa-folder-open"></i> File Assistant', internet:'<i class="fa fa-globe"></i> Internet',
  tasks:'<i class="fa fa-list-check"></i> Tasks & Goals', notes:'<i class="fa fa-note-sticky"></i> Notes',
  calendar:'<i class="fa fa-calendar"></i> Calendar', comms:'<i class="fa fa-envelope"></i> Communication',
  utils:'<i class="fa fa-calculator"></i> Utilities', aitools:'<i class="fa fa-wand-magic-sparkles"></i> AI Tools',
  computer:'<i class="fa fa-desktop"></i> Computer Control', security:'<i class="fa fa-shield-halved"></i> Security',
  analytics:'<i class="fa fa-chart-bar"></i> Analytics', settings:'<i class="fa fa-gear"></i> Settings'
};
function go(s) {
  curSection = s;
  document.querySelectorAll('.nb').forEach(b => b.classList.toggle('active', b.dataset.s===s));
  document.getElementById('tbTitle').innerHTML = TITLES[s] || s;
  const c = document.getElementById('content');
  c.innerHTML = '';
  const renders = {
    home, chat:renderChat, memory:renderMemory, voice:renderVoice,
    study:renderStudy, coding:renderCoding, files:renderFiles, internet:renderInternet,
    tasks:renderTasks, notes:renderNotes, calendar:renderCalendar, comms:renderComms,
    utils:renderUtils, aitools:renderAITools, computer:renderComputer, security:renderSecurity,
    analytics:renderAnalytics, settings:renderSettings
  };
  if (renders[s]) renders[s](c);
  if (window.innerWidth <= 768) closeSB();
}

// ── Gemini API ────────────────────────────────────────────
async function gemini(prompt, sys='', useHist=false) {
  setStatus('Thinking...');
  let content = prompt;
  if (sys) content = sys + '\n\n' + prompt;
  if (useHist && chatHistory.length > 0) {
    const ctx = chatHistory.slice(-12).map(m=>`${m.r}: ${m.t}`).join('\n');
    content = (sys ? sys+'\n\n' : '') + 'Conversation:\n' + ctx + '\n\nUser: ' + prompt;
  }
  // Add memory context
  if (memories.length > 0) {
    const mems = memories.slice(-8).map(m=>m.text).join('; ');
    content += '\n\n[User memories: ' + mems + ']';
  }
  try {
    const r = await fetch(API(), {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ contents:[{role:'user',parts:[{text:content}]}], generationConfig:{temperature:0.7,maxOutputTokens:2048} })
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const reply = d.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
    setStatus('Ready');
    return reply;
  } catch(e) {
    setStatus('Error');
    if (e.message.includes('API key')||e.message.includes('INVALID')) toast('Invalid API key — update in Settings','err');
    return 'Error: ' + e.message;
  }
}

// ── Status / Toast ────────────────────────────────────────
function setStatus(t) { const el=document.getElementById('statusTxt'); if(el) el.textContent=t; }
let toastT;
function toast(m, type='') {
  const el=document.getElementById('toast');
  el.textContent=m; el.className=`toast ${type==='err'?'err':''}`;
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.add('hidden'),3500);
}

// ── Format markdown ───────────────────────────────────────
function fmt(t) {
  return t
    .replace(/```(\w*)\n([\s\S]*?)```/g,'<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/^#{3}\s(.+)$/gm,'<h4>$1</h4>')
    .replace(/^#{2}\s(.+)$/gm,'<h3>$1</h3>')
    .replace(/^#{1}\s(.+)$/gm,'<h2>$1</h2>')
    .replace(/^[-•]\s(.+)$/gm,'• $1')
    .replace(/\n/g,'<br/>');
}
function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,150)+'px'; }

// ── Add message to a window ───────────────────────────────
function addMsg(winId, role, text, actions=[]) {
  const win = document.getElementById(winId); if(!win) return;
  const d = document.createElement('div');
  d.className = `msg ${role}`;
  if (role==='bot'||role==='sys') d.innerHTML = fmt(text);
  else d.textContent = text;
  if (actions.length && role==='bot') {
    const ab = document.createElement('div'); ab.className='msg-actions';
    actions.forEach(a => { const b=document.createElement('button'); b.className='msg-act-btn'; b.textContent=a.label; b.onclick=a.fn; ab.appendChild(b); });
    d.appendChild(ab);
  }
  win.appendChild(d); win.scrollTop=win.scrollHeight;
}
function addTyping(winId) {
  const win=document.getElementById(winId); if(!win) return;
  const d=document.createElement('div'); d.className='typing'; d.id='typ-'+winId;
  d.innerHTML='<span></span><span></span><span></span>'; win.appendChild(d); win.scrollTop=win.scrollHeight;
}
function rmTyping(winId) { const e=document.getElementById('typ-'+winId); if(e) e.remove(); }

// ══════════════════════════════════════════════════════════
// HOME
// ══════════════════════════════════════════════════════════
function home(c) {
  const today = new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});
  const pending = tasks.filter(t=>!t.done).length;
  const todayNotes = notes.filter(n=>new Date(n.date).toDateString()===new Date().toDateString()).length;
  c.innerHTML = `
  <div class="home-hero">
    <div>
      <h1>Good ${getGreeting()}, Sanket! 👋</h1>
      <p>${today} — Your AI assistant is ready. What would you like to do today?</p>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1rem">
        <button class="btn btn-primary" onclick="go('chat')"><i class="fa fa-message"></i> Start Chat</button>
        <button class="btn btn-ghost" onclick="go('voice')"><i class="fa fa-microphone"></i> Voice Mode</button>
        <button class="btn btn-ghost" onclick="go('study')"><i class="fa fa-graduation-cap"></i> Study</button>
      </div>
    </div>
    <div class="home-hero-icon">🤖</div>
  </div>
  <div class="summary-box">
    <h3><i class="fa fa-sun" style="color:var(--cyan)"></i> Daily Summary</h3>
    <div class="summary-item"><i class="fa fa-list-check"></i> <span>${pending} pending tasks</span></div>
    <div class="summary-item"><i class="fa fa-note-sticky"></i> <span>${todayNotes} notes today</span></div>
    <div class="summary-item"><i class="fa fa-brain"></i> <span>${memories.length} memories saved</span></div>
    <div class="summary-item"><i class="fa fa-message"></i> <span>${chatHistory.length} messages in chat history</span></div>
    <div class="summary-item"><i class="fa fa-chart-bar"></i> <span>${analytics.chats} total AI conversations</span></div>
  </div>
  <div class="section-title" style="font-size:1rem;margin-bottom:.75rem">Quick Actions</div>
  <div class="cards-grid">
    ${[
      {i:'💬',t:'Chat',d:'Ask Voxify anything',s:'chat'},
      {i:'🎤',t:'Voice',d:'Speak to Voxify',s:'voice'},
      {i:'📚',t:'Study',d:'Learn any topic',s:'study'},
      {i:'💻',t:'Coding',d:'Code assistant',s:'coding'},
      {i:'📂',t:'Files',d:'Analyze documents',s:'files'},
      {i:'🌐',t:'Internet',d:'Search & research',s:'internet'},
      {i:'📅',t:'Tasks',d:'Manage your tasks',s:'tasks'},
      {i:'📝',t:'Notes',d:'Write & organize',s:'notes'},
    ].map(x=>`<div class="card" onclick="go('${x.s}')"><div class="card-icon">${x.i}</div><div class="card-title">${x.t}</div><div class="card-desc">${x.d}</div></div>`).join('')}
  </div>`;
}
function getGreeting() {
  const h=new Date().getHours();
  return h<12?'morning':h<17?'afternoon':'evening';
}

// ══════════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════════
function renderChat(c) {
  c.style.padding='0';
  c.innerHTML = `
  <div class="chat-wrap" style="height:calc(100vh - 50px)">
    <div class="chat-history">
      <span><i class="fa fa-clock-rotate-left"></i> ${chatHistory.length} messages</span>
      <div style="display:flex;gap:.5rem">
        <button onclick="searchChat()"><i class="fa fa-magnifying-glass"></i> Search</button>
        <button onclick="clearChatHist()"><i class="fa fa-trash"></i> Clear</button>
        <button onclick="shareChatExport()"><i class="fa fa-share-nodes"></i> Export</button>
      </div>
    </div>
    <div id="chatWin" class="chat-win"></div>
    <div class="input-area">
      <div class="input-box">
        <button class="ib-btn mic-b" id="chatMic" onclick="toggleChatMic()" title="Voice input"><i class="fa fa-microphone"></i></button>
        <textarea id="chatTa" rows="1" placeholder="Ask anything..." onkeydown="chatKey(event)" oninput="autoResize(this)"></textarea>
        <button class="ib-btn send-b" onclick="sendChat()"><i class="fa fa-paper-plane"></i></button>
      </div>
      <div class="input-hint">Enter to send · Shift+Enter for new line · 🎤 for voice</div>
    </div>
  </div>`;
  // Restore history
  chatHistory.slice(-30).forEach(m => addMsg('chatWin', m.r==='user'?'user':'bot', m.t));
  if (!chatHistory.length) addMsg('chatWin','bot','Hi! I\'m **Voxify AI**. Ask me anything — I remember our conversations and your preferences. 😊');
}

async function sendChat() {
  const ta = document.getElementById('chatTa');
  const msg = ta.value.trim(); if (!msg) return;
  ta.value = ''; autoResize(ta);
  addMsg('chatWin','user',msg);
  chatHistory.push({r:'user',t:msg,ts:Date.now()});
  save('vx_chat', chatHistory);
  analytics.chats++; save('vx_stats', analytics);
  addTyping('chatWin');
  const sys = personas[CFG.persona] || personas.helpful;
  const reply = await gemini(msg, sys, true);
  rmTyping('chatWin');
  addMsg('chatWin','bot',reply,[
    {label:'📋 Copy', fn:()=>{navigator.clipboard.writeText(reply);toast('Copied!')}},
    {label:'🔊 Speak', fn:()=>speak(reply)},
    {label:'💾 Save to Notes', fn:()=>saveToNote(reply)}
  ]);
  chatHistory.push({r:'bot',t:reply,ts:Date.now()});
  if (chatHistory.length > 100) chatHistory = chatHistory.slice(-100);
  save('vx_chat', chatHistory);
  if (CFG.voiceOut) speak(reply.replace(/<[^>]*>/g,'').replace(/[#*`]/g,'').slice(0,300));
}

function chatKey(e) { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();} }

function clearChatHist() {
  if (!confirm('Clear all chat history?')) return;
  chatHistory=[]; save('vx_chat',[]); go('chat'); toast('Chat cleared');
}

function shareChatExport() {
  const txt = chatHistory.map(m=>`${m.r==='user'?'You':'Voxify'}: ${m.t}`).join('\n\n');
  const b = new Blob([txt],{type:'text/plain'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download='voxify_chat.txt'; a.click();
  toast('Chat exported!');
}

function searchChat() {
  const q = prompt('Search in chat history:'); if(!q) return;
  const results = chatHistory.filter(m=>m.t.toLowerCase().includes(q.toLowerCase()));
  alert(`Found ${results.length} message(s) containing "${q}"`);
}

function saveToNote(text) {
  notes.unshift({title:'From Chat - '+new Date().toLocaleDateString(),body:text,date:Date.now()});
  save('vx_notes',notes); toast('Saved to Notes ✓');
}

const personas = {
  helpful: 'You are Voxify AI, a helpful, knowledgeable, and friendly assistant created by Sanket Pal. Be concise but thorough. Use markdown for structure. Today: '+new Date().toLocaleDateString(),
  professional: 'You are Voxify, a professional AI assistant. Be formal, precise, and structured. Use markdown. Today: '+new Date().toLocaleDateString(),
  creative: 'You are Voxify, a creative and imaginative AI. Be expressive, use examples, analogies. Today: '+new Date().toLocaleDateString(),
  tutor: 'You are Voxify, a patient and encouraging tutor. Explain step by step. Use examples. Today: '+new Date().toLocaleDateString(),
};

// ══════════════════════════════════════════════════════════
// MEMORY
// ══════════════════════════════════════════════════════════
function renderMemory(c) {
  c.innerHTML = `
  <div class="section-title"><i class="fa fa-brain" style="color:var(--cyan)"></i> Memory</div>
  <div class="section-sub">Voxify remembers these facts about you across all conversations.</div>
  <div class="mem-add-row">
    <input type="text" id="memInput" placeholder="Add a memory (e.g. I prefer Python over JavaScript)..." onkeydown="if(event.key==='Enter')addMemory()"/>
    <button class="btn btn-primary" onclick="addMemory()"><i class="fa fa-plus"></i> Add</button>
    <button class="btn btn-ghost" onclick="aiExtractMemory()"><i class="fa fa-wand-magic-sparkles"></i> AI Extract from Chat</button>
  </div>
  <div id="memList" class="memory-list"></div>
  <div style="margin-top:1rem;display:flex;gap:.5rem">
    <button class="btn btn-danger" onclick="clearAllMemory()"><i class="fa fa-trash"></i> Clear All Memory</button>
    <button class="btn btn-ghost" onclick="exportMemory()"><i class="fa fa-download"></i> Export</button>
  </div>`;
  renderMemList();
}

function renderMemList() {
  const el = document.getElementById('memList'); if(!el) return;
  el.innerHTML = memories.length
    ? memories.map((m,i)=>`
      <div class="mem-item">
        <div class="mem-item-text">${m.text}</div>
        <div style="display:flex;align-items:center;gap:.5rem">
          <div class="mem-item-meta">${new Date(m.ts).toLocaleDateString()}</div>
          <button class="mem-del" onclick="delMemory(${i})"><i class="fa fa-xmark"></i></button>
        </div>
      </div>`).join('')
    : '<div style="color:var(--dim);font-size:.83rem;padding:.5rem">No memories saved yet. Add some to personalize Voxify!</div>';
}

function addMemory() {
  const v = document.getElementById('memInput').value.trim(); if(!v) return;
  memories.push({text:v,ts:Date.now()}); save('vx_mem',memories);
  document.getElementById('memInput').value=''; renderMemList(); toast('Memory saved ✓');
}

function delMemory(i) { memories.splice(i,1); save('vx_mem',memories); renderMemList(); }
function clearAllMemory() { if(!confirm('Delete all memories?')) return; memories=[]; save('vx_mem',[]); renderMemList(); toast('Memory cleared'); }

async function aiExtractMemory() {
  if (!chatHistory.length) { toast('No chat history to extract from','err'); return; }
  const recent = chatHistory.slice(-20).map(m=>`${m.r}: ${m.t}`).join('\n');
  const reply = await gemini('Extract 3-5 important personal facts or preferences from this conversation that would be useful to remember. Return as a numbered list, one fact per line, concise:\n\n'+recent);
  const lines = reply.split('\n').filter(l=>l.trim()&&/^\d/.test(l.trim()));
  lines.forEach(l => { const txt=l.replace(/^\d+\.\s*/,'').trim(); if(txt) memories.push({text:txt,ts:Date.now()}); });
  save('vx_mem',memories); renderMemList(); toast(`Extracted ${lines.length} memories!`);
}

function exportMemory() {
  const txt = memories.map(m=>m.text).join('\n');
  const b=new Blob([txt],{type:'text/plain'}); const a=document.createElement('a');
  a.href=URL.createObjectURL(b); a.download='voxify_memory.txt'; a.click();
}

// ══════════════════════════════════════════════════════════
// VOICE
// ══════════════════════════════════════════════════════════
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function renderVoice(c) {
  c.innerHTML = `
  <div class="voice-center">
    <div class="voice-opts">
      <div class="voice-opt"><i class="fa fa-volume-high" style="color:var(--cyan)"></i><label>Voice Output <label class="tog"><input type="checkbox" id="voOut" ${CFG.voiceOut?'checked':''} onchange="CFG.voiceOut=this.checked;save('vx_voiceOut',this.checked)"/><span class="togg"></span></label></label></div>
      <div class="voice-opt"><i class="fa fa-language" style="color:var(--cyan)"></i><label>Language <select id="voLang" onchange="CFG.lang=this.value;save('vx_lang',this.value)"><option value="en-US" ${CFG.lang==='en-US'?'selected':''}>English US</option><option value="en-IN" ${CFG.lang==='en-IN'?'selected':''}>English IN</option><option value="hi-IN" ${CFG.lang==='hi-IN'?'selected':''}>Hindi</option><option value="mr-IN" ${CFG.lang==='mr-IN'?'selected':''}>Marathi</option></select></label></div>
      <div class="voice-opt"><i class="fa fa-podcast" style="color:var(--cyan)"></i><label>Wake Word <label class="tog"><input type="checkbox" id="ww" ${CFG.wakeword?'checked':''} onchange="toggleWakeWord(this.checked)"/><span class="togg"></span></label></label></div>
    </div>
    <button id="vOrb" class="v-orb" onclick="toggleVoice()"><i class="fa fa-microphone" id="vOrbIco"></i></button>
    <div id="vStatus" class="v-status">Click orb to speak</div>
    <div id="vTranscript" class="v-transcript">Your speech will appear here...</div>
    <div id="vResponse" class="v-response">Voxify's response will appear here...</div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center">
      <button class="btn btn-ghost" onclick="speak(document.getElementById('vResponse').textContent)"><i class="fa fa-volume-high"></i> Replay</button>
      <button class="btn btn-ghost" onclick="navigator.clipboard.writeText(document.getElementById('vResponse').textContent);toast('Copied!')"><i class="fa fa-copy"></i> Copy</button>
    </div>
  </div>`;
}

function toggleVoice() {
  if (!SR) { toast('Voice not supported in this browser','err'); return; }
  if (voiceActive) { stopVoice(); return; }
  startVoice();
}

function startVoice() {
  const rec = new SR(); rec.lang=CFG.lang; rec.interimResults=false;
  voiceActive=true;
  document.getElementById('vOrb').className='v-orb lis';
  document.getElementById('vStatus').textContent='🎤 Listening...';
  analytics.voice++; save('vx_stats',analytics);
  rec.onresult = async e => {
    const txt = e.results[0][0].transcript;
    document.getElementById('vTranscript').textContent='"'+txt+'"';
    document.getElementById('vStatus').textContent='Thinking...';
    document.getElementById('vOrb').className='v-orb spk';
    const reply = await gemini(txt,'You are Voxify, a voice assistant. Give concise spoken replies (2-3 sentences). No markdown. Today: '+new Date().toLocaleDateString(),true);
    chatHistory.push({r:'user',t:txt,ts:Date.now()},{r:'bot',t:reply,ts:Date.now()});
    save('vx_chat',chatHistory);
    document.getElementById('vResponse').textContent=reply;
    document.getElementById('vStatus').textContent='Speaking...';
    if (CFG.voiceOut) speak(reply,()=>{ document.getElementById('vStatus').textContent='Click orb to speak'; document.getElementById('vOrb').className='v-orb'; });
    else { document.getElementById('vStatus').textContent='Click orb to speak'; document.getElementById('vOrb').className='v-orb'; }
    voiceActive=false;
  };
  rec.onerror=()=>{ document.getElementById('vStatus').textContent="Didn't catch that"; document.getElementById('vOrb').className='v-orb'; voiceActive=false; };
  rec.onend=()=>{ voiceActive=false; };
  rec.start();
  window._voiceRec=rec;
}

function stopVoice() { if(window._voiceRec) window._voiceRec.stop(); voiceActive=false; const o=document.getElementById('vOrb'); if(o) o.className='v-orb'; }

// Chat mic button
let chatMicRec=null;
function toggleChatMic() {
  if(!SR){toast('Voice not supported','err');return;}
  const btn=document.getElementById('chatMic');
  if(chatMicRec){chatMicRec.stop();chatMicRec=null;btn.classList.remove('rec');return;}
  chatMicRec=new SR(); chatMicRec.lang=CFG.lang; chatMicRec.interimResults=false;
  btn.classList.add('rec');
  chatMicRec.onresult=e=>{
    const ta=document.getElementById('chatTa');
    ta.value=e.results[0][0].transcript; autoResize(ta);
    btn.classList.remove('rec'); chatMicRec=null;
    setTimeout(()=>sendChat(),300);
  };
  chatMicRec.onerror=()=>{btn.classList.remove('rec');chatMicRec=null;};
  chatMicRec.onend=()=>{btn.classList.remove('rec');chatMicRec=null;};
  chatMicRec.start();
}

// Wake word
function toggleWakeWord(on) { CFG.wakeword=on; save('vx_wakeword',on); if(on) startWakeWord(); else stopWakeWord(); toast(on?'Wake word enabled — say "Hey Voxify"':'Wake word disabled'); }
function startWakeWord() {
  if(!SR) return;
  const rec=new SR(); rec.lang=CFG.lang; rec.continuous=true; rec.interimResults=true;
  rec.onresult=e=>{ for(let i=e.resultIndex;i<e.results.length;i++){ const t=e.results[i][0].transcript.toLowerCase(); if(t.includes('hey voxify')||t.includes('voxify')) { speak('Yes, how can I help?'); go('voice'); setTimeout(()=>startVoice(),800); rec.stop(); break; } } };
  rec.onend=()=>{ if(CFG.wakeword) setTimeout(startWakeWord,1000); };
  rec.start(); wakeListener=rec;
}
function stopWakeWord() { if(wakeListener){wakeListener.stop();wakeListener=null;} }

// TTS
function speak(text, onEnd) {
  if(!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text.slice(0,500));
  u.rate=1; u.pitch=1; u.lang=CFG.lang;
  const voices=window.speechSynthesis.getVoices();
  const v=voices.find(v=>v.lang.startsWith(CFG.lang.split('-')[0])&&v.name.toLowerCase().includes('female'))
          ||voices.find(v=>v.lang.startsWith(CFG.lang.split('-')[0]))||voices[0];
  if(v) u.voice=v;
  if(onEnd) u.onend=onEnd;
  window.speechSynthesis.speak(u);
}

// ══════════════════════════════════════════════════════════
// STUDY
// ══════════════════════════════════════════════════════════
function renderStudy(c) {
  c.innerHTML = `
  <div class="section-title"><i class="fa fa-graduation-cap" style="color:var(--cyan)"></i> Study Assistant</div>
  <div class="study-tabs">
    ${['explain','doubt','quiz','flashcard','exam','pdf'].map(t=>`<button class="stab ${t==='explain'?'active':''}" onclick="setStab('${t}',this)">${{explain:'Explain',doubt:'Solve Doubt',quiz:'Quiz Me',flashcard:'Flashcards',exam:'Exam Prep',pdf:'PDF Summary'}[t]}</button>`).join('')}
  </div>
  <div id="studyWin" class="chat-win" style="height:350px"></div>
  <div class="input-area" style="padding:.75rem 0 0">
    <div class="quick-btns" id="studyQB"></div>
    <div class="input-box">
      <textarea id="studyTa" rows="1" placeholder="Enter topic or question..." onkeydown="studyKey(event)" oninput="autoResize(this)"></textarea>
      <button class="ib-btn send-b" onclick="sendStudy()"><i class="fa fa-paper-plane"></i></button>
    </div>
  </div>`;
  updateStudyQB();
  addMsg('studyWin','bot','Choose a study mode above and enter your topic! 📚');
  analytics.study++; save('vx_stats',analytics);
}

const studyPrompts = {
  explain: (t)=>`Explain "${t}" clearly for a student. Use simple language, examples, and analogies. Structure with headings.`,
  doubt:   (t)=>`Answer this doubt/question: "${t}". Be thorough, step-by-step, with examples.`,
  quiz:    (t)=>`Create 5 multiple choice questions about "${t}". Format:\nQ: [question]\nA) [opt] B) [opt] C) [opt] D) [opt]\nAnswer: [letter] — [explanation]`,
  flashcard:(t)=>`Create 8 flashcards for "${t}". Format: **Term**: Definition`,
  exam:    (t)=>`Create an exam preparation guide for "${t}": key topics, likely questions, important formulas/concepts, study tips.`,
  pdf:     (t)=>`Summarize this content concisely with key points, main ideas, and important details:\n\n${t||pdfText||'(paste text to summarize)'}`
};

const studyQBs = {
  explain:   ['Python basics','Machine Learning','Cloud Computing','Data Structures','Neural Networks'],
  doubt:     ['How does recursion work?','Explain Big O notation','What is overfitting?','Difference: SQL vs NoSQL'],
  quiz:      ['Python','JavaScript','AWS','Machine Learning','Git'],
  flashcard: ['HTTP methods','Python data types','Git commands','AWS services','ML algorithms'],
  exam:      ['Data Structures & Algorithms','Machine Learning','Web Development','Cloud Computing'],
  pdf:       []
};

function setStab(t, el) { studyTab=t; document.querySelectorAll('.stab').forEach(b=>b.classList.remove('active')); el.classList.add('active'); updateStudyQB(); }
function updateStudyQB() {
  const el=document.getElementById('studyQB'); if(!el) return;
  el.innerHTML=(studyQBs[studyTab]||[]).map(q=>`<button class="qb" onclick="document.getElementById('studyTa').value='${q}';sendStudy()">${q}</button>`).join('');
}
async function sendStudy() {
  const ta=document.getElementById('studyTa'); const q=ta.value.trim(); if(!q) return;
  ta.value=''; autoResize(ta);
  addMsg('studyWin','user',q); addTyping('studyWin');
  const prompt = studyPrompts[studyTab] ? studyPrompts[studyTab](q) : q;
  const reply = await gemini(prompt,'You are an expert study assistant and educator. Be clear, structured, use markdown formatting.');
  rmTyping('studyWin');
  addMsg('studyWin','bot',reply,[
    {label:'📋 Copy',fn:()=>{navigator.clipboard.writeText(reply);toast('Copied!')}},
    {label:'💾 Save',fn:()=>saveToNote(reply)},
    {label:'🔊 Speak',fn:()=>speak(reply.replace(/<[^>]*>/g,'').replace(/[#*`]/g,''))}
  ]);
}
function studyKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendStudy();}}

// ══════════════════════════════════════════════════════════
// CODING
// ══════════════════════════════════════════════════════════
function renderCoding(c) {
  c.innerHTML = `
  <div class="section-title"><i class="fa fa-code" style="color:var(--cyan)"></i> Coding Assistant</div>
  <div id="codeWin" class="chat-win" style="height:350px"></div>
  <div class="input-area" style="padding:.75rem 0 0">
    <div class="quick-btns">
      ${['Generate code','Debug this','Explain code','Optimize','Write tests','Add comments','Create project','GitHub helper'].map(q=>`<button class="qb" onclick="codeQB('${q}')">${q}</button>`).join('')}
    </div>
    <div class="input-box">
      <textarea id="codeTa" rows="1" placeholder="Describe what you need or paste code..." onkeydown="codeKey(event)" oninput="autoResize(this)"></textarea>
      <button class="ib-btn send-b" onclick="sendCode()"><i class="fa fa-paper-plane"></i></button>
    </div>
  </div>`;
  addMsg('codeWin','bot','I can **generate, debug, explain, optimize, and test** code. Paste your code or describe what you need! 💻');
  analytics.code++; save('vx_stats',analytics);
}

const codePrefixes = {
  'Generate code':'Write code for: ','Debug this':'Debug and fix this code:\n\n','Explain code':'Explain this code step by step:\n\n',
  'Optimize':'Optimize this code for performance and readability:\n\n','Write tests':'Write comprehensive unit tests for:\n\n',
  'Add comments':'Add clear inline comments to this code:\n\n','Create project':'Create a complete project structure for: ','GitHub helper':'Help me with Git/GitHub: '
};
function codeQB(q) { const ta=document.getElementById('codeTa'); ta.value=codePrefixes[q]||q+':\n'; ta.focus(); autoResize(ta); }
async function sendCode() {
  const ta=document.getElementById('codeTa'); const msg=ta.value.trim(); if(!msg) return;
  ta.value=''; autoResize(ta);
  addMsg('codeWin','user',msg); addTyping('codeWin');
  const reply=await gemini(msg,'You are an expert software engineer. Help with coding, debugging, explaining, optimizing. Use proper code blocks with language tags. Be precise and include examples. Today: '+new Date().toLocaleDateString());
  rmTyping('codeWin');
  addMsg('codeWin','bot',reply,[
    {label:'📋 Copy',fn:()=>{navigator.clipboard.writeText(reply.replace(/<[^>]*>/g,''));toast('Copied!')}},
    {label:'💾 Save',fn:()=>saveToNote(reply)}
  ]);
}
function codeKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCode();}}

// ══════════════════════════════════════════════════════════
// FILE ASSISTANT
// ══════════════════════════════════════════════════════════
function renderFiles(c) {
  c.innerHTML = `
  <div class="section-title"><i class="fa fa-folder-open" style="color:var(--cyan)"></i> File Assistant</div>
  <div class="section-sub">Read PDFs, DOCX, TXT files — then ask AI questions about them.</div>
  <div class="drop-zone" id="dropZone" onclick="document.getElementById('fileIn').click()" ondragover="event.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')" ondrop="handleDrop(event)">
    <input type="file" id="fileIn" accept=".pdf,.txt,.docx,.doc,.md,.csv" hidden onchange="handleFile(event)"/>
    <i class="fa fa-file-arrow-up"></i>
    <span>Drop file here or click to upload</span>
    <small>PDF · TXT · DOCX · MD · CSV · Images (OCR)</small>
  </div>
  <div id="fileInfo" class="file-result hidden"></div>
  <div id="fileWin" class="chat-win hidden" style="height:280px"></div>
  <div class="input-area hidden" id="fileInputArea" style="padding:.75rem 0 0">
    <div class="quick-btns">
      ${['Summarize','Key points','Main topics','Q&A format','Explain simply'].map(q=>`<button class="qb" onclick="fileQB('${q}')">${q}</button>`).join('')}
    </div>
    <div class="input-box">
      <textarea id="fileTa" rows="1" placeholder="Ask about the document..." onkeydown="fileKey(event)" oninput="autoResize(this)"></textarea>
      <button class="ib-btn send-b" onclick="sendFile()"><i class="fa fa-paper-plane"></i></button>
    </div>
  </div>`;
  analytics.files++; save('vx_stats',analytics);
}

function handleDrop(e) {
  e.preventDefault(); document.getElementById('dropZone').classList.remove('drag');
  const file=e.dataTransfer.files[0]; if(file) processFile(file);
}
function handleFile(e) { const file=e.target.files[0]; if(file) processFile(file); }

async function processFile(file) {
  setStatus('Reading file...');
  const ext=file.name.split('.').pop().toLowerCase();
  try {
    if (ext==='pdf') await readPDF(file);
    else if (['txt','md','csv'].includes(ext)) await readText(file);
    else if (['docx','doc'].includes(ext)) await readDocx(file);
    else { toast('Unsupported file type','err'); return; }
    showFileUI(file.name, fileText.length);
  } catch(e) { toast('Error reading file: '+e.message,'err'); }
}

async function readPDF(file) {
  const buf=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument(buf).promise;
  let t=''; const pages=Math.min(pdf.numPages,20);
  for(let i=1;i<=pages;i++){ const p=await pdf.getPage(i); const tc=await p.getTextContent(); t+=tc.items.map(s=>s.str).join(' ')+'\n'; }
  fileText=t.slice(0,15000); pdfText=fileText;
}

async function readText(file) { fileText = await file.text(); fileText=fileText.slice(0,15000); }

async function readDocx(file) {
  // Basic DOCX reading — extract raw text from XML
  try {
    const JSZip = window.JSZip;
    if (!JSZip) { fileText = 'DOCX reading requires JSZip library. Please convert to TXT or PDF.'; return; }
    const buf=await file.arrayBuffer();
    const zip=await JSZip.loadAsync(buf);
    const xml=await zip.file('word/document.xml').async('text');
    fileText=xml.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,15000);
  } catch { fileText='Could not parse DOCX. Try converting to TXT or PDF.'; }
}

function showFileUI(name, len) {
  setStatus('Ready');
  document.getElementById('fileInfo').className='file-result';
  document.getElementById('fileInfo').innerHTML=`<div class="file-info"><i class="fa fa-file-circle-check" style="color:var(--lime)"></i> <strong>${name}</strong> — ${Math.round(len/1000)}K chars read</div><div style="font-size:.78rem;color:var(--muted)">File loaded! Ask questions or use quick actions below.</div>`;
  document.getElementById('fileWin').className='chat-win';
  document.getElementById('fileInputArea').className='input-area';
  addMsg('fileWin','bot',`📄 **${name}** loaded! Ask me anything about this file.`);
}

function fileQB(q) {
  const prompts={'Summarize':'Give a comprehensive summary of this document.','Key points':'List the key points and main takeaways.','Main topics':'What are the main topics covered?','Q&A format':'Generate 5 Q&A pairs from this content.','Explain simply':'Explain this document in simple terms.'};
  sendFileQuery(prompts[q]||q);
}
async function sendFile() { const ta=document.getElementById('fileTa'); const q=ta.value.trim(); if(!q) return; ta.value=''; autoResize(ta); sendFileQuery(q); }
async function sendFileQuery(q) {
  if(!fileText){toast('Upload a file first','err');return;}
  addMsg('fileWin','user',q); addTyping('fileWin');
  const sys=`Answer based ONLY on the provided document. Be accurate and cite relevant sections.\n\nDOCUMENT:\n${fileText}`;
  const reply=await gemini(q,sys,false);
  rmTyping('fileWin');
  addMsg('fileWin','bot',reply,[{label:'💾 Save',fn:()=>saveToNote(reply)}]);
}
function fileKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendFile();}}

// ══════════════════════════════════════════════════════════
// INTERNET / RESEARCH
// ══════════════════════════════════════════════════════════
function renderInternet(c) {
  c.innerHTML = `
  <div class="section-title"><i class="fa fa-globe" style="color:var(--cyan)"></i> Internet & Research</div>
  <div class="study-tabs">
    ${['search','news','weather','wiki','currency'].map(t=>`<button class="stab ${t==='search'?'active':''}" onclick="setITab('${t}',this)">${{search:'Web Search',news:'News',weather:'Weather',wiki:'Wikipedia',currency:'Currency'}[t]}</button>`).join('')}
  </div>
  <div id="iWin" class="chat-win" style="height:300px"></div>
  <div class="input-area" style="padding:.75rem 0 0">
    <div class="input-box">
      <textarea id="iTa" rows="1" placeholder="Search query or topic..." onkeydown="iKey(event)" oninput="autoResize(this)"></textarea>
      <button class="ib-btn send-b" onclick="sendInternet()"><i class="fa fa-magnifying-glass"></i></button>
    </div>
    <div class="input-hint" id="iHint">Ask any question — Voxify researches using AI knowledge</div>
  </div>`;
  addMsg('iWin','bot','Search the web, get news, weather, Wikipedia summaries, and currency conversion. What would you like to know? 🌐');
}

let iTab='search';
function setITab(t,el){iTab=t;document.querySelectorAll('.stab').forEach(b=>b.classList.remove('active'));el.classList.add('active');
  const hints={search:'Ask any research question',news:'Ask about current news topics',weather:'Enter a city name',wiki:'Enter a topic for Wikipedia summary',currency:'E.g. 100 USD to INR'};
  const el2=document.getElementById('iHint'); if(el2) el2.textContent=hints[t]||'';
}

async function sendInternet() {
  const ta=document.getElementById('iTa'); const q=ta.value.trim(); if(!q) return;
  ta.value=''; autoResize(ta);
  addMsg('iWin','user',q); addTyping('iWin');
  let prompt, sys;
  if (iTab==='weather') {
    try {
      const r=await fetch(`https://wttr.in/${encodeURIComponent(q)}?format=j1`);
      const d=await r.json();
      const w=d.current_condition[0];
      const reply=`🌤️ **Weather in ${q}**\n\n**Temperature:** ${w.temp_C}°C (feels like ${w.FeelsLikeC}°C)\n**Condition:** ${w.weatherDesc[0].value}\n**Humidity:** ${w.humidity}%\n**Wind:** ${w.windspeedKmph} km/h ${w.winddir16Point}`;
      rmTyping('iWin'); addMsg('iWin','bot',reply); return;
    } catch { prompt=`What is the weather like in ${q}? Give a general description based on the season.`; sys='You are a weather information assistant.'; }
  } else if (iTab==='currency') {
    try {
      const match=q.match(/(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*(?:to|in)\s*([A-Za-z]+)/i);
      if (match) {
        const [,amt,from,to]=match;
        const r=await fetch(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
        const d=await r.json();
        const rate=d.rates[to.toUpperCase()];
        if(rate){const result=(parseFloat(amt)*rate).toFixed(2); rmTyping('iWin'); addMsg('iWin','bot',`💱 **${amt} ${from.toUpperCase()} = ${result} ${to.toUpperCase()}**\n\nExchange rate: 1 ${from.toUpperCase()} = ${rate} ${to.toUpperCase()}`); return;}
      }
    } catch {}
    prompt=q; sys='You are a currency and finance assistant. Help with currency conversions and financial information.';
  } else if (iTab==='wiki') {
    try {
      const r=await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
      const d=await r.json();
      if(d.extract){rmTyping('iWin');addMsg('iWin','bot',`📖 **${d.title}**\n\n${d.extract}\n\n[Read more on Wikipedia](${d.content_urls?.desktop?.page})`);return;}
    } catch {}
    prompt=`Give a Wikipedia-style summary of: ${q}`; sys='You are an encyclopedia assistant.';
  } else if (iTab==='news') {
    prompt=`Give me the latest news and current developments about: "${q}". Include what's known as of your training data and note your knowledge cutoff. Today is ${new Date().toLocaleDateString()}.`;
    sys='You are a news assistant. Provide comprehensive, factual information. Be clear about knowledge limitations.';
  } else {
    prompt=q; sys=`You are a research assistant. Answer thoroughly with facts, multiple perspectives, and sources. Today: ${new Date().toLocaleDateString()}. Knowledge cutoff: early 2024.`;
  }
  const reply=await gemini(prompt,sys,false);
  rmTyping('iWin'); addMsg('iWin','bot',reply,[{label:'💾 Save',fn:()=>saveToNote(reply)}]);
}
function iKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendInternet();}}

// ══════════════════════════════════════════════════════════
// TASKS & GOALS
// ══════════════════════════════════════════════════════════
function renderTasks(c) {
  c.innerHTML = `
  <div class="section-title"><i class="fa fa-list-check" style="color:var(--cyan)"></i> Tasks & Goals</div>
  <div class="study-tabs">
    <button class="stab active" onclick="setTaskTab('tasks',this)">To-Do List</button>
    <button class="stab" onclick="setTaskTab('goals',this)">Goal Tracker</button>
    <button class="stab" onclick="setTaskTab('planner',this)">AI Daily Planner</button>
  </div>
  <div id="taskTabContent"></div>`;
  showTasksTab();
}

let taskTab='tasks';
function setTaskTab(t,el){taskTab=t;document.querySelectorAll('.stab').forEach(b=>b.classList.remove('active'));el.classList.add('active');if(t==='tasks')showTasksTab();else if(t==='goals')showGoalsTab();else showPlannerTab();}

function showTasksTab() {
  document.getElementById('taskTabContent').innerHTML=`
  <div style="margin-top:1rem">
    <div class="task-input-row">
      <input type="text" id="taskIn" placeholder="Add a task..." onkeydown="if(event.key==='Enter')addTask()"/>
      <input type="datetime-local" id="taskTime"/>
      <select id="taskPri" style="background:var(--card);border:1px solid var(--bdr);color:var(--text);padding:.5rem;border-radius:8px;outline:none;font-size:.78rem">
        <option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option>
      </select>
      <button class="add-btn" onclick="addTask()"><i class="fa fa-plus"></i> Add</button>
    </div>
    <div style="display:flex;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap">
      <button class="btn btn-ghost" onclick="filterTasks('all')">All (${tasks.length})</button>
      <button class="btn btn-ghost" onclick="filterTasks('pending')">Pending (${tasks.filter(t=>!t.done).length})</button>
      <button class="btn btn-ghost" onclick="filterTasks('done')">Done (${tasks.filter(t=>t.done).length})</button>
      <button class="btn btn-ghost" onclick="aiPrioritize()"><i class="fa fa-wand-magic-sparkles"></i> AI Prioritize</button>
    </div>
    <div id="taskList" class="task-list"></div>
  </div>`;
  renderTaskList(tasks);
  analytics.tasks++; save('vx_stats',analytics);
}

function renderTaskList(list) {
  const el=document.getElementById('taskList'); if(!el) return;
  el.innerHTML=list.length?list.map((t,i)=>`
    <div class="task-it ${t.done?'done':''}">
      <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask(${i})"/>
      <span style="flex:1">${t.text}</span>
      ${t.pri==='high'?'<span style="font-size:.65rem;color:#ff4d4d;background:rgba(255,77,77,.1);padding:.15rem .45rem;border-radius:4px">HIGH</span>':''}
      ${t.time?`<span class="task-it-time">⏰ ${new Date(t.time).toLocaleString('en-IN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>`:''}
      <button class="task-del" onclick="delTask(${i})"><i class="fa fa-xmark"></i></button>
    </div>`).join(''):'<div style="color:var(--dim);font-size:.83rem;padding:.5rem">No tasks. Add one above!</div>';
}

function addTask(){const v=document.getElementById('taskIn').value.trim();if(!v)return;tasks.push({text:v,time:document.getElementById('taskTime').value,pri:document.getElementById('taskPri').value,done:false,id:Date.now()});document.getElementById('taskIn').value='';document.getElementById('taskTime').value='';save('vx_tasks',tasks);renderTaskList(tasks);}
function toggleTask(i){tasks[i].done=!tasks[i].done;save('vx_tasks',tasks);renderTaskList(tasks);}
function delTask(i){tasks.splice(i,1);save('vx_tasks',tasks);renderTaskList(tasks);}
function filterTasks(f){renderTaskList(f==='pending'?tasks.filter(t=>!t.done):f==='done'?tasks.filter(t=>t.done):tasks);}

async function aiPrioritize(){
  if(!tasks.length){toast('No tasks to prioritize','err');return;}
  const list=tasks.map((t,i)=>`${i+1}. ${t.text}`).join('\n');
  const reply=await gemini(`Prioritize these tasks and suggest order with brief reason:\n${list}`,'You are a productivity assistant. Be concise.');
  addMsg('taskList','sys',reply);toast('Tasks prioritized by AI ✓');
}

function showGoalsTab(){
  document.getElementById('taskTabContent').innerHTML=`
  <div style="margin-top:1rem">
    <div class="task-input-row">
      <input type="text" id="goalIn" placeholder="Goal title (e.g. Learn Machine Learning in 30 days)..."/>
      <input type="number" id="goalTarget" placeholder="Days" style="width:80px;background:var(--card);border:1px solid var(--bdr);color:var(--text);padding:.5rem;border-radius:8px;outline:none;font-size:.82rem"/>
      <button class="add-btn" onclick="addGoal()"><i class="fa fa-plus"></i> Add Goal</button>
    </div>
    <div id="goalList"></div>
  </div>`;
  renderGoals();
}

function renderGoals(){
  const el=document.getElementById('goalList');if(!el)return;
  el.innerHTML=goals.length?goals.map((g,i)=>`
    <div class="goal-item">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h4>${g.title}</h4>
        <button class="task-del" onclick="delGoal(${i})"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${g.prog}%"></div></div>
      <div class="goal-meta"><span>${g.prog}% complete</span><span>${g.days} days</span></div>
      <div style="display:flex;gap:.4rem;margin-top:.5rem">
        <button class="btn btn-ghost" onclick="updateGoalProg(${i})">Update Progress</button>
        <button class="btn btn-ghost" onclick="aiGoalPlan(${i})"><i class="fa fa-wand-magic-sparkles"></i> AI Plan</button>
      </div>
    </div>`).join(''):'<div style="color:var(--dim);font-size:.83rem;padding:.5rem">No goals yet. Add your first goal!</div>';
}

function addGoal(){const v=document.getElementById('goalIn').value.trim();if(!v)return;goals.push({title:v,days:document.getElementById('goalTarget').value||30,prog:0,id:Date.now()});save('vx_goals',goals);renderGoals();}
function delGoal(i){goals.splice(i,1);save('vx_goals',goals);renderGoals();}
function updateGoalProg(i){const p=parseInt(prompt(`Progress for "${goals[i].title}" (0-100):`,goals[i].prog));if(!isNaN(p)){goals[i].prog=Math.min(100,Math.max(0,p));save('vx_goals',goals);renderGoals();}}
async function aiGoalPlan(i){
  const reply=await gemini(`Create a detailed ${goals[i].days}-day plan to achieve: "${goals[i].title}". Include weekly milestones and daily tasks.`,'You are a goal-setting coach.');
  alert(reply.replace(/<[^>]*>/g,'').slice(0,500)+'...\n\n(Full plan saved to Notes)');
  saveToNote('Goal Plan: '+goals[i].title+'\n\n'+reply);
}

function showPlannerTab(){
  document.getElementById('taskTabContent').innerHTML=`
  <div style="margin-top:1rem">
    <div class="input-box" style="margin-bottom:.75rem">
      <textarea id="planTa" rows="2" placeholder="Describe your day or goal (e.g. I need to study for exams, exercise, and finish 3 work tasks)..." oninput="autoResize(this)"></textarea>
      <button class="ib-btn send-b" onclick="sendPlanner()"><i class="fa fa-paper-plane"></i></button>
    </div>
    <div id="planWin" class="chat-win" style="height:300px"></div>
  </div>`;
  addMsg('planWin','bot','Tell me what you need to accomplish today and I\'ll create a smart daily plan for you! 📅');
}

async function sendPlanner(){
  const ta=document.getElementById('planTa');const q=ta.value.trim();if(!q)return;
  ta.value='';autoResize(ta);addMsg('planWin','user',q);addTyping('planWin');
  const sys=`You are a productivity coach. Create a realistic, time-blocked daily plan. Format with time slots, tasks, and breaks. Today: ${new Date().toLocaleDateString()}.`;
  const reply=await gemini(q,sys,false);
  rmTyping('planWin');addMsg('planWin','bot',reply,[{label:'💾 Save Plan',fn:()=>saveToNote(reply)}]);
}

// ══════════════════════════════════════════════════════════
// NOTES
// ══════════════════════════════════════════════════════════
function renderNotes(c) {
  c.innerHTML=`
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
    <div class="section-title" style="margin:0"><i class="fa fa-note-sticky" style="color:var(--cyan)"></i> Notes</div>
    <div style="display:flex;gap:.4rem">
      <button class="btn btn-primary" onclick="newNote()"><i class="fa fa-plus"></i> New</button>
      <button class="btn btn-ghost" onclick="exportNotes()"><i class="fa fa-download"></i> Export</button>
    </div>
  </div>
  <div class="notes-layout">
    <div class="notes-list" id="notesList"></div>
    <div class="note-editor">
      <div class="note-tools">
        <button class="nt-btn" onclick="saveNote()"><i class="fa fa-floppy-disk"></i> Save</button>
        <button class="nt-btn" onclick="aiEnhance()"><i class="fa fa-wand-magic-sparkles"></i> AI Enhance</button>
        <button class="nt-btn" onclick="aiSummarize()"><i class="fa fa-compress"></i> Summarize</button>
        <button class="nt-btn" onclick="deleteNote()"><i class="fa fa-trash"></i> Delete</button>
      </div>
      <input type="text" id="noteTitle" class="note-title-in" placeholder="Note title..."/>
      <textarea id="noteBody" class="note-body-ta" placeholder="Start writing..."></textarea>
    </div>
  </div>`;
  renderNotesList();
}

function renderNotesList(){
  const el=document.getElementById('notesList');if(!el)return;
  el.innerHTML=notes.length?notes.map((n,i)=>`<div class="note-item ${activeNote===i?'act':''}" onclick="selectNote(${i})"><div class="note-item-t">${n.title||'Untitled'}</div><div class="note-item-d">${new Date(n.date).toLocaleDateString()}</div></div>`).join(''):'<div style="padding:.5rem;font-size:.75rem;color:var(--dim)">No notes yet</div>';
}

function selectNote(i){activeNote=i;document.getElementById('noteTitle').value=notes[i].title||'';document.getElementById('noteBody').value=notes[i].body||'';renderNotesList();}
function newNote(){notes.unshift({title:'',body:'',date:Date.now()});activeNote=0;save('vx_notes',notes);selectNote(0);}
function saveNote(){if(activeNote===null){newNote();return;}notes[activeNote]={title:document.getElementById('noteTitle').value||'Untitled',body:document.getElementById('noteBody').value,date:Date.now()};save('vx_notes',notes);renderNotesList();toast('Saved ✓');}
function deleteNote(){if(activeNote===null)return;notes.splice(activeNote,1);activeNote=notes.length?0:null;save('vx_notes',notes);if(activeNote!==null)selectNote(0);else{document.getElementById('noteTitle').value='';document.getElementById('noteBody').value='';}renderNotesList();}
async function aiEnhance(){const b=document.getElementById('noteBody').value.trim();if(!b){toast('Write something first','err');return;}const r=await gemini(b,'Improve the clarity, grammar, and structure of these notes. Keep the same meaning. Return only the improved text, no explanations.');document.getElementById('noteBody').value=r.replace(/<[^>]*>/g,'');toast('AI enhanced ✓');}
async function aiSummarize(){const b=document.getElementById('noteBody').value.trim();if(!b){toast('Write something first','err');return;}const r=await gemini(b,'Summarize this concisely in bullet points. Return only the summary.');notes.unshift({title:'Summary: '+(document.getElementById('noteTitle').value||'Note'),body:r.replace(/<[^>]*>/g,''),date:Date.now()});save('vx_notes',notes);renderNotesList();toast('Summary saved as new note ✓');}
function exportNotes(){const txt=notes.map(n=>`# ${n.title}\n${new Date(n.date).toLocaleDateString()}\n\n${n.body}`).join('\n\n---\n\n');const b=new Blob([txt],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='voxify_notes.txt';a.click();}

// ══════════════════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════════════════
function renderCalendar(c) {
  c.innerHTML=`
  <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
    <div style="flex:1;min-width:280px">
      <div class="cal-wrap">
        <div class="cal-header">
          <button class="cal-nav" onclick="calNav(-1)"><i class="fa fa-chevron-left"></i></button>
          <h3 id="calTitle"></h3>
          <button class="cal-nav" onclick="calNav(1)"><i class="fa fa-chevron-right"></i></button>
        </div>
        <div class="cal-grid" id="calGrid"></div>
      </div>
    </div>
    <div style="flex:1;min-width:260px">
      <div style="margin-bottom:.75rem">
        <div class="section-title" style="font-size:.95rem;margin-bottom:.5rem">Add Event</div>
        <input id="evTitle" class="util-input" placeholder="Event title..."/>
        <input type="datetime-local" id="evTime" class="util-input"/>
        <button class="util-btn" onclick="addCalEvent()"><i class="fa fa-plus"></i> Add Event</button>
      </div>
      <div class="section-title" style="font-size:.88rem;margin-bottom:.5rem">Upcoming Events</div>
      <div id="calEvents"></div>
    </div>
  </div>`;
  drawCal(); renderCalEvents();
}

function drawCal() {
  const y=calDate.getFullYear(),m=calDate.getMonth();
  document.getElementById('calTitle').textContent=calDate.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  const grid=document.getElementById('calGrid');
  grid.innerHTML='<div class="cal-day-name">Sun</div><div class="cal-day-name">Mon</div><div class="cal-day-name">Tue</div><div class="cal-day-name">Wed</div><div class="cal-day-name">Thu</div><div class="cal-day-name">Fri</div><div class="cal-day-name">Sat</div>';
  const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),today=new Date();
  for(let i=0;i<first;i++){const d=document.createElement('div');d.className='cal-day other-month';grid.appendChild(d);}
  for(let d=1;d<=days;d++){
    const div=document.createElement('div');div.className='cal-day';
    const dt=new Date(y,m,d);
    if(dt.toDateString()===today.toDateString())div.classList.add('today');
    if(calEvents.filter(e=>new Date(e.time).toDateString()===dt.toDateString()).length)div.classList.add('has-event');
    div.textContent=d;div.onclick=()=>showDayEvents(dt);grid.appendChild(div);
  }
}

function calNav(d){calDate.setMonth(calDate.getMonth()+d);drawCal();}

function addCalEvent(){
  const t=document.getElementById('evTitle').value.trim(),ti=document.getElementById('evTime').value;
  if(!t||!ti){toast('Enter title and time','err');return;}
  calEvents.push({title:t,time:ti,id:Date.now()});save('vx_cal',calEvents);
  document.getElementById('evTitle').value='';document.getElementById('evTime').value='';
  drawCal();renderCalEvents();toast('Event added ✓');
}

function renderCalEvents(){
  const el=document.getElementById('calEvents');if(!el)return;
  const upcoming=calEvents.filter(e=>new Date(e.time)>=new Date()).sort((a,b)=>new Date(a.time)-new Date(b.time)).slice(0,8);
  el.innerHTML=upcoming.length?upcoming.map((e,i)=>`<div class="task-it"><i class="fa fa-calendar-day" style="color:var(--cyan)"></i><span>${e.title}</span><span class="task-it-time">${new Date(e.time).toLocaleDateString('en-IN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span><button class="task-del" onclick="delCalEvent(${i})"><i class="fa fa-xmark"></i></button></div>`).join(''):'<div style="color:var(--dim);font-size:.8rem">No upcoming events</div>';
}

function showDayEvents(date){const evs=calEvents.filter(e=>new Date(e.time).toDateString()===date.toDateString());if(evs.length)alert(`Events on ${date.toDateString()}:\n${evs.map(e=>e.title+' at '+new Date(e.time).toLocaleTimeString()).join('\n')}`);else toast('No events on '+date.toDateString());}
function delCalEvent(i){const upcoming=calEvents.filter(e=>new Date(e.time)>=new Date()).sort((a,b)=>new Date(a.time)-new Date(b.time));calEvents=calEvents.filter(e=>e.id!==upcoming[i].id);save('vx_cal',calEvents);drawCal();renderCalEvents();}

function checkReminders(){
  const now=Date.now();
  [...tasks.filter(t=>!t.done&&t.time&&Math.abs(new Date(t.time).getTime()-now)<70000),
   ...calEvents.filter(e=>Math.abs(new Date(e.time).getTime()-now)<70000)]
  .forEach(item=>toast(`⏰ Reminder: ${item.text||item.title}`,''));
}

// ══════════════════════════════════════════════════════════
// COMMUNICATION
// ══════════════════════════════════════════════════════════
function renderComms(c) {
  c.innerHTML=`
  <div class="section-title"><i class="fa fa-envelope" style="color:var(--cyan)"></i> Communication</div>
  <div class="study-tabs">
    ${['draft','summarize','message','translate'].map(t=>`<button class="stab ${t==='draft'?'active':''}" onclick="setComTab('${t}',this)">${{draft:'Draft Email',summarize:'Summarize Email',message:'Generate Message',translate:'Translate'}[t]}</button>`).join('')}
  </div>
  <div id="comWin" class="chat-win" style="height:250px"></div>
  <div class="input-area" style="padding:.75rem 0 0">
    <div class="quick-btns" id="comQB"></div>
    <div class="input-box">
      <textarea id="comTa" rows="2" placeholder="Describe what you need..." oninput="autoResize(this)" onkeydown="comKey(event)"></textarea>
      <button class="ib-btn send-b" onclick="sendCom()"><i class="fa fa-paper-plane"></i></button>
    </div>
  </div>`;
  let comTab='draft';
  updateComQB(comTab);
  addMsg('comWin','bot','I can draft emails, summarize messages, generate professional text, and translate content. 📧');
  window._comTab=comTab;
}

function setComTab(t,el){window._comTab=t;document.querySelectorAll('.stab').forEach(b=>b.classList.remove('active'));el.classList.add('active');updateComQB(t);}
function updateComQB(t){
  const qbs={draft:['Job application email','Follow-up email','Thank you email','Meeting request','Complaint letter'],summarize:['Summarize this email','Extract action items','Find key info'],message:['Professional message','Apology message','Congratulations message','Request message'],translate:['Translate to Hindi','Translate to English','Translate to Marathi','Translate to French']};
  const el=document.getElementById('comQB');if(!el)return;
  el.innerHTML=(qbs[t]||[]).map(q=>`<button class="qb" onclick="document.getElementById('comTa').value='${q}: ';document.getElementById('comTa').focus()">${q}</button>`).join('');
}
async function sendCom(){
  const ta=document.getElementById('comTa');const q=ta.value.trim();if(!q)return;
  ta.value='';autoResize(ta);addMsg('comWin','user',q);addTyping('comWin');
  const syss={
    draft:'You are an expert email writer. Write professional, clear emails based on the given description. Include subject line.',
    summarize:'You are a communication assistant. Summarize emails and messages concisely. Extract action items.',
    message:'You are a communication expert. Generate professional, appropriate messages for the given context.',
    translate:'You are a multilingual translator. Translate accurately while preserving tone and meaning.'
  };
  const reply=await gemini(q,syss[window._comTab||'draft']||syss.draft,false);
  rmTyping('comWin');addMsg('comWin','bot',reply,[{label:'📋 Copy',fn:()=>{navigator.clipboard.writeText(reply.replace(/<[^>]*>/g,''));toast('Copied!')}}]);
}
function comKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCom();}}

// ══════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════
function renderUtils(c) {
  c.innerHTML=`
  <div class="section-title"><i class="fa fa-calculator" style="color:var(--cyan)"></i> Utilities</div>
  <div class="util-grid">
    <div class="util-card">
      <h3><i class="fa fa-calculator" style="color:var(--cyan)"></i> Calculator</h3>
      <input id="calcIn" class="util-input" placeholder="Enter expression (e.g. 2^10, sin(30), sqrt(144))..." onkeydown="if(event.key==='Enter')calculate()"/>
      <button class="util-btn" onclick="calculate()">Calculate</button>
      <div id="calcRes" class="util-result"></div>
    </div>
    <div class="util-card">
      <h3><i class="fa fa-ruler" style="color:var(--cyan)"></i> Unit Converter</h3>
      <input id="unitIn" class="util-input" placeholder="e.g. 100 km to miles, 50 kg to lbs, 30°C to F"/>
      <button class="util-btn" onclick="convertUnit()">Convert</button>
      <div id="unitRes" class="util-result"></div>
    </div>
    <div class="util-card">
      <h3><i class="fa fa-dollar-sign" style="color:var(--cyan)"></i> Currency</h3>
      <input id="curIn" class="util-input" placeholder="e.g. 100 USD to INR"/>
      <button class="util-btn" onclick="convertCurrency()">Convert</button>
      <div id="curRes" class="util-result"></div>
    </div>
    <div class="util-card">
      <h3><i class="fa fa-qrcode" style="color:var(--cyan)"></i> QR Code Generator</h3>
      <input id="qrIn" class="util-input" placeholder="Enter URL, text, or anything..."/>
      <button class="util-btn" onclick="genQR()">Generate QR</button>
      <div id="qrContainer"></div>
    </div>
    <div class="util-card">
      <h3><i class="fa fa-key" style="color:var(--cyan)"></i> Password Generator</h3>
      <div style="display:flex;gap:.4rem;margin-bottom:.5rem;flex-wrap:wrap">
        <label style="font-size:.78rem;color:var(--muted);display:flex;align-items:center;gap:.3rem"><input type="number" id="pwLen" value="16" min="8" max="64" style="width:50px;background:var(--bg4);border:1px solid var(--bdr);color:var(--text);padding:.3rem;border-radius:5px;outline:none"/> Length</label>
        <label style="font-size:.78rem;color:var(--muted);display:flex;align-items:center;gap:.3rem"><input type="checkbox" id="pwSym" checked/> Symbols</label>
        <label style="font-size:.78rem;color:var(--muted);display:flex;align-items:center;gap:.3rem"><input type="checkbox" id="pwNum" checked/> Numbers</label>
      </div>
      <button class="util-btn" onclick="genPassword()">Generate Password</button>
      <div id="pwRes" class="util-result" style="cursor:pointer" onclick="navigator.clipboard.writeText(this.textContent);toast('Copied!')"></div>
    </div>
    <div class="util-card">
      <h3><i class="fa fa-wand-magic-sparkles" style="color:var(--cyan)"></i> AI Calculator</h3>
      <input id="aiCalcIn" class="util-input" placeholder="e.g. What is 15% of 2500? or If I save 5000/month for 2 years..."/>
      <button class="util-btn" onclick="aiCalculate()">Ask AI</button>
      <div id="aiCalcRes" class="util-result"></div>
    </div>
  </div>`;
}

function calculate(){
  const expr=document.getElementById('calcIn').value.trim(); if(!expr) return;
  try {
    const safe=expr.replace(/\^/g,'**').replace(/sqrt\(/g,'Math.sqrt(').replace(/sin\(/g,'Math.sin(Math.PI/180*').replace(/cos\(/g,'Math.cos(Math.PI/180*').replace(/tan\(/g,'Math.tan(Math.PI/180*').replace(/log\(/g,'Math.log10(').replace(/ln\(/g,'Math.log(').replace(/pi/gi,'Math.PI').replace(/e(?![a-z])/g,'Math.E');
    const result=eval(safe);
    document.getElementById('calcRes').textContent=`${expr} = ${result}`;
  } catch { document.getElementById('calcRes').textContent='Invalid expression'; }
}

async function convertUnit(){
  const v=document.getElementById('unitIn').value.trim();if(!v)return;
  const r=await gemini(`Convert: ${v}. Give only the result and formula, no extra text.`,'You are a unit conversion calculator. Be precise and concise.');
  document.getElementById('unitRes').textContent=r.replace(/<[^>]*>/g,'');
}

async function convertCurrency(){
  const v=document.getElementById('curIn').value.trim();if(!v)return;
  const match=v.match(/(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*(?:to|in)\s*([A-Za-z]+)/i);
  if(match){
    try{
      const [,amt,from,to]=match;
      const r=await fetch(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
      const d=await r.json();const rate=d.rates[to.toUpperCase()];
      if(rate){document.getElementById('curRes').textContent=`${amt} ${from.toUpperCase()} = ${(parseFloat(amt)*rate).toFixed(2)} ${to.toUpperCase()} (Rate: ${rate})`;return;}
    }catch{}
  }
  const r=await gemini(`Currency conversion: ${v}`,'Currency assistant. Be precise.');
  document.getElementById('curRes').textContent=r.replace(/<[^>]*>/g,'');
}

function genQR(){
  const v=document.getElementById('qrIn').value.trim();if(!v){toast('Enter text or URL','err');return;}
  const cont=document.getElementById('qrContainer');cont.innerHTML='';
  try{new QRCode(cont,{text:v,width:160,height:160,colorDark:'#000',colorLight:'#fff'});}
  catch{cont.innerHTML='<div style="color:var(--muted);font-size:.8rem">QR generation failed</div>';}
}

function genPassword(){
  const len=parseInt(document.getElementById('pwLen').value)||16;
  const sym=document.getElementById('pwSym').checked;
  const num=document.getElementById('pwNum').checked;
  let chars='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if(num) chars+='0123456789';
  if(sym) chars+='!@#$%^&*()_+-=[]{}|;:,.<>?';
  let pw='';for(let i=0;i<len;i++) pw+=chars[Math.floor(Math.random()*chars.length)];
  const el=document.getElementById('pwRes');el.textContent=pw;el.title='Click to copy';toast('Click password to copy');
}

async function aiCalculate(){
  const v=document.getElementById('aiCalcIn').value.trim();if(!v)return;
  const r=await gemini(v,'You are a math and calculation assistant. Solve step by step. Be precise.');
  document.getElementById('aiCalcRes').innerHTML=fmt(r);
}

// ══════════════════════════════════════════════════════════
// AI TOOLS
// ══════════════════════════════════════════════════════════
function renderAITools(c) {
  c.innerHTML=`
  <div class="section-title"><i class="fa fa-wand-magic-sparkles" style="color:var(--cyan)"></i> AI Tools</div>
  <div class="util-grid">
    <div class="util-card">
      <h3><i class="fa fa-image" style="color:var(--cyan)"></i> Image Analysis (OCR)</h3>
      <input type="file" id="imgIn" accept="image/*" hidden onchange="analyzeImage(event)"/>
      <button class="util-btn" onclick="document.getElementById('imgIn').click()"><i class="fa fa-upload"></i> Upload Image</button>
      <div id="imgRes" class="util-result" style="min-height:60px">Upload an image to analyze or extract text</div>
    </div>
    <div class="util-card">
      <h3><i class="fa fa-closed-captioning" style="color:var(--cyan)"></i> Caption Generator</h3>
      <input type="file" id="capIn" accept="image/*" hidden onchange="generateCaption(event)"/>
      <button class="util-btn" onclick="document.getElementById('capIn').click()"><i class="fa fa-upload"></i> Upload Image for Caption</button>
      <div id="capRes" class="util-result">Upload an image to generate captions</div>
    </div>
    <div class="util-card" style="grid-column:span 2">
      <h3><i class="fa fa-palette" style="color:var(--cyan)"></i> Image Description Generator</h3>
      <input id="imgDescIn" class="util-input" placeholder="Describe what you want to generate (text description — actual image generation needs a separate API)..."/>
      <button class="util-btn" onclick="describeImage()">Generate Detailed Description</button>
      <div id="imgDescRes" class="util-result"></div>
    </div>
  </div>`;
}

async function analyzeImage(e) {
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=async ev => {
    const base64=ev.target.result.split(',')[1];
    const mime=file.type;
    setStatus('Analyzing image...');
    document.getElementById('imgRes').textContent='Analyzing...';
    try {
      const r=await fetch(API(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{inline_data:{mime_type:mime,data:base64}},{text:'Analyze this image in detail. Extract any text (OCR), describe what you see, identify objects, colors, and any important information.'}]}]})});
      const d=await r.json();
      const reply=d.candidates?.[0]?.content?.parts?.[0]?.text||'Could not analyze image.';
      document.getElementById('imgRes').innerHTML=fmt(reply);
      setStatus('Ready');
    } catch(err){document.getElementById('imgRes').textContent='Error: '+err.message;setStatus('Error');}
  };
  reader.readAsDataURL(file);
}

async function generateCaption(e) {
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=async ev => {
    const base64=ev.target.result.split(',')[1];
    setStatus('Generating caption...');
    document.getElementById('capRes').textContent='Generating...';
    try {
      const r=await fetch(API(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{inline_data:{mime_type:file.type,data:base64}},{text:'Generate 3 different captions for this image: 1) Short (1 line), 2) Social media caption with hashtags, 3) Professional description'}]}]})});
      const d=await r.json();
      const reply=d.candidates?.[0]?.content?.parts?.[0]?.text||'Could not generate caption.';
      document.getElementById('capRes').innerHTML=fmt(reply);
      setStatus('Ready');
    } catch(err){document.getElementById('capRes').textContent='Error: '+err.message;setStatus('Error');}
  };
  reader.readAsDataURL(file);
}

async function describeImage(){
  const v=document.getElementById('imgDescIn').value.trim();if(!v)return;
  const r=await gemini(`Create a highly detailed, vivid visual description of: "${v}". Describe colors, composition, lighting, mood, style, and all visual elements as if creating a detailed prompt for an AI image generator.`,'You are a creative visual description expert.');
  document.getElementById('imgDescRes').innerHTML=fmt(r);
}

// ══════════════════════════════════════════════════════════
// COMPUTER CONTROL
// ══════════════════════════════════════════════════════════
function renderComputer(c) {
  c.innerHTML=`
  <div class="section-title"><i class="fa fa-desktop" style="color:var(--cyan)"></i> Computer Control</div>
  <div style="background:rgba(255,209,102,.08);border:1px solid rgba(255,209,102,.3);border-radius:10px;padding:1rem;margin-bottom:1.5rem;font-size:.85rem;color:#ffd166">
    <i class="fa fa-triangle-exclamation"></i> <strong>Browser Limitation:</strong> Direct computer control (opening apps, running commands) is not possible from a browser for security reasons. 
    These features open websites in new tabs or use browser capabilities. For full computer control, use the <a href="https://github.com/sanketpal528-cyber/chatbot" target="_blank" style="color:var(--cyan)">desktop Python version</a>.
  </div>
  <div class="util-grid">
    <div class="util-card">
      <h3><i class="fa fa-globe" style="color:var(--cyan)"></i> Open Websites</h3>
      <input id="urlIn" class="util-input" placeholder="Enter URL or site name (e.g. GitHub, YouTube)..."/>
      <button class="util-btn" onclick="openWebsite()"><i class="fa fa-arrow-up-right-from-square"></i> Open</button>
    </div>
    <div class="util-card">
      <h3><i class="fa fa-magnifying-glass" style="color:var(--cyan)"></i> Web Search</h3>
      <input id="webSearch" class="util-input" placeholder="Search query..."/>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem">
        <button class="btn btn-ghost" style="font-size:.72rem" onclick="searchOn('google')">Google</button>
        <button class="btn btn-ghost" style="font-size:.72rem" onclick="searchOn('github')">GitHub</button>
        <button class="btn btn-ghost" style="font-size:.72rem" onclick="searchOn('youtube')">YouTube</button>
        <button class="btn btn-ghost" style="font-size:.72rem" onclick="searchOn('stackoverflow')">Stack Overflow</button>
      </div>
    </div>
    <div class="util-card">
      <h3><i class="fa fa-code" style="color:var(--cyan)"></i> Launch VS Code (Web)</h3>
      <p style="font-size:.78rem;color:var(--muted);margin-bottom:.75rem">Open VS Code in the browser via vscode.dev</p>
      <button class="util-btn" onclick="window.open('https://vscode.dev','_blank')"><i class="fa fa-code"></i> Open VS Code Web</button>
    </div>
    <div class="util-card">
      <h3><i class="fa fa-terminal" style="color:var(--cyan)"></i> Command Helper</h3>
      <input id="cmdIn" class="util-input" placeholder="Describe what command you need..."/>
      <button class="util-btn" onclick="getCmdHelp()"><i class="fa fa-wand-magic-sparkles"></i> Get Command</button>
      <div id="cmdRes" class="util-result"></div>
    </div>
  </div>`;
}

function openWebsite(){
  const v=document.getElementById('urlIn').value.trim();if(!v)return;
  const url=v.startsWith('http')?v:'https://'+v;window.open(url,'_blank');
}
function searchOn(engine){
  const q=document.getElementById('webSearch').value.trim();if(!q)return;
  const urls={google:'https://google.com/search?q=',github:'https://github.com/search?q=',youtube:'https://youtube.com/results?search_query=',stackoverflow:'https://stackoverflow.com/search?q='};
  window.open((urls[engine]||'https://google.com/search?q=')+encodeURIComponent(q),'_blank');
}
async function getCmdHelp(){
  const v=document.getElementById('cmdIn').value.trim();if(!v)return;
  const r=await gemini(`Give the exact command(s) for: "${v}". Provide both Windows and Linux/Mac versions if different. Include brief explanation.`,'You are a command line expert. Be concise and precise.');
  document.getElementById('cmdRes').innerHTML=fmt(r);
}

// ══════════════════════════════════════════════════════════
// SECURITY
// ══════════════════════════════════════════════════════════
function renderSecurity(c) {
  const keys=[{name:'Gemini API',val:CFG.key?CFG.key.slice(0,8)+'...'+CFG.key.slice(-4):'Not set'}];
  c.innerHTML=`
  <div class="section-title"><i class="fa fa-shield-halved" style="color:var(--cyan)"></i> Security</div>
  <div class="util-grid">
    <div class="util-card">
      <h3><i class="fa fa-key" style="color:var(--cyan)"></i> API Key Manager</h3>
      ${keys.map(k=>`<div class="api-key-item"><div><div class="api-key-name">${k.name}</div><div class="api-key-val">${k.val}</div></div><button class="btn btn-ghost" onclick="go('settings')" style="font-size:.72rem">Change</button></div>`).join('')}
    </div>
    <div class="util-card">
      <h3><i class="fa fa-database" style="color:var(--cyan)"></i> Data Backup</h3>
      <p style="font-size:.78rem;color:var(--muted);margin-bottom:1rem">Export all your data for backup or transfer.</p>
      <button class="util-btn" onclick="backupAll()" style="margin-bottom:.5rem"><i class="fa fa-download"></i> Export All Data</button>
      <label class="util-btn" style="display:flex;align-items:center;justify-content:center;gap:.4rem;cursor:pointer;background:var(--bg4);color:var(--muted);border:1px solid var(--bdr)"><i class="fa fa-upload"></i> Import Data <input type="file" accept=".json" hidden onchange="importData(event)"/></label>
    </div>
    <div class="util-card">
      <h3><i class="fa fa-trash" style="color:#ff4d4d"></i> Clear Data</h3>
      <p style="font-size:.78rem;color:var(--muted);margin-bottom:1rem">Permanently delete stored data.</p>
      <button class="btn btn-danger" onclick="clearData('chat')" style="width:100%;margin-bottom:.4rem;justify-content:center">Clear Chat History</button>
      <button class="btn btn-danger" onclick="clearData('memory')" style="width:100%;margin-bottom:.4rem;justify-content:center">Clear Memory</button>
      <button class="btn btn-danger" onclick="clearData('all')" style="width:100%;justify-content:center">Clear Everything</button>
    </div>
    <div class="util-card">
      <h3><i class="fa fa-circle-info" style="color:var(--cyan)"></i> Privacy Info</h3>
      <div style="font-size:.78rem;color:var(--muted);line-height:1.7">
        <p>✅ API key stored only in your browser</p>
        <p>✅ All data stays on your device (localStorage)</p>
        <p>✅ No data sent to any third-party servers</p>
        <p>⚠️ Messages sent to Google Gemini API for AI responses</p>
        <p>⚠️ Review Google's privacy policy for API usage</p>
      </div>
    </div>
  </div>`;
}

function backupAll(){
  const data={version:'1.0',exported:new Date().toISOString(),chat:chatHistory,memory:memories,notes,tasks,goals,calEvents,analytics,settings:CFG};
  const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`voxify_backup_${new Date().toISOString().split('T')[0]}.json`;a.click();toast('Backup exported ✓');
}

function importData(e){
  const file=e.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=ev=>{
    try{
      const d=JSON.parse(ev.target.result);
      if(d.chat) {chatHistory=d.chat;save('vx_chat',chatHistory);}
      if(d.memory) {memories=d.memory;save('vx_mem',memories);}
      if(d.notes) {notes=d.notes;save('vx_notes',notes);}
      if(d.tasks) {tasks=d.tasks;save('vx_tasks',tasks);}
      if(d.goals) {goals=d.goals;save('vx_goals',goals);}
      if(d.calEvents) {calEvents=d.calEvents;save('vx_cal',calEvents);}
      toast('Data imported successfully ✓');
    }catch{toast('Invalid backup file','err');}
  };
  r.readAsText(file);
}

function clearData(type){
  if(!confirm(`Clear ${type==='all'?'ALL data':type}? This cannot be undone.`)) return;
  if(type==='chat'||type==='all'){chatHistory=[];save('vx_chat',[]);}
  if(type==='memory'||type==='all'){memories=[];save('vx_mem',[]);}
  if(type==='all'){notes=[];tasks=[];goals=[];calEvents=[];save('vx_notes',[]);save('vx_tasks',[]);save('vx_goals',[]);save('vx_cal',[]);}
  toast(type==='all'?'All data cleared':'Data cleared');
}

// ══════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════
function renderAnalytics(c) {
  const totalTasks=tasks.length,doneTasks=tasks.filter(t=>t.done).length;
  c.innerHTML=`
  <div class="section-title"><i class="fa fa-chart-bar" style="color:var(--cyan)"></i> Analytics</div>
  <div class="stat-grid">
    <div class="stat-box"><div class="sn">${analytics.chats}</div><div class="sl">AI Conversations</div></div>
    <div class="stat-box"><div class="sn">${analytics.voice}</div><div class="sl">Voice Sessions</div></div>
    <div class="stat-box"><div class="sn">${analytics.study}</div><div class="sl">Study Sessions</div></div>
    <div class="stat-box"><div class="sn">${analytics.code}</div><div class="sl">Coding Sessions</div></div>
    <div class="stat-box"><div class="sn">${analytics.files}</div><div class="sl">Files Analyzed</div></div>
    <div class="stat-box"><div class="sn">${analytics.tasks}</div><div class="sl">Task Sessions</div></div>
    <div class="stat-box"><div class="sn">${memories.length}</div><div class="sl">Memories Saved</div></div>
    <div class="stat-box"><div class="sn">${notes.length}</div><div class="sl">Notes Created</div></div>
    <div class="stat-box"><div class="sn">${doneTasks}/${totalTasks}</div><div class="sl">Tasks Completed</div></div>
    <div class="stat-box"><div class="sn">${chatHistory.length}</div><div class="sl">Total Messages</div></div>
    <div class="stat-box"><div class="sn">${goals.length}</div><div class="sl">Active Goals</div></div>
    <div class="stat-box"><div class="sn">${calEvents.length}</div><div class="sl">Calendar Events</div></div>
  </div>
  <div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);padding:1.25rem">
    <h3 style="font-size:.9rem;font-weight:700;color:var(--text);margin-bottom:.75rem"><i class="fa fa-chart-pie" style="color:var(--cyan)"></i> Task Completion</h3>
    <div style="display:flex;align-items:center;gap:1rem">
      <div style="flex:1">
        <div style="height:8px;background:rgba(255,255,255,.06);border-radius:8px;overflow:hidden">
          <div style="height:100%;width:${totalTasks?Math.round(doneTasks/totalTasks*100):0}%;background:linear-gradient(90deg,var(--cyan),var(--lime));border-radius:8px;transition:width .5s ease"></div>
        </div>
      </div>
      <span style="font-size:.82rem;color:var(--muted);white-space:nowrap">${totalTasks?Math.round(doneTasks/totalTasks*100):0}% complete</span>
    </div>
    <div style="margin-top:.5rem;font-size:.78rem;color:var(--dim)">${doneTasks} completed · ${totalTasks-doneTasks} remaining</div>
  </div>`;
}

// ══════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════
function renderSettings(c) {
  c.innerHTML=`
  <div class="section-title"><i class="fa fa-gear" style="color:var(--cyan)"></i> Settings</div>
  <div class="settings-grid">
    <div class="setting-card">
      <h3><i class="fa fa-palette" style="color:var(--cyan)"></i> Appearance</h3>
      <div class="setting-row"><span>Theme</span>
        <select class="s-select" onchange="CFG.theme=this.value;applyTheme(this.value);save('vx_theme',this.value)">
          <option value="dark" ${CFG.theme==='dark'?'selected':''}>Dark</option>
          <option value="light" ${CFG.theme==='light'?'selected':''}>Light</option>
        </select>
      </div>
      <div class="setting-row"><span>Accent Color</span>
        <div class="color-row">
          ${[['#00d4ff','Cyan'],['#39ff14','Lime'],['#7c3aed','Purple'],['#f72585','Pink'],['#ffd166','Yellow']].map(([c,n])=>`<div class="clr-swatch" style="background:${c}" title="${n}" onclick="setAccent('${c}',this)"></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="setting-card">
      <h3><i class="fa fa-robot" style="color:var(--cyan)"></i> AI Model & Persona</h3>
      <div class="setting-row"><span>Model</span>
        <select class="s-select" id="modelSel2" onchange="CFG.model=this.value;save('vx_model',this.value);document.getElementById('sbModel').textContent=this.value">
          <option value="gemini-3.6-flash" ${CFG.model==='gemini-3.6-flash'?'selected':''}>3.6 Flash (Latest)</option>
          <option value="gemini-3.5-flash-lite" ${CFG.model==='gemini-3.5-flash-lite'?'selected':''}>3.5 Flash Lite (Fast)</option>
        </select>
      </div>
      <div class="setting-row"><span>Persona</span>
        <select class="s-select" onchange="CFG.persona=this.value;save('vx_persona',this.value)">
          <option value="helpful" ${CFG.persona==='helpful'?'selected':''}>Helpful</option>
          <option value="professional" ${CFG.persona==='professional'?'selected':''}>Professional</option>
          <option value="creative" ${CFG.persona==='creative'?'selected':''}>Creative</option>
          <option value="tutor" ${CFG.persona==='tutor'?'selected':''}>Tutor</option>
        </select>
      </div>
    </div>
    <div class="setting-card">
      <h3><i class="fa fa-microphone" style="color:var(--cyan)"></i> Voice Settings</h3>
      <div class="setting-row"><span>Voice Output</span><label class="tog"><input type="checkbox" ${CFG.voiceOut?'checked':''} onchange="CFG.voiceOut=this.checked;save('vx_voiceOut',this.checked)"/><span class="togg"></span></label></div>
      <div class="setting-row"><span>Wake Word ("Hey Voxify")</span><label class="tog"><input type="checkbox" ${CFG.wakeword?'checked':''} onchange="toggleWakeWord(this.checked)"/><span class="togg"></span></label></div>
      <div class="setting-row"><span>Language</span>
        <select class="s-select" onchange="CFG.lang=this.value;save('vx_lang',this.value)">
          <option value="en-US" ${CFG.lang==='en-US'?'selected':''}>English US</option>
          <option value="en-IN" ${CFG.lang==='en-IN'?'selected':''}>English IN</option>
          <option value="hi-IN" ${CFG.lang==='hi-IN'?'selected':''}>Hindi</option>
        </select>
      </div>
    </div>
    <div class="setting-card">
      <h3><i class="fa fa-key" style="color:var(--cyan)"></i> API Key</h3>
      <div style="font-size:.78rem;color:var(--muted);margin-bottom:.75rem">Current key: <code style="color:var(--cyan)">${CFG.key?CFG.key.slice(0,6)+'...'+CFG.key.slice(-4):'Not set'}</code></div>
      <button class="btn btn-ghost" onclick="changeKey()" style="width:100%;justify-content:center"><i class="fa fa-key"></i> Change API Key</button>
    </div>
  </div>`;
}

function setAccent(color,el){
  document.documentElement.style.setProperty('--cyan',color);
  document.documentElement.style.setProperty('--acc',color);
  document.querySelectorAll('.clr-swatch').forEach(s=>s.classList.remove('act'));
  el.classList.add('act');
  save('vx_accent',color);
  toast('Accent color updated');
}

function changeKey(){CFG.key='';save('vx_key','');document.getElementById('apiKeyInput').value='';document.getElementById('setupModal').style.display='flex';document.getElementById('app').classList.add('hidden');}

// ── Restore accent on load ─────────────────────────────
(()=>{
  const acc=localStorage.getItem('vx_accent');
  if(acc){document.documentElement.style.setProperty('--cyan',acc);document.documentElement.style.setProperty('--acc',acc);}
})();
