export function normalizeClassName(
  value: string,
) {
  return value
    .trim()
    .replace(/^lớp\s+/i, '')
    .replace(/\s+/g, ' ');
}

export function getComparableClassName(
  value: string,
) {
  return normalizeClassName(value)
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function generateUniqueClassCode(
  existingCodes: string[],
) {
  const characters =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const usedCodes = new Set(
    existingCodes.map((code) =>
      code.toUpperCase(),
    ),
  );

  for (
    let attempt = 0;
    attempt < 20;
    attempt += 1
  ) {
    const randomValues =
      new Uint32Array(6);

    window.crypto.getRandomValues(
      randomValues,
    );

    const generatedCode =
      Array.from(
        randomValues,
        (value) =>
          characters[
            value %
              characters.length
          ],
      ).join('');

    if (
      !usedCodes.has(
        generatedCode,
      )
    ) {
      return generatedCode;
    }
  }

  return Date.now()
    .toString(36)
    .slice(-6)
    .toUpperCase();
}

export function getAcademicYearOptions() {
  const currentYear =
    new Date().getFullYear();

  return [
    `${currentYear - 1}-${currentYear}`,
    `${currentYear}-${currentYear + 1}`,
    `${currentYear + 1}-${currentYear + 2}`,
  ];
}