// 判定ロジックの単体テスト。実行: node --test
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {score,pickCourses}=require("../score.js");

// 今の質問の並び（4軸 × 5問）
const AXIS_OF=[0,0,0,0,0, 1,1,1,1,1, 2,2,2,2,2, 3,3,3,3,3];
const fill=v=>new Array(20).fill(v);
// 軸ごとの回答を指定して20問分の回答を作る（各軸の5問に同じ値を入れる）
const byAxis=vals=>AXIS_OF.map(a=>vals[a]);

// index.html の質問（[軸, "A", "B"]）を読む。軸が null の問はタイプ判定に使わない
const HTML=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const Q_ROWS=(()=>{const b=HTML.slice(HTML.indexOf("const Q=["),HTML.indexOf("];",HTML.indexOf("const Q=[")));
  return [...b.matchAll(/^\s*\[(\d|null),"([^"]*)","([^"]*)"\]/gm)].map(r=>({ax:r[1]==="null"?null:Number(r[1]),a:r[2],b:r[3]}))})();

test("index.html の質問：タイプ判定用20問（4軸×5問）＋興味の2問", ()=>{
  assert.equal(Q_ROWS.length,22);
  assert.deepEqual(Q_ROWS.slice(0,20).map(r=>r.ax),AXIS_OF);
  assert.deepEqual(Q_ROWS.slice(20).map(r=>r.ax),[null,null]);
  // score.js が番号で参照している質問が、想定どおりの内容か
  assert.match(Q_ROWS[4].b,/配当|優待/);        // Q5
  assert.match(Q_ROWS[7].a,/ルール|パターン/);  // Q8
  assert.match(Q_ROWS[8].b,/伸びそうな業界/);   // Q9
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
  assert.deepEqual(r.axis,[-10,-10,-10,-10]);
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

test("合計がわずかにマイナス → テクニカル、わずかにプラス → ファンダ", ()=>{
  const a=fill(1); a[0]=-2; a[1]=-2; a[2]=-2; a[3]=-2; a[4]=-2; a[5]=-2; a[6]=-2; // 7×-2 + 13×1 = -1
  assert.equal(score(a,AXIS_OF).key,"tech");
  const b=a.map(v=>-v);
  assert.equal(score(b,AXIS_OF).key,"fund");
});

test("交互（A→B→A→B…）は同点。各軸の偏りで決まる", ()=>{
  // -2,2,-2,2,... 各軸5問なので軸ごとに -2 か +2 が残る
  const alt=AXIS_OF.map((_,i)=>i%2===0?-2:2);
  const r=score(alt,AXIS_OF);
  assert.equal(r.axis.reduce((s,x)=>s+x,0),0);
  assert.deepEqual(r.axis,[-2,2,-2,2]);
  assert.equal(r.key,"fund"); // 判断材料(軸1)が +2
  assert.deepEqual([r.pa,r.pb],[49,51]);
});

test("同点のときの優先順：判断材料 → 投資期間 → 性格", ()=>{
  // 判断材料がマイナスなら、他がどうであれテクニカル
  assert.equal(score(byAxis([1,-1,1,-1]),AXIS_OF).key,"tech");
  // 判断材料が0なら投資期間
  assert.equal(score(byAxis([-1,0,1,0]),AXIS_OF).key,"tech");
  assert.equal(score(byAxis([1,0,-1,0]),AXIS_OF).key,"fund");
  // 判断材料・投資期間が0なら性格
  assert.equal(score(byAxis([0,0,1,-1]),AXIS_OF).key,"tech");
  assert.equal(score(byAxis([0,0,-1,1]),AXIS_OF).key,"fund");
});

test("すべての軸が0なら fund、表示は 49/51", ()=>{
  // 実際に選べる回答（-2,-1,1,2）だけで、各軸の合計を0にする
  // ※合計0で 判断材料・投資期間・性格 が0なら、時間の使い方も必ず0になる
  const r=score(AXIS_OF.map((_,i)=>[2,-1,-1,2,-2][i%5]),AXIS_OF);
  assert.deepEqual(r.axis,[0,0,0,0]);
  assert.equal(r.key,"fund");
  assert.deepEqual([r.pa,r.pb],[49,51]);
});

test("割合は50%ちょうどにならず、合計は常に100", ()=>{
  // 各問 -2,-1,1,2 のランダム回答で確認
  let seed=1; const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
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
  let seed=3; const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
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
