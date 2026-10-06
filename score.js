// 判定ロジック。index.html（ブラウザ）と test/（Node）の両方から読み込む
(function(root){
  // 回答の番号（0始まり）。Q5=4 のように、質問番号から1引いた値
  const Q_DIVIDEND=4;   // Q5 配当・優待
  const Q_RULE=7;       // Q8 決まったルールやパターン
  const Q_TREND=8;      // Q9 これから伸びそうな業界
  const Q_LOSSCUT=17;   // Q18 損をしても、すぐ切り替えられる（A）
  const Q_US=20;        // Q21 アメリカ株（タイプ判定には使わない）
  const Q_IPO=21;       // Q22 IPO（タイプ判定には使わない）
  const CLOSE=60;       // 「僅差」の目安：多い方の割合がこの値以下

  // 質問の重み（2026-10 オーナーと合意）。元に戻すときは Q_WEIGHT={}、AXIS_WEIGHT=[1,1,1,1] にする
  const Q_WEIGHT={19:2};          // Q20（必修講義でどちらが面白そうだったか）は本人の実感なので2倍
  const AXIS_WEIGHT=[1,1.5,1,1];  // 判断材料の軸（何を見て判断するか）はテクニカル／ファンダの定義そのものなので1.5倍
  const weightOf=(i,ax)=>(Q_WEIGHT[i]??1)*AXIS_WEIGHT[ax];

  // ans: 各問の回答（-2,-1,1,2）、axisOf: 各問の軸番号（Q[i][0]）。軸が null の問はタイプ判定に使わない
  // 返り値の axis は軸ごとの重み付き合計、axisMax はその軸で取りうる最大値（結果画面のバーに使う）
  function score(ans, axisOf){
    const axis=[0,0,0,0], axisMax=[0,0,0,0];
    ans.forEach((v,i)=>{const ax=axisOf[i]; if(ax==null)return; const w=weightOf(i,ax); axis[ax]+=v*w; axisMax[ax]+=2*w});
    const total=axis.reduce((s,x)=>s+x,0);
    let key;
    if(total<0)key="tech"; else if(total>0)key="fund";
    else{ // 同点のときは 判断材料 → 投資期間 → 性格 → 時間の使い方 の順で決める。すべて0ならfund
      const t=axis[1]||axis[0]||axis[3]||axis[2];
      key=t<0?"tech":"fund";
    }
    const max=axisMax.reduce((s,x)=>s+x,0);
    let pb=Math.round(((total+max)/(2*max))*100);
    if(pb===50)pb=key==="fund"?51:49;
    return {key,axis,axisMax,pa:100-pb,pb};
  }

  // 結果画面に出す講義。一番上（main）は講義一覧、その次に実践コース2つまで＋興味に合わせた講義（アメリカ株・IPO）
  // 実践コースはいきなりは難しいので、講義一覧で基礎を学んでから進む順にする（2026-10 オーナーの希望）
  // 返り値: [{id, tag, main}]。講義名・URLは index.html の COURSES にある
  function pickCourses(r, ans){
    const close=Math.max(r.pa,r.pb)<=CLOSE;
    let main, subs=[], fill;
    if(r.key==="tech"){
      main={id:"endo",tag:"まずはここから"};
      if(close||r.axis[1]>=0)subs.push({id:"apollo",tag:"企業の中身も気になるなら"});
      if(ans[Q_RULE]===-2)subs.push({id:"kenmo",tag:"ルールとデータで判断したいなら"});
      fill=[];
    }else{
      if(ans[Q_DIVIDEND]===2)main={id:"ricky",tag:"配当・優待への関心が強いあなたに"};
      else if(ans[Q_TREND]===2)main={id:"takezou",tag:"これから伸びる業界に注目するあなたに"};
      else if(close)main={id:"ichikawa",tag:"チャートも気になるあなたに"};
      else main={id:"hemu",tag:"まずはここから"};
      if(ans[Q_TREND]===2)subs.push({id:"takezou",tag:"伸びる業界・テーマを探したいなら"});
      if(ans[Q_DIVIDEND]>=1)subs.push({id:"ricky",tag:"配当・優待を狙うなら"});
      if(close)subs.push({id:"ichikawa",tag:"チャートも組み合わせたいなら"});
      if(r.axis[0]>=0.6*r.axisMax[0])subs.push({id:"hemu",tag:"割安な株をじっくり持ちたいなら"});
      fill=[{id:"ichikawa",tag:"チャートも組み合わせたいなら"},{id:"hemu",tag:"割安な株をじっくり持ちたいなら"}];
    }
    const list=r.key==="tech"?{id:"lectures",tag:"まずはここから"}:{id:"lecturesFund",tag:"まずはここから"};
    if(main.tag==="まずはここから")main={...main,tag:"講義一覧のあとに"};
    const used=new Set([list.id,main.id]), out=[{...list,main:true},{...main,main:false}];
    for(const c of [...subs,...fill]){
      if(out.length>=3)break;
      if(used.has(c.id))continue;
      used.add(c.id); out.push({...c,main:false});
    }
    if(ans[Q_US]===2)out.push({id:"rironkabuo",tag:"アメリカ株で成果を出したいなら",main:false});
    if(ans[Q_IPO]===2)out.push({id:"tenbagger",tag:"IPOで成果を出したいなら",main:false});
    return out;
  }

  // 結果画面に出すライブ講義（最大3本）。返り値: [{id, tag}]。名前・リンクは index.html の LIVES にある
  // 2026-10 オーナーと合意した対象9シリーズ＋市川校長のオンライン授業から選ぶ
  function pickLives(r, ans){
    const close=Math.max(r.pa,r.pb)<=CLOSE;
    const c=[];
    if(r.key==="tech"){
      c.push({id:"endoLive",tag:"テクニカルをライブで深める"});
      if(close||r.axis[1]>=0)c.push({id:"apolloLive",tag:"チャートと相場観を両方みがく"});
      if(ans[Q_LOSSCUT]===-2)c.push({id:"amemiya",tag:"売買のタイミングと損切りを学ぶ"});
      if(close)c.push({id:"ichikawaOnline",tag:"両方の考え方を基礎から"});
      c.push({id:"kojiro",tag:"チャート分析の本質を学ぶ"},{id:"uenoTech",tag:"第30回以降がテクニカル編"},{id:"hideya",tag:"大きく動いた相場を読み解く"});
    }else{
      if(ans[Q_TREND]===2)c.push({id:"takezouLive",tag:"注目セクターをライブで"});
      if(close)c.push({id:"ichikawaOnline",tag:"両方の考え方を基礎から"});
      c.push({id:"fujimoto",tag:"社長への取材から銘柄を学ぶ"},{id:"sakamoto",tag:"注目テーマと銘柄の探し方"},{id:"uenoFund",tag:"第1〜29回がファンダメンタルズ編"});
    }
    const used=new Set(), out=[];
    for(const x of c){ if(out.length>=3)break; if(used.has(x.id))continue; used.add(x.id); out.push(x); }
    return out;
  }

  // 軸ごとの寄り具合（結果画面の解説に使う）。v: 軸の合計、max: その軸の最大値
  // 最大値の2割未満は「どちらとも」（mid）、6割以上は「はっきり」（strong）
  function axisLean(v, max){
    const x=max?v/max:0;
    if(Math.abs(x)<0.2)return {side:"mid",strong:false};
    return {side:x<0?"a":"b",strong:Math.abs(x)>=0.6};
  }

  // 匿名の集計に送る1件分。名前・会員ID・メール・端末の情報などは入れない
  // v: アプリの版（重みや質問を変えた時期を見分ける）、ans: 22問の回答（-2,-1,1,2）
  function buildRecord(r, ans, v){
    return {v:String(v), type:r.key, pa:r.pa, pb:r.pb, ans:ans.slice()};
  }

  // 集計に送ってよい場所か。公開ページ（GitHub Pages）だけ送り、手元での確認（localhost・ファイル）では送らない
  function collectAllowed(loc){
    return loc.protocol==="https:" && /\.github\.io$/.test(loc.hostname);
  }

  const api={score,pickCourses,pickLives,axisLean,buildRecord,collectAllowed};
  if(typeof module==="object"&&module.exports)module.exports=api; else root.GFSScore=api;
})(typeof globalThis!=="undefined"?globalThis:this);
