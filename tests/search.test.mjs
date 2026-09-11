import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {searchDishes} from '../js/search.js';
import {generateMeal,validateDishes} from '../js/engine.js';
import {parseSharedMeal,buildShareUrl} from '../js/share.js';
const dishes=JSON.parse(await readFile(new URL('../data/dishes.json',import.meta.url),'utf8'));
test('新增80道菜沿用schema、菜名和ID唯一、食材与替换项不含忌口',()=>{
  assert.equal(dishes.length,138);assert.equal(validateDishes(dishes).length,138);
  assert.equal(new Set(dishes.map(d=>d.name)).size,138);
  assert.equal(new Set(dishes.map(d=>d.id)).size,138);
  const expected=Object.keys(dishes[0]).sort();
  for(const d of dishes.slice(58)){
    assert.deepEqual(Object.keys(d).sort(),expected);assert.equal(d.servings,2);
    assert.ok(d.ingredients.length&&d.seasonings.length&&d.steps.length>=4&&d.tags.length&&d.substitutions.length&&d.note);
  }
  for(const d of dishes)assert.doesNotMatch(JSON.stringify(d),/海带|紫菜|茄子|内脏|猪肝|鸡肝|鸭肝|猪腰|肥肠|猪心|鸡心|牛肚|味噌|蟹(?!味菇)/,d.name);
  for(const d of dishes.filter(d=>/四季豆|豆角/.test(JSON.stringify(d))))assert.ok(d.steps.some(s=>s.includes('彻底加热熟透，不可夹生')),d.name);
  const duplicate=structuredClone(dishes);duplicate[1].name=duplicate[0].name;assert.throws(()=>validateDishes(duplicate),/菜名重复/);
});
test('搜索菜名、食材、分类、标签，空白及多关键词不出错',()=>{
  for(const q of ['牛肉','虾','咖喱','四季豆','豆角','快手','清淡'])assert.ok(searchDishes(dishes,q).length>0,q);
  assert.ok(searchDishes(dishes,'椰子鸡').some(d=>d.id==='coconut_chicken_hotpot'));
  assert.ok(searchDishes(dishes,'洋葱').some(d=>d.id==='curry_chicken'));
  assert.ok(searchDishes(dishes,'鱼类').some(d=>d.id==='steamed_bass'));
  assert.ok(searchDishes(dishes,'川味').some(d=>d.id==='yuxiang_pork'));
  assert.ok(searchDishes(dishes,'  咖喱  鸡肉  ').every(d=>d.category==='chicken'));
  assert.equal(searchDishes(dishes,'不存在的菜').length,0);
  assert.equal(searchDishes(dishes,'<script>').length,0);
  assert.equal(searchDishes(dishes,'  ').length,138);
});
test('筛选与关键词组合使用；30分钟以内是单道菜耗时',()=>{
  for(const role of ['main','side','soup']){
    const results=searchDishes(dishes,'',role);assert.ok(results.length);assert.ok(results.every(d=>d.roles.includes(role)));
  }
  assert.ok(searchDishes(dishes,'虾','quick').every(d=>d.time<=30));
  assert.ok(searchDishes(dishes,'','light').every(d=>d.light));
  assert.equal(searchDishes(dishes,'咖喱','soup').length,0);
  assert.ok(searchDishes(dishes,'四季豆','side').length>=2);
});
test('搜索选中的新主菜可配套餐，咖喱和一锅菜的汤可选，分享可还原',()=>{
  const mains=dishes.slice(58).filter(d=>d.roles.includes('main'));
  for(const d of mains){
    const meal=generateMeal(dishes,{}, {mainId:d.id,rng:()=>.37});
    assert.equal(meal.main,d.id);assert.equal(meal.staple,'rice');
    if(d.brothy||d.tags.includes('咖喱'))assert.equal(meal.includeSoup,false,d.name);
    if(d.tags.includes('咖喱')){const side=dishes.find(x=>x.id===meal.side);assert.ok(side.light&&!side.starchy&&!side.oily,d.name);}
    const url=buildShareUrl('https://mia20240529-art.github.io/dinner-picker/',meal);
    assert.deepEqual(parseSharedMeal(new URL(url).search,dishes,meal).meal,meal);
  }
});
