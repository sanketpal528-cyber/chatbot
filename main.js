const API_BASE = "http://localhost:8000";
const SESSION_ID = "web-session-1";

const chatWindow = document.getElementById("chatWindow");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const status = document.getElementById("status");

function addMessage(text, sender) {
  const div = document.createElement("div");
  div.className = `msg ${sender}`;
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendMessage(message) {
  if (!message.trim()) return;
  addMessage(message, "user");
  textInput.value = "";
  status.textContent = "Voxify is thinking...";

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: SESSION_ID, message }),
    });
    const data = await res.json();
    addMessage(data.reply, "bot");
    speak(data.reply);
  } catch (err) {
    addMessage("Could not reach the server. Is the backend running?", "bot");
  } finally {
    status.textContent = "";
  }
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

sendBtn.addEventListener("click", () => sendMessage(textInput.value));
textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage(textInput.value);
});

// ---------- Voice input using the browser's Web Speech API ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let isRecording = false;

if (SpeechRecognition) {
  recognizer = new SpeechRecognition();
  recognizer.lang = "en-US";
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;

  recognizer.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    sendMessage(transcript);
  };

  recognizer.onerror = () => {
    status.textContent = "Didn't catch that — try again.";
  };

  recognizer.onend = () => {
    isRecording = false;
    micBtn.classList.remove("recording");
  };
} else {
  micBtn.disabled = true;
  micBtn.title = "Voice input not supported in this browser";
}

micBtn.addEventListener("click", () => {
  if (!recognizer || isRecording) return;
  isRecording = true;
  micBtn.classList.add("recording");
  status.textContent = "Listening...";
  recognizer.start();
});
