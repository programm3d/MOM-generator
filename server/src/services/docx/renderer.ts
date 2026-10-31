import fs from 'fs';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  PageOrientation,
} from 'docx';
import { MeetingMinutes } from '../validation/schemas.js';
import { tempStorage } from '../../utils/temp-storage.js';

export interface RenderDocxOptions {
  includeSourceNotes?: boolean;
}

export interface RenderResult {
  filePath: string;
  fileName: string;
}

export async function renderMinutesToDocx(
  minutesData: MeetingMinutes,
  _originalFilename?: string,
  _options: RenderDocxOptions = {}
): Promise<RenderResult> {
  const meetingTitle = minutesData.meetingTitle || 'Meeting Minutes';
  const meetingDate = minutesData.meetingDate || 'Not specified';
  const generatedDate = new Date().toISOString().split('T')[0];

  // Title formatting matching benchmark: "Minutes of the [Title] Meeting"
  let displayTitle = 'Minutes of Meeting';
  if (minutesData.meetingTitle && minutesData.meetingTitle.trim() !== '') {
    const trimmed = minutesData.meetingTitle.trim();
    if (/^minutes of/i.test(trimmed)) {
      displayTitle = trimmed;
    } else if (/meeting$/i.test(trimmed)) {
      displayTitle = `Minutes of the ${trimmed}`;
    } else {
      displayTitle = `Minutes of the ${trimmed} Meeting`;
    }
  }

  // Column definitions for A4 Landscape (16838 dxa total, with 1080 margins each side -> 14678 dxa content width)
  const COL_WIDTHS = {
    slNo: 720,              // ~4.9%
    agendaPoint: 960,       // ~6.5%
    agenda: 2200,           // ~15.0%
    discussion: 5400,       // ~36.8%
    wayForward: 3800,       // ~25.9%
    responsiblePerson: 1600,// ~10.9%
  };

  const tableBorder = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: '000000',
  };

  const borders = {
    top: tableBorder,
    bottom: tableBorder,
    left: tableBorder,
    right: tableBorder,
  };

  const headerShading = {
    fill: '165B54', // Dark Teal / Pine Green matching benchmark sample
  };

  const headerCellMargins = {
    top: 140,
    bottom: 140,
    left: 140,
    right: 140,
  };

  const bodyCellMargins = {
    top: 120,
    bottom: 120,
    left: 140,
    right: 140,
  };

  // 1. Table Header Row (6 columns matching benchmark sample)
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: COL_WIDTHS.slNo, type: WidthType.DXA },
        shading: headerShading,
        margins: headerCellMargins,
        borders,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'SL No', bold: true, color: 'FFFFFF', size: 19 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: COL_WIDTHS.agendaPoint, type: WidthType.DXA },
        shading: headerShading,
        margins: headerCellMargins,
        borders,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Agenda Point', bold: true, color: 'FFFFFF', size: 19 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: COL_WIDTHS.agenda, type: WidthType.DXA },
        shading: headerShading,
        margins: headerCellMargins,
        borders,
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Agenda', bold: true, color: 'FFFFFF', size: 19 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: COL_WIDTHS.discussion, type: WidthType.DXA },
        shading: headerShading,
        margins: headerCellMargins,
        borders,
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Decision taken / Discussion', bold: true, color: 'FFFFFF', size: 19 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: COL_WIDTHS.wayForward, type: WidthType.DXA },
        shading: headerShading,
        margins: headerCellMargins,
        borders,
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Way forward / Plan', bold: true, color: 'FFFFFF', size: 19 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: COL_WIDTHS.responsiblePerson, type: WidthType.DXA },
        shading: headerShading,
        margins: headerCellMargins,
        borders,
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Responsible person', bold: true, color: 'FFFFFF', size: 19 })],
          }),
        ],
      }),
    ],
  });

  // 2. Data Rows
  const dataRows: TableRow[] = minutesData.minutes.map((item, index) => {
    // Collect discussion and decision points as bullets
    const discussionParagraphs: Paragraph[] = [];
    const points = item.discussionPoints || [];
    for (const rawPoint of points) {
      const cleanPoint = String(rawPoint).replace(/^[•\-\*\s]+/, '').trim();
      if (!cleanPoint) continue;
      discussionParagraphs.push(
        new Paragraph({
          spacing: { after: 60, line: 240 },
          children: [
            new TextRun({ text: '• ', bold: true, size: 18 }),
            new TextRun({ text: cleanPoint, size: 18 }),
          ],
        })
      );
    }

    // If legacy decisionMade exists and is not 'Not specified' and not already listed
    if (
      item.decisionMade &&
      item.decisionMade !== 'Not specified' &&
      !points.some((p) => p.includes(item.decisionMade!))
    ) {
      discussionParagraphs.push(
        new Paragraph({
          spacing: { after: 60, line: 240 },
          children: [
            new TextRun({ text: '• ', bold: true, size: 18 }),
            new TextRun({
              text: item.decisionMade.startsWith('Decision') ? item.decisionMade : `Decision: ${item.decisionMade}`,
              size: 18,
            }),
          ],
        })
      );
    }

    if (discussionParagraphs.length === 0) {
      discussionParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: 'Not specified', italics: true, size: 18 })],
        })
      );
    }

    // Collect way forward / plan items as bullets
    const wayForwardParagraphs: Paragraph[] = [];
    const plans = item.wayForward || [];
    for (const rawPlan of plans) {
      const cleanPlan = String(rawPlan).replace(/^[•\-\*\s]+/, '').trim();
      if (!cleanPlan) continue;
      wayForwardParagraphs.push(
        new Paragraph({
          spacing: { after: 60, line: 240 },
          children: [
            new TextRun({ text: '• ', bold: true, size: 18 }),
            new TextRun({ text: cleanPlan, size: 18 }),
          ],
        })
      );
    }

    // If legacy timeline exists and not 'Not specified' and not in plans
    if (
      item.timeline &&
      item.timeline !== 'Not specified' &&
      !plans.some((p) => p.includes(item.timeline!))
    ) {
      wayForwardParagraphs.push(
        new Paragraph({
          spacing: { after: 60, line: 240 },
          children: [
            new TextRun({ text: '• ', bold: true, size: 18 }),
            new TextRun({
              text: item.timeline.startsWith('Timeline') ? item.timeline : `Timeline: ${item.timeline}`,
              size: 18,
            }),
          ],
        })
      );
    }

    if (wayForwardParagraphs.length === 0) {
      wayForwardParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: 'Not specified', italics: true, size: 18 })],
        })
      );
    }

    const slNumber = item.slNo ?? item.agendaNo ?? index + 1;
    const agendaPoint = item.agendaPoint || `${index + 1}.1`;

    return new TableRow({
      cantSplit: true,
      children: [
        // 1. SL No
        new TableCell({
          width: { size: COL_WIDTHS.slNo, type: WidthType.DXA },
          margins: bodyCellMargins,
          borders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: String(slNumber), size: 18 })],
            }),
          ],
        }),
        // 2. Agenda Point
        new TableCell({
          width: { size: COL_WIDTHS.agendaPoint, type: WidthType.DXA },
          margins: bodyCellMargins,
          borders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: agendaPoint, size: 18 })],
            }),
          ],
        }),
        // 3. Agenda
        new TableCell({
          width: { size: COL_WIDTHS.agenda, type: WidthType.DXA },
          margins: bodyCellMargins,
          borders,
          children: [
            new Paragraph({
              children: [new TextRun({ text: item.agenda, bold: true, size: 18 })],
            }),
          ],
        }),
        // 4. Decision taken / Discussion
        new TableCell({
          width: { size: COL_WIDTHS.discussion, type: WidthType.DXA },
          margins: bodyCellMargins,
          borders,
          children: discussionParagraphs,
        }),
        // 5. Way forward / Plan
        new TableCell({
          width: { size: COL_WIDTHS.wayForward, type: WidthType.DXA },
          margins: bodyCellMargins,
          borders,
          children: wayForwardParagraphs,
        }),
        // 6. Responsible person
        new TableCell({
          width: { size: COL_WIDTHS.responsiblePerson, type: WidthType.DXA },
          margins: bodyCellMargins,
          borders,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: item.responsiblePerson || 'Not specified',
                  italics: item.responsiblePerson === 'Not specified',
                  size: 18,
                }),
              ],
            }),
          ],
        }),
      ],
    });
  });

  const table = new Table({
    width: { size: 14680, type: WidthType.DXA },
    rows: [headerRow, ...dataRows],
  });

  // Construct Header Elements matching benchmark document
  const headerElements: Paragraph[] = [
    // Main Document Title
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: displayTitle,
          bold: true,
          size: 34, // ~17pt
          color: '111827',
        }),
      ],
    }),

    // Date
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: 'Date: ', bold: true, size: 20 }),
        new TextRun({ text: meetingDate, size: 20 }),
      ],
    }),
  ];

  // Optional Time
  if (minutesData.meetingTime) {
    headerElements.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: 'Time: ', bold: true, size: 20 }),
          new TextRun({ text: minutesData.meetingTime, size: 20 }),
        ],
      })
    );
  }

  // Mode
  if (minutesData.meetingMode) {
    headerElements.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: 'Mode: ', bold: true, size: 20 }),
          new TextRun({ text: minutesData.meetingMode, size: 20 }),
        ],
      })
    );
  }

  // Attendees
  if (minutesData.attendees) {
    headerElements.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: 'Attendees: ', bold: true, size: 20 }),
          new TextRun({ text: minutesData.attendees, size: 20 }),
        ],
      })
    );
  }

  // Note / Caveats
  if (minutesData.notes) {
    const cleanNote = minutesData.notes.replace(/^Note:\s*/i, '');
    headerElements.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: `Note: ${cleanNote}`,
            italics: true,
            color: '555555',
            size: 18,
          }),
        ],
      })
    );
  } else {
    // Add small space before table if no note
    headerElements.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [],
      })
    );
  }

  // Construct Document with Landscape A4 dimensions
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: 16838,  // A4 Landscape width
              height: 11906, // A4 Landscape height
            },
            margin: {
              top: 1080,    // 0.75 inch
              bottom: 1080, // 0.75 inch
              left: 1080,   // 0.75 inch
              right: 1080,  // 0.75 inch
            },
          },
        },
        children: [
          ...headerElements,
          table,
        ],
      },
    ],
  });

  // Render to buffer and save to temp storage
  const buffer = await Packer.toBuffer(doc);

  // Generate safe filename: MoM_YYYY-MM-DD_<sanitized-title>.docx
  const cleanTitle = meetingTitle
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 30) || 'Meeting';
  const outFileName = `MoM_${generatedDate}_${cleanTitle}.docx`;

  const { filePath } = tempStorage.generateFilePath('.docx');
  await fs.promises.writeFile(filePath, buffer);

  return {
    filePath,
    fileName: outFileName,
  };
}
