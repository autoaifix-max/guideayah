import { APP_VERSION } from './data.js';

export const KEYS = {
  root:'aya-guide-v3',
  profile:'aya-guide-profile-v3',
  questions:'aya-guide-questions-v3',
  journal:'aya-guide-journal-v3',
  appointments:'aya-guide-appointments-v3',
  favorites:'aya-guide-favorites-v3',
  ahmedMessages:'aya-guide-ahmed-messages-v4',
  meta:'aya-guide-meta-v3'
};

export const dateKey = () => new Date().toLocaleDateString('en-CA');

function notifyChange(key){
  if(typeof window==='undefined'||window.__AYA_SYNC_APPLYING__)return;
  window.dispatchEvent(new CustomEvent('aya:data-changed',{detail:{key,at:new Date().toISOString()}}));
}

export function loadJSON(key,fallback){
  try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}
}
export function saveJSON(key,value,{silent=false}={}){
  localStorage.setItem(key,JSON.stringify(value));
  if(!silent)notifyChange(key);
}

export function listFromText(value){
  if(Array.isArray(value))return value.map(x=>String(x).trim()).filter(Boolean);
  return String(value||'').split(/[،,\n]/u).map(x=>x.trim()).filter(Boolean);
}
export function textFromList(value){return (Array.isArray(value)?value:[]).join('، ')}

export function defaultProfile(){
  return {
    name:'نبض',partnerName:'أحمد',babyName:'',lmp:'',phone:'',doctorName:'',hospital:'',
    pregnancyNumber:'first',fetuses:'1',theme:'auto',motion:'full',aiConsent:false,onboarded:false,
    messageLength:'short',reminderLevel:'few',reminderMorning:'09:00',reminderEvening:'20:00',
    tone:'calm',favoriteFoods:[],foodAversions:[],smellAversions:[],frequentSymptoms:[],
    surpriseLevel:'medium',updatedAt:new Date(0).toISOString(),dataVersion:APP_VERSION
  };
}

export function defaultDay(){
  return {
    water:0,tasks:{},mood:'',moodIcon:'',symptoms:[],note:'',meals:{},mealIndexes:{},
    secretRevealed:false,secretIndex:null,dailyVariant:0,dailyChoiceDone:false,
    vitaminSnoozedAt:'',celebrated:false,updatedAt:new Date().toISOString()
  };
}

export function migrateLegacy(){
  const meta=loadJSON(KEYS.meta,{});
  if(!meta.migratedV2){
    const legacyProfile=loadJSON('aya-guide-profile-v2',null);
    if(legacyProfile && !localStorage.getItem(KEYS.profile)){
      saveJSON(KEYS.profile,{...defaultProfile(),lmp:legacyProfile.lmp||'',phone:legacyProfile.ahmedPhone||'',onboarded:!!legacyProfile.lmp},{silent:true});
      if(legacyProfile.appointment && !localStorage.getItem(KEYS.appointments)){
        saveJSON(KEYS.appointments,[{id:'legacy-appointment',date:legacyProfile.appointment,clinic:legacyProfile.clinic||'',weight:'',bp:'',notes:'تم ترحيله من النسخة السابقة',updatedAt:new Date().toISOString()}],{silent:true});
      }
    }
    const legacyDays=loadJSON('aya-guide-v2',null);if(legacyDays && !localStorage.getItem(KEYS.root))saveJSON(KEYS.root,legacyDays,{silent:true});
    const legacyQuestions=loadJSON('aya-guide-questions-v2',null);if(legacyQuestions && !localStorage.getItem(KEYS.questions))saveJSON(KEYS.questions,legacyQuestions,{silent:true});
    meta.migratedV2=true;meta.migratedAt=new Date().toISOString();
  }
  if(!meta.migratedV4){
    const p={...defaultProfile(),...loadJSON(KEYS.profile,{})};
    if(!p.name||p.name==='آية')p.name='نبض';
    p.favoriteFoods=listFromText(p.favoriteFoods);p.foodAversions=listFromText(p.foodAversions);p.smellAversions=listFromText(p.smellAversions);p.frequentSymptoms=listFromText(p.frequentSymptoms);
    p.updatedAt=p.updatedAt&&p.updatedAt!==new Date(0).toISOString()?p.updatedAt:new Date().toISOString();
    saveJSON(KEYS.profile,p,{silent:true});
    meta.migratedV4=true;meta.migratedV4At=new Date().toISOString();
  }
  saveJSON(KEYS.meta,{...meta,dataVersion:APP_VERSION},{silent:true});
}

function normalizeProfile(raw={}){
  const p={...defaultProfile(),...raw};
  if(!p.name||p.name==='آية')p.name='نبض';
  ['favoriteFoods','foodAversions','smellAversions','frequentSymptoms'].forEach(k=>p[k]=listFromText(p[k]));
  return p;
}

export function loadProfile(){return normalizeProfile(loadJSON(KEYS.profile,{}))}
export function saveProfile(profile,{silent=false}={}){
  const next=normalizeProfile({...profile,updatedAt:new Date().toISOString(),dataVersion:APP_VERSION});
  saveJSON(KEYS.profile,next,{silent});return next;
}
export function loadAllDays(){return loadJSON(KEYS.root,{})}
export function loadDay(key=dateKey()){
  const all=loadAllDays();const loaded={...defaultDay(),...(all[key]||{})};loaded.tasks={...(loaded.tasks||{})};loaded.meals={...(loaded.meals||{})};loaded.mealIndexes={...(loaded.mealIndexes||{})};loaded.symptoms=Array.isArray(loaded.symptoms)?loaded.symptoms:[];
  if(loaded.tasks.folic&&!loaded.tasks.vitamin)loaded.tasks.vitamin=true;if(loaded.tasks.fruit&&!loaded.tasks.produce)loaded.tasks.produce=true;return loaded;
}
export function saveDay(day,key=dateKey(),{silent=false}={}){
  const all=loadAllDays();all[key]={...day,updatedAt:new Date().toISOString()};saveJSON(KEYS.root,all,{silent});return all[key];
}
export function recentDays(limit=7){
  return Object.entries(loadAllDays()).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,limit).map(([date,data])=>({date,...data}));
}
export function loadQuestions(){return loadJSON(KEYS.questions,['ما الفحوصات المطلوبة في الزيارة القادمة؟'])}
export function saveQuestions(v,{silent=false}={}){saveJSON(KEYS.questions,v,{silent})}
export function loadJournal(){return loadJSON(KEYS.journal,[])}
export function saveJournal(v,{silent=false}={}){saveJSON(KEYS.journal,v,{silent})}
export function loadAppointments(){return loadJSON(KEYS.appointments,[])}
export function saveAppointments(v,{silent=false}={}){saveJSON(KEYS.appointments,v,{silent})}
export function loadFavorites(){return loadJSON(KEYS.favorites,[])}
export function saveFavorites(v,{silent=false}={}){saveJSON(KEYS.favorites,v,{silent})}
export function loadAhmedMessages(){return loadJSON(KEYS.ahmedMessages,[])}
export function saveAhmedMessages(v,{silent=false}={}){saveJSON(KEYS.ahmedMessages,v,{silent})}
export function loadMeta(){return loadJSON(KEYS.meta,{})}
export function saveMeta(v,{silent=true}={}){saveJSON(KEYS.meta,{...loadMeta(),...v,dataVersion:APP_VERSION},{silent})}

export function exportData(){
  return {
    version:APP_VERSION,exportedAt:new Date().toISOString(),profile:loadProfile(),days:loadAllDays(),
    questions:loadQuestions(),journal:loadJournal(),appointments:loadAppointments(),favorites:loadFavorites(),
    ahmedMessages:loadAhmedMessages()
  };
}

export function importData(data,{silent=false}={}){
  if(!data||typeof data!=='object'||(!data.days&&!data.profile))throw new Error('invalid');
  const opts={silent};
  if(data.profile)saveJSON(KEYS.profile,normalizeProfile({...data.profile,dataVersion:APP_VERSION}),opts);
  if(data.days)saveJSON(KEYS.root,data.days,opts);
  if(Array.isArray(data.questions))saveJSON(KEYS.questions,data.questions,opts);
  if(Array.isArray(data.journal))saveJSON(KEYS.journal,data.journal,opts);
  if(Array.isArray(data.appointments))saveJSON(KEYS.appointments,data.appointments,opts);
  if(Array.isArray(data.favorites))saveJSON(KEYS.favorites,data.favorites,opts);
  if(Array.isArray(data.ahmedMessages))saveJSON(KEYS.ahmedMessages,data.ahmedMessages,opts);
}

const DB='aya-guide-media-v1', STORE='memories';
function db(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
export async function addMemory(memory){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put(memory);tx.oncomplete=()=>{notifyChange('memories');resolve(memory)};tx.onerror=()=>reject(tx.error)})}
export async function listMemories(){const d=await db();return new Promise((resolve,reject)=>{const req=d.transaction(STORE).objectStore(STORE).getAll();req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));req.onerror=()=>reject(req.error)})}
export async function deleteMemory(id){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=()=>{notifyChange('memories');resolve()};tx.onerror=()=>reject(tx.error)})}
export function fileToDataUrl(file,max=1400,quality=.82){return new Promise((resolve,reject)=>{if(!file)return resolve('');const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{const scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',quality))};img.onerror=reject;img.src=url})}
