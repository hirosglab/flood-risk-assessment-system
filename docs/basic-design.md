# 狭山市（xx地区）リアルタイム水害リスク判定システム 基本設計書

## 1. システム概要・目的

本システムは、埼玉県狭山市xx地区を中心とした地域を対象に、**「外水氾濫（入間川の水位上昇・上流の降雨）」**および**「内水氾濫（短時間激しい降雨・都市下水道処理能力超過）」**を複合的にリアルタイム評価し、住民およびシステム利用者へ即時警告メッセージを提供する防災支援システムである。

---

## 2. アーキテクチャ構成図

### データフロー & モジュール構成図

      +-------------------------------------------------------------+
      |                       外部データソース                         |
      +-------------------------------------------------------------+
        | 国土交通省 API                  | 気象庁/民間気象API (将来拡張)
        v                                 v
      +-------------------------------------------------------------+
      | [Data Ingestion Component]                                  |
      |  - River Water Level Fetcher (新富士見橋)                    |
      |  - Weather Data Fetcher (狭山雨量・飯能雨量・線状降水帯)       |
      +-------------------------------------------------------------+
        |                                 |
        +----------------+                |
                         |                |
                         v                v
      +-------------------------------------------------------------+
      | [GIS Location Analyzer Component]                           |
      |  - GeoJSON Spatial Evaluator (Turf.js)                       |
      |  - Area Hazard Weight Extractor                              |
      |    (GIS/GeoJSON Data: unoki_4_41.json)                     |
      +-------------------------------------------------------------+
                         |
                         v
      +-------------------------------------------------------------+
      | [Risk Evaluation Engine Component]                          |
      |  - Sudden Rain Risk Evaluator (内水計算: Score = I * H)     |
      |  - Comprehensive Risk Evaluator (外水・内水・上流統合判定)    |
      +-------------------------------------------------------------+
                         |
                         v
      +-------------------------------------------------------------+
      | [Output / Alert Interface]                                  |
      |  - Risk Alert Model (レベル1〜4メッセージ出力)               |
      +-------------------------------------------------------------+

---

## 3. モジュール・ファンクション設計

### 3.1 データ取得モジュール (`Ingestion Module`)

#### `fetchShinfujimiWaterLevel(): Promise<WaterLevelObservation null |>`
- **概要:** 国土交通省「川の防災情報」Web APIより、新富士見橋観測所（obsCd: 108, ofcCd: 2817）のリアルタイム水位(m)を取得する。
- **入力:** なし
- **出力:** `WaterLevelObservation`（観測時刻、水位数値）

#### `fetchWeatherData(): Promise<WeatherData>` *(インターフェース定義)*
- **概要:** 狭山市の1時間/10分間雨量、飯能市山間部の3時間累計雨量、線状降水帯発生フラグを取得する。

---

### 3.2 空間解析モジュール (`GIS Module`)

#### `evaluateLocationHazard(userLocation: GeoPoint): HazardContext`
- **概要:** ユーザーのGPS座標(`[経度, 緯度]`)と管理対象のGeoJSONポリゴン群を `Turf.js` の `booleanPointInPolygon` で空間照合し、対象エリア内か否かの判定および地形重み係数($H$)を出力する。
- **入力:** `userLocation` (`{ latitude: number, longitude: number }`)
- **出力:** `HazardContext` (`isInside: boolean`, `hazardLevelDepth: number`, `hazardWeight: number`, `areaProperties: object`)

---

### 3.3 リスク評価エンジン (`Risk Engine Module`)

#### `calculateSuddenRainRisk(data: SuddenRainData): RiskResult`
- **概要:** 突発的豪雨（内水氾濫）の短期リスクを計算する。
- **計算式:** $\text{スコア } (R) = \text{短時間降雨強度係数 } (I) \times \text{地形・ハザード重み } (H)$
- **ルール:**
  - Effective Rain: $\max(\text{60分雨量}, \text{10分雨量} \times 6)$
  - 降雨強度係数 ($I$):
    - $\ge 80\text{mm/h} \Rightarrow 8.0$ （H28台風9号級）
    - $\ge 50\text{mm/h} \Rightarrow 4.0$ （下水道排水能力限界）
    - $\ge 30\text{mm/h} \Rightarrow 2.0$ （側溝溢水注意）
    - $< 30\text{mm/h} \Rightarrow 1.0$
  - ハザード重み ($H$):
    - 浸水想定 $\ge 0.5\text{m} \Rightarrow 2.5$ （鵜の木4-41等）
    - 浸水想定 $> 0\text{m} \Rightarrow 1.5$
    - ハザードなし $\Rightarrow 1.0$

#### `evaluateUnoki4_41_Risk(data: EnvironmentalData): RiskAlert`
- **概要:** 外水（入間川水位）、内水（狭山雨量）、上流降雨（飯能雨量）、線状降水帯フラグを統合評価し、警戒レベル（レベル1〜4）を決定する。
- **判定条件:**
  - **レベル4:** 新富士見橋水位 $\ge 49.69\text{m}$ OR 狭山雨量 $\ge 80\text{mm/h}$ OR (線状降水帯 AND 狭山雨量 $\ge 50\text{mm/h}$) OR 内水スコア $\ge 10.0$
  - **レベル3:** 新富士見橋水位 $\ge 48.40\text{m}$ OR 狭山雨量 $\ge 50\text{mm/h}$ OR 飯能累計雨量 $\ge 150\text{mm}$ OR 内水スコア $\ge 5.0$
  - **レベル2:** 狭山雨量 $\ge 30\text{mm/h}$ OR 飯能累計雨量 $\ge 80\text{mm}$ OR 内水スコア $\ge 2.0$
  - **レベル1:** 上記以外（平常）

---

## 4. データ構造定義 (Interfaces / Schemas)

```typescript
// 1. 環境・観測データ
export interface EnvironmentalData {
  sayamaHourlyRain: number;      // 狭山市 1時間雨量 (mm/h)
  sayama10minRain: number;       // 狭山市 10分間雨量 (mm)
  hannoCumulativeRain: number;   // 飯能市山間部 3時間累計雨量 (mm)
  shinfujimiWaterLevel: number;  // 新富士見橋 水位 (m)
  hasLinearRainband: boolean;    // 線状降水帯フラグ
}

// 2. GIS・ハザードコンテキスト
export interface GeoPoint {
  longitude: number; // 経度
  latitude: number;  // 緯度
}

export interface HazardContext {
  isInside: boolean;
  areaName: string;
  minDepth: number;
  maxDepth: number;
  hazardWeight: number; // 例: 鵜の木4-41は2.5
}

// 3. 内水計算入力・出力データ
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

// 4. 総合評価判定結果
export interface RiskAlert {
  level: 1 | 2 | 3 | 4;
  title: string;
  message: string;
  timestamp: string;
}

## 5. 定数・水防基準値リファレンス

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
