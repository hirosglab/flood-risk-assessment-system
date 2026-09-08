# 狭山市（xx地区）リアルタイム水害リスク判定システム 基本設計書

## 1. システム概要・目的

本システムは、埼玉県狭山市xx地区を中心とした地域を対象に、**「外水氾濫（入間川の水位上昇・上流の降雨）」**および**「内水氾濫（短時間激しい降雨・都市下水道処理能力超過）」**を複合的にリアルタイム評価し、住民およびシステム利用者へ即時警告メッセージを提供する防災支援システムである。

---

## 2. アーキテクチャ構成図

### データフロー & モジュール構成図

      +-------------------------------------------------------------+
      |                      外部データソース                        |
      +-------------------------------------------------------------+
        | 国土交通省 API                  | 気象庁 AMeDAS (JSON API)
        v                                 v
      +-------------------------------------------------------------+
      | [Data Ingestion Component] (src/ingestion/)                 |
      |  - River Water Level Fetcher (riverApiClient.ts)            |
      |  - Weather Data Fetcher (weatherApiClient.ts)              |
      |    (狭山観測所: 43241 / 飯能観測所: 43226)                  |
      +-------------------------------------------------------------+
        |                                 |
        +----------------+                |
                         |                |
                         v                v
      +-------------------------------------------------------------+
      | [GIS Hazard Context Component] (src/gis/)                   |
      |  - Static Home Hazard Provider (hazardAnalyzer.ts)          |
      |    (xx地区 固有ハザード定数: H = 2.5)               |
      +-------------------------------------------------------------+
                         |
                         v
      +-------------------------------------------------------------+
      | [Risk Evaluation Engine Component] (src/engine/)            |
      |  - Sudden Rain Risk Evaluator (内水計算: Score = I * H)     |
      |  - Comprehensive Risk Evaluator (外水・内水・上流統合判定)    |
      |    (riskEvaluator.ts)                                        |
      +-------------------------------------------------------------+
                         |
                         v
      +-------------------------------------------------------------+
      | [Output / Alert Interface] (src/index.ts)                   |
      |  - Console Output & Risk Alert Model (レベル1〜4出力)        |
      +-------------------------------------------------------------+

---

## 3. モジュール・ファンクション設計

### 3.1 データ取得モジュール (`Ingestion Module`)

#### `fetchShinfujimiWaterLevel(): Promise<WaterLevelObservation null |>`
- **概要:** 国土交通省「川の防災情報」Web APIより、新富士見橋観測所（obsCd: 108, ofcCd: 2817）のリアルタイム水位(m)を取得する（※現在モック化対応）。
- **入力:** なし
- **出力:** `WaterLevelObservation`（観測時刻、水位数値）

#### `fetchWeatherData(): Promise<JmaWeatherData>`
- **概要:** 気象庁の公開JSONエンドポイントより最新の観測時刻テキスト（`latest_time.txt`）を取得し、狭山観測所（`43241`）の10分/1時間雨量、および飯能観測所（`43226`）の3時間累計雨量を動的に自動取得・抽出する。
- **入力:** なし
- **出力:** `JmaWeatherData` (`sayama10minRain`, `sayamaHourlyRain`, `hannoCumulativeRain`, `hasLinearRainband`)

---

### 3.2 空間・ハザードモジュール (`GIS Module`)

#### `getHomeHazardContext(): HazardContext`
- **概要:** 自宅（狭山市xx地区）に最適化された不動の地理的定数（宅地盛土高度、実績浸水深、地形ハザード重み）を取得する。固定地点向け管理システムのため、動的なGPS座標照合処理を廃止し定数参照へ簡略化。
- **入力:** なし
- **出力:** `HazardContext` (`isInside: true`, `areaName`, `minDepth: 0.1`, `maxDepth: 0.5`, `hazardWeight: 2.5`)

---

### 3.3 リスク評価エンジン (`Risk Engine Module`)

#### `calculateSuddenRainRisk(data: SuddenRainData): RiskResult`
- **概要:** 突発的豪雨（内水氾濫）の短期リスクを計算する。
- **計算式:** スコア $(R) =$ 短時間降雨強度係数 $(I) \times$ 地形・ハザード重み $(H)$
- **ルール:**
  - Effective Rain: $\max(\text{60分雨量}, \text{10分雨量} \times 6)$
  - 降雨強度係数 ($I$):
    - $\ge 80\text{mm/h} \Rightarrow 8.0$ （H28台風9号級・猛烈な大雨）
    - $\ge 50\text{mm/h} \Rightarrow 4.0$ （下水道排水能力限界・激しい雨）
    - $\ge 30\text{mm/h} \Rightarrow 2.0$ （2019年等で確認された内水注意レベル）
    - $< 30\text{mm/h} \Rightarrow 1.0$
  - ハザード重み ($H$):
    - 鵜の木4-41地区（段丘下低地・内水脆弱性） $\Rightarrow 2.5$

#### `evaluateUnoki4_41_Risk(data: EnvironmentalData): RiskAlert`
- **概要:** 外水（入間川水位）、内水（狭山雨量）、上流降雨（飯能雨量）、線状降水帯フラグを統合評価し、警戒レベル（レベル1〜4）を決定する。
- **判定条件:**
  - **レベル4:** 新富士見橋水位 $\ge 49.69\text{m}$ OR 狭山雨量 $\ge 80\text{mm/h}$ OR (線状降水帯 AND 狭山雨量 $\ge 50\text{mm/h}$) OR 内水スコア $\ge 10.0$
  - **レベル3:** 新富士見橋水位 $\ge 48.40\text{m}$ OR 狭山雨量 $\ge 50\text{mm/h}$ OR 飯能累計雨量 $\ge 150\text{mm}$ OR 内水スコア $\ge 5.0$
  - **レベル2:** 狭山雨量 $\ge 30\text{mm/h}$ OR 飯能累計雨量 $\ge 80\text{mm}$ OR 内水スコア $\ge 2.0$
  - **レベル1:** 上記以外（平常）

---

## 4. データソース仕様（気象庁 AMeDAS JSON）

### 4.1 採用データソース
- **名称:** 気象庁 防災情報 WEB表示用 AMeDAS リアルタイムJSONデータ
- **観測所:**
  - 狭山観測所（観測所コード: `43241`）- 近隣雨量の即時監視
  - 飯能観測所（観測所コード: `43226`）- 入間川上流山間部の豪雨監視

### 4.2 選定理由
1. **信頼性と即時性:** 気象庁の地域気象観測システム（アメダス）公式データであり、10分ごとに高精度な観測値が自動更新されるため。
2. **導入・運用コストの軽さ:** APIキーの取得手続きや認証トークン更新処理が不要で、HTTP GETによる直接取得が可能なため。
3. **データ軽量性:** JSON形式で提供され、TypeScript/JavaScriptによる解析・処理が極めて容易であるため。

### 4.3 取り込みフォーマット（データ構造）
本システムでは、以下の2段階のエンドポイントを連動させて取り込みを行っている。

1. **時刻案内インデックス:**
   - **URL:** `[https://www.jma.go.jp/bosai/amedas/data/latest_time.txt](https://www.jma.go.jp/bosai/amedas/data/latest_time.txt)`
   - **形式:** プレーンテキスト（ISO 8601形式文字列: `YYYY-MM-DDTHH:mm:ss+09:00`）
2. **観測データ本体:**
   - **URL:** `[https://www.jma.go.jp/bosai/amedas/data/map/](https://www.jma.go.jp/bosai/amedas/data/map/){YYYYMMDDHHMM00}.json`
   - **形式:** JSON Key-Value 形式（観測所コードをキーとするオブジェクト）
   - **データ構造概念図:**
     {
       "43241": {
         "precipitation10m": [6.0, 0],  // [10分間雨量(mm), 品質情報]
         "precipitation60m": [0.0, 0]   // [1時間雨量(mm), 品質情報]
       },
       "43226": {
         "precipitation3h": [0.0, 0]    // [3時間累計雨量(mm), 品質情報]
       }
     }

---

## 5. データ構造定義 (Interfaces / Schemas)

// 1. 環境・観測データ
export interface EnvironmentalData {
  sayamaHourlyRain: number;      // 狭山市 1時間雨量 (mm/h)
  sayama10minRain: number;       // 狭山市 10分間雨量 (mm)
  hannoCumulativeRain: number;   // 飯能市山間部 3時間累計雨量 (mm)
  shinfujimiWaterLevel: number;  // 新富士見橋 水位 (m)
  hasLinearRainband: boolean;    // 線状降水帯フラグ
}

// 2. 気象庁アメダスデータモデル
export interface JmaWeatherData {
  sayama10minRain: number;
  sayamaHourlyRain: number;
  hannoCumulativeRain: number;
  hasLinearRainband: boolean;
}

// 3. GIS・ハザードコンテキスト
export interface HazardContext {
  isInside: boolean;
  areaName: string;
  minDepth: number;
  maxDepth: number;
  hazardWeight: number; // 鵜の木4-41は2.5で固定
}

// 4. 内水計算入力・出力データ
export interface SuddenRainData {
  rain10minMm: number;
  rain60minMm: number;
  hazardLevelDepth: number;
}

export interface RiskResult {
  score: number;
  level: number;
  status: string;
  detail: string;
}

// 5. 総合評価判定結果
export interface RiskAlert {
  level: 1 | 2 | 3 | 4;
  title: string;
  message: string;
  timestamp: string;
}

---

## 6. 定数・水防基準値リファレンス

本システムで判定基準として使用する主要な閾値一覧です。

| 項目 | 観測/指標名 | 基準値 | システム上の扱い・対応 |
| :--- | :--- | :--- | :--- |
| **外水** | 平常水位 | 約 46.0m | レベル1 (平常) |
| **外水** | 水防団待機水位 | 48.40m | **レベル3警報トリガー** |
| **外水** | 氾濫危険水位 | 49.69m | **レベル4警報トリガー** |
| **内水** | 下水道安全排水限界 | 30.0mm/h | レベル2注意喚起 |
| **内水** | 下水道処理能力超過 | 50.0mm/h | **レベル3警報トリガー** |
| **内水** | 過去最大級激しい短時間豪雨| 80.0mm/h〜 | **レベル4警報トリガー** (H28台風9号等) |
| **上流** | 飯能市山間部 3時間雨量 | 150.0mm | **レベル3警報トリガー** (遅れて増水量予測) |