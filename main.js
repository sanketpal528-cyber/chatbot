/* ═══════════════════════════════════════════════════════════════
   Voxify-AI  —  Standalone Frontend (No backend required)
   Uses rule-based + keyword AI responses that work on GitHub Pages
   ═══════════════════════════════════════════════════════════════ */

const chatWindow = document.getElementById("chatWindow");
const textInput  = document.getElementById("textInput");
const sendBtn    = document.getElementById("sendBtn");
const micBtn     = document.getElementById("micBtn");
const status     = document.getElementById("status");

// ── Conversation memory ──────────────────────────────────────────
let history = [];

// ── Bot knowledge base ───────────────────────────────────────────
const persona = {
  name: "Voxify",
  creator: "Sanket Pal",
  version: "1.0",
  github: "github.com/sanketpal528-cyber/chatbot"
};

const responses = {
  greeting: [
    "Hello! I'm Voxify, your AI assistant. How can I help you today? 😊",
    "Hi there! Voxify here — ready to chat. What's on your mind?",
    "Hey! Great to see you. I'm Voxify. Ask me anything!"
  ],
  bye: [
    "Goodbye! Have a great day! 👋",
    "See you later! Come back anytime. 😊",
    "Bye! Stay awesome! ✨"
  ],
  thanks: [
    "You're welcome! Happy to help. 😊",
    "Anytime! That's what I'm here for.",
    "Glad I could help! Is there anything else?"
  ],
  name: [
    `I'm Voxify — a voice-enabled AI assistant built by ${persona.creator}. 🤖`,
    `My name is Voxify! I was created by ${persona.creator} as an AI chatbot project.`
  ],
  creator: [
    `I was built by ${persona.creator} — a Python and AI developer. Check out the project at ${persona.github}`,
    `${persona.creator} created me! They're passionate about Python, AI/ML, and cloud development.`
  ],
  help: [
    "I can chat with you, answer questions, tell jokes, discuss tech, and more! Just type or speak. 🎤",
    "Try asking me about: tech topics, programming, AI/ML, jokes, or just have a conversation!"
  ],
  joke: [
    "Why do programmers prefer dark mode? Because light attracts bugs! 🐛😄",
    "How many programmers does it take to change a light bulb? None — that's a hardware problem! 💡",
    "Why did Python break up with Java? Because it didn't want any class! 🐍",
    "What do you call a programmer from Finland? Nerdic! 😄",
    "Why do Java developers wear glasses? Because they don't C#! 👓"
  ],
  python: [
    "Python is one of the most versatile languages! Great for AI/ML, web dev, automation, and data science. 🐍",
    "Python's clean syntax makes it perfect for beginners and experts alike. Libraries like NumPy, Pandas, TensorFlow make it powerful for AI.",
    "Python tip: Use list comprehensions for cleaner code! e.g., `[x**2 for x in range(10)]` ✨"
  ],
  ai: [
    "AI (Artificial Intelligence) is fascinating! It includes Machine Learning, Deep Learning, NLP, Computer Vision, and more. 🤖",
    "AI is transforming every industry. The key areas are: supervised learning, unsupervised learning, and reinforcement learning.",
    "Some great AI frameworks: TensorFlow, PyTorch, scikit-learn, Hugging Face Transformers. Start with Python! 🚀"
  ],
  ml: [
    "Machine Learning lets computers learn from data without being explicitly programmed. 🧠",
    "ML types: Supervised (labeled data), Unsupervised (patterns), Reinforcement (rewards). Which interests you?",
    "Start your ML journey: Python → NumPy/Pandas → scikit-learn → Deep Learning with TensorFlow/PyTorch!"
  ],
  cloud: [
    "Cloud computing is the future! AWS, Azure, and GCP are the big three. AWS has S3, Lambda, EC2, CloudFront and more. ☁️",
    "AWS services are incredible for scalability. S3 for storage, EC2 for compute, Lambda for serverless, and CloudFront for CDN.",
    "For DevOps, Docker + Kubernetes + GitHub Actions make a powerful CI/CD pipeline on any cloud platform!"
  ],
  web: [
    "Web development is exciting! HTML + CSS + JavaScript for frontend, Node.js/Python for backend. 🌐",
    "For modern web dev: React or Vue.js for frontend, Express/FastAPI for backend, and MongoDB/PostgreSQL for databases.",
    "GitHub Pages is perfect for hosting static sites for free! That's how this chatbot is deployed. 😄"
  ],
  weather: [
    "I don't have real-time weather data, but you can check weather.com or Google! 🌤️",
    "For weather info, try asking Google or a weather app. I'm better at tech topics! ⛅"
  ],
  time: [
    `The current time is ${new Date().toLocaleTimeString()}. ⏰`,
    `It's ${new Date().toLocaleTimeString()} right now on ${new Date().toLocaleDateString()}! 📅`
  ],
  date: [
    `Today is ${new Date().toLocaleDateString('en-IN', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}. 📅`,
    `It's ${new Date().toLocaleDateString()} today! 🗓️`
  ],
  math: [
    "I can help with math concepts! For calculations, try Python: `print(2**10)` → 1024 🧮",
    "Math tip: Python is a great calculator! `import math; math.sqrt(144)` → 12.0 ✨"
  ],
  default: [
    "That's an interesting question! I'm still learning, but I'd say — keep exploring and stay curious. 🤔",
    "Hmm, I'm not sure about that one. Try asking me about Python, AI, cloud computing, or programming! 💡",
    "I don't have a perfect answer for that, but I'm always improving. What else can I help you with? 😊",
    "Interesting! I'm a rule-based AI for now, but I'm getting smarter every day. Ask me something about tech! 🚀",
    "That's beyond my current knowledge, but feel free to rephrase or ask about programming, AI, or tech! 🤖"
  ]
};

// ── Smart response picker ────────────────────────────────────────
function getResponse(input) {
  const msg = input.toLowerCase().trim();

  // Greetings
  if (/\b(hi|hello|hey|howdy|good\s*(morning|afternoon|evening)|wassup|sup)\b/.test(msg))
    return pick(responses.greeting);

  // Goodbye
  if (/\b(bye|goodbye|see\s*you|later|cya|farewell|take\s*care)\b/.test(msg))
    return pick(responses.bye);

  // Thanks
  if (/\b(thanks|thank\s*you|thx|ty|appreciate)\b/.test(msg))
    return pick(responses.thanks);

  // Name/identity
  if (/\b(your\s*name|who\s*are\s*you|what\s*are\s*you|introduce)\b/.test(msg))
    return pick(responses.name);

  // Creator
  if (/\b(who\s*(made|built|created|developed)|your\s*creator|your\s*developer)\b/.test(msg))
    return pick(responses.creator);

  // Help
  if (/\b(help|what\s*can\s*you|capabilities|features)\b/.test(msg))
    return pick(responses.help);

  // Jokes
  if (/\b(joke|funny|laugh|humor|lol|haha)\b/.test(msg))
    return pick(responses.joke);

  // Python
  if (/\b(python|pandas|numpy|pip|django|flask|fastapi)\b/.test(msg))
    return pick(responses.python);

  // AI / ML
  if (/\b(artificial\s*intelligence|neural\s*network|deep\s*learning|llm|gpt|chatgpt|openai)\b/.test(msg))
    return pick(responses.ai);

  if (/\b(machine\s*learning|ml|scikit|tensorflow|pytorch|model|training|dataset)\b/.test(msg))
    return pick(responses.ml);

  // Cloud
  if (/\b(cloud|aws|azure|gcp|docker|kubernetes|devops|s3|lambda|ec2)\b/.test(msg))
    return pick(responses.cloud);

  // Web
  if (/\b(web|html|css|javascript|react|vue|node|frontend|backend|website)\b/.test(msg))
    return pick(responses.web);

  // Weather
  if (/\b(weather|temperature|rain|sunny|forecast|climate)\b/.test(msg))
    return pick(responses.weather);

  // Time
  if (/\b(time|clock|what\s*time)\b/.test(msg))
    return pick(responses.time);

  // Date
  if (/\b(date|today|day|month|year|calendar)\b/.test(msg))
    return pick(responses.date);

  // Math
  if (/\b(math|calculate|equation|formula|algebra|calculus|arithmetic)\b/.test(msg))
    return pick(responses.math);

  // Simple math detection
  const mathMatch = msg.match(/^[\d\s\+\-\*\/\%\^\(\)\.]+$/);
  if (mathMatch) {
    try {
      const result = eval(msg.replace(/\^/g, '**'));
      return `The answer is **${result}** 🧮`;
    } catch { /* fall through */ }
  }

  return pick(responses.default);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Render message ───────────────────────────────────────────────
function addMessage(text, sender) {
  const div = document.createElement("div");
  div.className = `msg ${sender}`;

  // Render **bold** markdown
  div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/`(.*?)`/g, '<code>$1</code>');

  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// ── Typing indicator ─────────────────────────────────────────────
function showTyping() {
  const div = document.createElement("div");
  div.className = "msg bot typing";
  div.id = "typingIndicator";
  div.innerHTML = '<span></span><span></span><span></span>';
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

// ── Send message ─────────────────────────────────────────────────
async function sendMessage(message) {
  if (!message.trim()) return;
  addMessage(message, "user");
  textInput.value = "";
  history.push({ role: "user", text: message });

  showTyping();
  sendBtn.disabled = true;

  // Simulate AI thinking delay
  await new Promise(r => setTimeout(r, 600 + Math.random() * 800));

  hideTyping();
  const reply = getResponse(message);
  addMessage(reply, "bot");
  history.push({ role: "bot", text: reply });
  speak(reply.replace(/<[^>]*>/g, '').replace(/\*\*/g, ''));
  sendBtn.disabled = false;
  status.textContent = "";
}

// ── Speech synthesis ─────────────────────────────────────────────
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1; u.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const pref = voices.find(v => v.lang === 'en-US' && v.name.includes('Female'))
             || voices.find(v => v.lang === 'en-US')
             || voices[0];
  if (pref) u.voice = pref;
  window.speechSynthesis.speak(u);
}

// ── Event listeners ──────────────────────────────────────────────
sendBtn.addEventListener("click", () => sendMessage(textInput.value));
textInput.addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(textInput.value); });

// ── Voice input ──────────────────────────────────────────────────
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null, isRecording = false;

if (SR) {
  recognizer = new SR();
  recognizer.lang = "en-US";
  recognizer.interimResults = false;

  recognizer.onresult = e => sendMessage(e.results[0][0].transcript);
  recognizer.onerror  = () => { status.textContent = "Didn't catch that — try again."; };
  recognizer.onend    = () => { isRecording = false; micBtn.classList.remove("recording"); status.textContent = ""; };
} else {
  micBtn.disabled = true;
  micBtn.title = "Voice not supported in this browser";
}

micBtn.addEventListener("click", () => {
  if (!recognizer || isRecording) return;
  isRecording = true;
  micBtn.classList.add("recording");
  status.textContent = "🎤 Listening...";
  recognizer.start();
});

// ── Welcome message ───────────────────────────────────────────────
window.addEventListener("load", () => {
  setTimeout(() => {
    addMessage("Hello! I'm **Voxify**, your AI assistant. 🤖\nType a message or click 🎤 to speak. Ask me about Python, AI, tech, or anything!", "bot");
  }, 500);
});
