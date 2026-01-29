/**
 * Tests for OpenEDI Importer
 */

import {
  importOpenEDISpec,
  parseOpenEDIJson,
  parseAndImportSpec,
  createEmptySpecification,
  TRANSACTION_SET_TEMPLATES,
} from '../utils/openedi-importer';
import { OpenEDITransactionSet } from '../models/edi-types';

describe('openedi-importer', () => {
  describe('parseOpenEDIJson', () => {
    it('should parse a single object specification', () => {
      const json = JSON.stringify({
        TransactionSetId: '810',
        Name: 'Invoice',
        Version: '005010',
        Loops: [],
      });

      const result = parseOpenEDIJson(json);

      expect(result.TransactionSetId).toBe('810');
      expect(result.Name).toBe('Invoice');
      expect(result.Version).toBe('005010');
    });

    it('should parse an array specification and return first element', () => {
      const json = JSON.stringify([
        {
          TransactionSetId: '810',
          Name: 'Invoice',
          Version: '005010',
          Loops: [],
        },
        {
          TransactionSetId: '850',
          Name: 'Purchase Order',
          Version: '005010',
          Loops: [],
        },
      ]);

      const result = parseOpenEDIJson(json);

      expect(result.TransactionSetId).toBe('810');
    });

    it('should throw error for empty array', () => {
      const json = JSON.stringify([]);

      expect(() => parseOpenEDIJson(json)).toThrow('Empty specification array');
    });

    it('should throw error for invalid JSON', () => {
      expect(() => parseOpenEDIJson('invalid json')).toThrow();
    });

    it('should throw special error for OpenAPI format', () => {
      const openAPIJson = JSON.stringify({
        openapi: '3.0.0',
        components: {
          schemas: {
            X12_00501_810: {
              'x-openedi-message-id': '810',
              properties: {},
            },
          },
        },
      });

      expect(() => parseOpenEDIJson(openAPIJson)).toThrow();
    });
  });

  describe('importOpenEDISpec', () => {
    it('should convert basic transaction set', () => {
      const openEDI: OpenEDITransactionSet = {
        TransactionSetId: '810',
        Name: 'Invoice',
        Version: '005010',
        Loops: [
          {
            Id: 'ST_LOOP',
            Name: 'Transaction Set Header',
            Req: 'M',
            Max: 1,
            Segments: [
              {
                Id: 'ST',
                Name: 'Transaction Set Header',
                Req: 'M',
                Max: 1,
                Elements: [
                  {
                    Id: 'ST01',
                    Name: 'Transaction Set Identifier Code',
                    DataType: 'ID',
                    MinLength: 3,
                    MaxLength: 3,
                    Req: 'M',
                    Codes: [{ Code: '810', Description: 'Invoice' }],
                  },
                ],
              },
            ],
            Loops: [],
          },
        ],
      };

      const result = importOpenEDISpec(openEDI);

      expect(result.metadata.transactionSet).toBe('810');
      expect(result.metadata.transactionSetName).toBe('Invoice');
      expect(result.metadata.ediVersion).toBe('005010');
      expect(result.loops).toHaveLength(1);
      expect(result.loops[0].name).toBe('ST_LOOP');
      expect(result.loops[0].usage).toBe('M');
    });

    it('should convert nested loops', () => {
      const openEDI: OpenEDITransactionSet = {
        TransactionSetId: '810',
        Name: 'Invoice',
        Version: '005010',
        Loops: [
          {
            Id: 'HEADER',
            Name: 'Header',
            Req: 'M',
            Max: 1,
            Segments: [],
            Loops: [
              {
                Id: 'N1_LOOP',
                Name: 'Party Identification',
                Req: 'O',
                Max: 200,
                Segments: [],
                Loops: [],
              },
            ],
          },
        ],
      };

      const result = importOpenEDISpec(openEDI);

      expect(result.loops[0].loops).toHaveLength(1);
      expect(result.loops[0].loops[0].name).toBe('N1_LOOP');
      expect(result.loops[0].loops[0].usage).toBe('O');
      expect(result.loops[0].loops[0].maxUse).toBe(200);
    });

    it('should convert elements with code values', () => {
      const openEDI: OpenEDITransactionSet = {
        TransactionSetId: '810',
        Name: 'Invoice',
        Version: '005010',
        Loops: [
          {
            Id: 'LOOP1',
            Name: 'Loop',
            Req: 'M',
            Max: 1,
            Segments: [
              {
                Id: 'N1',
                Name: 'Party Identification',
                Req: 'M',
                Max: 1,
                Elements: [
                  {
                    Id: 'N101',
                    Name: 'Entity Identifier Code',
                    DataType: 'ID',
                    MinLength: 2,
                    MaxLength: 3,
                    Req: 'M',
                    Codes: [
                      { Code: 'ST', Description: 'Ship To' },
                      { Code: 'BT', Description: 'Bill To' },
                      { Code: 'SU', Description: 'Supplier' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = importOpenEDISpec(openEDI);
      const element = result.loops[0].segments[0].elements[0];

      expect(element.codeValues).toHaveLength(3);
      expect(element.codeValues![0].code).toBe('ST');
      expect(element.codeValues![0].description).toBe('Ship To');
      expect(element.codeValues![0].included).toBe(true);
    });

    it('should handle usage types correctly', () => {
      const testCases = [
        { input: 'M', expected: 'M' },
        { input: 'O', expected: 'O' },
        { input: 'C', expected: 'C' },
        { input: 'X', expected: 'C' },
        { input: undefined, expected: 'O' },
      ];

      testCases.forEach(({ input, expected }) => {
        const openEDI: OpenEDITransactionSet = {
          TransactionSetId: '810',
          Name: 'Invoice',
          Version: '005010',
          Loops: [
            {
              Id: 'LOOP',
              Name: 'Test Loop',
              Req: input as string,
              Max: 1,
            },
          ],
        };

        const result = importOpenEDISpec(openEDI);
        expect(result.loops[0].usage).toBe(expected);
      });
    });

    it('should set base values for tracking overrides', () => {
      const openEDI: OpenEDITransactionSet = {
        TransactionSetId: '810',
        Name: 'Invoice',
        Version: '005010',
        Loops: [
          {
            Id: 'LOOP1',
            Name: 'Loop',
            Req: 'M',
            Max: 5,
            Segments: [
              {
                Id: 'SEG1',
                Name: 'Segment',
                Req: 'O',
                Max: 10,
                Elements: [
                  {
                    Id: 'EL01',
                    Name: 'Element',
                    DataType: 'AN',
                    MinLength: 1,
                    MaxLength: 50,
                    Req: 'C',
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = importOpenEDISpec(openEDI);

      expect(result.loops[0].baseUsage).toBe('M');
      expect(result.loops[0].baseMaxUse).toBe(5);
      expect(result.loops[0].baseMinUse).toBe(1);
      expect(result.loops[0].segments[0].baseUsage).toBe('O');
      expect(result.loops[0].segments[0].baseMinUse).toBe(0);
      expect(result.loops[0].segments[0].baseMaxUse).toBe(10);
      expect(result.loops[0].segments[0].elements[0].baseUsage).toBe('C');
    });

    it('should set baseCodes for elements with code values', () => {
      const openEDI: OpenEDITransactionSet = {
        TransactionSetId: '810',
        Name: 'Invoice',
        Version: '005010',
        Loops: [
          {
            Id: 'LOOP1',
            Name: 'Loop',
            Req: 'M',
            Max: 1,
            Segments: [
              {
                Id: 'N1',
                Name: 'Party Identification',
                Req: 'M',
                Max: 1,
                Elements: [
                  {
                    Id: 'N101',
                    Name: 'Entity Identifier Code',
                    DataType: 'ID',
                    MinLength: 2,
                    MaxLength: 3,
                    Req: 'M',
                    Codes: [
                      { Code: 'ST', Description: 'Ship To' },
                      { Code: 'BT', Description: 'Bill To' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = importOpenEDISpec(openEDI);
      const element = result.loops[0].segments[0].elements[0];

      expect(element.baseCodes).toBeDefined();
      expect(element.baseCodes).toHaveLength(2);
      expect(element.baseCodes![0].code).toBe('ST');
      expect(element.baseCodes![1].code).toBe('BT');
    });

    it('should generate unique IDs', () => {
      const openEDI: OpenEDITransactionSet = {
        TransactionSetId: '810',
        Name: 'Invoice',
        Version: '005010',
        Loops: [
          {
            Id: 'LOOP1',
            Name: 'Loop 1',
            Req: 'M',
            Max: 1,
          },
          {
            Id: 'LOOP2',
            Name: 'Loop 2',
            Req: 'O',
            Max: 1,
          },
        ],
      };

      const result = importOpenEDISpec(openEDI);

      expect(result.id).toBeDefined();
      expect(result.loops[0].id).toBeDefined();
      expect(result.loops[1].id).toBeDefined();
      expect(result.loops[0].id).not.toBe(result.loops[1].id);
    });

    it('should set metadata dates', () => {
      const openEDI: OpenEDITransactionSet = {
        TransactionSetId: '810',
        Name: 'Invoice',
        Version: '005010',
        Loops: [],
      };

      const before = new Date().toISOString();
      const result = importOpenEDISpec(openEDI);
      const after = new Date().toISOString();

      expect(result.metadata.createdDate >= before).toBe(true);
      expect(result.metadata.createdDate <= after).toBe(true);
      expect(result.metadata.modifiedDate).toBe(result.metadata.createdDate);
    });

    it('should set baseSpecReference in metadata', () => {
      const openEDI: OpenEDITransactionSet = {
        TransactionSetId: '810',
        Name: 'Invoice',
        Version: '005010',
        Loops: [],
      };

      const result = importOpenEDISpec(openEDI);

      expect(result.metadata.baseSpecReference).toBe('OpenEDI/005010/810');
    });
  });

  describe('parseAndImportSpec', () => {
    it('should handle legacy format', () => {
      const json = JSON.stringify({
        TransactionSetId: '810',
        Name: 'Invoice',
        Version: '005010',
        Loops: [],
      });

      const result = parseAndImportSpec(json);

      expect(result.metadata.transactionSet).toBe('810');
      expect(result.metadata.transactionSetName).toBe('Invoice');
    });

    it('should handle OpenAPI format', () => {
      const openAPIJson = JSON.stringify({
        openapi: '3.0.0',
        components: {
          schemas: {
            X12_00501_810: {
              'x-openedi-message-id': '810',
              properties: {
                ST: {
                  $ref: '#/components/schemas/ST',
                },
              },
            },
            ST: {
              'x-openedi-segment-id': 'ST',
              properties: {
                TransactionSetIdentifierCode_01: {
                  type: 'string',
                  format: 'X12_ID',
                  minLength: 3,
                  maxLength: 3,
                },
              },
              required: ['TransactionSetIdentifierCode_01'],
            },
          },
        },
      });

      const result = parseAndImportSpec(openAPIJson);

      expect(result.metadata.transactionSet).toBe('810');
      expect(result.metadata.baseSpecReference).toBe('EdiNation/OpenAPI/810');
      expect(result.loops).toHaveLength(1);
      expect(result.loops[0].name).toBe('TS810');
    });
  });

  describe('createEmptySpecification', () => {
    it('should create empty specification with known transaction set', () => {
      const result = createEmptySpecification('810', undefined, '005010');

      expect(result.metadata.transactionSet).toBe('810');
      expect(result.metadata.transactionSetName).toBe('Invoice');
      expect(result.metadata.ediVersion).toBe('005010');
      expect(result.loops).toHaveLength(0);
      expect(result.examples).toHaveLength(0);
    });

    it('should use custom name when provided', () => {
      const result = createEmptySpecification('810', 'My Custom Invoice', '005010');

      expect(result.metadata.name).toBe('My Custom Invoice');
    });

    it('should handle unknown transaction set', () => {
      const result = createEmptySpecification('123', undefined, '005010');

      expect(result.metadata.transactionSet).toBe('123');
      expect(result.metadata.name).toContain('123');
    });

    it('should use default EDI version', () => {
      const result = createEmptySpecification('810');

      expect(result.metadata.ediVersion).toBe('005010');
    });
  });

  describe('TRANSACTION_SET_TEMPLATES', () => {
    it('should have common transaction sets defined', () => {
      const commonSets = ['810', '850', '855', '856', '820', '997'];

      commonSets.forEach(ts => {
        expect(TRANSACTION_SET_TEMPLATES[ts]).toBeDefined();
        expect(TRANSACTION_SET_TEMPLATES[ts].name).toBeDefined();
        expect(TRANSACTION_SET_TEMPLATES[ts].description).toBeDefined();
      });
    });

    it('should have healthcare transaction sets', () => {
      const healthcareSets = ['270', '271', '276', '277', '834', '835', '837'];

      healthcareSets.forEach(ts => {
        expect(TRANSACTION_SET_TEMPLATES[ts]).toBeDefined();
      });
    });

    it('should have transportation transaction sets', () => {
      const transportationSets = ['204', '210', '214', '315', '990'];

      transportationSets.forEach(ts => {
        expect(TRANSACTION_SET_TEMPLATES[ts]).toBeDefined();
        expect(TRANSACTION_SET_TEMPLATES[ts].name).toBeDefined();
        expect(TRANSACTION_SET_TEMPLATES[ts].description).toBeDefined();
      });
    });

    it('should have acknowledgment transaction sets', () => {
      const acknowledgmentSets = ['997', '999'];

      acknowledgmentSets.forEach(ts => {
        expect(TRANSACTION_SET_TEMPLATES[ts]).toBeDefined();
        expect(TRANSACTION_SET_TEMPLATES[ts].name).toBeDefined();
      });
    });
  });
});
