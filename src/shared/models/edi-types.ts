/**
 * Core EDI Specification Data Types
 * Defines the structure for ANSI X12 EDI specifications
 */

export type UsageType = 'M' | 'O' | 'C'; // Mandatory, Optional, Conditional

export interface CodeValue {
  code: string;
  description: string;
  isCustomDescription?: boolean;
  included: boolean; // Whether this code is included in the spec
}

export interface DiscriminatorRule {
  elementId: string;
  operator: 'equals' | 'one-of';
  values: string[];
}

export interface Variant {
  id: string;
  label: string;
  discriminators: DiscriminatorRule[];
  usageOverride?: UsageType;
  conditionDescription?: string;
  codeOverrides?: Record<string, CodeValue[]>;
  comments?: string;
}

export interface InlineExample {
  value: string;
  description?: string;
}

export interface Element {
  id: string;
  position: number;
  name: string;
  dataType: string;
  minLength: number;
  maxLength: number;
  usage: UsageType;
  conditionDescription?: string;
  comments?: string;
  codeValues?: CodeValue[];
  example?: InlineExample;
  // Base spec reference
  baseUsage?: UsageType;
  baseCodes?: CodeValue[];
}

export interface Segment {
  id: string;
  name: string;
  description: string;
  usage: UsageType;
  conditionDescription?: string;
  minUse: number;
  maxUse: number;
  comments?: string;
  elements: Element[];
  variants?: Variant[];
  example?: InlineExample;
  order?: number; // Position in parent for interleaving with loops
  // Base spec reference
  baseUsage?: UsageType;
  baseMinUse?: number;
  baseMaxUse?: number;
}

export interface Loop {
  id: string;
  name: string;
  description?: string;
  usage: UsageType;
  conditionDescription?: string;
  minUse: number;
  maxUse: number;
  comments?: string;
  segments: Segment[];
  loops: Loop[]; // Nested loops
  variants?: Variant[];
  order?: number; // Position in parent for interleaving with segments
  // Base spec reference
  baseUsage?: UsageType;
  baseMinUse?: number;
  baseMaxUse?: number;
}

export interface ExampleEDI {
  id: string;
  title: string;
  description?: string;
  content: string; // Raw EDI text (ISA...IEA)
}

export interface SpecificationMetadata {
  name: string;
  version: string;
  transactionSet: string;
  transactionSetName: string;
  ediVersion: string; // e.g., "005010"
  partner?: string;
  description?: string;
  createdDate: string;
  modifiedDate: string;
  baseSpecReference?: string;
}

export interface Specification {
  id: string;
  metadata: SpecificationMetadata;
  loops: Loop[];
  examples: ExampleEDI[];
}

// OpenEDI Import Types
export interface OpenEDIElement {
  Id: string;
  Name: string;
  DataType: string;
  MinLength: number;
  MaxLength: number;
  Req: string;
  Codes?: Array<{ Code: string; Description: string }>;
}

export interface OpenEDISegment {
  Id: string;
  Name: string;
  Req: string;
  Max: number;
  Elements: OpenEDIElement[];
}

export interface OpenEDILoop {
  Id: string;
  Name: string;
  Req: string;
  Max: number;
  Segments?: OpenEDISegment[];
  Loops?: OpenEDILoop[];
}

export interface OpenEDITransactionSet {
  TransactionSetId: string;
  Name: string;
  Version: string;
  Loops: OpenEDILoop[];
}

// IPC Message Types
export interface SaveSpecificationRequest {
  specification: Specification;
  filePath?: string;
}

export interface LoadSpecificationRequest {
  filePath: string;
}

export interface ExportPDFRequest {
  specification: Specification;
  filePath: string;
}

export interface IPCResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
