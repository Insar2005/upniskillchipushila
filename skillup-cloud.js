/* SkillUp v29.2 - cautious, consent-based PostgreSQL document sync.
 * This is a stage-one bridge: development + user-entered finances only.
 * Never submit Telegram secrets to another origin; NEVER upload demo datasets.
 */
(() => {
  'use strict';
  const API = 'https://skillup-api-production-3d6c.up.railway.app';
  const KEYS = {
    development: 'skillup_development_v16',
    finances: 'skillup_finance_operations_v11',
    savings: 'skillup_finance_user_goal_v29_2',
    demo: 'skillup_finance_demo_pack_v18'
  };
  const LAST_OWNER = 'skillup_cloud_last_owner_v1';
  const EMPTY_DEV = () => ({areas:[],items:[],version:29});
  const EMPTY_FIN = () => ({entries:[],savingsGoal:null});
  let userId = null;
  let active = false;
  let configured = false;
  let revisions = {development:null,finances:null};
  let remote = {development:null,finances:null};
  let pending = new Set();
  let sending = new Set();
  let running = false;
  let paused = false;
  let retryTimer = null;
  let panel, status, details, actions, badge;
  const stateKey = () => 'skillup_cloud_state_v1_' + userId;
  const dirtyKey = () => 'skillup_cloud_dirty_v1_' + userId;
  const hasDemo = () => !!localStorage.getItem(KEYS.demo);
  function localDevelopment() {return (typeof devState !== 'undefined' && devState) || EMPTY_DEV();}
  function localFinances() {return {entries: (typeof financeSavedEntries !== 'undefined' && Array.isArray(financeSavedEntries)) ? financeSavedEntries : [], savingsGoal: hasDemo()?null:((typeof financeGoal !== 'undefined')?financeGoal:null)};}
  const localSnapshot = kind => kind === 'development' ? localDevelopment() : localFinances();
  const hasDevelopment = d => Array.isArray(d?.areas) && Array.isArray(d?.items);
  const hasFinances = f => Array.isArray(f?.entries) && (f.savingsGoal == null || (typeof f.savingsGoal === 'object' && !Array.isArray(f.savingsGoal)));
  const valid = (kind, payload) => kind === 'development' ? hasDevelopment(payload) : hasFinances(payload);
  function safeParse(raw,fallback){try{return raw===null?fallback:JSON.parse(raw)}catch{return fallback}}
  function readDirty(){try{const k=JSON.parse(localStorage.getItem(dirtyKey())||'[]');return new Set(Array.isArray(k)?k.filter(x=>x==='development'||x==='finances'):[])}catch{return new Set();}}
  function persistDirty(){if(userId)localStorage.setItem(dirtyKey(),JSON.stringify([...pending]));}
  function statusText(title,message){if(status)status.textContent=title;if(details)details.textContent=message;}
  function buttons(spec){if(!actions)return;actions.replaceChildren();spec.forEach(([label,fn,primary])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.className=primary?'primary':'secondary';b.style.cssText='width:100%;margin-top:7px;padding:12px;font-size:13px';b.onclick=fn;actions.append(b);});}
  function markBadge(text){if(badge)badge.textContent=text;}
  function backup(reason){
    const keys=[KEYS.development,KEYS.finances,KEYS.savings,KEYS.demo,'skillup_finance_demo_goal_v18','skillup-v22-progress-history','skillup_ai_workspace_v29'];
    const entries=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
    const key='skillup_cloud_backup_'+Date.now()+'_'+reason;
    localStorage.setItem(key,JSON.stringify({createdAt:new Date().toISOString(),reason,entries}));
    return key;
  }
  function showBackupCopyFallback(json, fileName){
    // A last-resort export for restricted Telegram iOS WebViews: no data upload.
    const existing=document.getElementById('skillup-backup-fallback');
    if(existing)existing.remove();
    const overlay=document.createElement('div');
    overlay.id='skillup-backup-fallback';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Резервная копия SkillUp');
    overlay.style.cssText='position:fixed;inset:0;z-index:1000000;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:15px';
    const box=document.createElement('div');
    box.style.cssText='width:min(100%,480px);max-height:87vh;overflow:auto;background:#15231b;border:1px solid #3b7654;border-radius:20px;padding:20px;color:#effff4;font:14px/1.5 system-ui,sans-serif';
    const title=document.createElement('h3');
    title.textContent='Резервная копия SkillUp';
    title.style.cssText='font-size:20px;margin:0 0 8px';
    const message=document.createElement('p');
    message.textContent='Telegram на этом устройстве не поддержал сохранение JSON-файла. Скопируй данные ниже в Заметки или текстовый редактор и сохрани под именем '+fileName+'. В копии есть личные данные: не отправляй её посторонним.';
    message.style.cssText='opacity:.85;margin:0 0 12px';
    const area=document.createElement('textarea');
    area.value=json;
    area.readOnly=true;
    area.setAttribute('aria-label','JSON резервной копии');
    area.style.cssText='box-sizing:border-box;width:100%;height:160px;background:#08130e;color:#c3efd1;border:1px solid #3b7654;border-radius:10px;padding:9px;font:11px/1.35 monospace';
    const info=document.createElement('p');
    info.style.cssText='font-size:12px;opacity:.8;min-height:18px';
    const buttons=document.createElement('div');
    buttons.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
    function makeButton(text,handler){
      const b=document.createElement('button');b.type='button';b.textContent=text;
      b.style.cssText='flex:1;min-width:115px;background:#214c35;border:1px solid #548c69;border-radius:11px;color:#e7fff0;padding:12px;font-weight:700';
      b.addEventListener('click',handler);return b;
    }
    const selectText=()=>{area.focus();area.select();area.setSelectionRange(0,area.value.length);};
    buttons.append(
      makeButton('Скопировать JSON',async()=>{
        try{
          if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(json);
          info.textContent='Скопировано. Сохрани содержимое как '+fileName;
        }catch(e){
          selectText();
          try{if(document.execCommand?.('copy')){info.textContent='Скопировано. Сохрани содержимое как '+fileName;return;}}catch(_){}
          info.textContent='Текст выделен. Нажми «Копировать» в меню iPhone.';
        }
      }),
      makeButton('Выделить текст',()=>{selectText();info.textContent='Теперь выбери «Копировать» в меню iPhone.';}),
      makeButton('Закрыть',()=>overlay.remove())
    );
    box.append(title,message,area,info,buttons);overlay.append(box);document.body.append(overlay);
  }
  async function downloadLocalExport(){
    const keys=[KEYS.development,KEYS.finances,KEYS.savings,KEYS.demo,'skillup_finance_demo_goal_v18','skillup-v22-progress-history','skillup_ai_workspace_v29'];
    const entries=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
    const json=JSON.stringify({format:'skillup-local-backup-v1',createdAt:new Date().toISOString(),entries},null,2);
    const fileName='skillup-local-backup-'+new Date().toISOString().slice(0,10)+'.json';
    const telegramIOS=window.Telegram?.WebApp?.platform==='ios';

    // Web Share transfers a local File to the OS share sheet, not to our API.
    // On iPhone: choose "Save to Files" from the share sheet.
    if(typeof File==='function' && typeof navigator.share==='function' && typeof navigator.canShare==='function'){
      const file=new File([json],fileName,{type:'application/json'});
      let canShare=false;
      try{canShare=navigator.canShare({files:[file]});}catch(e){}
      if(canShare){
        try{await navigator.share({files:[file],title:'Резервная копия SkillUp'});return;}
        catch(e){
          if(e?.name==='AbortError')return; // User cancelled the share sheet.
          if(telegramIOS){showBackupCopyFallback(json,fileName);return;}
        }
      }
    }
    if(telegramIOS){showBackupCopyFallback(json,fileName);return;}

    // Browser download remains for desktop / other supported platforms.
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=fileName;
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function api(path,options={}){
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData)throw new Error('Открой SkillUp через Telegram-бота');
    const controller=new AbortController();
    const t=setTimeout(()=>controller.abort(),14000);
    try {
      const response=await fetch(API+path,{...options,cache:'no-store',signal:controller.signal,headers:{'X-Telegram-Init-Data':initData,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){const e=new Error(response.status===401?'Ошибка Telegram-авторизации (401)':`API: HTTP ${response.status}`);e.status=response.status;throw e;}
      return data;
    } finally {clearTimeout(t);}
  }
  async function pull(){
    const kinds=['development','finances'];
    const docs=await Promise.all(kinds.map(k=>api('/api/v1/documents/'+k)));
    kinds.forEach((k,i)=>{
      const doc=docs[i].document;
      if(doc && !valid(k,doc.payload))throw new Error('Облачный документ '+k+' имеет неожиданную структуру');
      remote[k]=doc?doc.payload:null;
      revisions[k]=doc?Number(doc.revision):null;
    });
  }
  function normalized(kind,p){return kind==='development' ? JSON.stringify(p||EMPTY_DEV()) : JSON.stringify(p||EMPTY_FIN());}
  function setCachedDocuments(reason){
    const need=hasDemo()||['development','finances'].some(kind=>{
      const saved=kind==='development'?safeParse(localStorage.getItem(KEYS.development),null):{entries:safeParse(localStorage.getItem(KEYS.finances),[]),savingsGoal:safeParse(localStorage.getItem(KEYS.savings),null)};
      return normalized(kind,saved)!==normalized(kind,remote[kind]);
    });
    if(need){
      backup(reason);
      localStorage.setItem(KEYS.development,JSON.stringify(remote.development||EMPTY_DEV()));
      localStorage.setItem(KEYS.finances,JSON.stringify((remote.finances||EMPTY_FIN()).entries));
      if((remote.finances||EMPTY_FIN()).savingsGoal)localStorage.setItem(KEYS.savings,JSON.stringify(remote.finances.savingsGoal));
      else localStorage.removeItem(KEYS.savings);
      // Local demo is never joined with genuine cloud transactions.
      localStorage.removeItem(KEYS.demo);
      localStorage.removeItem('skillup_finance_demo_goal_v18');
      localStorage.setItem(LAST_OWNER,userId);
      location.reload();
      return true;
    }
    return false;
  }
  async function upload(kind,payload,revision){
    const data=await api('/api/v1/documents/'+kind,{method:'PUT',body:JSON.stringify({payload,revision})});
    revisions[kind]=data.revision;
    remote[kind]=payload;
  }
  async function activateEmpty(){
    if(running)return;running=true;buttons([]);statusText('Создаём облачное пространство…','');
    try{
      // Stage one: first-time writes only; never overwrite an existing server document.
      if(remote.development||remote.finances)throw new Error('В облаке уже есть данные. Сначала загрузи их.');
      await upload('development',EMPTY_DEV(),null);
      await upload('finances',EMPTY_FIN(),null);
      localStorage.setItem(stateKey(),'active');localStorage.setItem(LAST_OWNER,userId); active=true;configured=true;
      statusText('Облако подключено','Создано пустое пространство. Локальная копия будет сохранена в резерве.');
      setCachedDocuments('empty-cloud');
      markBadge('Облако');buttons([['Обновить с сервера',()=>void refresh(),false]]);
    }catch(e){statusText('Не удалось создать пространство',e.message);buttons([['Повторить',()=>void connect(),true]]);}
    finally{running=false;}
  }
  async function importLocal(){
    if(running)return;
    if(hasDemo()){statusText('Демо не загружаем','Сначала создай пустое облако либо отключи демосценарий.');return;}
    if(remote.development||remote.finances){statusText('Импорт остановлен','В облаке уже есть данные. Импорт поверх существующих записей заблокирован.');return;}
    const d=localDevelopment(),f=localFinances();
    if(!confirm(`Перенести в PostgreSQL ${d.areas.length} направлений, ${d.items.length} целей/навыков/привычек и ${f.entries.length} финансовых операций? Данные будут закреплены только за твоим Telegram-аккаунтом.`))return;
    running=true;buttons([]);statusText('Переносим выбранные данные…','Локальная копия остаётся на устройстве.');
    try{
      backup('before-first-import');
      await upload('development',d,null);
      await upload('finances',f,null);
      localStorage.setItem(stateKey(),'active');localStorage.setItem(LAST_OWNER,userId);
      active=true;configured=true;pending.clear();persistDirty();
      markBadge('Облако');statusText('Данные сохранены в PostgreSQL','Теперь новые цели и финансовые операции будут отправляться автоматически.');
      buttons([['Проверить сохранение',()=>void refresh(),false]]);
    }catch(e){statusText('Перенос не завершён',e.message+' · Повторный импорт поверх уже созданных документов запрещён. Используй загрузку из облака.');buttons([['Повторить подключение',()=>void connect(),true]]);}
    finally{running=false;}
  }
  function showChoice(){
    if(!userId)return;
    const d=localDevelopment(),f=localFinances();
    const hasRemote=remote.development!==null||remote.finances!==null;
    const localSummary=`На устройстве: ${d.areas.length} направлений · ${d.items.length} целей/навыков/привычек · ${f.entries.length} финансовых операций.`;
    const remoteSummary=hasRemote?`В PostgreSQL: ${remote.development?.items?.length||0} целей/навыков/привычек · ${remote.finances?.entries?.length||0} финансовых операций.`:'В PostgreSQL пока нет пользовательских документов.';
    statusText(hasRemote?'Облачные данные обнаружены':'Подключение к PostgreSQL',`${localSummary}\n${remoteSummary}${hasDemo()?'\nВНИМАНИЕ: выбран демосценарий; фиктивные данные не импортируются.':''}`);
    if(hasRemote){
      buttons([['Загрузить из PostgreSQL (с резервной копией)',()=>void takeCloud(),true],['Пока оставить локально',()=>{markBadge('Локально');statusText('Локальный режим','Облачные данные не изменены.');buttons([['Вернуться к выбору',showChoice,false]]);},false]]);
    }else {
      buttons([...(hasDemo()?[]:[['Перенести мои локальные данные',()=>void importLocal(),true]]),['Начать с пустого облака (с резервной копией)',()=>{if(confirm('Локальные цели и финансы будут заменены пустыми облачными данными после создания резервной копии. Продолжить?'))void activateEmpty();},!hasDemo()],['Оставить только локально',()=>{markBadge('Локально');statusText('Локальный режим','Чтобы включить облако, вернись к подключению.');buttons([['Подключить облако',showChoice,true]]);},false]]);
    }
  }
  async function takeCloud(){
    if(running)return;running=true;buttons([]);
    try{
      await pull();
      // Existing documents may be present for only one kind (partial legacy deployment).
      for(const k of ['development','finances'])if(remote[k]===null)await upload(k,k==='development'?EMPTY_DEV():EMPTY_FIN(),null);
      localStorage.setItem(stateKey(),'active');active=true;configured=true;pending.clear();persistDirty();
      statusText('Загружаем PostgreSQL…','Локальные данные сохранены в резервной копии.');
      if(!setCachedDocuments('take-cloud')){localStorage.setItem(LAST_OWNER,userId);markBadge('Облако');statusText('Облако подключено','Данные на устройстве совпадают с PostgreSQL.');buttons([['Проверить облако',()=>void refresh(),false]]);}
    }catch(e){statusText('Не удалось загрузить облако',e.message);buttons([['Повторить',()=>void connect(),true]]);}
    finally{running=false;}
  }
  async function flush(kind){
    if(!active||sending.has(kind)||paused||!userId||!pending.has(kind))return;
    sending.add(kind);markBadge('Сохранение…');
    try {
      while(pending.has(kind)){
        pending.delete(kind);
        const snapshot=structuredClone(localSnapshot(kind));
        await upload(kind,snapshot,revisions[kind]);
        persistDirty();
      }
      if(!pending.size){statusText('Данные в PostgreSQL','Последние изменения подтверждены сервером.');markBadge('Облако ✓');}
    } catch(e){
      pending.add(kind);persistDirty();
      statusText(e.status===409?'Конфликт версий: HTTP 409':'Сохранение не завершено',e.message+' · Изменения сохранены локально; не перезаписывай облако вслепую.');
      markBadge('Не сохранено');buttons([['Повторить отправку',()=>void flush(kind),true],['Перепроверить сервер',()=>void refresh(),false]]);
    } finally {sending.delete(kind);}
  }
  function changed(kind){
    if(!active||paused||!configured||!userId||!['development','finances'].includes(kind))return;
    pending.add(kind);persistDirty();markBadge('Сохранение…');
    if(retryTimer)clearTimeout(retryTimer);
    retryTimer=setTimeout(()=>{for(const k of ['development','finances'])void flush(k);},250);
  }
  window.skillupCloudChanged=changed;
  window.skillupCloudPauseForDemo=()=>{
    if(!active)return;
    paused=true;active=false;configured=false;
    if(userId)localStorage.removeItem(stateKey());
    markBadge('Демо · локально');
    statusText('Демо отдельно от PostgreSQL','Демонстрационные данные не отправляются на сервер. Подключить облако снова можно из профиля.');
    buttons([['Настроить облако',()=>void connect(),true]]);
  };
  async function refresh(){
    if(running)return;
    if(pending.size){statusText('Есть несохранённые изменения','Загрузка из облака сейчас заблокирована. Сначала повтори отправку или сохрани локальный экспорт.');return;}
    running=true;
    try{await pull();if(!setCachedDocuments('cloud-refresh')){statusText('Облако синхронизировано','Локальная копия совпадает с PostgreSQL.');markBadge('Облако ✓');}}
    catch(e){statusText('Не удалось проверить PostgreSQL',e.message);markBadge('Нет связи');}
    finally{running=false;}
  }
  async function connect(){
    if(running)return;running=true;markBadge('Проверка…');statusText('Проверяем Telegram и API…','');buttons([]);
    try {
      const me=await api('/api/v1/me');
      if(!me.user?.telegram_id)throw new Error('API не вернул идентификатор пользователя');
      userId=String(me.user.telegram_id);
      const previousOwner=localStorage.getItem(LAST_OWNER);
      if(previousOwner&&previousOwner!==userId){
        backup('switch-account');
        [KEYS.development,KEYS.finances,KEYS.savings,KEYS.demo,'skillup_finance_demo_goal_v18','skillup-v22-progress-history','skillup_ai_workspace_v29'].forEach(k=>localStorage.removeItem(k));
        localStorage.setItem(LAST_OWNER,userId);
        location.reload();return;
      }
      await pull();
      active=localStorage.getItem(stateKey())==='active';
      configured=active;
      pending=readDirty();
      // If Railway committed the last PUT but WebView closed before receiving
      // its acknowledgement, avoid a false conflict on the next launch.
      for(const kind of [...pending]){
        if(remote[kind]!==null && normalized(kind,localSnapshot(kind))===normalized(kind,remote[kind]))pending.delete(kind);
      }
      persistDirty();
      if(active){
        if(pending.size){
          markBadge('Есть изменения');statusText('Несохранённые локальные изменения','Загрузка из облака заблокирована, пока изменения не отправлены.');
          buttons([['Повторить сохранение',()=>{for(const k of pending)void flush(k);},true],['Показать серверные данные',()=>{statusText('Данные в облаке',`Целей: ${remote.development?.items?.length||0}; операций: ${remote.finances?.entries?.length||0}. Локальные данные не изменены.`)},false]]);
        }else {
          if(!setCachedDocuments('boot-sync')){
            markBadge('Облако ✓');statusText('Облако подключено',`Telegram-авторизация успешна. Целей в PostgreSQL: ${remote.development?.items?.length||0}; операций: ${remote.finances?.entries?.length||0}.`);
            buttons([['Обновить с сервера',()=>void refresh(),false]]);
            localStorage.setItem(LAST_OWNER,userId);
          }
        }
      }else{markBadge('Локально');showChoice();}
    }catch(e){markBadge('Локально');statusText('Облачное подключение недоступно',e.message+' · Твои локальные данные не затронуты.');buttons([['Повторить подключение',()=>void connect(),true]]);}
    finally{running=false;}
  }
  function buildUI(){
    const profile=document.getElementById('profile');if(!profile)return;
    panel=document.createElement('div');panel.className='card';panel.id='skillup-cloud-panel';
    panel.style.cssText='border:1px solid #3b7654;margin-bottom:12px';
    const h=document.createElement('div');h.className='cardtitle';h.textContent='☁ Синхронизация SkillUp';
    status=document.createElement('p');status.style.cssText='font-weight:700;margin:12px 0 6px';status.textContent='Проверяем подключение…';
    details=document.createElement('p');details.style.cssText='white-space:pre-line;color:#a3b7a9;font-size:12px;line-height:1.5';
    actions=document.createElement('div');
    const note=document.createElement('p');note.className='muted';note.style.cssText='font-size:11px;margin-top:10px';note.textContent='Пока синхронизируются цели, навыки, привычки и пользовательские финансовые операции. Чаты ИИ и история прогресса — следующим этапом. Демоданные не отправляются автоматически.';
    const exportButton=document.createElement('button');
    exportButton.type='button';exportButton.className='secondary';exportButton.textContent='↓ Сохранить локальную резервную копию';
    exportButton.style.cssText='width:100%;margin-top:11px;padding:11px;font-size:12px';
    exportButton.addEventListener('click',()=>void downloadLocalExport());
    panel.append(h,status,details,actions,exportButton,note);
    const demo=profile.querySelector('.demo-profile-card');profile.insertBefore(panel,demo||profile.firstChild);
    const pill=profile.querySelector('.pill');badge=pill;markBadge('Локально');
    buttons([['Повторить подключение',()=>void connect(),true]]);
  }
  buildUI();
  void connect();
})();
