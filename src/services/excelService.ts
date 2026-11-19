import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import type {
  ClassRoom,
  SchoolSettings,
  Student,
  UstazCombined,
} from '../types/portal';
import {
  validateStudentSheetRows,
  validateUstazImportRow,
  type StudentImportValidation,
  type UstazImportValidation,
} from '../utils/validation';
import type { RecapMatrixResult } from '../utils/grading';

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function assertXlsxFile(file: File) {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
    throw new Error('Format file tidak didukung. Harap unggah file Excel (.xlsx), bukan CSV.');
  }
}

export interface ParsedStudentImportResult {
  fileName: string;
  sheetName: string;
  rows: StudentImportValidation[];
}

// ==================== SANTRI (STUDENTS) XLSX ====================
export async function parseStudentsXlsx(
  file: File,
  classes: ClassRoom[],
  existingStudents: { name: string; classId: string }[] = []
): Promise<ParsedStudentImportResult> {
  assertXlsxFile(file);
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Excel tidak memiliki lembar kerja (sheet).');
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const rows = validateStudentSheetRows(rawRows, classes, existingStudents);
  if (rows.length === 0) {
    throw new Error('Lembar kerja kosong. Silakan isi data santri sesuai template.');
  }

  return {
    fileName: file.name,
    sheetName: firstSheetName,
    rows,
  };
}

export async function downloadStudentTemplateXlsx(classes: ClassRoom[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Template Santri');

  ws.columns = [
    { header: 'Nama Santri', key: 'name', width: 32 },
    { header: 'Jenis Kelamin (L/P)', key: 'gender', width: 22 },
    { header: 'Kelas', key: 'className', width: 22 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF047857' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 24;

  if (classes[0]) {
    ws.addRow({ name: 'Contoh Nama Santri Putra', gender: 'L', className: classes[0].name });
    ws.addRow({ name: 'Contoh Nama Santri Putri', gender: 'P', className: classes[0].name });
  }

  const guide = wb.addWorksheet('Panduan Pengisian');
  guide.columns = [{ header: 'Keterangan', key: 'info', width: 65 }];
  guide.addRow({ info: '1. Isi kolom Nama Santri dengan nama lengkap (2-120 karakter).' });
  guide.addRow({ info: '2. Isi kolom Jenis Kelamin dengan huruf L (Laki-laki) atau P (Perempuan).' });
  guide.addRow({
    info: `3. Nama Kelas harus sama persis dengan daftar kelas aktif: ${classes.map((c) => c.name).join(', ') || 'Belum ada kelas — buat kelas terlebih dahulu di menu Pemetaan Tugas'}`,
  });

  const buffer = await wb.xlsx.writeBuffer();
  triggerBlobDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'template_import_santri_madin.xlsx'
  );
}

export async function exportStudentsXlsx(students: Student[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data Santri');

  ws.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'Nama Santri', key: 'name', width: 34 },
    { header: 'Jenis Kelamin', key: 'gender', width: 16 },
    { header: 'Kelas', key: 'className', width: 20 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF047857' },
  };
  headerRow.height = 24;

  students.forEach((student, index) => {
    ws.addRow({
      no: index + 1,
      name: student.name,
      gender: student.gender,
      className: student.className,
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  triggerBlobDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `data_santri_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

// ==================== USTAZ XLSX ====================
export async function parseUstazXlsx(file: File): Promise<UstazImportValidation[]> {
  assertXlsxFile(file);
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Excel tidak memiliki lembar kerja.');
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length === 0) {
    throw new Error('Lembar kerja kosong. Silakan isi data ustaz sesuai template.');
  }

  return rows.map((row, idx) => {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[k.trim().toLowerCase()] = v;
    }
    const rawName = normalized['nama ustaz'] ?? normalized['nama'] ?? '';
    const rawWa = normalized['nomor whatsapp'] ?? normalized['whatsapp'] ?? normalized['no hp'] ?? '';
    const rawPin = normalized['pin akses'] ?? normalized['pin'] ?? '';
    const rawStatus = normalized['status'] ?? 'Aktif';

    return validateUstazImportRow(idx + 2, rawName, rawWa, rawPin, rawStatus);
  });
}

export async function downloadUstazTemplateXlsx(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Template Ustaz');

  ws.columns = [
    { header: 'Nama Ustaz', key: 'name', width: 32 },
    { header: 'Nomor WhatsApp', key: 'whatsapp', width: 22 },
    { header: 'PIN Akses', key: 'pin', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF047857' },
  };
  headerRow.height = 24;

  const guide = wb.addWorksheet('Panduan Pengisian');
  guide.columns = [{ header: 'Keterangan', key: 'info', width: 65 }];
  guide.addRow({ info: '1. Isi kolom Nama Ustaz dengan nama lengkap pengampu (2-120 karakter).' });
  guide.addRow({ info: '2. Isi Nomor WhatsApp dengan angka aktif (misal: 0812xxxxxxxx).' });
  guide.addRow({ info: '3. Isi PIN Akses dengan 4-8 digit angka.' });
  guide.addRow({ info: '4. Isi Status dengan Aktif atau Nonaktif.' });

  const buffer = await wb.xlsx.writeBuffer();
  triggerBlobDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'template_import_ustaz_madin.xlsx'
  );
}

export async function exportUstazXlsx(ustazList: UstazCombined[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Daftar Ustaz');

  ws.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'Nama Ustaz', key: 'name', width: 34 },
    { header: 'Nomor WhatsApp', key: 'whatsapp', width: 22 },
    { header: 'Status', key: 'status', width: 16 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF047857' },
  };
  headerRow.height = 24;

  ustazList.forEach((u, index) => {
    ws.addRow({
      no: index + 1,
      name: u.name,
      whatsapp: u.whatsapp || '-',
      status: u.isActive ? 'Aktif' : 'Nonaktif',
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  triggerBlobDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `daftar_ustaz_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

// ==================== REKAP NILAI MATRIKS XLSX ====================
export async function exportRecapMatrixXlsx(params: {
  settings: SchoolSettings;
  className: string;
  academicYear: string;
  semester: string;
  periodName: string;
  matrix: RecapMatrixResult;
}): Promise<void> {
  const { settings, className, academicYear, semester, periodName, matrix } = params;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Rekap ${className}`.slice(0, 31));

  const totalCols = 3 + matrix.subjects.length;

  ws.mergeCells(1, 1, 1, totalCols);
  ws.getCell(1, 1).value = settings.schoolName.toUpperCase();
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF065F46' } };
  ws.getCell(1, 1).alignment = { horizontal: 'center' };

  ws.mergeCells(2, 1, 2, totalCols);
  ws.getCell(2, 1).value = `REKAPITULASI NILAI SANTRI · KELAS ${className.toUpperCase()}`;
  ws.getCell(2, 1).font = { bold: true, size: 11 };
  ws.getCell(2, 1).alignment = { horizontal: 'center' };

  ws.mergeCells(3, 1, 3, totalCols);
  ws.getCell(3, 1).value = `Tahun Pelajaran ${academicYear} · Semester ${semester} · ${periodName}`;
  ws.getCell(3, 1).font = { size: 10, color: { argb: 'FF475569' } };
  ws.getCell(3, 1).alignment = { horizontal: 'center' };

  const headerValues = [
    'NO',
    'NAMA SANTRI',
    ...matrix.subjects.map((s) => s.name.toUpperCase()),
    'RATA-RATA',
  ];
  const headerRow = ws.getRow(5);
  headerRow.values = headerValues;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF047857' },
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 28;

  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 30;
  matrix.subjects.forEach((_, idx) => {
    ws.getColumn(3 + idx).width = 16;
  });
  ws.getColumn(totalCols).width = 14;

  matrix.rows.forEach((row) => {
    const rowValues: (string | number)[] = [
      row.no,
      row.studentName,
      ...matrix.subjects.map((sub) => {
        const val = row.scoresBySubjectId[sub.id];
        return val === null || val === undefined ? '-' : val;
      }),
      row.average === null ? '-' : row.average,
    ];
    const excelRow = ws.addRow(rowValues);
    excelRow.height = 22;
    excelRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    excelRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    for (let c = 3; c <= totalCols; c++) {
      excelRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  triggerBlobDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `rekap_nilai_${className.replace(/\s+/g, '_').toLowerCase()}_${semester.toLowerCase()}.xlsx`
  );
}
