// 判定ロジック。index.html（ブラウザ）と test/（Node）の両方から読み込む
(function(root){
  // 回答の番号（0始まり）。Q5=4 のように、質問番号から1引いた値
  const Q_DIVIDEND=4;   // Q5 配当・優待
  const Q_RULE=7;       // Q8 決まったルールやパターン
  const Q_TREND=8;      // Q9 これから伸びそうな業界
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

  // 結果画面に出す講義。一番上1つ（main）＋あわせて2つ＋興味に合わせた講義（アメリカ株・IPO）
  // 返り値: [{id, tag, main}]。講義名・URLは index.html の COURSES にある
  function pickCourses(r, ans){
    const close=Math.max(r.pa,r.pb)<=CLOSE;
    let main, subs=[], fill;
    if(r.key==="tech"){
      main={id:"endo",tag:"まずはここから"};
      if(close||r.axis[1]>=0)subs.push({id:"apollo",tag:"企業の中身も気になるなら"});
      if(ans[Q_RULE]===-2)subs.push({id:"kenmo",tag:"ルールとデータで判断したいなら"});
      fill=[{id:"lectures",tag:"あわせて"}];
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
    const used=new Set([main.id]), out=[{...main,main:true}];
    for(const c of [...subs,...fill]){
      if(out.length>=3)break;
      if(used.has(c.id))continue;
      used.add(c.id); out.push({...c,main:false});
    }
    if(ans[Q_US]===2)out.push({id:"rironkabuo",tag:"アメリカ株で成果を出したいなら",main:false});
    if(ans[Q_IPO]===2)out.push({id:"tenbagger",tag:"IPOで成果を出したいなら",main:false});
    return out;
  }

  const api={score,pickCourses};
  if(typeof module==="object"&&module.exports)module.exports=api; else root.GFSScore=api;
})(typeof globalThis!=="undefined"?globalThis:this);
