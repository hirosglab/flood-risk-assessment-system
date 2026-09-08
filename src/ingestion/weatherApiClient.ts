// src/ingestion/weatherApiClient.ts
import axios from 'axios';

// 気象庁アメダス観測所コード
const SAYAMA_STATION = '43241'; // 狭山
const HANNO_STATION = '43226';  // 飯能

export interface JmaWeatherData {
  sayama10minRain: number;
  sayamaHourlyRain: number;
  hannoCumulativeRain: number;
  hasLinearRainband: boolean;
}

/**
 * 気象庁から最新の観測時刻文字列 (YYYYMMDDHHMM00) を取得する
 */
async function fetchLatestTimeStr(): Promise<string> {
  const url = 'https://www.jma.go.jp/bosai/amedas/data/latest_time.txt';
  const response = await axios.get<string>(url, { timeout: 5000 });
  
  // 返却例: "2026-09-08T20:00:00+09:00" -> "20260908200000" に変換
  const isoStr = response.data.trim();
  const dateObj = new Date(isoStr);

  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mi = String(dateObj.getMinutes()).padStart(2, '0');

  return `${yyyy}${mm}${dd}${hh}${mi}00`;
}

/**
 * 気象庁アメダスJSONデータから狭山・飯能の雨量を取得する
 */
export async function fetchWeatherData(): Promise<JmaWeatherData> {
  try {
    // 1. 最新の観測時刻を取得
    const timeStr = await fetchLatestTimeStr();
    const url = `https://www.jma.go.jp/bosai/amedas/data/map/${timeStr}.json`;

    // 2. 該当時刻のアメダス全地点データを取得
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;

    const sayamaData = data[SAYAMA_STATION];
    const hannoData = data[HANNO_STATION];

    // 狭山: 10分雨量 (配列のインデックス0が数値)
    const sayama10min = sayamaData?.precipitation10m?.[0] ?? 0;
    // 狭山: 1時間雨量 (配列のインデックス0が数値)
    const sayama60min = sayamaData?.precipitation60m?.[0] ?? 0;
    // 飯能: 3時間雨量
    const hanno3h = hannoData?.precipitation3h?.[0] ?? 0;

    return {
      sayama10minRain: sayama10min,
      sayamaHourlyRain: sayama60min,
      hannoCumulativeRain: hanno3h,
      hasLinearRainband: false
    };
  } catch (error) {
    console.warn('[WeatherAPI Warning] アメダスデータの取得に失敗しました。デフォルト値を使用します。');
    return {
      sayama10minRain: 0,
      sayamaHourlyRain: 0,
      hannoCumulativeRain: 0,
      hasLinearRainband: false
    };
  }
}

// --- 単体テスト ---
if (require.main === module) {
  (async () => {
    console.log('=== 気象庁アメダスデータ自動取得テスト ===');
    const weather = await fetchWeatherData();
    console.log(weather);
  })();
}