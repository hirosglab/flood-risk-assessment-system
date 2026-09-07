// src/ingestion/riverApiClient.ts (モック版)
import { WaterLevelObservation } from '../types';

export async function fetchShinfujimiWaterLevel(): Promise<WaterLevelObservation | null> {
  // 開発用モックデータを返却
  return {
    obsTime: new Date().toLocaleString('ja-JP'),
    stage: 46.10, // 平常時の水位 (m)
    stationName: '新富士見橋 (Mock)'
  };
}