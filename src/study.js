import { Chess } from 'chess.js';
import { validateFen } from './shared/training.js';
import { TrainingPanel } from './content/training-panel.js';
import { Overlay } from './content/overlay.js';
import { sqIndex } from './content/position.js';
import { pvToSan, formatScore } from './content/format.js';
import '@ui-sdk/web/button';
import '@ui-sdk/web/field';
import '@ui-sdk/web/select';
import '@ui-sdk/web/textarea';
import { createAgent } from '@ui-sdk/web/agent';
import { readPreferences, savePreferences, watchPreferences, applyDocumentLanguage } from './ui/preferences.js';
import { studyCopy } from './ui/study-i18n.js';

const $=s=>document.querySelector(s);
let chess=new Chess(), orientation='white', selected=null, job=0, port, ready=false;
let language='en', status='starting';
const text=key=>studyCopy[language][key];
const lines=new Map(); const overlay=new Overlay();
const trainer=new TrainingPanel($('#trainer'),{onSelect:draw});
const glyphs={wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟'};
const pieceNames={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
window.chessStudyAgent=createAgent({allow:step=>!step.confirm});
function updateStatus(next=status){
  status=next;
  const side=text(chess.turn()==='w'?'white':'black');
  $('#turn-label').textContent=language==='ar'?`${text('toMove')}: ${side}`:`${side} ${text('toMove')}`;
  $('#local-status').textContent=['ready','analyzing'].includes(status)?`${$('#turn-label').textContent}. ${text(status)}`:text(status);
  $('#local-status').toggleAttribute('data-error',['invalidFen','engineFailed','disconnected'].includes(status));
}
function translate(preferences){
  language=preferences.uiLanguage;
  applyDocumentLanguage(language);
  document.title=text('pageTitle');
  for(const element of document.querySelectorAll('[data-text]'))if(studyCopy[language][element.dataset.text])element.textContent=text(element.dataset.text);
  $('#study-language').value=language;
  $('#board').setAttribute('aria-label',text('boardName'));
  $('.study-nav').setAttribute('aria-label',language==='ar'?'التنقل الرئيسي':'Main navigation');
  updateStatus();board();draw();
}
function draw(){
  overlay.place($('#board').getBoundingClientRect());
  const sorted=[...lines.entries()].sort((a,b)=>a[0]-b[0]).map(([,l])=>l).slice(0,3);
  trainer.update({fen:chess.fen(),turn:chess.turn()},sorted,true);
  const candidate=sorted.find(l=>l.moves[0].uci===trainer.selected);
  if(candidate){const m=candidate.moves[0];overlay.draw([{from:sqIndex(m.from),to:sqIndex(m.to),rank:0,ply:0,n:1}],orientation);}
  else overlay.clear();
  const signature=JSON.stringify([language,sorted.map(l=>[l.moves[0].san,l.info])]);
  if(signature!==draw.signature){
    draw.signature=signature;
    $('#engine-lines').replaceChildren(...sorted.map(l=>{const p=document.createElement('p');const b=document.createElement('b');b.textContent=l.moves[0].san;const s=document.createElement('span');s.textContent=`${formatScore(l.info)} · ${text('depth')} ${l.info.depth}`;p.append(b,s);return p;}));
  }
}
function board(){
  const focused=document.activeElement?.dataset?.square;
  const squares=Array.from({length:64},(_,i)=>orientation==='white'?`${'abcdefgh'[i%8]}${8-Math.floor(i/8)}`:`${'hgfedcba'[i%8]}${1+Math.floor(i/8)}`);
  const legal=selected?chess.moves({square:selected,verbose:true}).map(m=>m.to):[];
  $('#board').replaceChildren(...squares.map(square=>{
    const p=chess.get(square);const b=document.createElement('button');b.type='button';b.dataset.square=square;
    b.className=((square.charCodeAt(0)+ +square[1])%2===0?'dark ':'')+(p?.color==='w'?'white':'black');
    b.classList.toggle('chosen',square===selected);b.classList.toggle('legal',legal.includes(square));
    b.textContent=p?glyphs[p.color+p.type]:'';b.setAttribute('aria-label',square+(p?` ${text(p.color==='w'?'white':'black')} ${text(pieceNames[p.type])}`:` ${text('empty')}`));
    b.setAttribute('aria-pressed',String(square===selected));
    const coord=document.createElement('small');coord.textContent=square;b.append(coord);
    b.onclick=()=>{
      if(selected && legal.includes(square)){
        chess.move({from:selected,to:square,promotion:$('#promotion').value??'q'});selected=null;changed();
      }else{selected=p?.color===chess.turn()?square:null;board();}
    };
    return b;
  }));
  if(focused)$('#board').querySelector(`[data-square="${focused}"]`)?.focus({preventScroll:true});
}
function changed(){
  $('#fen').removeAttribute('aria-invalid');
  job++;lines.clear();trainer.invalidate();$('#fen').value=chess.fen();board();draw();
  updateStatus(chess.isCheckmate()?'checkmate':chess.isGameOver()?'draw':ready?'analyzing':'starting');
  if(ready){port.postMessage({type:'stop'});if(!chess.isGameOver())port.postMessage({type:'analyze',id:job,fen:chess.fen(),multipv:3,depth:12});}
}
$('#flip-action').addEventListener('action',()=>{orientation=orientation==='white'?'black':'white';board();draw();});
$('#undo-action').addEventListener('action',()=>{if(chess.undo()){selected=null;changed();}});
$('#reset-action').addEventListener('action',()=>{chess=new Chess();selected=null;changed();});
$('#load-action').addEventListener('action',()=>{try{chess=validateFen($('#fen').value.trim());selected=null;changed();}catch{updateStatus('invalidFen');$('#fen').setAttribute('aria-invalid','true');$('#fen').focus();}});
$('#fen').addEventListener('input',()=>$('#fen').removeAttribute('aria-invalid'));
$('#study-language').addEventListener('valuechange',event=>{if(['en','ar'].includes(event.detail.value))savePreferences({uiLanguage:event.detail.value}).then(translate);});
readPreferences().then(translate);
watchPreferences(translate);
new ResizeObserver(()=>overlay.place($('#board').getBoundingClientRect())).observe($('#board'));
window.addEventListener('scroll',()=>overlay.place($('#board').getBoundingClientRect()),{passive:true});
changed();
async function connect(){
  try{
    const result=await chrome.runtime.sendMessage({type:'ensure-engine'});if(!result?.ok)throw new Error();
    port=chrome.runtime.connect({name:'analysis'});
    port.onMessage.addListener(msg=>{
      if(msg.type==='ready'){ready=true;changed();}
      if(msg.type==='info'&&msg.id===job){const {moves}=pvToSan(chess.fen(),msg.pv,6);if(moves.length){lines.set(msg.multipv,{info:msg,moves});draw();}}
      if(msg.type==='done'&&msg.id===job)updateStatus('ready');
    });
    port.onDisconnect.addListener(()=>{ready=false;updateStatus('disconnected');});
  }catch{updateStatus('engineFailed');}
}
connect();
