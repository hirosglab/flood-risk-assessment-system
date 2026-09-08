// src/gis/hazardAnalyzer.ts
import { HazardContext } from '../types';

/**
 * 鵜の木4-41地区（ご自宅）の固定ハザード情報を取得する
 */
export function getHomeHazardContext(): HazardContext {
  return {
    isInside: true,
    areaName: '狭山市鵜の木4-41地区 (ご自宅)',
    minDepth: 0.1,         // 2019年台風実績（10cm〜）
    maxDepth: 0.5,         // 宅地盛土高さ上限（50cm）
    hazardWeight: 2.5      // 段丘下低地・内水脆弱性に基づく重み係数
  };
}

// --- 簡易動作確認 ---
if (require.main === module) {
  const context = getHomeHazardContext();
  console.log('=== ご自宅ハザード定数参照テスト ===');
  console.log(context);
}