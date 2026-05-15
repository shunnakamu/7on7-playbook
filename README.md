# 7on7 Playbook

7-on-7 のオフェンスとディフェンスを、フィールド上でそのまま設計できるプレーブックエディタです。  
ルート作成、モーション、守備ゾーン設計、印刷、共有用 viewer 公開までをひとつのアプリで回せます。

## Screenshots

### Offense editor

プレーをフォーメーションごとに管理しながら、各レシーバーのルートとモーションを描けます。

![Offense editor](docs/screenshots/editor-offense.png)

### Defense editor

守備フロントとカバレッジを切り替えながら、ゾーン責任をそのまま可視化できます。

![Defense editor](docs/screenshots/editor-defense.png)

### Viewer

公開済みプレーブックは read-only viewer で配布できます。選手や保護者には編集権限を渡さずに見せる運用向きです。

![Viewer](docs/screenshots/viewer.png)

## What You Can Do

- オフェンスのプレーを作る  
  選手配置、ルート、モーション、カーブ付きルート、プレー名管理ができます。
- ディフェンスのプレーを作る  
  4-2-1 などの守備配置、Cover 1/2/3/4/6 のプリセット、個別ゾーン調整に対応しています。
- フォーメーションをテンプレート化する  
  よく使う配置を保存し、別プレーへ再利用できます。
- プレーをグループで整理する  
  サイドバーでフォーメーション単位にまとまり、オフェンスとディフェンスを切り替えて管理できます。
- viewer 用に公開する  
  editor 側で `Publish` すると、viewer 側に最新の公開版を出せます。
- 印刷する  
  プレーブックを印刷用レイアウトで出力できます。
- URL 共有する  
  editor の `Share` で URL ベースの共有もできます。

## Typical Workflow

1. editor にログインしてプレーを作る
2. オフェンス側でルートとモーションを設計する
3. ディフェンス側でフロントとカバレッジを詰める
4. 必要ならフォーメーションを保存して他プレーへ流用する
5. `Publish` して viewer に公開する
6. viewer を見せるか、`Print` で紙に出す

## Quick Start

```bash
git clone https://github.com/shunnakamu/7on7-playbook.git
cd 7on7-playbook
copy .env.example .env
npm install
npm start
```

起動後:

- Editor: `http://localhost:20011/editor`
- Viewer: `http://localhost:20011/viewer`

`.env` では最低限この2つを変えてください。

- `EDITOR_PASSWORD`
- `VIEWER_PASSWORD`

詳しいセットアップは [SETUP.md](./SETUP.md) を参照してください。

## Main Controls

- `Move`: 選手やウェイポイントの移動
- `Route`: 通常ルート作成
- `Motion`: モーション作成
- `Zone`: 守備ゾーン割り当て
- `Swap`: オフェンス選手の位置入れ替え
- `Publish`: viewer 向け公開
- `Share`: URL 共有
- `Print`: 印刷用出力

## Storage

- プレーブック本体は `playbook.db` に保存されます
- viewer は公開済みバージョンを表示します
- HTTPS 用の `certs/cert.pem` と `certs/key.pem` があれば HTTPS でも起動します
