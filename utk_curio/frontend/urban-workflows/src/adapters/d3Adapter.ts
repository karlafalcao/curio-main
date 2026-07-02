/**
 * D3Adapter: GrammarAdapter implementation for D3.js visualizations.
 * Renders when the user clicks play; spec defines mark type and optional x/y fields.
 */

import { GrammarAdapter, registerGrammarAdapter } from '../registry/grammarAdapter';
import { parseDataframe, parseGeoDataframe } from '../utils/parsing';
import { fetchData } from '../services/api';

export interface D3Spec {
  mark?: 'point' | 'line' | 'bar';
  x?: string;
  y?: string;
}

async function parseInputData(input: any): Promise<any[] | null> {
  if (input == "" || input == null || input == undefined) {
    return [];
  }

  const parser = input.dataType === 'geodataframe' ? parseGeoDataframe : parseDataframe;

  if (input.path) {
    const fetched = await fetchData(input.path);
    return parser(fetched.data);
  }
  return parser(input.data);
}

export const d3Adapter: GrammarAdapter = {
  grammarId: 'd3',

  validate(spec: unknown): boolean {
    try {
      const parsed = typeof spec === 'string' ? JSON.parse(spec) : spec;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed);
    } catch {
      return false;
    }
  },

  async render(
    container: HTMLElement,
    spec: unknown,
    data?: unknown,
  ): Promise<void> {
    const input = data as any;
    if (!input || input === '') {
      container.innerHTML =
        '<p style="padding:1rem;color:#666;font-size:12px;text-align:center">No input data yet. Run the upstream box, then run this chart.</p>';
      return;
    }

    const specObj = (typeof spec === 'string' ? JSON.parse(spec) : spec) as D3Spec;
    const values = await parseInputData(input);

    if (!values || !values.length) {
      container.innerHTML = '<p style="padding:1rem;color:#666">No data to visualize.</p>';
      return;
    }

    const d3 = await import('d3');

    container.innerHTML = '';
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;

    const allKeys = Object.keys(values[0]);
    const numericKeys = allKeys.filter(
      (k) => typeof (values[0] as any)[k] === 'number',
    );
    const categoricalKeys = allKeys.filter(
      (k) => typeof (values[0] as any)[k] !== 'number',
    );
    const xKey =
      specObj.x && allKeys.includes(specObj.x)
        ? specObj.x
        : categoricalKeys[0] ?? numericKeys[0] ?? 'x';
    const yKey =
      specObj.y && allKeys.includes(specObj.y)
        ? specObj.y
        : numericKeys[0] ?? numericKeys[1] ?? 'y';

    const mark = specObj.mark ?? 'bar';
    const xIsNumeric = typeof (values[0] as any)[xKey] === 'number';

    let xScale: any;
    const marginLeft = 40;
    const marginBottom = 30;
    const xRange = [marginLeft, width - 20] as [number, number];
    const yRange = [height - marginBottom, 20] as [number, number];

    if (mark === 'bar' && !xIsNumeric) {
      const xDomain = values.map((d: any) => String(d[xKey]));
      xScale = d3.scaleBand().domain(xDomain).range(xRange).padding(0.2);
    } else {
      const xExtent = d3.extent(values, (d: any) => Number(d[xKey]));
      xScale = d3
        .scaleLinear()
        .domain(
          (xExtent[0] != null && xExtent[1] != null ? xExtent : [0, 1]) as [
            number,
            number,
          ],
        )
        .range(xRange);
    }

    const yExtent = d3.extent(values, (d: any) => Number(d[yKey]));
    const yScale = d3
      .scaleLinear()
      .domain(
        (yExtent[0] != null && yExtent[1] != null ? yExtent : [0, 1]) as [
          number,
          number,
        ],
      )
      .range(yRange);

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    if (mark === 'point') {
      const xScaleLinear = xScale as (v: number) => number;
      svg
        .selectAll('circle')
        .data(values)
        .join('circle')
        .attr('cx', (d: any) => xScaleLinear(Number(d[xKey])))
        .attr('cy', (d: any) => yScale(Number(d[yKey])))
        .attr('r', 4)
        .attr('fill', 'steelblue');
    } else if (mark === 'line') {
      const xScaleLinear = xScale as (v: number) => number;
      const line = d3
        .line<any>()
        .x((d) => xScaleLinear(Number(d[xKey])))
        .y((d) => yScale(Number(d[yKey])));
      svg
        .append('path')
        .datum(values)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 2)
        .attr('d', line);
    } else if (mark === 'bar') {
      if (xIsNumeric) {
        const xScaleLinear = xScale as (v: number) => number;
        const barWidth = Math.max(1, (width - 60) / values.length - 2);
        svg
          .selectAll('rect')
          .data(values)
          .join('rect')
          .attr('x', (d: any, i) => 40 + i * (barWidth + 2))
          .attr('y', (d: any) => yScale(Number(d[yKey])))
          .attr('width', barWidth)
          .attr('height', (d: any) => height - marginBottom - yScale(Number(d[yKey])))
          .attr('fill', 'steelblue');
      } else {
        const xScaleBand = xScale as { (v: string): number | undefined; bandwidth(): number };
        svg
          .selectAll('rect')
          .data(values)
          .join('rect')
          .attr('x', (d: any) => xScaleBand(String(d[xKey])) ?? 0)
          .attr('y', (d: any) => yScale(Number(d[yKey])))
          .attr('width', xScaleBand.bandwidth())
          .attr('height', (d: any) => height - marginBottom - yScale(Number(d[yKey])))
          .attr('fill', 'steelblue');
      }
    }

    const xAxis = d3.axisBottom(xScale as any);
    svg
      .append('g')
      .attr('transform', `translate(0,${height - marginBottom})`)
      .call(xAxis);

    svg
      .append('g')
      .attr('transform', `translate(${marginLeft},0)`)
      .call(d3.axisLeft(yScale));
  },

  getDefaultSpec(): D3Spec {
    return { mark: 'bar' };
  },
};

registerGrammarAdapter(d3Adapter);
