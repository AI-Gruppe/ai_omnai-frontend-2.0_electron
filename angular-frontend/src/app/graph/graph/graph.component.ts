import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import * as d3 from 'd3';

@Component({
  selector: 'app-graph',
  imports: [CommonModule],
  template: `
    <svg #plotlyContainer class="size-full p-4">
      @let _xScale = xScale();
      @let _yScale = yScale();
      <rect
        #backgroundRect
        [attr.x]="_xScale.range()[0]"
        [attr.y]="_yScale.range()[1]"
        [attr.width]="_xScale.range()[1] - _xScale.range()[0]"
        [attr.height]="_yScale.range()[0] - _yScale.range()[1]"
        [attr.fill]="'none'"
        [attr.opacity]="0.1"></rect>
      <g
        #xAxisTranslate
        [attr.transform]="'translate(0,' + _yScale.range()[0] + ')'">
        <g #xAxis></g>
      </g>
      <g
        #yAxis
        [attr.transform]="'translate(' + _xScale.range()[0] + ', 0)'"></g>
      @for (curve of pathData() | keyvalue; track $index) {
        <path
          [attr.transform]="'translate(' + _xScale.range()[0] + ',0 )'"
          [attr.d]="curve.value"
          [attr.stroke]="colors()[curve.key]"
          [attr.id]="curve.key"
          fill="none"></path>
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex: 1;
        width: 100%;
        height: 100%;
      }
    `,
    `
      .size-full {
        width: 100%;
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphComponent {
  dataSeries =
    input.required<Record<string, { timestamp: number; value: number }[]>>();
  colors = input.required<Record<string, string>>();

  plotContainer = viewChild.required<ElementRef>('plotlyContainer');
  xAxisRef = viewChild.required<ElementRef>('xAxis');
  yAxisRef = viewChild.required<ElementRef>('yAxis');

  width = signal(600);
  height = signal(400);
  margin = { top: 20, right: 20, bottom: 60, left: 60 };

  xScaleRange = linkedSignal({
    source: this.width,
    computation: width =>
      [this.margin.left, width - this.margin.right] as [number, number],
  });

  yScaleRange = linkedSignal({
    source: this.height,
    computation: height =>
      [height - this.margin.bottom, this.margin.top] as [number, number],
  });

  xScale = linkedSignal({
    source: this.dataSeries,
    computation: source => {
      // timestamps are sorted. First and last timestamp of each entry define the maximal domain that is needed for this
      const timeDomain = Object.values(source)
        .flatMap(datalist => [
          datalist[0].timestamp,
          datalist[datalist.length - 1].timestamp,
        ])
        .reduce(
          (acc, curr) => [Math.min(acc[0], curr), Math.max(acc[1], curr)],
          [Infinity, -Infinity]
        ) as [number, number];

      return d3.scaleLinear().domain(timeDomain).range(this.xScaleRange()).clamp(true);
    },
    equal: (a, b) =>
      a.domain()[0] == b.domain()[0] &&
      a.domain()[1] == b.domain()[1] &&
      a.range()[0] == b.range()[0] &&
      a.range()[1] == b.range()[1],
  });

  yScale = linkedSignal({
    source: this.dataSeries,
    computation: source => {
      // timestamps are sorted. First and last timestamp of each entry define the maximal domain that is needed for this
      const valueDomain = Object.values(source)
        .flatMap(datalist => datalist.map(entry => entry.value)) // extract all 'value' entries
        .reduce(
          (acc, curr) => [Math.min(acc[0], curr), Math.max(acc[1], curr)],
          [Infinity, -Infinity]
        ) as [number, number];

      return d3
        .scaleLinear()
        .domain(valueDomain)
        .range(this.yScaleRange())
        .clamp(true);
    },
    equal: (a, b) =>
      a.domain()[0] == b.domain()[0] &&
      a.domain()[1] == b.domain()[1] &&
      a.range()[0] == b.range()[0] &&
      a.range()[1] == b.range()[1],
  });

  // Computed Signal for line
  line = computed(() => {
    return d3
      .line<{ timestamp: number; value: number }>()
      .x(d => this.xScale()(d.timestamp))
      .y(d => this.yScale()(d.value));
  });

  pathData = computed(() => {
    const data = this.dataSeries();
    return Object.entries(data).reduce(
      (acc, [key, value]) => {
        acc[key] = this.line()(value) ?? '';
        return acc;
      },
      {} as Record<string, string>
    );
  });

  updateXAxies = effect(() => {
    const xAxisElement = this.xAxisRef().nativeElement;
    d3.select(xAxisElement)
      .call(d3.axisBottom(this.xScale()))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');
  });

  updateYAxis = effect(() => {
    const AxisElement = this.yAxisRef().nativeElement;
    d3.select(AxisElement)
      .call(d3.axisLeft(this.yScale()))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');
  });

  trackWindowSize = effect(() => {
    const svgElement = this.plotContainer().nativeElement;

    // ResizeObserver for SVG-Sizechange
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.width.set(width);
        this.height.set(height);
      }
    });

    resizeObserver.observe(svgElement);

    // Cleanup function when component is destroyed
    return () => {
      resizeObserver.unobserve(svgElement);
    };
  });
}
