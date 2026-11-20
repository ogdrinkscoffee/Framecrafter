export type ProjectFileType = 'html' | 'css' | 'js' | 'json' | 'other';

export interface ProjectFile {
  path: string;
  name: string;
  content: string;
  type: ProjectFileType;
}

export type ViewportPreset = 'desktop' | 'tablet' | 'mobile';

export type ResponsiveScope = 'all' | 'desktop' | 'tablet' | 'mobile';

export type EditorMode = 'edit' | 'interact';

export type CenterTab = 'preview' | 'code';

export type RightPanelTab = 'inspector' | 'elements' | 'seo' | 'global-styles';

export interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface SvgShapeProps {
  childTag: string;
  fill: string;
  stroke: string;
  strokeWidth: string;
  pathData: string;
  dataMode: 'd' | 'points' | 'circle' | 'rect';
  viewBox: string;
}

export interface ElementStyleSnapshot {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  textTransform: string;
  verticalAlign: string;
  textAlign: string;
  lineHeight: string;
  color: string;
  backgroundColor: string;
  opacity: string;
  boxShadow: string;
  transform: string;
  borderWidth: string;
  borderStyle: string;
  borderColor: string;
  borderRadius: string;
  padding: string;
  margin: string;
  width: string;
  height: string;
  position: string;
  top: string;
  left: string;
  zIndex: string;
  display: string;
  flexDirection: string;
  gap: string;
}

export interface SelectedElementInfo {
  veId: string | null;
  veNode: string | null;
  veShape: string | null;
  aspectLockedAttr: string | null;
  svgShape: SvgShapeProps | null;
  runtimeId: string;
  tagName: string;
  id: string;
  className: string;
  href: string;
  target: string;
  onclickAttr: string;
  actionType: string;
  actionValue: string;
  selectorPath: string;
  textContent: string;
  hasElementChildren: boolean;
  isTextEditable: boolean;
  isHidden: boolean;
  rect: ElementRect;
  styles: ElementStyleSnapshot;
  inlineStyles: Record<string, string>;
}

export interface TableMetrics {
  rows: number;
  cols: number;
  cellPadding: string;
  cellAlign: string;
  cellVAlign: string;
  isStriped: boolean;
}

export interface HtmlElementPatch {
  textContent?: string;
  styles?: Record<string, string | null>;
  attributes?: Record<string, string | null>;
  remove?: boolean;
  veNode?: string;
}

export interface HistorySnapshot {
  files: ProjectFile[];
  label: string;
  timestamp: number;
}

export interface HistoryState {
  past: HistorySnapshot[];
  present: HistorySnapshot;
  future: HistorySnapshot[];
}

export interface SampleTemplate {
  id: string;
  name: string;
  description: string;
  files: ProjectFile[];
}

export interface DraggableComponentDef {
  id: string;
  name: string;
  category: 'Components' | 'Shapes & Lines' | 'Tables & Lists' | 'Layout' | 'Typography' | 'Inputs';
  description: string;
  html: string;
}

export interface SeoMetaValues {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  ogType: string;
  twitterCard: string;
}

export interface CssVariableEntry {
  name: string;
  value: string;
  kind: 'color' | 'length' | 'font' | 'other';
}

export type ButtonActionType =
  | 'none'
  | 'url'
  | 'page'
  | 'scroll'
  | 'alert'
  | 'toggle';

export interface FileSearchLineMatch {
  lineNumber: number;
  lineText: string;
}

export interface FileSearchResult {
  file: ProjectFile;
  filenameMatch: boolean;
  lineMatches: FileSearchLineMatch[];
  totalLineMatches: number;
}

export interface AutoSaveStatus {
  enabled: boolean;
  diskConnected: boolean;
  diskFolderName: string | null;
  lastSavedAt: number | null;
  permissionState: 'none' | 'granted' | 'denied' | 'unsupported';
}
