/**
 * OpenEDI Specification Importer
 * Converts EdiNation OpenEDI specifications to internal format
 * Supports both legacy format and OpenAPI schema format
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Specification,
  Loop,
  Segment,
  Element,
  CodeValue,
  UsageType,
  OpenEDITransactionSet,
  OpenEDILoop,
  OpenEDISegment,
  OpenEDIElement,
} from '../models/edi-types';

function parseUsage(req: string): UsageType {
  switch (req?.toUpperCase()) {
    case 'M':
      return 'M';
    case 'O':
      return 'O';
    case 'C':
    case 'X':
      return 'C';
    default:
      return 'O';
  }
}

function convertElement(openEDIElement: OpenEDIElement, position: number): Element {
  const usage = parseUsage(openEDIElement.Req);
  const codeValues: CodeValue[] = (openEDIElement.Codes || []).map(code => ({
    code: code.Code,
    description: code.Description,
    included: true,
  }));

  return {
    id: uuidv4(),
    position,
    name: openEDIElement.Name || openEDIElement.Id,
    dataType: openEDIElement.DataType || 'AN',
    minLength: openEDIElement.MinLength || 0,
    maxLength: openEDIElement.MaxLength || 0,
    usage,
    baseUsage: usage,
    codeValues: codeValues.length > 0 ? codeValues : undefined,
    baseCodes: codeValues.length > 0 ? [...codeValues] : undefined,
  };
}

function convertSegment(openEDISegment: OpenEDISegment): Segment {
  const usage = parseUsage(openEDISegment.Req);
  const maxUse = openEDISegment.Max || 1;

  return {
    id: uuidv4(),
    name: openEDISegment.Id,
    description: openEDISegment.Name || openEDISegment.Id,
    usage,
    baseUsage: usage,
    minUse: usage === 'M' ? 1 : 0,
    maxUse,
    baseMinUse: usage === 'M' ? 1 : 0,
    baseMaxUse: maxUse,
    elements: (openEDISegment.Elements || []).map((el, idx) => convertElement(el, idx + 1)),
  };
}

function convertLoop(openEDILoop: OpenEDILoop): Loop {
  const usage = parseUsage(openEDILoop.Req);
  const maxUse = openEDILoop.Max || 1;

  return {
    id: uuidv4(),
    name: openEDILoop.Id || openEDILoop.Name,
    description: openEDILoop.Name,
    usage,
    baseUsage: usage,
    minUse: usage === 'M' ? 1 : 0,
    maxUse,
    baseMinUse: usage === 'M' ? 1 : 0,
    baseMaxUse: maxUse,
    segments: (openEDILoop.Segments || []).map(seg => convertSegment(seg)),
    loops: (openEDILoop.Loops || []).map(loop => convertLoop(loop)),
  };
}

export function importOpenEDISpec(openEDISpec: OpenEDITransactionSet): Specification {
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    metadata: {
      name: `${openEDISpec.TransactionSetId} - ${openEDISpec.Name}`,
      version: '1.0',
      transactionSet: openEDISpec.TransactionSetId,
      transactionSetName: openEDISpec.Name,
      ediVersion: openEDISpec.Version || '005010',
      createdDate: now,
      modifiedDate: now,
      baseSpecReference: `OpenEDI/${openEDISpec.Version}/${openEDISpec.TransactionSetId}`,
    },
    loops: (openEDISpec.Loops || []).map(loop => convertLoop(loop)),
    examples: [],
  };
}

// ============================================================================
// OpenAPI Schema Format Parser (EdiNation's current format)
// ============================================================================

interface OpenAPISchema {
  openapi: string;
  info?: { title?: string; version?: string };
  components?: {
    schemas?: Record<string, OpenAPISchemaDefinition>;
  };
}

interface OpenAPISchemaDefinition {
  type?: string;
  required?: string[];
  properties?: Record<string, OpenAPIProperty>;
  enum?: string[];
  allOf?: Array<{ $ref?: string }>;
  'x-openedi-segment-id'?: string;
  'x-openedi-message-id'?: string;
  'x-openedi-message-standard'?: string;
  'x-openedi-loop-id'?: string;
}

interface OpenAPIProperty {
  type?: string;
  minLength?: number;
  maxLength?: number;
  maxItems?: number;
  format?: string;
  enum?: string[];
  allOf?: Array<{ $ref?: string }>;
  $ref?: string;
  items?: { $ref?: string };
  'x-openedi-element-id'?: string;
}

function isOpenAPIFormat(parsed: any): parsed is OpenAPISchema {
  return parsed && typeof parsed === 'object' && 'openapi' in parsed && 'components' in parsed;
}

function parseDataTypeFromFormat(format?: string): string {
  if (!format) return 'AN';
  const formatUpper = format.toUpperCase();
  if (formatUpper.includes('_ID')) return 'ID';
  if (formatUpper.includes('_N0')) return 'N0';
  if (formatUpper.includes('_N2')) return 'N2';
  if (formatUpper.includes('_R')) return 'R';
  if (formatUpper.includes('_DT')) return 'DT';
  if (formatUpper.includes('_TM')) return 'TM';
  return 'AN';
}

function parseElementNameFromKey(key: string): string {
  // Convert "TransactionSetIdentifierCode_01" to "Transaction Set Identifier Code"
  const withoutSuffix = key.replace(/_\d+$/, '');
  return withoutSuffix.replace(/([A-Z])/g, ' $1').trim();
}

function getElementPosition(key: string): number {
  const match = key.match(/_(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
}

function importOpenAPISegment(
  segmentId: string,
  schema: OpenAPISchemaDefinition,
  allSchemas: Record<string, OpenAPISchemaDefinition>,
  requiredSegments: string[],
  maxUse: number = 1
): Segment {
  const isRequired = requiredSegments.includes(segmentId);
  const elements: Element[] = [];

  if (schema.properties) {
    const propEntries = Object.entries(schema.properties).filter(
      ([key]) => !key.startsWith('Model') && key !== '$ref'
    );

    for (const [propKey, prop] of propEntries) {
      const position = getElementPosition(propKey);
      const isElementRequired = schema.required?.includes(propKey) ?? false;

      // Get code values if this references an enum schema
      let codeValues: CodeValue[] | undefined;
      if (prop.allOf) {
        for (const ref of prop.allOf) {
          if (ref.$ref) {
            const refName = ref.$ref.replace('#/components/schemas/', '');
            const refSchema = allSchemas[refName];
            if (refSchema?.enum) {
              codeValues = refSchema.enum.map(code => ({
                code,
                description: code,
                included: true,
              }));
            }
          }
        }
      }
      if (prop.enum) {
        codeValues = prop.enum.map(code => ({
          code,
          description: code,
          included: true,
        }));
      }

      const element: Element = {
        id: uuidv4(),
        position,
        name: parseElementNameFromKey(propKey),
        dataType: parseDataTypeFromFormat(prop.format),
        minLength: prop.minLength || 0,
        maxLength: prop.maxLength || 0,
        usage: isElementRequired ? 'M' : 'O',
        baseUsage: isElementRequired ? 'M' : 'O',
        codeValues,
        baseCodes: codeValues ? [...codeValues] : undefined,
      };
      elements.push(element);
    }

    // Sort elements by position
    elements.sort((a, b) => a.position - b.position);
  }

  return {
    id: uuidv4(),
    name: segmentId,
    description: segmentId,
    usage: isRequired ? 'M' : 'O',
    baseUsage: isRequired ? 'M' : 'O',
    minUse: isRequired ? 1 : 0,
    maxUse,
    baseMinUse: isRequired ? 1 : 0,
    baseMaxUse: maxUse,
    elements,
  };
}

function importOpenAPILoop(
  loopSchema: OpenAPISchemaDefinition,
  allSchemas: Record<string, OpenAPISchemaDefinition>,
  maxUse: number = 1,
  isRequired: boolean = false,
  order?: number
): Loop {
  const loopId = loopSchema['x-openedi-loop-id'] || 'LOOP';
  const segments: Segment[] = [];
  const nestedLoops: Loop[] = [];
  const requiredItems = loopSchema.required || [];

  if (loopSchema.properties) {
    let itemOrder = 0;
    for (const [propKey, prop] of Object.entries(loopSchema.properties)) {
      if (propKey === 'Model') continue;

      const isArray = prop.type === 'array';
      const itemMaxUse = isArray ? (prop.maxItems || 999999) : 1;

      // Get the referenced schema
      let refName: string | undefined;
      if (prop.$ref) {
        refName = prop.$ref.replace('#/components/schemas/', '');
      } else if (isArray && prop.items?.$ref) {
        refName = prop.items.$ref.replace('#/components/schemas/', '');
      }

      if (refName) {
        const refSchema = allSchemas[refName];
        if (refSchema) {
          // Check if it's a loop or segment
          if (refSchema['x-openedi-loop-id']) {
            // It's a nested loop
            const nestedLoop = importOpenAPILoop(
              refSchema,
              allSchemas,
              itemMaxUse,
              requiredItems.includes(propKey),
              itemOrder
            );
            nestedLoops.push(nestedLoop);
          } else if (refSchema['x-openedi-segment-id']) {
            // It's a segment
            const segmentId = refSchema['x-openedi-segment-id'];
            const segment = importOpenAPISegment(
              segmentId,
              refSchema,
              allSchemas,
              requiredItems,
              itemMaxUse
            );
            segment.order = itemOrder;
            segments.push(segment);
          }
          itemOrder++;
        }
      }
    }
  }

  return {
    id: uuidv4(),
    name: loopId,
    description: loopId,
    usage: isRequired ? 'M' : 'O',
    baseUsage: isRequired ? 'M' : 'O',
    minUse: isRequired ? 1 : 0,
    maxUse,
    baseMinUse: isRequired ? 1 : 0,
    baseMaxUse: maxUse,
    segments,
    loops: nestedLoops,
    order,
  };
}

function importOpenAPIFormat(parsed: OpenAPISchema): Specification {
  const now = new Date().toISOString();
  const schemas = parsed.components?.schemas || {};

  // Find the transaction set schema (has x-openedi-message-id)
  let transactionSetId = '';
  let transactionSetSchema: OpenAPISchemaDefinition | null = null;

  for (const [key, schema] of Object.entries(schemas)) {
    if (schema['x-openedi-message-id']) {
      transactionSetId = schema['x-openedi-message-id'];
      transactionSetSchema = schema;
      break;
    }
  }

  if (!transactionSetSchema) {
    throw new Error('No transaction set found in OpenAPI schema (missing x-openedi-message-id)');
  }

  // Build segments and loops from the transaction set properties
  const segments: Segment[] = [];
  const loops: Loop[] = [];
  const requiredItems = transactionSetSchema.required || [];

  if (transactionSetSchema.properties) {
    let itemOrder = 0;
    for (const [propKey, prop] of Object.entries(transactionSetSchema.properties)) {
      if (propKey === 'Model') continue;

      const isArray = prop.type === 'array';
      const itemMaxUse = isArray ? (prop.maxItems || 999999) : 1;

      // Get the referenced schema
      let refName: string | undefined;
      if (prop.$ref) {
        refName = prop.$ref.replace('#/components/schemas/', '');
      } else if (isArray && prop.items?.$ref) {
        refName = prop.items.$ref.replace('#/components/schemas/', '');
      }

      if (refName) {
        const refSchema = schemas[refName];
        if (refSchema) {
          // Check if it's a loop or segment
          if (refSchema['x-openedi-loop-id']) {
            // It's a loop
            const loop = importOpenAPILoop(
              refSchema,
              schemas,
              itemMaxUse,
              requiredItems.includes(propKey),
              itemOrder
            );
            loops.push(loop);
          } else if (refSchema['x-openedi-segment-id']) {
            // It's a segment
            const segmentId = refSchema['x-openedi-segment-id'];
            const segment = importOpenAPISegment(
              segmentId,
              refSchema,
              schemas,
              requiredItems,
              itemMaxUse
            );
            segment.order = itemOrder;
            segments.push(segment);
          }
          itemOrder++;
        }
      }
    }
  }

  // Create a main loop to hold top-level segments, with nested loops
  const mainLoop: Loop = {
    id: uuidv4(),
    name: `TS${transactionSetId}`,
    description: `Transaction Set ${transactionSetId}`,
    usage: 'M',
    baseUsage: 'M',
    minUse: 1,
    maxUse: 1,
    baseMinUse: 1,
    baseMaxUse: 1,
    segments,
    loops,
  };

  const template = TRANSACTION_SET_TEMPLATES[transactionSetId];

  return {
    id: uuidv4(),
    metadata: {
      name: template?.name || `Transaction Set ${transactionSetId}`,
      version: '1.0',
      transactionSet: transactionSetId,
      transactionSetName: template?.name || transactionSetId,
      ediVersion: '005010',
      createdDate: now,
      modifiedDate: now,
      baseSpecReference: `EdiNation/OpenAPI/${transactionSetId}`,
    },
    loops: [mainLoop],
    examples: [],
  };
}

export function parseOpenEDIJson(jsonContent: string): OpenEDITransactionSet {
  const parsed = JSON.parse(jsonContent);

  // Check if this is the OpenAPI format
  if (isOpenAPIFormat(parsed)) {
    // Convert OpenAPI format to our internal format via Specification
    // Then throw to use the direct import path
    throw { isOpenAPI: true, spec: importOpenAPIFormat(parsed) };
  }

  // Handle both array format and single object format (legacy)
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error('Empty specification array');
    }
    return parsed[0] as OpenEDITransactionSet;
  }

  return parsed as OpenEDITransactionSet;
}

// Wrapper function that handles both formats
export function parseAndImportSpec(jsonContent: string): Specification {
  try {
    const openEDISpec = parseOpenEDIJson(jsonContent);
    return importOpenEDISpec(openEDISpec);
  } catch (e: any) {
    if (e && e.isOpenAPI && e.spec) {
      return e.spec;
    }
    throw e;
  }
}

// Built-in transaction set templates
export const TRANSACTION_SET_TEMPLATES: Record<string, { name: string; description: string }> = {
  '315': { name: 'Status Details (Ocean)', description: 'Ocean shipment status details' },
  '810': { name: 'Invoice', description: 'Invoice transaction set' },
  '850': { name: 'Purchase Order', description: 'Purchase order transaction set' },
  '855': { name: 'Purchase Order Acknowledgment', description: 'PO acknowledgment' },
  '856': { name: 'Ship Notice/Manifest', description: 'Advance ship notice (ASN)' },
  '820': { name: 'Payment Order/Remittance Advice', description: 'Payment information' },
  '990': { name: 'Response to a Load Tender', description: 'Load tender response' },
  '997': { name: 'Functional Acknowledgment', description: 'FA transaction set' },
  '999': { name: 'Implementation Acknowledgment', description: 'IA transaction set' },
  '204': { name: 'Motor Carrier Load Tender', description: 'Load tender' },
  '210': { name: 'Motor Carrier Freight Details and Invoice', description: 'Freight invoice' },
  '214': { name: 'Transportation Carrier Shipment Status Message', description: 'Shipment status' },
  '270': { name: 'Eligibility, Coverage or Benefit Inquiry', description: 'Healthcare eligibility inquiry' },
  '271': { name: 'Eligibility, Coverage or Benefit Information', description: 'Healthcare eligibility response' },
  '276': { name: 'Health Care Claim Status Request', description: 'Claim status request' },
  '277': { name: 'Health Care Claim Status Response', description: 'Claim status response' },
  '834': { name: 'Benefit Enrollment and Maintenance', description: 'Enrollment transaction' },
  '835': { name: 'Health Care Claim Payment/Advice', description: 'Remittance advice' },
  '837': { name: 'Health Care Claim', description: 'Healthcare claim (Professional/Institutional/Dental)' },
};

// Create an empty specification based on transaction set
export function createEmptySpecification(
  transactionSetId: string,
  name?: string,
  ediVersion: string = '005010'
): Specification {
  const template = TRANSACTION_SET_TEMPLATES[transactionSetId];
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    metadata: {
      name: name || template?.name || `Transaction Set ${transactionSetId}`,
      version: '1.0',
      transactionSet: transactionSetId,
      transactionSetName: template?.name || transactionSetId,
      ediVersion,
      createdDate: now,
      modifiedDate: now,
    },
    loops: [],
    examples: [],
  };
}
