export const SHARE_ROLES=['main','side','soup','staple'];
export const SHARE_LABELS={main:'主菜',side:'配菜',soup:'汤',staple:'主食'};
const MODES=['random','light','quick'];

function roleMatches(dish,role){return !!dish&&Array.isArray(dish.roles)&&dish.roles.includes(role);}
export function isShareMealUsable(meal,dishes){
  if(!meal||typeof meal.includeSoup!=='boolean'||!MODES.includes(meal.mode))return false;
  if(!SHARE_ROLES.every(role=>roleMatches(dishes.find(d=>d.id===meal[role]),role)))return false;
  return new Set(['main','side','soup'].map(role=>meal[role])).size===3;
}

export function parseSharedMeal(search,dishes,fallback){
  const params=new URLSearchParams(search||'');
  const hasShareParams=SHARE_ROLES.some(role=>params.has(role))||params.has('soupIncluded')||params.has('mode');
  if(!hasShareParams)return {meal:null,missing:[]};
  const requested={};
  const missing=[];
  for(const role of SHARE_ROLES){
    const id=params.get(role);
    if(!id)continue;
    if(roleMatches(dishes.find(d=>d.id===id),role))requested[role]=id;
    else missing.push(`${SHARE_LABELS[role]}（${id}）`);
  }
  const requestedMode=MODES.includes(params.get('mode'))?params.get('mode'):'random';
  const includeSoup=params.get('soupIncluded')!=='0';
  let candidate={...fallback,...requested,mode:requestedMode,includeSoup};
  if(!isShareMealUsable(candidate,dishes)){
    candidate={...fallback,mode:'random',includeSoup};
    for(const role of SHARE_ROLES){
      if(!requested[role])continue;
      const trial={...candidate,[role]:requested[role]};
      if(isShareMealUsable(trial,dishes))candidate=trial;
      else missing.push(`${SHARE_LABELS[role]}搭配不适合`);
    }
  }
  return {meal:candidate,missing:[...new Set(missing)]};
}

export function buildShareUrl(href,meal){
  const url=new URL(href);
  url.search='';
  url.hash='';
  const params=new URLSearchParams();
  for(const role of SHARE_ROLES)params.set(role,meal[role]);
  if(!meal.includeSoup)params.set('soupIncluded','0');
  if(meal.mode&&meal.mode!=='random')params.set('mode',meal.mode);
  url.search=params.toString();
  return url.toString();
}

export function formatMealText(meal,dishes){
  const name=role=>dishes.find(d=>d.id===meal[role])?.name||'待补充';
  return ['今晚吃什么','',`主菜：${name('main')}`,`配菜：${name('side')}`,`汤：${name('soup')}${meal.includeSoup?'':'（可选）'}`,`主食：${name('staple')}`,'','2人份 · 打开链接可查看菜谱'].join('\n');
}
