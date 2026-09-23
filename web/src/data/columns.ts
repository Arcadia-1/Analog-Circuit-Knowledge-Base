import type { Illustration } from './illustrations';

/** Paid courses published on other sites, listed in their own section below the free lessons on the home page. */
export interface Column {
  href: string;
  site: string;
  title: string;
  summary: string;
  chapters: number;
  /** Part titles in course order. */
  parts: string[];
  thumb: Illustration['thumb'];
}

export const columns: Column[] = [
  {
    href: 'https://icdesign.com/zhuanlans/51',
    site: 'icdesign.com',
    title: 'SAR ADC：模拟与数字的桥梁',
    summary:
      '混合信号集成电路设计工程师之旅，从 SAR ADC 开始：ADC 基本原理、设计指标与频谱仿真；4 比特理想模型；电容阵列与切换、异步 SAR 逻辑、动态比较器与 Bootstrap 开关的理论与实践；再到冗余、顶/底板采样、PVT 与亚稳态等实际设计问题。',
    chapters: 34,
    parts: ['初识 ADC', '4 比特模型', '模块电路设计', '指标拆解与升级方案', '模拟信号链'],
    thumb: 'sar',
  },
];
