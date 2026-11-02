// 由 scripts/cutout_layers.py 生成，勿手改。
// 每一栏 = 一串（或几串挨在一起）紫藤，各自绕自己顶边中点转，形成一道风推过去的波。
// left / width 是相对取景框的百分比；imgLeft / imgWidth 是栏内大图相对本栏宽度的百分比。
export interface WisteriaStrand {
  left: number;
  width: number;
  imgLeft: number;
  imgWidth: number;
  amp: number;
  dur: number;
  delay: number;
}

export const WISTERIA_STRANDS: WisteriaStrand[] = [
  { left: 0.0, width: 5.3779, imgLeft: -0.0, imgWidth: 1859.4595, amp: 1.906, dur: 6.02, delay: -0.0 },
  { left: 4.6512, width: 4.2878, imgLeft: -108.4746, imgWidth: 2332.2034, amp: 2.15, dur: 5.779, delay: -0.17 },
  { left: 8.2122, width: 6.1047, imgLeft: -134.5238, imgWidth: 1638.0952, amp: 1.935, dur: 5.402, delay: -0.34 },
  { left: 13.5901, width: 6.25, imgLeft: -217.4419, imgWidth: 1600.0, amp: 1.508, dur: 5.073, delay: -0.51 },
  { left: 19.1134, width: 6.1773, imgLeft: -309.4118, imgWidth: 1618.8235, amp: 1.359, dur: 4.95, delay: -0.68 },
  { left: 24.564, width: 4.8692, imgLeft: -504.4776, imgWidth: 2053.7313, amp: 1.658, dur: 5.093, delay: -0.85 },
  { left: 28.7064, width: 6.468, imgLeft: -443.8202, imgWidth: 1546.0674, amp: 2.063, dur: 5.432, delay: -1.02 },
  { left: 34.4477, width: 5.8866, imgLeft: -585.1852, imgWidth: 1698.7654, amp: 2.109, dur: 5.805, delay: -1.19 },
  { left: 39.6076, width: 6.9767, imgLeft: -567.7083, imgWidth: 1433.3333, amp: 1.744, dur: 6.029, delay: -1.36 },
  { left: 45.8576, width: 8.2849, imgLeft: -553.5088, imgWidth: 1207.0175, amp: 1.386, dur: 5.999, delay: -1.53 },
  { left: 53.4157, width: 4.6512, imgLeft: -1148.4375, imgWidth: 2150.0, amp: 1.445, dur: 5.727, delay: -1.7 },
  { left: 57.3401, width: 5.4506, imgLeft: -1052.0, imgWidth: 1834.6667, amp: 1.854, dur: 5.345, delay: -1.87 },
  { left: 62.064, width: 7.5581, imgLeft: -821.1538, imgWidth: 1323.0769, amp: 2.144, dur: 5.039, delay: -2.04 },
  { left: 68.8953, width: 6.3953, imgLeft: -1077.2727, imgWidth: 1563.6364, amp: 1.982, dur: 4.955, delay: -2.21 },
  { left: 74.564, width: 4.9419, imgLeft: -1508.8235, imgWidth: 2023.5294, amp: 1.554, dur: 5.135, delay: -2.38 },
  { left: 78.7791, width: 7.4855, imgLeft: -1052.4272, imgWidth: 1335.9223, amp: 1.351, dur: 5.491, delay: -2.55 },
  { left: 85.5378, width: 8.1395, imgLeft: -1050.8929, imgWidth: 1228.5714, amp: 1.606, dur: 5.852, delay: -2.72 },
  { left: 92.9506, width: 3.9971, imgLeft: -2325.4545, imgWidth: 2501.8182, amp: 2.026, dur: 6.042, delay: -2.89 },
  { left: 96.2209, width: 3.7791, imgLeft: -2546.1538, imgWidth: 2646.1538, amp: 2.13, dur: 5.971, delay: -3.06 },
];
