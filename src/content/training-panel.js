import { Chess } from 'chess.js';
import { estimateTraining, validateTraining, validateExplanation, Generation } from '../shared/training.js';
import { readPreferences, watchPreferences } from '../ui/preferences.js';
import { explanationError } from '../shared/explanation-errors.js';

const COPY={
  en:{title:'Make this position a lesson',intro:'Take a moment to choose your move before asking for help.',rating:'Your playing level',budget:'Your thinking budget',seconds15:'15 seconds',seconds30:'30 seconds',minute1:'1 minute',minutes3:'3 minutes',minutes10:'10 minutes',weights:'Show simulated choice weights',estimateNote:'Complexity, thinking time and choice weights are estimates, not measured human behavior. Weights compare only these moves.',highlight:'Highlight a candidate',practice:'This is local analysis or a built-in bot',practiceHelp:'Page detection cannot reliably identify bots. Never use explanations against people. Check the FEN if the turn or castling rights are uncertain.',explain:'Explain position',explaining:'Explaining…',account:'AI settings',privacy:'Optional explanations use your ChatGPT plan after consent. Only validated chess data and your training settings are shared.',local:'Local Stockfish works without signing in.',waiting:'Waiting for a valid local engine line.',changed:'Position or preferences changed. Explain when you’re ready.',requesting:'Using your ChatGPT plan to explain these engine moves…',complete:'Explanation of this snapshot. AI estimates may be wrong; compare them with the local engine.',low:'low',medium:'medium',high:'high',complexity:'Local complexity estimate',thinking:'Estimated thinking time',seconds:'seconds',simulated:'simulated',aiComplexity:'AI complexity estimate',threats:'Potential replies to watch',tradeoff:'Tradeoff',aiLanguage:'AI language',thinkingMode:'Thinking',en:'English',ar:'Arabic',default:'Model default',none:'None',minimal:'Minimal',xhigh:'Extra high',max:'Maximum',failure:'Explanation unavailable.',stillLocal:'Local analysis remains available.',},
  ar:{title:'حوّل هذه الوضعية إلى درس',intro:'خذ لحظة لاختيار نقلتك قبل طلب المساعدة.',rating:'مستواك في اللعب',budget:'وقت التفكير المتاح',seconds15:'15 ثانية',seconds30:'30 ثانية',minute1:'دقيقة واحدة',minutes3:'3 دقائق',minutes10:'10 دقائق',weights:'اعرض أوزان اختيار محاكاة',estimateNote:'التعقيد ووقت التفكير وأوزان الاختيار تقديرات، وليست قياسات لسلوك البشر. تقارن الأوزان هذه النقلات فقط.',highlight:'ميّز نقلة مرشحة',practice:'هذا تحليل محلي أو تدريب مع روبوت مدمج',practiceHelp:'لا يمكن لاكتشاف الصفحة تحديد الروبوتات بشكل موثوق. لا تستخدم الشرح ضد أشخاص. تحقّق من FEN إذا كان الدور أو حق التبييت غير مؤكد.',explain:'اشرح الوضعية',explaining:'جارٍ الشرح…',account:'إعدادات الذكاء الاصطناعي',privacy:'يستخدم الشرح الاختياري خطة ChatGPT بعد موافقتك. تُشارك بيانات الشطرنج المتحقق منها وإعدادات التدريب فقط.',local:'يعمل Stockfish محليًا دون تسجيل دخول.',waiting:'بانتظار خط لعب صالح من المحرك المحلي.',changed:'تغيّرت الوضعية أو التفضيلات. اطلب الشرح عندما تكون مستعدًا.',requesting:'تُستخدم خطة ChatGPT لشرح نقلات المحرك هذه…',complete:'شرح لهذه اللقطة من الوضعية. قد تخطئ تقديرات الذكاء الاصطناعي؛ قارنها بالمحرك المحلي.',low:'منخفض',medium:'متوسط',high:'مرتفع',complexity:'تقدير التعقيد المحلي',thinking:'وقت التفكير التقديري',seconds:'ثانية',simulated:'محاكاة',aiComplexity:'تقدير التعقيد بالذكاء الاصطناعي',threats:'ردود محتملة تستحق الانتباه',tradeoff:'المقابل',aiLanguage:'لغة الشرح',thinkingMode:'التفكير',en:'الإنجليزية',ar:'العربية',default:'افتراضي النموذج',none:'بلا تفكير إضافي',minimal:'أدنى',xhigh:'مرتفع جدًا',max:'أقصى',failure:'الشرح غير متاح.',stillLocal:'يبقى التحليل المحلي متاحًا.',},
};
const STYLE=`
.training{container:training / inline-size;margin-block-start:12px;border-block-start:1px solid #d3d9d0;padding:22px 24px 24px;background:#fffefb;color:#192b29;font:14px/1.6 "Segoe UI",Tahoma,Arial,sans-serif;user-select:text;border-radius:0 0 11px 11px;text-align:start}
.training *{box-sizing:border-box}.training h3{font-size:20px;font-weight:650;line-height:1.3;margin:0 0 7px;text-wrap:balance}.training p{margin:7px 0;text-wrap:pretty}.training .muted{color:#556460;font-size:13px}.training .fields{display:grid;grid-template-columns:1fr;gap:12px;margin-block:18px 10px}.training .field{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:650}.training select{inline-size:100%;max-inline-size:none;margin:0;min-block-size:48px;padding:8px 10px;border:1px solid #788781;border-radius:7px;color:#192b29;background:#fffefb;font:16px "Segoe UI",Tahoma,Arial,sans-serif}.training .check{display:flex;align-items:center;gap:9px;min-block-size:48px;line-height:1.5;cursor:pointer;margin:0;font-size:14px}.training input[type=checkbox]{accent-color:#17534a;inline-size:18px;block-size:18px;flex:none;margin:0}.training .estimate-note{font-size:12px;color:#556460;margin-block:4px 14px}.training .estimate{display:grid;gap:2px;background:#edf2e9;border:1px solid #b6c6b4;border-radius:8px;padding:11px 12px;color:#244d40;font-size:12px}.training .choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-block:10px 17px;direction:ltr}.training button{font:13px/1.4 "Segoe UI",Tahoma,Arial,sans-serif;cursor:pointer;min-block-size:48px;min-inline-size:0;border:1px solid #788781;border-radius:7px;background:#fffefb;color:#192b29;padding:10px 12px}.training button:hover{background:#edf2e9}.training button:focus-visible,.training input:focus-visible,.training select:focus-visible{outline:3px solid #073a8c;outline-offset:3px}.training button:disabled{opacity:.6;cursor:not-allowed}.training .choices button{padding:9px 5px;font-size:17px;font-weight:650;display:flex;flex-direction:column;align-items:center;gap:3px}.training .choices small{font-size:11px;font-weight:400;line-height:1.4}.training .choices button[aria-pressed=true]{border:2px solid #17534a;background:#e3ece0;color:#17534a;padding:8px 4px}.training .practice-note{font-size:12px;color:#556460;margin:0 0 14px}.training .actions{display:flex;gap:8px;flex-wrap:wrap}.training .primary{font-size:16px;background:#17534a;color:#fffefb;border-color:#17534a;font-weight:650;flex:1;min-inline-size:160px}.training .primary:hover{background:#103f37}.training .account{font-size:14px;flex:1}.training .ai-preferences{font-size:12px;color:#556460;margin-block:10px}.training .message{font-size:13px;color:#465a51;margin-block-start:12px}.training .message[data-error]{border-inline-start:3px solid #9b392d;padding-inline-start:10px;color:#822b20}.training .privacy{font-size:12px;color:#556460;margin-block:12px 0}.training .output{font-size:13px;overflow-wrap:anywhere}.training .output:not(:empty){border-block-start:1px solid #d3d9d0;margin-block-start:18px;padding-block-start:6px}.training .output h4{font-size:15px;margin:14px 0 5px;font-weight:650}.training .output p{margin:4px 0}.training .output .candidate-heading{direction:ltr;unicode-bidi:isolate;text-align:start;color:#17534a;font-size:18px}.training .output .tradeoff{color:#556460}.training [hidden]{display:none}
@container training (inline-size >= 300px){.training .fields{grid-template-columns:1fr 1fr}}
.training .error-code{display:block;margin-block-start:6px;font-size:12px}.training .error-code bdi{font-family:Consolas,monospace;overflow-wrap:anywhere}
@media(max-width:760px){.training{padding:20px 18px}}`;
const TEMPLATE=`<section class="training">
  <h3 data-copy="title"></h3><p class="muted" data-copy="intro"></p>
  <div class="fields"><label class="field"><span data-copy="rating"></span><select class="rating" name="rating"><option>600</option><option>800</option><option>1000</option><option selected>1200</option><option>1400</option><option>1600</option><option>1800</option><option>2000</option><option>2400</option></select></label>
  <label class="field"><span data-copy="budget"></span><select class="budget" name="timeBudget"><option value="15" data-copy="seconds15"></option><option value="30" data-copy="seconds30"></option><option value="60" selected data-copy="minute1"></option><option value="180" data-copy="minutes3"></option><option value="600" data-copy="minutes10"></option></select></label></div>
  <label class="check"><input type="checkbox" class="weights" name="simulateWeights"><span data-copy="weights"></span></label>
  <p class="estimate-note" data-copy="estimateNote"></p><div class="estimate"></div><div class="choices"></div>
  <label class="check" data-agent-confirm="Confirms this position is local study or a built-in bot"><input type="checkbox" class="practice" name="practice"><span data-copy="practice"></span></label>
  <p class="practice-note" data-copy="practiceHelp"></p><p class="ai-preferences"></p>
  <div class="actions"><button type="button" class="primary explain" data-agent-confirm="Sends this chess position to the selected model using your ChatGPT plan" disabled></button><button type="button" class="account" data-copy="account"></button></div>
  <p class="privacy" data-copy="privacy"></p><p class="message" role="status" aria-live="polite"></p><div class="output"></div>
</section>`;
export class TrainingPanel{
  constructor(root,{onSelect=()=>{},verifyCurrent=()=>true,send=msg=>chrome.runtime.sendMessage(msg)}={}){
    const style=document.createElement('style');style.textContent=STYLE;root.append(style);
    this.el=document.createElement('div');this.el.innerHTML=TEMPLATE;
    const target=root.querySelector('.body')??root;target.insertBefore(this.el,target.querySelector('details.main'));
    this.$=selector=>this.el.querySelector(selector);this.send=send;this.onSelect=onSelect;this.verifyCurrent=verifyCurrent;
    this.generation=new Generation();this.selected=null;this.data=null;this.allowed=false;this.busy=false;
    this.preferences={uiLanguage:'en',explanationLanguage:'en',reasoningEffort:'default'};this.language='en';this.messageKey='local';
    this.translate();
    this.$('.account').onclick=()=>this.send({type:'training',action:'open-settings'});
    for(const selector of ['.rating','.budget','.weights','.practice'])this.$(selector).onchange=()=>{this.invalidate();this.refresh();};
    this.$('.explain').onclick=()=>this.explain();
    readPreferences().then(preferences=>this.applyPreferences(preferences)).catch(()=>{});
    this.stopPreferences=watchPreferences(preferences=>this.applyPreferences(preferences));
  }
  text(key){return COPY[this.language][key]??COPY.en[key]??key;}
  applyPreferences(preferences){
    if(JSON.stringify(this.preferences)===JSON.stringify(preferences))return;
    this.preferences=preferences;this.language=preferences.uiLanguage;this.invalidate();this.translate();this.refresh();
  }
  translate(){
    this.$('.training').lang=this.language;this.$('.training').dir=this.language==='ar'?'rtl':'ltr';
    for(const el of this.el.querySelectorAll('[data-copy]'))el.textContent=this.text(el.dataset.copy);
    this.$('.choices').setAttribute('aria-label',this.text('highlight'));
    this.$('.message').textContent=this.text(this.messageKey);
    this.$('.ai-preferences').textContent=`${this.text('aiLanguage')}: ${this.text(this.preferences.explanationLanguage)} · ${this.text('thinkingMode')}: ${this.text(this.preferences.reasoningEffort)}`;
  }
  settings(){return{rating:+this.$('.rating').value,timeBudgetSeconds:+this.$('.budget').value,simulateWeights:this.$('.weights').checked,language:this.preferences.explanationLanguage,reasoningEffort:this.preferences.reasoningEffort};}
  message(key,error=false){this.messageKey=key;this.$('.message').textContent=this.text(key);this.$('.message').toggleAttribute('data-error',error);}
  showError(value){
    const error=explanationError(value,this.language),message=this.$('.message');
    this.messageKey='failure';message.setAttribute('data-error','');
    const text=document.createElement('span');text.textContent=`${error.message} ${this.text('stillLocal')}`;
    const detail=document.createElement('span');detail.className='error-code';
    const code=document.createElement('bdi');code.dir='ltr';code.lang='en';code.textContent=error.code;
    detail.append(this.language==='ar'?'رمز التشخيص: ':'Diagnostic code: ',code);
    message.replaceChildren(text,detail);
  }
  invalidate(){
    this.generation.invalidate();this.busy=false;this.$('.output').replaceChildren();this.message('changed');
    try{this.send({type:'training',action:'cancel-explanation'}).catch(()=>{});}catch{}
  }
  update(position,sorted,allowed){
    const key=position?.fen??'';const changed=key!==this.generation.key||allowed!==this.allowed;
    if(changed){this.invalidate();this.generation.update(key);this.selected=null;}
    this.allowed=allowed;this.data=null;
    if(position&&sorted.length){try{this.data=validateTraining({fen:position.fen,sideToMove:position.turn,candidates:sorted.slice(0,3).map(l=>({move:l.moves[0].uci,score:{type:l.info.mate!==undefined?'mate':'cp',value:l.info.mate??l.info.cp,perspective:'white'},depth:l.info.depth,pv:l.moves.slice(0,6).map(m=>m.uci)})),settings:this.settings()});}catch{}}
    this.refresh();
  }
  refresh(){
    const button=this.$('.explain');button.disabled=!this.data||!this.allowed||!this.$('.practice').checked||this.busy;button.textContent=this.text(this.busy?'explaining':'explain');
    if(!this.data){this.choicesKey=null;this.$('.estimate').textContent=this.text('waiting');this.$('.choices').replaceChildren();return;}
    this.data.settings=this.settings();const estimate=estimateTraining(this.data);
    this.$('.estimate').replaceChildren(...[`${this.text('complexity')}: ${this.text(estimate.level)}.`,`${this.text('thinking')}: ${estimate.minSeconds}–${estimate.maxSeconds} ${this.text('seconds')}.`].map(text=>{const span=document.createElement('span');span.textContent=text;return span;}));
    const keys=this.data.candidates.map(c=>c.move);if(!keys.includes(this.selected))this.selected=keys[0];
    const choicesKey=JSON.stringify([keys,this.selected,estimate.weights,this.language]);
    if(choicesKey!==this.choicesKey){
      const focused=(this.el.getRootNode().activeElement??document.activeElement)?.dataset?.candidateMove;
      this.choicesKey=choicesKey;this.$('.choices').replaceChildren(...this.data.candidates.map((c,i)=>{
      const chess=new Chess(this.data.fen);const move=chess.move({from:c.move.slice(0,2),to:c.move.slice(2,4),promotion:c.move[4]});
      const button=document.createElement('button');button.type='button';button.textContent=move.san;button.dataset.candidateMove=c.move;button.setAttribute('aria-pressed',String(c.move===this.selected));
      if(estimate.weights){const weight=document.createElement('small');weight.textContent=`${estimate.weights[i].percent}% ${this.text('simulated')}`;button.append(weight);}
      button.onclick=()=>{this.selected=c.move;this.refresh();this.onSelect(c.move);};return button;
      }));
      if(focused)this.$(`.choices button[data-candidate-move="${focused}"]`)?.focus({preventScroll:true});
    }
  }
  async explain(){
    if(this.$('.explain').disabled)return;
    const snapshot=structuredClone(this.data),generation=this.generation.id;
    this.busy=true;this.$('.output').replaceChildren();this.refresh();this.message('requesting');
    try{
      const response=await this.send({type:'training',action:'explain',data:snapshot,confirmed:this.$('.practice').checked});
      if(!this.verifyCurrent()){this.invalidate();this.refresh();return;}if(!this.generation.current(generation))return;
      if(!response?.ok)throw response??new Error('invalid_response');
      let out;
      try{out=validateExplanation(response.explanation,snapshot);}catch{throw new Error('malformed_explanation');}
      const node=this.$('.output');node.replaceChildren();
      node.lang=snapshot.settings.language;node.dir=snapshot.settings.language==='ar'?'rtl':'ltr';
      const outputText=key=>COPY[snapshot.settings.language][key];
      const append=(tag,text,className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;node.append(e);};
      const san=uci=>{const c=new Chess(snapshot.fen);return c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]}).san;};
      append('h4',`${outputText('aiComplexity')}: ${outputText(out.complexity.level)}`);append('p',out.complexity.reason);
      if(out.threats.length){append('h4',outputText('threats'));for(const threat of out.threats){const c=new Chess(snapshot.fen);c.move({from:threat.candidateMove.slice(0,2),to:threat.candidateMove.slice(2,4),promotion:threat.candidateMove[4]});const reply=c.move({from:threat.replyMove.slice(0,2),to:threat.replyMove.slice(2,4),promotion:threat.replyMove[4]}).san;append('p',`${san(threat.candidateMove)} → ${reply}: ${threat.description}`);}}
      for(const candidate of out.candidates){append('h4',san(candidate.move),'candidate-heading');append('p',candidate.idea);append('p',`${outputText('tradeoff')}: ${candidate.tradeoff}`,'tradeoff');}
      this.message('complete');
    }catch(error){
      if(this.generation.current(generation)){
        this.showError(error);
      }
    }finally{if(this.generation.current(generation)){this.busy=false;this.refresh();}}
  }
}
