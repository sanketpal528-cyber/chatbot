const chatWindow = document.getElementById("chatWindow");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const status = document.getElementById("status");

function addMessage(text, sender) {
  const div = document.createElement("div");
  div.className = `msg ${sender}`;
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  status.textContent = isLoading ? "Thinking..." : "";
}

async function sendMessage() {
  const message = textInput.value.trim();
  if (!message) return;

  addMessage(message, "user");
  textInput.value = "";
  setLoading(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Request failed");
    }

    addMessage(data.reply, "bot");
  } catch (error) {
    addMessage(`Error: ${error.message}`, "bot");
  } finally {
    setLoading(false);
  }
}

sendBtn.addEventListener("click", sendMessage);
textInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});
