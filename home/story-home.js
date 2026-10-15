/* 养成-38：故事卡带来的 8 种家里变化（只是氛围，不加收益、不写存档）。纯函数，app.js 只负责画和说。
   文案：王大妈 养成+CEO 文案（养成-29 补充 p1791781525.996099）。 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HomeStory=factory();})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 const STYLE_LIVE=false;   // 家宅-31「深夜小馆」风格未上线前不出风格变体
 const BAMBOO=Object.freeze(['furn_pearl_tea_mat','furn_pearl_tea_stool','furn_pearl_fan_shade_lamp']);
 const L=Object.freeze({
  k1:['炭先点上，客人才找得到路。','早上的第一把炭，最香。'], k1style:'这屋的炭，比摊上还旺。',
  k2:['微辣，我懂，我真懂。','凉茶先放稳，辣的事等会儿再说。'],
  k3:'质检老师又来巡店了。', k3bamboo:'那把竹椅不能吃，真的。',
  k4sit:{c77:'最后几串，留给月亮。',pearl:'今天的账对上了，月亮也圆了。',otaku:'这一格留白，给月亮。',rocket:'月亮这么近，火星也不远。'},
  k4stand:{c77:'站着看月亮，也算收摊。',pearl:'站一会儿，账已经对完了。',otaku:'站着看，也是一格好画面。',rocket:'站立观测，月亮信号良好。'},
  k5:['多一颗，也得还回去。','九十八、九十九……刚刚好。'], k5hand:'没桌子，就在手心里数。',
  k6:['这一格，名场面。','再看一遍，就一遍。'], k6sit:'坐着看也行，名场面不挑地方。',
  k7:['三、二、一——','……今天先放气球。'],
  k8:{c77:'对面也亮了，今晚这条街热闹。',pearl:'四盏灯，一盏都不能少。',otaku:'整条街像一页彩稿。',rocket:'四个节点，全部在线。'}
 });
 const SIT=['sit','rug','lie'];
 const own=(c,id)=>{const o=c&&c.owned;return !!o&&(typeof o.has==='function'?o.has(id):o.includes(id));};
 // ctx: {owned, who, kind(null=走动/站), period, placed:[fid], hasSeat, hasTable, style}
 function linesFor(c){
  const out=[],who=c.who,k=c.kind||null,per=c.period;
  if(own(c,'k_1')&&who==='c77'&&per==='morning')out.push(...(STYLE_LIVE&&c.style==='night_bistro'?[L.k1style]:L.k1));
  if(own(c,'k_2')&&who==='c77'&&k==='sit')out.push(...L.k2);
  if(own(c,'k_3')&&who==='c77'&&!k){out.push(L.k3);if((c.placed||[]).some(f=>BAMBOO.includes(f)))out.push(L.k3bamboo);}
  if(own(c,'k_4')&&per==='night'&&L.k4sit[who]){if(SIT.includes(k))out.push(L.k4sit[who]);else if(!k&&!c.hasSeat)out.push(L.k4stand[who]);}
  if(own(c,'k_5')&&who==='pearl'){if(k==='eat')out.push(...L.k5);else if(!k&&!c.hasTable)out.push(L.k5hand);}
  if(own(c,'k_6')&&who==='otaku'){if(k==='lie')out.push(...L.k6);else if(k==='sit'||k==='rug')out.push(L.k6sit);}
  if(own(c,'k_8')&&per==='dusk'&&L.k8[who])out.push(L.k8[who]);
  return out;
 }
 // 一半机会说故事句；同一张卡的两句由 HomeAutonomy.chooseLine 轮流（10 分钟不重复）
 function pick(base,story,rng){return story&&story.length&&(rng||Math.random)()<.5?story:base;}
 function scene(c){
  return {panda:own(c,'k_3')&&c.who==='c77', moon:own(c,'k_4')&&c.period==='night', street:own(c,'k_8')&&c.period==='dusk',
   tea:own(c,'k_2')&&c.who==='c77'&&c.kind==='sit'&&!!c.posed};
 }
 // 发射倒计时：火箭老板已加入、拥有卡、本页第一次进他的家
 function countdownDue(c){return own(c,'k_7')&&c.who==='rocket'&&!!c.joined&&!c.done;}
 return Object.freeze({LINES:L,BAMBOO,STYLE_LIVE,linesFor,pick,scene,countdownDue});
});
