import {
  mealStages,foodSafety,nauseaTips,secrets,shoppingBase,dailyGreetings,calmSupportLines,
  playfulSupportLines,dailyChoices,babyMessages,defaultAhmedMessages
} from './data.js';
import {
  migrateLegacy,loadProfile,saveProfile,loadDay,saveDay,loadQuestions,saveQuestions,
  loadJournal,saveJournal,loadAppointments,saveAppointments,loadFavorites,saveFavorites,
  loadAhmedMessages,saveAhmedMessages,exportData,importData,addMemory,listMemories,
  deleteMemory,fileToDataUrl,dateKey,defaultDay,recentDays,listFromText,textFromList
} from './storage.js';
import {pregnancyFromLmp,arDate,ageText,stageKey,babySize,treeStage} from './pregnancy.js';
import {qs,qsa,toast,openModal,closeModal,closeAll,vibrate,confetti,escapeHtml,setTheme,formatTimeAgo} from './ui.js';
import {callAyaAI,hasUrgentSignal} from './ai.js';
import {initSync,onSyncState,signInWithGoogle,signOut,syncNow,queueSync,currentUser,getSyncState} from './sync.js';

migrateLegacy();

let profile=loadProfile();
let day=loadDay();
let questions=loadQuestions();
let journal=loadJournal();
let appointments=loadAppointments();
let favorites=loadFavorites();
let ahmedMessages=loadAhmedMessages();
let currentMeals=[];
let currentDailyChoice=null;
let deferredPrompt=null;
let swRegistration=null;
let chatHistory=[];
let activeAiTask='chat';
let syncState={configured:false,session:null,lastSyncAt:''};
let lastAppliedSyncAt='';

const mealOrder=['wake','breakfast','snack1','lunch','snack2','dinner','bedtime'];
const icons={wake:'snack',breakfast:'breakfast',snack1:'snack',lunch:'lunch',snack2:'snack',dinner:'dinner',bedtime:'snack'};
const mealLabels={wake:'قبل النهوض',breakfast:'الفطور',snack1:'وجبة خفيفة',lunch:'الغداء',snack2:'وجبة خفيفة',dinner:'العشاء',bedtime:'قبل النوم'};

function hydrateState(){
  profile=loadProfile();day=loadDay();questions=loadQuestions();journal=loadJournal();
  appointments=loadAppointments();favorites=loadFavorites();ahmedMessages=loadAhmedMessages();
}
function saveCurrentDay(){day=saveDay(day)}
function pregnancy(){return pregnancyFromLmp(profile.lmp)}
function todayArabic(){return new Intl.DateTimeFormat('ar-SA',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}
function stage(){const p=pregnancy();return stageKey(p?.currentWeek||10)}
function getStageData(){return mealStages[stage()]||mealStages['9-12']}
function hash(value=''){let h=0;for(const c of String(value))h=((h<<5)-h+c.charCodeAt(0))|0;return h}
function stableIndex(seed,length){return length?Math.abs(hash(seed))%length:0}
function randomIndex(length,old){if(length<=1)return 0;let i=Math.floor(Math.random()*length);while(i===old)i=Math.floor(Math.random()*length);return i}
function mealId(m){return `${m[0]}|${m[1]}`}
function name(){return profile.name||'نبض'}
function personalize(text=''){return String(text).replaceAll('نبض',name()).replaceAll('أحمد',profile.partnerName||'أحمد')}
function daySeed(extra=''){return `${dateKey()}|${day.dailyVariant||0}|${extra}`}

function renderPregnancy(){
  const p=pregnancy();
  if(!p){
    qs('#currentWeek').textContent='—';qs('#heroWeekText').textContent='أضيفي تاريخ آخر دورة';
    qs('#gestationalAge').textContent='أضيفي تاريخ آخر دورة لبدء الحساب.';qs('#daysRemaining').textContent='—';
    qs('#dueDate').textContent='—';qs('#pregnancyProgress').style.width='0%';return;
  }
  qs('#currentWeek').textContent=p.currentWeek;
  qs('#heroWeekText').textContent=ageText(p);
  qs('#gestationalAge').textContent=`العمر الحملي: ${ageText(p)}`;
  qs('#daysRemaining').textContent=`متبقي تقريبًا ${p.remaining+1} يومًا شاملًا اليوم`;
  qs('#dueDate').textContent=`الموعد المتوقع: ${arDate(p.due)}`;
  qs('#pregnancyProgress').style.width=p.progress+'%';
  const t=treeStage(p.currentWeek);qs('#treeCaption').textContent=t.caption;qs('#treeStage img').style.transform=`scale(${t.scale})`;
  const bs=babySize(p.currentWeek);qs('#babyFruit').textContent=bs.fruit;qs('#babySize').textContent=bs.label;
  const st=getStageData();qs('#foodStageLabel').textContent=`مرحلة الأسابيع ${stage()} — الأولوية: ${st.priority}`;
}

function renderHomeGreeting(){
  const greeting=personalize(dailyGreetings[stableIndex(daySeed('greeting'),dailyGreetings.length)]);
  const supports=profile.tone==='playful'?playfulSupportLines:calmSupportLines;
  qs('#homeGreeting').textContent=greeting;
  qs('#homeSupportLine').textContent=personalize(supports[stableIndex(daySeed('support'),supports.length)]);
}

function selectDailyChoice(){
  const options=dailyChoices[day.mood]||dailyChoices.default;
  currentDailyChoice=options[stableIndex(daySeed(`choice|${day.mood}`),options.length)];
  return currentDailyChoice;
}
function renderDailyChoice(){
  const [icon,title,text]=selectDailyChoice();
  qs('#dailyChoiceIcon').textContent=icon;qs('#dailyChoiceTitle').textContent=title;qs('#dailyChoiceText').textContent=personalize(text);
  const btn=qs('#completeDailyChoiceBtn');btn.textContent=day.dailyChoiceDone?'تمت الخطوة 🤍':'تم 🤍';btn.classList.toggle('done',!!day.dailyChoiceDone);
}

function surpriseData(){
  const custom=ahmedMessages.map(x=>x.text).filter(Boolean);
  const useAhmed=stableIndex(daySeed('surprise-type'),4)!==3;
  if(useAhmed){
    const messages=custom.length?[...custom,...defaultAhmedMessages]:defaultAhmedMessages;
    return{title:`رسالة من ${profile.partnerName||'أحمد'} 💌`,text:personalize(messages[stableIndex(daySeed('ahmed'),messages.length)])};
  }
  const [title,text]=secrets[stableIndex(daySeed('secret'),secrets.length)];
  return{title,text:personalize(text)};
}
function renderSurprise(){
  const data=surpriseData();
  if(day.secretRevealed){qs('#surpriseTitle').textContent=data.title;qs('#surpriseText').textContent=data.text;qs('#openSurpriseBtn').textContent='مفتوحة اليوم 🤍'}
  else{qs('#surpriseTitle').textContent='شيء جميل ينتظرك';qs('#surpriseText').textContent='اضغطي لفتح مفاجأة اليوم.';qs('#openSurpriseBtn').textContent='افتحي المفاجأة'}
}

function babyMessageGroup(){const week=pregnancy()?.currentWeek||8;return week<=12?'early':week<=27?'middle':'late'}
function renderBabyMessage(){
  const group=babyMessages[babyMessageGroup()]||babyMessages.early;
  const msg=group[stableIndex(`${dateKey()}|baby|${pregnancy()?.currentWeek||0}`,group.length)];
  qs('#babyMessageTitle').textContent=profile.babyName?`رسالة من ${profile.babyName} 🤍`:`إلى ماما ${name()} 🤍`;
  qs('#babyMessageText').textContent=personalize(msg);
}

function renderVitaminReminder(){
  const done=!!day.tasks.vitamin;const snoozed=day.vitaminSnoozedAt&&new Date(day.vitaminSnoozedAt)>new Date();
  qs('#vitaminReminderText').textContent=done?'تم تسجيله اليوم 🤍':snoozed?'سنعيد التذكير عند فتح التطبيق لاحقًا.':'حسب وصف الطبيبة.';
  qs('#vitaminDoneBtn').textContent=done?'تم ✓':'أخذته';qs('#vitaminDoneBtn').disabled=done;
  qs('#vitaminLaterBtn').disabled=done;
}

function renderHomePersonalization(){renderHomeGreeting();renderDailyChoice();renderSurprise();renderBabyMessage();renderVitaminReminder()}

function renderWater(){
  qs('#waterCount').textContent=day.water||0;const box=qs('#waterDrops');box.innerHTML='';
  for(let i=1;i<=8;i++){
    const b=document.createElement('button');b.type='button';b.textContent='●';b.classList.toggle('filled',i<=day.water);b.ariaLabel=`ضبط الماء على ${i} أكواب`;
    b.onclick=()=>{const before=day.water;day.water=i;saveCurrentDay();renderWater();renderCompletion();vibrate(profile);if(before<8&&i===8){toast(`اكتمل هدف الماء اليوم يا ${name()} 💧`);confetti(profile)}};box.appendChild(b);
  }
}
function changeWater(delta){const before=day.water||0;day.water=Math.max(0,Math.min(8,before+delta));saveCurrentDay();renderWater();renderCompletion();vibrate(profile);if(before<8&&day.water===8){toast(`اكتمل هدف الماء اليوم يا ${name()} 💧`);confetti(profile)}}

function renderMood(){
  qsa('[data-mood]').forEach(b=>b.classList.toggle('active',b.dataset.mood===day.mood));
  qs('#moodHeading').textContent=day.mood?`${day.moodIcon} ${day.mood} اليوم`:'اختاري شعورك بضغطة واحدة';
}
function renderTasks(){qsa('[data-task]').forEach(input=>{input.checked=!!day.tasks[input.dataset.task];input.closest('label').classList.toggle('checked',input.checked)})}
function ensureFrequentSymptomChips(){
  const box=qs('#symptomChips');
  (profile.frequentSymptoms||[]).forEach(symptom=>{if(!qsa('[data-symptom]',box).some(b=>b.dataset.symptom===symptom)){const b=document.createElement('button');b.dataset.symptom=symptom;b.textContent=symptom;box.prepend(b)}});
}
function bindSymptomButtons(){
  qsa('[data-symptom]').forEach(b=>b.onclick=()=>{const s=b.dataset.symptom;if(s==='لا شيء')day.symptoms=['لا شيء'];else{day.symptoms=day.symptoms.filter(x=>x!=='لا شيء');day.symptoms=day.symptoms.includes(s)?day.symptoms.filter(x=>x!==s):[...day.symptoms,s]}saveCurrentDay();renderSymptoms();vibrate(profile)});
}
function renderSymptoms(){ensureFrequentSymptomChips();qsa('[data-symptom]').forEach(b=>b.classList.toggle('active',day.symptoms.includes(b.dataset.symptom)));qs('#dailyNote').value=day.note||'';bindSymptomButtons()}
function renderCompletion(){
  const taskCount=Object.values(day.tasks||{}).filter(Boolean).length;const mealsDone=Object.values(day.meals||{}).filter(Boolean).length;
  const score=Math.min(100,Math.round(((Math.min(day.water||0,8)/8)*30)+(taskCount/5*45)+(Math.min(mealsDone,7)/7*20)+(day.mood?5:0)));
  qs('#completionPercent').textContent=score+'%';qs('#completionRing').style.setProperty('--progress',score+'%');
  if(score===100&&!day.celebrated){day.celebrated=true;saveCurrentDay();confetti(profile);toast(`يوم مكتمل… أحسنتِ يا ${name()} 🤍`)}
}

function preferenceTokens(){return{favorites:(profile.favoriteFoods||[]).map(x=>x.toLowerCase()),aversions:[...(profile.foodAversions||[]),...(profile.smellAversions||[])].map(x=>x.toLowerCase())}}
function mealCandidates(key){
  const options=getStageData()[key]||[];const prefs=preferenceTokens();
  let candidates=options.map((item,index)=>({item,index,score:0})).filter(({item})=>{
    const text=item.join(' ').toLowerCase();return !prefs.aversions.some(token=>token&&text.includes(token));
  });
  if(!candidates.length)candidates=options.map((item,index)=>({item,index,score:0}));
  candidates.forEach(c=>{
    const text=c.item.join(' ').toLowerCase();
    c.score+=prefs.favorites.filter(token=>token&&text.includes(token)).length*3;
    if(day.mood==='غثيان'&&/(توست|خبز|زبادي|موز|بطاطس|شوربة|كراكر|حليب)/u.test(text))c.score+=4;
    if(day.mood==='جوعانه'&&/(دجاج|لحم|أرز|بيض|فول|مكرونة)/u.test(text))c.score+=2;
  });
  return candidates.sort((a,b)=>b.score-a.score);
}
function ensureMeals(force=false){
  let changed=false;
  mealOrder.forEach(key=>{
    const candidates=mealCandidates(key);const valid=candidates.some(c=>c.index===day.mealIndexes[key]);
    if(force||!valid){
      const top=candidates.filter(c=>c.score===candidates[0]?.score);const pool=top.length?top:candidates;
      const old=day.mealIndexes[key];const pick=pool[randomIndex(pool.length,pool.findIndex(c=>c.index===old))]||candidates[0];
      day.mealIndexes[key]=pick?.index??0;changed=true;
    }
  });
  currentMeals=mealOrder.map(key=>({key,item:getStageData()[key][day.mealIndexes[key]]}));
  if(changed)saveCurrentDay();
}
function renderMeals(){
  ensureMeals();const box=qs('#mealList');box.innerHTML='';
  currentMeals.forEach(({key,item})=>{
    const id=mealId(item),fav=favorites.includes(id),done=!!day.meals[key];const card=document.createElement('article');card.className='meal-card';
    card.innerHTML=`<img src="assets/icons/${icons[key]}.svg" alt=""><div><small>${escapeHtml(item[0]||mealLabels[key])}</small><h3>${escapeHtml(item[1])}</h3><p>${escapeHtml(item[3]||'اختيار متوازن وبسيط')}</p></div><div class="meal-actions"><button class="${done?'active':''}" data-meal-done="${key}" title="تم تناولها">✓</button><button class="${fav?'active':''}" data-fav="${escapeHtml(id)}" title="المفضلة">♡</button></div>`;box.appendChild(card);
  });
  qsa('[data-meal-done]',box).forEach(b=>b.onclick=()=>{day.meals[b.dataset.mealDone]=!day.meals[b.dataset.mealDone];saveCurrentDay();renderMeals();renderCompletion();vibrate(profile)});
  qsa('[data-fav]',box).forEach(b=>b.onclick=()=>{const id=b.dataset.fav;favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];saveFavorites(favorites);renderMeals();toast(favorites.includes(id)?'حُفظت في المفضلة':'أزيلت من المفضلة')});
}
function shuffleMeals({quiet=false}={}){ensureMeals(true);renderMeals();if(!quiet)toast(`اقتراحات جديدة مناسبة لكِ يا ${name()} 🌿`);vibrate(profile,[10,30,10])}

function renderQuestions(){
  const box=qs('#questionList');box.innerHTML='';if(!questions.length)box.innerHTML='<p class="muted-box">لا توجد أسئلة محفوظة.</p>';
  questions.forEach((q,i)=>{const row=document.createElement('div');row.className='question-item';row.innerHTML=`<span>${escapeHtml(q)}</span><button aria-label="حذف">×</button>`;row.querySelector('button').onclick=()=>{questions.splice(i,1);saveQuestions(questions);renderQuestions()};box.appendChild(row)});
}
function addQuestion(){const q=prompt('اكتبي السؤال للطبيبة:');if(q?.trim()){questions.push(q.trim());saveQuestions(questions);renderQuestions();toast('تم حفظ السؤال')}}

function renderAppointments(){
  appointments.sort((a,b)=>new Date(a.date)-new Date(b.date));const future=appointments.find(a=>new Date(a.date)>=new Date());
  if(future){const d=new Date(future.date),days=Math.ceil((d-new Date())/86400000);qs('#nextAppointmentTitle').textContent=future.clinic||'موعد الطبيبة';qs('#nextAppointmentMeta').textContent=`${arDate(d,true)} — ${days===0?'اليوم':days===1?'غدًا':`بعد ${days} أيام`}`}
  else{qs('#nextAppointmentTitle').textContent='لا يوجد موعد قادم';qs('#nextAppointmentMeta').textContent='أضيفي الموعد لعرض العد التنازلي.'}
  const box=qs('#appointmentArchive');box.innerHTML='';const list=[...appointments].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);if(!list.length)box.innerHTML='<div class="muted-box">لا توجد زيارات محفوظة بعد.</div>';
  list.forEach(a=>{const row=document.createElement('div');row.className='archive-item';row.innerHTML=`<b>${escapeHtml(a.clinic||'زيارة طبية')}</b><span>${arDate(new Date(a.date),true)}</span>${a.weight?`<small>الوزن: ${escapeHtml(a.weight)} كجم</small>`:''}${a.bp?`<small>الضغط: ${escapeHtml(a.bp)}</small>`:''}${a.notes?`<small>${escapeHtml(a.notes)}</small>`:''}<div class="card-actions"><button data-del-appt="${a.id}">حذف</button></div>`;box.appendChild(row)});
  qsa('[data-del-appt]',box).forEach(b=>b.onclick=()=>{if(confirm('حذف هذا الموعد؟')){appointments=appointments.filter(x=>x.id!==b.dataset.delAppt);saveAppointments(appointments);renderAppointments()}});
}

function renderJournal(){
  const box=qs('#journalNotes');box.innerHTML='';if(!journal.length)box.innerHTML=`<div class="muted-box">لا توجد مذكرات بعد. اكتبي أول لحظة جميلة يا ${escapeHtml(name())}.</div>`;
  journal.forEach(n=>{const c=document.createElement('article');c.className='journal-card';c.innerHTML=`<time>${formatTimeAgo(n.createdAt)}</time><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.body)}</p><div class="card-actions"><button data-del-note="${n.id}">حذف</button></div>`;box.appendChild(c)});
  qsa('[data-del-note]',box).forEach(b=>b.onclick=()=>{if(confirm('حذف المذكرة؟')){journal=journal.filter(x=>x.id!==b.dataset.delNote);saveJournal(journal);renderJournal()}});
}
async function renderMemories(){
  const box=qs('#memoryGrid');box.innerHTML='<div class="muted-box">جاري تحميل الذكريات…</div>';
  try{const list=await listMemories();box.innerHTML='';if(!list.length)box.innerHTML='<div class="muted-box">لا توجد ذكريات محفوظة بعد.</div>';
    list.forEach(m=>{const c=document.createElement('article');c.className='memory-card';c.innerHTML=`${m.image?`<img src="${m.image}" alt="${escapeHtml(m.title)}">`:''}<time>${formatTimeAgo(m.createdAt)}</time><h3>${escapeHtml(m.title)}</h3><p>${escapeHtml(m.body||'')}</p><div class="card-actions"><button data-del-memory="${m.id}">حذف</button></div>`;box.appendChild(c)});
    qsa('[data-del-memory]',box).forEach(b=>b.onclick=async()=>{if(confirm('حذف الذكرى؟')){await deleteMemory(b.dataset.delMemory);renderMemories()}});
  }catch{box.innerHTML='<div class="muted-box">تعذر فتح قاعدة الصور على هذا المتصفح.</div>'}
}

function renderAhmedMessages(){
  const box=qs('#ahmedMessagesList');if(!box)return;box.innerHTML='';
  if(!ahmedMessages.length)box.innerHTML='<div class="muted-box">لا توجد رسائل خاصة بعد. سيستخدم التطبيق رسائل لطيفة جاهزة من أحمد.</div>';
  ahmedMessages.forEach(m=>{const row=document.createElement('div');row.className='saved-message-row';row.innerHTML=`<p>${escapeHtml(m.text)}</p><button data-del-ahmed="${m.id}">حذف</button>`;box.appendChild(row)});
  qsa('[data-del-ahmed]',box).forEach(b=>b.onclick=()=>{ahmedMessages=ahmedMessages.filter(x=>x.id!==b.dataset.delAhmed);saveAhmedMessages(ahmedMessages);renderAhmedMessages();renderSurprise()});
}

function renderShopping(){const box=qs('#shoppingList');box.innerHTML='';shoppingBase.forEach((x,i)=>{const row=document.createElement('label');row.className='shopping-item';row.innerHTML=`<input type="checkbox" data-shop="${i}"><span>${escapeHtml(x)}</span>`;box.appendChild(row)})}
function renderNausea(){qs('#nauseaList').innerHTML=nauseaTips.map(([t,d])=>`<div class="tip-row"><b>${escapeHtml(t)}</b><span>${escapeHtml(d)}</span></div>`).join('')}
function searchFood(){
  const query=qs('#foodSearchInput').value.trim().toLowerCase(),box=qs('#foodSearchResult');if(!query){box.innerHTML='اكتبي اسم الطعام أولًا.';return}
  const item=foodSafety.find(x=>x.keys.some(k=>query.includes(k)||k.includes(query)));
  if(!item){box.innerHTML='<div class="food-status caution"><i>؟</i><div><b>غير موجود في الدليل المحلي</b><p>استخدمي زر «اسألي المساعد الذكي» أو استشيري الطبيبة عند وجود تعليمات خاصة.</p></div></div>';return}
  const icon=item.status==='safe'?'✓':item.status==='avoid'?'×':'!';const label=item.status==='safe'?'آمن بشروط':item.status==='avoid'?'يُتجنب':'بحذر';
  box.innerHTML=`<div class="food-status ${item.status}"><i>${icon}</i><div><b>${label}: ${escapeHtml(item.title)}</b><p>${escapeHtml(item.detail)}</p></div></div>`;
}

function openPage(pageName){qsa('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===pageName));qsa('[data-page-target]').forEach(b=>b.classList.toggle('active',b.dataset.pageTarget===pageName));window.scrollTo({top:0,behavior:'smooth'});if(pageName==='journal')renderMemories()}

function populateSettings(){
  qs('#nameInput').value=name();qs('#lmpInput').value=profile.lmp||'';qs('#phoneInput').value=profile.phone||'';
  qs('#fetusesInput').value=profile.fetuses||'1';qs('#pregnancyNumberInput').value=profile.pregnancyNumber||'first';
  qs('#babyNameInput').value=profile.babyName||'';qs('#doctorNameInput').value=profile.doctorName||'';qs('#hospitalInput').value=profile.hospital||'';
  qs('#messageLengthInput').value=profile.messageLength||'short';qs('#toneInput').value=profile.tone||'calm';qs('#reminderLevelInput').value=profile.reminderLevel||'few';
  qs('#reminderMorningInput').value=profile.reminderMorning||'09:00';qs('#reminderEveningInput').value=profile.reminderEvening||'20:00';
  qs('#favoriteFoodsInput').value=textFromList(profile.favoriteFoods);qs('#foodAversionsInput').value=textFromList(profile.foodAversions);qs('#smellAversionsInput').value=textFromList(profile.smellAversions);qs('#frequentSymptomsInput').value=textFromList(profile.frequentSymptoms);
  qs('#themeSelect').value=profile.theme||'auto';qs('#motionSelect').value=profile.motion||'full';qs('#aiConsentInput').checked=!!profile.aiConsent;
}
function saveSettings(e){
  e.preventDefault();
  profile=saveProfile({...profile,name:qs('#nameInput').value.trim()||'نبض',lmp:qs('#lmpInput').value,phone:qs('#phoneInput').value.trim(),fetuses:qs('#fetusesInput').value,pregnancyNumber:qs('#pregnancyNumberInput').value,babyName:qs('#babyNameInput').value.trim(),doctorName:qs('#doctorNameInput').value.trim(),hospital:qs('#hospitalInput').value.trim(),messageLength:qs('#messageLengthInput').value,tone:qs('#toneInput').value,reminderLevel:qs('#reminderLevelInput').value,reminderMorning:qs('#reminderMorningInput').value||'09:00',reminderEvening:qs('#reminderEveningInput').value||'20:00',favoriteFoods:listFromText(qs('#favoriteFoodsInput').value),foodAversions:listFromText(qs('#foodAversionsInput').value),smellAversions:listFromText(qs('#smellAversionsInput').value),frequentSymptoms:listFromText(qs('#frequentSymptomsInput').value),theme:qs('#themeSelect').value,motion:qs('#motionSelect').value,aiConsent:qs('#aiConsentInput').checked,onboarded:true});
  setTheme(profile);ensureMeals(true);renderAll();closeAll();toast(`تم حفظ تجربة ${name()} 🤍`);
}
function onboard(e){e.preventDefault();profile=saveProfile({...profile,name:qs('#onboardingName').value.trim()||'نبض',lmp:qs('#onboardingLmp').value,phone:qs('#onboardingPhone').value.trim(),onboarded:true});closeAll();renderAll();toast(`بدأت رحلة ${name()} 🤍`)}

function saveCare(){day.note=qs('#dailyNote').value.trim();saveCurrentDay();toast('تم حفظ متابعة اليوم')}
function resetDay(){if(!confirm('هل تريدين إعادة متابعة اليوم؟'))return;day={...defaultDay(),secretIndex:day.secretIndex,dailyVariant:day.dailyVariant||0};saveCurrentDay();renderAll();toast('بدأ يوم جديد 🌷')}

function summaryText(){
  const tasks=qsa('[data-task]:checked').map(i=>i.closest('label').querySelector('b').textContent);
  return `ملخص ${name()} اليوم 🌷\nالتاريخ: ${todayArabic()}\nأسبوع الحمل: ${pregnancy()?.currentWeek||'—'}\nالماء: ${day.water||0}/8\nالحالة: ${day.moodIcon||''} ${day.mood||'لم تحدد'}\nالمهام: ${tasks.length?tasks.join('، '):'لا شيء مسجل'}\nالأعراض: ${day.symptoms.length?day.symptoms.join('، '):'لم تسجل'}\nالملاحظة: ${day.note||'لا توجد'}`;
}
function needAhmed(){const phone=(profile.phone||'').replace(/\D/g,'');const msg=`${profile.partnerName||'أحمد'}، أحتاجك بجانبي الآن 🤍`;if(phone)window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank');else{toast('أضيفي رقم أحمد من الإعدادات أولًا');openModal('settingsModal')}}
async function shareSummary(){const text=summaryText(),phone=(profile.phone||'').replace(/\D/g,'');if(phone){window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank');return}if(navigator.share){try{await navigator.share({title:`ملخص ${name()} اليوم`,text});return}catch{}}try{await navigator.clipboard.writeText(text);toast('تم نسخ الملخص')}catch{toast('تعذر نسخ الملخص')}}

function urgentLocalResponse(message){if(!hasUrgentSignal(message))return null;return `يا ${name()}، ذكرتِ عرضًا قد يحتاج تقييمًا طبيًا عاجلًا. تواصلي الآن مع الطبيبة أو 937، وإذا كان هناك نزيف شديد أو إغماء أو ألم شديد أو صعوبة تنفس فاتصلي بالطوارئ 997.`}
function recentSummary(){return recentDays(7).map(d=>({date:d.date,mood:d.mood||'',symptoms:d.symptoms||[],water:d.water||0,note:d.note||''}))}
function buildAiContext(){
  const p=pregnancy();return{
    pregnancyWeek:p?.currentWeek||null,gestationalAge:p?ageText(p):null,stage:stage(),mood:day.mood||null,symptoms:day.symptoms||[],water:day.water||0,note:day.note||'',mealPriority:getStageData().priority,recentDays:recentSummary(),
    preferences:{preferredName:name(),babyName:profile.babyName||'',messageLength:profile.messageLength||'short',tone:profile.tone||'calm',favoriteFoods:profile.favoriteFoods||[],foodAversions:profile.foodAversions||[],smellAversions:profile.smellAversions||[],frequentSymptoms:profile.frequentSymptoms||[]}
  };
}
function openAiForTask(task){activeAiTask=task||'chat';const titles={food_question:'هل هذا الطعام مناسب؟',meal_plan:'خصّصي وجباتي',doctor_questions:'جهزي أسئلتي للطبيبة',symptoms:'مساعد فهم الأعراض',chat:'كيف أساعدك اليوم؟'};qs('#aiModalTitle').textContent=titles[activeAiTask]||titles.chat;openModal('aiModal');setTimeout(()=>qs('#aiInput').focus(),200)}
function parseCupCount(text){
  const t=text.replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));const m=t.match(/(?:شربت|شربتِ)\s*(\d+)/u);if(m)return Math.max(1,Math.min(8,Number(m[1])));
  if(/كوبين|كوبان/u.test(t))return 2;if(/ثلاث(?:ة)?\s*أكواب/u.test(t))return 3;if(/كوب/u.test(t))return 1;return 0;
}
function applyLocalAssistantCommand(message){
  if(message.length>120)return null;
  if(/أخذت.*(?:حمض\s*الفوليك|الفوليك|المكمل)/u.test(message)){day.tasks.vitamin=true;saveCurrentDay();renderTasks();renderVitaminReminder();renderCompletion();return `تم تسجيل حمض الفوليك يا ${name()} 🤍`}
  if(/شربت/u.test(message)&&/كوب|أكواب/u.test(message)){const count=parseCupCount(message);if(count){day.water=Math.min(8,(day.water||0)+count);saveCurrentDay();renderWater();renderCompletion();return `تمت إضافة ${count===1?'كوب واحد':count===2?'كوبين':`${count} أكواب`} إلى الماء يا ${name()} 💧`}}
  return null;
}
async function sendAi(message){
  const localAction=applyLocalAssistantCommand(message);addChat('user',message);if(localAction){addChat('assistant',localAction);return}
  if(!profile.aiConsent){toast('فعّلي موافقة AI من الإعدادات أولًا');openModal('settingsModal');return}
  const urgent=urgentLocalResponse(message);if(urgent){addChat('assistant',urgent);return}
  qs('#aiStatus').textContent=`جاري إعداد رد مناسب لكِ يا ${name()}…`;qs('#aiForm button').disabled=true;
  try{
    const data=await callAyaAI({task:activeAiTask,message,context:buildAiContext(),history:chatHistory});addChat('assistant',data.text||`يا ${name()}، لم يصل رد واضح. حاولي بصياغة أخرى.`);
    if(Array.isArray(data.questions)&&data.questions.length&&activeAiTask==='doctor_questions'){questions=[...new Set([...questions,...data.questions])];saveQuestions(questions);renderQuestions();toast('أضيفت الأسئلة المقترحة إلى قائمتك')}
  }catch(error){addChat('assistant',navigator.onLine?`يا ${name()}، تعذر الاتصال بالمساعد الآن. جربي مرة أخرى بعد قليل.`:`يا ${name()}، أنتِ دون اتصال حاليًا. استخدمي الاقتراحات المحلية.`);console.error(error)}
  finally{qs('#aiStatus').textContent='';qs('#aiForm button').disabled=false}
}
function addChat(role,text){chatHistory.push({role,text});const div=document.createElement('div');div.className=`message ${role}`;div.textContent=text;qs('#chatBox').appendChild(div);qs('#chatBox').scrollTop=qs('#chatBox').scrollHeight}

function backup(){const blob=new Blob([JSON.stringify(exportData(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`دليل-آية-نسخة-${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('تم تنزيل النسخة الاحتياطية')}
function restore(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{importData(JSON.parse(r.result));toast('تمت الاستعادة، سيعاد تحميل التطبيق');setTimeout(()=>location.reload(),900)}catch{toast('ملف النسخة غير صالح')}};r.readAsText(file)}
function parseTime(value,fallback){const [h,m]=String(value||fallback).split(':').map(Number);return{h:Number.isFinite(h)?h:9,m:Number.isFinite(m)?m:0}}
function downloadCalendar(){
  const pad=n=>String(n).padStart(2,'0'),fmt=d=>d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'T'+pad(d.getHours())+pad(d.getMinutes())+'00';
  const event=(title,h,m)=>{const d=new Date();d.setHours(h,m,0,0);return['BEGIN:VEVENT',`UID:${Date.now()}-${h}-${m}@aya-guide`,`DTSTAMP:${fmt(new Date())}`,`DTSTART:${fmt(d)}`,'RRULE:FREQ=DAILY',`SUMMARY:${title}`,'BEGIN:VALARM','TRIGGER:-PT10M','ACTION:DISPLAY',`DESCRIPTION:${title}`,'END:VALARM','END:VEVENT'].join('\r\n')};
  const morning=parseTime(profile.reminderMorning,'09:00'),evening=parseTime(profile.reminderEvening,'20:00');
  const events=[event(`المكملات حسب وصف الطبيبة — ${name()}`,morning.h,morning.m),event(`وقت كوب ماء يا ${name()}`,evening.h,Math.max(0,evening.m-30))];
  if(profile.reminderLevel==='medium'){events.push(event(`وجبة خفيفة يا ${name()}`,11,0),event(`راحة قصيرة يا ${name()}`,15,30))}
  const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Aya Guide V4//AR',...events,'END:VCALENDAR'].join('\r\n');
  const blob=new Blob([content],{type:'text/calendar;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='تذكيرات-نبض.ics';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('تم إنشاء ملف التذكيرات حسب أوقاتك')}

async function installApp(){if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null}else toast('من قائمة المتصفح اختاري: إضافة إلى الشاشة الرئيسية')}
function updateNetwork(){const offline=!navigator.onLine;qs('#networkDot').classList.toggle('offline',offline);qs('#offlineBanner').hidden=!offline}
function setupServiceWorker(){if(!('serviceWorker'in navigator)||!location.protocol.startsWith('http'))return;navigator.serviceWorker.register('/sw.js').then(reg=>{swRegistration=reg;if(reg.waiting)qs('#updateBanner').hidden=false;reg.addEventListener('updatefound',()=>{const w=reg.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)qs('#updateBanner').hidden=false})})}).catch(console.error);navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload())}

function formatSyncTime(value){if(!value)return'';try{return new Intl.DateTimeFormat('ar-SA',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(value))}catch{return''}}
function updateSyncUI(state={}){
  syncState={...syncState,...state};const configured=!!syncState.configured,user=syncState.session?.user||currentUser();
  const title=qs('#syncStatusTitle'),text=qs('#syncStatusText'),userText=qs('#syncUserText'),signIn=qs('#googleSignInBtn'),syncBtn=qs('#syncNowBtn'),outBtn=qs('#signOutBtn'),summary=qs('#syncSummaryText');
  if(!configured){title.textContent='المزامنة تحتاج إعدادًا';text.textContent='أضيفي SUPABASE_URL وSUPABASE_ANON_KEY في Vercel ثم فعّلي Google داخل Supabase.';userText.textContent='الحفظ المحلي مستمر دون أي مشكلة.';signIn.hidden=false;signIn.disabled=true;syncBtn.hidden=true;outBtn.hidden=true;summary.textContent='الحفظ المحلي يعمل — Supabase غير مهيأ بعد';return}
  signIn.disabled=false;
  if(user){const last=syncState.lastSyncAt?`آخر مزامنة: ${formatSyncTime(syncState.lastSyncAt)}`:'جاهزة للمزامنة';title.textContent=syncState.status==='syncing'?'جاري المزامنة…':'تم ربط حساب Google';text.textContent=syncState.status==='error'?'تعذر إكمال المزامنة الآن. حاولي مرة أخرى.':'بياناتك محفوظة محليًا وفي Supabase.';userText.textContent=`${user.email||''} — ${last}`;signIn.hidden=true;syncBtn.hidden=false;outBtn.hidden=false;summary.textContent=`متصل بـ Google — ${last}`}
  else{title.textContent='الحفظ المحلي يعمل';text.textContent='سجلي الدخول بحساب Google لحفظ البيانات ومزامنتها بين الأجهزة.';userText.textContent='لن يتوقف التطبيق إذا لم تسجلي الدخول.';signIn.hidden=false;syncBtn.hidden=true;outBtn.hidden=true;summary.textContent='الحفظ المحلي يعمل — سجلي Google للمزامنة بين الأجهزة'}
  if(syncState.status==='synced'&&syncState.lastSyncAt&&syncState.lastSyncAt!==lastAppliedSyncAt){lastAppliedSyncAt=syncState.lastSyncAt;hydrateState();renderAll({skipSyncUi:true})}
}

function renderAll({skipSyncUi=false}={}){
  qs('#todayLabel').textContent=todayArabic();setTheme(profile);renderPregnancy();renderHomePersonalization();renderWater();renderMood();renderTasks();renderSymptoms();renderCompletion();renderMeals();renderQuestions();renderAppointments();renderJournal();renderShopping();renderNausea();renderAhmedMessages();populateSettings();updateNetwork();if(!skipSyncUi)updateSyncUI(getSyncState());
}

function completeDailyChoice(){
  const choice=currentDailyChoice||selectDailyChoice(),type=choice[3];
  if(type==='water')changeWater(1);else if(type==='rest'){day.tasks.rest=true}else if(type==='produce'){day.tasks.produce=true}else if(type==='journal'){openModal('journalModal');return}else if(type==='care'){needAhmed();return}else if(type==='surprise'){day.secretRevealed=true}else if(type==='meal'||type==='snack'){openPage('food')}
  day.dailyChoiceDone=true;saveCurrentDay();renderDailyChoice();renderTasks();renderCompletion();renderSurprise();toast(`تمت خطوة اليوم يا ${name()} 🤍`);
}
function changeDay(){day.dailyVariant=(day.dailyVariant||0)+1;day.dailyChoiceDone=false;day.secretRevealed=false;saveCurrentDay();ensureMeals(true);renderHomePersonalization();renderMeals();vibrate(profile,[15,35,15]);toast(`جهزت لكِ يومًا مختلفًا يا ${name()} ✨`)}

function bind(){
  qsa('[data-page-target]').forEach(b=>b.onclick=()=>openPage(b.dataset.pageTarget));
  qsa('[data-modal]').forEach(b=>b.onclick=()=>{if(b.dataset.modal==='settingsModal')populateSettings();if(b.dataset.modal==='syncModal')updateSyncUI(syncState);if(b.dataset.modal==='ahmedMessagesModal')renderAhmedMessages();openModal(b.dataset.modal)});
  qsa('.close-modal').forEach(b=>b.onclick=()=>closeModal(b.closest('.modal-backdrop')));qsa('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m)}));
  qs('#waterPlus').onclick=()=>changeWater(1);qs('#waterMinus').onclick=()=>changeWater(-1);
  qsa('[data-mood]').forEach(b=>b.onclick=()=>{day.mood=b.dataset.mood;day.moodIcon=b.dataset.icon;day.dailyChoiceDone=false;saveCurrentDay();ensureMeals(true);renderMood();renderDailyChoice();renderMeals();renderCompletion();vibrate(profile)});
  qsa('[data-task]').forEach(i=>i.onchange=()=>{day.tasks[i.dataset.task]=i.checked;saveCurrentDay();renderTasks();renderVitaminReminder();renderCompletion();vibrate(profile)});
  bindSymptomButtons();
  qs('#completeDailyChoiceBtn').onclick=completeDailyChoice;qs('#changeDayBtn').onclick=changeDay;
  qs('#openSurpriseBtn').onclick=()=>{day.secretRevealed=true;saveCurrentDay();renderSurprise();vibrate(profile,[15,30,15])};
  qs('#vitaminDoneBtn').onclick=()=>{day.tasks.vitamin=true;day.vitaminSnoozedAt='';saveCurrentDay();renderTasks();renderVitaminReminder();renderCompletion();toast(`تم تسجيله يا ${name()} 🤍`)};
  qs('#vitaminLaterBtn').onclick=()=>{day.vitaminSnoozedAt=new Date(Date.now()+2*60*60*1000).toISOString();saveCurrentDay();renderVitaminReminder();toast('حسنًا، سنذكرك عند فتح التطبيق لاحقًا')};
  qs('#shuffleMealsBtn').onclick=()=>shuffleMeals();qs('#saveCareBtn').onclick=saveCare;qs('#resetDayBtn').onclick=resetDay;
  qs('#addQuestionBtn').onclick=addQuestion;qs('#foodSearchBtn').onclick=searchFood;qs('#foodSearchInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();searchFood()}};
  qs('#copyShoppingBtn').onclick=async()=>{const checked=qsa('[data-shop]:checked').map(i=>i.closest('label').textContent.trim()),list=checked.length?checked:shoppingBase;await navigator.clipboard.writeText(`قائمة تسوق ${name()} 🛒\n- `+list.join('\n- '));toast('تم نسخ القائمة')};
  qs('#favoritesButton').onclick=()=>{const names=favorites.map(x=>x.split('|')[1]);alert(names.length?'الوجبات المفضلة:\n• '+names.join('\n• '):'لا توجد وجبات مفضلة بعد.')};
  qs('#settingsForm').onsubmit=saveSettings;qs('#onboardingForm').onsubmit=onboard;
  qs('#appointmentForm').onsubmit=e=>{e.preventDefault();const now=new Date().toISOString();appointments.push({id:crypto.randomUUID?.()||String(Date.now()),date:qs('#appointmentDate').value,clinic:qs('#appointmentClinic').value.trim(),weight:qs('#appointmentWeight').value,bp:qs('#appointmentBp').value.trim(),notes:qs('#appointmentNotes').value.trim(),createdAt:now,updatedAt:now});saveAppointments(appointments);e.target.reset();closeAll();renderAppointments();toast('تم حفظ الموعد')};
  qs('#journalForm').onsubmit=e=>{e.preventDefault();const now=new Date().toISOString();journal.unshift({id:crypto.randomUUID?.()||String(Date.now()),title:qs('#journalTitle').value.trim(),body:qs('#journalBody').value.trim(),createdAt:now,updatedAt:now});saveJournal(journal);e.target.reset();closeAll();renderJournal();toast('حُفظت المذكرة')};
  qs('#memoryForm').onsubmit=async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;try{const image=await fileToDataUrl(qs('#memoryImage').files[0]);await addMemory({id:crypto.randomUUID?.()||String(Date.now()),title:qs('#memoryTitle').value.trim(),body:qs('#memoryBody').value.trim(),image,createdAt:new Date().toISOString()});e.target.reset();closeAll();renderMemories();toast('حُفظت الذكرى 🤍')}catch{toast('تعذر حفظ الصورة')}finally{btn.disabled=false}};
  qsa('[data-journal-tab]').forEach(b=>b.onclick=()=>{qsa('[data-journal-tab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');const mem=b.dataset.journalTab==='memories';qs('#journalNotes').hidden=mem;qs('#memoryGrid').hidden=!mem;if(mem)renderMemories()});
  qsa('[data-ai-task]').forEach(b=>b.onclick=()=>openAiForTask(b.dataset.aiTask));qsa('[data-ai-prompt]').forEach(b=>b.onclick=()=>{qs('#aiInput').value=b.dataset.aiPrompt;sendAi(b.dataset.aiPrompt);qs('#aiInput').value=''});
  qs('#aiForm').onsubmit=e=>{e.preventDefault();const m=qs('#aiInput').value.trim();if(!m)return;qs('#aiInput').value='';sendAi(m)};
  qs('#ahmedMessageForm').onsubmit=e=>{e.preventDefault();const text=qs('#ahmedMessageInput').value.trim();if(!text)return;const now=new Date().toISOString();ahmedMessages.unshift({id:crypto.randomUUID?.()||String(Date.now()),text,createdAt:now,updatedAt:now});saveAhmedMessages(ahmedMessages);e.target.reset();renderAhmedMessages();renderSurprise();toast('حُفظت رسالة أحمد 💌')};
  qs('#needAhmedBtn').onclick=needAhmed;qs('#shareSummaryBtn').onclick=shareSummary;qs('#backupBtn').onclick=backup;qs('#restoreInput').onchange=e=>restore(e.target.files[0]);qs('#calendarBtn').onclick=downloadCalendar;
  qs('#googleSignInBtn').onclick=async()=>{try{await signInWithGoogle()}catch(error){toast(error.message||'تعذر بدء تسجيل Google')}};
  qs('#syncNowBtn').onclick=async()=>{const btn=qs('#syncNowBtn');btn.disabled=true;try{const result=await syncNow();lastAppliedSyncAt=result.lastSyncAt;hydrateState();renderAll();toast('تمت المزامنة بنجاح ☁️')}catch(error){toast(error.message||'تعذرت المزامنة')}finally{btn.disabled=false}};
  qs('#signOutBtn').onclick=async()=>{try{await signOut();toast('تم تسجيل الخروج، والحفظ المحلي مستمر')}catch(error){toast(error.message||'تعذر تسجيل الخروج')}};
  qs('#installButton').onclick=installApp;qs('#installMoreBtn').onclick=installApp;qs('#themeToggle').onclick=()=>{profile=saveProfile({...profile,theme:profile.theme==='dark'?'light':'dark'});setTheme(profile)};
  qs('#applyUpdateBtn').onclick=()=>{if(swRegistration?.waiting)swRegistration.waiting.postMessage({type:'SKIP_WAITING'});else location.reload()};
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e});window.addEventListener('online',()=>{updateNetwork();queueSync(600)});window.addEventListener('offline',updateNetwork);
  window.addEventListener('aya:data-changed',()=>queueSync());
  let lastY=0;window.addEventListener('scroll',()=>{const y=window.scrollY;if(y>lastY&&y>140)qs('#bottomNav').classList.add('hidden');else qs('#bottomNav').classList.remove('hidden');lastY=y},{passive:true});
}

async function init(){
  bind();renderAll();setupServiceWorker();onSyncState(updateSyncUI);syncState=await initSync();updateSyncUI(syncState);
  if(!profile.onboarded)setTimeout(()=>openModal('onboardingModal'),250);
}
window.addEventListener('DOMContentLoaded',init);
