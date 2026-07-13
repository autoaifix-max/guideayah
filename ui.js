let toastTimer;
export const qs=(s,p=document)=>p.querySelector(s);export const qsa=(s,p=document)=>[...p.querySelectorAll(s)];
export function toast(msg){const el=qs('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
export function openModal(id){qsa('.modal-backdrop.open').forEach(closeModal);const el=typeof id==='string'?qs('#'+id):id;if(!el)return;el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
export function closeModal(el){if(!el)return;el.classList.remove('open');el.setAttribute('aria-hidden','true');if(!qs('.modal-backdrop.open'))document.body.style.overflow=''}
export function closeAll(){qsa('.modal-backdrop.open').forEach(closeModal)}
export function vibrate(profile,pattern=15){if(profile.motion!=='off'&&navigator.vibrate)navigator.vibrate(pattern)}
export function confetti(profile){if(profile.motion==='off')return;const box=qs('#confetti');if(!box)return;box.innerHTML='';const colors=['#b96b85','#f6b8c7','#e4b66c','#92a978','#8fc8e2'];for(let i=0;i<28;i++){const p=document.createElement('i');p.style.left=Math.random()*100+'%';p.style.background=colors[i%colors.length];p.style.animationDelay=Math.random()*.25+'s';box.appendChild(p)}setTimeout(()=>box.innerHTML='',1900)}
export function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
export function setTheme(profile){
  const h=new Date().getHours();document.body.dataset.time=(h>=19||h<6)?'night':'day';document.body.dataset.motion=profile.motion||'full';
  if(profile.theme==='light'||profile.theme==='dark')document.body.dataset.theme=profile.theme;else delete document.body.dataset.theme;
  const toggle=qs('#themeToggle');if(toggle)toggle.textContent=((profile.theme==='dark')||(profile.theme==='auto'&&(h>=19||h<6)))?'☀':'☾';
}
export function formatTimeAgo(date){const d=new Date(date),diff=Date.now()-d;const days=Math.floor(diff/86400000);if(days===0)return 'اليوم';if(days===1)return 'أمس';return `منذ ${days} أيام`}
