import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const chartOptions = {
  layout: {
    background: { color: 'transparent' },
    textColor: 'rgba(255,255,255,0.75)'
  },
  grid: {
    vertLines: { color: 'rgba(255,255,255,0.04)' },
    horzLines: { color: 'rgba(255,255,255,0.04)' }
  },
  autoSize: true,
  crosshair: {
    mode: 1
  },
  priceScale: {
    borderColor: 'rgba(255,255,255,0.12)'
  },
  timeScale: {
    borderColor: 'rgba(255,255,255,0.12)',
    timeVisible: true,
    secondsVisible: false
  }
};

function CandlestickChart({ data, theme = 'dark' }) {
  const containerRef = useRef(null);
  const seriesRef = useRef(null);
  const resizeObserverRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = createChart(containerRef.current, {
      ...chartOptions,
      layout: {
        ...chartOptions.layout,
        background: { color: 'transparent' },
        textColor: theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(15,15,15,0.9)'
      }
    });

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e'
    });

    series.setData(data);
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    resizeObserverRef.current = resizeObserver;

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length) {
      seriesRef.current.setData(data);
    }
  }, [data]);

  return <div ref={containerRef} className="h-72 w-full" />;
}

export default CandlestickChart;
