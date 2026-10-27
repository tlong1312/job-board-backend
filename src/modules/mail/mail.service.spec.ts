import * as nodemailer from "nodemailer";
import { MailService } from "./mail.service";

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

describe("MailService", () => {
  const sendMail = jest.fn();
  const dataSource = { query: jest.fn() };
  const config = { get: jest.fn((_key: string, def?: unknown) => def) };
  const payload = { applicationId: 4, historyId: 9 };
  const infoRow = {
    email: "an@example.com",
    full_name: "An",
    job_title: "Backend Dev",
    company_name: "ACME",
    to_status: "interview",
    note: null,
  };
  let service: MailService;

  /** Giả lập DB: SELECT trả thông tin hồ sơ, INSERT trả dòng nhật ký, UPDATE trả rỗng. */
  const mockDb = (logStatus = "pending", rows: unknown[] = [infoRow]) => {
    dataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT u.email")) return rows;
      if (sql.includes("INSERT INTO email_logs")) return [{ id: 55, status: logStatus }];
      return [];
    });
  };
  const updates = () =>
    dataSource.query.mock.calls.map((c) => c[0] as string).filter((s) => s.includes("UPDATE"));

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockImplementation((_key: string, def?: unknown) => def);
    (nodemailer.createTransport as unknown as jest.Mock).mockReturnValue({ sendMail });
    // bỏ thời gian chờ giữa các lần thử lại
    jest.spyOn(global, "setTimeout").mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as never);
    service = new MailService(config as never, dataSource as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("bỏ qua (skipped) khi hồ sơ hoặc lịch sử không còn", async () => {
    mockDb("pending", []);
    await expect(service.sendStatusChanged(payload)).resolves.toBe("skipped");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("truy vấn thông tin theo historyId và applicationId", async () => {
    mockDb();
    sendMail.mockResolvedValue({});
    await service.sendStatusChanged(payload);
    expect(dataSource.query.mock.calls[0][1]).toEqual([9, 4]);
  });

  it("dùng khoá chống gửi trùng theo historyId", async () => {
    mockDb();
    sendMail.mockResolvedValue({});
    await service.sendStatusChanged(payload);
    const insert = dataSource.query.mock.calls.find((c) =>
      (c[0] as string).includes("INSERT INTO email_logs"),
    );
    expect(insert?.[1][0]).toBe("application-status-9");
    expect(insert?.[1][1]).toBe("an@example.com");
  });

  it("thư đã gửi trước đó thì trả duplicate và không gửi lại", async () => {
    mockDb("sent");
    await expect(service.sendStatusChanged(payload)).resolves.toBe("duplicate");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("gửi thành công ngay lần đầu", async () => {
    mockDb();
    sendMail.mockResolvedValue({});
    await expect(service.sendStatusChanged(payload)).resolves.toBe("sent");
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toEqual(
      expect.objectContaining({ to: "an@example.com" }),
    );
    expect(updates().some((s) => s.includes("status = 'sent'"))).toBe(true);
  });

  it("lỗi lần đầu thì thử lại và vẫn gửi được", async () => {
    mockDb();
    sendMail.mockRejectedValueOnce(new Error("SMTP down")).mockResolvedValue({});
    await expect(service.sendStatusChanged(payload)).resolves.toBe("sent");
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("lỗi cả 3 lần thì đánh dấu failed", async () => {
    mockDb();
    sendMail.mockRejectedValue(new Error("SMTP down"));
    await expect(service.sendStatusChanged(payload)).resolves.toBe("failed");
    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(updates().some((s) => s.includes("status = 'failed'"))).toBe(true);
  });
});
