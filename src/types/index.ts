/**
 * 国土交通省APIからのレスポンスデータ構造
 */
export interface RawRiverApiResponse {
  obsName?: string;
  stageList?: Array<{
    obsTime: string; // 例: "2026/09/06 21:00"
    stage: string;   // 例: "46.12"
  }>;
}

/**
 * システム内部で取り扱う水位観測データ構造
 */
export interface WaterLevelObservation {
  obsTime: string;      // 観測時刻
  stage: number | null; // 水位 (m)
  stationName: string;  // 観測所名
}