/* SkillUp v29.3 — a SINGLE AI conversation for each authenticated Telegram account.
 * Server owns conversation history and goal context. No fabricated/demo replies.
 * Previous v29 local histories are retained; migration is opt-in only.
 */
(() => {
  'use strict';
  const API='https://skillup-api-production-3d6c.up.railway.app';
  const root=document.getElementById('ai29Root');
  if(!root)return;
  let messages=[],loaded=false,loading=false,busy=false,error='',focusId='',focusName='',draft='',pendingId='';
  const esc=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  const fmt=t=>{try{return new Date(t).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return ''}};
  const timezone=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch{return 'UTC'}};
  function newId(){
    if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
    const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=bytes[6]&0x0f|0x40;bytes[8]=bytes[8]&0x3f|0x80;
    const hex=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  async function api(path,body){
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData)throw Error('Открой SkillUp через кнопку Telegram-бота. В обычном браузере история недоступна.');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),55000);
    try{
      const res=await fetch(API+path,{method:body?'POST':'GET',cache:'no-store',headers:{'X-Telegram-Init-Data':initData,'X-SkillUp-Timezone':timezone(),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
      const data=await res.json().catch(()=>({}));
      if(!res.ok){const reason=data.message||data.error||`HTTP ${res.status}`;throw Error(String(reason).slice(0,200));}
      return data;
    }finally{clearTimeout(timer);}
  }
  async function load(){
    if(loading)return;loading=true;error='';render();
    try{const data=await api('/api/v1/ai/history');messages=Array.isArray(data.messages)?data.messages:[];loaded=true;}
    catch(e){error=e.message||'История недоступна';}
    finally{loading=false;render();}
  }
  function localOld(){
    try{
      const state=JSON.parse(localStorage.getItem('skillup_ai_workspace_v29')||'null');
      if(!state?.chats)return [];
      return Object.entries(state.chats).flatMap(([scope,rows])=>Array.isArray(rows)?rows.map(m=>({scope,role:m.role,text:m.text,at:Number(m.at)||Date.now(),mode:m.mode})):[])
        .filter(x=>['user','assistant'].includes(x.role)&&typeof x.text==='string'&&x.text.trim())
        .sort((a,b)=>a.at-b.at).slice(-250).map(x=>({scope:String(x.scope).slice(0,100),role:x.role,text:String(x.text).slice(0,2800),at:x.at,mode:x.mode}));
    }catch{return []}
  }
  function oldNoteCount(){try{const o=JSON.parse(localStorage.getItem('skillup_ai_workspace_v29')||'null');return Object.values(o?.notes||{}).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0)}catch{return 0}}
  function render(){
    const goals=typeof devState!=='undefined'&&Array.isArray(devState.items)?devState.items:[];
    const counts=['goal','skill','habit'].map(t=>goals.filter(i=>i.kind===t).length);
    const legacy=localOld();
    const status=!window.Telegram?.WebApp?.initData?'Нужен вход через Telegram':busy?'Готовлю ответ…':loading?'Загружаю…':error?'Нет соединения':'Общая история в PostgreSQL';
    root.innerHTML=`<div class="ai29-screen ai3-screen">
      <section class="ai29-hero"><div class="ai29-hero-top"><span class="ai29-kicker">Твой менеджер развития</span><span class="ai29-demo">${esc(status)}</span></div>
        <h2>Один помощник. Весь твой прогресс.</h2>
        <p>Ставь цели, получай понятные этапы, подсказки и отчёты. Учебные материалы изучай там, где тебе удобно — SkillUp помогает держать курс.</p>
      </section>
      <section class="ai29-context"><h3 class="ai29-context-title">Твой маршрут</h3>
        <div class="ai29-summary-mini"><div><b>${counts[0]}</b><small>целей</small></div><div><b>${counts[1]}</b><small>навыков</small></div><div><b>${counts[2]}</b><small>привычек</small></div></div>
        ${focusId?`<div class="ai3-focus">Сейчас обсуждаем: <strong>${esc(focusName)}</strong><button id="ai3ClearFocus" type="button">✕</button></div>`:''}
        <div class="ai29-quick-row"><button class="ai29-action ai29-action-main" type="button" data-ai-prompt="Составь краткий отчёт по моим выполненным действиям за 7 дней. Опирайся на реальные отметки.">Отчёт за 7 дней</button><button class="ai29-action" type="button" data-ai-prompt="Проанализируй мои действия за 30 дней и подскажи, что изменить для более стабильного прогресса.">Итоги 30 дней</button></div>
      </section>
      <section class="ai29-chat"><div class="ai29-chat-heading"><span>Разговор со SkillUp</span><span class="ai29-chat-count">${messages.length} последних сообщений · один чат</span></div>
        <div id="ai3History" class="ai29-chat-stream ai3-history" role="log" aria-label="Общая история переписки" aria-live="polite">
        ${messages.length?messages.map(m=>`<div class="ai29-message ${m.role==='user'?'user':'assistant'}">${esc(m.text)}<small>${m.role==='user'?'Ты':'SkillUp AI'} · ${esc(fmt(m.created_at))}</small></div>`).join(''):
          `<div class="ai29-empty-chat">${loading?'Загружаю историю…':error?'Не удалось загрузить переписку. Сообщения на сервере не изменены.':'Привет! Опиши цель или попроси отчёт. Я предложу конкретные шаги, а не полноценные уроки.'}</div>`}
        </div>
        <div class="ai29-prompts"><button type="button" data-ai-prompt="Помоги разбить мою новую цель на понятные этапы и регулярные действия. Сначала задай нужные вопросы.">Разбить цель на этапы</button><button type="button" data-ai-prompt="Что мне стоит сделать сегодня, исходя из моих целей и расписания?">Что сегодня?</button><button type="button" data-ai-prompt="Предложи полезные внешние ресурсы и поисковые запросы для самостоятельного изучения моих тем.">Где изучать?</button></div>
        <form id="ai3Form" class="ai29-form"><textarea id="ai3Input" rows="2" maxlength="1500" aria-label="Сообщение ИИ" placeholder="Расскажи цель, попроси подсказку или отчёт…" ${busy?'disabled':''}>${esc(draft)}</textarea><button id="ai3Send" type="submit" aria-label="Отправить" ${busy||loading?'disabled':''}>${busy?'…':'↑'}</button></form>
        ${error?`<p class="ai3-error" role="alert">${esc(error)} <button id="ai3Retry" type="button">Повторить</button></p>`:''}
        <p class="ai29-small-muted">Ответы генерирует ИИ на сервере. Он использует реальные цели и отметки из PostgreSQL, но не меняет твой план без согласования. Финансы в этот чат не передаются.</p>
      </section>
      <section class="ai29-notebook ai3-legacy"><strong>Предыдущая версия</strong><p class="ai29-small-muted">${legacy.length?`${legacy.length} старых сообщений и ${oldNoteCount()} заметок остались в браузере. Можно перенести сообщения в общий чат по желанию.`:`Старые переписки и заметки не удаляются. Если они есть в этом браузере, их можно сохранить через резервную копию в Профиле.`}</p>
      ${legacy.length?`<button id="ai3Import" type="button" class="ai29-action" ${busy?'disabled':''}>Перенести старую переписку (с подтверждением)</button>`:''}
      <button id="ai3Reload" type="button" class="ai29-action">↻ Обновить историю</button></section>
      <p class="ai29-status-note">История привязана к Telegram-аккаунту. Для резервной копии открой Профиль → Синхронизация.</p>
    </div>`;
    root.querySelectorAll('[data-ai-prompt]').forEach(b=>b.addEventListener('click',()=>void send(b.dataset.aiPrompt)));
    root.querySelector('#ai3Form')?.addEventListener('submit',e=>{e.preventDefault();void send(root.querySelector('#ai3Input')?.value||'');});
    root.querySelector('#ai3Input')?.addEventListener('input',e=>{draft=e.target.value;pendingId='';});
    root.querySelector('#ai3Input')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send(e.target.value)}});
    root.querySelector('#ai3Reload')?.addEventListener('click',()=>void load());
    root.querySelector('#ai3Retry')?.addEventListener('click',()=>void load());
    root.querySelector('#ai3ClearFocus')?.addEventListener('click',()=>{focusId='';focusName='';render();});
    root.querySelector('#ai3Import')?.addEventListener('click',()=>void importLegacy());
    const stream=root.querySelector('#ai3History');if(stream)stream.scrollTop=stream.scrollHeight;
  }
  async function send(text){
    const message=String(text||'').trim().slice(0,1500);if(!message||busy||loading)return;
    if(!loaded){error='История ещё не загружена. Нажми «Обновить историю».';render();return;}
    busy=true;error='';draft=message;const requestId=pendingId||newId();pendingId=requestId;render();
    try{
      await api('/api/v1/ai/chat',{message,requestId,focusItemId:focusId||undefined});
      draft='';pendingId='';
      const data=await api('/api/v1/ai/history');messages=data.messages||[];
    }catch(e){error=e.message||'Ошибка сети';
      // A dropped response may still have been committed. Reload to avoid duplicate messages.
      try{const data=await api('/api/v1/ai/history');messages=data.messages||[];
        const last=messages.at(-2);const last2=messages.at(-1);
        if(last?.role==='user'&&last?.text===message&&last2?.role==='assistant'){draft='';pendingId='';error='';}
      }catch(_){}
    }finally{busy=false;render();}
  }
  async function importLegacy(){
    if(busy)return;const old=localOld();if(!old.length)return;
    const ans=confirm(`Найдено ${old.length} сообщений из старых отдельных чатов. Импортировать их в одну общую историю PostgreSQL?\n\nСтарые сообщения могли содержать демонстрационные ответы. Заметки и файлы локально останутся без изменений. Убедись, что сообщения действительно принадлежат твоему Telegram-аккаунту.`);
    if(!ans)return;
    busy=true;render();
    try{const data=await api('/api/v1/ai/import-legacy',{confirmed:true,messages:old});draft='';pendingId='';await load();toast(`Импортировано сообщений: ${data.imported}`);}
    catch(e){error='Не удалось импортировать: '+e.message;}
    finally{busy=false;render();}
  }
  window.ai29Render=render;
  window.ai29OpenItem=id=>{const item=typeof devItem==='function'?devItem(id):null;if(item){focusId=String(id);focusName=item.title;go('assistant');render();}};
  window.ai29OpenArea=id=>{const area=typeof devArea==='function'?devArea(id):null;if(area){focusId='';focusName='';go('assistant');draft=`Хочу обсудить направление «${area.name}». `;render();}};
  window.ai29OpenPrompt=message=>{go('assistant');draft=String(message||'').slice(0,1500);render();};
  window.ai29Ask=message=>void send(message);
  window.ai29Send=message=>void send(message);
  window.ai29SubmitChat=e=>{e?.preventDefault?.();void send(root.querySelector('#ai3Input')?.value||'');};
  render();void load();
})();
