/**
 * PDF Generator for EDI Specifications
 * Creates professional PDF documents from specification data
 */

import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import {
  Specification,
  Loop,
  Segment,
  Element,
  Variant,
  UsageType,
  ExampleEDI,
} from '../shared/models/edi-types';

const COLORS = {
  primary: '#1a365d',
  secondary: '#2d3748',
  accent: '#3182ce',
  lightGray: '#e2e8f0',
  mediumGray: '#a0aec0',
  text: '#1a202c',
  muted: '#718096',
};

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  mono: 'Courier',
  monoBold: 'Courier-Bold',
};

function formatUsage(usage: UsageType): string {
  switch (usage) {
    case 'M': return 'Mandatory';
    case 'O': return 'Optional';
    case 'C': return 'Conditional';
    default: return usage;
  }
}

function formatCardinality(minUse: number, maxUse: number): string {
  if (maxUse === 1 && minUse <= 1) {
    return `${maxUse}`;
  }
  return `${minUse}..${maxUse > 9999 ? '>1' : maxUse}`;
}

export async function generatePDF(specification: Specification, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        bufferPages: true,
        info: {
          Title: specification.metadata.name,
          Author: 'EDI Specification Builder',
          Subject: `ANSI X12 ${specification.metadata.transactionSet} Implementation Guide`,
        },
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Title Page
      renderTitlePage(doc, specification);

      // Table of Contents
      doc.addPage();
      renderTableOfContents(doc, specification);

      // Main Content
      let loopNumber = 1;
      for (const loop of specification.loops) {
        doc.addPage();
        renderLoop(doc, loop, loopNumber, 0);
        loopNumber++;
      }

      // Examples Appendix
      if (specification.examples.length > 0) {
        doc.addPage();
        renderExamplesAppendix(doc, specification.examples);
      }

      // Add page numbers to all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        // Save current position
        const oldY = doc.y;

        // Add page number at bottom
        doc
          .font(FONTS.regular)
          .fontSize(9)
          .fillColor(COLORS.muted);

        // Use explicit x,y positioning and lineBreak: false to prevent new page creation
        const pageText = `Page ${i + 1} of ${range.count}`;
        const textWidth = doc.widthOfString(pageText);
        const centerX = (doc.page.width - textWidth) / 2;
        doc.text(pageText, centerX, doc.page.height - 50, { lineBreak: false });

        // Restore position to prevent side effects
        doc.y = oldY;
      }

      doc.end();

      stream.on('finish', () => resolve());
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

function renderTitlePage(doc: PDFKit.PDFDocument, spec: Specification): void {
  const { metadata } = spec;
  const centerX = doc.page.width / 2;

  doc.y = 200;

  doc
    .font(FONTS.bold)
    .fontSize(28)
    .fillColor(COLORS.primary)
    .text(metadata.name, { align: 'center' });

  doc.moveDown(0.5);

  doc
    .font(FONTS.regular)
    .fontSize(18)
    .fillColor(COLORS.secondary)
    .text(`Transaction Set ${metadata.transactionSet}`, { align: 'center' });

  doc.moveDown(0.5);

  doc
    .fontSize(14)
    .fillColor(COLORS.muted)
    .text(`ANSI X12 Version ${metadata.ediVersion}`, { align: 'center' });

  doc.moveDown(2);

  if (metadata.description) {
    doc
      .font(FONTS.regular)
      .fontSize(12)
      .fillColor(COLORS.text)
      .text(metadata.description, { align: 'center', width: 400 });
    doc.moveDown(2);
  }

  doc.y = doc.page.height - 200;

  const infoLines = [
    `Version: ${metadata.version}`,
    metadata.partner ? `Partner: ${metadata.partner}` : null,
    `Created: ${new Date(metadata.createdDate).toLocaleDateString()}`,
    `Modified: ${new Date(metadata.modifiedDate).toLocaleDateString()}`,
  ].filter(Boolean);

  doc.font(FONTS.regular).fontSize(10).fillColor(COLORS.muted);
  infoLines.forEach(line => {
    doc.text(line!, { align: 'center' });
  });
}

function renderTableOfContents(doc: PDFKit.PDFDocument, spec: Specification): void {
  doc
    .font(FONTS.bold)
    .fontSize(20)
    .fillColor(COLORS.primary)
    .text('Table of Contents');

  doc.moveDown(1);

  let itemNumber = 1;

  doc.font(FONTS.regular).fontSize(11).fillColor(COLORS.text);

  for (const loop of spec.loops) {
    doc.text(`${itemNumber}. ${loop.name} - ${loop.description || 'Loop'}`);
    renderTocLoop(doc, loop, `${itemNumber}`, 1);
    itemNumber++;
  }

  if (spec.examples.length > 0) {
    doc.moveDown(0.5);
    doc.text(`Appendix A: EDI Examples`);
  }
}

function renderTocLoop(doc: PDFKit.PDFDocument, loop: Loop, prefix: string, depth: number): void {
  const indent = 20 * depth;

  for (let i = 0; i < loop.segments.length; i++) {
    const seg = loop.segments[i];
    doc.text(`${prefix}.${i + 1} ${seg.name} - ${seg.description}`, 72 + indent);
  }

  for (let i = 0; i < loop.loops.length; i++) {
    const childLoop = loop.loops[i];
    const childPrefix = `${prefix}.${loop.segments.length + i + 1}`;
    doc.text(`${childPrefix} ${childLoop.name} - ${childLoop.description || 'Loop'}`, 72 + indent);
    renderTocLoop(doc, childLoop, childPrefix, depth + 1);
  }
}

function renderLoop(doc: PDFKit.PDFDocument, loop: Loop, number: number, depth: number): void {
  const indent = 20 * depth;

  // Check for page break
  if (doc.y > doc.page.height - 150) {
    doc.addPage();
  }

  // Loop Header
  doc
    .font(FONTS.bold)
    .fontSize(16 - depth)
    .fillColor(COLORS.primary)
    .text(`${loop.name} Loop`, 72 + indent);

  if (loop.description) {
    doc
      .font(FONTS.regular)
      .fontSize(11)
      .fillColor(COLORS.secondary)
      .text(loop.description, 72 + indent);
  }

  doc.moveDown(0.3);

  // Loop metadata
  const loopUsageText = loop.maxUse > 1
    ? `Usage: ${formatUsage(loop.usage)} | Repeat: ${formatCardinality(loop.minUse, loop.maxUse)}`
    : `Usage: ${formatUsage(loop.usage)}`;
  doc
    .font(FONTS.regular)
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(loopUsageText, 72 + indent);

  if (loop.conditionDescription) {
    doc.moveDown(0.3);
    doc
      .font(FONTS.regular)
      .fontSize(10)
      .fillColor(COLORS.accent)
      .text(`Condition: ${loop.conditionDescription}`, 72 + indent);
  }

  if (loop.comments) {
    doc.moveDown(0.3);
    doc
      .font(FONTS.regular)
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(loop.comments, 72 + indent, undefined, { width: doc.page.width - 144 - indent });
  }

  // Variants
  if (loop.variants && loop.variants.length > 0) {
    doc.moveDown(0.5);
    renderVariants(doc, loop.variants, indent);
  }

  doc.moveDown(0.5);

  // Segments
  for (const segment of loop.segments) {
    renderSegment(doc, segment, depth);
  }

  // Nested Loops
  for (let i = 0; i < loop.loops.length; i++) {
    renderLoop(doc, loop.loops[i], i + 1, depth + 1);
  }
}

function renderVariants(doc: PDFKit.PDFDocument, variants: Variant[], indent: number): void {
  doc
    .font(FONTS.bold)
    .fontSize(11)
    .fillColor(COLORS.secondary)
    .text('Variants:', 72 + indent);

  for (const variant of variants) {
    doc.moveDown(0.3);
    doc
      .font(FONTS.bold)
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(`• ${variant.label}`, 72 + indent + 10);

    // Discriminator conditions
    for (const disc of variant.discriminators) {
      const values = disc.values.join(', ');
      const condition = disc.operator === 'equals'
        ? `${disc.elementId} = ${values}`
        : `${disc.elementId} in (${values})`;
      doc
        .font(FONTS.regular)
        .fontSize(9)
        .fillColor(COLORS.accent)
        .text(`Applies when: ${condition}`, 72 + indent + 20);
    }

    if (variant.usageOverride) {
      doc
        .font(FONTS.regular)
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(`Usage: ${formatUsage(variant.usageOverride)}`, 72 + indent + 20);
    }

    if (variant.comments) {
      doc
        .font(FONTS.regular)
        .fontSize(9)
        .fillColor(COLORS.text)
        .text(variant.comments, 72 + indent + 20);
    }
  }
}

function renderSegment(doc: PDFKit.PDFDocument, segment: Segment, depth: number): void {
  const indent = 20 * depth;

  // Check for page break
  if (doc.y > doc.page.height - 200) {
    doc.addPage();
  }

  // Segment Header
  
  doc
    .font(FONTS.bold)
    .fontSize(12)
    .fillColor(COLORS.secondary)
    .text(`${segment.name} - ${segment.description}`, 72 + indent);

  const segmentUsageText = segment.maxUse > 1
    ? `Usage: ${formatUsage(segment.usage)} | Repeat: ${formatCardinality(segment.minUse, segment.maxUse)}`
    : `Usage: ${formatUsage(segment.usage)}`;
  doc
    .font(FONTS.regular)
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(segmentUsageText, 72 + indent);

  if (segment.conditionDescription) {
    doc
      .font(FONTS.regular)
      .fontSize(9)
      .fillColor(COLORS.accent)
      .text(`Condition: ${segment.conditionDescription}`, 72 + indent);
  }

  if (segment.comments) {
    doc.moveDown(0.2);
    doc
      .font(FONTS.regular)
      .fontSize(9)
      .fillColor(COLORS.text)
      .text(segment.comments, 72 + indent, undefined, { width: doc.page.width - 144 - indent });
  }

  if (segment.example) {
    doc.moveDown(0.2);
    doc
      .font(FONTS.mono)
      .fontSize(9)
      .fillColor(COLORS.accent)
      .text(`Example: ${segment.example.value}`, 72 + indent);
  }

  // Variants
  if (segment.variants && segment.variants.length > 0) {
    doc.moveDown(0.3);
    renderVariants(doc, segment.variants, indent);
  }

  doc.moveDown(0.5);

  // Elements Table
  renderElementsTable(doc, segment.elements, indent);

  doc.moveDown(1);
}

function renderElementsTable(doc: PDFKit.PDFDocument, elements: Element[], indent: number): void {
  const tableLeft = 72 + indent;
  const tableWidth = doc.page.width - 144 - indent;
  const colWidths = {
    pos: 30,
    name: tableWidth * 0.35,
    type: 50,
    usage: 40,
    desc: tableWidth - 30 - tableWidth * 0.35 - 50 - 40,
  };

  // Table Header
  const headerY = doc.y;
  doc
    .rect(tableLeft, headerY, tableWidth, 18)
    .fill(COLORS.lightGray);

  doc
    .font(FONTS.bold)
    .fontSize(8)
    .fillColor(COLORS.text);

  let x = tableLeft + 4;
  doc.text('Pos', x, headerY + 5, { width: colWidths.pos });
  x += colWidths.pos;
  doc.text('Element Name', x, headerY + 5, { width: colWidths.name });
  x += colWidths.name;
  doc.text('Type', x, headerY + 5, { width: colWidths.type });
  x += colWidths.type;
  doc.text('Usage', x, headerY + 5, { width: colWidths.usage });
  x += colWidths.usage;
  doc.text('Notes', x, headerY + 5, { width: colWidths.desc });

  doc.y = headerY + 20;

  // Table Rows
  for (const element of elements) {
    // Check for page break
    if (doc.y > doc.page.height - 100) {
      doc.addPage();
    }

    const rowY = doc.y;
    const rowHeight = calculateElementRowHeight(doc, element, colWidths);

    // Alternating row background
    if (element.position % 2 === 0) {
      doc.rect(tableLeft, rowY, tableWidth, rowHeight).fill('#f7fafc');
    }

    doc.font(FONTS.regular).fontSize(8).fillColor(COLORS.text);

    x = tableLeft + 4;
    doc.text(String(element.position).padStart(2, '0'), x, rowY + 4, { width: colWidths.pos });
    x += colWidths.pos;
    doc.text(element.name, x, rowY + 4, { width: colWidths.name - 8 });
    x += colWidths.name;
    doc.text(`${element.dataType} ${element.minLength}-${element.maxLength}`, x, rowY + 4, { width: colWidths.type });
    x += colWidths.type;
    doc.text(element.usage, x, rowY + 4, { width: colWidths.usage });
    x += colWidths.usage;

    // Notes column (comments, condition, codes)
    let noteY = rowY + 4;
    if (element.conditionDescription) {
      doc.font(FONTS.regular).fontSize(7).fillColor(COLORS.accent);
      doc.text(element.conditionDescription, x, noteY, { width: colWidths.desc - 8 });
      noteY += doc.heightOfString(element.conditionDescription, { width: colWidths.desc - 8 }) + 2;
    }

    if (element.comments) {
      doc.font(FONTS.regular).fontSize(7).fillColor(COLORS.muted);
      doc.text(element.comments, x, noteY, { width: colWidths.desc - 8 });
      noteY += doc.heightOfString(element.comments, { width: colWidths.desc - 8 }) + 2;
    }

    if (element.example) {
      doc.font(FONTS.mono).fontSize(7).fillColor(COLORS.accent);
      doc.text(`Ex: ${element.example.value}`, x, noteY, { width: colWidths.desc - 8 });
      noteY += 10;
    }

    // Code values
    if (element.codeValues && element.codeValues.filter(c => c.included).length > 0) {
      const includedCodes = element.codeValues.filter(c => c.included);
      if (includedCodes.length <= 5) {
        for (const code of includedCodes) {
          doc.font(FONTS.mono).fontSize(7).fillColor(COLORS.text);
          doc.text(`${code.code}: ${code.description}`, x, noteY, { width: colWidths.desc - 8 });
          noteY += 9;
        }
      } else {
        doc.font(FONTS.regular).fontSize(7).fillColor(COLORS.muted);
        doc.text(`(${includedCodes.length} code values - see code list)`, x, noteY, { width: colWidths.desc - 8 });
      }
    }

    doc.y = rowY + rowHeight;
  }

  // Table border
  doc.rect(tableLeft, headerY, tableWidth, doc.y - headerY).stroke(COLORS.lightGray);
}

function calculateElementRowHeight(doc: PDFKit.PDFDocument, element: Element, colWidths: { desc: number }): number {
  let height = 16;

  if (element.conditionDescription) {
    height += doc.heightOfString(element.conditionDescription, { width: colWidths.desc - 8 }) + 2;
  }
  if (element.comments) {
    height += doc.heightOfString(element.comments, { width: colWidths.desc - 8 }) + 2;
  }
  if (element.example) {
    height += 10;
  }
  if (element.codeValues) {
    const includedCodes = element.codeValues.filter(c => c.included);
    if (includedCodes.length > 0 && includedCodes.length <= 5) {
      height += includedCodes.length * 9;
    } else if (includedCodes.length > 5) {
      height += 12;
    }
  }

  return Math.max(height, 20);
}

function renderExamplesAppendix(doc: PDFKit.PDFDocument, examples: ExampleEDI[]): void {
  doc
    .font(FONTS.bold)
    .fontSize(20)
    .fillColor(COLORS.primary)
    .text('Appendix A: EDI Examples');

  doc.moveDown(1);

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];

    // Check for page break
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
      doc
        .font(FONTS.bold)
        .fontSize(12)
        .fillColor(COLORS.secondary)
        .text(`${example.title} (continued)`);
      doc.moveDown(0.5);
    }

    doc
      .font(FONTS.bold)
      .fontSize(14)
      .fillColor(COLORS.secondary)
      .text(`Example ${i + 1}: ${example.title}`);

    if (example.description) {
      doc.moveDown(0.3);
      doc
        .font(FONTS.regular)
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(example.description);
    }

    doc.moveDown(0.5);

    // EDI Content in monospace
    const ediLines = example.content.split('\n');
    doc.font(FONTS.mono).fontSize(8).fillColor(COLORS.text);

    // Background for code block
    const codeBlockY = doc.y;
    const lineHeight = 10;
    let totalHeight = ediLines.length * lineHeight + 16;

    // Render EDI content with pagination
    for (const line of ediLines) {
      if (doc.y > doc.page.height - 50) {
        doc.addPage();
        doc
          .font(FONTS.bold)
          .fontSize(10)
          .fillColor(COLORS.muted)
          .text(`${example.title} (continued)`);
        doc.moveDown(0.5);
        doc.font(FONTS.mono).fontSize(8).fillColor(COLORS.text);
      }
      doc.text(line, 80, undefined, { width: doc.page.width - 160 });
    }

    doc.moveDown(1.5);
  }
}
