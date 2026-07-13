import { babySizes, pregnancyStages } from './data.js';

const DAY=86400000;
export function parseLocalDate(value){if(!value)return null;const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d,12,0,0,0)}
export function pregnancyFromLmp(lmpValue,now=new Date()){
  const lmp=parseLocalDate(lmpValue);if(!lmp)return null;
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);const elapsed=Math.max(0,Math.floor((today-lmp)/DAY));
  const completedWeeks=Math.floor(elapsed/7);const days=elapsed%7;const currentWeek=Math.min(40,completedWeeks+1);const due=new Date(lmp);due.setDate(due.getDate()+280);
  const remaining=Math.max(0,280-elapsed);const progress=Math.max(0,Math.min(100,(elapsed/280)*100));
  return {lmp,elapsed,completedWeeks,days,currentWeek,due,remaining,progress};
}
export function arDate(date,withWeekday=false){return new Intl.DateTimeFormat('ar-SA',{weekday:withWeekday?'long':undefined,day:'numeric',month:'long',year:'numeric'}).format(date)}
export function ageText(p){if(!p)return '';if(p.days===0)return `${p.completedWeeks} أسابيع بالضبط`;const weekWord=p.completedWeeks===1?'أسبوع':p.completedWeeks===2?'أسبوعان':'أسابيع';const dayWord=p.days===1?'يوم واحد':p.days===2?'يومان':`${p.days} أيام`;return `${p.completedWeeks} ${weekWord} + ${dayWord}`}
export function stageKey(week){if(week<=8)return '5-8';if(week<=12)return '9-12';if(week<=16)return '13-16';if(week<=20)return '17-20';if(week<=24)return '21-24';if(week<=27)return '25-27';return '28-40'}
export function babySize(week){return babySizes.find(x=>week>=x.from&&week<=x.to)||babySizes[0]}
export function treeStage(week){return pregnancyStages.find(x=>week<=x.max)||pregnancyStages.at(-1)}
