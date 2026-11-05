import { escapeHtml, renderStatusEmail } from "./mail.templates";

describe("escapeHtml", () => {
  it("thoát các ký tự đặc biệt của HTML", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;",
    );
  });
});

describe("renderStatusEmail", () => {
  const base = {
    candidateName: "An",
    jobTitle: "Backend Dev",
    companyName: "ACME",
    status: "interview",
    note: null,
  };

  it("tiêu đề chứa nội dung theo trạng thái và tên vị trí", () => {
    const mail = renderStatusEmail(base);
    expect(mail.subject).toContain("Bạn được mời phỏng vấn");
    expect(mail.subject).toContain("Backend Dev");
  });

  it("nêu công ty khi có, bỏ khi không có", () => {
    expect(renderStatusEmail(base).text).toContain("Backend Dev tại ACME");
    const noCompany = renderStatusEmail({ ...base, companyName: null });
    expect(noCompany.text).toContain("Vị trí: Backend Dev");
    expect(noCompany.text).not.toContain(" tại ");
  });

  it("có ghi chú thì hiện ở cả text và html; không có thì bỏ", () => {
    const withNote = renderStatusEmail({ ...base, note: "Mang theo CMND" });
    expect(withNote.text).toContain("Mang theo CMND");
    expect(withNote.html).toContain("Mang theo CMND");
    expect(renderStatusEmail(base).text).not.toContain("Ghi chú");
  });

  it("trạng thái lạ vẫn tạo được thư với tiêu đề mặc định", () => {
    const mail = renderStatusEmail({ ...base, status: "offer" });
    expect(mail.subject).toContain("Trạng thái hồ sơ: offer");
  });

  it("thoát HTML để người dùng không chèn được mã vào thư", () => {
    const mail = renderStatusEmail({
      ...base,
      candidateName: "<script>alert(1)</script>",
      note: "<b>x</b>",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).not.toContain("<b>x</b>");
  });
});
