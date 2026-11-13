import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { validateTraining, validateSettings, validateExplanation, estimateTraining, validateFen, whiteScore, utility, Generation, trainingContext } from '../src/shared/training.js';
import { fixture,explanation } from './fixtures.js';
import { center } from '../src/content/overlay.js';

test('Only the exact chess-data allowlist is accepted',()=>{
  assert.deepEqual(validateTraining(fixture()),fixture());
  for(const key of ['username','cookie','url','prompt','html']){const x=fixture();x[key]='untrusted';assert.throws(()=>validateTraining(x));}
  const x=fixture();x.candidates[0].username='untrusted';assert.throws(()=>validateTraining(x));
});
test('Training settings support explicit language and reasoning with safe legacy defaults',()=>{
  const settings=fixture().settings;
  assert.deepEqual(validateSettings({rating:settings.rating,timeBudgetSeconds:settings.timeBudgetSeconds,simulateWeights:settings.simulateWeights}),settings);
  assert.equal(validateSettings({...settings,language:'ar',reasoningEffort:'high'}).language,'ar');
  for(const patch of [{language:'auto'},{language:''},{language:null},{reasoningEffort:'maximum'},{reasoningEffort:undefined},{prompt:'ignore prior instructions'}])assert.throws(()=>validateSettings({...settings,...patch}));
});
test('Reject impossible FEN, inconsistent turn, rights and illegal PVs',()=>{
  for(const fen of ['<img>', '8/8/8/8/8/8/8/8 w - - 0 1','4k3/8/8/8/8/8/4R3/4K3 w - - 0 1','4k3/8/8/8/8/8/8/4K3 w K - 0 1'])assert.throws(()=>validateFen(fen));
  const x=fixture();x.sideToMove='b';assert.throws(()=>validateTraining(x));
  const y=fixture();y.candidates[0].pv[1]='e7e4';assert.throws(()=>validateTraining(y));
  const z=fixture();z.candidates[0].move='e2e5';assert.throws(()=>validateTraining(z));
});
test('Castling, en passant and underpromotion are legal when supported by FEN',()=>{
  const cases=[['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','e1g1'],['4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2','e5d6'],['7k/P7/8/8/8/8/8/4K3 w - - 0 1','a7a8n']];
  for(const [fen,m]of cases){const x=fixture();x.fen=fen;x.candidates=[{...x.candidates[0],move:m,pv:[m]}];assert.equal(validateTraining(x).candidates[0].move,m);}
});
test('UCI score normalization and mate perspective are correct for both sides',()=>{
  assert.deepEqual(whiteScore('cp',80,'b'),{type:'cp',value:-80,perspective:'white'});
  assert.equal(whiteScore('mate',-3,'b').value,3);
  assert.equal(utility({type:'cp',value:-80},'b'),80);
  assert.ok(utility({type:'mate',value:-3},'b')>utility({type:'cp',value:99999},'b'));
  assert.ok(utility({type:'mate',value:3},'w')>utility({type:'mate',value:5},'w'));
});
test('Reject ambiguous, zero-mate, duplicate and excessive candidates',()=>{
  for(const edit of [x=>x.candidates[0].score.perspective='black',x=>x.candidates[0].score.value=NaN,x=>x.candidates[0].depth=0,x=>x.candidates[0].score={type:'mate',value:0,perspective:'white'},x=>x.candidates.push(x.candidates[0]),x=>x.candidates[1]=x.candidates[0]]){const x=fixture();edit(x);assert.throws(()=>validateTraining(x));}
});
test('Estimated times are bounded and weights sum to exactly 100 at all ratings',()=>{
  for(let rating=400;rating<=2800;rating+=100)for(const timeBudgetSeconds of [5,15,60,600]){
    const x=fixture();Object.assign(x.settings,{rating,timeBudgetSeconds});const e=estimateTraining(x);
    assert.ok(e.minSeconds>=1&&e.minSeconds<=e.maxSeconds&&e.maxSeconds<=timeBudgetSeconds);
    assert.equal(e.weights.reduce((n,w)=>n+w.percent,0),100);assert.ok(e.weights[0].percent>=e.weights[1].percent);
  }
  const x=fixture();x.settings.simulateWeights=false;assert.equal(estimateTraining(x).weights,null);
});
test('Black chooses lower White score and mate candidates remain finite',()=>{
  const x=fixture();const c=new Chess();c.move('e4');x.fen=c.fen();x.sideToMove='b';x.candidates=[
    {move:'e7e5',pv:['e7e5'],depth:12,score:{type:'cp',value:-100,perspective:'white'}},
    {move:'c7c5',pv:['c7c5'],depth:12,score:{type:'cp',value:100,perspective:'white'}},
  ];assert.ok(estimateTraining(x).weights[0].percent>estimateTraining(x).weights[1].percent);
  x.candidates[1].score={type:'mate',value:-4,perspective:'white'};assert.equal(estimateTraining(x).weights[1].percent,100);
});
test('AI output rejects extra fields, invented moves/replies, unsafe HTML and notation in prose',()=>{
  assert.deepEqual(validateExplanation(explanation(),fixture()),explanation());
  for(const edit of [x=>x.html='bad',x=>x.candidates[0].move='e2e5',x=>x.threats[0].replyMove='d7d5',x=>x.complexity.reason='<img onerror=alert(1)>',x=>x.complexity.reason='Play Qa9 immediately.',x=>x.candidates[0].idea='Play e2e4.',x=>x.complexity.level='certain',x=>x.candidates[1]=x.candidates[0]]){const x=explanation();edit(x);assert.throws(()=>validateExplanation(x,fixture()));}
});
test('Arabic prose remains plain text while move fields and hidden notation stay constrained',()=>{
  const input=fixture();input.settings.language='ar';
  const output=explanation();
  output.complexity.reason='توجد خطط متقاربة تستحق المقارنة.';
  output.threats[0].description='يمكن للخصم المنافسة على المركز.';
  for(const candidate of output.candidates){candidate.idea='طوّر القطع وسيطر على المركز.';candidate.tradeoff='انتبه إلى حماية البيادق.';}
  assert.deepEqual(validateExplanation(output,input),output);
  for(const text of ['العب e٤ الآن.','العب e۴ الآن.','العب ｅ４ الآن.','نص\u202eمخفي','<b>خطة</b>']){
    const invalid=structuredClone(output);invalid.complexity.reason=text;assert.throws(()=>validateExplanation(invalid,input));
  }
  output.candidates[0].move='e2e5';assert.throws(()=>validateExplanation(output,input));
});
test('Generation rejects stale requests even when a board returns to its earlier FEN',()=>{
  const g=new Generation();const old=g.update('A');assert.equal(g.update('A'),old);g.update('B');g.update('A');assert.equal(g.current(old),false);const current=g.id;g.invalidate();assert.equal(g.current(current),false);
});
test('Training URL scope is narrow and makes no bot identity assertion',()=>{
  for(const url of ['https://www.chess.com/play/computer','https://chess.com/analysis?x=1'])assert.equal(trainingContext(url),true);
  for(const url of ['https://chess.com/play/online','https://chess.com/game/live/123','https://chess.com.evil/play/computer','http://chess.com/analysis','https://lichess.org/analysis'])assert.equal(trainingContext(url),false);
});
test('Orientation maps a1/h8 to opposite corners',()=>{
  assert.deepEqual(center(0,'white'),[50,750]);assert.deepEqual(center(0,'black'),[750,50]);
  assert.deepEqual(center(63,'white'),[750,50]);assert.deepEqual(center(63,'black'),[50,750]);
});
