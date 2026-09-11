export const SEARCH_FILTERS={all:'全部',main:'主菜',side:'配菜',soup:'汤',quick:'30分钟以内',light:'清淡'};
export function searchDishes(dishes,query='',filter='all'){
  const terms=String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return dishes.filter(d=>{
    if(['main','side','soup'].includes(filter)&&!d.roles.includes(filter))return false;
    if(filter==='quick'&&d.time>30)return false;
    if(filter==='light'&&!d.light)return false;
    const text=[d.name,...d.ingredients,d.category,d.category_label,...d.tags,d.light?'清淡':'',d.time<=30?'快手 30分钟以内':''].join(' ').toLocaleLowerCase();
    return terms.every(term=>text.includes(term));
  });
}
