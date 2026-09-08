// src/engine/riskEvaluator.ts
import { EnvironmentalData, RiskAlert, SuddenRainData, RiskResult } from '../types';
import { getHomeHazardContext } from '../gis/hazardAnalyzer';

/**
 * 1. 内水氾濫（突発的豪雨）リスクの短時間計算
 */
export function calculateSuddenRainRisk(data: SuddenRainData): RiskResult {
  const hazardContext = getHomeHazardContext();

  // 実効雨量 (1時間雨量と、10分間雨量を6倍換算したものの大きい方をとる)
  const effectiveRain = Math.max(data.rain60minMm, data.rain10minMm * 6);

  // 降雨強度係数 (I) の決定
  let rainIntensityFactor = 1.0;
  if (effectiveRain >= 80) {
    rainIntensityFactor = 8.0; // 猛烈な大雨
  } else if (effectiveRain >= 50) {
    rainIntensityFactor = 4.0; // 下水道能力超過
  } else if (effectiveRain >= 30) {
    rainIntensityFactor = 2.0; // 2019年等で確認された内水注意レベル
  }

  // スコア計算 = 降雨強度係数 (I) × 地形ハザード重み (H)
  const score = rainIntensityFactor * hazardContext.hazardWeight;

  let level = 1;
  let status = '平常';
  let detail = '短時間強雨による内水氾濫の危険性は低い状態です。';

  if (score >= 10.0) {
    level = 4;
    status = '極めて危険（内水氾濫発生）';
    detail = '道路冠水・排水口溢水が発生している可能性が高いです。不要不急の外出を避けてください。';
  } else if (score >= 5.0) {
    level = 3;
    status = '警戒（道路冠水注意）';
    detail = 'マンホールや側溝からの溢水に注意してください。';
  } else if (score >= 2.0) {
    level = 2;
    status = '注意（降雨強まり）';
    detail = '短時間強雨が観測されています。周囲の排水状況に留意してください。';
  }

  return { score, level, status, detail };
}

/**
 * 2. ご自宅（鵜の木4-41地区）の総合リスク判定（レベル1〜4）
 */
export function evaluateUnoki4_41_Risk(data: EnvironmentalData): RiskAlert {
  const suddenRain = calculateSuddenRainRisk({
    rain10minMm: data.sayama10minRain,
    rain60minMm: data.sayamaHourlyRain,
    hazardLevelDepth: 0.5
  });

  const timestamp = new Date().toLocaleString('ja-JP');

  // 【レベル4：最上級警戒・避難判断】
  if (
    data.shinfujimiWaterLevel >= 49.69 || // 氾濫危険水位
    data.sayamaHourlyRain >= 80 ||        // 猛烈な大雨
    (data.hasLinearRainband && data.sayamaHourlyRain >= 50) || // 線状降水帯 + 激しい雨
    suddenRain.score >= 10.0
  ) {
    return {
      level: 4,
      title: '【緊急】レベル4：氾濫危険・道路冠水発生',
      message: '入間川の氾濫危険または地区内での重度な内水冠水リスクが高まっています。徒歩・車での移動は危険です。必要に応じて安全な場所（2階等）へ退避してください。',
      timestamp
    };
  }

  // 【レベル3：警戒（2019年台風事例クラス）】
  if (
    data.shinfujimiWaterLevel >= 48.40 || // 避難判断水位
    data.sayamaHourlyRain >= 50 ||        // 激しい雨
    data.hannoCumulativeRain >= 150 ||    // 上流での大規模集中豪雨
    suddenRain.score >= 5.0
  ) {
    return {
      level: 3,
      title: '【警戒】レベル3：避難準備・早期行動指示',
      message: '入間川の水位上昇または強い雨により、道路の冠水・マンホール溢水の危険性が高まっています。移動が必要な場合は早めに行動してください。',
      timestamp
    };
  }

  // 【レベル2：注意】
  if (
    data.sayamaHourlyRain >= 30 ||
    data.hannoCumulativeRain >= 80 ||
    suddenRain.score >= 2.0
  ) {
    return {
      level: 2,
      title: '【注意】レベル2：大雨・水位変化注意',
      message: '周囲の雨量が増加しています。今後の気象情報と河川水位の変化に十分留意してください。',
      timestamp
    };
  }

  // 【レベル1：平常】
  return {
    level: 1,
    title: '【平常】レベル1：正常範囲内',
    message: '現在、特筆すべき水害リスクは検出されていません。',
    timestamp
  };
}

// --- 単体テスト実行 ---
if (require.main === module) {
  // テストケース1: 平常時
  const normalData: EnvironmentalData = {
    sayamaHourlyRain: 5,
    sayama10minRain: 1,
    hannoCumulativeRain: 20,
    shinfujimiWaterLevel: 46.10,
    hasLinearRainband: false
  };

  // テストケース2: 2019年台風19号級（内水警戒＋上流豪雨）
  const typhoon2019Data: EnvironmentalData = {
    sayamaHourlyRain: 40,
    sayama10minRain: 8,
    hannoCumulativeRain: 160,
    shinfujimiWaterLevel: 48.50,
    hasLinearRainband: false
  };

  console.log('=== リスク評価エンジン テスト結果 ===');
  console.log('【平常時】:', evaluateUnoki4_41_Risk(normalData));
  console.log('-----------------------------------');
  console.log('【2019年台風クラス】:', evaluateUnoki4_41_Risk(typhoon2019Data));
}