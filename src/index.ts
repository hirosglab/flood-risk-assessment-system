// src/index.ts
import { fetchShinfujimiWaterLevel } from './ingestion/riverApiClient';
import { fetchWeatherData } from './ingestion/weatherApiClient';
import { evaluateUnoki4_41_Risk } from './engine/riskEvaluator';
import { EnvironmentalData } from './types';

async function runAssessmentSystem() {
  console.log('====================================================');
  console.log(' 狭山市 鵜の木4-41地区 リアルタイム水害リスク判定 ');
  console.log('====================================================\n');

  // 1. 各種データのリアルタイム・自動取得
  console.log('[情報取得] 気象庁アメダスおよび河川水位データを取得中...');
  const weatherData = await fetchWeatherData();
  const waterLevelObs = await fetchShinfujimiWaterLevel();

  const currentWaterLevel = waterLevelObs ? waterLevelObs.stage : 46.10;

  // 2. 評価用データの統合
  const currentEnvironment: EnvironmentalData = {
    sayamaHourlyRain: weatherData.sayamaHourlyRain,
    sayama10minRain: weatherData.sayama10minRain,
    hannoCumulativeRain: weatherData.hannoCumulativeRain,
    shinfujimiWaterLevel: currentWaterLevel,
    hasLinearRainband: weatherData.hasLinearRainband
  };

  // 3. リスクの自動判定
  const alertResult = evaluateUnoki4_41_Risk(currentEnvironment);

  // 4. 判定結果の出力
  console.log(`\n[観測時刻]: ${alertResult.timestamp}`);
  console.log(`[アメダス狭山] 10分雨量: ${weatherData.sayama10minRain} mm / 1時間雨量: ${weatherData.sayamaHourlyRain} mm`);
  console.log(`[アメダス飯能] 3時間雨量: ${weatherData.hannoCumulativeRain} mm`);
  console.log(`[新富士見橋水位]: ${currentWaterLevel.toFixed(2)} m`);
  console.log(`----------------------------------------------------`);
  console.log(`[判定結果]: ${alertResult.title}`);
  console.log(`[詳細情報]: ${alertResult.message}`);
  console.log('====================================================\n');
}

// システム実行
runAssessmentSystem();