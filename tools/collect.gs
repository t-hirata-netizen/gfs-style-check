// 投資スタイル診断の匿名集計：Googleスプレッドシートの Apps Script に貼って「ウェブアプリ」として公開する
// 受け取るのは タイプ・割合・22問の回答・アプリの版 だけ。名前・会員ID・メール・時刻・IPアドレスは記録しない
// 設定方法は CLAUDE.md の「匿名の集計」を参照
const SHEET_NAME = "結果";
const N = 22; // 質問の数（index.html の Q と同じにする）

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (!isValid(d)) return text("invalid");
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      // 日付だけを記録する（時刻まで残すと、専任コンサルに届いた結果と突き合わせて本人が分かるおそれがあるため）
      const day = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
      sheet().appendRow([day, d.v, d.type, d.pa, d.pb].concat(d.ans));
    } finally {
      lock.releaseLock();
    }
    return text("ok");
  } catch (err) {
    return text("error");
  }
}

// 形の崩れたデータやいたずらの送信を記録しないための確認
function isValid(d) {
  return d && typeof d === "object"
    && typeof d.v === "string" && d.v.length > 0 && d.v.length <= 20
    && (d.type === "tech" || d.type === "fund")
    && Number.isInteger(d.pa) && Number.isInteger(d.pb) && d.pa + d.pb === 100
    && d.pa >= 0 && d.pb >= 0
    && (d.type === "tech" ? d.pa > 50 : d.pb > 50)
    && Array.isArray(d.ans) && d.ans.length === N
    && d.ans.every(function (v) { return v === -2 || v === -1 || v === 1 || v === 2; });
}

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    const head = ["日付", "版", "タイプ", "テクニカル%", "ファンダ%"];
    for (let i = 1; i <= N; i++) head.push("Q" + i);
    sh.appendRow(head);
    sh.setFrozenRows(1);
  }
  return sh;
}

function text(s) {
  return ContentService.createTextOutput(s);
}
