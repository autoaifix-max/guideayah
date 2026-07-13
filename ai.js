import { urgentPatterns } from './data.js';

export function hasUrgentSignal(text=''){const t=text.toLowerCase();return urgentPatterns.some(p=>t.includes(p.toLowerCase()))}
export async function callAyaAI({task='chat',message,context={},history=[]}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
  try{
    const res=await fetch('/api/aya-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task,message,context,history:history.slice(-6)}),signal:controller.signal});
    const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'تعذر الاتصال بالمساعد');return data;
  }finally{clearTimeout(timer)}
}
