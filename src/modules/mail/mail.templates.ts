export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STATUS_TEXT: Record<string, { headline: string; detail: string }> = {
  new: {
    headline: "Hồ sơ của bạn đã được ghi nhận",
    detail: "Hồ sơ đang chờ nhà tuyển dụng xem.",
  },
  viewed: {
    headline: "Nhà tuyển dụng đã xem hồ sơ của bạn",
    detail: "Bạn sẽ nhận thêm thông báo khi có cập nhật.",
  },
  interview: {
    headline: "Bạn được mời phỏng vấn",
    detail: "Nhà tuyển dụng sẽ liên hệ để sắp xếp lịch phỏng vấn.",
  },
  rejected: {
    headline: "Rất tiếc, hồ sơ chưa phù hợp lần này",
    detail: "Cảm ơn bạn đã quan tâm, chúc bạn sớm tìm được cơ hội phù hợp.",
  },
};

export interface StatusEmailInput {
  candidateName: string;
  jobTitle: string;
  companyName: string | null;
  status: string;
  note: string | null;
}

export function renderStatusEmail(i: StatusEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const t = STATUS_TEXT[i.status] ?? {
    headline: `Trạng thái hồ sơ: ${i.status}`,
    detail: "",
  };
  const where = i.companyName
    ? `${i.jobTitle} tại ${i.companyName}`
    : i.jobTitle;
  const subject = `[Job Board] ${t.headline}: ${i.jobTitle}`;

  const text = [
    `Xin chào ${i.candidateName},`,
    "",
    `${t.headline}.`,
    `Vị trí: ${where}`,
    t.detail,
    i.note ? `Ghi chú từ nhà tuyển dụng: ${i.note}` : "",
    "",
    "Job Board",
  ]
    .filter((l, idx, arr) => l !== "" || (arr[idx - 1] ?? "") !== "")
    .join("\n");

  const html = `<div style="font-family:Arial,sans-serif;line-height:1.5">
  <p>Xin chào <b>${escapeHtml(i.candidateName)}</b>,</p>
  <p><b>${escapeHtml(t.headline)}.</b></p>
  <p>Vị trí: ${escapeHtml(where)}</p>
  ${t.detail ? `<p>${escapeHtml(t.detail)}</p>` : ""}
  ${i.note ? `<p>Ghi chú từ nhà tuyển dụng: <i>${escapeHtml(i.note)}</i></p>` : ""}
  <p>Job Board</p>
</div>`;
  return { subject, text, html };
}
