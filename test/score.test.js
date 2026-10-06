// 判定ロジックの単体テスト。実行: node --test
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {score,pickCourses,pickLives,axisLean,buildRecord,collectAllowed}=require("../score.js");
const vm=require("node:vm");

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

test("一番上は講義一覧（実践コースより先）。テクニカル派はテクニカル分析編、ファンダ派はファンダメンタルズ分析編", ()=>{
  const t=pick(ans22(-2)), f=pick(ans22(1));
  assert.equal(t[0].id,"lectures"); assert.equal(t[0].main,true);
  assert.equal(f[0].id,"lecturesFund"); assert.equal(f[0].main,true);
  assert.deepEqual(ids(ans22(-1)),["lectures","endo"]);
  assert.equal(t[1].tag,"講義一覧のあとに");
});

test("テクニカル派：Q8に「Aにとても近い」→ Kenmo講師", ()=>{
  assert.deepEqual(ids(ans22(-1,{7:-2})),["lectures","endo","kenmo"]);
});

test("テクニカル派：僅差（60%以下）か判断材料がファンダ寄り → アポロ講師", ()=>{
  // 判断材料の軸（Q6〜Q10）だけB寄り → 判断材料 +5、合計はマイナスのまま
  const a=ans22(-2,{5:1,6:1,7:1,8:1,9:1});
  const r=score(a,AXES22);
  assert.equal(r.key,"tech"); assert.ok(r.axis[1]>0);
  assert.deepEqual(ids(a).slice(0,3),["lectures","endo","apollo"]);
  // 僅差：テクニカル55%前後
  const b=AXIS_OF.map((_,i)=>i<11?-1:1); b.push(-1,-1);
  const rb=score(b,AXES22); assert.equal(rb.key,"tech"); assert.ok(rb.pa<=60);
  assert.ok(ids(b).includes("apollo"));
});

test("ファンダ派：はっきりファンダ → 講義一覧の次はヘム講師", ()=>{
  const c=pick(ans22(1));
  assert.equal(c[1].id,"hemu"); assert.equal(c[1].main,false);
  assert.equal(c.length,3);
});

test("ファンダ派：Q5に「Bにとても近い」→ 実践コースの一番目はリッキー講師（仕様5）", ()=>{
  const c=pick(ans22(2));
  assert.equal(c[1].id,"ricky");
});

test("ファンダ派：Q9に「Bにとても近い」→ 実践コースの一番目はたけぞう講師。配当と両方ならリッキー講師が先", ()=>{
  assert.equal(pick(ans22(1,{8:2}))[1].id,"takezou");
  const both=ids(ans22(1,{4:2,8:2}));
  assert.equal(both[1],"ricky"); assert.equal(both[2],"takezou");
});

test("ファンダ派：僅差（60%以下）→ 実践コースの一番目は市川校長", ()=>{
  const a=AXIS_OF.map((_,i)=>i<11?1:-1); a.push(-1,-1);
  const r=score(a,AXES22); assert.equal(r.key,"fund"); assert.ok(r.pb<=60);
  assert.equal(pick(a)[1].id,"ichikawa");
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
    assert.ok(c[0].id==="lectures"||c[0].id==="lecturesFund"); // いつも講義一覧が先
    for(const x of c)assert.ok(x.tag.length>0);
  }
});

test("講義のURLは gfs.tokyo のページで、個人識別用のパラメータを含まない", ()=>{
  const urls=[...HTML.matchAll(/url:"([^"]*)"/g)].map(m=>m[1]);
  assert.equal(urls.length,11);
  for(const u of urls){
    assert.match(u,/^https:\/\/gfs\.tokyo\//);
    assert.doesNotMatch(u,/[?&#]/); // lmclid などを入れない（このリポジトリは Public）
  }
  assert.doesNotMatch(HTML,/lmclid/);
});

test("score.js が使う講義IDが、すべて index.html の COURSES にある", ()=>{
  const block=HTML.slice(HTML.indexOf("const COURSES={"),HTML.indexOf("};",HTML.indexOf("const COURSES={")));
  const defined=new Set([...block.matchAll(/^ (\w+):\s*\{/gm)].map(m=>m[1]));
  const all=fs.readFileSync(path.join(__dirname,"..","score.js"),"utf8");
  const src=all.slice(all.indexOf("function pickCourses("),all.indexOf("function pickLives(")); // 講師の講義だけ（ライブ講義は別のテスト）
  const used=new Set([...src.matchAll(/id:"(\w+)"/g)].map(m=>m[1]));
  assert.equal(defined.size,11);
  for(const id of used)assert.ok(defined.has(id),id);
});

test("軸の寄り具合：2割未満は「どちらとも」、6割以上は「はっきり」", ()=>{
  assert.deepEqual(axisLean(0,10),{side:"mid",strong:false});
  assert.deepEqual(axisLean(1.9,10),{side:"mid",strong:false});
  assert.deepEqual(axisLean(-2,10),{side:"a",strong:false});
  assert.deepEqual(axisLean(5,10),{side:"b",strong:false});
  assert.deepEqual(axisLean(-6,10),{side:"a",strong:true});
  assert.deepEqual(axisLean(18,18),{side:"b",strong:true});
});

// ---- LINE などで URL を送ったときの画像 ----
const BASE="https://t-hirata-netizen.github.io/gfs-style-check/";
const pngSize=f=>{const b=fs.readFileSync(f); assert.equal(b.toString("ascii",1,4),"PNG"); return [b.readUInt32BE(16),b.readUInt32BE(20)]};

test("LINE などで URL を送ったときの画像（og/default.png）は 1200×630", ()=>{
  assert.deepEqual(pngSize(path.join(__dirname,"..","og","default.png")),[1200,630]);
});

test("index.html の og:image は公開URLの画像を指している", ()=>{
  assert.ok(HTML.includes(`<meta property="og:image" content="${BASE}og/default.png">`));
});

test("結果をシェアする機能は置かない（GFS生徒以外に広がらないように）", ()=>{
  assert.doesNotMatch(HTML,/btnShare|navigator\.share|lineit\/share/);
  for(const f of ["tech.html","fund.html"])assert.ok(!fs.existsSync(path.join(__dirname,"..",f)),f);
  assert.ok(HTML.includes('<meta name="robots" content="noindex, nofollow">'));
});

// ---- 色のコントラスト（WCAG：文字 4.5 以上、線や図形 3 以上） ----
const tokens=css=>Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m=>[m[1],m[2]]));
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
const contrast=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05)};

test("色のコントラスト：ライト・ダークの両方で基準を満たす", ()=>{
  const light=tokens(HTML.slice(HTML.indexOf(":root{"),HTML.indexOf("@media (prefers-color-scheme: dark)")));
  const darkCss=HTML.slice(HTML.indexOf(':root[data-theme="dark"]{'));
  const dark={...light,...tokens(darkCss.slice(0,darkCss.indexOf("}")))};
  const pairs=[["body","surface",4.5],["muted","bg",4.5],["muted","surface",4.5],["ink","bg",4.5],
    ["on-tech","tech",4.5],["on-fund","fund",4.5],["tech-ink","tech-soft",4.5],["fund-ink","fund-soft",4.5],
    ["tech-ink","surface",4.5],["fund-ink","surface",4.5],["tech","bg",3],["fund-edge","bg",3]];
  for(const [name,t] of [["ライト",light],["ダーク",dark]]){
    for(const [fg,bg,need] of pairs){
      assert.ok(t[fg]&&t[bg],`${name}: --${fg} か --${bg} が未定義`);
      const c=contrast(t[fg],t[bg]);
      assert.ok(c>=need,`${name}: --${fg} / --${bg} = ${c.toFixed(2)}（基準 ${need}）`);
    }
  }
  // 結果ヘッダー（固定色）
  assert.ok(contrast("#FFFFFF","#2563EB")>=4.5);                              // テクニカル：白文字
  assert.ok(contrast("#16112E","#E08A00")>=4.5 && contrast("#16112E","#F5A524")>=4.5); // ファンダ：濃い文字
});

// ---- 匿名の集計 ----
const GS=fs.readFileSync(path.join(__dirname,"..","tools","collect.gs"),"utf8");
const gs=(()=>{const ctx={}; vm.createContext(ctx); vm.runInContext(GS+";this.isValid=isValid;this.N=N;",ctx); return ctx})();

test("集計に送る1件：タイプ・割合・22問の回答・版だけで、ほかの情報を含まない", ()=>{
  const ans=[...fill(1),2,-1];
  const rec=buildRecord(score(ans,[...AXIS_OF,null,null]),ans,"2026-10-01");
  assert.deepEqual(Object.keys(rec).sort(),["ans","pa","pb","type","v"]);
  assert.equal(rec.ans.length,22);
  assert.equal(rec.type,"fund");
  ans[0]=-2; assert.equal(rec.ans[0],1); // 元の配列を後から変えても影響しない
});

test("集計は公開ページ（https の github.io）だけで送り、手元の確認では送らない", ()=>{
  assert.equal(collectAllowed({protocol:"https:",hostname:"t-hirata-netizen.github.io"}),true);
  assert.equal(collectAllowed({protocol:"http:",hostname:"localhost"}),false);
  assert.equal(collectAllowed({protocol:"file:",hostname:""}),false);
  assert.equal(collectAllowed({protocol:"https:",hostname:"github.io.example.com"}),false);
});

test("Apps Script の質問数は index.html と同じ", ()=>{
  assert.equal(gs.N,Q_ROWS.length);
});

test("アプリが送るデータは、Apps Script の確認をすべて通る", ()=>{
  const rnd=rng(9), axes=Q_ROWS.map(r=>r.ax), ver=HTML.match(/const APP_VERSION="([^"]+)"/)[1];
  for(let n=0;n<2000;n++){
    const a=axes.map(()=>[-2,-1,1,2][Math.floor(rnd()*4)]);
    const rec=JSON.parse(JSON.stringify(buildRecord(score(a,axes),a,ver)));
    assert.ok(gs.isValid(rec),JSON.stringify(rec));
  }
});

test("Apps Script は形の崩れたデータを記録しない", ()=>{
  const good={v:"2026-10-01",type:"fund",pa:40,pb:60,ans:new Array(22).fill(1)};
  assert.ok(gs.isValid(good));
  const bad=[
    {...good,type:"x"}, {...good,pa:41}, {...good,pa:60,pb:40}, {...good,ans:new Array(21).fill(1)},
    {...good,ans:[...new Array(21).fill(1),0]}, {...good,ans:[...new Array(21).fill(1),"1"]},
    {...good,v:""}, {...good,v:"x".repeat(21)}, null, "text"
  ];
  for(const b of bad)assert.ok(!gs.isValid(b),JSON.stringify(b));
});

test("画面に「送信しません」など、事実と違う説明が残っていない", ()=>{
  assert.doesNotMatch(HTML,/送信しません|送信されません/);
});

test("「結果をコピー」の文に講義名を入れない（専任コンサルに伝える必要はない、とのフィードバック）", ()=>{
  const a=HTML.indexOf("const lines=["), b=HTML.indexOf('$("copyText").value',a);
  const block=HTML.slice(a,b);
  assert.doesNotMatch(block,/次に見る講義|あわせて|courses/);
});

test("閉じるボタン：質問画面の×と結果画面の「閉じる」は閉じるだけで、ほかのページに移らない", ()=>{
  assert.match(HTML,/id="btnX"[^>]*aria-label="[^"]+"/);
  assert.match(HTML,/id="btnClose">閉じる</);
  const f=HTML.slice(HTML.indexOf("function closeApp(){"),HTML.indexOf("$(\"btnX\").onclick"));
  assert.match(f,/window\.close\(\)/);
  assert.doesNotMatch(f,/location\.href|history\.back|EXIT_URL/); // 閉じられなくても移動しない
  assert.match(HTML,/id="closeNote"[^>]*role="status"/);           // 閉じられないときの案内
  assert.match(HTML,/\$\("btnX"\)\.hidden=id!=="quiz"/); // ×は質問画面だけ
});

// ---- ライブ講義 ----
const lives=a=>pickLives(score(a,AXES22),a).map(x=>x.id);

test("ライブ講義：最大3本、重複なし、どれも index.html の LIVES にある", ()=>{
  const block=HTML.slice(HTML.indexOf("const LIVES={"),HTML.indexOf("};",HTML.indexOf("const LIVES={")));
  const defined=new Set([...block.matchAll(/^ (\w+):\s*\{/gm)].map(m=>m[1]));
  assert.equal(defined.size,11);
  const rnd=rng(21);
  for(let n=0;n<3000;n++){
    const a=AXES22.map(()=>[-2,-1,1,2][Math.floor(rnd()*4)]);
    const c=pickLives(score(a,AXES22),a);
    assert.ok(c.length>=1&&c.length<=3);
    assert.equal(new Set(c.map(x=>x.id)).size,c.length);
    for(const x of c){assert.ok(defined.has(x.id),x.id); assert.ok(x.tag.length>0);}
  }
});

test("ライブ講義：テクニカル派は遠藤講師が一番上、ファンダ派は藤本講師が入る", ()=>{
  assert.equal(lives(ans22(-1))[0],"endoLive");
  assert.ok(lives(ans22(1)).includes("fujimoto"));
});

test("ライブ講義：僅差なら市川校長のオンライン授業、Q9を強く選んだファンダ派はたけぞう講師", ()=>{
  const a=AXIS_OF.map((_,i)=>i<11?1:-1); a.push(-1,-1);
  assert.ok(Math.max(score(a,AXES22).pa,score(a,AXES22).pb)<=60);
  assert.ok(lives(a).includes("ichikawaOnline"));
  assert.equal(lives(ans22(1,{8:2}))[0],"takezouLive");
});

test("ライブ講義：Q18を強く選んだテクニカル派は雨宮講師が入る", ()=>{
  assert.ok(lives(ans22(-1,{17:-2})).includes("amemiya"));
  assert.ok(!lives(ans22(-1,{17:-1})).includes("amemiya"));
});

test("ライブ講義のリンクは gfs.tokyo のページで、個人識別用のパラメータを含まない", ()=>{
  const hrefs=[...HTML.matchAll(/href:"([^"]*)"/g)].map(m=>m[1]);
  assert.equal(hrefs.length,11);
  for(const h of hrefs){ assert.match(h,/^https:\/\/gfs\.tokyo\//); assert.doesNotMatch(h,/lmclid/); }
  // 対象外にしたシリーズ（堀・DAIBOUCHOU・上岡・藤本トップインタビュー・配信オンライン授業・市川校長の経営者対談）は入れない
  for(const id of [126,125,130,123,120,189])assert.ok(!hrefs.some(h=>h.endsWith("child_id="+id)),String(id));
});

test("Q18 は「損をしてもすぐ切り替える」の質問（ライブ講義の条件に使っている）", ()=>{
  assert.match(Q_ROWS[17].a,/損をしても/);
});

test("score.js は中身に合った記号付きで読み込む（古いファイルがブラウザに残らないように）", ()=>{
  const h=require("node:crypto").createHash("sha1").update(fs.readFileSync(path.join(__dirname,"..","score.js"))).digest("hex").slice(0,8);
  assert.ok(HTML.includes(`<script src="score.js?v=${h}"></script>`),`index.html の score.js?v= を ${h} に変えてください`);
});
