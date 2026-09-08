// src/index.ts
import { fetchShinfujimiWaterLevel } from './ingestion/riverApiClient';
import { evaluateUnoki4_41_Risk } from './engine/riskEvaluator';
import { EnvironmentalData } from './types';

async function runAssessmentSystem() {
  console.log('====================================================');
  console.log(' 狭山市 鵜の木4-41地区 リアルタイム水害リスク判定 ');
  console.log('====================================================\n');

  // 1. 水位データの取得（現在はモック）
  const waterLevelObs = await fetchShinfujimiWaterLevel();
  const currentWaterLevel = waterLevelObs ? waterLevelObs.stage : 46.10;

  // 2. 現在の環境データを設定 (テスト用ダミー値)
  const currentEnvironment: EnvironmentalData = {
    sayamaHourlyRain: 12.0,          // 狭山雨量
    sayama10minRain: 3.5,            // 狭山10分雨量
    hannoCumulativeRain: 45.0,       // 飯能累計雨量
    shinfujimiWaterLevel: currentWaterLevel, // 新富士見橋水位
    hasLinearRainband: false         // 線状降水帯フラグ
  };

  // 3. 総合リスクの評価
  const alertResult = evaluateUnoki4_41_Risk(currentEnvironment);

  // 4. 結果の出力
  console.log(`[観測時刻]: ${alertResult.timestamp}`);
  console.log(`[新富士見橋水位]: ${currentWaterLevel.toFixed(2)} m`);
  console.log(`[判定結果]: ${alertResult.title}`);
  console.log(`[詳細情報]: ${alertResult.message}`);
  console.log('\n====================================================');
}

// システム実行
runAssessmentSystem();