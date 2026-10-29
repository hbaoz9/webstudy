import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { parseRosterExcel } from "./excelRoster";

function excelFile(rows: unknown[][], sheetCount = 1, name = "roster.xlsx"): File {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), "Roster");
  if (sheetCount > 1) utils.book_append_sheet(book, utils.aoa_to_sheet([["Extra"]]), "Extra");
  const buffer = write(book, { bookType: name.endsWith(".xls") ? "xls" : "xlsx", type: "array" }) as ArrayBuffer;
  return { name, size: buffer.byteLength, arrayBuffer: async () => buffer } as File;
}

describe("backend roster Excel preview", () => {
  it("reads valid rows, skips blank rows and keeps original Excel positions", async () => {
    const file = excelFile([["STT", "Họ và tên", "Mã học sinh"], [1, "Nguyễn An", "A-01"], [], [2, "Trần Bình", "A-02"]]);
    await expect(parseRosterExcel(file, "10A1", { backendImport: true })).resolves.toMatchObject([
      { excelRow: 2, orderNumber: 1, fullName: "Nguyễn An", studentCode: "A-01", errors: [] },
      { excelRow: 4, orderNumber: 2, fullName: "Trần Bình", studentCode: "A-02", errors: [] },
    ]);
  });

  it("reads legacy .xls workbooks", async () => {
    const rows = await parseRosterExcel(excelFile([["Họ và tên", "Mã học sinh"], ["Nguyễn An", "A-01"]], 1, "roster.xls"), "10A1", { backendImport: true });
    expect(rows[0]).toMatchObject({ fullName: "Nguyễn An", studentCode: "A-01", errors: [] });
  });

  it("rejects unsupported files, missing headers and multiple sheets", async () => {
    await expect(parseRosterExcel(excelFile([], 1, "roster.csv"), "10A1", { backendImport: true })).rejects.toThrow(".xlsx hoặc .xls");
    await expect(parseRosterExcel({ name: "empty.xlsx", size: 0 } as File, "10A1", { backendImport: true })).rejects.toThrow("File Excel trống");
    await expect(parseRosterExcel(excelFile([["Họ và tên"], ["An"]]), "10A1", { backendImport: true })).rejects.toThrow("Mã học sinh");
    await expect(parseRosterExcel(excelFile([["STT", "Họ và tên", "Mã học sinh"]]), "10A1", { backendImport: true })).rejects.toThrow("chưa có dữ liệu");
    await expect(parseRosterExcel(excelFile([["Họ và tên", "Mã học sinh"], ["An", "A-01"]], 2), "10A1", { backendImport: true })).rejects.toThrow("đúng một trang tính");
  });

  it("marks missing names, missing codes and normalized duplicate codes invalid without inventing identity", async () => {
    const rows = await parseRosterExcel(excelFile([
      ["Họ và tên", "Mã học sinh"], ["", "A-01"], ["Bình", ""], ["Chi", "a -01"],
    ]), "10A1", { backendImport: true });
    expect(rows[0].errors).toContain("Thiếu họ và tên");
    expect(rows[1].studentCode).toBe("");
    expect(rows[1].errors).toContain("Thiếu mã học sinh");
    expect(rows[0].errors.some((error) => error.includes("bị trùng"))).toBe(true);
    expect(rows[2].errors.some((error) => error.includes("bị trùng"))).toBe(true);
  });
});
