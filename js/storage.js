import {isMealValid} from './engine.js';
export const STORAGE_KEY='dinner-for-two:v1';
export function emptyState(){return {version:1,current:null,generated:[],history:[],favorites:[],preferFavorites:false};}
export function loadState(storage,dishes){
  const initial=emptyState();
  try{
    const raw=storage.getItem(STORAGE_KEY);if(!raw)return {state:initial,warning:''};
    const s=JSON.parse(raw);if(!s||s.version!==1)throw new Error('invalid');
    const ids=new Set(dishes.map(d=>d.id));
    const generated=Array.isArray(s.generated)?s.generated.filter(m=>isMealValid(m,dishes)).slice(0,3):[];
    const history=Array.isArray(s.history)?s.history.filter(m=>m&&typeof m.date==='string'&&Number.isFinite(Date.parse(m.date))&&dishes.some(d=>d.id===m.main&&d.roles.includes('main'))&&dishes.some(d=>d.id===m.side&&d.roles.includes('side'))&&(m.soup===null||dishes.some(d=>d.id===m.soup&&d.roles.includes('soup')))&&dishes.some(d=>d.id===m.staple&&d.roles.includes('staple'))).slice(0,60):[];
    return {state:{...initial,current:isMealValid(s.current,dishes)?s.current:null,generated,history,favorites:Array.isArray(s.favorites)?[...new Set(s.favorites.filter(id=>ids.has(id)))]:[],preferFavorites:s.preferFavorites===true},warning:''};
  }catch{return {state:initial,warning:'本地记录无法读取，已使用新菜单。收藏和记录可能无法保存。'};}
}
export function saveState(storage,state){try{storage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{return false;}}
