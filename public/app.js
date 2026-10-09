const sampleChat = `09:12 Maya: Morning team! Quick update — the lab demo has moved to 2:30 PM today.
09:14 Arjun: Wait, I thought it was at 4 PM?
09:15 Maya: Prof changed it in the announcement. 2:30 sharp.
09:18 Riya: I'll update the slides and send the final deck before 1 PM.
09:20 You: I can handle the prototype UI.
09:22 Arjun: Great. We agreed to use the local-first approach, right?
09:23 Maya: Yes, final decision: local-first demo, cloud fallback only if needed.
09:27 Sam: Can someone send me the circuit diagram before 2 PM? I need it for the lab setup.
09:31 Riya: I can send it after I finish the slides.
09:42 You: Got it, I'll finish the dashboard screen by 12:30.
10:02 Maya: Reminder: submission form closes tomorrow at 10 AM. Please don't forget.
10:15 Arjun: Lunch after the demo? 😄
10:17 Sam: I'm in.
10:24 Riya: Final slides are ready. Uploaded to the drive.
10:27 Maya: Thanks! Decision: Arjun will handle backend integration; I'll own the final presentation.
10:35 Sam: The circuit diagram is still pending — please send it when ready.
10:42 You: I'll review the UI with Maya at 12:45.
10:48 Arjun: Small correction, the review is 1 PM, not 12:45.
10:49 Maya: Confirmed: UI review at 1 PM.
10:54 Sam: meme.jpg 😂
11:02 Riya: Circuit diagram sent to Sam.
11:10 Maya: Reminder to everyone: lab demo is 2:30 PM, meet outside the lab at 2:15.`;
const sampleDecisions = [
 {title:"Local-first demo confirmed",detail:"The team agreed to prioritize local-first processing, with cloud fallback only if needed.",source:"09:23 Maya · Project Group",kind:"Decision"},
 {title:"Ownership clarified",detail:"Arjun owns backend integration, Maya owns the final presentation, and you are handling the prototype UI.",source:"10:27 Maya · Project Group",kind:"Ownership"},
 {title:"Lab demo time changed",detail:"The final confirmed demo time is 2:30 PM. Meet outside the lab at 2:15 PM.",source:"11:10 Maya · Project Group",kind:"Schedule update"}
];
let state = {items:[], decisions:[], topics:[], recap:"", source:"", view:"briefing", filter:"all", sourceOpen:-1};
const $ = id => document.getElementById(id);
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function localAnalyze(text){
 const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
 const decisions=[],items=[],topics={};
 const deadlineRe=/\b(today|tomorrow|tonight|by\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|before\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i;
 const actionRe=/\b(please|need|needs|can someone|could someone|send|submit|finish|complete|review|upload|prepare|reminder|don't forget|do not forget|must|deadline|due|assigned|i can|i'll|i will|we agreed|final decision|confirmed|decided|moved to|changed to)\b/i;
 const decisionRe=/\b(we agreed|final decision|decided|confirmed|agreed to|ownership|will handle|is now|moved to|changed to|uploaded|sent to)\b/i;
 for(let i=0;i<lines.length;i++){
  const line=lines[i], clean=line.replace(/^\[?\d{1,2}:\d{2}(?:\s*[AP]M)?\]?\s*/i,""), who=(clean.match(/^([^:]{1,30}):/)||[])[1]||"Conversation";
  const body=clean.includes(":")?clean.slice(clean.indexOf(":")+1).trim():clean;
  const hasDeadline=deadlineRe.test(body), action=actionRe.test(body), decision=decisionRe.test(body);
  if(decision && decisions.length<8) decisions.push({title:shortTitle(body),detail:body,source:line,kind:/moved|changed|time|schedule/i.test(body)?"Schedule update":"Decision"});
  if(action && !/lunch|meme|😂|😄/i.test(body)){
   let score=0.35+(hasDeadline?0.28:0)+( /please|need|deadline|reminder|don't forget|do not forget|must/i.test(body)?0.18:0)+( /you:|your|you to|can someone/i.test(body)?0.1:0);
   const urgent=hasDeadline||/deadline|before|reminder|don't forget|do not forget/i.test(body);
   const alreadyDone=/\b(sent|uploaded|finished|ready|completed|done)\b/i.test(body)&&!/still pending/i.test(body);
   if(alreadyDone && !/decision|confirmed|moved|changed/i.test(body)) continue;
   items.push({id:"task-"+i,title:shortTitle(body),detail:body,source:line,sender:who,deadline:(body.match(deadlineRe)||[])[0]||"No deadline stated",score:Math.min(.99,score),priority:urgent?"Urgent":"Action",done:false});
  }
  const words=body.toLowerCase().match(/[a-z]{4,}/g)||[];
  for(const w of words){if(!["please","someone","before","after","there","their","about","today","tomorrow","could","would","final","quick","update","thanks","everyone","still","when","ready","need","will","from","with","this","that","have","your","what","just","team"].includes(w))topics[w]=(topics[w]||0)+1;}
 }
 const unique=new Map(); decisions.forEach(d=>{const k=d.title.toLowerCase();if(!unique.has(k))unique.set(k,d);});
 let sorted=items.sort((a,b)=>b.score-a.score).slice(0,8);
 if(!sorted.length) sorted=[{id:"empty-task",title:"Review the conversation",detail:"No clear action items were confidently detected. Scan the source messages for anything you want to follow up on.",source:lines[0]||"No source message",sender:"CatchUp AI",deadline:"When convenient",score:.3,priority:"Review",done:false}];
 const topicList=Object.entries(topics).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([name,count])=>({name:name.charAt(0).toUpperCase()+name.slice(1),count:Math.min(12,count+1)}));
 return {items:sorted,decisions:[...unique.values()].slice(0,6),topics:topicList,recap:sorted.slice(0,3).map(x=>x.detail).join(" ")||"No major action items were confidently detected.",source:text,mode:"local"};
}
function shortTitle(s){s=s.replace(/^[^:]{1,30}:/,"").trim().replace(/[.!?]+$/,"");return s.length>66?s.slice(0,63)+"…":s;}
function normalizeAI(data,text){
 if(!data||!Array.isArray(data.items)) throw new Error("Unexpected AI response");
 return {items:data.items.map((x,i)=>({id:"ai-"+i,title:String(x.title||"Review message"),detail:String(x.detail||x.title||""),source:String(x.source||""),sender:String(x.sender||"Conversation"),deadline:String(x.deadline||"Not stated"),score:Math.max(0,Math.min(1,Number(x.score)||.5)),priority:String(x.priority||"Action"),done:false})),decisions:Array.isArray(data.decisions)?data.decisions.map(x=>({title:String(x.title||"Decision"),detail:String(x.detail||""),source:String(x.source||""),kind:String(x.kind||"Decision")})):[],topics:Array.isArray(data.topics)?data.topics:[],recap:String(data.recap||"Your conversation has been summarized."),source:text,mode:"ai"};
}
async function analyze(text){
 const fallback=localAnalyze(text);
 try{
  const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});
  if(!res.ok) throw new Error("AI unavailable");
  const data=await res.json();
  if(data&&data.result) return normalizeAI(data.result,text);
 }catch(e){console.info("Using browser-side fallback:",e.message);}
 return fallback;
}
function renderPriority(item,index){
 const icon=item.done?"✓":(item.priority==="Urgent"?"!":item.priority==="Review"?"?":"↗");
 const cls=item.done?"completed":"";
 const tagCls=item.priority==="Urgent"?"urgent":item.priority==="Review"?"normal":(item.deadline&&item.deadline!=="No deadline stated"&&item.deadline!=="Not stated"?"today":"normal");
 return `<article class="priority-card ${cls}"><div class="priority-icon ${item.priority==="Urgent"?"urgent":item.priority==="Review"?"info":"task"}">${icon}</div><div class="priority-main"><div class="card-topline"><span class="tag ${tagCls}">${escapeHtml(item.done?"Completed":item.priority)}</span><span class="tag normal">${escapeHtml(item.sender||"Conversation")}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p><button class="source-link" data-source="${index}">↳ View source message <span>· ${escapeHtml(item.source.length>46?item.source.slice(0,46)+"…":item.source)}</span></button><div class="source-expanded hidden" id="source-${index}">${escapeHtml(item.source||"No source message available.")}</div></div><div class="priority-side"><span class="deadline">${escapeHtml(item.deadline)}</span><button class="check-btn ${item.done?"done":""}" data-task="${escapeHtml(item.id)}" title="${item.done?"Mark incomplete":"Mark complete"}">${item.done?"✓":""}</button></div></article>`;
}
function renderDecision(d){return `<article class="decision-card"><div class="decision-symbol">${d.kind==="Ownership"?"♧":d.kind==="Schedule update"?"◷":"◈"}</div><div><h3>${escapeHtml(d.title)}</h3><p>${escapeHtml(d.detail)}</p><div class="decision-source">↳ ${escapeHtml(d.source||"Source message")}</div></div></article>`;}
function render(){
 const open=state.items.filter(x=>!x.done).length,urgent=state.items.filter(x=>!x.done&&x.priority==="Urgent").length;
 $("nav-task-count").textContent=open;$("stat-priority").textContent=urgent||open;$("stat-decisions").textContent=state.decisions.length;
 $("metric-priority").innerHTML=String(urgent||open).padStart(2,"0")+' <small>items</small>';$("metric-decisions").innerHTML=String(state.decisions.length).padStart(2,"0")+' <small>decisions</small>';$("metric-tasks").innerHTML=String(open).padStart(2,"0")+' <small>to-dos</small>';
 $("urgent-count").textContent=urgent||open;$("metric-noise").innerHTML=state.source.length>100?"Filtered <small>signal found</small>":"Low <small>signal found</small>";
 $("priority-list").innerHTML=state.items.slice(0,4).map(renderPriority).join("");$("all-task-list").innerHTML=state.items.filter(x=>state.filter==="all"||(state.filter==="open"&&!x.done)||(state.filter==="done"&&x.done)).map(renderPriority).join("")||'<div class="empty-state">No tasks in this view yet.</div>';
 $("decision-list").innerHTML=state.decisions.slice(0,3).map(renderDecision).join("")||'<div class="empty-state">No decisions detected yet.</div>';$("all-decision-list").innerHTML=state.decisions.map(renderDecision).join("")||'<div class="empty-state">No decisions detected yet.</div>';
 $("topic-list").innerHTML=state.topics.map(t=>`<div class="topic-row"><i class="topic-dot"></i><span>${escapeHtml(t.name)}</span><span>${escapeHtml(t.count)} mentions</span></div>`).join("")||'<div class="topic-row"><i class="topic-dot"></i><span>General conversation</span><span>—</span></div>';
 $("quick-recap").textContent=state.recap;$("hero-summary").textContent=state.items.length+" action signals surfaced from your conversation. Review the source before acting on anything uncertain.";
 $("hero-title").innerHTML=state.items.length?"Your day, <em>back in focus.</em>":"Your day, <em>back in focus.</em>";$("stat-noise").textContent=state.source?Math.min(91,Math.max(42,Math.round(100-(state.items.length/state.source.split(/\n/).filter(Boolean).length)*100)))+"%":"—";
 document.querySelectorAll("[data-source]").forEach(b=>b.addEventListener("click",()=>{const el=$("source-"+b.dataset.source);if(el)el.classList.toggle("hidden")}));
 document.querySelectorAll("[data-task]").forEach(b=>b.addEventListener("click",()=>{const item=state.items.find(x=>x.id===b.dataset.task);if(item){item.done=!item.done;render();}}));
}
function setView(view){
 state.view=view;["briefing","tasks","decisions"].forEach(v=>$(v+"-view").classList.toggle("hidden",v!==view));
 $("page-title").innerHTML=view==="tasks"?'Your next steps. <em>One thing at a time.</em>':view==="decisions"?'Stay aligned. <em>Know what changed.</em>':'Welcome back. <em>Here\'s what matters.</em>';
 $("page-subtitle").textContent=view==="tasks"?"Every extracted action, ready to track.":view==="decisions"?"A clear record of what your conversations decided.":"A calmer way to catch up on the conversations you missed.";
 $("crumb").textContent=view==="tasks"?"My action items":view==="decisions"?"Decisions":"Catch-up briefing";
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
}
function loadData(data){state.items=data.items;state.decisions=data.decisions;state.topics=data.topics;state.recap=data.recap;state.source=data.source;render();setView("briefing");$("import-panel").classList.add("hidden");$("hero-title").innerHTML='Your day, <em>back in focus.</em>';}
$("load-sample").addEventListener("click",async()=>{state=Object.assign(state,localAnalyze(sampleChat));render();setView("briefing");$("hero-title").innerHTML='Your day, <em>back in focus.</em>';});
$("toggle-import").addEventListener("click",()=>{$("import-panel").classList.toggle("hidden");$("conversation-input").focus()});
$("close-import").addEventListener("click",()=>$("import-panel").classList.add("hidden"));
$("clear-input").addEventListener("click",()=>{$("conversation-input").value="";$("char-count").textContent="0 characters";});
$("conversation-input").addEventListener("input",()=>{$("char-count").textContent=$("conversation-input").value.length.toLocaleString()+" characters";});
$("analyze-btn").addEventListener("click",async()=>{const text=$("conversation-input").value.trim();if(!text){$("conversation-input").focus();return;}if(text.length>50000){alert("Please keep the demo import under 50,000 characters.");return;}const btn=$("analyze-btn");btn.disabled=true;btn.textContent="Analyzing…";try{loadData(await analyze(text));}finally{btn.disabled=false;btn.innerHTML='Generate briefing <span>→</span>';}});
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
document.querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{state.filter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));render();}));
$("copy-recap").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(state.recap);$("copy-recap").innerHTML="Copied ✓";setTimeout(()=>{$("copy-recap").innerHTML='Copy recap <span>↗</span>'},1500);}catch(e){alert(state.recap);}});
$("reset-btn").addEventListener("click",()=>{state=Object.assign(state,localAnalyze(sampleChat));$("conversation-input").value="";render();setView("briefing");});
state=Object.assign(state,localAnalyze(sampleChat));render();setView("briefing");