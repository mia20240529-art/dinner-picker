import {validateDishes,generateMeal,mealTime,mealKey,MODES} from './engine.js';
import {loadState,saveState} from './storage.js';
const $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={main:'主菜',side:'配菜',soup:'汤',staple:'主食'};
const modeLabels={random:'家常搭配',light:'清淡搭配',quick:'30分钟快手搭配'};
let dishes=[],state,storage,toastTimer,returnFocus=null,persistWarned=false;
const dish=id=>dishes.find(d=>d.id===id);
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function persist(){if(!saveState(storage,state)&&!persistWarned){persistWarned=true;toast('浏览器暂不能保存记录，本次仍可正常使用。');}}
function rememberGenerated(){state.generated=[{...state.current},...state.generated.filter(m=>mealKey(m)!==mealKey(state.current))].slice(0,3);persist();}
function isConfirmed(){const today=new Date().toLocaleDateString();return state.history.some(m=>new Date(m.date).toLocaleDateString()===today&&[m.main,m.side,m.soup||'',m.staple].join('|')===mealKey(state.current));}
function render(){
  const meal=state.current;
  $('#menu-section').setAttribute('aria-busy','false');
  $('#favorite-count').textContent=state.favorites.length;
  $('#prefer-favorites').checked=state.preferFavorites;
  document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===meal.mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('#meal-summary').textContent=`${modeLabels[meal.mode]} · 预计${mealTime(meal,dishes)}分钟 · 米饭同步煮`;
  $('#dish-grid').innerHTML=Object.entries(labels).map(([role,label],i)=>{
    const d=dish(meal[role]),optional=role==='soup'&&!meal.includeSoup;
    return `<button class="dish-card ${role==='main'?'main-card':''}" data-recipe="${d.id}" aria-label="查看${escape(d.name)}菜谱${optional?'，本餐可选':''}"><span class="dish-role">${label}<span class="dish-number">0${i+1}</span></span><span class="dish-name">${escape(d.name)}${optional?'<span class="optional-tag">可选</span>':''}</span><span class="dish-meta"><span>${d.time}分钟</span><span>· ${role==='staple'?'安心吃饭':d.light?'清淡':d.oily?'偏油':'家常口味'}</span>${state.favorites.includes(d.id)?'<span aria-label="已收藏">♡</span>':''}<span class="card-arrow" aria-hidden="true">↗</span></span></button>`;
  }).join('');
  const main=dish(meal.main),side=dish(meal.side),soup=dish(meal.soup),notes=[];
  if(side.starchy||main.starchy||(meal.includeSoup&&soup.starchy))notes.push('<p class="starch-note">本餐已有一定淀粉，米饭可适量减少。</p>');
  if(main.oily||main.tags.includes('重口'))notes.push('<p>主菜口味较浓，已搭配清淡配菜与汤。</p>');
  if(main.brothy)notes.push(`<p>主菜汤汁丰富，另做汤可选。</p><label class="favorite-setting"><input type="checkbox" id="include-soup" ${meal.includeSoup?'checked':''}><span>今晚也做这道汤</span></label>`);
  if(meal.mode==='quick')notes.push('<p>按菜肴依次制作、米饭快煮约25分钟估算；普通煮饭程序可能更久。</p>');
  $('#meal-notes').innerHTML=notes.join('');
  const confirmed=isConfirmed();$('#confirm-meal').disabled=confirmed;
  $('#confirm-meal').innerHTML=confirmed?'已记下今晚的菜单 <span aria-hidden="true">✓</span>':'这套今晚就吃 <span aria-hidden="true">✓</span>';
  $('#confirm-help').textContent=confirmed?'已加入最近吃过，下次会优先换些新口味。':'记下这顿晚餐，下次多一点新鲜感。';
}
function generate(options={}){
  let next=generateMeal(dishes,state,options);
  if(!next&&options.mainId){next=generateMeal(dishes,state,{...options,mode:'random'});if(next)toast('已按所选主菜搭配，并切回家常模式。');}
  if(!next){toast('当前模式没有其他合适搭配，试试整套重抽或随机一套。');return false;}
  state.current=next;rememberGenerated();render();return true;
}
function openPanel(title,kicker,html){
  if(!$('#panel').open)returnFocus=document.activeElement;
  $('#panel-title').textContent=title;$('#panel-kicker').textContent=kicker;$('#panel-content').innerHTML=html;
  if(!$('#panel').open)$('#panel').showModal();
  $('#panel').scrollTop=0;$('#close-panel').focus();
}
function closePanel(){$('#panel').close();if(returnFocus?.isConnected)returnFocus.focus();}
function recipe(id){
  const d=dish(id);if(!d)return;const saved=state.favorites.includes(id),list=items=>items.map(x=>`<li>${escape(x)}</li>`).join('');
  openPanel(d.name,'把这一道，做好吃',`<div class="recipe-topline"><span>${escape(d.category_label)}</span><span>· 2人份</span><span>· 预计${d.time}分钟</span><span>· ${escape(d.difficulty)}</span></div><div class="recipe-flags"><span class="badge">${d.light?'清淡':'家常口味'}</span><span class="badge">${d.oily?'偏油':'不偏油'}</span><span class="badge">${d.starchy?'含较多淀粉':'非高淀粉菜'}</span></div><div class="recipe-columns"><section class="recipe-section"><h3>食材</h3><ul>${list(d.ingredients)}</ul></section><section class="recipe-section"><h3>调料</h3><ul>${list(d.seasonings)}</ul></section></div><section class="recipe-section"><h3>做法</h3><ol class="steps">${list(d.steps)}</ol></section><section class="recipe-section"><h3>可替换食材</h3><ul>${list(d.substitutions)}</ul></section><section class="recipe-section"><h3>小备注</h3><p class="recipe-note">${escape(d.note||'调料可按口味微调；所列用量适合2人。')}<br>1茶匙约5ml，1汤匙约15ml。</p></section><button class="favorite-button ${saved?'saved':''}" data-favorite="${d.id}" aria-pressed="${saved}">${saved?'♥ 已收藏 · 点击取消':'♡ 收藏这道菜'}</button>`);
}
function selectMain(){
  const groups=new Map();for(const d of dishes.filter(d=>d.roles.includes('main'))){if(!groups.has(d.category_label))groups.set(d.category_label,[]);groups.get(d.category_label).push(d);}
  openPanel('先选一道想吃的','配菜和汤，帮你搭好',Array.from(groups,([name,items])=>`<section class="picker-group"><h3>${escape(name)}</h3><div class="picker-list">${items.map(d=>`<button class="picker-item" data-main="${d.id}"><span>${escape(d.name)}</span><small>${d.time}分钟 · ${d.light?'清淡':'家常口味'}${state.favorites.includes(d.id)?' · 已收藏':''}</small></button>`).join('')}</div></section>`).join(''));
}
function favorites(){const items=state.favorites.map(dish).filter(Boolean);openPanel('我的收藏',`${items.length}道喜欢的味道`,items.length?`<div class="picker-list">${items.map(d=>`<button class="picker-item" data-recipe="${d.id}"><span>${escape(d.name)}</span><small>${escape(d.category_label)} · ${d.time}分钟</small></button>`).join('')}</div>`:'<div class="empty">还没有收藏的菜。<br>打开一道菜谱，点“收藏这道菜”就能留住它。</div>');}
function history(){openPanel('最近吃过','记住日常，也换些新口味',state.history.length?state.history.map(m=>`<article class="history-item"><time datetime="${escape(m.date)}">${new Date(m.date).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time><div class="history-dishes">${[m.main,m.side,m.soup,m.staple].filter(Boolean).map(id=>`<button data-recipe="${id}">${escape(dish(id).name)}</button>`).join('')}</div>${!m.soup?'<small>本餐未另做汤</small>':''}</article>`).join(''):'<div class="empty">你的第一顿晚餐，还没记下。<br>选好菜单后，点“这套今晚就吃”。</div>');}
function confirmMeal(){if(isConfirmed())return false;const m=state.current;state.history=[{main:m.main,side:m.side,soup:m.includeSoup?m.soup:null,staple:m.staple,date:new Date().toISOString()},...state.history].slice(0,60);persist();render();toast('记下了，今晚好好吃饭。');return true;}
function installEvents(){
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.mode){generate({mode:b.dataset.mode});return;}
    if(b.dataset.swap){generate({swap:b.dataset.swap});return;}
    if(b.dataset.recipe){recipe(b.dataset.recipe);return;}
    if(b.dataset.main){if(generate({mainId:b.dataset.main}))closePanel();return;}
    if(b.dataset.favorite){const id=b.dataset.favorite,index=state.favorites.indexOf(id);if(index<0)state.favorites.push(id);else state.favorites.splice(index,1);persist();render();b.classList.toggle('saved',index<0);b.setAttribute('aria-pressed',String(index<0));b.textContent=index<0?'♥ 已收藏 · 点击取消':'♡ 收藏这道菜';toast(index<0?'已加入我的收藏。':'已取消收藏。');return;}
    if(b.dataset.action==='select-main')selectMain();if(b.dataset.action==='reroll')generate();
    if(b.id==='favorites-button')favorites();if(b.id==='history-button')history();if(b.id==='close-panel')closePanel();if(b.id==='confirm-meal')confirmMeal();
  });
  document.addEventListener('change',e=>{
    if(e.target.id==='prefer-favorites'){state.preferFavorites=e.target.checked;persist();if(state.preferFavorites&&!state.favorites.length)toast('收藏还是空的，先从完整菜库为你推荐。');}
    if(e.target.id==='include-soup'){const previous=state.current.includeSoup;state.current.includeSoup=e.target.checked;if(state.current.mode==='quick'&&mealTime(state.current,dishes)>30){state.current.includeSoup=previous;toast('加上汤会超过30分钟，可切换随机模式再加汤。');}rememberGenerated();render();}
  });
  $('#panel').addEventListener('click',e=>{if(e.target===$('#panel')){const r=$('#panel').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel();}});
  $('#panel').addEventListener('cancel',e=>{e.preventDefault();closePanel();});
}
function registerAgentTools(){
  if(!document.modelContext?.registerTool)return;const lifecycle=new AbortController();
  const summary=()=>({mode:state.current.mode,minutes:mealTime(state.current,dishes),dishes:Object.fromEntries(Object.keys(labels).map(r=>[r,{id:state.current[r],name:dish(state.current[r]).name}])),soupIncluded:state.current.includeSoup});
  const tools=[
    {name:'read_dinner_menu',description:'读取当前两人份晚餐菜单。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(input&&Object.keys(input).length)throw new Error('不接受参数');return summary();}},
    {name:'generate_dinner_menu',description:'按家常、清淡或快速模式重新生成并显示完整晚餐菜单。不会标记为已吃。',inputSchema:{type:'object',properties:{mode:{type:'string',enum:MODES}},required:['mode'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!MODES.includes(input.mode)||Object.keys(input).some(k=>k!=='mode'))throw new Error('无效模式');if(!generate({mode:input.mode}))throw new Error('没有合适搭配');return summary();}}
  ];
  for(const t of tools){try{Promise.resolve(document.modelContext.registerTool(t,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
async function init(){
  try{
    const response=await fetch(new URL('../data/dishes.json',import.meta.url));if(!response.ok)throw new Error('菜库加载失败');
    dishes=validateDishes(await response.json());try{storage=window.localStorage;}catch{storage=null;}
    const loaded=loadState(storage,dishes);state=loaded.state;
    if(!state.current){state.current=generateMeal(dishes,state,{mode:'random'});if(!state.current)throw new Error('无法生成菜单');rememberGenerated();}
    render();installEvents();registerAgentTools();if(loaded.warning)toast(loaded.warning);
  }catch(error){
    $('#menu-section').setAttribute('aria-busy','false');$('#meal-summary').textContent='菜单暂时没有准备好';
    $('#dish-grid').innerHTML='<div class="error-card">无法加载菜库，请刷新重试。若从文件夹打开，请使用本地预览或部署后的网址。<br><button id="retry-load">重新加载</button></div>';
    $('#retry-load').onclick=()=>location.reload();document.querySelectorAll('.mode-button,.swap-bar button,#confirm-meal,#favorites-button,#history-button,#prefer-favorites').forEach(b=>b.disabled=true);
    console.error('Dinner initialization failed:',error);
  }
}
init();
