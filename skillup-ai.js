/* SkillUp v29.5 — unified, compact chat. No demo chat, no lessons UI.
 * All history is owned by the authenticated Telegram user on the existing API.
 */
(()=>{
'use strict';
const API='https://skillup-api-production-3d6c.up.railway.app';
const root=document.getElementById('ai29Root');if(!root)return;
let messages=[],draft='',loaded=false,loading=false,busy=false,uploading=false,error='',pendingId='',focusId='',voiceRecorder=null,voiceChunks=[],voiceStream=null,voiceBusy=false,receiptDrafts=[],recentReceipts=[],settingsOpen=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asMoney=(n,c)=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:2}).format(n)+' '+({KGS:'сом',RUB:'₽',USD:'$',EUR:'€',KZT:'₸'}[c]||c);
const fmt=d=>{try{return new Date(d).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return ''}};
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now().toString(16).padStart(8,'0')}-0000-4000-8000-${Math.random().toString(16).slice(2,14).padEnd(12,'0')}`;
const auth=()=>{const d=window.Telegram?.WebApp?.initData;if(!d)throw Error('Открой SkillUp через Telegram-бота');return d;};
const tz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch{return 'UTC'}};
async function api(path,body,rawType,photoPrompt){
 const headers={'X-Telegram-Init-Data':auth(),'X-SkillUp-Timezone':tz()};
 if(body!==undefined){headers['Content-Type']=rawType||'application/json';if(photoPrompt)headers['X-SkillUp-Photo-Prompt']=encodeURIComponent(photoPrompt).slice(0,400);}
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),65000);
 try{
  const r=await fetch(API+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:rawType?body:JSON.stringify(body),cache:'no-store',signal:controller.signal});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.message||data.error||`HTTP ${r.status}`);return data;
 }finally{clearTimeout(timeout)}
}
async function reload({silent=false}={}){
 if(loading)return;loading=true;if(!silent){error='';render();}
 try{const [a,b,c]=await Promise.all([api('/api/v1/ai/history'),api('/api/v1/ai/receipts/pending'),api('/api/v1/ai/receipts/recent')]);messages=Array.isArray(a.messages)?a.messages:[];receiptDrafts=Array.isArray(b.drafts)?b.drafts:[];recentReceipts=Array.isArray(c.recent)?c.recent:[];loaded=true;}
 catch(e){error=e.message||'Не удалось загрузить чат';}
 finally{loading=false;render(true);}
}
function render(scroll=false){
 const oldScroll=root.querySelector('.su-chat-messages'),prev=oldScroll?oldScroll.scrollTop:null;
 const status=!window.Telegram?.WebApp?.initData?'Открыть в Telegram':voiceBusy?'Распознаю голос…':uploading?'Анализирую файл…':busy?'Пишет…':loading?'Синхронизация…':error?'Нет соединения':'В сети';
 root.innerHTML=`<div class="su-chat-shell">
  <header class="su-chat-top"><div class="su-chat-avatar" aria-hidden="true">✦</div><div class="su-chat-headline"><strong>SkillUp AI</strong><span>${esc(status)}</span></div><button class="su-chat-more" id="suMore" aria-label="Настройки чата" type="button">•••</button></header>
  ${settingsOpen?`<div class="su-chat-settings"><button type="button" id="suRefresh">↻ Обновить переписку</button>${oldMessages().length?'<button type="button" id="suImport">Перенести старую историю</button>':''}<span>История хранится в твоём аккаунте. Старые данные не удаляются.</span></div>`:''}
  <div class="su-chat-messages" id="suMessages" role="log" aria-label="Переписка со SkillUp">
  ${messages.length?messages.map(m=>`<div class="su-bubble ${m.role==='user'?'mine':'bot'}"><div>${esc(m.text)}</div><small>${m.role==='user'?'Ты':'SkillUp'} · ${esc(fmt(m.created_at))}</small></div>`).join(''):
  `<div class="su-welcome"><div class="su-welcome-icon">✦</div><strong>Привет! Я SkillUp</strong><p>Помогу с целями, финансами, расписанием и прогрессом. Напиши, продиктуй или отправь чек.</p></div>`}
  ${receiptDrafts.map(d=>receiptCard(d.id,d.payload)).join('')}
  ${recentReceipts.length?`<div class="su-undo-receipt">Последний импорт чека <button type="button" data-undo-receipt="${esc(recentReceipts[0].id)}">↶ Отменить</button></div>`:''}
  ${busy||uploading||voiceBusy?`<div class="su-typing"><span></span><span></span><span></span> ${voiceBusy?'Расшифровываю запись':uploading?'Смотрю документ':'Думаю над ответом'}</div>`:''}
  </div>
  ${error?`<div class="su-chat-error" role="alert">${esc(error)} <button type="button" id="suRetry">Повторить</button></div>`:''}
  ${!messages.length?`<div class="su-chat-pills"><button type="button" data-suggest="Какие мои цели сейчас важнее?">Мои цели</button><button type="button" data-suggest="Что у меня с прогрессом за 7 дней?">Прогресс</button><button type="button" data-suggest="Помоги составить план на неделю">План на неделю</button></div>`:''}
  <form id="suChatForm" class="su-chat-composer"><label class="su-attach" for="suFile" title="Фото, чек или PDF" aria-label="Прикрепить файл">＋</label><input id="suFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden />
  <textarea id="suInput" rows="1" maxlength="1500" placeholder="Сообщение SkillUp…" aria-label="Сообщение SkillUp" ${busy||uploading||voiceBusy?'disabled':''}>${esc(draft)}</textarea>
  <button type="button" id="suMic" class="su-mic ${voiceRecorder?'active':''}" aria-label="${voiceRecorder?'Завершить запись':'Голосовое сообщение'}" ${busy||uploading||voiceBusy?'disabled':''}>${voiceRecorder?'■':'🎙'}</button>
  <button type="submit" id="suSend" class="su-send" aria-label="Отправить сообщение" ${busy||uploading||voiceBusy||loading?'disabled':''}>↑</button>
  </form>
 </div>`;
 const stream=root.querySelector('#suMessages');if(stream){stream.scrollTop=scroll||prev===null?stream.scrollHeight:prev;}
 root.querySelector('#suMore')?.addEventListener('click',()=>{settingsOpen=!settingsOpen;render();});
 root.querySelector('#suRefresh')?.addEventListener('click',()=>void reload());
 root.querySelector('#suImport')?.addEventListener('click',()=>void importLegacy());
 root.querySelector('#suRetry')?.addEventListener('click',()=>void reload());
 root.querySelector('#suChatForm')?.addEventListener('submit',e=>{e.preventDefault();void send(root.querySelector('#suInput')?.value||'');});
 root.querySelector('#suInput')?.addEventListener('input',e=>{draft=e.target.value;pendingId='';e.target.style.height='auto';e.target.style.height=Math.min(116,e.target.scrollHeight)+'px';});
 root.querySelector('#suInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&e.pointerType!=='touch'){e.preventDefault();void send(e.target.value);}});
 root.querySelector('#suMic')?.addEventListener('click',()=>void toggleMic());
 root.querySelector('#suFile')?.addEventListener('change',e=>void sendAttachment(e.target.files?.[0]));
 root.querySelectorAll('[data-suggest]').forEach(b=>b.addEventListener('click',()=>void send(b.dataset.suggest)));
 root.querySelectorAll('[data-receipt-apply]').forEach(b=>b.addEventListener('click',()=>void applyReceipt(b.dataset.receiptApply)));
 root.querySelectorAll('[data-undo-receipt]').forEach(b=>b.addEventListener('click',()=>void undoReceipt(b.dataset.undoReceipt)));
}
function receiptCard(id,r){if(!r||!r.items)return '';
 return `<div class="su-receipt" role="group" aria-label="Распознанный чек"><div class="su-receipt-title">🧾 Чек ${r.merchant?esc(r.merchant):''}</div><div class="su-receipt-meta">${r.items.length} позиций · ${esc(asMoney(r.total,r.currency||'?'))}</div>
 ${r.items.slice(0,6).map(i=>`<div class="su-receipt-line"><span>${esc(i.name)} · ${esc(i.category)}</span><strong>${esc(asMoney(i.amount,r.currency||'?'))}</strong></div>`).join('')}${r.items.length>6?`<small>И ещё ${r.items.length-6} позиций</small>`:''}
 ${!r.currency?`<label class="su-currency">Валюта чека: <select id="suCurrency${id}" aria-label="Валюта чека"><option value="">Выбрать</option>${['KGS','RUB','USD','EUR','KZT'].map(x=>`<option>${x}</option>`).join('')}</select></label>`:''}
 <button type="button" class="su-receipt-apply" data-receipt-apply="${esc(id)}">Добавить ${r.items.length} операций в Финансы</button><small>Один раз для всего чека. При сомнениях проверь суммы перед добавлением.</small></div>`;
}
async function applyReceipt(id){
 if(busy||uploading)return;const card=receiptDrafts.find(x=>x.id===id);if(!card)return;
 const currency=card.payload.currency||root.querySelector(`#suCurrency${id}`)?.value||'';
 if(!currency){error='Выбери валюту чека';render();return;}
 busy=true;error='';render();
 try{const r=await api('/api/v1/ai/receipts/apply',{id,currency});window.skillupCloudRefresh?.();await reload({silent:true});if(typeof toast==='function')toast(`Сохранено операций: ${r.count||card.payload.items.length}. В Финансах обнови данные с сервера.`);}
 catch(e){error=e.message;}
 finally{busy=false;render(true)}
}
async function undoReceipt(id){
 if(busy||uploading)return;busy=true;error='';render();
 try{await api('/api/v1/ai/receipts/undo',{id});window.skillupCloudRefresh?.();await reload({silent:true});if(typeof toast==='function')toast('Операции по чеку отменены');}
 catch(e){error=e.message;}finally{busy=false;render(true);}
}
async function send(text){
 const message=String(text||'').trim().slice(0,1500);if(!message||busy||uploading||voiceBusy)return;
 if(!loaded){error='История пока не загрузилась. Обнови чат.';render();return;}
 busy=true;draft=message;error='';const reqId=pendingId||uid();pendingId=reqId;render(true);
 try{const result=await api('/api/v1/ai/chat',{message,requestId:reqId,focusItemId:focusId||undefined});if(result.financeSaved)window.skillupCloudRefresh?.();draft='';pendingId='';await reload({silent:true});}
 catch(e){error=e.message||'Нет ответа от сервера';try{const r=await api('/api/v1/ai/history');messages=r.messages||[];if(messages.slice(-2).some(x=>x.role==='user'&&x.text===message)){draft='';pendingId='';error='';}}catch(_){}}
 finally{busy=false;render(true);}
}
async function sendAttachment(file){
 if(!file||busy||uploading||voiceBusy)return;
 if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)){error='Можно прикреплять JPG, PNG, WebP или PDF';render();return;}
 if(file.size>6*1024*1024){error='Максимальный размер файла — 6 МБ';render();return;}
 uploading=true;error='';render(true);
 try{const result=await api('/api/v1/ai/media',await file.arrayBuffer(),file.type);if(result.autoSaved)window.skillupCloudRefresh?.();await reload({silent:true});}
 catch(e){error='Не удалось обработать вложение: '+e.message;}
 finally{uploading=false;render(true)}
}
async function toggleMic(){
 if(voiceRecorder){voiceRecorder.stop();return;}
 if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){error='Микрофон в этом Telegram WebView недоступен. Можно отправить голосовое в чат SkillUpBOT.';render();return;}
 try{
  voiceStream=await navigator.mediaDevices.getUserMedia({audio:true});
  const formats=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];const type=formats.find(x=>MediaRecorder.isTypeSupported?.(x));
  voiceRecorder=new MediaRecorder(voiceStream,type?{mimeType:type}:undefined);voiceChunks=[];
  voiceRecorder.ondataavailable=e=>{if(e.data.size)voiceChunks.push(e.data);};
  voiceRecorder.onstop=()=>void finishVoice(type);
  voiceRecorder.start();render();
  // Short voice notes keep both costs and user waiting time predictable.
  setTimeout(()=>{if(voiceRecorder?.state==='recording')voiceRecorder.stop();},60000);
 }catch(e){voiceStream?.getTracks().forEach(t=>t.stop());voiceStream=null;voiceRecorder=null;error='Telegram не дал доступ к микрофону. Попробуй голосовое сообщение в обычном чате с ботом.';render();}
}
async function finishVoice(type){
 const mime=(type||voiceChunks[0]?.type||'audio/mp4').split(';')[0];voiceRecorder=null;voiceStream?.getTracks().forEach(t=>t.stop());voiceStream=null;
 if(!voiceChunks.length){render();return;}
 voiceBusy=true;error='';render(true);
 try{const b=new Blob(voiceChunks,{type:mime});const r=await api('/api/v1/ai/transcribe',await b.arrayBuffer(),mime);draft=String(r.text||'').trim();if(!draft)throw Error('Речь не распознана');}
 catch(e){error=e.message||'Ошибка распознавания';}
 finally{voiceBusy=false;voiceChunks=[];render(true);if(draft)root.querySelector('#suInput')?.focus();}
}
function oldMessages(){try{const s=JSON.parse(localStorage.getItem('skillup_ai_workspace_v29')||'null');return Object.entries(s?.chats||{}).flatMap(([scope,list])=>(Array.isArray(list)?list:[]).map(m=>({scope,role:m.role,text:m.text,at:m.at,mode:m.mode}))).filter(m=>['user','assistant'].includes(m.role)&&typeof m.text==='string'&&m.text.trim()).sort((a,b)=>a.at-b.at).slice(-250);}catch{return []}}
async function importLegacy(){const list=oldMessages();if(!list.length||!confirm(`Перенести ${list.length} старых сообщений в общий чат? Старые записи в браузере останутся.`))return;busy=true;render();try{await api('/api/v1/ai/import-legacy',{confirmed:true,messages:list});settingsOpen=false;await reload({silent:true});}catch(e){error=e.message;}finally{busy=false;render(true)}}
window.ai29Render=()=>{if(!root.querySelector('.su-chat-shell'))render();};
window.ai29OpenItem=id=>{const item=typeof devItem==='function'?devItem(id):null;if(item){focusId=String(id);window.go('assistant');draft=`Помоги с целью «${item.title}». `;render();root.querySelector('#suInput')?.focus();}};
window.ai29OpenArea=id=>{const area=typeof devArea==='function'?devArea(id):null;if(area){focusId='';window.go('assistant');draft=`Посоветуй план для направления «${area.name}». `;render();}};
window.ai29OpenPrompt=text=>{window.go('assistant');draft=String(text||'').slice(0,1500);render();};
window.ai29Ask=text=>void send(text);window.ai29Send=text=>void send(text);window.ai29SubmitChat=e=>{e?.preventDefault?.();void send(root.querySelector('#suInput')?.value||'');};
function addCurrencySetting(){
 const profile=document.getElementById('profile');if(!profile||document.getElementById('suCurrencyPref'))return;
 const card=document.createElement('div');card.className='card';card.id='suCurrencyPref';
 card.innerHTML=`<div class="cardtitle">Основная валюта</div><p class="muted" style="font-size:11px">Если не укажешь валюту в сообщении, бот использует выбранную здесь. Другие валюты хранятся отдельно и не складываются без курса.</p><select id="suPrefSelect" class="voice-category" aria-label="Основная валюта"><option value="RUB">RUB · рубль</option><option value="KGS">KGS · сом</option><option value="USD">USD · доллар</option><option value="EUR">EUR · евро</option><option value="KZT">KZT · тенге</option></select><span id="suPrefStatus" class="muted" style="font-size:11px"></span>`;
 const cloud=profile.querySelector('#skillup-cloud-panel');if(cloud)cloud.after(card);else profile.append(card);
 const select=card.querySelector('#suPrefSelect'),label=card.querySelector('#suPrefStatus');
 async function fetchPref(){try{const a=await api('/api/v1/preferences');select.value=a.preferredCurrency||'RUB';label.textContent='';}catch(e){label.textContent='Настройка доступна после входа через Telegram.';}}
 select.addEventListener('change',async()=>{const next=select.value;label.textContent='Сохраняю…';try{await apiPut('/api/v1/preferences',{preferredCurrency:next});label.textContent='Сохранено';}catch(e){label.textContent='Не удалось сохранить: '+e.message;}});
 void fetchPref();
}
async function apiPut(path,body){const r=await fetch(API+path,{method:'PUT',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':auth()},body:JSON.stringify(body)});const a=await r.json().catch(()=>({}));if(!r.ok)throw Error(a.message||a.error||`HTTP ${r.status}`);return a;}
addCurrencySetting();
render();void reload();
})();
