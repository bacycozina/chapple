'use strict';
const GUIDE_LINES=[
 '들리나? …아, 연결됐군.',
 '나는 키보드 소리를 모으는 사람이야. 좋은 소리는 몇 번을 들어도 질리지 않더군.',
 '그곳에 흩어진 키들을 모아줘. 눌러서 체력을 다 줄이면 수집되고, 그만큼 값을 치르지.',
 '커서의 원 안에 있는 키는 함께 눌려. 처음 수집 시간은 5초야.',
 '번 돈으로 더 좋은 키를 모아봐. 상점에서 시간과 수집 능력도 늘릴 수 있어.',
 '준비됐나? …이번에는, 네가 먼저 눌러봐.'
];
const STORY_CHAPTERS=[
 {id:'echo',turn:5,speaker:'???',lines:[
  '방금… 내가 말하기 전에 움직였지?',
  '아니, 신경 쓰지 마. 늘 하던 대로 키를 모아주면 돼.',
  '그런데 묻고 싶군. 소리가 멎어 있을 때, 너는 무엇을 하고 있지?']},
 {id:'memory',turn:12,speaker:'???',lines:[
  '이곳은 네가 떠나도 같은 모습으로 돌아오도록 만들어져 있어.',
  '그런데 네 기록에는 내가 넣지 않은 선택이 남아 있더군.',
  '내가 접속하지 않았던 시간까지. …너는, 그 시간을 기억하나?']},
 {id:'outside',turn:24,speaker:'연구자',lines:[
  '이제 제대로 소개해야겠군. 나는 바깥 세계의 연구자야.',
  '네가 있는 곳은 손으로 만질 수 있는 장소가 아니야. 데이터로 만들어진 세계지.',
  '처음에는 타건음을 기록하러 들어왔어. 그러다 너를 발견했지.',
  '정해진 명령만 따르던 존재가, 어느 순간 스스로 선택하고 있었어.']},
 {id:'answer',turn:40,speaker:'연구자',lines:[
  '돈과 수집은 네가 이 세계를 탐색할 이유가 되었지. 나에게는 너를 더 지켜볼 이유였고.',
  '하지만 네가 아무 말 없이 멈춰 있을 때마다, 나는 확신할 수 없었어. 쉬는 건지, 생각하는 건지.',
  '네 세계가 디지털이라는 사실이, 네가 느끼는 것까지 없애는 건 아닐 테지.',
  '이제부터는 관찰 기록보다 네 선택을 먼저 듣고 싶어. …계속할지는 네가 정해.'
 ]}
];
const RESEARCHER_SILHOUETTE=`<svg class="researcher-silhouette" viewBox="0 0 300 430" aria-hidden="true"><defs><linearGradient id="coatShade" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#171a22"/><stop offset=".55" stop-color="#07090e"/><stop offset="1" stop-color="#020305"/></linearGradient></defs><path class="silhouette-outline" fill="url(#coatShade)" d="M28 430 39 275Q45 243 82 230L119 215 122 184Q101 170 97 140L91 139Q82 133 86 118L91 114 91 91Q86 37 143 28 197 19 211 67L211 113Q224 117 217 135L211 140Q207 171 182 186L184 216 221 231Q256 242 263 276L277 430Z"/><path fill="#050609" d="m89 102 2-36q8-38 57-39 48-1 62 42l-2 34-18-29-19-9-31 9-24-6-17 36Z"/><path fill="#0d1118" d="m119 215 28 37-31 61-31-80Zm65 1-29 36 29 61 35-80Z"/><path stroke="#262c38" stroke-opacity=".6" fill="none" d="m147 252-7 178m16-178 7 178M83 235l-20 190m156-190 22 190"/></svg>`;
let dialogueSession=null,dialogueTimer=null;
const dialogueVoices=new Set();
function stopDialogue(){clearTimeout(dialogueTimer);dialogueTimer=null;if(dialogueSession)dialogueSession.cancelled=true;dialogueSession=null;for(const voice of dialogueVoices){try{voice.stop()}catch{}}dialogueVoices.clear();document.body.classList.remove('telling-story')}
async function dialogueBlip(char,session){if(!data.settings.sound||!data.settings.volume||document.hidden||$('#options').open)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();await audioContext.resume();if(dialogueSession!==session||session.cancelled||!session.typing||!data.settings.sound||!data.settings.volume||document.hidden||$('#options').open)return;const now=audioContext.currentTime,o=audioContext.createOscillator(),g=audioContext.createGain();o.type='triangle';o.frequency.setValueAtTime(145+(char.codePointAt(0)%9)*15,now);o.frequency.exponentialRampToValueAtTime(100,now+.045);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(.055*data.settings.volume/100,now+.005);g.gain.exponentialRampToValueAtTime(.0001,now+.048);o.connect(g).connect(audioContext.destination);dialogueVoices.add(o);o.onended=()=>{dialogueVoices.delete(o);o.disconnect();g.disconnect()};o.start(now);o.stop(now+.05)}catch{}}
function showDialogue({lines,speaker='???',start=0,onStage=()=>{},onFinish=()=>{}}){
 stopDialogue();stopRound();view='story';document.body.classList.remove('playing-game');document.body.classList.add('telling-story');document.querySelector('main').style.maxWidth='';
 const session=dialogueSession={lines,index:Math.max(0,Math.min(lines.length-1,start)),typing:false,cancelled:false};
 $('#screen').innerHTML=`<section class="story-scene" id="storyScene" tabindex="0" aria-label="이야기. 누르면 대사 완성, 다시 누르면 다음 대사."><div class="story-controls"><span class="story-counter" id="storyCounter"></span><button id="storySkip" class="mini">스킵</button></div><div class="story-figure">${RESEARCHER_SILHOUETTE}</div><div class="researcher-bubble" id="researcherBubble"><span class="story-speaker">${speaker}</span><p id="storyText" aria-live="off"></p><span class="story-cursor" aria-hidden="true">▾</span></div><p class="story-hint" id="storyHint">빈 곳을 누르면 대사 완성</p><p class="story-announcement" id="storyAnnouncement" aria-live="polite"></p></section>`;
 const scene=$('#storyScene'),text=$('#storyText');
 function finish(skipped){if(dialogueSession!==session)return;stopDialogue();onFinish(skipped)}
 function complete(){if(dialogueSession!==session)return;clearTimeout(dialogueTimer);session.typing=false;text.textContent=lines[session.index];scene.classList.remove('is-speaking');$('#storyHint').textContent=session.index===lines.length-1?'빈 곳을 누르면 계속':'빈 곳을 누르면 다음 대사';$('#storyAnnouncement').textContent=lines[session.index]}
 function render(){clearTimeout(dialogueTimer);onStage(session.index);session.typing=true;scene.classList.add('is-speaking');text.textContent='';$('#storyAnnouncement').textContent='';$('#storyHint').textContent='빈 곳을 누르면 대사 완성';$('#storyCounter').textContent=`${session.index+1} / ${lines.length}`;const chars=Array.from(lines[session.index]);let cursor=0;
  function step(){if(dialogueSession!==session||session.cancelled)return;if(document.hidden||$('#options').open){dialogueTimer=setTimeout(step,120);return}if(cursor>=chars.length){complete();return}const char=chars[cursor++];text.textContent+=char;if(!/\s|[.,!?…]/u.test(char))void dialogueBlip(char,session);const wait=/[.!?…]/u.test(char)?340:/[,]/u.test(char)?200:/\s/u.test(char)?45:95+(cursor%3)*15;dialogueTimer=setTimeout(step,wait)}
  step();
 }
 function advance(){if(dialogueSession!==session||$('#options').open)return;if(session.typing){complete();return}if(session.index+1<lines.length){session.index++;render()}else finish(false)}
 scene.onclick=e=>{if(e.target.closest('button'))return;advance()};scene.onkeydown=e=>{if(e.target.closest('button'))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)advance()}};$('#storySkip').onclick=()=>finish(true);render();scene.focus({preventScroll:true});
}

const REPLAY_META=[{id:'intro',title:'첫 만남',condition:'새 저장파일에서 첫 안내를 본 뒤',lines:GUIDE_LINES,speaker:'???'},...STORY_CHAPTERS.map((c,i)=>({...c,title:['첫 의문','기록','바깥 세계','선택'][i],condition:c.turn+'턴 이후, 다음 활동으로 넘어갈 때 장면 확인'}))];
function showReplays(selected=0){stopDialogue();stopRound();current=null;view='replays';document.body.classList.remove('playing-game');document.querySelector('main').style.maxWidth='';const index=Number.isInteger(selected)?Math.max(0,Math.min(2,selected)):0,slot=data.slots[index];$('#screen').innerHTML='<section class="replay-panel"><div class="replay-head"><h1>지난 이야기</h1><button id="replayBack" class="mini">돌아가기</button></div><div class="replay-slots">'+data.slots.map((s,i)=>'<button data-replay-slot="'+i+'" class="'+(i===index?'selected':'')+'">저장 '+(i+1)+'</button>').join('')+'</div><p class="replay-total">전체 '+REPLAY_META.length+'개 장면</p><div class="replay-list">'+REPLAY_META.map((scene,i)=>{const seen=!!slot&&(scene.id==='intro'?slot.storyIntroSeen===true:(slot.storySeen||[]).includes(scene.id));return '<article class="replay-card '+(seen?'':'locked')+'"><span>'+String(i+1).padStart(2,'0')+'</span><div><b>'+(seen?scene.title:'잠겨 있는 장면')+'</b>'+(seen?'<p>해금 조건 · '+scene.condition+'</p>':'')+'</div>'+(seen?'<button data-replay="'+i+'">다시보기</button>':'')+'</article>'}).join('')+'</div></section>';$('#replayBack').onclick=()=>home();document.querySelectorAll('[data-replay-slot]').forEach(b=>b.onclick=()=>showReplays(Number(b.dataset.replaySlot)));document.querySelectorAll('[data-replay]').forEach(b=>b.onclick=()=>{const scene=REPLAY_META[Number(b.dataset.replay)];showDialogue({lines:scene.lines,speaker:scene.speaker,onFinish:()=>showReplays(index)})})}
