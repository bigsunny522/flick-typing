/** 連絡先(X のアカウント) */
export const CONTACT_X = "xyzack271";

/** 「記録と名前について」の HTML。中身は固定の文だけ(利用者の入力を混ぜない) */
export function aboutHtml(): string {
  return (
    `<details class="about">` +
    `<summary>記録と名前について</summary>` +
    `<ul>` +
    `<li>` +
    `遊んだ結果(打てた文字数・ミスの数・コンボ・時間)を、` +
    `端末ごとに作る匿名の番号といっしょに集めています。` +
    `入力した文字そのものや、メールアドレスなどの個人情報は集めていません` +
    `</li>` +
    `<li>集めた結果は、ランキングと「みんなの記録」の集計に使います</li>` +
    `<li>ランキングに載せた記録とニックネームは、だれでも見られます</li>` +
    `<li>自己ベストや設定は、この端末のブラウザの中にだけ保存しています</li>` +
    `<li>画面の文字は Google Fonts から読み込んでいます</li>` +
    `<li>不適切な名前や、不正と思われる記録は、予告なく消すことがあります</li>` +
    `<li>` +
    `名前や記録を消してほしいときは、X の ` +
    `<a href="https://x.com/${CONTACT_X}"` +
    ` target="_blank" rel="noopener noreferrer">@${CONTACT_X}</a> ` +
    `までご連絡ください` +
    `</li>` +
    `</ul>` +
    `</details>`
  );
}
