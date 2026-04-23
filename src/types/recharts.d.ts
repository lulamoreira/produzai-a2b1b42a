/**
 * Recharts 2.15.x ships class components (PureComponent) whose types fail
 * the JSX element check under newer @types/react 18.3.x. We re-declare the
 * affected exports as loose function components without changing runtime
 * behavior, while preserving the original module's other exports/types.
 */
import "recharts";

declare module "recharts" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyComponent = (props: any) => any;

  // Only override the class-based components that fail JSX type checks.
  export const Pie: AnyComponent;
  export const Bar: AnyComponent;
  export const XAxis: AnyComponent;
  export const YAxis: AnyComponent;
  export const Tooltip: AnyComponent;
  export const Legend: AnyComponent;
  export const Cell: AnyComponent;
  export const Line: AnyComponent;
  export const Area: AnyComponent;
  export const Scatter: AnyComponent;
  export const RadialBar: AnyComponent;
  export const Radar: AnyComponent;
  export const PolarGrid: AnyComponent;
  export const PolarAngleAxis: AnyComponent;
  export const PolarRadiusAxis: AnyComponent;
  export const ZAxis: AnyComponent;
  export const ReferenceLine: AnyComponent;
  export const ReferenceArea: AnyComponent;
  export const ReferenceDot: AnyComponent;
  export const Brush: AnyComponent;
  export const Funnel: AnyComponent;
  export const ErrorBar: AnyComponent;
  export const CartesianGrid: AnyComponent;
  export const Label: AnyComponent;
  export const LabelList: AnyComponent;
}

