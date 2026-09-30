// 判定ロジックの単体テスト。実行: node --test
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {score,pickCourses}=require("../score.js");

// 今の質問の並び（タイプ判定に使う20問）。Q13（番号12）は判断材料の軸
const AXIS_OF=[0,0,0,0,0, 1,1,1,1,1, 2,2,1,2,2, 3,3,3,3,3];
const fill=v=>new Array(20).fill(v);
// 軸ごとの回答を指定して20問分の回答を作る（各軸の5問に同じ値を入れる）
const byAxis=vals=>AXIS_OF.map(a=>vals[a]);
// 再現できる乱数（mulberry32）。同じ種なら毎回同じ回答列になる
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

// index.html の質問（[軸, "A", "B"]）を読む。軸が null の問はタイプ判定に使わない
const HTML=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const Q_ROWS=(()=>{const b=HTML.slice(HTML.indexOf("const Q=["),HTML.indexOf("];",HTML.indexOf("const Q=[")));
  return [...b.matchAll(/^\s*\[(\d|null),"([^"]*)","([^"]*)"\]/gm)].map(r=>({ax:r[1]==="null"?null:Number(r[1]),a:r[2],b:r[3]}))})();

test("index.html の質問：タイプ判定用20問＋興味の2問、Q13は判断材料", ()=>{
  assert.equal(Q_ROWS.length,22);
  assert.deepEqual(Q_ROWS.slice(0,20).map(r=>r.ax),AXIS_OF);
  assert.deepEqual(Q_ROWS.slice(20).map(r=>r.ax),[null,null]);
  // score.js が番号で参照している質問が、想定どおりの内容か
  assert.match(Q_ROWS[4].b,/配当|優待/);        // Q5
  assert.match(Q_ROWS[7].a,/ルール|パターン/);  // Q8
  assert.match(Q_ROWS[8].b,/伸びそうな業界/);   // Q9
  assert.match(Q_ROWS[12].a,/決算書/);          // Q13
  assert.match(Q_ROWS[19].a,/必修講義/);        // Q20（重み2倍）
  assert.match(Q_ROWS[20].b,/アメリカ/);        // Q21
  assert.match(Q_ROWS[21].b,/上場して間もない/); // Q22
});

test("興味の2問（軸 null）はタイプ判定と割合に影響しない", ()=>{
  const axes=Q_ROWS.map(r=>r.ax);
  for(const base of [fill(-1),fill(1),AXIS_OF.map((_,i)=>i%2?2:-2)]){
    const r0=score(base,AXIS_OF);
    for(const extra of [[-2,-2],[2,2],[-2,2]]){
      assert.deepEqual(score([...base,...extra],axes),r0);
    }
  }
});

test("A寄りばかり → テクニカル、100%", ()=>{
  const r=score(fill(-2),AXIS_OF);
  assert.equal(r.key,"tech");
  assert.deepEqual([r.pa,r.pb],[100,0]);
  // 投資期間5問、判断材料6問×1.5、時間の使い方4問、性格5問（Q20は2倍）
  assert.deepEqual(r.axis,[-10,-18,-8,-12]);
  assert.deepEqual(r.axisMax,[10,18,8,12]);
});

test("B寄りばかり → ファンダメンタルズ、100%", ()=>{
  const r=score(fill(2),AXIS_OF);
  assert.equal(r.key,"fund");
  assert.deepEqual([r.pa,r.pb],[0,100]);
});

test("「やや」だけでも方向どおりに決まる", ()=>{
  assert.equal(score(fill(-1),AXIS_OF).key,"tech");
  assert.equal(score(fill(1),AXIS_OF).key,"fund");
});

test("重み：Q20は2倍、判断材料（Q13を含む）は1.5倍、ほかは1倍", ()=>{
  const r0=score(fill(1),AXIS_OF);
  const flip=i=>{const a=fill(1); a[i]=-1; return score(a,AXIS_OF)};
  assert.equal(r0.axis[3]-flip(19).axis[3],4);   // Q20：+1→-1 で 2×2
  assert.equal(r0.axis[3]-flip(15).axis[3],2);   // Q16：1倍
  assert.equal(r0.axis[1]-flip(5).axis[1],3);    // Q6：1.5倍
  assert.equal(r0.axis[1]-flip(12).axis[1],3);   // Q13：判断材料なので1.5倍
  assert.equal(r0.axis[2]-flip(10).axis[2],2);   // Q11：1倍
});

test("重み：ほかが少しファンダ寄りでも、Q20と判断材料で強くテクニカルならテクニカル", ()=>{
  // 投資期間・時間の使い方・性格（Q20以外）は「Bにやや近い」、判断材料とQ20は「Aにやや近い」
  const a=AXIS_OF.map((ax,i)=>ax===1||i===19?-1:1);
  const r=score(a,AXIS_OF);
  // 重みなしなら +13-7=+6 でファンダ。重み付きでは 5-9+4+(4-2)=+2 … まだファンダ
  assert.equal(r.key,"fund");
  // Q20を「Aにとても近い」にすると 5-9+4+(4-4)=0 → 同点、判断材料がマイナスなのでテクニカル
  a[19]=-2;
  assert.equal(score(a,AXIS_OF).key,"tech");
});

// 合計がちょうど0になる回答（どの軸で決まるかを確かめる）
const tie=a=>{const r=score(a,AXIS_OF); assert.equal(r.axis.reduce((s,x)=>s+x,0),0,"合計が0になっていない"); return r};
const AX1_ZERO={5:1,6:-1,7:1,8:-1,9:1,12:-1}; // 判断材料の6問を打ち消し合わせる
const build=(obj)=>{const a=new Array(20).fill(null); for(const k in obj)a[k]=obj[k]; assert.ok(a.every(v=>v!==null)); return a};

test("同点のときの優先順：判断材料 → 投資期間 → 性格", ()=>{
  // 判断材料がマイナス
  const t1=build({0:2,1:2,2:1,3:1,4:1, 5:-1,6:-1,7:-1,8:-1,9:-1,12:-1, 10:1,11:1,13:-1,14:-1, 15:1,16:-1,17:1,18:-1,19:1});
  assert.ok(tie(t1).axis[1]<0); assert.equal(tie(t1).key,"tech");
  assert.equal(tie(t1.map(v=>-v)).key,"fund");
  // 判断材料が0 → 投資期間
  const t2=build({0:-1,1:-1,2:-1,3:-1,4:2, ...AX1_ZERO, 10:1,11:1,13:-1,14:1, 15:1,16:-1,17:-1,18:-1,19:1});
  assert.equal(tie(t2).axis[1],0); assert.ok(tie(t2).axis[0]<0); assert.equal(tie(t2).key,"tech");
  assert.equal(tie(t2.map(v=>-v)).key,"fund");
  // 判断材料・投資期間が0 → 性格
  const t3=build({0:2,1:-1,2:-1,3:2,4:-2, ...AX1_ZERO, 10:1,11:1,13:-1,14:1, 15:-1,16:-1,17:-1,18:-1,19:1});
  assert.deepEqual(tie(t3).axis.slice(0,2),[0,0]); assert.ok(tie(t3).axis[3]<0); assert.equal(tie(t3).key,"tech");
  assert.equal(tie(t3.map(v=>-v)).key,"fund");
});

test("すべての軸が0なら fund、表示は 49/51", ()=>{
  const z=build({0:2,1:-1,2:-1,3:2,4:-2, ...AX1_ZERO, 10:1,11:-1,13:1,14:-1, 15:-1,16:-1,17:1,18:-1,19:1});
  const r=tie(z);
  assert.deepEqual(r.axis.map(Math.abs),[0,0,0,0]);
  assert.equal(r.key,"fund");
  assert.deepEqual([r.pa,r.pb],[49,51]);
});

test("割合は50%ちょうどにならず、合計は常に100", ()=>{
  // 各問 -2,-1,1,2 のランダム回答で確認
  const rnd=rng(1);
  for(let n=0;n<2000;n++){
    const a=AXIS_OF.map(()=>[-2,-1,1,2][Math.floor(rnd()*4)]);
    const r=score(a,AXIS_OF);
    assert.equal(r.pa+r.pb,100);
    assert.notEqual(r.pb,50);
    // 判定と割合の向きがずれない
    if(r.key==="fund")assert.ok(r.pb>50); else assert.ok(r.pa>50);
  }
});

// pickCourses 用：22問分の回答を作る。over で特定の問だけ上書き
const ans22=(v,over={})=>{const a=[...fill(v),-1,-1]; for(const k in over)a[k]=over[k]; return a};
const AXES22=[...AXIS_OF,null,null];
const pick=a=>pickCourses(score(a,AXES22),a);
const ids=a=>pick(a).map(c=>c.id);

test("テクニカル派：一番上は遠藤講師、あわせては埋まらなければ講義一覧", ()=>{
  const c=pick(ans22(-2));
  assert.equal(c[0].id,"endo"); assert.equal(c[0].main,true);
  assert.deepEqual(ids(ans22(-1)),["endo","lectures"]);
});

test("テクニカル派：Q8に「Aにとても近い」→ Kenmo講師", ()=>{
  assert.deepEqual(ids(ans22(-1,{7:-2})),["endo","kenmo","lectures"]);
});

test("テクニカル派：僅差（60%以下）か判断材料がファンダ寄り → アポロ講師", ()=>{
  // 判断材料の軸（Q6〜Q10）だけB寄り → 判断材料 +5、合計はマイナスのまま
  const a=ans22(-2,{5:1,6:1,7:1,8:1,9:1});
  const r=score(a,AXES22);
  assert.equal(r.key,"tech"); assert.ok(r.axis[1]>0);
  assert.deepEqual(ids(a).slice(0,2),["endo","apollo"]);
  // 僅差：テクニカル55%前後
  const b=AXIS_OF.map((_,i)=>i<11?-1:1); b.push(-1,-1);
  const rb=score(b,AXES22); assert.equal(rb.key,"tech"); assert.ok(rb.pa<=60);
  assert.ok(ids(b).includes("apollo"));
});

test("ファンダ派：はっきりファンダ → 一番上はヘム講師", ()=>{
  const c=pick(ans22(1));
  assert.equal(c[0].id,"hemu"); assert.equal(c[0].main,true);
  assert.equal(c.length,3);
});

test("ファンダ派：Q5に「Bにとても近い」→ リッキー講師が一番上（仕様5）", ()=>{
  const c=pick(ans22(2));
  assert.equal(c[0].id,"ricky");
});

test("ファンダ派：Q9に「Bにとても近い」→ たけぞう講師が一番上。配当と両方ならリッキー講師が上", ()=>{
  assert.equal(pick(ans22(1,{8:2}))[0].id,"takezou");
  const both=ids(ans22(1,{4:2,8:2}));
  assert.equal(both[0],"ricky"); assert.equal(both[1],"takezou");
});

test("ファンダ派：僅差（60%以下）→ 市川校長が一番上", ()=>{
  const a=AXIS_OF.map((_,i)=>i<11?1:-1); a.push(-1,-1);
  const r=score(a,AXES22); assert.equal(r.key,"fund"); assert.ok(r.pb<=60);
  assert.equal(pick(a)[0].id,"ichikawa");
});

test("ファンダ派：Q5に「Bにやや近い」→ あわせてにリッキー講師", ()=>{
  assert.ok(ids(ans22(1)).includes("ricky")); // ans22(1) は Q5=+1
  assert.ok(!ids(ans22(1,{4:-1})).includes("ricky"));
});

test("Q21・Q22に「Bにとても近い」→ りろんかぶお講師・テンバガー投資家X を追加（どちらのタイプでも）", ()=>{
  for(const v of [-2,1]){
    const c=ids(ans22(v,{20:2,21:2}));
    assert.deepEqual(c.slice(-2),["rironkabuo","tenbagger"]);
    assert.ok(!ids(ans22(v,{20:1,21:1})).includes("rironkabuo"));
  }
});

test("講義の並び：一番上は1つだけ、同じ講義は2回出ない、あわせては最大2つ", ()=>{
  const rnd=rng(3);
  for(let n=0;n<3000;n++){
    const a=AXES22.map(()=>[-2,-1,1,2][Math.floor(rnd()*4)]);
    const c=pick(a);
    assert.equal(c.filter(x=>x.main).length,1);
    assert.equal(c[0].main,true);
    assert.equal(new Set(c.map(x=>x.id)).size,c.length);
    const extra=c.filter(x=>x.id==="rironkabuo"||x.id==="tenbagger").length;
    assert.ok(c.length-extra>=2 && c.length-extra<=3);
    for(const x of c)assert.ok(x.tag.length>0);
  }
});

test("講義のURLは gfs.tokyo のページで、個人識別用のパラメータを含まない", ()=>{
  const urls=[...HTML.matchAll(/url:"([^"]*)"/g)].map(m=>m[1]);
  assert.equal(urls.length,10);
  for(const u of urls){
    assert.match(u,/^https:\/\/gfs\.tokyo\//);
    assert.doesNotMatch(u,/[?&#]/); // lmclid などを入れない（このリポジトリは Public）
  }
  assert.doesNotMatch(HTML,/lmclid/);
});

test("score.js が使う講義IDが、すべて index.html の COURSES にある", ()=>{
  const block=HTML.slice(HTML.indexOf("const COURSES={"),HTML.indexOf("};",HTML.indexOf("const COURSES={")));
  const defined=new Set([...block.matchAll(/^ (\w+):\s*\{/gm)].map(m=>m[1]));
  const src=fs.readFileSync(path.join(__dirname,"..","score.js"),"utf8");
  const used=new Set([...src.matchAll(/id:"(\w+)"/g)].map(m=>m[1]));
  assert.equal(defined.size,10);
  for(const id of used)assert.ok(defined.has(id),id);
});
