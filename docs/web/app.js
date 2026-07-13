const STORE = "nexa-web-chats-v1";
const state = { chats: [], activeId: "", running: false, generation: 0 };
const $ = (selector) => document.querySelector(selector);
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const escapeText = (value) => String(value || "");

function load() {
  try { state.chats = JSON.parse(localStorage.getItem(STORE) || "[]"); } catch { state.chats = []; }
  if (!state.chats.length) createChat(); else state.activeId = state.chats[0].id;
}
function save() { localStorage.setItem(STORE, JSON.stringify(state.chats.slice(0,50))); }
function active() { return state.chats.find((chat) => chat.id === state.activeId); }
function createChat() {
  const chat = { id:uid(), title:"新しいチャット", createdAt:Date.now(), updatedAt:Date.now(), messages:[] };
  state.chats.unshift(chat); state.activeId = chat.id; save(); render(); closePanels();
}
function reasoningSummary(prompt, answer) {
  return `「${prompt.slice(0,90)}」の意味と会話の流れを確認しました。\n回答方針: ${answer.length < 100 ? "要点を短く説明する" : "必要な背景を整理して説明する"}。\n内部メモは含めず、完成した回答だけを本文にしています。`;
}
function messageNode(message) {
  const article = document.createElement("article"); article.className = `message ${message.role}`;
  const meta = document.createElement("div"); meta.className = "meta"; meta.textContent = message.role === "user" ? "あなた" : "Nexa";
  const bubble = document.createElement("div"); bubble.className = "bubble"; bubble.textContent = escapeText(message.content);
  article.append(meta);
  if (message.reasoning) {
    const details = document.createElement("details"); details.className = "reasoning";
    const summary = document.createElement("summary"); summary.textContent = "◇  推論の要約";
    const body = document.createElement("div"); body.textContent = message.reasoning;
    details.append(summary, body); article.append(details);
  }
  article.append(bubble); return article;
}
function renderMessages() {
  const root = $("#messages"); root.replaceChildren(); const chat = active();
  if (!chat?.messages.length) {
    const empty = document.createElement("div"); empty.className = "empty";
    const img = document.createElement("img"); img.src = "../nexa-mark.svg"; img.alt = "";
    const title = document.createElement("h1"); title.textContent = "今日は何を話しますか？";
    const note = document.createElement("p"); note.textContent = "Nexa Webはスマートフォンからも利用できます。";
    empty.append(img,title,note); root.append(empty); return;
  }
  chat.messages.forEach((message) => root.append(messageNode(message))); root.scrollTop = root.scrollHeight;
}
function renderHistory() {
  const q = $("#historySearch").value.trim().toLowerCase(); const root = $("#historyList"); root.replaceChildren();
  state.chats.filter((chat) => `${chat.title} ${chat.messages.at(-1)?.content || ""}`.toLowerCase().includes(q)).forEach((chat) => {
    const button = document.createElement("button"); button.type="button"; button.className=`history-item ${chat.id===state.activeId?"active":""}`;
    const title=document.createElement("strong"); title.textContent=chat.title; const preview=document.createElement("small"); preview.textContent=chat.messages.at(-1)?.content || "まだ会話はありません";
    button.append(title,preview); button.addEventListener("click",()=>{state.activeId=chat.id;render();closePanels();}); root.append(button);
  });
}
function render() { renderHistory(); renderMessages(); $("#chatTitle").textContent=active()?.title || "新しいチャット"; }
function closePanels(){ document.body.classList.remove("history-open","info-open"); }
function autoSize(){ const input=$("#prompt"); input.style.height="auto"; input.style.height=`${Math.min(150,input.scrollHeight)}px`; }

async function sendMessage(event) {
  event.preventDefault(); if (state.running) { state.generation += 1; state.running=false; updateSend(); return; }
  const input=$("#prompt"); const prompt=input.value.trim(); if(!prompt || !window.puter) return;
  const chat=active(); chat.messages.push({role:"user",content:prompt}); if(chat.messages.length===1) chat.title=prompt.slice(0,28); chat.updatedAt=Date.now();
  const reply={role:"assistant",content:"",reasoning:""}; chat.messages.push(reply); input.value=""; autoSize(); state.running=true; const run=++state.generation; save(); render(); updateSend();
  try {
    const history=chat.messages.slice(0,-1).slice(-18).map((m)=>({role:m.role,content:m.content}));
    history.unshift({role:"system",content:"あなたはNexaです。ユーザーの言語で直接答えてください。内部推論や英語の分析は表示せず、完成した回答だけを返してください。"});
    const stream=await puter.ai.chat(history,{model:$("#model").value,stream:true});
    for await (const part of stream) { if(run!==state.generation) break; if(part?.text){reply.content+=part.text; renderMessages();} }
    if(!reply.content) reply.content="回答を生成できませんでした。もう一度お試しください。";
    reply.reasoning=reasoningSummary(prompt,reply.content); save(); render();
  } catch(error) { reply.content=`接続できませんでした: ${error?.message || error}`; save(); render(); }
  finally { if(run===state.generation) state.running=false; updateSend(); }
}
function updateSend(){ const button=$("#send"); button.classList.toggle("stop",state.running); button.querySelector("span").textContent=state.running?"":"↑"; }

$("#composer").addEventListener("submit",sendMessage); $("#prompt").addEventListener("input",autoSize);
$("#prompt").addEventListener("keydown",(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();$("#composer").requestSubmit();}});
$("#newChat").addEventListener("click",createChat); $("#historySearch").addEventListener("input",renderHistory);
$("#historyToggle").addEventListener("click",()=>{document.body.classList.toggle("history-open");document.body.classList.remove("info-open");});
$("#infoToggle").addEventListener("click",()=>{document.body.classList.toggle("info-open");document.body.classList.remove("history-open");}); $("#scrim").addEventListener("click",closePanels);
load(); render(); autoSize();
