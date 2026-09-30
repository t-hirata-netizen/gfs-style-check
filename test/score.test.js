// 判定ロジックの単体テスト。実行: node --test
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {score,orderCourses}=require("../score.js");

// 今の質問の並び（4軸 × 5問）
const AXIS_OF=[0,0,0,0,0, 1,1,1,1,1, 2,2,2,2,2, 3,3,3,3,3];
const fill=v=>new Array(20).fill(v);
// 軸ごとの回答を指定して20問分の回答を作る（各軸の5問に同じ値を入れる）
const byAxis=vals=>AXIS_OF.map(a=>vals[a]);

test("index.html の質問は20問・4軸×5問で、Q5が配当・優待の質問", ()=>{
  const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
  const block=html.slice(html.indexOf("const Q=["),html.indexOf("];",html.indexOf("const Q=[")));
  const rows=[...block.matchAll(/^\s*\[(\d),"([^"]*)","([^"]*)"\]/gm)];
  assert.equal(rows.length,20);
  assert.deepEqual(rows.map(r=>Number(r[1])),AXIS_OF);
  assert.match(rows[4][3],/配当|優待/);
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

const COURSES=[
  {cls:"fund main",tag:"まずはここから",nm:"実践コース：市川校長",url:"",ds:"x"},
  {cls:"fund",tag:"配当・優待を狙うなら",nm:"リッキー講師",url:"",ds:"y"}
];

test("ファンダ派でQ5に「Bにとても近い」→ リッキー講師が一番上", ()=>{
  const a=fill(1); a[4]=2;
  const c=orderCourses("fund",a,COURSES);
  assert.equal(c[0].nm,"リッキー講師");
  assert.equal(c[0].cls,"fund main");
  assert.equal(c[1].nm,"実践コース：市川校長");
  assert.equal(c[1].cls,"fund");
});

test("Q5が「やや」なら並びは変えない", ()=>{
  const a=fill(1); a[4]=1;
  assert.deepEqual(orderCourses("fund",a,COURSES),COURSES);
});

test("テクニカル派なら、Q5に関係なく並びは変えない", ()=>{
  const a=fill(-2); a[4]=2;
  assert.deepEqual(orderCourses("tech",a,COURSES),COURSES);
});

test("元の講義データは書き換えない", ()=>{
  const before=JSON.stringify(COURSES);
  const a=fill(2);
  orderCourses("fund",a,COURSES);
  assert.equal(JSON.stringify(COURSES),before);
});

test("講義のURLは gfs.tokyo のページで、個人識別用のパラメータを含まない", ()=>{
  const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
  const urls=[...html.matchAll(/url:"([^"]*)"/g)].map(m=>m[1]);
  assert.equal(urls.length,4);
  for(const u of urls){
    assert.match(u,/^https:\/\/gfs\.tokyo\//);
    assert.doesNotMatch(u,/[?&#]/); // lmclid などを入れない（このリポジトリは Public）
  }
});
