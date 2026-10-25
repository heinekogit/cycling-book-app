import Storage from 'expo-sqlite/kv-store'
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'

export type AppLanguage = 'ja' | 'en'
type Replacements = Record<string, string | number>

const LANGUAGE_KEY = 'cycling-book.language.v1'

const ja = {
  selectedElevationPoint: '選択地点', localGrade: '付近の勾配', elevationSelectionHelp: 'グラフをなぞるか地図をタップして地点を選択。勾配は前後50m（端では短縮）の目安です。縦方向は拡大表示しています。',
  spotOpenPhotos: 'タップして写真を拡大（{{count}}枚）',
  routeSpot: "ルートのスポット",
  spotPrivate: "公開対象から除外されています（自分には表示されます）",
  spotEmpty: "このマーカーにはコメント・写真がありません",
  spotImageFailed: "写真を読み込めませんでした。画面を開き直してください。",
  spotsLoadFailed: "スポット・写真を読み込めませんでした。タップして再試行",
  spotHelp: "地図のピンをタップすると、吹き出しでコメント・写真を確認できます。",

  privacyTitle: "公開するルートの確認",
  privacyFilter: "ホーム地点から500m以内を除外する",
  privacyHomeMissing: "ホーム地点が未設定です。「ホーム地点をWebで設定」からプロフィールに設定して、再度お試しください。",
  privacyProfile: "ホーム地点をWebで設定",
  privacyNoSegments: "公開できる区間がありません。",
  privacyFilteredNote: "円内の区間・写真・マーカーを公開対象から除外します。元のマイルートは保持されます。",
  privacyUnfilteredNote: "除外設定がオフです。ホーム地点付近を含む軌跡・写真・マーカーが公開されます。",
  privacySummary: "公開距離 {{distance}} km／非公開の写真 {{photos}} 枚・マーカー {{markers}} 件",

  languageName: '日本語', switchLanguage: 'EN', rideRecord: '実走記録', history: '履歴', signOut: 'ログアウト',
  accuracyPoints: '精度 ±{{accuracy}}m・記録 {{points}}点', waitingForLocation: '位置情報待ち', openSettings: 'iPhoneの設定を開く',
  elapsedTime: '経過時間', distance: '距離', speed: '速度', duration: '時間', rideDuration: '走行時間', averageSpeed: '平均速度',
  pause: '一時停止', resume: '再開', retrySave: '保存を再試行', startAgain: 'もう一度開始', start: '開始', finishSave: '終了・保存',
  localBackupNote: '走行中はSQLiteへ自動退避します。保存失敗時も端末内データを保持します。',
  confirmFinishTitle: '実走ログを保存', confirmFinishBody: '名前を確認・編集して保存してください。', cancel: 'キャンセル',
  runNameLabel: '実走ログの名前', discardRide: 'キャンセル（破棄）', discardConfirmTitle: '実走ログを破棄しますか？', discardConfirmBody: '記録中の実走ログは保存されず、元に戻せません。', keepEditing: '戻る', discardFailed: '実走ログを破棄できませんでした',
  unsavedTitle: '未保存の記録があります', unsavedBody: '端末内の記録を破棄して新しく開始しますか？', discardStart: '破棄して開始',
  signIn: 'ログイン', signInDescription: '実走ログを記録・保存するには、登録済みのアカウントでログインしてください。', email: 'メールアドレス', password: 'パスワード',
  missingCredentials: 'メールアドレスとパスワードを入力してください', signInFailed: 'ログインできませんでした。入力内容を確認してください。',
  backToRide: '‹ 実走', rideHistory: '走行履歴', loadingHistory: '履歴を読み込んでいます', historyLoadFailed: '履歴を読み込めませんでした', retry: 'もう一度試す',
  noSavedRuns: '保存済みの走行はありません', noSavedRunsHelp: '実走を終了・保存すると、ここに表示されます。',
  backToHistory: '‹ 履歴', rideDetail: '走行詳細', loadingRun: '走行記録を読み込んでいます', displayFailed: '表示できませんでした', runNotFound: '指定された走行記録が見つかりません', runLoadFailed: '走行記録を読み込めませんでした',
  markerStart: '開始', markerEnd: '終了', noTrack: '軌跡データがありません', noTrackHelp: '距離と時間の記録は下で確認できます。', recordedPoints: '記録点', pointsCount: '{{points}}点', unknownDate: '日時不明', defaultRunName: '実走',
  permissionRequired: '走行記録には位置情報の許可が必要です', foregroundPermission: '設定で位置情報を「このAppの使用中」に許可してください', backgroundPermission: '画面を閉じても記録するには、設定で位置情報を「常に」にしてください', permissionReady: '位置情報を利用できます',
  readyMessage: '開始するとバックグラウンド記録を始めます', recordingMessage: 'バックグラウンドGPS記録中', unsavedMessage: '端末内に未保存の実走記録があります', checkingPermission: '位置情報の許可を確認しています…', startLocationFailed: '位置情報を開始できませんでした', pausedMessage: '記録を一時停止しています', pauseFailed: '一時停止できませんでした',
  insufficientPoints: '保存に必要な位置情報が不足しています', accountUnavailable: 'アカウント情報を確認できません', savingMessage: '実走ログを保存しています…', localRideMissing: '端末内の走行データが見つかりません', savedMessage: '実走ログをSupabaseへ保存しました', saveFailed: '保存できませんでした。端末内データは保持しています：{{error}}', unknownError: '不明なエラー',
  notificationTitle: 'Cycling Bookで走行記録中', notificationBody: 'バックグラウンドで位置情報を記録しています', runNameSuffix: '実走',
  queuedMessage: '走行を端末に保存しました。通信回復後に同期します', syncedMessage: '走行を保存・同期しました', pendingSync: '未同期 {{count}}件', syncNow: '今すぐ同期', syncing: '同期中…', syncComplete: '{{count}}件を同期しました', syncFailed: '同期できませんでした。端末内データは保持しています',
  homeTagline: '自転車の旅を記録する', homeEyebrow: 'START YOUR RIDE', homeTitle: '今日は、どう走りますか？', homeDescription: 'ルートを選んで案内を使うか、自由な実走をそのまま記録できます。', rideWithRoute: 'ルートを使って走る', rideWithRouteHelp: '保存したルートを選び、ナビを使って走行します', freeRide: 'ルートなしで走る', freeRideHelp: '現在地から自由に走り、軌跡を記録します', viewHistory: '保存した走行を見る', backToHome: '‹ ホーム', routeRide: 'ルート実走', routeSelectionTitle: '走るルートを選ぶ', routeSelectionHelp: '保存したルートの一覧とナビゲーション機能を、ここに追加していきます。', comingSoon: '準備中', home: 'ホーム',
  activeRideNotice: '記録中または一時停止中の実走があります', returnToRide: '実走画面に戻る', returnToRideHelp: '現在の記録を確認・再開します',
  myRoutes: 'マイルート', routeListHelp: '保存したルートを選ぶと、地図と詳細を確認できます。', loadingRoutes: 'ルートを読み込んでいます', routesLoadFailed: 'ルートを読み込めませんでした', noSavedRoutes: '保存したルートはありません', noSavedRoutesHelp: 'Webサービスで作成・保存したルートがここに表示されます。', untitledRoute: '無題のルート', publicRoute: '公開', privateRoute: '非公開', drawnRoute: '描画ルート', fromRunRoute: '実走履歴', savedRoute: '保存ルート', backToRoutes: '‹ ルート', routeDetail: 'ルート詳細', loadingRoute: 'ルートを読み込んでいます', routeNotFound: '指定されたルートが見つかりません', routeLoadFailed: 'ルートを読み込めませんでした', noRouteTrack: 'ルート軌跡がありません', noRouteTrackHelp: 'このルートには表示できる経路データがありません。', routeKind: '種類', rideThisRoute: 'このルートで走る', navigationComingSoon: 'ナビゲーションは次の実装段階で接続します', showRouteOnRide: '予定ルートを実走画面に表示します', plannedRoute: '予定ルート', selectedRoute: '選択中：{{name}}',
  elevationGain: '獲得標高', elevationLoss: '下降', elevationRange: '標高範囲', routePhotos: 'ルート写真', routePhoto: 'ルート写真', shareRoute: '共有', publishRoute: '公開する', makePrivate: '非公開にする', publishRouteConfirm: 'このルートを公開しますか？ 公開すると誰でも共有リンクを閲覧できます。', makePrivateConfirm: 'このルートを非公開にしますか？ 共有リンクから閲覧できなくなります。', updateFailed: '更新できませんでした', publicRouteLimitReached: '無料プランで公開できるルートは20件までです。別のルートを非公開にしてからお試しください。',
  elevationCurrentPosition: '現在地', plannedElevation: '予定ルートの標高図', hideElevation: '閉じる ▾', showElevation: '表示する ▴', loadingElevation: '標高を読み込み中…', elevationUnavailable: '標高を取得できませんでした', retryElevation: '再試行',
  elevationProfile: '標高データ', averageGrade: '平均勾配',
  hasPhotos: '写真あり', photoViewer: '写真表示', photoCount: '{{current}} / {{total}}', close: '閉じる', sharePhoto: 'SNSへ共有', sharingPhoto: '共有準備中…', sharePhotoFailed: '写真の共有画面を開けませんでした',
  takePhoto: '写真を撮る', takingPhoto: '写真を処理中…', photoSaved: '写真を位置情報とともに保存しました', photoCaptureFailed: '写真を保存できませんでした', photoTooLarge: '写真は1枚20MB以下にしてください。長辺1600～2400px・1～3MB程度を推奨します。', cameraPermissionRequired: '撮影するにはカメラの使用を許可してください', openPhotoAtLocation: 'この地点の写真を開く',
  actualTrack: '実走', offRoute: '逸脱', offRouteWarningTitle: 'ルートを外れています', offRouteWarningBody: '青い予定ルートへ戻ってください',
} as const

export type TranslationKey = keyof typeof ja
export type TFunction = (key: TranslationKey, replacements?: Replacements) => string
const en: Record<TranslationKey, string> = {
  selectedElevationPoint: 'Selected', localGrade: 'Local grade', elevationSelectionHelp: 'Drag the chart or tap the map to select a point. Grade uses 50 m on each side (shorter at endpoints). Elevation is vertically exaggerated.',
  spotOpenPhotos: 'Tap to enlarge photos ({{count}})',
  routeSpot: "Route spot",
  spotPrivate: "Excluded from public view (visible to you)",
  spotEmpty: "This marker has no comment or photos",
  spotImageFailed: "Could not load the photo. Please reopen this screen.",
  spotsLoadFailed: "Could not load spots and photos. Tap to retry",
  spotHelp: "Tap a map pin to view comments and photos in a popup.",

  privacyTitle: "Review public route",
  privacyFilter: "Exclude the area within 500 m of home",
  privacyHomeMissing: "Set your home location using “Set home location on Web”, then try again.",
  privacyProfile: "Set home location on Web",
  privacyNoSegments: "There are no segments to publish.",
  privacyFilteredNote: "Segments, photos and markers inside the circle are excluded. Your original route is retained.",
  privacyUnfilteredNote: "Filtering is off. The track, photos and markers near home will be published.",
  privacySummary: "Public distance {{distance}} km / Hidden photos: {{photos}}; markers: {{markers}}",

  languageName: 'English', switchLanguage: '日本語', rideRecord: 'Ride Recording', history: 'History', signOut: 'Log out',
  accuracyPoints: 'Accuracy ±{{accuracy}}m · {{points}} points', waitingForLocation: 'Waiting for location', openSettings: 'Open iPhone Settings',
  elapsedTime: 'Elapsed', distance: 'Distance', speed: 'Speed', duration: 'Time', rideDuration: 'Ride time', averageSpeed: 'Avg. speed',
  pause: 'Pause', resume: 'Resume', retrySave: 'Retry save', startAgain: 'Start another', start: 'Start', finishSave: 'Finish & Save',
  localBackupNote: 'Your ride is backed up on this device while recording and retained if saving fails.',
  confirmFinishTitle: 'Save Ride', confirmFinishBody: 'Review or edit the name before saving.', cancel: 'Cancel',
  runNameLabel: 'Ride name', discardRide: 'Cancel & Discard', discardConfirmTitle: 'Discard this ride?', discardConfirmBody: 'This recorded ride will not be saved and cannot be restored.', keepEditing: 'Go back', discardFailed: 'Could not discard the ride',
  unsavedTitle: 'Unsaved ride found', unsavedBody: 'Discard the ride stored on this device and start a new one?', discardStart: 'Discard & Start',
  signIn: 'Log in', signInDescription: 'Log in with your registered account to record and save rides.', email: 'Email', password: 'Password',
  missingCredentials: 'Enter your email and password', signInFailed: 'Could not log in. Check your details and try again.',
  backToRide: '‹ Ride', rideHistory: 'Ride History', loadingHistory: 'Loading ride history', historyLoadFailed: 'Could not load ride history', retry: 'Try again',
  noSavedRuns: 'No saved rides', noSavedRunsHelp: 'Finished and saved rides will appear here.',
  backToHistory: '‹ History', rideDetail: 'Ride Details', loadingRun: 'Loading ride', displayFailed: 'Could not display ride', runNotFound: 'The requested ride was not found', runLoadFailed: 'Could not load the ride',
  markerStart: 'Start', markerEnd: 'Finish', noTrack: 'No route data', noTrackHelp: 'Distance and time are shown below.', recordedPoints: 'Points', pointsCount: '{{points}} points', unknownDate: 'Unknown date', defaultRunName: 'Ride',
  permissionRequired: 'Location permission is required to record a ride', foregroundPermission: 'Allow location access “While Using the App” in Settings', backgroundPermission: 'To record with the screen closed, set Location to “Always” in Settings', permissionReady: 'Location is available',
  readyMessage: 'Tap Start to begin background recording', recordingMessage: 'Recording GPS in the background', unsavedMessage: 'An unsaved ride is stored on this device', checkingPermission: 'Checking location permission…', startLocationFailed: 'Could not start location tracking', pausedMessage: 'Recording paused', pauseFailed: 'Could not pause recording',
  insufficientPoints: 'Not enough location data to save this ride', accountUnavailable: 'Could not find account information', savingMessage: 'Saving ride…', localRideMissing: 'Could not find the ride stored on this device', savedMessage: 'Ride saved to Supabase', saveFailed: 'Could not save. The ride remains on this device: {{error}}', unknownError: 'Unknown error',
  notificationTitle: 'Cycling Book is recording', notificationBody: 'Recording your location in the background', runNameSuffix: 'Ride',
  queuedMessage: 'Ride saved on this device. It will sync when a connection is available', syncedMessage: 'Ride saved and synced', pendingSync: '{{count}} pending', syncNow: 'Sync now', syncing: 'Syncing…', syncComplete: 'Synced {{count}} ride(s)', syncFailed: 'Could not sync. Your rides remain on this device',
  homeTagline: 'Record your journey by bike', homeEyebrow: 'START YOUR RIDE', homeTitle: 'How will you ride today?', homeDescription: 'Choose a route for guidance, or simply start a free ride and record your track.', rideWithRoute: 'Ride with a route', rideWithRouteHelp: 'Choose a saved route and ride with navigation', freeRide: 'Start a free ride', freeRideHelp: 'Ride freely from your current location and record your track', viewHistory: 'View saved rides', backToHome: '‹ Home', routeRide: 'Route Ride', routeSelectionTitle: 'Choose a route', routeSelectionHelp: 'Your saved routes and navigation options will be available here.', comingSoon: 'Coming soon', home: 'Home',
  activeRideNotice: 'A ride is recording or paused', returnToRide: 'Return to ride', returnToRideHelp: 'View or resume your current recording',
  myRoutes: 'My Routes', routeListHelp: 'Select a saved route to view its map and details.', loadingRoutes: 'Loading routes', routesLoadFailed: 'Could not load routes', noSavedRoutes: 'No saved routes', noSavedRoutesHelp: 'Routes created and saved on the web service will appear here.', untitledRoute: 'Untitled route', publicRoute: 'Public', privateRoute: 'Private', drawnRoute: 'Planned route', fromRunRoute: 'Ride history', savedRoute: 'Saved route', backToRoutes: '‹ Routes', routeDetail: 'Route Details', loadingRoute: 'Loading route', routeNotFound: 'The requested route was not found', routeLoadFailed: 'Could not load the route', noRouteTrack: 'No route track', noRouteTrackHelp: 'This route has no track data that can be displayed.', routeKind: 'Type', rideThisRoute: 'Ride this route', navigationComingSoon: 'Navigation will be connected in the next step', showRouteOnRide: 'Show the planned route on the ride screen', plannedRoute: 'Planned route', selectedRoute: 'Selected: {{name}}',
  elevationGain: 'Elevation gain', elevationLoss: 'Descent', elevationRange: 'Elevation range', routePhotos: 'Route photos', routePhoto: 'Route photo', shareRoute: 'Share', publishRoute: 'Make public', makePrivate: 'Make private', publishRouteConfirm: 'Make this route public? Anyone with its link will be able to view it.', makePrivateConfirm: 'Make this route private? It will no longer be available from its shared link.', updateFailed: 'Could not update', publicRouteLimitReached: 'The free plan allows up to 20 public routes. Make another route private, then try again.',
  elevationCurrentPosition: 'You are here', plannedElevation: 'Planned route elevation', hideElevation: 'Hide ▾', showElevation: 'Show ▴', loadingElevation: 'Loading elevation…', elevationUnavailable: 'Elevation unavailable', retryElevation: 'Retry',
  elevationProfile: 'Elevation', averageGrade: 'Average grade',
  hasPhotos: 'Has photos', photoViewer: 'Photo viewer', photoCount: '{{current}} / {{total}}', close: 'Close', sharePhoto: 'Share to social media', sharingPhoto: 'Preparing…', sharePhotoFailed: 'Could not open the photo sharing sheet',
  takePhoto: 'Take photo', takingPhoto: 'Processing photo…', photoSaved: 'Photo saved with its location', photoCaptureFailed: 'Could not save the photo', photoTooLarge: 'Photos must be 20 MB or smaller. A long edge of 1600–2400 px and 1–3 MB is recommended.', cameraPermissionRequired: 'Allow camera access to take photos', openPhotoAtLocation: 'Open the photo taken here',
  actualTrack: 'Actual', offRoute: 'Off route', offRouteWarningTitle: 'You are off the route', offRouteWarningBody: 'Return to the blue planned route',
}

const dictionaries = { ja, en }

export function translate(language: AppLanguage, key: TranslationKey, replacements: Replacements = {}) {
  return Object.entries(replacements).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), dictionaries[language][key] as string)
}

type I18nValue = { language: AppLanguage; locale: string; t: TFunction; toggleLanguage: () => void }
const I18nContext = createContext<I18nValue | null>(null)

function deviceLanguage(): AppLanguage {
  try { return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('ja') ? 'ja' : 'en' } catch { return 'ja' }
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<AppLanguage>(deviceLanguage)
  useEffect(() => { Storage.getItem(LANGUAGE_KEY).then((stored) => { if (stored === 'ja' || stored === 'en') setLanguage(stored) }) }, [])
  const toggleLanguage = useCallback(() => setLanguage((current) => {
    const next = current === 'ja' ? 'en' : 'ja'
    void Storage.setItem(LANGUAGE_KEY, next)
    return next
  }), [])
  const value = useMemo<I18nValue>(() => ({ language, locale: language === 'ja' ? 'ja-JP' : 'en-US', t: (key, replacements) => translate(language, key, replacements), toggleLanguage }), [language, toggleLanguage])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = use(I18nContext)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}
