# 常時使えるようにする方法

PCの電源が完全に切れている間は、このPC上のNode.js/Ollamaは動けません。
常に使いたい場合は、アプリとOllamaをVPSやクラウドサーバーに置いて、そこを常時起動させます。

## 追加した構成

- `Dockerfile`: AIアプリ本体をコンテナ化します。
- `docker-compose.yml`: アプリ本体とOllamaを一緒に起動します。
- `./data`: 会話履歴、長期記憶、添付ファイルを保存します。
- `./workspace`: AIが検索・編集する作業フォルダーです。
- `ollama-models`: Ollamaのモデルを保存するDocker volumeです。

## VPSで起動する

```bash
docker compose up -d --build
```

初回はOllamaモデルを入れます。低スペックなら軽いモデルから始めます。

```bash
docker compose exec ollama ollama pull qwen2.5:3b
docker compose exec ollama ollama pull qwen3:4b
```

ブラウザで開きます。

```text
http://サーバーのIP:8787
```

## かなり重要な公開時の注意

今のアプリにはログイン認証をまだ入れていないので、インターネットへ直接公開すると他人も使えてしまいます。
常時利用するなら、最初は次のどれかで守ってください。

- TailscaleやVPN内だけで開く
- Cloudflare Tunnelなどでアクセス制限を付ける
- Nginx/CaddyのBasic認証を前段に置く

## PCがオンのときだけ自動起動したい場合

それはクラウド化とは別で、Windowsのスタートアップやタスクスケジューラに `npm start` を登録します。
ただしPCがシャットダウンしている間は使えません。
