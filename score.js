// 判定ロジック。index.html（ブラウザ）と test/（Node）の両方から読み込む
(function(root){
  // ans: 各問の回答（-2,-1,1,2）、axisOf: 各問の軸番号（Q[i][0]）
  function score(ans, axisOf){
    const axis=[0,0,0,0];
    ans.forEach((v,i)=>{axis[axisOf[i]]+=v});
    const total=axis.reduce((s,x)=>s+x,0);
    let key;
    if(total<0)key="tech"; else if(total>0)key="fund";
    else{ // 同点のときは 判断材料 → 投資期間 → 性格 → 時間の使い方 の順で決める。すべて0ならfund
      const t=axis[1]||axis[0]||axis[3]||axis[2];
      key=t<0?"tech":"fund";
    }
    const max=2*ans.length;
    let pb=Math.round(((total+max)/(2*max))*100);
    if(pb===50)pb=key==="fund"?51:49;
    return {key,axis,pa:100-pb,pb};
  }

  // 講義案内の並び。ファンダ派で Q5（配当・優待）に「Bにとても近い」なら、リッキー講師を一番上にする
  function orderCourses(key, ans, courses){
    if(key==="fund" && ans[4]===2){
      return [{...courses[1],cls:"fund main",tag:"配当・優待への関心が強いあなたに"},{...courses[0],cls:"fund",tag:"あわせて"}];
    }
    return courses.slice();
  }

  const api={score,orderCourses};
  if(typeof module==="object"&&module.exports)module.exports=api; else root.GFSScore=api;
})(typeof globalThis!=="undefined"?globalThis:this);
