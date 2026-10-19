import type {
  RosterImportRow,
} from '../types/teacher';

type RawCell =
  | string
  | number
  | boolean
  | null
  | undefined;

type RawExcelRow = RawCell[];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function toText(value: RawCell) {
  return String(value ?? '').trim();
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getClassPrefix(className: string) {
  return className
    .replace(/^lớp\s+/i, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function normalizeStudentCode(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function findColumnIndex(
  headers: string[],
  acceptedNames: string[],
) {
  return headers.findIndex((header) =>
    acceptedNames.includes(header),
  );
}

export async function parseRosterExcel(
  file: File,
  className: string,
): Promise<RosterImportRow[]> {
  const isExcelFile = /\.(xlsx|xls)$/i.test(
    file.name,
  );

  if (!isExcelFile) {
    throw new Error(
      'Chỉ chấp nhận file Excel có định dạng .xlsx hoặc .xls.',
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      'File Excel không được lớn hơn 5 MB.',
    );
  }

  const {
    read,
    utils,
  } = await import('./sheetJsWrapper');

  const fileBuffer = await file.arrayBuffer();

  const workbook = read(fileBuffer, {
    type: 'array',
  });

  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error(
      'File Excel không có trang tính nào.',
    );
  }

  const worksheet =
    workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error(
      'Không thể đọc trang tính đầu tiên.',
    );
  }

  const rawRows =
    utils.sheet_to_json<RawExcelRow>(
      worksheet,
      {
        header: 1,
        defval: '',
        raw: false,
      },
    );

  if (rawRows.length < 2) {
    throw new Error(
      'File Excel chưa có dữ liệu học sinh.',
    );
  }

  const [headerRow, ...dataRows] = rawRows;

  const normalizedHeaders = headerRow.map(
    (cell) => normalizeHeader(toText(cell)),
  );

  const orderNumberColumn = findColumnIndex(
    normalizedHeaders,
    ['stt', 'so thu tu'],
  );

  const fullNameColumn = findColumnIndex(
    normalizedHeaders,
    ['ho va ten', 'ho ten', 'ten hoc sinh'],
  );

  const studentCodeColumn = findColumnIndex(
    normalizedHeaders,
    ['ma hoc sinh', 'ma hs'],
  );

  if (fullNameColumn === -1) {
    throw new Error(
      'Không tìm thấy cột "Họ và tên" trong file Excel.',
    );
  }

  const nonEmptyRows = dataRows
    .map((row, index) => ({
      row,
      excelRow: index + 2,
    }))
    .filter(({ row }) =>
      row.some((cell) => toText(cell) !== ''),
    );

  if (nonEmptyRows.length === 0) {
    throw new Error(
      'File Excel không có học sinh nào.',
    );
  }

  const classPrefix = getClassPrefix(className);

  const parsedRows: RosterImportRow[] =
    nonEmptyRows.map(
      ({ row, excelRow }, index) => {
        const fallbackOrderNumber =
          index + 1;

        const rawOrderNumber =
          orderNumberColumn >= 0
            ? toText(row[orderNumberColumn])
            : '';

        const parsedOrderNumber =
          Number(rawOrderNumber);

        const hasValidOrderNumber =
          rawOrderNumber === '' ||
          (
            Number.isInteger(parsedOrderNumber) &&
            parsedOrderNumber > 0
          );

        const orderNumber =
          rawOrderNumber !== '' &&
          hasValidOrderNumber
            ? parsedOrderNumber
            : fallbackOrderNumber;

        const fullName = toText(
          row[fullNameColumn],
        );

        const providedCode =
          studentCodeColumn >= 0
            ? normalizeStudentCode(
                toText(row[studentCodeColumn]),
              )
            : '';

        const studentCode =
          providedCode ||
          `${classPrefix}-${String(
            orderNumber,
          ).padStart(2, '0')}`;

        const errors: string[] = [];

        if (!fullName) {
          errors.push('Thiếu họ và tên');
        }

        if (!hasValidOrderNumber) {
          errors.push(
            'STT phải là số nguyên lớn hơn 0',
          );
        }

        return {
          excelRow,
          orderNumber,
          fullName,
          studentCode,
          codeSource: providedCode
            ? 'provided'
            : 'generated',
          errors,
        };
      },
    );

  const codeOccurrences = new Map<
    string,
    number
  >();

  parsedRows.forEach((row) => {
    codeOccurrences.set(
      row.studentCode,
      (codeOccurrences.get(
        row.studentCode,
      ) ?? 0) + 1,
    );
  });

  return parsedRows.map((row) => {
    const isDuplicate =
      (codeOccurrences.get(
        row.studentCode,
      ) ?? 0) > 1;

    if (!isDuplicate) {
      return row;
    }

    return {
      ...row,
      errors: [
        ...row.errors,
        `Mã học sinh ${row.studentCode} bị trùng`,
      ],
    };
  });
}

//mau san
export async function downloadRosterTemplate(
  className: string,
) {
  const {
    utils,
    writeFileXLSX,
  } = await import('./sheetJsWrapper');

  const classPrefix =
    getClassPrefix(className);

  const templateRows = [
    [
      'STT',
      'Họ và tên',
      'Mã học sinh',
    ],
    [
      1,
      'Nguyễn Văn A',
      `${classPrefix}-01`,
    ],
    [
      2,
      'Trần Thị B',
      '',
    ],
  ];

  const worksheet =
    utils.aoa_to_sheet(templateRows);

  worksheet['!cols'] = [
    { wch: 10 },
    { wch: 30 },
    { wch: 20 },
  ];

  const workbook = utils.book_new();

  utils.book_append_sheet(
    workbook,
    worksheet,
    'Danh sách học sinh',
  );

  writeFileXLSX(
    workbook,
    `mau-danh-sach-${classPrefix.toLowerCase()}.xlsx`,
  );
}