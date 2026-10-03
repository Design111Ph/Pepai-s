import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Calendar,
  Filter,
  Package,
  MapPin,
  RefreshCw,
  Search,
  Download,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { Location, Ingredient, StockMovementRecord } from '../types';
import {
  StockMovementService,
  filterAndAggregateStockMovements,
  DailyStockAggregate,
  StockMovementSummary,
} from '../utils/stockMovements';
import { formatCurrency, formatPHP } from '../utils/currency';
import { exportToCSV } from '../utils/storage';

interface StockMovementChartProps {
  locations: Location[];
  ingredients: Ingredient[];
  selectedLocationId: string;
  onLocationChange?: (locId: string) => void;
  onSendNotification?: (title: string, body: string) => void;
}

type ChartMode = 'diverging' | 'dual_area' | 'cumulative';
type MetricType = 'value' | 'quantity';
type TimeRange = 7 | 14 | 30;

export const StockMovementChart: React.FC<StockMovementChartProps> = ({
  locations,
  ingredients,
  selectedLocationId,
  onLocationChange,
  onSendNotification,
}) => {
  // Chart control states
  const [chartMode, setChartMode] = useState<ChartMode>('diverging');
  const [metricType, setMetricType] = useState<MetricType>('value');
  const [timeRangeDays, setTimeRangeDays] = useState<TimeRange>(14);
  const [localLocationId, setLocalLocationId] = useState<string>(selectedLocationId || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('all');

  // Ledger table search & filter
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerFlowFilter, setLedgerFlowFilter] = useState<'all' | 'inflow' | 'outflow' | 'waste'>('all');

  // Hovered data point for custom interactive tooltip
  const [hoveredData, setHoveredData] = useState<{
    agg: DailyStockAggregate;
    x: number;
    y: number;
  } | null>(null);

  // SVG ref and responsive dimensions
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 380,
  });

  // Keep location in sync with parent prop if it changes
  useEffect(() => {
    setLocalLocationId(selectedLocationId);
  }, [selectedLocationId]);

  // Load stock movements from storage
  const [movements, setMovements] = useState<StockMovementRecord[]>(() =>
    StockMovementService.getMovements()
  );

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    ingredients.forEach((ing) => set.add(ing.category));
    return Array.from(set).sort();
  }, [ingredients]);

  // Filtered ingredients based on category
  const filteredIngredientsList = useMemo(() => {
    if (selectedCategory === 'all') return ingredients;
    return ingredients.filter((i) => i.category === selectedCategory);
  }, [ingredients, selectedCategory]);

  // Compute aggregates & summaries
  const { dailyAggregates, summary, filteredRecords } = useMemo(() => {
    return filterAndAggregateStockMovements(movements, {
      locationId: localLocationId,
      ingredientId: selectedIngredientId,
      category: selectedCategory,
      timeRangeDays,
      locations,
    });
  }, [movements, localLocationId, selectedIngredientId, selectedCategory, timeRangeDays, locations]);

  // Observe container resizing for fluid responsive D3 rendering
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          const height = Math.max(300, Math.min(420, width * 0.42));
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Primary D3 Render Effect
  useEffect(() => {
    if (!svgRef.current || dailyAggregates.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const isMobile = width < 550;
    const margin = {
      top: 25,
      right: isMobile ? 15 : 30,
      bottom: 45,
      left: isMobile ? 48 : 70,
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    // Define unique SVG gradients and drop-shadows
    const defs = svg.append('defs');

    // Inflow Emerald Gradient
    const inflowGrad = defs
      .append('linearGradient')
      .attr('id', 'inflow-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    inflowGrad.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.85);
    inflowGrad.append('stop').attr('offset', '100%').attr('stop-color', '#059669').attr('stop-opacity', 0.15);

    // Outflow Rose Gradient
    const outflowGrad = defs
      .append('linearGradient')
      .attr('id', 'outflow-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    outflowGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.15);
    outflowGrad.append('stop').attr('offset', '100%').attr('stop-color', '#e11d48').attr('stop-opacity', 0.85);

    // Cumulative Blue/Amber Gradient
    const cumulativeGrad = defs
      .append('linearGradient')
      .attr('id', 'cumulative-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    cumulativeGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.6);
    cumulativeGrad.append('stop').attr('offset', '100%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.05);

    // Glow filter for net line
    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'blur');
    filter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale (Band Scale for crisp daily alignment)
    const xScale = d3
      .scaleBand<string>()
      .domain(dailyAggregates.map((d) => d.date))
      .range([0, innerWidth])
      .padding(0.28);

    // Determine values according to metricType
    const getInflow = (d: DailyStockAggregate) => (metricType === 'value' ? d.inflowValue : d.inflowQty);
    const getOutflow = (d: DailyStockAggregate) => (metricType === 'value' ? d.outflowValue : d.outflowQty);
    const getNet = (d: DailyStockAggregate) => (metricType === 'value' ? d.netValue : d.netQty);
    const getCumulative = (d: DailyStockAggregate) =>
      metricType === 'value' ? d.cumulativeNetValue : d.inflowQty - d.outflowQty;

    // Helper for formatting Y-axis ticks
    const formatYTick = (val: number) => {
      if (metricType === 'value') {
        const absVal = Math.abs(val);
        if (absVal >= 1000000) return `${val < 0 ? '-' : ''}₱${(absVal / 1000000).toFixed(1)}M`;
        if (absVal >= 1000) return `${val < 0 ? '-' : ''}₱${Math.round(absVal / 1000)}k`;
        return `${val < 0 ? '-' : ''}₱${Math.round(absVal)}`;
      }
      return `${Math.round(val)}`;
    };

    // Render based on chartMode
    if (chartMode === 'diverging') {
      // Diverging Mode: Inflow above baseline (positive), Outflow below baseline (negative)
      const maxInflow = d3.max(dailyAggregates, getInflow) || 100;
      const maxOutflow = d3.max(dailyAggregates, getOutflow) || 100;
      const yMax = Math.max(maxInflow, maxOutflow) * 1.15;

      const yScale = d3
        .scaleLinear()
        .domain([-yMax, yMax])
        .range([innerHeight, 0])
        .nice();

      const yZero = yScale(0);

      // Horizontal Grid Lines
      const yTicks = yScale.ticks(6);
      g.append('g')
        .attr('class', 'grid')
        .selectAll('line')
        .data(yTicks)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', (d) => (d === 0 ? '#64748b' : '#334155'))
        .attr('stroke-width', (d) => (d === 0 ? 1.5 : 1))
        .attr('stroke-dasharray', (d) => (d === 0 ? 'none' : '3,3'))
        .attr('opacity', 0.35);

      // Inflow Bars (Green / Upward)
      g.selectAll('.inflow-bar')
        .data(dailyAggregates)
        .enter()
        .append('rect')
        .attr('class', 'inflow-bar')
        .attr('x', (d) => xScale(d.date) || 0)
        .attr('width', xScale.bandwidth())
        .attr('y', (d) => yScale(getInflow(d)))
        .attr('height', (d) => Math.max(0, yZero - yScale(getInflow(d))))
        .attr('fill', 'url(#inflow-gradient)')
        .attr('rx', 4)
        .attr('ry', 4);

      // Outflow Bars (Red / Downward)
      g.selectAll('.outflow-bar')
        .data(dailyAggregates)
        .enter()
        .append('rect')
        .attr('class', 'outflow-bar')
        .attr('x', (d) => xScale(d.date) || 0)
        .attr('width', xScale.bandwidth())
        .attr('y', yZero)
        .attr('height', (d) => Math.max(0, yScale(-getOutflow(d)) - yZero))
        .attr('fill', 'url(#outflow-gradient)')
        .attr('rx', 4)
        .attr('ry', 4);

      // Net Line Overlay
      const netLine = d3
        .line<DailyStockAggregate>()
        .x((d) => (xScale(d.date) || 0) + xScale.bandwidth() / 2)
        .y((d) => yScale(getNet(d)))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(dailyAggregates)
        .attr('fill', 'none')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2.5)
        .attr('filter', 'url(#glow)')
        .attr('d', netLine);

      // Net Points
      g.selectAll('.net-point')
        .data(dailyAggregates)
        .enter()
        .append('circle')
        .attr('class', 'net-point')
        .attr('cx', (d) => (xScale(d.date) || 0) + xScale.bandwidth() / 2)
        .attr('cy', (d) => yScale(getNet(d)))
        .attr('r', 4)
        .attr('fill', '#f59e0b')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5);

      // Y Axis
      const yAxis = d3.axisLeft(yScale).ticks(6).tickFormat((d) => formatYTick(d as number));
      g.append('g')
        .attr('class', 'y-axis text-xs font-semibold text-neutral-400')
        .call(yAxis)
        .call((sel) => sel.select('.domain').remove())
        .selectAll('text')
        .attr('fill', '#94a3b8');

    } else if (chartMode === 'dual_area') {
      // Dual Area Mode: Inflow and Outflow overlapping areas on positive scale
      const maxVal = Math.max(
        d3.max(dailyAggregates, getInflow) || 100,
        d3.max(dailyAggregates, getOutflow) || 100
      ) * 1.15;

      const yScale = d3
        .scaleLinear()
        .domain([0, maxVal])
        .range([innerHeight, 0])
        .nice();

      // Grid Lines
      const yTicks = yScale.ticks(6);
      g.append('g')
        .attr('class', 'grid')
        .selectAll('line')
        .data(yTicks)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', '#334155')
        .attr('stroke-dasharray', '3,3')
        .attr('opacity', 0.35);

      // Inflow Area
      const inflowArea = d3
        .area<DailyStockAggregate>()
        .x((d) => (xScale(d.date) || 0) + xScale.bandwidth() / 2)
        .y0(innerHeight)
        .y1((d) => yScale(getInflow(d)))
        .curve(d3.curveMonotoneX);

      const inflowLine = d3
        .line<DailyStockAggregate>()
        .x((d) => (xScale(d.date) || 0) + xScale.bandwidth() / 2)
        .y((d) => yScale(getInflow(d)))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(dailyAggregates)
        .attr('fill', 'url(#inflow-gradient)')
        .attr('opacity', 0.6)
        .attr('d', inflowArea);

      g.append('path')
        .datum(dailyAggregates)
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2.5)
        .attr('d', inflowLine);

      // Outflow Area
      const outflowArea = d3
        .area<DailyStockAggregate>()
        .x((d) => (xScale(d.date) || 0) + xScale.bandwidth() / 2)
        .y0(innerHeight)
        .y1((d) => yScale(getOutflow(d)))
        .curve(d3.curveMonotoneX);

      const outflowLine = d3
        .line<DailyStockAggregate>()
        .x((d) => (xScale(d.date) || 0) + xScale.bandwidth() / 2)
        .y((d) => yScale(getOutflow(d)))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(dailyAggregates)
        .attr('fill', 'url(#outflow-gradient)')
        .attr('opacity', 0.45)
        .attr('d', outflowArea);

      g.append('path')
        .datum(dailyAggregates)
        .attr('fill', 'none')
        .attr('stroke', '#f43f5e')
        .attr('stroke-width', 2.5)
        .attr('d', outflowLine);

      // Points for Inflow and Outflow
      dailyAggregates.forEach((d) => {
        const cx = (xScale(d.date) || 0) + xScale.bandwidth() / 2;
        g.append('circle').attr('cx', cx).attr('cy', yScale(getInflow(d))).attr('r', 3.5).attr('fill', '#10b981');
        g.append('circle').attr('cx', cx).attr('cy', yScale(getOutflow(d))).attr('r', 3.5).attr('fill', '#f43f5e');
      });

      // Y Axis
      const yAxis = d3.axisLeft(yScale).ticks(6).tickFormat((d) => formatYTick(d as number));
      g.append('g')
        .attr('class', 'y-axis text-xs font-semibold text-neutral-400')
        .call(yAxis)
        .call((sel) => sel.select('.domain').remove())
        .selectAll('text')
        .attr('fill', '#94a3b8');

    } else {
      // Cumulative Mode: Net trajectory trendline
      const minCum = d3.min(dailyAggregates, (d) => d.cumulativeNetValue) || 0;
      const maxCum = d3.max(dailyAggregates, (d) => d.cumulativeNetValue) || 100;
      const yPad = Math.abs(maxCum - minCum) * 0.2 || 50;

      const yScale = d3
        .scaleLinear()
        .domain([Math.min(0, minCum - yPad), Math.max(0, maxCum + yPad)])
        .range([innerHeight, 0])
        .nice();

      const yZero = yScale(0);

      // Grid Lines
      const yTicks = yScale.ticks(6);
      g.append('g')
        .attr('class', 'grid')
        .selectAll('line')
        .data(yTicks)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', (d) => (d === 0 ? '#64748b' : '#334155'))
        .attr('stroke-width', (d) => (d === 0 ? 1.5 : 1))
        .attr('stroke-dasharray', (d) => (d === 0 ? 'none' : '3,3'))
        .attr('opacity', 0.35);

      // Cumulative Area
      const cumArea = d3
        .area<DailyStockAggregate>()
        .x((d) => (xScale(d.date) || 0) + xScale.bandwidth() / 2)
        .y0(yZero)
        .y1((d) => yScale(d.cumulativeNetValue))
        .curve(d3.curveMonotoneX);

      const cumLine = d3
        .line<DailyStockAggregate>()
        .x((d) => (xScale(d.date) || 0) + xScale.bandwidth() / 2)
        .y((d) => yScale(d.cumulativeNetValue))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(dailyAggregates)
        .attr('fill', 'url(#cumulative-gradient)')
        .attr('d', cumArea);

      g.append('path')
        .datum(dailyAggregates)
        .attr('fill', 'none')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 3)
        .attr('filter', 'url(#glow)')
        .attr('d', cumLine);

      // Points
      g.selectAll('.cum-point')
        .data(dailyAggregates)
        .enter()
        .append('circle')
        .attr('class', 'cum-point')
        .attr('cx', (d) => (xScale(d.date) || 0) + xScale.bandwidth() / 2)
        .attr('cy', (d) => yScale(d.cumulativeNetValue))
        .attr('r', 4.5)
        .attr('fill', (d) => (d.cumulativeNetValue >= 0 ? '#10b981' : '#f43f5e'))
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2);

      // Y Axis
      const yAxis = d3.axisLeft(yScale).ticks(6).tickFormat((d) => formatYTick(d as number));
      g.append('g')
        .attr('class', 'y-axis text-xs font-semibold text-neutral-400')
        .call(yAxis)
        .call((sel) => sel.select('.domain').remove())
        .selectAll('text')
        .attr('fill', '#94a3b8');
    }

    // X Axis
    const tickInterval = isMobile ? Math.ceil(dailyAggregates.length / 5) : Math.ceil(dailyAggregates.length / 10);
    const visibleDates = dailyAggregates.filter((_, idx) => idx % tickInterval === 0).map((d) => d.date);

    const xAxis = d3
      .axisBottom(xScale)
      .tickValues(visibleDates)
      .tickFormat((dateStr) => {
        const found = dailyAggregates.find((d) => d.date === dateStr);
        return found ? found.formattedDate : (dateStr as string).slice(5);
      });

    g.append('g')
      .attr('class', 'x-axis text-xs font-medium text-neutral-400')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .call((sel) => sel.select('.domain').attr('stroke', '#475569'))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('dy', '1em');

    // Interactive Hover Tracking Group
    const hoverTracking = g.append('g').attr('class', 'hover-tracking').style('display', 'none');
    const crosshair = hoverTracking
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4');

    // Invisible Overlay capturing pointer / touch moves
    g.append('rect')
      .attr('class', 'pointer-overlay')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('pointerenter', () => {
        hoverTracking.style('display', null);
      })
      .on('pointermove', function (event: MouseEvent) {
        const [pointerX] = d3.pointer(event);

        // Find nearest aggregate based on pointerX
        let closestAgg = dailyAggregates[0];
        let closestDist = Infinity;

        dailyAggregates.forEach((d) => {
          const barCenter = (xScale(d.date) || 0) + xScale.bandwidth() / 2;
          const dist = Math.abs(pointerX - barCenter);
          if (dist < closestDist) {
            closestDist = dist;
            closestAgg = d;
          }
        });

        if (closestAgg) {
          const barCenter = (xScale(closestAgg.date) || 0) + xScale.bandwidth() / 2;
          crosshair.attr('x1', barCenter).attr('x2', barCenter);

          // Position tooltip relative to container
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const clientX = margin.left + barCenter;
            setHoveredData({
              agg: closestAgg,
              x: clientX,
              y: margin.top + 20,
            });
          }
        }
      })
      .on('pointerleave', () => {
        hoverTracking.style('display', 'none');
        setHoveredData(null);
      });
  }, [dailyAggregates, dimensions, chartMode, metricType]);

  // Export Stock Movements to CSV
  const handleExportStockMovementCSV = () => {
    const rows = filteredRecords.map((r) => ({
      'Date': r.date,
      'Timestamp': r.timestamp,
      'Location': r.locationName,
      'Flow Type': r.flowLabel,
      'Direction': r.type.toUpperCase(),
      'Ingredient': r.ingredientName,
      'Category': r.category,
      'Quantity': r.quantity,
      'Unit': r.unit,
      'Unit Cost (₱)': r.unitCost.toFixed(2),
      'Total Value (₱)': r.totalValue.toFixed(2),
      'Reference PO / Order': r.reference,
      'Recorded By': r.recordedBy,
      'Notes': r.notes || '',
    }));

    const locLabel = localLocationId === 'all' ? 'all-units' : localLocationId;
    exportToCSV(`pepais-stock-movements-${locLabel}-${timeRangeDays}d`, rows);

    if (onSendNotification) {
      onSendNotification(
        'Stock Movement Export Complete',
        `Exported ${rows.length} ingredient inflow/outflow transactions for ${timeRangeDays} days in Philippine Peso (₱).`
      );
    }
  };

  // Filtered ledger rows for the audit table
  const ledgerRows = useMemo(() => {
    return filteredRecords.filter((r) => {
      if (ledgerFlowFilter === 'inflow' && r.type !== 'inflow') return false;
      if (ledgerFlowFilter === 'outflow' && r.type !== 'outflow') return false;
      if (ledgerFlowFilter === 'waste' && r.flowType !== 'waste_spoilage') return false;

      if (!ledgerSearch.trim()) return true;
      const q = ledgerSearch.toLowerCase();
      return (
        r.ingredientName.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        r.locationName.toLowerCase().includes(q) ||
        r.flowLabel.toLowerCase().includes(q)
      );
    });
  }, [filteredRecords, ledgerSearch, ledgerFlowFilter]);

  return (
    <div className="space-y-6">
      {/* Primary Chart Container Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-5">
        {/* Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <ArrowUpDown className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">
                Stock Movement Dynamics (D3.js)
              </h2>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Visualizing ingredient inflow (deliveries &amp; restocks) vs outflow (kitchen depletion &amp; trim waste) over time per location.
            </p>
          </div>

          {/* Quick Toolbar Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Chart Mode Selector */}
            <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setChartMode('diverging')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  chartMode === 'diverging'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title="Diverging Bi-directional Flow (Inflow above baseline, Outflow below baseline)"
              >
                Mirror Flow
              </button>
              <button
                onClick={() => setChartMode('dual_area')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  chartMode === 'dual_area'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title="Dual Area Stream (Inflow vs Outflow Layered)"
              >
                Dual Area
              </button>
              <button
                onClick={() => setChartMode('cumulative')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  chartMode === 'cumulative'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title="Cumulative Net Inventory Trajectory"
              >
                Net Balance
              </button>
            </div>

            {/* Metric Toggle: ₱ Value vs Volume */}
            <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setMetricType('value')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  metricType === 'value'
                    ? 'bg-amber-500 text-neutral-950 shadow-xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Value (₱)
              </button>
              <button
                onClick={() => setMetricType('quantity')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  metricType === 'quantity'
                    ? 'bg-amber-500 text-neutral-950 shadow-xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Volume (Units)
              </button>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              {([7, 14, 30] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRangeDays(range)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    timeRangeDays === range
                      ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {range}d
                </button>
              ))}
            </div>

            {/* CSV Export Button */}
            <button
              onClick={handleExportStockMovementCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 transition-colors"
              title="Download movements as CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns: Location, Category, Ingredient */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Location Selector */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-amber-500" />
              <span>Location Scope</span>
            </label>
            <select
              value={localLocationId}
              onChange={(e) => {
                setLocalLocationId(e.target.value);
                if (onLocationChange) onLocationChange(e.target.value);
              }}
              className="w-full text-xs font-medium py-2 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Restaurant Units (Consolidated Network)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 mb-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-sky-500" />
              <span>Ingredient Category</span>
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedIngredientId('all'); // Reset specific ingredient
              }}
              className="w-full text-xs font-medium py-2 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Specific Ingredient Filter */}
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 dark:text-neutral-400 mb-1 flex items-center gap-1">
              <Package className="w-3 h-3 text-emerald-500" />
              <span>Focus Ingredient</span>
            </label>
            <select
              value={selectedIngredientId}
              onChange={(e) => setSelectedIngredientId(e.target.value)}
              className="w-full text-xs font-medium py-2 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Ingredients (Aggregated Flow)</option>
              {filteredIngredientsList.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.unit})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block shadow-xs"></span>
              <span className="font-bold text-neutral-700 dark:text-neutral-300">
                Inflow (Deliveries &amp; Restocks)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block shadow-xs"></span>
              <span className="font-bold text-neutral-700 dark:text-neutral-300">
                Outflow (Kitchen Depletion &amp; Waste)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-1 bg-amber-500 rounded-full inline-block"></span>
              <span className="font-bold text-neutral-700 dark:text-neutral-300">
                {chartMode === 'cumulative' ? 'Cumulative Balance' : 'Net Flow Delta'}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400">
            {timeRangeDays}-Day Window • {dailyAggregates.length} Daily Data Points
          </div>
        </div>

        {/* D3 SVG Container with Custom Floating Tooltip */}
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden rounded-xl bg-neutral-50/70 dark:bg-neutral-950/50 border border-neutral-200/80 dark:border-neutral-800 p-2 select-none"
          style={{ minHeight: '320px' }}
        >
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="w-full h-auto overflow-visible"
          />

          {/* Interactive D3 Tooltip */}
          {hoveredData && (
            <div
              className="absolute z-20 pointer-events-none p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 shadow-xl text-xs space-y-2 animate-in fade-in zoom-in-95 duration-100 max-w-xs"
              style={{
                left: `${Math.min(hoveredData.x, dimensions.width - 240)}px`,
                top: `${hoveredData.y}px`,
              }}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-1.5">
                <span className="font-black text-neutral-900 dark:text-white">
                  {hoveredData.agg.formattedDate}, 2026
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    hoveredData.agg.netValue >= 0
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  Net: {hoveredData.agg.netValue >= 0 ? '+' : ''}
                  {formatPHP(hoveredData.agg.netValue, 0, 0)}
                </span>
              </div>

              {/* Inflow Row */}
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Inflow:
                </span>
                <span>
                  {formatPHP(hoveredData.agg.inflowValue, 0, 0)} (
                  {hoveredData.agg.inflowQty.toFixed(1)} units)
                </span>
              </div>
              {hoveredData.agg.topInflows.length > 0 && (
                <div className="pl-4 text-[10px] text-neutral-500 dark:text-neutral-400 space-y-0.5">
                  {hoveredData.agg.topInflows.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate max-w-[130px]">{item.name}:</span>
                      <span>
                        +{item.qty} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Outflow Row */}
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-bold pt-1 border-t border-neutral-100 dark:border-neutral-800/60">
                <span className="flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5" /> Outflow:
                </span>
                <span>
                  -{formatPHP(hoveredData.agg.outflowValue, 0, 0)} (
                  {hoveredData.agg.outflowQty.toFixed(1)} units)
                </span>
              </div>
              {hoveredData.agg.topOutflows.length > 0 && (
                <div className="pl-4 text-[10px] text-neutral-500 dark:text-neutral-400 space-y-0.5">
                  {hoveredData.agg.topOutflows.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate max-w-[130px]">{item.name}:</span>
                      <span>
                        -{item.qty} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Cumulative Balance */}
              <div className="pt-1.5 border-t border-neutral-200 dark:border-neutral-800 flex justify-between text-[11px] text-neutral-400">
                <span>Cumulative Trajectory:</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  {formatPHP(hoveredData.agg.cumulativeNetValue, 0, 0)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {/* Card 1: Total Inflow */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Total Inflow ({timeRangeDays}d)
            </span>
            <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300">
              {formatPHP(summary.totalInflowValue, 0, 0)}
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
              {summary.totalInflowQty.toLocaleString()} units received
            </span>
          </div>

          {/* Card 2: Total Outflow */}
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1">
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
              Total Outflow ({timeRangeDays}d)
            </span>
            <div className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-300">
              {formatPHP(summary.totalOutflowValue, 0, 0)}
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
              {summary.totalOutflowQty.toLocaleString()} units consumed
            </span>
          </div>

          {/* Card 3: Net Movement Balance */}
          <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 space-y-1">
            <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
              Net Balance
            </span>
            <div
              className={`text-base sm:text-lg font-black ${
                summary.netValue >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {summary.netValue >= 0 ? '+' : ''}
              {formatPHP(summary.netValue, 0, 0)}
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
              {summary.netValue >= 0 ? 'Stock Accumulation' : 'Stock Depletion'}
            </span>
          </div>

          {/* Card 4: Inflow / Outflow Ratio */}
          <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 space-y-1">
            <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
              Restock Velocity
            </span>
            <div className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
              {summary.inflowOutflowRatio.toFixed(2)}x
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
              Inflow to Outflow ratio
            </span>
          </div>

          {/* Card 5: Waste Spoilage Rate */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 col-span-2 lg:col-span-1 space-y-1">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Trim Waste Rate
            </span>
            <div className="text-base sm:text-lg font-black text-amber-700 dark:text-amber-300">
              {summary.wastePercentage.toFixed(1)}%
            </div>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
              {formatPHP(summary.wasteValue, 0, 0)} total shrinkage
            </span>
          </div>
        </div>

        {/* Per-Location Multi-Unit Comparison Grid (When viewing All Locations or Benchmarking) */}
        {localLocationId === 'all' && (
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                <span>Multi-Unit Location Breakdown Comparison</span>
              </h3>
              <span className="text-[10px] text-neutral-400">
                Aggregated over {timeRangeDays} days
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {locations.map((loc) => {
                const stat = summary.locationStats[loc.id] || {
                  inflowValue: 0,
                  outflowValue: 0,
                  netValue: 0,
                  inflowQty: 0,
                  outflowQty: 0,
                  recordsCount: 0,
                };

                const ratio = stat.outflowValue > 0 ? stat.inflowValue / stat.outflowValue : 1;

                return (
                  <div
                    key={loc.id}
                    className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-neutral-900 dark:text-white truncate">
                        {loc.name}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                        {loc.code}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-neutral-400 block">Inflow (₱)</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatPHP(stat.inflowValue, 0, 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 block">Outflow (₱)</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {formatPHP(stat.outflowValue, 0, 0)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-neutral-200/80 dark:border-neutral-700/50 flex items-center justify-between text-[11px]">
                      <span className="text-neutral-500">
                        Net: <strong className={stat.netValue >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                          {stat.netValue >= 0 ? '+' : ''}{formatPHP(stat.netValue, 0, 0)}
                        </strong>
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        Velocity: <strong>{ratio.toFixed(2)}x</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Stock Movement Detailed Ledger Audit Trail */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Ingredient Movement Transaction Ledger</span>
            </h3>
            <p className="text-[11px] text-neutral-400">
              Showing {ledgerRows.length} recorded movements matching your filters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ingredient or PO..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="text-xs pl-8 pr-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 w-44 sm:w-56"
              />
            </div>

            {/* Direction Filter */}
            <div className="flex items-center p-0.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setLedgerFlowFilter('all')}
                className={`px-2 py-1 rounded-lg text-xs font-bold ${
                  ledgerFlowFilter === 'all'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setLedgerFlowFilter('inflow')}
                className={`px-2 py-1 rounded-lg text-xs font-bold ${
                  ledgerFlowFilter === 'inflow'
                    ? 'bg-emerald-500 text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Inflows
              </button>
              <button
                onClick={() => setLedgerFlowFilter('outflow')}
                className={`px-2 py-1 rounded-lg text-xs font-bold ${
                  ledgerFlowFilter === 'outflow'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Outflows
              </button>
              <button
                onClick={() => setLedgerFlowFilter('waste')}
                className={`px-2 py-1 rounded-lg text-xs font-bold ${
                  ledgerFlowFilter === 'waste'
                    ? 'bg-amber-500 text-neutral-950 shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Waste
              </button>
            </div>
          </div>
        </div>

        {/* Ledger Table - Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">Date &amp; Time</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Ingredient</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Quantity</th>
                <th className="py-2.5 px-3">Unit Cost</th>
                <th className="py-2.5 px-3">Total Value</th>
                <th className="py-2.5 px-3">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
              {ledgerRows.slice(0, 50).map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <td className="py-2.5 px-3 text-neutral-500 whitespace-nowrap">
                    {row.timestamp}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.type === 'inflow'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : row.flowType === 'waste_spoilage'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {row.type === 'inflow' ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      <span>{row.flowLabel}</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-neutral-900 dark:text-white">
                      {row.ingredientName}
                    </div>
                    <span className="text-[10px] text-neutral-400">{row.category}</span>
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">
                    {row.locationName}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-white">
                    {row.type === 'inflow' ? '+' : '-'}
                    {row.quantity} {row.unit}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-500">{formatPHP(row.unitCost)}</td>
                  <td
                    className={`py-2.5 px-3 font-bold ${
                      row.type === 'inflow'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {row.type === 'inflow' ? '+' : '-'}
                    {formatPHP(row.totalValue)}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-400 font-mono text-[11px]">
                    {row.reference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ledger Mobile Cards View (< 768px) */}
        <div className="md:hidden space-y-2.5">
          {ledgerRows.slice(0, 30).map((row) => (
            <div
              key={row.id}
              className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-neutral-900 dark:text-white text-xs">
                    {row.ingredientName}
                  </div>
                  <span className="text-[10px] text-neutral-400">{row.locationName}</span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    row.type === 'inflow'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : row.flowType === 'waste_spoilage'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {row.flowLabel}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-200/60 dark:border-neutral-700/40">
                <span>
                  Qty: <strong>{row.type === 'inflow' ? '+' : '-'}{row.quantity} {row.unit}</strong>
                </span>
                <span
                  className={`font-black ${
                    row.type === 'inflow' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {row.type === 'inflow' ? '+' : '-'}{formatPHP(row.totalValue)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                <span>Ref: {row.reference}</span>
                <span>{row.timestamp.slice(5, 16)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
