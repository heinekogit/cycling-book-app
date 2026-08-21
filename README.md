# Cycling Book App

Expo SDK 57 / React Nativeで開発するCycling Bookのモバイルアプリです。

## 開発

```sh
npm install
npx expo start --dev-client
```

## 確認

```sh
npm run lint
npm run typecheck
npm test
npm run doctor
```

バックグラウンド位置情報を利用するため、実機確認ではExpo GoではなくDevelopment Buildを使用します。

実走中の位置情報はSQLiteへ逐次退避します。GPSタスクが停止した状態でアプリを再起動した場合は、未保存の記録を一時停止状態で復元します。
