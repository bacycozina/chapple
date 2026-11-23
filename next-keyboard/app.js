'use strict';
const $=s=>document.querySelector(s),STORE='next-keyboard-v1';let data={slots:[null,null,null],settings:{sound:true,volume:55,story:true}},current=null,pendingDelete=null,view='home',audioContext,buffer,audioLoad,noticeTimer;
try{const raw=JSON.parse(localStorage.getItem(STORE));if(raw&&Array.isArray(raw.slots)&&raw.slots.length===3){data.slots=raw.slots.map(s=>s&&Number.isFinite(s.created)&&Number.isFinite(s.updated)?{...normalizeProgress(s),created:s.created,updated:s.updated,money:Math.max(0,Number(s.money)||0),storyIntroSeen:s.storyIntroSeen===true,storySeen:Array.isArray(s.storySeen)?s.storySeen.filter(id=>['echo','memory','outside','answer'].includes(id)):[],specialUp:sanitizeSpecialUp(s.specialUp),currencyVersion:s.currencyVersion===2?2:1,damageLevel:Math.max(0,Math.min(6,Math.floor(Number(s.damageLevel)||0))),timeLevel:Math.max(0,Math.min(6,Math.floor(Number(s.timeLevel)||0))),capacityLevel:Math.max(0,Math.min(3,Math.floor(Number(s.capacityLevel)||0))),batchLevel:Math.max(0,Math.min(7,Math.floor(Number(s.batchLevel)||0))),boardLevel:0,regenLevel:Math.max(0,Math.min(10,Math.floor(Number(s.regenLevel)||0))),turn:Math.max(1,Number(s.turn)||1),level:Math.max(1,Number(s.level)||1),keyCount:Math.max(8,Math.min(31,Math.floor(Number(s.keyCount)||8))),treeBought:Array.isArray(s.treeBought)?[...new Set(s.treeBought.filter(v=>/^(?:supply-b[0-2]-[0-9]|d-[0-5]|b[0-2]-(?:[0-9]|1[0-5])|s-(?:enter|caps|back|space)-(?:chance|damage|radius|duration|multi|speed|split)-[0-2])$/.test(v)))]:[],rangeLevel:Math.max(0,Math.min(10,Math.floor(Number(s.rangeLevel)||0))),pressLevel:Math.max(0,Math.min(8,Math.floor(Number(s.pressLevel)||0))),round:restoreRound(s.round),tutorialDone:s.tutorialDone!==false,tutorial:s.tutorialDone===false?sanitizeTutorial(s.tutorial):null}:null);if(raw.settings)data.settings={sound:raw.settings.sound!==false,volume:Math.max(0,Math.min(100,Number(raw.settings.volume)||0)),story:raw.settings.story!==false};}}catch{}
// Gameplay commits only at the shop; settings and tutorial metadata remain independent.
for(const slot of data.slots){if(slot?.round&&slot.round.phase!=='end'){slot.money=Math.max(0,slot.money-slot.round.earned);slot.round=null;}}
for(const slot of data.slots){if(slot&&slot.currencyVersion!==2){slot.money=Math.ceil(slot.money/10);if(slot.round)slot.round.earned=Math.ceil(slot.round.earned/10);slot.currencyVersion=2;}}
let slotCheckpoints=structuredClone(data.slots);
function sanitizeSpecialUp(raw){const result={};if(raw&&typeof raw==='object')for(const [key,value] of Object.entries(raw)){if(/^(enter|caps|back|space)_(chance|damage|radius|duration|multi|speed|split)$/.test(key))result[key]=Math.max(0,Math.min(3,Math.floor(Number(value)||0)))}return result}
function restoreRound(r){if(!r||!['ready','playing','end'].includes(r.phase)||!Array.isArray(r.keys))return null;return {phase:r.phase,left:Math.max(0,Math.min(35,Number(r.left)||0)),earned:Math.max(0,Number(r.earned)||0),keys:r.keys.map(k=>({x:Number(k.x)||50,y:Number(k.y)||50,hp:Math.max(0,Number(k.hp)||0),maxHp:Math.max(1,Number(k.maxHp)||Number(k.hp)||2),type:['enter','caps','back','space'].includes(k.type)?k.type:'normal',cells:Array.isArray(k.cells)?k.cells.filter(i=>Number.isInteger(i)&&i>=0&&i<1056):(Number.isInteger(k.seat)?[k.seat]:[]),seat:Number.isInteger(k.seat)&&k.seat>=0&&k.seat<1056?k.seat:null,split:k.split===true,overflow:k.overflow===true,spanX:Math.max(0,Number(k.spanX)||0),spanY:Math.max(0,Number(k.spanY)||0),label:/^[0-9]$/.test(String(k.label))?'QWERTYUIOP'[Number(k.label)]:String(k.label||'K').slice(0,12)}))}}
function sanitizeTutorial(t){return {stage:Number.isInteger(t?.stage)?Math.max(0,Math.min(5,t.stage)):0}}
function notify(text){$('#notice').textContent=text;$('#notice').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.remove('show'),2600)}
function save(){try{const slots=data.slots.map((slot,i)=>{
 if(!slot)slotCheckpoints[i]=null;
 else if(!slot.round||slot.round.phase==='end')slotCheckpoints[i]=structuredClone(slot);
 else if(!slotCheckpoints[i])slotCheckpoints[i]={...structuredClone(slot),money:Math.max(0,slot.money-slot.round.earned),round:null};
 return slotCheckpoints[i];
});localStorage.setItem(STORE,JSON.stringify({slots,settings:data.settings}));return true}catch{notify('저장 공간을 사용할 수 없어요. 브라우저 설정을 확인해주세요.');return false}}
const audioBanks=new Map();

function getAudioContext() {
 audioContext ??= new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'interactive'});
 return audioContext;
}
function prepareAudio(file) {
 if (!audioBanks.has(file)) {
  const context = getAudioContext();
  const loading = fetch(file)
   .then(response => {
    if (!response.ok) throw new Error('Audio download failed');
    return response.arrayBuffer();
   })
   .then(bytes => context.decodeAudioData(bytes))
   .catch(error => {
    audioBanks.delete(file);
    throw error;
   });
  audioBanks.set(file, loading);
 }
 return audioBanks.get(file);
}
function preloadAudio() {
 for (const file of ['typing.mp3', 'audio/aurora.wav', 'audio/whitefox.wav']) {
  try { void prepareAudio(file).catch(() => {}); } catch {}
 }
}
function unlockAudio() {
 try {
  const context = getAudioContext();
  if (context.state !== 'running') void context.resume().catch(() => {});
 } catch {}
}
preloadAudio();
document.addEventListener('pointerdown', unlockAudio, {capture: true, passive: true});
document.addEventListener('keydown', unlockAudio, {capture: true});

const KEY_SOUNDS={aurora:{file:"audio/aurora.wav",rate:1,filter:"lowpass",frequency:18000,length:.23,gain:.65},whitefox:{file:"audio/whitefox.wav",rate:1,filter:"lowpass",frequency:18000,length:.23,gain:.65},button:{rate:1.15,filter:"lowpass",frequency:3400,length:.11,gain:.5},c:{rate:1.35,filter:'highpass',frequency:1100,length:.13,gain:.65},k:{rate:.78,filter:'lowpass',frequency:1800,length:.24,gain:.85},enter:{rate:1,filter:'peaking',frequency:650,length:.3,gain:.65}};
function keyVoice(parent,seed){
 const n=Math.abs(Math.trunc(Number(seed)||0));
 const tone=((n*17+11)%97)/96,tail=((n*43+7)%89)/88;
 if(parent.file)return {...parent,offset:(n%8)*.27,rate:.98+tone*.04};
 return {...parent,rate:parent.rate*(.7+tone*.7),length:parent.length*(.65+tail*.75),frequency:parent.frequency*(.75+tone*.5),gain:parent.gain*.85};
}
function buttonVoiceSeed(button){const name=button.id||button.dataset.action||button.getAttribute('aria-label')||button.textContent;let hash=0;for(const char of name)hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;return hash;}
async function sound(kind='k',notes=null){if(!data.settings.sound||!data.settings.volume)return;const parent={...(KEY_SOUNDS[kind]||KEY_SOUNDS.k)},file=parent.file||'typing.mp3';try{const context = getAudioContext(); const clipPromise = prepareAudio(file); if (context.state !== 'running') await context.resume(); const clipBuffer = await clipPromise;if(!data.settings.sound||!data.settings.volume)return;
const profiles=Array.isArray(notes)?notes.slice(0,48).map(seed=>keyVoice(parent,seed)):[parent.file?keyVoice(parent,Math.floor(Math.random()*8)):parent];if(!profiles.length)return;
const voices=profiles.length,base=audioContext.currentTime+.008,mix=audioContext.createDynamicsCompressor();mix.threshold.value=-12;mix.knee.value=12;mix.ratio.value=8;mix.attack.value=.002;mix.release.value=.1;mix.connect(audioContext.destination);let remaining=voices;
for(const profile of profiles){const source=audioContext.createBufferSource(),gain=audioContext.createGain(),filter=audioContext.createBiquadFilter(),now=base;source.buffer=clipBuffer;source.playbackRate.value=profile.rate;filter.type=profile.filter;filter.frequency.value=profile.frequency;filter.Q.value=.7;if(profile.filter==='peaking')filter.gain.value=6;const volume=data.settings.volume/100*profile.gain/Math.sqrt(voices);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume,now+.003);if(profile.file){gain.gain.setValueAtTime(volume,now+profile.length/profile.rate-.015);gain.gain.linearRampToValueAtTime(0,now+profile.length/profile.rate)}else gain.gain.setTargetAtTime(0,now+profile.length*.35,profile.length*.16);source.connect(filter).connect(gain).connect(mix);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();if(--remaining===0)mix.disconnect()};source.start(now,profile.offset??.15,profile.file?profile.length:profile.length*profile.rate)}
}catch{notify('효과음을 재생하지 못했어요. 다시 시도해주세요.')}}
function home(showSlots=false){stopDialogue();closePrestige();document.querySelector('main').style.maxWidth='';stopRound();if(view==='board'&&current!==null&&slotCheckpoints[current])data.slots[current]=structuredClone(slotCheckpoints[current]);document.body.classList.remove('playing-game');view='home';current=null;$('#screen').innerHTML=`<div class="hero"><h1>차세대 키보드</h1><div class="home-stage">${showSlots?`<div class="home-slots" aria-label="저장 파일 선택">${data.slots.map((s,i)=>`<article class="home-slot"><button class="wide" data-slot="${i}" aria-label="저장 파일 ${i+1} ${s?'이어하기':'새 게임'}"><span class="slot-num">SAVE 0${i+1}</span><span class="slot-label">${s?'이어하기':'새 게임'}</span></button>${s?`<button class="slot-delete" data-delete="${i}" aria-label="저장 파일 ${i+1} 삭제">삭제</button>`:'<span class="slot-space"></span>'}</article>`).join('')}</div>`:`<div class="hero-keys" aria-label="타건음 미리 듣기"><button class="key" data-sound="c" aria-label="C 키, 가벼운 클릭 소리">C</button><button class="key" data-sound="k" aria-label="K 키, 낮은 톡톡 소리">K</button><button class="key" data-sound="enter" aria-label="엔터 키, 묵직한 타건 소리">↵</button></div>`}</div><div class="menu"><button class="primary" data-action="slots" aria-expanded="${showSlots}">시작</button><button class="pink" data-action="replays">지난 이야기</button></div></div>`}
function slots(){home(true)}
function enter(i){current=i;if(!data.slots[i])data.slots[i]={created:Date.now(),updated:Date.now(),money:0,currencyVersion:2,timeLevel:0,regenLevel:0,turn:1,level:1,keyCount:8,rangeLevel:0,pressLevel:0};prepareSlot(data.slots[i]);data.slots[i].updated=Date.now();shopInitialized=false;save();desk()}
function desk(){showBoard()}
function syncSettings(){$('#sound').checked=data.settings.sound;$('#volume').value=data.settings.volume;$('#volumeLabel').textContent=data.settings.volume+'%';}
function options(){syncSettings();$('#options').showModal()}
$('#screen').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.hasAttribute('data-fragment'))return;if(b.hasAttribute('data-sound')){if(!b.closest('.shop-shell'))sound(b.dataset.sound);return}if(b.dataset.slot!==undefined){enter(Number(b.dataset.slot));return}if(b.dataset.delete!==undefined){pendingDelete=Number(b.dataset.delete);$('#deleteDialog').showModal();return}({home,slots,replays:showReplays,settings:options,saveHome:()=>{if(current!==null)data.slots[current].updated=Date.now();const ok=save();home();if(ok)notify('저장했어요.')}}[b.dataset.action])?.()});
$('#home').onclick=()=>home();$('#settings').onclick=options;$('#sound').onchange=e=>{data.settings.sound=e.target.checked;save()};$('#volume').oninput=e=>{data.settings.volume=Number(e.target.value);syncSettings();save()};$('#cancelDelete').onclick=()=>$('#deleteDialog').close();$('#confirmDelete').onclick=()=>{if(pendingDelete===null)return;data.slots[pendingDelete]=null;save();pendingDelete=null;$('#deleteDialog').close();slots()};syncSettings();

// Capture clicks before navigation replaces the clicked button.
document.addEventListener('click',event=>{
 const button=event.target.closest?.('button');
 if(view==='board'&&current!==null&&data.slots[current]?.round?.phase==='end')return;
 if(!button||button.disabled||button.getAttribute('aria-disabled')==='true'||button.hasAttribute('data-sound'))return;
 sound('button',[buttonVoiceSeed(button)]);
},true);


async function upgradeChime(){if(!data.settings.sound||!data.settings.volume)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();await audioContext.resume();if(!data.settings.sound||!data.settings.volume)return;const start=audioContext.currentTime;[523.25,783.99].forEach((frequency,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain(),at=start+i*.075;o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.12*data.settings.volume/100,at+.012);g.gain.exponentialRampToValueAtTime(.0001,at+.24);o.connect(g).connect(audioContext.destination);o.onended=()=>{o.disconnect();g.disconnect()};o.start(at);o.stop(at+.25)})}catch{}}