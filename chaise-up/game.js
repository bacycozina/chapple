'use strict';
const {Engine,Bodies,Body,Composite,Query,Vertices,Sleeping}=Matter;
const W=360,H=580,CELL=45,canvas=document.querySelector('#board'),ctx=canvas.getContext('2d');
const nextCanvas=document.querySelector('#next'),nc=nextCanvas.getContext('2d');
const $=s=>document.querySelector(s);
const SHAPES=[[[0,0],[1,0],[2,0],[3,0]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[1,1]],[[0,0],[0,1],[1,1],[2,1]],[[2,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[0,1],[1,1]],[[0,0],[1,0],[1,1],[2,1]]];
const COLORS=['#86c9d3','#eccb74','#ae9ccf','#eaa175','#7fa8d9','#a4c78f','#df8d98'];
const ROWS=Array.from({length:Math.ceil(H/CELL)},(_,i)=>({top:Math.max(0,H-(i+1)*CELL),bottom:H-i*CELL}));
let rowStats=ROWS.map(row=>({...row,percent:0}));
const rowMeter=document.querySelector('#rowMeter');
rowMeter.innerHTML=ROWS.map(()=>'<span>0%</span>').join('');
let pendingBands=[];
let engine,floorBody,blocks=[],active=null,nextType=0,bag=[],score=0,lines=0,best=0,paused=false,over=false,drag=null,settleTime=0,dropAge=0,cut=null,cutClock=0,scanClock=0,dangerClock=0,particles=[],lastFrame=0,accumulator=0,toastTimer=null;
try{best=Number(localStorage.getItem('free-block-best'))||0;}catch{}
let wheelEnabled=true;
try{wheelEnabled=localStorage.getItem('chaise-up-wheel')!=='off';}catch{}
function updateControls(){
 const button=$('#wheelToggle');button.textContent=wheelEnabled?'휠 ON':'휠 OFF';button.setAttribute('aria-checked',String(wheelEnabled));
 $('#desktopHint').textContent=wheelEnabled?'드래그로 이동 · 휠로 회전':'중심은 이동 · 바깥은 회전';
 canvas.setAttribute('aria-label','블록 게임판. '+controlHint());
 if(!active?.plugin.controlLocked)$('#hint').textContent=controlHint();
}
$('#wheelToggle').onclick=()=>{releaseGrip();wheelEnabled=!wheelEnabled;try{localStorage.setItem('chaise-up-wheel',wheelEnabled?'on':'off');}catch{}updateControls();};
function hud(){$('#score').textContent=score.toLocaleString();$('#lines').textContent=lines;$('#best').textContent=best.toLocaleString();}
function saveBest(){if(score>best){best=score;try{localStorage.setItem('free-block-best',String(best));}catch{}}hud();}
function parts(body){return body.parts.length>1?body.parts.slice(1):[body];}
function sensor(body,value){body.parts.forEach(p=>p.isSensor=value);}
function pick(){if(!bag.length){bag=[0,1,2,3,4,5,6];for(let i=6;i>0;i--){let j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}return bag.pop();}
function physicalOptions(){return {friction:.72,frictionStatic:1,restitution:0,frictionAir:.025,density:.002,sleepThreshold:30};}
function makeBlock(type,x,y){const squares=SHAPES[type].map(([cx,cy])=>Bodies.rectangle(cx*CELL,cy*CELL,CELL,CELL,physicalOptions()));const b=Body.create({...physicalOptions(),parts:squares});Body.setPosition(b,{x,y});b.plugin={color:COLORS[type],type,released:false};return b;}
function controlHint(){return !wheelEnabled||matchMedia('(pointer:coarse)').matches?'중심은 이동 · 바깥은 회전':'드래그로 이동 · 휠로 회전';}
function spawn(){
 active=makeBlock(nextType,W/2,76);nextType=pick();active.plugin.released=true;blocks.push(active);Composite.add(engine.world,active);settleTime=dropAge=0;$('#angle').textContent='0°';
 if(Query.collides(active,blocks.filter(b=>b!==active)).some(c=>c.depth>2)){finish();return;}
 $('#hint').textContent=controlHint();drawNext();
}
function reset(){
 releaseGrip();
 engine=Engine.create({positionIterations:10,velocityIterations:8,enableSleeping:true});engine.gravity.y=1;engine.gravity.scale=.00075;
 floorBody=Bodies.rectangle(W/2,H+20,W+80,40,{isStatic:true});
 Composite.add(engine.world,[Bodies.rectangle(-20,H/2,40,H*3,{isStatic:true,friction:0,frictionStatic:0}),Bodies.rectangle(W+20,H/2,40,H*3,{isStatic:true,friction:0,frictionStatic:0}),floorBody]);
 pendingBands=[];blocks=[];active=null;bag=[];score=lines=0;paused=over=false;drag=cut=null;settleTime=dropAge=scanClock=dangerClock=0;particles=[];accumulator=0;clearTimeout(toastTimer);$('#toast').classList.remove('show');$('#overlay').hidden=true;$('#pause').textContent='Ⅱ';$('#pause').setAttribute('aria-label','일시정지');nextType=pick();spawn();hud();findBands();
}
function drawNext(){nc.clearRect(0,0,160,110);const shape=SHAPES[nextType],size=22,maxX=Math.max(...shape.map(c=>c[0])),maxY=Math.max(...shape.map(c=>c[1]));for(const [x,y]of shape){nc.fillStyle=COLORS[nextType];nc.beginPath();nc.roundRect((160-(maxX+1)*size)/2+x*size,(110-(maxY+1)*size)/2+y*size,size-2,size-2,4);nc.fill();}}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
function gripMode(point,body=active){return Math.hypot(point.x-body.position.x,point.y-body.position.y)<=CELL*.8?"move":"rotate";}
function releaseGrip(){
 if(!drag)return;const id=drag.id;drag=null;if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
}
canvas.addEventListener('pointerdown',e=>{
 if(paused||over||cut||!active||active.plugin.controlLocked||drag||e.button!==0)return;const p=point(e),center=active.position;
 const atCenter=Math.hypot(p.x-center.x,p.y-center.y)<12;if(!atCenter&&!Query.point([active],p).length)return;
 e.preventDefault();canvas.setPointerCapture(e.pointerId);Sleeping.set(active,false);
 const mode=e.pointerType==='mouse'&&wheelEnabled?'move':gripMode(p);if(mode==='rotate')Body.setVelocity(active,{x:0,y:active.velocity.y});
 drag={id:e.pointerId,mode,target:{...p},last:{...p},dx:p.x-center.x,pendingSpin:0};settleTime=dropAge=0;
 $('#hint').textContent='블록은 계속 떨어져요';
});
function lockControl(){
 if(!active||active.plugin.controlLocked)return;
 active.plugin.controlLocked=true;releaseGrip();settleTime=0;
 // Losing control must not freeze a block in mid-air.
 active.plugin.fallSpeed=Math.max(180,active.plugin.fallSpeed||0);
 Body.setVelocity(active,{x:0,y:active.plugin.fallSpeed/60});
 $('#hint').textContent='툭! · 1.5초 동안 멈추면 다음 블록';
}
function followPointer(p,wheelTurn=null){
 const held=drag,body=active;if(!held||!body||body.plugin.controlLocked)return;
 const fromX=body.position.x,fromAngle=body.angle;
 let toX=fromX,turn=0;
 if(wheelTurn!==null)turn=wheelTurn;
 else if(held.mode==='move')toX=Math.max(fromX-body.bounds.min.x,Math.min(W-(body.bounds.max.x-fromX),p.x-held.dx));
 else{const x1=held.last.x-body.position.x,y1=held.last.y-body.position.y,x2=p.x-body.position.x,y2=p.y-body.position.y;turn=Math.atan2(x1*y2-y1*x2,x1*x2+y1*y2);}
 const steps=Math.max(1,Math.ceil(Math.max(Math.abs(toX-fromX)/2,Math.abs(turn)/.02)));
 // Sweep directly to the pointer, stopping at the first solid contact.
 for(let i=1;i<=steps;i++){
  const oldX=body.position.x,oldAngle=body.angle;
  if(wheelTurn===null&&held.mode==='move')Body.setPosition(body,{x:fromX+(toX-fromX)*i/steps,y:body.position.y});
  else {
   Body.setAngle(body,fromAngle+turn*i/steps);
   // Slide away from the wall while rotating, without lifting the block.
   const wallShift=body.bounds.min.x<0?-body.bounds.min.x:body.bounds.max.x>W?W-body.bounds.max.x:0;
   if(wallShift)Body.translate(body,{x:wallShift,y:0});
  }
  if(body.bounds.min.x<-.01||body.bounds.max.x>W+.01){Body.setAngle(body,oldAngle);Body.setPosition(body,{x:oldX,y:body.position.y});break;}
  if(Query.collides(body,[floorBody,...blocks.filter(b=>b!==body)]).length){Body.setAngle(body,oldAngle);Body.setPosition(body,{x:oldX,y:body.position.y});lockControl();break;}
 }
 Body.setVelocity(body,{x:0,y:body.velocity.y});Body.setAngularVelocity(body,0);
 if(drag&&wheelTurn!==null&&held.mode==='move')held.dx-=body.position.x-fromX;
 if(drag&&wheelTurn===null){held.last={...p};held.target={...p};}
}
canvas.addEventListener('wheel',e=>{
 if(!wheelEnabled)return;
 if(paused||over||cut||!active||active.plugin.controlLocked||(drag&&drag.mode==='rotate'))return;
 e.preventDefault();if(!e.deltaY)return;
 const existing=drag,p=point(e);
 if(!drag)drag={id:-1,mode:'rotate',last:p,target:p,dx:0};
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?H:1);
 followPointer(p,Math.max(-Math.PI/6,Math.min(Math.PI/6,delta*.003)));
 if(!existing&&drag)drag=null;
 settleTime=0;
},{passive:false});
canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId||paused)return;followPointer(point(e));});
function release(e){if(!drag||drag.id!==e.pointerId)return;releaseGrip();$('#hint').textContent=controlHint();}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
function pauseGame(value){if(over)return;releaseGrip();paused=value;$('#overlay').hidden=!value;$('#overlayLabel').textContent='TAKE A BREATH';$('#overlayTitle').textContent='잠깐 쉬어가기';$('#overlayText').textContent='준비되면 이어서 쌓아보세요.';$('#resume').hidden=false;$('#pause').textContent=value?'▷':'Ⅱ';$('#pause').setAttribute('aria-label',value?'계속하기':'일시정지');}
function finish(){releaseGrip();over=true;paused=false;saveBest();$('#overlay').hidden=false;$('#overlayLabel').textContent='NICELY STACKED';$('#overlayTitle').textContent='여기까지, 잘 쌓았어요';$('#overlayText').textContent=lines+'줄을 지웠어요 · '+score.toLocaleString()+'점';$('#resume').hidden=true;}
$('#pause').onclick=()=>pauseGame(!paused);$('#resume').onclick=()=>pauseGame(false);$('#restart').onclick=reset;
let helpPaused=false;$('#help').onclick=()=>{helpPaused=paused;if(!over)pauseGame(true);$('#helpDialog').showModal();};function closeHelp(){$('#helpDialog').close();if(!helpPaused&&!over)pauseGame(false);}$('#closeHelp').onclick=$('#helpDone').onclick=closeHelp;$('#helpDialog').addEventListener('cancel',e=>{e.preventDefault();closeHelp();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&!over)pauseGame(true);});
// Continuous horizontal intersections: no row grid or angle snapping.
function intervalAt(vertices,y){let xs=[];for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length];if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y))xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));}return xs.length?[Math.max(0,Math.min(...xs)),Math.min(W,Math.max(...xs))]:null;}
function coverage(y,polys){const spans=polys.map(p=>intervalAt(p,y)).filter(s=>s&&s[1]>s[0]).sort((a,b)=>a[0]-b[0]);let sum=0,left=-1,right=-1;for(const [a,b]of spans){if(a<=right)right=Math.max(right,b);else{sum+=Math.max(0,right-left);left=a;right=b;}}return sum+Math.max(0,right-left);}
function findBands(){
 const polys=blocks.flatMap(b=>parts(b).map(p=>p.vertices));
 rowStats=ROWS.map(row=>{
  let filled=0;for(let y=row.top+.5;y<row.bottom;y++)filled+=coverage(y,polys);
  return {...row,percent:Math.min(100,100*filled/(W*(row.bottom-row.top)))};
 });
 return rowStats.filter(row=>row.percent>=90&&blocks.filter(b=>b.bounds.max.y>row.top&&b.bounds.min.y<row.bottom).every(b=>b.isStatic));
}
function clip(poly,y,keepAbove){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],insideA=keepAbove?a.y<=y:a.y>=y,insideB=keepAbove?b.y<=y:b.y>=y;if(insideA)out.push({x:a.x,y:a.y});if(insideA!==insideB){const t=(y-a.y)/(b.y-a.y);out.push({x:a.x+t*(b.x-a.x),y});}}return out;}
function area(poly){return poly.length<3?0:Vertices.area(poly);}
function touching(a,b){for(const v of a)for(let i=0;i<b.length;i++){const p=b[i],q=b[(i+1)%b.length],dx=q.x-p.x,dy=q.y-p.y,t=Math.max(0,Math.min(1,((v.x-p.x)*dx+(v.y-p.y)*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(v.x-p.x-t*dx,v.y-p.y-t*dy)<.65)return true;}return false;}
function components(polys){const groups=[];while(polys.length){const group=[polys.pop()];for(let i=0;i<group.length;i++)for(let j=polys.length-1;j>=0;j--)if(touching(group[i],polys[j])||touching(polys[j],group[i]))group.push(polys.splice(j,1)[0]);groups.push(group);}return groups;}
function applyCut(bands){
 const remaining=[];for(const b of blocks){if(b===active&&!b.plugin.released){remaining.push(b);continue;}let polys=parts(b).map(p=>p.vertices.map(v=>({x:v.x,y:v.y})));let affected=false;
 for(const band of bands){const next=[];for(const poly of polys){const lo=Math.min(...poly.map(v=>v.y)),hi=Math.max(...poly.map(v=>v.y));if(hi<=band.top||lo>=band.bottom){next.push(poly);continue;}affected=true;for(const p of [clip(poly,band.top,true),clip(poly,band.bottom,false)])if(area(p)>9)next.push(p);}polys=next;}
 if(!affected){remaining.push(b);continue;}Composite.remove(engine.world,b);if(b===active)active=null;
 for(const group of components(polys)){const children=group.map(poly=>{const center=Vertices.centre(poly);return Bodies.fromVertices(center.x,center.y,[poly],physicalOptions(),false,.001,1,.001);}).filter(Boolean);if(!children.length)continue;const body=children.length===1?children[0]:Body.create({...physicalOptions(),parts:children});body.plugin={color:b.plugin.color,type:b.plugin.type,released:true};Body.setVelocity(body,{x:b.velocity.x*.4,y:0});Body.setAngularVelocity(body,b.angularVelocity*.3);Composite.add(engine.world,body);remaining.push(body);}
 }pendingBands=[];blocks=remaining;for(const body of blocks)Sleeping.set(body,false);lines+=bands.length;const earned=100*bands.length*bands.length;score+=earned;saveBest();toast((bands.length>1?bands.length+'줄 동시! ':'')+'+'+earned.toLocaleString());
 for(const band of bands)for(let i=0;i<45;i++)particles.push({x:Math.random()*W,y:band.top+Math.random()*CELL,vx:(Math.random()-.5)*120,vy:(Math.random()-.5)*120,life:.6,color:COLORS[i%7]});
 settleTime=0;scanClock=0;dangerClock=0;
}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),1400);}
function settleBody(body){
 Body.setVelocity(body,{x:0,y:0});Body.setAngularVelocity(body,0);
 Body.setStatic(body,true);body.plugin.fallSpeed=0;
}
function supports(body){
 const p={...body.position};Body.translate(body,{x:0,y:.8});
 const hits=Query.collides(body,[floorBody,...blocks.filter(b=>b!==body)]).map(c=>c.bodyA.parent===body?c.bodyB.parent:c.bodyA.parent);
 Body.setPosition(body,p);return hits;
}
function advanceBlocks(dt){
 // Only floor-connected resting blocks stay still; unsupported pieces fall again.
 const resting=blocks.filter(b=>b.isStatic),links=new Map(resting.map(b=>[b,supports(b)])),grounded=new Set([floorBody]);
 for(let pass=0;pass<resting.length;pass++)for(const b of resting)if(links.get(b).some(other=>grounded.has(other)))grounded.add(b);
 for(const b of resting)if(!grounded.has(b)){Body.setStatic(b,false);b.plugin.controlLocked=true;b.plugin.fallSpeed=0;}
 for(const body of blocks.slice().sort((a,b)=>b.bounds.max.y-a.bounds.max.y)){
  if(body.isStatic)continue;
  const controlled=body===active&&!body.plugin.controlLocked;
  const speed=controlled?30:Math.min(600,(body.plugin.fallSpeed||0)+900*dt);body.plugin.fallSpeed=speed;
  const distance=speed*dt,steps=Math.max(1,Math.ceil(distance));
  for(let i=0;i<steps;i++){
   const old={...body.position},dy=distance/steps;Body.translate(body,{x:0,y:dy});
   if(Query.collides(body,[floorBody,...blocks.filter(b=>b!==body)]).length){
    let low=0,high=dy;
    for(let n=0;n<12;n++){const mid=(low+high)/2;Body.setPosition(body,{x:old.x,y:old.y+mid});if(Query.collides(body,[floorBody,...blocks.filter(b=>b!==body)]).length)high=mid;else low=mid;}
    Body.setPosition(body,{x:old.x,y:old.y+low});
    if(controlled)lockControl();
    settleBody(body);
    break;
   }
  }
  if(!body.isStatic){Body.setVelocity(body,{x:0,y:speed/60});Body.setAngularVelocity(body,0);}
 }
}
function step(dt){
 if(paused||over)return;
 if(cut){cutClock+=dt;if(cutClock>=.36){const bands=cut;cut=null;applyCut(bands);}return;}
 if(drag){Sleeping.set(active,false);Body.setVelocity(active,{x:0,y:active.velocity.y});Body.setAngularVelocity(active,0);}
 advanceBlocks(dt);
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
 // Require each filled band to persist for five seconds of active play.
 scanClock+=dt;
 if(scanClock>=.1){const elapsed=scanClock;scanClock=0;
 const bands=findBands(),previous=pendingBands;const used=new Set();
 pendingBands=bands.map(band=>{
  const match=previous.findIndex((old,i)=>!used.has(i)&&Math.abs(old.top-band.top)<=2);
  if(match>=0)used.add(match);
  return {...band,age:match>=0?previous[match].age+elapsed:0};
 });
 const ready=pendingBands.filter(band=>band.age>=5);
 if(ready.length){releaseGrip();cut=ready;pendingBands=[];cutClock=0;return;}
 }
 if(active?.plugin.released){
  const still=!drag&&active.speed<.12&&Math.abs(active.angularVelocity)<.005;
  settleTime=still?settleTime+dt:0;
  if(settleTime>=1.5){active=null;}
 }
 if(!active){const high=blocks.some(b=>b.bounds.min.y<48&&b.speed<.5);if(high){dangerClock+=dt;if(dangerClock>.8)finish();}else{dangerClock=0;spawn();}}
}
function path(poly){ctx.beginPath();poly.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();}
function draw(){
 ctx.clearRect(0,0,W,H);ctx.fillStyle='#243b3b';ctx.fillRect(0,0,W,H);
 const gradient=ctx.createLinearGradient(0,0,0,H);gradient.addColorStop(0,'#36534b44');gradient.addColorStop(1,'#10292e55');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
 // Soft grain gives depth without suggesting a placement grid.
 ctx.fillStyle='#ffffff05';for(let i=0;i<85;i++)ctx.fillRect((i*137.7)%W,(i*73.3)%H,1,1);
 for(const b of blocks){const invalid=false;for(const part of parts(b)){path(part.vertices);ctx.fillStyle=b.plugin.color;ctx.fill();ctx.strokeStyle=invalid?'#fa5c61':'#152f3433';ctx.lineWidth=invalid?2.5:1;ctx.stroke();ctx.save();ctx.clip();ctx.strokeStyle='#ffffff30';ctx.lineWidth=3;ctx.translate(0,1);path(part.vertices);ctx.stroke();ctx.restore();}}
 if(active&&!active.plugin.controlLocked&&!over&&!cut){
 $('#angle').textContent=((Math.round(active.angle*180/Math.PI)%360+360)%360)+'°';
 }
 ctx.strokeStyle='#ffffff28';ctx.lineWidth=1;
 for(let i=0;i<ROWS.length;i++){
  const row=ROWS[i],stat=rowStats[i],label=rowMeter.children[i];
  ctx.beginPath();ctx.moveTo(0,row.top);ctx.lineTo(W,row.top);ctx.stroke();
  label.textContent=Math.floor(stat.percent+1e-7)+'%';label.classList.toggle('ready',stat.percent>=90);
  label.style.top=(100*(row.top+row.bottom)/2/H)+'%';
 }
 for(const band of pendingBands){ctx.fillStyle='#f4df8c22';ctx.fillRect(0,band.top,W,band.bottom-band.top);ctx.fillStyle='#f4df8c';ctx.fillRect(0,band.bottom-2,W*Math.min(1,band.age/5),2);}
 if(cut){for(const b of cut){ctx.fillStyle='rgba(250,246,204,'+(.3+Math.sin(cutClock*28)*.2)+')';ctx.fillRect(0,b.top,W,b.bottom-b.top);ctx.fillStyle='#fff9dc';ctx.fillRect(0,b.top,W,1);ctx.fillRect(0,b.bottom,W,1);}}
 for(const p of particles){ctx.globalAlpha=p.life/.6;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3);}ctx.globalAlpha=1;
 if(blocks.some(b=>b!==active&&b.bounds.min.y<110)){const g=ctx.createLinearGradient(0,0,0,90);g.addColorStop(0,'#ef7b5f55');g.addColorStop(1,'#ef7b5f00');ctx.fillStyle=g;ctx.fillRect(0,0,W,90);}
}
function resize(){const dpr=Math.min(devicePixelRatio||1,3);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);rowMeter.style.height=canvas.clientHeight+'px';rowMeter.style.top=(canvas.parentElement.offsetTop+canvas.parentElement.clientTop)+'px';draw();}window.addEventListener('resize',resize);
function frame(now){const delta=Math.min(.05,(now-lastFrame)/1000||0);lastFrame=now;if(!paused&&!over){accumulator+=delta;while(accumulator>=1/60){step(1/60);accumulator-=1/60;}}else accumulator=0;draw();requestAnimationFrame(frame);}
reset();updateControls();resize();requestAnimationFrame(frame);