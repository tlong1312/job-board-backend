import * as fs from "fs";

export class CvReadError extends Error {}

const MIN_CHARS = 80;

export function cleanCvText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function readCvText(
  filePath: string,
  mimeType: string | null,
): Promise<string> {
  if (!fs.existsSync(filePath))
    throw new CvReadError("Không tìm thấy file CV trên máy chủ");
  const lower = filePath.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isDocx =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx");

  let raw: string;
  try {
    if (isPdf) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
        b: Buffer,
      ) => Promise<{ text: string }>;
      raw = (await pdfParse(fs.readFileSync(filePath))).text;
    } else if (isDocx) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require("mammoth") as {
        extractRawText(o: { path: string }): Promise<{ value: string }>;
      };
      raw = (await mammoth.extractRawText({ path: filePath })).value;
    } else {
      throw new CvReadError(
        "Định dạng .doc cũ chưa hỗ trợ. Hãy lưu lại thành .docx hoặc PDF",
      );
    }
  } catch (e) {
    if (e instanceof CvReadError) throw e;
    throw new CvReadError(
      `Không đọc được file CV: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const text = cleanCvText(raw);
  if (text.length < MIN_CHARS) {
    throw new CvReadError(
      "File gần như không có chữ (có thể là PDF dạng ảnh scan), chưa đọc được",
    );
  }
  return text;
}
