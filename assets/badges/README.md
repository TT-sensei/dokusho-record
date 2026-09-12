# このフォルダについて

このアプリのナビキャラ画像は、[navi-character-](https://github.com/TT-sensei/navi-character-) の
`AI-GUIDE.md` の方針に従い、**このリポジトリへ複製せず**、公開済みのURLを
直接参照しています。

```
https://tt-sensei.github.io/navi-character-/assets/web/characters/{id}/fullbody/{pose}.webp
```

どの場面でどのキャラクターを使うかは `js/navi.js` の `SCENES` にまとめてあります
(役割はnavi-character-のAI-GUIDEにある役割表に準拠: そら=登録、なみ=重複・再読、
つき=目標達成、さく=バッジ獲得、かい=ヒント・見つからない場合)。

画像が読み込めない場合(オフライン・障害時など)は、`js/navi.js` の
onerrorハンドラで吹き出しの画像部分だけが自動的に非表示になり、
セリフとアプリ本体の動作には影響しません。
