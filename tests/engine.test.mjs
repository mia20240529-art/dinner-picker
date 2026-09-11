import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateDishes,generateMeal,mealTime,mealKey,isMealValid} from '../js/engine.js';
import {loadState,saveState,emptyState,STORAGE_KEY} from '../js/storage.js';
import {parseSharedMeal,buildShareUrl,formatMealText,isShareMealUsable} from '../js/share.js';
const dishes=JSON.parse(await readFile(new URL('../data/dishes.json',import.meta.url),'utf8'));
const get=id=>dishes.find(d=>d.id===id);
function seeded(seed=42){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
test('完整菜库、双角色及永久排除规则',()=>{
  assert.equal(validateDishes(dishes).length,138);
  for(const [role,count]of[['main',71],['side',39],['soup',28],['staple',1]])assert.equal(dishes.filter(d=>d.roles.includes(role)).length,count);
  for(const d of dishes){assert.ok(d.steps.length>=4);assert.ok(d.substitutions.length>0);}
  assert.deepEqual(get('tomato_egg').roles,['main','side']);
  const bad=structuredClone(dishes);bad[0].substitutions.push('紫菜');assert.throws(()=>validateDishes(bad),/排除/);
});
test('300轮推荐遵守搭配、清淡、快速与米饭规则',()=>{
  const rng=seeded();
  for(const mode of ['random','light','quick']){
    const context=emptyState();
    for(let i=0;i<100;i++){
      const m=generateMeal(dishes,context,{mode,rng});assert.ok(isMealValid(m,dishes));assert.equal(m.staple,'rice');
      const main=get(m.main),side=get(m.side),soup=get(m.soup);
      assert.equal(new Set([m.main,m.side,m.soup]).size,3);
      if(main.tags.includes('西兰花'))assert.ok(!side.tags.includes('西兰花'));
      if(main.oily||main.tags.includes('重口'))assert.ok(side.light&&soup.light);
      if(main.brothy||main.tags.includes('咖喱'))assert.equal(m.includeSoup,false);else assert.equal(m.includeSoup,true);
      if(mode==='quick')assert.ok(mealTime(m,dishes)<=30);
      if(mode==='light')assert.ok(main.light&&side.light&&soup.light);
      if(context.current)assert.notEqual(mealKey(m),mealKey(context.current));
      context.current=m;context.generated=[m,...context.generated].slice(0,3);
    }
  }
});
test('逐菜更换保持其他菜品；换主菜只修复必要搭配',()=>{
  const rng=seeded(9);
  for(let i=0;i<40;i++){
    const current=generateMeal(dishes,{}, {rng,mode:'random'});
    for(const role of ['side','soup']){
      const next=generateMeal(dishes,{current},{swap:role,rng});assert.ok(next);assert.notEqual(next[role],current[role]);
      for(const r of ['main','side','soup','staple'].filter(r=>r!==role))assert.equal(next[r],current[r]);
    }
  }
  const current={main:'tomato_chicken',side:'plain_broccoli',soup:'tomato_egg_soup',staple:'rice',includeSoup:true,mode:'random'};
  const repaired=generateMeal(dishes,{current},{mainId:'broccoli_shrimp',rng});
  assert.notEqual(repaired.side,'plain_broccoli');assert.equal(repaired.soup,current.soup);
  const preserved=generateMeal(dishes,{current},{mainId:'pepper_chicken',rng});
  assert.equal(preserved.side,current.side);assert.equal(preserved.soup,current.soup);
});
test('手动选菜、炖菜可选汤与快速无解安全返回',()=>{
  for(const d of dishes.filter(d=>d.roles.includes('main')))assert.equal(generateMeal(dishes,{}, {mainId:d.id,rng:seeded()}).main,d.id);
  assert.equal(generateMeal(dishes,{}, {mainId:'tomato_brisket',mode:'quick'}),null);
  const stew=generateMeal(dishes,{}, {mainId:'lotus_ribs'});assert.equal(stew.includeSoup,false);
  assert.ok(get(stew.main).starchy);assert.equal(stew.staple,'rice');
  assert.throws(()=>generateMeal(dishes,{}, {mainId:'rice'}));
  assert.throws(()=>generateMeal(dishes,{}, {mode:'invalid'}));
});
test('最近记录降低重复；收藏在合理搭配内提高权重',()=>{
  const target='pan_cod',rngA=seeded(81),rngB=seeded(81),rngC=seeded(81);
  let baseline=0,recent=0,favorite=0;
  for(let i=0;i<140;i++){
    baseline+=generateMeal(dishes,{}, {rng:rngA}).main===target;
    recent+=generateMeal(dishes,{history:[{main:target}]},{rng:rngB}).main===target;
    favorite+=generateMeal(dishes,{preferFavorites:true,favorites:[target]},{rng:rngC}).main===target;
  }
  assert.ok(recent<baseline,`${recent} < ${baseline}`);assert.ok(favorite>baseline,`${favorite} > ${baseline}`);
});
test('本地存储恢复、去除失效ID、损坏与拒绝写入回退',()=>{
  const storage={data:null,getItem(){return this.data;},setItem(k,v){assert.equal(k,STORAGE_KEY);this.data=v;}};
  const s=emptyState();s.current=generateMeal(dishes);s.generated=[s.current];s.favorites=['pan_cod','not_a_dish','pan_cod'];s.preferFavorites=true;
  s.history=[{...s.current,soup:null,date:new Date().toISOString()}];assert.equal(saveState(storage,s),true);
  const loaded=loadState(storage,dishes).state;assert.deepEqual(loaded.current,s.current);assert.deepEqual(loaded.favorites,['pan_cod']);assert.equal(loaded.history[0].soup,null);assert.equal(loaded.preferFavorites,true);
  storage.data='{broken';assert.ok(loadState(storage,dishes).warning);assert.equal(loadState(null,dishes).state.current,null);
  assert.equal(saveState({setItem(){throw new Error('quota');}},s),false);
});
test('分享链接编码完整套餐并保留可读菜单',()=>{
  const meal={main:'beef_green_pepper',side:'lotus_slices',soup:'luffa_egg_soup',staple:'rice',includeSoup:true,mode:'random'};
  const url=buildShareUrl('https://example.com/dinner-picker/?old=1#old',meal);
  assert.equal(url,'https://example.com/dinner-picker/?main=beef_green_pepper&side=lotus_slices&soup=luffa_egg_soup&staple=rice');
  const parsed=parseSharedMeal(new URL(url).search,dishes,meal);
  assert.deepEqual(parsed,{meal,missing:[]});
  const text=formatMealText(meal,dishes);
  assert.match(text,/主菜：青椒炒牛肉/);assert.match(text,/配菜：清炒藕片/);assert.match(text,/汤：丝瓜鸡蛋汤/);assert.match(text,/主食：米饭/);
  assert.equal(isShareMealUsable(parsed.meal,dishes),true);
});
test('分享链接的未知菜品会被忽略并自动补齐',()=>{
  const fallback={main:'beef_green_pepper',side:'lotus_slices',soup:'luffa_egg_soup',staple:'rice',includeSoup:true,mode:'random'};
  const parsed=parseSharedMeal('?main=unknown_main&side=unknown_side&soup=tomato_egg_soup&staple=unknown_rice',dishes,fallback);
  assert.equal(parsed.meal.soup,'tomato_egg_soup');assert.equal(parsed.meal.staple,'rice');assert.ok(parsed.missing.some(x=>x.includes('主菜')));assert.ok(parsed.missing.some(x=>x.includes('配菜')));assert.ok(parsed.missing.some(x=>x.includes('主食')));assert.equal(isShareMealUsable(parsed.meal,dishes),true);
});
test('缺少分享参数时保持普通首页，汤可标记为可选',()=>{
  const fallback={main:'lotus_ribs',side:'plain_greens',soup:'tomato_egg_soup',staple:'rice',includeSoup:false,mode:'random'};
  assert.deepEqual(parseSharedMeal('',dishes,fallback),{meal:null,missing:[]});
  const parsed=parseSharedMeal('?main=lotus_ribs&side=plain_greens&soup=tomato_egg_soup&staple=rice&soupIncluded=0',dishes,fallback);
  assert.equal(parsed.meal.includeSoup,false);assert.equal(parsed.meal.main,'lotus_ribs');assert.equal(parsed.missing.length,0);
});
