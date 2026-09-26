import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import {
  BarChart,
  BoxplotChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  TreemapChart,
} from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption, ECElementEvent } from 'echarts/core';
import { INK, SERIES, SURFACE } from './palette';

echarts.use([
  BarChart,
  BoxplotChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  TreemapChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

const axis = {
  axisLine: { lineStyle: { color: INK.axis } },
  axisTick: { show: false },
  axisLabel: { color: INK.muted, fontSize: 11 },
  splitLine: { lineStyle: { color: INK.grid, width: 1, type: 'solid' } },
  nameTextStyle: { color: INK.muted, fontSize: 11 },
};

echarts.registerTheme('smb', {
  color: SERIES,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    color: INK.secondary,
  },
  categoryAxis: { ...axis, splitLine: { show: false } },
  valueAxis: { ...axis, axisLine: { show: false } },
  timeAxis: axis,
  legend: {
    textStyle: { color: INK.secondary, fontSize: 12 },
    itemWidth: 12,
    itemHeight: 8,
    icon: 'roundRect',
  },
  tooltip: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(11,11,11,0.10)',
    textStyle: { color: INK.primary, fontSize: 12 },
    extraCssText:
      'box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-radius: 8px;',
  },
  line: { symbolSize: 8, lineStyle: { width: 2 }, smooth: false },
  bar: { barMaxWidth: 24, itemStyle: { borderRadius: [4, 4, 0, 0] } },
});

export type ChartClick = ECElementEvent;

export default function EChart({
  option,
  height = 280,
  onClick,
  className,
}: {
  option: EChartsCoreOption;
  height?: number;
  onClick?: (event: ChartClick) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, 'smb');
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onClick) return;
    chart.on('click', onClick);
    return () => {
      chart.off('click', onClick);
    };
  }, [onClick]);

  return (
    <div
      ref={ref}
      style={{ height, background: SURFACE }}
      className={className}
    />
  );
}
