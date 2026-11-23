'use strict';
let roundTimer=null,lastTick=0,pointerTimer=null;
function clickDamage(slot){return 1+(slot.damageLevel||0)+perm(slot,'warm')}
function turnLength(slot){return 5+5*(slot.timeLevel||0)+5*perm(slot,'warm')}
function respawnDelay(slot){const level=slot.regenLevel||0;return Math.max(.5,5-.5*Math.min(6,level)-.375*Math.max(0,level-6))}
function keyReward(level){return Math.max(1,Math.round(Math.pow(3,level-1)))}
function sizeDenseKeys(){if(view!=='board'||current===null||!$('#keyField'))return;const field=$('#keyField'),g=boardGrid(data.slots[current]),w=Math.min(38,field.clientWidth*g.dx/100*.94);field.style.setProperty('--key-w',w+'px');field.style.setProperty('--key-h',Math.min(w*1.15,field.clientHeight*g.dy/100*.9)+'px')}
window.addEventListener('resize',sizeDenseKeys);
function boardGrid(slot){const level=0,cols=24,rows=10;return {cols,rows,dx:90/(cols-1),dy:(42+level*8)/(rows-1),total:cols*rows}}
function boardSeats(slot){const g=boardGrid(slot),letters='QWERTYUIOPASDFGHJKLZXCVBNM';return Array.from({length:g.total},(_,i)=>{const row=Math.floor(i/g.cols),col=i%g.cols;return {label:letters[i%letters.length],row,col,x:4+col*g.dx+(row%2?g.dx/2:0),y:82-(g.rows-1-row)*g.dy}})}
function keyCapacity(slot){return 16+16*(slot.capacityLevel||0)}
function respawnCount(slot){return 1+(slot.batchLevel||0)}
function fragmentHTML(k,i){return `<button class="fragment ${k.hp?'':'removed'}" data-fragment="${i}" data-sound="" style="left:${k.x}%;top:${k.y}%" ${!k.hp?'disabled':''} aria-label="${k.label} 키, 체력 ${k.hp}"><span class="keycap-side" aria-hidden="true"></span><span class="keycap-top"><span>${k.label}</span><i style="--health:1"></i></span></button>`}
function reviveKeys(slot,dt){
 const keys=slot.round.keys,seats=boardSeats(slot),due=[];
 keys.forEach(k=>{if(!k.hp&&k.respawnLeft!=null){k.respawnLeft=Math.max(0,k.respawnLeft-dt);if(!k.respawnLeft)due.push(k)}});
 function revive(k){k.hp=slot.level+1;k.readyAt=0;delete k.respawnLeft;const i=keys.indexOf(k);let button=document.querySelector('[data-fragment="'+i+'"]');if(!button){$('#fieldHint').insertAdjacentHTML('beforebegin',fragmentHTML(k,i));button=document.querySelector('[data-fragment="'+i+'"]')}button.disabled=false;button.classList.remove('removed','pressed','recovering');button.setAttribute('aria-label',k.label+' 키, 체력 '+k.hp);button.querySelector('i').style.setProperty('--health',1);button.classList.remove('reborn');void button.offsetWidth;button.classList.add('reborn')}
 due.forEach(k=>{if(k.hp)return;revive(k);for(let extra=1;extra<respawnCount(slot);extra++){const empty=seats.map((s,i)=>i).filter(i=>!keys.some(k=>k.seat===i&&k.hp));if(!empty.length)break;const seat=empty[Math.floor(Math.random()*empty.length)];let other=keys.find(k=>k.seat===seat);if(!other){other={seat,...seats[seat],hp:0};keys.push(other)}revive(other)}});
}
function rangeScale(level=0){return 1+.15*level}
function keyTouchesRange(button,p){
 const cx=p.x+p.b.left-$('#keyField').scrollLeft,cy=p.y+p.b.top-$('#keyField').scrollTop;
 const model=data.slots[current]?.round?.keys[Number(button.dataset.fragment)];
 if(model?.type==='enter'){const r=button.querySelector('.keycap-top').getBoundingClientRect();return [[r.left+r.width/2,r.top,r.right,r.top+r.height/2],[r.left,r.top+r.height/2,r.right,r.bottom]].some(([l,t,right,bottom])=>Math.hypot(cx-Math.max(l,Math.min(cx,right)),cy-Math.max(t,Math.min(cy,bottom)))<=p.radius)}
 return [...button.querySelectorAll('.keycap-top,.keycap-side')].some(face=>{
  const r=face.getBoundingClientRect(),corner=Math.min(5,r.width/2,r.height/2);
  const x=Math.max(r.left+corner,Math.min(cx,r.right-corner));
  const y=Math.max(r.top+corner,Math.min(cy,r.bottom-corner));
  return Math.hypot(cx-x,cy-y)<=p.radius+corner;
 });
}
function pressDelay(){return 200}
function pressSeconds(level){return (pressDelay(level)/1000).toFixed(2).replace(/0$/,'')}
function stopRound(){if(pointerTimer){clearInterval(pointerTimer);pointerTimer=null;}if(roundTimer){clearInterval(roundTimer);roundTimer=null;}if(view==='board'&&current!==null)save();}
const KEY_ROWS=['QWERTYUIOP',"ASDFGHJKL;'",'ZXCVBNM,./'];
const KEY_SEATS=KEY_ROWS.flatMap((letters,row)=>[...letters].map((label,col)=>({label,row,col,x:50+(col-(letters.length-1)/2)*7.2*(.94+row*.06),y:62+row*11})));
const SEAT_ORDER=(()=>{const rows=KEY_ROWS.map((_,r)=>KEY_SEATS.map((s,i)=>({...s,i})).filter(s=>s.row===r).sort((a,b)=>Math.abs(a.col-(KEY_ROWS[r].length-1)/2)-Math.abs(b.col-(KEY_ROWS[r].length-1)/2)));const order=[];for(let col=0;col<11;col++)for(const row of [1,0,2])if(rows[row][col])order.push(rows[row][col].i);return order})();
function arrangeKeys(keys,seats=KEY_SEATS){keys.forEach((key,i)=>{if(!Number.isInteger(key.seat))key.seat=SEAT_ORDER[i];const seat=seats[key.seat];if(seat){key.x=seat.x;key.y=seat.y;key.label=seat.label}else{key.x=12+(i-31)%9*9;key.y=48-Math.floor((i-31)/9)*9}});return keys}
function makeRound(level,count=8,duration=5,boardLevel=0){const seats=Array.from({length:boardGrid({boardLevel}).total},(_,i)=>i);for(let i=seats.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[seats[i],seats[j]]=[seats[j],seats[i]];}return {phase:'ready',left:duration,earned:0,keys:arrangeKeys(seats.slice(0,count).map(seat=>({seat,hp:level+1,label:'K'})),boardSeats({boardLevel}))}}
function showBoard(){
 stopRound();view='board';document.body.classList.add('playing-game');const slot=prepareSlot(data.slots[current]);slot.round??=specialRound(slot);const r=slot.round;normalizeSpecialRound(slot);
 $('#screen').innerHTML=`<section class="game"><div class="game-hud"><span>턴 ${slot.turn} · 키보드 ${slot.level}</span><b id="gameTime">${Math.ceil(r.left)}초</b><b id="gameMoney">${slot.money.toLocaleString()}원</b><button id="gameExit" class="mini">나가기</button></div><div class="key-field" id="keyField" aria-label="키 조각 게임판"><div class="range-ring" id="rangeRing"></div>${boardSeats(slot).map(seat=>`<span class="key-seat" style="left:${seat.x}%;top:${seat.y}%" aria-hidden="true"></span>`).join('')}${r.keys.map(specialFragmentHTML).join('')}<div class="field-hint" id="fieldHint">${r.phase==='ready'?'눌러서 시작':''}</div><div class="round-result" id="roundResult" hidden></div></div></section>`;
 document.querySelector('main').style.maxWidth='1300px';$('#keyField').style.height='clamp(400px,72svh,760px)';const grid=boardGrid(slot);$('#keyField').style.setProperty('--deck-top',(87-(grid.rows-1)*grid.dy)+'%');sizeDenseKeys();
 $('#gameExit').onclick=()=>{stopRound();home()};
 const field=$('#keyField'),ring=$('#rangeRing');refreshCaps(slot);mountTrash(slot);
 function locate(e){const b=field.getBoundingClientRect();return {x:e.clientX-b.left+field.scrollLeft,y:e.clientY-b.top+field.scrollTop,radius:Math.min(b.width*boardGrid(slot).dx/100*.75,Math.hypot(b.width*boardGrid(slot).dx/100,b.height*boardGrid(slot).dy/100)*.47)*rangeScale(slot.rangeLevel||0),b}}
 function hover(e){const p=locate(e);ring.style.left=p.x+'px';ring.style.top=p.y+'px';ring.style.width=ring.style.height=p.radius*2+'px';ring.hidden=false;return p}
 let holding=null,lastPointer=null,trail=[];
 function blocked(){return r.phase==='end'||document.hidden||document.querySelector('dialog[open]')}
 function eatAt(e,fromTrail=false){if(blocked()||e.target?.closest('.round-result,.trash-tools'))return;if(r.phase==='ready'){r.phase='playing';$('#fieldHint').textContent='';lastTick=performance.now()}tickRound();if(r.phase==='end')return;if(r.discardMode){if(!fromTrail){const button=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-fragment]');if(button)discardKey(slot,r.keys[Number(button.dataset.fragment)])}return}const now=performance.now(),delay=pressDelay(slot.pressLevel||0),p=fromTrail?locate(e):hover(e),voices=[];field.querySelectorAll('[data-fragment]').forEach(button=>{const k=r.keys[Number(button.dataset.fragment)];if(!k?.hp||now<(k.readyAt||0)||!keyTouchesRange(button,p))return;if(r.discardMode){if(!fromTrail)discardKey(slot,k);return}k.readyAt=now+delay;const amount=fromTrail?Math.max(1,Math.ceil(clickDamage(slot)/2)):clickDamage(slot);if(damageSpecialKey(slot,k,amount,fromTrail?'trail':'click'))voices.push(k.seat)});if(voices.length)void sound(keySound(slot.level),voices);slot.updated=Date.now()}
 field.onpointermove=e=>{if(r.phase==='end')return;hover(e);if(holding===e.pointerId){lastPointer={clientX:e.clientX,clientY:e.clientY};if(perm(slot,'trail')){trail.push({...lastPointer,until:performance.now()+1000*perm(slot,'trail')});trail=trail.slice(-8)}eatAt(e)}};
 field.onpointerleave=()=>{ring.hidden=true};
 field.onpointerdown=e=>{if(!perm(slot,'slide')||e.button!==0||e.target.closest('.round-result,.trash-tools')||blocked())return;holding=e.pointerId;lastPointer={clientX:e.clientX,clientY:e.clientY};field.setPointerCapture(e.pointerId);eatAt(e)};
 const release=()=>{holding=null;lastPointer=null};field.onpointerup=release;field.onpointercancel=release;field.onlostpointercapture=release;
 if(perm(slot,'slide')){field.style.touchAction='none';pointerTimer=setInterval(()=>{if(blocked()){release();trail=[];return}if(lastPointer)eatAt(lastPointer);trail=trail.filter(t=>t.until>performance.now());for(const point of trail)eatAt(point,true)},40)}
 field.addEventListener('click',e=>{if(e.target.closest('.round-result,.trash-tools')||blocked())return;if(perm(slot,'slide')&&e.detail!==0)return;if(e.detail===0){const button=e.target.closest('[data-fragment]');if(!button)return;const b=button.getBoundingClientRect();e={clientX:b.x+b.width/2,clientY:b.y+b.height/2}}eatAt(e)});
 if(r.phase==='end')showResult();else{lastTick=performance.now();roundTimer=setInterval(tickRound,100);}
}
function tickRound(){if(view!=='board'||current===null)return;const slot=data.slots[current],r=slot.round,now=performance.now(),dt=(now-lastTick)/1000;lastTick=now;if(r.phase!=='playing'||document.hidden||document.querySelector('dialog[open]'))return;r.left=Math.max(0,r.left-dt);$('#gameTime').textContent=Math.ceil(r.left)+'초';$('#gameTime').classList.toggle('urgent',r.left<=3);save();if(!r.left)finishRound();else{advanceSpecial(slot,dt);reviveSpecialKeys(slot,dt)}}
function finishRound(){if(view!=='board')return;const r=data.slots[current].round;if(r.phase==='end')return;r.phase='end';stopRound();save();setTimeout(()=>{if(view==='board'&&data.slots[current]?.round===r)showResult()},300)}
const TREE_PATHS=[['damage','press','range','count','press','range','count','press','range'],['range','press','count','press','range','count','press','range','count'],['time','count','press','range','count','press','range','count']];
// Keep node IDs and effects stable so existing purchases survive the new branches.
const TREE_NODES=TREE_PATHS.flatMap((path,b)=>{
 const nodes=[];
 [...path,'time','regen','time','regen','batch','board','capacity'].forEach((type,d)=>{
  const parent=d?nodes.filter(n=>n.type!==type&&nodes.filter(c=>c.parent===n.id).length<2).sort((a,b)=>a.depth-b.depth||a.order-b.order)[0]:null;
  nodes.push({id:`b${b}-${d}`,type,parent:parent?.id||null,depth:parent?parent.depth+1:0,order:d,cost:3+d*3});
 });
 let leaf=0;function position(n){const children=nodes.filter(c=>c.parent===n.id);n.x=children.length?children.map(position).reduce((a,b)=>a+b,0)/children.length:90+b*750+(leaf++)*100;n.y=950-(n.depth+1)*130;return n.x}position(nodes[0]);return nodes;
});
const TREE_ROOT={x:TREE_NODES.filter(n=>!n.parent).reduce((sum,n)=>sum+n.x,0)/3,y:950};
for(let rank=0;rank<6;rank++)TREE_NODES.push({id:`d-${rank}`,type:"damage",parent:rank<3?`b${rank}-0`:`d-${rank-3}`,x:0,y:0,cost:8+rank*8});
const TREE_META={damage:{icon:"✦",name:"클릭 데미지"},capacity:{icon:'▣',name:'최대 키 개수'},batch:{icon:'⧉',name:'동시 재생성'},time:{icon:'◷',name:'턴 시간'},regen:{icon:'⟳',name:'키 재생성'},range:{icon:'◎',name:'클릭 범위'},count:{icon:'▦',name:'키 개수'}};
// Replace retired press nodes with separately purchasable supply upgrades.
let supplyIndex=0;for(const node of TREE_NODES.filter(n=>n.type==='press')){const old=node.id;node.id='supply-'+old;node.type=supplyIndex++%2?'batch':'regen';node.supply=true;node.cost+=8;TREE_NODES.filter(n=>n.parent===old).forEach(n=>n.parent=node.id)}
addSpecialTree();
// Remove expansion nodes without changing any remaining purchase IDs.
for(const removed of TREE_NODES.filter(n=>['board','press','special'].includes(n.type))){TREE_NODES.filter(n=>n.parent===removed.id).forEach(n=>n.parent=removed.parent);TREE_NODES.splice(TREE_NODES.indexOf(removed),1)}
for(const [i,type] of ['enter','caps','back','space'].entries())TREE_NODES.push({id:'unlock-'+type,type:'unlock',specialType:type,parent:['b0-9','b1-9','b2-9','b2-11'][i],x:0,y:0});
// Three fixed radial branches; revealing a node never moves the map.
TREE_ROOT.x=1500;TREE_ROOT.y=1500;
const treeDepth=new Map(),treeBranch=new Map(),treePath=new Map();const mainRoots=TREE_NODES.filter(n=>!n.parent).sort((a,b)=>a.id.localeCompare(b.id));
function describeTree(n){if(treeDepth.has(n.id))return;const parent=TREE_NODES.find(p=>p.id===n.parent);if(parent){describeTree(parent);treeDepth.set(n.id,treeDepth.get(parent.id)+1);treeBranch.set(n.id,treeBranch.get(parent.id));treePath.set(n.id,treePath.get(parent.id)+'/'+n.id)}else{treeDepth.set(n.id,0);treeBranch.set(n.id,mainRoots.indexOf(n));treePath.set(n.id,n.id)}}TREE_NODES.forEach(describeTree);
let radius=0;for(let depth=0;depth<=Math.max(...treeDepth.values());depth++){const rows=mainRoots.map((_,branch)=>TREE_NODES.filter(n=>treeDepth.get(n.id)===depth&&treeBranch.get(n.id)===branch).sort((a,b)=>treePath.get(a.id).localeCompare(treePath.get(b.id))));radius=Math.max(depth?radius+170:150,...rows.map(row=>row.length*100/(Math.PI*.56)));rows.forEach((row,branch)=>row.forEach((n,i)=>{const angle=-Math.PI/2+branch*Math.PI*2/3+(row.length===1?0:((i+.5)/row.length-.5)*Math.PI*.56);n.x=TREE_ROOT.x+Math.cos(angle)*radius;n.y=TREE_ROOT.y+Math.sin(angle)*radius}))}
let shopPose={x:0,y:0,scale:.8},shopInitialized=false;
function keySound(level){return level<=1?'basic':'aurora'}
KEY_SOUNDS.basic={rate:1.35,filter:'highpass',frequency:2200,length:.09,gain:.7};
function nodeInfo(slot,n){
 if(n.type==='unlock')return {done:specialLevel(slot,n.specialType,'chance')>0,open:(slot.treeBought||[]).includes(n.parent),cost:3,points:true,title:SPECIALS[n.specialType].name+' 해금',desc:'초기화포인트 3개로 '+SPECIALS[n.specialType].name+' 해금 · 해금 후 별도 마인드맵에서 강화'};
 if(n.type==='special')return specialNodeInfo(slot,n);
 if(n.type==='key'){const cost=keyboardCost(slot);return {cost,done:slot.level>=8,open:true,title:`키 Lv.${slot.level} → ${slot.level+1}`,desc:`체력 ${slot.level+1} → ${slot.level+2} · 보상 ${keyReward(slot.level)} → ${keyReward(slot.level+1)}원 · ${slot.level===1?"ikki68 Aurora 타건음":"ikki68 Aurora 타건음 유지"}`}}
 const owned=slot.treeBought||[],done=owned.includes(n.id),open=!n.parent||owned.includes(n.parent);let desc,capped=false;
 if(n.type==='damage'){capped=(slot.damageLevel||0)>=6;desc=`클릭당 ${clickDamage(slot)} → ${Math.min(7+perm(slot,'warm'),clickDamage(slot)+1)} 데미지`}
 if(n.type==='capacity'){capped=(slot.capacityLevel||0)>=3;desc=`최대 ${keyCapacity(slot)} → ${16+16*Math.min(3,(slot.capacityLevel||0)+1)}개`}
 if(n.type==='batch'){capped=(slot.batchLevel||0)>=7;desc=`한 번에 ${respawnCount(slot)} → ${Math.min(8,respawnCount(slot)+1)}개`}
 if(n.type==='time'){capped=(slot.timeLevel||0)>=6;desc=`턴 ${turnLength(slot)} → ${turnLength({...slot,timeLevel:Math.min(6,(slot.timeLevel||0)+1)})}초`}
 if(n.type==='regen'){capped=(slot.regenLevel||0)>=10;desc=`다시 생기기까지 ${respawnDelay(slot).toFixed(2)} → ${respawnDelay({...slot,regenLevel:Math.min(10,(slot.regenLevel||0)+1)}).toFixed(2)}초`}
 if(n.type==='range'){const l=slot.rangeLevel||0;capped=l>=10;desc=`범위 ${Math.round(rangeScale(l)*100)} → ${Math.round(rangeScale(Math.min(10,l+1))*100)}%`}
 
 if(n.type==='count'){const count=slot.keyCount||8;capped=count>=31;desc=`키 ${count} → ${Math.min(31,count+3)}개`}
 return {cost:capped?0:Math.round(n.cost*Math.pow(1.7,Math.min(4,Math.floor((treeDepth.get(n.id)||0)/2)))),done,open,title:TREE_META[n.type].name,desc:capped?'최대 효과 · 다음 단계 무료 개방':desc};
}
function buyNode(slot,n){const info=nodeInfo(slot,n);if(slot.round?.phase!=='end'||info.done||!info.open||(info.points?slot.dataCurrency:slot.money)<info.cost)return false;if(info.points){slot.dataCurrency-=info.cost;slot.specialUp??={};slot.specialUp[n.specialType+'_chance']=1;slot.permanent['unlock_'+n.specialType]=1;save();void upgradeChime();return true}slot.money-=info.cost;if(n.type==='key'){slot.level++;slot.bestKeyboard=Math.max(slot.bestKeyboard||1,slot.level)}else{slot.treeBought??=[];slot.treeBought.push(n.id);applyGrowth(slot,n);rememberGrowth(slot,n)}slot.updated=Date.now();save();void upgradeChime();return true}
function showResult(){
 const slot=data.slots[current],r=slot.round,box=$('#roundResult');box.hidden=false;box.classList.add('tree-result');$('#rangeRing').hidden=true;$('#fieldHint').textContent='';
 const visibleNodes=TREE_NODES.filter(n=>{const i=nodeInfo(slot,n);return i.done||i.open}).map(n=>({...n}));

 box.innerHTML=`<div class="shop-shell"><div class="shop-heading"><b>+${r.earned.toLocaleString()}원</b><span>${slot.money.toLocaleString()}원</span>${SPECIAL_UNLOCKS.some(([type])=>specialLevel(slot,type,'chance')>0)?'<button id="openSpecialShop" class="mini" data-sound="">특수 키 강화</button>':''}</div><div class="tree-viewport" id="treeViewport"><div class="tree-world" id="treeWorld"><svg class="tree-lines" width="3000" height="3000" aria-hidden="true">${visibleNodes.map(n=>{const parent=visibleNodes.find(p=>p.id===n.parent);return `<path d="M ${parent?parent.x:TREE_ROOT.x} ${parent?parent.y:TREE_ROOT.y} L ${n.x} ${n.y}"/>`}).join('')}</svg><span class="tree-root" style="left:${TREE_ROOT.x}px;top:${TREE_ROOT.y}px">⌨</span>${visibleNodes.map(n=>{const i=nodeInfo(slot,n);return `<button class="tree-node ${i.done?'owned':!i.open||n.type==='unlock'?'locked':slot.money>=i.cost?'available':'costly'}" style="left:${n.x}px;top:${n.y}px" data-node="${n.id}" aria-label="${i.title}${i.done?' 완료':!i.open?' 잠김':''}" data-sound="">${i.done?'✓':n.type==='unlock'?'♧':n.type==='special'?SPECIALS[n.specialType].label:TREE_META[n.type].icon}</button>`}).join('')}<div class="node-tip" id="nodeTip" hidden></div></div></div><div class="shop-bottom"><button class="key-evolution tree-node" data-node="key" data-sound="" aria-label="키 업그레이드">⌨</button><button id="openPrestige" class="mini" data-sound="">◇ ${slot.dataCurrency||0}<small>${resetReward(slot)?'초기화 +'+resetReward(slot):'영구 성장'}</small></button><button id="nextRound" class="primary">다음 턴 →</button></div><div id="keyTip" class="key-tip" hidden></div></div>`;
 const viewport=$('#treeViewport'),world=$('#treeWorld'),tip=$('#nodeTip');if(!shopInitialized){const initial=Math.max(.4,Math.min(.6,(viewport.clientWidth-44)/650,(viewport.clientHeight-60)/700));shopPose={x:viewport.clientWidth/2-TREE_ROOT.x*initial,y:viewport.clientHeight/2-TREE_ROOT.y*initial,scale:initial};shopInitialized=true}function apply(){world.style.transform=`translate(${shopPose.x}px,${shopPose.y}px) scale(${shopPose.scale})`}apply();
 let active=null,touchSelected=null,drag=null,moved=false,lastTouch=0;
 function hide(){active=null;tip.hidden=true;$('#keyTip').hidden=true}
 function show(id){active=id;const n=id==='key'?{type:'key'}:visibleNodes.find(n=>n.id===id),i=nodeInfo(slot,n),t=id==='key'?$('#keyTip'):tip;hide();active=id;t.hidden=false;t.innerHTML=`<b>${i.title}</b><span>${i.desc}</span><strong>${i.done?'완료':!i.open?'앞 단계를 먼저 열어주세요':i.cost.toLocaleString()+(i.points?' 초기화포인트':'원')+((i.points?slot.dataCurrency:slot.money)<i.cost?' · 부족해요':'')}</strong>`;if(id!=='key'){t.style.left=n.x+'px';t.style.top=n.y+46+'px'}}
 box.querySelectorAll('[data-node]').forEach(button=>{button.onpointerenter=e=>{if(e.pointerType==='mouse')show(button.dataset.node)};button.onpointerleave=e=>{if(e.pointerType==='mouse')hide()};button.onpointerdown=e=>{if(e.pointerType!=='mouse')lastTouch=Date.now()};button.onclick=e=>{const id=button.dataset.node;if(Date.now()-lastTouch<1000&&touchSelected!==id){touchSelected=id;show(id);return}const n=id==='key'?{type:'key'}:TREE_NODES.find(n=>n.id===id);if(buyNode(slot,n)){touchSelected=null;$('#gameMoney').textContent=slot.money.toLocaleString()+'원';showResult()}else show(id)}});
 viewport.onpointerdown=e=>{if(e.target.closest('[data-node]'))return;hide();touchSelected=null;moved=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,ox:shopPose.x,oy:shopPose.y};viewport.setPointerCapture(e.pointerId)};
 viewport.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>3)moved=true;shopPose.x=drag.ox+dx;shopPose.y=drag.oy+dy;apply()};viewport.onpointerup=viewport.onpointercancel=()=>drag=null;
 viewport.addEventListener('wheel',e=>{e.preventDefault();hide();const r=viewport.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,old=shopPose.scale,next=Math.max(.16,Math.min(1.6,old*Math.exp(-e.deltaY*.0015)));shopPose.x=x-(x-shopPose.x)*next/old;shopPose.y=y-(y-shopPose.y)*next/old;shopPose.scale=next;apply()},{passive:false});
 $('#openPrestige').onclick=showPrestige;
 $('#openSpecialShop')?.addEventListener('click',()=>showSpecialMap());
 $('#nextRound').onclick=()=>{slot.turn++;slot.round=specialRound(slot);slot.updated=Date.now();save();showBoard()};
}

document.addEventListener('visibilitychange',()=>{lastTick=performance.now();if(view==='board')save()});window.addEventListener('pagehide',()=>{if(view==='board')save()});home();