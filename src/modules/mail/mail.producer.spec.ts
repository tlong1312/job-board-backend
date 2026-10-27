import { Logger } from "@nestjs/common";
import { MailProducer } from "./mail.producer";
import { APPLICATION_STATUS_CHANGED_EVENT } from "./mail.config";

describe("MailProducer", () => {
  const subscribe = jest.fn();
  const client = { emit: jest.fn() };
  let producer: MailProducer;

  beforeEach(() => {
    jest.resetAllMocks();
    client.emit.mockReturnValue({ subscribe });
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    producer = new MailProducer(client as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("phát sự kiện đổi trạng thái vào hàng đợi", () => {
    producer.enqueueStatusChanged({ applicationId: 4, historyId: 9 });
    expect(client.emit).toHaveBeenCalledWith(APPLICATION_STATUS_CHANGED_EVENT, {
      applicationId: 4,
      historyId: 9,
    });
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("RabbitMQ lỗi thì chỉ ghi log, không ném lỗi ra ngoài", () => {
    producer.enqueueStatusChanged({ applicationId: 4, historyId: 9 });
    const handlers = subscribe.mock.calls[0][0];
    expect(() => handlers.error(new Error("mất kết nối"))).not.toThrow();
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
