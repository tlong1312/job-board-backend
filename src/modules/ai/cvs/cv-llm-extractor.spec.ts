import {
  LlmExtractError,
  buildCvPrompt,
  cvExtractorMode,
  extractCvInfoWithLlm,
  normalizeProvince,
  parseLlmCv,
} from "./cv-llm-extractor";
import { LlmProvider } from "../providers/llm.provider";

const CV =
  "Ứng viên A | Địa điểm: Hà Nội | Kỹ năng | NestJS, TypeScript, Node.js, PostgreSQL, Docker | " +
  "Kinh nghiệm làm việc | 2023 - 2025 (2 năm), công ty X: phát triển API bằng NestJS và Docker.";

const fakeLlm = (reply: string): LlmProvider => ({
  model: "fake",
  completeJson: () => Promise.resolve(reply),
});

describe("parseLlmCv", () => {
  it("đọc JSON hợp lệ và đưa kỹ năng về tên chuẩn trong từ điển", () => {
    const info = parseLlmCv(
      JSON.stringify({
        skills: ["Nest.js", "TS", "Docker"],
        years: 2,
        province: "Ha Noi",
        desiredTitle: "Backend Developer",
      }),
      CV,
    );
    expect(info).not.toBeNull();
    expect(info!.skills).toEqual(["Docker", "NestJS", "TypeScript"]);
    expect(info!.years).toBe(2);
    expect(info!.level).toBe("middle");
    expect(info!.province).toBe("Hà Nội");
    expect(info!.desiredTitle).toBe("Backend Developer");
    expect(info!.extractor).toBe("llm");
  });

  it("bỏ kỹ năng LLM bịa: không có trong từ điển hoặc không xuất hiện trong CV", () => {
    const info = parseLlmCv(
      JSON.stringify({
        skills: ["Docker", "Kubernetes", "CobolMaster"],
        years: 1,
      }),
      CV,
    );
    // Kubernetes có trong từ điển nhưng CV không nhắc tới; CobolMaster không có trong từ điển
    expect(info!.skills).toEqual(["Docker"]);
  });

  it("chấp nhận JSON bị bọc trong ```json hoặc kèm vài chữ", () => {
    const raw =
      'Đây là kết quả:\n```json\n{"skills": ["Docker"], "years": 2}\n```';
    expect(parseLlmCv(raw, CV)!.skills).toEqual(["Docker"]);
  });

  it("trả null khi không phải JSON hoặc thiếu trường skills", () => {
    expect(parseLlmCv("xin lỗi, tôi không biết", CV)).toBeNull();
    expect(parseLlmCv('["Docker"]', CV)).toBeNull();
    expect(parseLlmCv('{"years": 2}', CV)).toBeNull();
  });

  it("số năm không hợp lệ thì coi như không rút được", () => {
    expect(parseLlmCv('{"skills": [], "years": -3}', CV)!.years).toBeNull();
    expect(parseLlmCv('{"skills": [], "years": 99}', CV)!.years).toBeNull();
    expect(parseLlmCv('{"skills": [], "years": "abc"}', CV)!.years).toBeNull();
    expect(parseLlmCv('{"skills": [], "years": "2,5"}', CV)!.years).toBe(2.5);
  });

  it("cấp độ tính từ số năm bằng quy tắc cũ, không hỏi LLM", () => {
    const level = (years: number) =>
      parseLlmCv(JSON.stringify({ skills: [], years }), CV)!.level;
    expect(level(0)).toBe("intern");
    expect(level(1)).toBe("junior");
    expect(level(3)).toBe("middle");
    expect(level(6)).toBe("senior");
  });
});

describe("normalizeProvince", () => {
  it("đưa các cách viết về một dạng chuẩn", () => {
    expect(normalizeProvince("TP.HCM")).toBe("TP. Hồ Chí Minh");
    expect(normalizeProvince("Hanoi")).toBe("Hà Nội");
    expect(normalizeProvince("Hai Phong")).toBe("Hải Phòng");
    expect(normalizeProvince("  ")).toBeNull();
    expect(normalizeProvince("Huế")).toBe("Huế");
  });
});

describe("extractCvInfoWithLlm", () => {
  it("trả CvInfo khi LLM trả JSON dùng được", async () => {
    const info = await extractCvInfoWithLlm(
      fakeLlm('{"skills":["NestJS"],"years":2}'),
      CV,
    );
    expect(info.skills).toEqual(["NestJS"]);
  });

  it("ném LlmExtractError khi LLM trả rác (để nơi gọi quay về từ điển)", async () => {
    await expect(
      extractCvInfoWithLlm(fakeLlm("không phải json"), CV),
    ).rejects.toBeInstanceOf(LlmExtractError);
  });
});

describe("buildCvPrompt", () => {
  it("liệt kê kỹ năng chuẩn trong từ điển và cắt CV quá dài", () => {
    const { system, user } = buildCvPrompt("x".repeat(20000));
    expect(system).toContain("NestJS");
    expect(system).toContain("Docker");
    expect(user.length).toBeLessThan(5100);
  });
});

describe("cvExtractorMode", () => {
  const old = process.env.CV_EXTRACTOR;
  afterEach(() => {
    if (old === undefined) delete process.env.CV_EXTRACTOR;
    else process.env.CV_EXTRACTOR = old;
  });

  it("mặc định là rules, chỉ bật llm khi đặt đúng", () => {
    delete process.env.CV_EXTRACTOR;
    expect(cvExtractorMode()).toBe("rules");
    process.env.CV_EXTRACTOR = "LLM";
    expect(cvExtractorMode()).toBe("llm");
    process.env.CV_EXTRACTOR = "gi-do-khac";
    expect(cvExtractorMode()).toBe("rules");
  });
});
