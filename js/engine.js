export const ROLES=['main','side','soup'];
export const MODES=['random','light','quick'];
const forbidden=/海带|紫菜|茄子|动物内脏|猪肝|鸡肝|鸭肝|猪腰|肥肠|猪心|鸡心|牛肚/;
export function validateDishes(data){
  if(!Array.isArray(data)||data.length<30)throw new Error('菜库需要至少30道菜');
  const ids=new Set();
  for(const d of data){
    if(!d||typeof d.id!=='string'||!/^[a-z0-9_]+$/.test(d.id)||ids.has(d.id))throw new Error('编号缺失或重复');
    ids.add(d.id);
    if(forbidden.test(JSON.stringify(d)))throw new Error('菜库含排除的食材');
    for(const k of ['name','category','category_label','difficulty','note'])if(typeof d[k]!=='string')throw new Error('文字字段不完整');
    for(const k of ['roles','ingredients','seasonings','steps','tags','avoid_pair_tags','substitutions'])if(!Array.isArray(d[k])||!d[k].every(v=>typeof v==='string'))throw new Error('列表字段不完整');
    if(!d.roles.length||d.roles.some(r=>![...ROLES,'staple'].includes(r))||!d.roles.includes(d.role)||!d.ingredients.length||!d.steps.length||d.servings!==2||!Number.isFinite(d.time)||d.time<=0)throw new Error('份量、时间或步骤无效');
    for(const k of ['light','oily','starchy','brothy'])if(typeof d[k]!=='boolean')throw new Error('标记不完整');
  }
  for(const role of [...ROLES,'staple'])if(!data.some(d=>d.roles.includes(role)))throw new Error('菜库分类不完整');
  return data;
}
export function mealKey(m){return [m.main,m.side,m.includeSoup?m.soup:'',m.staple].join('|');}
export function isMealValid(m,dishes){return !!m&&typeof m.includeSoup==='boolean'&&MODES.includes(m.mode)&&[...ROLES,'staple'].every(r=>dishes.some(d=>d.id===m[r]&&d.roles.includes(r)))&&new Set(ROLES.map(r=>m[r])).size===3;}
export function mealTime(m,dishes){const get=id=>dishes.find(d=>d.id===id);return Math.max(get(m.staple).time,get(m.main).time+get(m.side).time+(m.includeSoup?get(m.soup).time:0));}
function compatible(main,side,soup){
  if(new Set([main.id,side.id,soup.id]).size<3)return false;
  if(main.tags.includes('西兰花')&&side.tags.includes('西兰花'))return false;
  return !(main.oily||main.tags.includes('重口'))||(side.light&&soup.light);
}
function repeatWeight(d,role,context){const recent=[...(context.generated||[]).slice(0,3),...(context.history||[]).slice(0,3)];const count=recent.filter(m=>m[role]===d.id).length;return count?.035/count:1;}
function affinity(main,side,soup){let score=1;for(const [a,b] of [[main,side],[main,soup],[side,soup]]){const overlap=a.tags.filter(t=>b.tags.includes(t)&&!['蒸','炖菜','凉拌','重口','煎'].includes(t)).length;score*=Math.pow(.22,overlap);if(a.avoid_pair_tags.some(t=>b.tags.includes(t)))score*=.1;}if(main.light&&!side.light)score*=1.3;return score;}
function weightedPick(items,rng){let target=rng()*items.reduce((n,x)=>n+x.weight,0);for(const item of items){target-=item.weight;if(target<=0)return item;}return items.at(-1);}
// Dishes cook sequentially; the rice cooker runs alongside them.
// Side/soup swaps preserve other dishes. Main swaps repair only incompatible accompaniments.
export function generateMeal(dishes,context={},options={}){
  const mode=options.mode||context.current?.mode||'random',old=context.current,swap=options.swap;
  if(!MODES.includes(mode))throw new Error('不支持的推荐模式');
  if(swap&&(!ROLES.includes(swap)||!isMealValid(old,dishes)))throw new Error('无法更换此菜品');
  const pools=Object.fromEntries(ROLES.map(role=>[role,dishes.filter(d=>d.roles.includes(role))]));
  if(options.mainId){pools.main=pools.main.filter(d=>d.id===options.mainId);if(!pools.main.length)throw new Error('所选菜品不是主菜');}
  if(swap){pools[swap]=pools[swap].filter(d=>d.id!==old[swap]);if(swap!=='main')for(const r of ROLES.filter(r=>r!==swap))pools[r]=pools[r].filter(d=>d.id===old[r]);}
  const staple=dishes.find(d=>d.roles.includes('staple')).id,candidates=[];
  for(const main of pools.main)for(const side of pools.side)for(const soup of pools.soup){
    if(!compatible(main,side,soup))continue;
    if(mode==='light'&&(!main.light||!side.light||!soup.light))continue;
    const includeSoup=swap&&swap!=='main'?(swap==='soup'?true:old.includeSoup):!main.brothy;
    const meal={main:main.id,side:side.id,soup:soup.id,staple,includeSoup,mode};
    if(mode==='quick'&&mealTime(meal,dishes)>30)continue;
    let weight=affinity(main,side,soup);
    for(const [role,d]of[['main',main],['side',side],['soup',soup]]){weight*=repeatWeight(d,role,context);if(context.preferFavorites&&context.favorites?.includes(d.id))weight*=4;}
    if(old&&mealKey(meal)===mealKey(old))weight*=.001;
    const repairs=(swap==='main'||options.mainId)&&old?Number(side.id!==old.side)+Number(soup.id!==old.soup):0;
    candidates.push({meal,weight,repairs});
  }
  if(!candidates.length)return null;
  let selection=candidates;
  if(swap==='main'||options.mainId){const min=Math.min(...selection.map(x=>x.repairs));selection=selection.filter(x=>x.repairs===min);}
  if(old&&!swap&&!options.mainId&&selection.some(x=>mealKey(x.meal)!==mealKey(old)))selection=selection.filter(x=>mealKey(x.meal)!==mealKey(old));
  return weightedPick(selection,options.rng||Math.random).meal;
}
