import { MailConsumer } from "./mail.consumer";

describe("MailConsumer", () => {
  const mail = { sendStatusChanged: jest.fn() };
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const message = { content: "x" };
  const ctx = { getChannelRef: () => channel, getMessage: () => message } as never;
  let consumer: MailConsumer;

  beforeEach(() => {
    jest.resetAllMocks();
    consumer = new MailConsumer(mail as never);
  });

  it("gửi thư rồi ack khi message hợp lệ", async () => {
    mail.sendStatusChanged.mockResolvedValue("sent");
    await consumer.handle({ applicationId: 4, historyId: 9 }, ctx);
    expect(mail.sendStatusChanged).toHaveBeenCalledWith({ applicationId: 4, historyId: 9 });
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it("chấp nhận id dạng chuỗi số", async () => {
    mail.sendStatusChanged.mockResolvedValue("sent");
    await consumer.handle({ applicationId: "4", historyId: "9" }, ctx);
    expect(mail.sendStatusChanged).toHaveBeenCalledWith({ applicationId: 4, historyId: 9 });
  });

  it.each([
    [{}],
    [{ applicationId: 4 }],
    [{ applicationId: "abc", historyId: 9 }],
    [{ applicationId: 0, historyId: 9 }],
    [{ applicationId: 4, historyId: -1 }],
    [{ applicationId: 1.5, historyId: 2 }],
  ])("message sai định dạng %j: ack luôn, không gửi thư", async (data) => {
    await consumer.handle(data, ctx);
    expect(mail.sendStatusChanged).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it("xử lý lỗi thì nack không đưa lại hàng đợi", async () => {
    mail.sendStatusChanged.mockRejectedValue(new Error("db lỗi"));
    await consumer.handle({ applicationId: 4, historyId: 9 }, ctx);
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });
});
