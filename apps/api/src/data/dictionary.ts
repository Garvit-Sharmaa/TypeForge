/**
 * dictionary.ts — Curated master word corpus for the lesson engine.
 *
 * Words are selected to provide good coverage across all 10 lesson stages:
 *   Lessons 1-2:  home-row words (a,s,d,f,g,h,j,k,l)
 *   Lessons 3-4:  + e, i, r, u
 *   Lessons 5-6:  + t, y, w, o, q, p
 *   Lessons 7-8:  + v, b, n, m, c, x, comma, period
 *   Lessons 9-10: + z, slash + full vocabulary
 *
 * The WordFilteringEngine selects the valid subset for each lesson config,
 * so this list can grow freely without changing lesson logic.
 */
export const MASTER_DICTIONARY: readonly string[] = [
  // ── Home-row stageable words (lessons 1-2: a s d f g h j k l) ──────────────
  'a','add','ads','all','ask','had','has','jag','sad','gal','gas','ash','lad',
  'lag','dash','fall','flag','glad','half','hall','hash','jade','jags','lass',
  'slab','slag','slad','fads','flask','flash','glass','slash','alga','calls',
  'falls','flags','halls','lads','salad','shall','djinn',

  // ── + e, i (lesson 3) ───────────────────────────────────────────────────────
  'aide','aids','aisle','ale','alef','alike','dais','dale','dead','deal','deaf',
  'desk','dial','die','dies','dig','dike','dike','dill','ease','edge','eel',
  'egg','eggs','eight','else','idea','idle','feel','feed','file','fill','five',
  'flee','fled','flies','gale','gale','gild','girl','give','glad','glide','hail',
  'hale','half','heal','heel','held','hike','hill','his','hide','idea','jade',
  'jail','like','lied','life','like','lake','leaf','lead','leak','left','legs',
  'held','idea','idle','shed','shelf','shielded','side','silk','sigh','sill',
  'skill','slide','slid','sign','signal','single','fake','fake','field','fills',

  // ── + r, u (lesson 4) ───────────────────────────────────────────────────────
  'aid','air','are','aura','cure','dare','dear','duel','dug','dusk','duster',
  'ear','earl','earn','era','fare','fear','fir','fire','fired','flair','fluid',
  'four','fur','glad','grade','grail','grid','grill','grille','guide','guild',
  'gulf','guru','hair','hard','hare','herd','here','hero','hire','hurl','idea',
  'lair','lure','lured','rage','raid','rail','raised','real','rear','red','reed',
  'reed','reel','refer','ride','rider','rig','rile','rind','ring','rise','risk',
  'rule','ruse','rush','saga','said','same','sire','sir','skid','skill','skull',
  'slide','slur','sure','surge','use','used','user','vague','valid','valuer',
  'dear','disk','dark','druid','dusk','drug','duel','dude','ruse','sure',

  // ── + t, y, w, o (lesson 5) ─────────────────────────────────────────────────
  'after','ago','also','auto','away','awe','awed','days','do','dog','door',
  'dot','down','draw','drew','droll','drow','dwelt','ego','eight','either',
  'enjoy','every','fall','follow','folk','food','fool','for','fore','forest',
  'forget','fort','forward','fought','found','four','from','front','frost',
  'goal','goes','good','got','grow','growth','guard','guest','got','goal',
  'glow','glow','how','hold','hole','host','hour','idle','into','jewel',
  'joy','just','key','kind','know','large','late','law','lead','learn',
  'left','let','light','like','line','link','list','live','load','long',
  'look','lord','lost','love','low','made','make','many','mark','may',
  'mode','most','move','next','note','now','often','oil','old','only',
  'onto','open','order','other','ought','our','out','owe','own','road',
  'role','root','rose','row','rout','royal','said','sat','saw','seed',
  'seem','self','short','show','slow','small','soft','told','took','tool',
  'took','town','true','trust','try','two','use','wait','walk','want',
  'ward','warm','was','wave','way','we','well','went','were','west',
  'where','which','why','wild','will','win','with','wood','word','wore',
  'work','world','worth','would','write','yard','year','yet','you','your',

  // ── + q, p (lesson 6) ───────────────────────────────────────────────────────
  'apex','cope','cup','depth','drop','dip','drip','drop','epic','flap',
  'flip','flop','gap','gasp','grip','help','hope','hoop','hop','hyper',
  'kelp','keep','kept','lap','laps','limp','loop','map','maps','nap',
  'opaque','open','pack','paid','pair','pale','palm','pan','papa','park',
  'part','path','pay','peace','peak','pear','peel','pick','pile','pine',
  'pipe','pit','place','plaid','plan','play','plop','plot','plow','ploy',
  'plus','pod','poem','pop','power','proud','pull','pump','pup','pupil',
  'push','quail','quick','quiet','quip','quit','quite','quiz','ramp','rap',
  'rasp','reap','rep','rope','rip','spa','soup','step','stop','swap',
  'tap','tape','tip','top','trap','trip','type','upon','warp','whip',

  // ── + v, b, n, m (lesson 7) ─────────────────────────────────────────────────
  'and','any','arm','ban','bank','barn','beam','been','bell','belt',
  'bend','bind','bird','bit','blade','blame','bland','blank','bled',
  'blend','blink','blue','board','boat','body','bomb','bond','bone',
  'book','boom','born','brag','brain','brand','brave','bring','built',
  'burn','back','bad','bag','ball','band','have','him','his','home',
  'know','man','main','mark','me','meet','men','mind','mine','mint',
  'much','must','name','new','night','nine','nor','number','mob',
  'nail','nod','novel','navy','nerve','never','noon','norm','null',
  'numb','oval','over','vain','vale','van','veer','vein','verb','vine',
  'void','vow','make','man','mend','mine','mint','moan','mob','mode',
  'moon','more','most','move','mug','mix','mob','ban','blue','bind',

  // ── + c, x, comma, period (lesson 8) ────────────────────────────────────────
  'ace','arc','buck','call','calm','can','cap','car','card','care',
  'cash','cast','catch','chain','check','choose','claim','clam','clan',
  'claw','click','climb','clip','close','clue','coat','cod','code',
  'coil','coin','cold','come','cook','cool','cope','core','cost','couch',
  'count','cover','crack','craft','crane','crew','crop','cross','crowd',
  'crown','crux','cube','curl','cut','each','exact','exam','excel',
  'except','excite','exist','exit','expect','extra','face','fact','fax',
  'hex','ache','lace','lack','lick','lock','luck','lux','max','mice',
  'mock','neck','oak','ox','pace','pack','pick','pluck','race','rack',
  'rice','rich','rock','sacrifice','scan','scene','sick','six','sock',
  'stock','stuck','such','sync','tack','tack','thick','tick','track',
  'truck','wax','wick','mix','next','text','taxi','toxic','vex','wax',

  // ── + z, slash (lesson 9) ────────────────────────────────────────────────────
  'azure','buzz','cozy','craze','daze','dazzle','dizzy','doze','drizzle',
  'fizz','frenzy','froze','fuzz','gaze','gauze','graze','grizzle',
  'haze','hazard','jazz','laze','lazy','maze','maize','nozzle','ooze',
  'pizza','puzzle','quartz','raze','razed','rezone','sizzle','size',
  'sneeze','snooze','squeeze','topaz','zone','zero','zenith','zeal','zinc',
  'zip','zap','zen','zig','zag','zest','zoom','zoned',

  // ── Mastery / high-frequency filler (lesson 10) ──────────────────────────────
  'ability','accept','achieve','across','action','active','actual','against',
  'ahead','already','although','amount','another','apply','approach','arrive',
  'assume','attack','attempt','attend','avoid','aware','basic','battle',
  'become','before','better','beyond','break','breath','brief','bring',
  'build','cannot','center','change','charge','choice','clear','common',
  'complete','concern','context','control','create','culture','describe',
  'design','detail','develop','direct','during','effect','effort','enable',
  'enough','entire','expect','explain','express','factor','familiar','feature',
  'figure','format','forward','found','general','happen','improve','include',
  'increase','initial','instead','involve','issue','journey','knowledge',
  'language','launch','likely','listen','manage','matter','measure','message',
  'method','might','modern','natural','nothing','notice','object','obtain',
  'provide','public','purpose','question','rather','reason','recent','reduce',
  'remain','remove','repeat','replace','return','review','search','second',
  'signal','simple','single','situation','social','special','start','status',
  'still','structure','study','subject','support','system','target','toward',
  'travel','under','understand','update','value','various','version','within',
];
