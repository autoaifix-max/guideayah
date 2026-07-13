import { exportData, importData, loadMeta, saveMeta } from './storage.js';

let supabase=null;
let session=null;
let config=null;
let initialized=false;
let syncTimer=null;
let listeners=new Set();

function emit(state={}){
  const meta=loadMeta();
  const payload={configured:Boolean(config?.configured),session,lastSyncAt:meta.lastSyncAt||'',...state};
  listeners.forEach(fn=>{try{fn(payload)}catch(error){console.error(error)}});
}
export function onSyncState(fn){listeners.add(fn);return()=>listeners.delete(fn)}
export function getSyncState(){const meta=loadMeta();return{configured:Boolean(config?.configured),session,lastSyncAt:meta.lastSyncAt||''}}

async function getConfig(){
  const res=await fetch('/api/supabase-config',{cache:'no-store'});
  if(!res.ok)throw new Error('تعذر قراءة إعدادات المزامنة');
  return res.json();
}

async function createSupabase(){
  config=await getConfig();
  if(!config.configured)return null;
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
  return createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}

export async function initSync(){
  if(initialized)return getSyncState();
  initialized=true;
  try{
    supabase=await createSupabase();
    if(!supabase){emit({status:'not-configured'});return getSyncState()}
    const {data}=await supabase.auth.getSession();session=data.session||null;
    supabase.auth.onAuthStateChange((event,newSession)=>{
      session=newSession||null;emit({status:event.toLowerCase()});
      if(session&&(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'))queueSync(500);
    });
    emit({status:session?'signed-in':'signed-out'});
    if(session)queueSync(800);
  }catch(error){console.error(error);emit({status:'error',error:error.message})}
  return getSyncState();
}

export async function signInWithGoogle(){
  if(!supabase)await initSync();
  if(!supabase)throw new Error('المزامنة غير مهيأة بعد. أضيفي إعدادات Supabase في Vercel.');
  const redirectTo=`${location.origin}${location.pathname}`;
  const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
  if(error)throw error;
}

export async function signOut(){
  if(!supabase)return;
  const {error}=await supabase.auth.signOut();if(error)throw error;
  session=null;emit({status:'signed-out'});
}

function newest(a,b){
  const ta=Date.parse(a?.updatedAt||a?.updated_at||0)||0;
  const tb=Date.parse(b?.updatedAt||b?.updated_at||0)||0;
  return tb>ta?b:a;
}
function mergeById(local=[],cloud=[]){
  const map=new Map();
  [...cloud,...local].forEach(item=>{
    const id=item?.id||JSON.stringify(item);
    if(!map.has(id))map.set(id,item);else map.set(id,newest(map.get(id),item));
  });
  return [...map.values()].sort((a,b)=>(Date.parse(b.createdAt||b.date||0)||0)-(Date.parse(a.createdAt||a.date||0)||0));
}
export function mergePayloads(local={},cloud={}){
  const days={...(cloud.days||{})};
  Object.entries(local.days||{}).forEach(([key,value])=>{days[key]=days[key]?newest(days[key],value):value});
  const profile=newest(cloud.profile||{},local.profile||{});
  return {
    version:Math.max(local.version||0,cloud.version||0),
    exportedAt:new Date().toISOString(),
    profile,
    days,
    questions:[...new Set([...(cloud.questions||[]),...(local.questions||[])])],
    journal:mergeById(local.journal,cloud.journal),
    appointments:mergeById(local.appointments,cloud.appointments),
    favorites:[...new Set([...(cloud.favorites||[]),...(local.favorites||[])])],
    ahmedMessages:mergeById(local.ahmedMessages,cloud.ahmedMessages)
  };
}

export async function syncNow({silent=false}={}){
  if(!supabase)await initSync();
  if(!supabase)throw new Error('أضيفي SUPABASE_URL وSUPABASE_ANON_KEY في Vercel أولًا.');
  const {data:{session:current}}=await supabase.auth.getSession();session=current||null;
  if(!session)throw new Error('سجلي الدخول بحساب Google أولًا.');
  if(!silent)emit({status:'syncing'});
  const local=exportData();
  const {data:row,error:readError}=await supabase.from('aya_user_data').select('payload,updated_at').eq('user_id',session.user.id).maybeSingle();
  if(readError)throw readError;
  const merged=row?.payload?mergePayloads(local,row.payload):local;
  window.__AYA_SYNC_APPLYING__=true;
  try{importData(merged,{silent:true})}finally{window.__AYA_SYNC_APPLYING__=false}
  const {error:writeError}=await supabase.from('aya_user_data').upsert({user_id:session.user.id,payload:merged,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(writeError)throw writeError;
  const now=new Date().toISOString();saveMeta({lastSyncAt:now,lastSyncUser:session.user.email||''},{silent:true});
  emit({status:'synced',lastSyncAt:now});
  return{merged,user:session.user,lastSyncAt:now};
}

export function queueSync(delay=1800){
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>{if(session&&navigator.onLine)syncNow({silent:true}).catch(error=>{console.error(error);emit({status:'error',error:error.message})})},delay);
}

export function currentUser(){return session?.user||null}
