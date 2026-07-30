/* ═══════════════════════════════════════════════════════
   Voxify AI — Full Assistant App
   Google Gemini API · All features client-side
   ═══════════════════════════════════════════════════════ */

// ── Config ──────────────────────────────────────────────
let API_KEY   = localStorage.getItem('voxify_key') || '';
let MODEL     = localStorage.getItem('voxify_model') || 'gemini-3.5-flash-lite';
let memory    = JSON.parse(localStorage.getItem('voxify_memory') || '[]');
let notes     = JSON.parse(localStorage.getItem('voxify_notes') || '[]');
let tasks     = JSON.parse(localStorage.getItem('voxify_tasks') || '[]');
let activeNote = null;
let pdfText   = '';
let currentMode = 'chat';
let studyTab  = 'explain';
let voiceListening = false;
let sidebarOpen = window.innerWidth > 768;

const GEMINI_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

// ── Init ────────────────────────────────────────────────
window.addEventListener('load', () => {
  // Clear old model names that no longer work
  const oldModels = ['gemini-1.5-flash','gemini-1.5-pro','gemini-2.0-flash-exp',
                     'gemini-2.0-flash','gemini-2.0-flash-lite','gemini-2.5-flash',
                     'gemini-2.5-pro','gemini-2.5-flash-lite'];
  if (oldModels.includes(MODEL)) {
    MODEL = 'gemini-3.5-flash-lite';
    localStorage.setItem('voxify_model', MODEL);
  }
  if (!API_KEY) {
    document.getElementById('setupModal').classList.remove('hidden');
  } else {
    initApp();
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  document.getElementById('modelSel').value = MODEL;
});

function initApp() {
  document.getElementById('app').style.display = 'flex';
  updateMemCount();
  renderNotes();
  renderTasks();
  if (!sidebarOpen) document.getElementById('sidebar').classList.remove('open');
  addMsg('chat', 'bot', `👋 Hi! I'm **Voxify AI** powered by Gemini ${MODEL}.\n\nI can help you with:\n• 💬 **Chat** — general Q&A\n• 🎤 **Voice** — speak to me\n• 📄 **PDF** — upload and ask about documents\n• 📝 **Notes** — save and enhance your notes\n• 💻 **Code** — write, debug, explain code\n• 🎓 **Study** — learn any topic\n• 🔍 **Search** — research anything\n• 📋 **Planner** — tasks and AI planning\n\nHow can I help you today?`);
  checkReminders();
  setInterval(checkReminders, 60000);
}

// ── API Key Setup ────────────────────────────────────────
function saveKey() {
  const k = document.getElementById('apiKeyInput').value.trim();
  if (!k || k.length < 20) { showToast('Please enter a valid API key', 'error'); return; }
  API_KEY = k;
  localStorage.setItem('voxify_key', k);
  document.getElementById('setupModal').classList.add('hidden');
  initApp();
}

function changeKey() {
  API_KEY = '';
  localStorage.removeItem('voxify_key');
  document.getElementById('apiKeyInput').value = '';
  document.getElementById('setupModal').classList.remove('hidden');
}

function toggleKeyVis() {
  const inp = document.getElementById('apiKeyInput');
  const btn = document.getElementById('eyeBtn');
  if (inp.type === 'password') { inp.type = 'text'; btn.innerHTML = '<i class="fa fa-eye-slash"></i>'; }
  else { inp.type = 'password'; btn.innerHTML = '<i class="fa fa-eye"></i>'; }
}

// ── Gemini API call ──────────────────────────────────────
async function callGemini(prompt, systemPrompt = '', useMemory = true) {
  setStatus('Thinking...');
  const contents = [];

  // Add memory context
  if (useMemory && memory.length > 0) {
    const ctx = memory.slice(-10).map(t => `${t.role}: ${t.text}`).join('\n');
    contents.push({ role:'user', parts:[{ text: systemPrompt
      ? `${systemPrompt}\n\nConversation history:\n${ctx}\n\nUser: ${prompt}`
      : `${ctx}\n\nUser: ${prompt}` }] });
  } else {
    contents.push({ role:'user', parts:[{ text: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt }] });
  }

  try {
    const res = await fetch(GEMINI_URL(MODEL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
    setStatus('Ready');
    return reply;
  } catch (err) {
    setStatus('Error');
    if (err.message.includes('API_KEY_INVALID') || err.message.includes('API key')) {
      showToast('Invalid API key. Please update it in settings.', 'error');
      return 'API key error. Please update your key in Settings.';
    }
    return `Error: ${err.message}`;
  }
}

// ── Mode switching ───────────────────────────────────────
function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`mode-${mode}`).classList.add('active');
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

  const titles = {
    chat:'<i class="fa fa-message"></i> Chat',
    voice:'<i class="fa fa-microphone"></i> Voice Mode',
    pdf:'<i class="fa fa-file-pdf"></i> PDF Reader',
    notes:'<i class="fa fa-note-sticky"></i> Notes',
    code:'<i class="fa fa-code"></i> Code Assistant',
    study:'<i class="fa fa-graduation-cap"></i> Study Assistant',
    search:'<i class="fa fa-magnifying-glass"></i> Web Search',
    planner:'<i class="fa fa-list-check"></i> Planner'
  };
  document.getElementById('modeTitle').innerHTML = titles[mode] || mode;
  if (window.innerWidth <= 768) closeSidebar();
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sb.classList.toggle('open');
  } else {
    sb.classList.toggle('collapsed');
  }
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

// ── Message rendering ────────────────────────────────────
function addMsg(windowId, sender, text) {
  const win = document.getElementById(windowId === 'chat' ? 'chatWindow'
    : windowId === 'pdf' ? 'pdfMessages'
    : windowId === 'code' ? 'codeMessages'
    : windowId === 'study' ? 'studyMessages'
    : windowId === 'search' ? 'searchMessages'
    : windowId === 'planner' ? 'plannerMessages'
    : 'chatWindow');
  if (!win) return;

  const div = document.createElement('div');
  div.className = `msg ${sender}`;

  if (sender === 'bot' || sender === 'system') {
    div.innerHTML = formatMessage(text);
  } else {
    div.textContent = text;
  }

  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
  return div;
}

function formatMessage(text) {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^- (.+)$/gm, '• $1')
    .replace(/\n/g, '<br/>');
}

function addTyping(windowId) {
  const win = document.getElementById(windowId === 'chat' ? 'chatWindow'
    : windowId === 'pdf' ? 'pdfMessages'
    : windowId === 'code' ? 'codeMessages'
    : windowId === 'study' ? 'studyMessages'
    : windowId === 'search' ? 'searchMessages'
    : windowId === 'planner' ? 'plannerMessages'
    : 'chatWindow');
  if (!win) return null;
  const d = document.createElement('div');
  d.className = 'typing-msg'; d.id = 'typing-' + windowId;
  d.innerHTML = '<span></span><span></span><span></span>';
  win.appendChild(d); win.scrollTop = win.scrollHeight;
  return d;
}

function removeTyping(windowId) {
  const el = document.getElementById('typing-' + windowId);
  if (el) el.remove();
}

// ── CHAT ────────────────────────────────────────────────
async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = ''; autoResize(input);
  addMsg('chat', 'user', msg);
  memory.push({ role: 'user', text: msg });
  saveMemory();

  addTyping('chat');
  const sys = `You are Voxify AI, a helpful, knowledgeable, and friendly AI assistant. 
You were created by Sanket Pal (@sanketpal528-cyber on GitHub). 
Be concise but thorough. Use markdown formatting for code and structure.
Today is ${new Date().toLocaleDateString('en-IN', {weekday:'long',year:'numeric',month:'long',day:'numeric'})}.`;

  const reply = await callGemini(msg, sys, true);
  removeTyping('chat');
  addMsg('chat', 'bot', reply);
  memory.push({ role: 'assistant', text: reply });
  saveMemory();
  if (document.getElementById('voiceOut').checked) speak(reply.replace(/<[^>]*>/g,'').replace(/[#*`]/g,''));
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
}

function clearChat() {
  document.getElementById('chatWindow').innerHTML = '';
  addMsg('chat', 'system', 'Chat cleared. Memory preserved.');
}

// ── MEMORY ──────────────────────────────────────────────
function saveMemory() {
  if (memory.length > 50) memory = memory.slice(-50);
  localStorage.setItem('voxify_memory', JSON.stringify(memory));
  updateMemCount();
}

function clearMemory() {
  memory = [];
  localStorage.removeItem('voxify_memory');
  updateMemCount();
  showToast('Memory cleared');
}

function updateMemCount() {
  document.getElementById('memCount').textContent = `${memory.length} turns`;
}

// ── VOICE MODE ───────────────────────────────────────────
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = SR ? new SR() : null;
if (recognizer) {
  recognizer.lang = 'en-US'; recognizer.interimResults = false;
  recognizer.onresult = async (e) => {
    const transcript = e.results[0][0].transcript;
    document.getElementById('voiceTranscript').textContent = '🎤 "' + transcript + '"';
    document.getElementById('voiceStatus').textContent = 'Processing...';
    document.getElementById('voiceOrb').className = 'voice-orb speaking';

    const sys = `You are Voxify AI, a voice assistant. Give concise spoken responses (2-3 sentences max unless asked for more). No markdown formatting. Today is ${new Date().toLocaleDateString()}.`;
    const reply = await callGemini(transcript, sys, true);
    memory.push({ role: 'user', text: transcript }, { role: 'assistant', text: reply });
    saveMemory();
    document.getElementById('voiceResponse').textContent = reply;
    document.getElementById('voiceStatus').textContent = 'Speaking...';
    speak(reply, () => {
      document.getElementById('voiceStatus').textContent = 'Click orb to speak';
      document.getElementById('voiceOrb').className = 'voice-orb';
    });
  };
  recognizer.onerror = () => {
    document.getElementById('voiceStatus').textContent = "Didn't catch that — try again";
    document.getElementById('voiceOrb').className = 'voice-orb';
    voiceListening = false;
  };
  recognizer.onend = () => { voiceListening = false; };
}

function toggleVoiceMode() {
  if (!recognizer) { showToast('Voice not supported in this browser', 'error'); return; }
  if (voiceListening) { recognizer.stop(); voiceListening = false; document.getElementById('voiceOrb').className = 'voice-orb'; document.getElementById('voiceStatus').textContent = 'Click orb to speak'; return; }
  voiceListening = true;
  document.getElementById('voiceOrb').className = 'voice-orb listening';
  document.getElementById('voiceStatus').textContent = '🎤 Listening...';
  document.getElementById('voiceTranscript').textContent = '';
  document.getElementById('voiceResponse').textContent = '';
  recognizer.start();
}

// ── VOICE INPUT (chat mic button) ────────────────────────
let chatRecognizer = null;
let chatMicActive = false;

function toggleMic() {
  if (!SR) { showToast('Voice not supported in this browser', 'error'); return; }
  const btn = document.getElementById('micBtn');

  if (chatMicActive) {
    if (chatRecognizer) chatRecognizer.stop();
    chatMicActive = false;
    btn.classList.remove('recording');
    return;
  }

  chatMicActive = true;
  btn.classList.add('recording');

  chatRecognizer = new SR();
  chatRecognizer.lang = 'en-US';
  chatRecognizer.interimResults = false;
  chatRecognizer.maxAlternatives = 1;

  chatRecognizer.onresult = (e) => {
    const txt = e.results[0][0].transcript;
    document.getElementById('chatInput').value = txt;
    autoResize(document.getElementById('chatInput'));
    btn.classList.remove('recording');
    chatMicActive = false;
    // Auto-send after voice input
    setTimeout(() => sendChat(), 300);
  };

  chatRecognizer.onerror = (e) => {
    showToast('Voice error: ' + e.error, 'error');
    btn.classList.remove('recording');
    chatMicActive = false;
  };

  chatRecognizer.onend = () => {
    btn.classList.remove('recording');
    chatMicActive = false;
  };

  try {
    chatRecognizer.start();
  } catch(e) {
    showToast('Could not start microphone: ' + e.message, 'error');
    btn.classList.remove('recording');
    chatMicActive = false;
  }
}

// ── TTS ──────────────────────────────────────────────────
function speak(text, onEnd) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 500));
  u.rate = 1; u.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
          || voices.find(v => v.lang.startsWith('en')) || voices[0];
  if (v) u.voice = v;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

// ── PDF MODE ─────────────────────────────────────────────
async function loadPDF(e) {
  const file = e.target.files[0];
  if (!file) return;
  setStatus('Reading PDF...');
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(buf).promise;
  let text = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map(s => s.str).join(' ') + '\n';
  }
  pdfText = text.slice(0, 15000);
  setStatus('Ready');
  document.getElementById('pdfUploadArea').classList.add('hidden');
  document.getElementById('pdfChat').classList.remove('hidden');
  document.getElementById('pdfInfo').innerHTML = `<i class="fa fa-file-pdf"></i> ${file.name} · ${pdf.numPages} pages · ${Math.round(text.length/1000)}K chars`;
  addMsg('pdf', 'bot', `📄 PDF loaded! I've read **${file.name}** (${pdf.numPages} pages).\n\nAsk me anything about this document!`);
}

async function askPDF() {
  const input = document.getElementById('pdfInput');
  const q = input.value.trim();
  if (!q || !pdfText) return;
  input.value = ''; autoResize(input);
  addMsg('pdf', 'user', q);
  addTyping('pdf');
  const sys = `You are a document analysis assistant. Answer questions based ONLY on the provided document text. Be accurate and cite specific parts when relevant.\n\nDOCUMENT CONTENT:\n${pdfText}`;
  const reply = await callGemini(q, sys, false);
  removeTyping('pdf');
  addMsg('pdf', 'bot', reply);
}

function handlePdfKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askPDF(); } }

// ── NOTES ────────────────────────────────────────────────
function renderNotes() {
  const list = document.getElementById('notesList');
  list.innerHTML = notes.length ? notes.map((n, i) => `
    <div class="note-item ${activeNote === i ? 'active' : ''}" onclick="selectNote(${i})">
      <div class="note-item-title">${n.title || 'Untitled'}</div>
      <div class="note-item-date">${new Date(n.date).toLocaleDateString()}</div>
    </div>`).join('') : '<div style="padding:.5rem;font-size:.75rem;color:var(--dim)">No notes yet</div>';
}

function selectNote(i) {
  activeNote = i;
  document.getElementById('noteTitle').value = notes[i].title || '';
  document.getElementById('noteBody').value  = notes[i].body  || '';
  renderNotes();
}

function newNote() {
  notes.unshift({ title: '', body: '', date: Date.now() });
  activeNote = 0;
  selectNote(0);
  saveNotes();
  document.getElementById('noteTitle').focus();
}

function saveNote() {
  if (activeNote === null) newNote();
  notes[activeNote] = {
    title: document.getElementById('noteTitle').value || 'Untitled',
    body:  document.getElementById('noteBody').value,
    date:  Date.now()
  };
  saveNotes(); renderNotes();
  showToast('Note saved ✓');
}

function deleteNote() {
  if (activeNote === null) return;
  notes.splice(activeNote, 1);
  activeNote = notes.length ? 0 : null;
  if (activeNote !== null) selectNote(0);
  else { document.getElementById('noteTitle').value = ''; document.getElementById('noteBody').value = ''; }
  saveNotes(); renderNotes();
}

async function aiEnhanceNote() {
  const body = document.getElementById('noteBody').value.trim();
  if (!body) { showToast('Write something first!', 'error'); return; }
  setStatus('Enhancing...');
  const sys = 'You are a writing assistant. Improve the clarity, structure, and grammar of the given notes. Keep the same meaning but make it better organized and more readable. Return only the enhanced text.';
  const enhanced = await callGemini(body, sys, false);
  document.getElementById('noteBody').value = enhanced.replace(/<[^>]*>/g, '');
  showToast('Note enhanced with AI ✨');
}

function saveNotes() { localStorage.setItem('voxify_notes', JSON.stringify(notes)); }

// ── CODE ASSISTANT ───────────────────────────────────────
async function sendCode() {
  const input = document.getElementById('codeInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = ''; autoResize(input);
  addMsg('code', 'user', msg);
  addTyping('code');
  const sys = `You are an expert coding assistant. Help with writing, debugging, explaining, optimizing, and testing code. 
Format code blocks with proper syntax highlighting using \`\`\`language notation.
Be precise, practical, and include examples. Today is ${new Date().toLocaleDateString()}.`;
  const reply = await callGemini(msg, sys, false);
  removeTyping('code');
  addMsg('code', 'bot', reply);
}

function codeQuick(prefix) {
  document.getElementById('codeInput').value = prefix;
  document.getElementById('codeInput').focus();
}

function handleCodeKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCode(); } }

// ── STUDY ASSISTANT ──────────────────────────────────────
function setStudyTab(tab, el) {
  studyTab = tab;
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

async function sendStudy() {
  const input = document.getElementById('studyInput');
  const topic = input.value.trim();
  if (!topic) return;
  input.value = ''; autoResize(input);
  addMsg('study', 'user', topic);
  addTyping('study');

  const prompts = {
    explain: `Explain the following topic clearly and concisely, suitable for a student. Use examples, analogies, and simple language. Structure with headings if needed:\n\n${topic}`,
    quiz:    `Create 5 multiple choice quiz questions about the following topic. Format each as:\nQ: [question]\nA) option B) option C) option D) option\nAnswer: [letter]\n\nTopic: ${topic}`,
    summary: `Create a concise, well-structured summary of the following. Include key points, definitions, and important concepts:\n\n${topic}`,
    flashcard: `Create 8 flashcards for studying the following topic. Format as:\n**Term**: Definition\n\nTopic: ${topic}`,
    practice: `Generate 5 practice questions (mix of short answer and problem-solving) for the following topic, with answer hints:\n\n${topic}`
  };

  const sys = 'You are an expert study assistant and educator. Help students learn effectively through clear explanations, quizzes, summaries, and practice questions.';
  const reply = await callGemini(prompts[studyTab] || topic, sys, false);
  removeTyping('study');
  addMsg('study', 'bot', reply);
}

function handleStudyKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendStudy(); } }

// ── WEB SEARCH / RESEARCH ────────────────────────────────
async function sendSearch() {
  const input = document.getElementById('searchInput');
  const q = input.value.trim();
  if (!q) return;
  input.value = ''; autoResize(input);
  addMsg('search', 'user', q);
  addTyping('search');

  const sys = `You are a research assistant with broad knowledge. Answer the question thoroughly as if you've researched it. 
Include: key facts, current understanding, multiple perspectives if relevant, and cite what type of sources would confirm this.
Today's date: ${new Date().toLocaleDateString('en-IN', {weekday:'long',year:'numeric',month:'long',day:'numeric'})}.
Be honest if something might be outdated (your knowledge cutoff is early 2024).`;

  const reply = await callGemini(q, sys, false);
  removeTyping('search');
  addMsg('search', 'bot', reply);
}

function handleSearchKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendSearch(); } }

// ── PLANNER ──────────────────────────────────────────────
function renderTasks() {
  const list = document.getElementById('taskList');
  if (!tasks.length) { list.innerHTML = '<div style="font-size:.75rem;color:var(--dim);padding:.5rem">No tasks yet</div>'; return; }
  list.innerHTML = tasks.map((t, i) => `
    <div class="task-item ${t.done ? 'done' : ''}">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask(${i})"/>
      <span>${t.text}</span>
      ${t.time ? `<span class="task-item-time">⏰ ${new Date(t.time).toLocaleString('en-IN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>` : ''}
      <button class="task-del" onclick="deleteTask(${i})"><i class="fa fa-xmark"></i></button>
    </div>`).join('');
}

function addTask() {
  const text = document.getElementById('taskInput').value.trim();
  const time = document.getElementById('taskTime').value;
  if (!text) return;
  tasks.push({ text, time, done: false, id: Date.now() });
  document.getElementById('taskInput').value = '';
  document.getElementById('taskTime').value = '';
  saveTasks(); renderTasks();
}

function toggleTask(i) { tasks[i].done = !tasks[i].done; saveTasks(); renderTasks(); }
function deleteTask(i) { tasks.splice(i, 1); saveTasks(); renderTasks(); }
function saveTasks()   { localStorage.setItem('voxify_tasks', JSON.stringify(tasks)); }

async function sendPlanner() {
  const input = document.getElementById('plannerInput');
  const goal = input.value.trim();
  if (!goal) return;
  input.value = ''; autoResize(input);
  addMsg('planner', 'user', goal);
  addTyping('planner');

  const sys = `You are an AI planning assistant. When given a goal, create a detailed, actionable step-by-step plan.
Format as numbered steps with time estimates. Be practical and realistic.
Today: ${new Date().toLocaleDateString()}.`;

  const reply = await callGemini(goal, sys, false);
  removeTyping('planner');
  addMsg('planner', 'bot', reply);
}

function handlePlannerKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPlanner(); } }

function checkReminders() {
  const now = Date.now();
  tasks.filter(t => !t.done && t.time && Math.abs(new Date(t.time).getTime() - now) < 65000)
       .forEach(t => showToast(`⏰ Reminder: ${t.text}`, 'info', 6000));
}

// ── MODEL ────────────────────────────────────────────────
function setModel() {
  MODEL = document.getElementById('modelSel').value;
  localStorage.setItem('voxify_model', MODEL);
  document.getElementById('modelBadge').textContent = MODEL;
  showToast(`Model switched to ${MODEL}`);
}

// ── UTILS ────────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 150) + 'px';
}

function setStatus(text) {
  document.getElementById('statusText').textContent = text;
}

let toastTimer;
function showToast(msg, type = 'info', duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}
