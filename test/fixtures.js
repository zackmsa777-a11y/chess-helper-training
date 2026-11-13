export const FEN='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const fixture=()=>({fen:FEN,sideToMove:'w',settings:{rating:1200,timeBudgetSeconds:60,simulateWeights:true,language:'en',reasoningEffort:'default'},candidates:[
  {move:'e2e4',score:{type:'cp',value:30,perspective:'white'},depth:12,pv:['e2e4','e7e5','g1f3']},
  {move:'d2d4',score:{type:'cp',value:20,perspective:'white'},depth:12,pv:['d2d4','d7d5','c2c4']},
  {move:'g1f3',score:{type:'cp',value:10,perspective:'white'},depth:12,pv:['g1f3','d7d5']},
]});
export const explanation=()=>({complexity:{level:'medium',reason:'Several reasonable plans need comparison.'},threats:[{candidateMove:'e2e4',replyMove:'e7e5',description:'The opponent can contest the center immediately.'}],candidates:[
  {move:'e2e4',idea:'Claim central space and open lines.',tradeoff:'The central pawn needs support.'},
  {move:'d2d4',idea:'Build a stable center.',tradeoff:'Development may require more preparation.'},
  {move:'g1f3',idea:'Develop a piece and keep plans flexible.',tradeoff:'The opponent has time to occupy the center.'},
]});
