import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SchoolSettings } from '../types/portal';
import type { RecapMatrixResult } from '../utils/grading';

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith('data:image/')) return src;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 128;
        canvas.height = img.naturalHeight || 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function createRecapPdfDocument(params: {
  settings: SchoolSettings;
  className: string;
  academicYear: string;
  semester: string;
  periodName: string;
  matrix: RecapMatrixResult;
}): Promise<jsPDF> {
  const { settings, className, academicYear, semester, periodName, matrix } = params;
  const format = matrix.paperFormat; // 'a4' or 'a3' landscape based on subject count
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;

  // Load Madrasah Emblem Logo
  const logoDataUrl = await loadImageAsDataUrl(settings.logoUrl);
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', marginX, 10, 20, 20);
    } catch {
      // Ignore logo decode issues gracefully
    }
  }

  // KOP Madrasah
  const centerX = pageWidth / 2;
  doc.setTextColor(6, 95, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(settings.schoolName.toUpperCase(), centerX, 15, { align: 'center' });

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  if (settings.reportHeader) {
    doc.text(settings.reportHeader, centerX, 20.5, { align: 'center' });
  }
  if (settings.address) {
    doc.text(settings.address, centerX, 25.5, { align: 'center' });
  }

  // Double horizontal rule under KOP
  doc.setDrawColor(4, 120, 87);
  doc.setLineWidth(0.8);
  doc.line(marginX, 32, pageWidth - marginX, 32);
  doc.setLineWidth(0.25);
  doc.line(marginX, 33.2, pageWidth - marginX, 33.2);

  // Report Identity
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('REKAPITULASI NILAI HASIL BELAJAR SANTRI', centerX, 40, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Kelas: ${className}   |   Tahun Pelajaran: ${academicYear}   |   Semester: ${semester}   |   Periode: ${periodName}`,
    centerX,
    46,
    { align: 'center' }
  );

  // Table Headers & Body
  const head = [
    [
      'NO',
      'NAMA SANTRI',
      ...matrix.subjects.map((sub) => sub.name.toUpperCase()),
      'RATA-RATA',
    ],
  ];

  const body = matrix.rows.map((row) => [
    String(row.no),
    row.studentName,
    ...matrix.subjects.map((sub) => {
      const val = row.scoresBySubjectId[sub.id];
      return val === null || val === undefined ? '-' : String(val);
    }),
    row.average === null ? '-' : String(row.average),
  ]);

  const subjectFontSize = format === 'a3' ? 9.5 : 9.5;

  autoTable(doc, {
    startY: 51,
    head,
    body,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: subjectFontSize,
      cellPadding: 2.8,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [4, 120, 87],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 11 },
      1: { halign: 'left', cellWidth: 52 },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index >= 2) {
        data.cell.styles.halign = 'center';
      }
    },
  });

  // Signature Block
  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 120;
  let sigY = finalY + 12;
  if (sigY + 34 > pageHeight - 10) {
    doc.addPage(format, 'landscape');
    sigY = 24;
  }

  const sigX = pageWidth - marginX - 65;
  const dateLabel = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Ditetapkan pada ${dateLabel}`, sigX, sigY);
  doc.text('Kepala Madrasah,', sigX, sigY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text(settings.headmasterName || 'Kepala Madrasah Diniyah', sigX, sigY + 25);
  if (settings.headmasterNip) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`NIP. ${settings.headmasterNip}`, sigX, sigY + 30);
  }

  return doc;
}

export async function downloadRecapPdf(params: {
  settings: SchoolSettings;
  className: string;
  academicYear: string;
  semester: string;
  periodName: string;
  matrix: RecapMatrixResult;
}): Promise<void> {
  const doc = await createRecapPdfDocument(params);
  const safeClass = params.className.replace(/\s+/g, '_').toLowerCase();
  doc.save(`rekap_nilai_${safeClass}_${params.semester.toLowerCase()}.pdf`);
}
