import { CONTACT_X } from "./about";

export const SITE_URL = "https://flicktypinggame.xyzack271.com/";

/** スマホ以外で開いたときの説明ページの HTML。中身は固定の文だけ(利用者の入力を混ぜない) */
export function landingHtml(): string {
  return `<main class="screen blocked landing">
  <p class="ribbon">FLICK TYPING</p>
  <h1>ふりっくタイピング</h1>
  <p class="landing-lead">スマホのフリック入力で遊ぶタイピングゲーム</p>
  <p class="landing-notice">スマホで開いてください</p>
  <p class="landing-url">${SITE_URL}</p>

  <section class="landing-section">
    <h2>ふりっくタイピングとは</h2>
    <p>
      ふりっくタイピング(フリックタイピング)は、スマホのフリック入力だけで遊ぶ無料のタイピングゲームです。画面に出るお題を、いつものスマホのキーボードでフリック入力します。登録もアプリのインストールもいりません。ブラウザで開けばすぐ遊べます。
    </p>
  </section>

  <section class="landing-section">
    <h2>遊べるモード</h2>
    <h3>タイムアタック</h3>
    <p>
      60秒から始まり、正解を続けると時間が増えます。時間切れまでに打てた文字数で競います。お題は毎日の暮らしで使う短い文と、いま話題のことばです。
    </p>
    <h3>今日の耐久</h3>
    <p>
      青空文庫の名作の一節を、1回ミスするまで打ち続けます。お題は毎日変わります。
    </p>
    <h3>ランキング</h3>
    <p>
      タイムアタックと今日の耐久の記録は、ニックネームを付けてランキングに載せられます。みんなの記録の分布は<a href="/stats">集計ページ</a>で見られます。
    </p>
  </section>

  <section class="landing-section">
    <h2>よくある質問</h2>
    <h3>パソコンやタブレットでは遊べますか</h3>
    <p>
      遊べません。スマホの画面でフリック入力する速さを競うゲームなので、パソコン・タブレット・外付けキーボードでは開けないようにしています。
    </p>
    <h3>トグル入力やローマ字入力でも遊べますか</h3>
    <p>
      フリック入力で打ってください。同じキーを何度も押すトグル入力は使えません。キーボードはかな入力(12キー)にしてください。
    </p>
    <h3>お金はかかりますか</h3>
    <p>無料です。会員登録もいりません。</p>
  </section>

  <p class="landing-contact">
    不具合のご報告・お問い合わせは X の
    <a href="https://x.com/${CONTACT_X}" target="_blank" rel="noopener noreferrer">@${CONTACT_X}</a>
    まで
  </p>
</main>`;
}
