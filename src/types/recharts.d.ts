/**
 * Recharts 2.15.x ships class components (PureComponent) whose types fail
 * the JSX element check under @types/react 18.3.x in some resolution paths.
 * These shims relax the JSX constructor check without changing runtime behavior.
 */
declare module "recharts" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyComponent = (props: any) => any;

  export const Pie: AnyComponent;
  export const Bar: AnyComponent;
  export const XAxis: AnyComponent;
  export const YAxis: AnyComponent;
  export const Tooltip: AnyComponent;
  export const Legend: AnyComponent;
  export const Cell: AnyComponent;
  export const PieChart: AnyComponent;
  export const BarChart: AnyComponent;
  export const ResponsiveContainer: AnyComponent;
  export const LineChart: AnyComponent;
  export const Line: AnyComponent;
  export const AreaChart: AnyComponent;
  export const Area: AnyComponent;
  export const CartesianGrid: AnyComponent;
  export const RadialBarChart: AnyComponent;
  export const RadialBar: AnyComponent;
  export const ScatterChart: AnyComponent;
  export const Scatter: AnyComponent;
  export const ComposedChart: AnyComponent;
  export const Label: AnyComponent;
  export const LabelList: AnyComponent;
  export const ReferenceLine: AnyComponent;
  export const ReferenceArea: AnyComponent;
  export const ReferenceDot: AnyComponent;
  export const Brush: AnyComponent;
  export const Funnel: AnyComponent;
  export const FunnelChart: AnyComponent;
  export const Treemap: AnyComponent;
  export const Sector: AnyComponent;
  export const Surface: AnyComponent;
  export const Layer: AnyComponent;
  export const Radar: AnyComponent;
  export const RadarChart: AnyComponent;
  export const PolarGrid: AnyComponent;
  export const PolarAngleAxis: AnyComponent;
  export const PolarRadiusAxis: AnyComponent;
  export const ZAxis: AnyComponent;
  export const Rectangle: AnyComponent;
  export const Cross: AnyComponent;
  export const Curve: AnyComponent;
  export const Dot: AnyComponent;
  export const Polygon: AnyComponent;
  export const Symbols: AnyComponent;
  export const Text: AnyComponent;
  export const Customized: AnyComponent;
  export const ErrorBar: AnyComponent;
  export const Trapezoid: AnyComponent;
}
