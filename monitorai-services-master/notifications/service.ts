import { components } from "../directus/schema";
import { sendMail } from "./providers/email";
import { sendTgMessage, sendTgDocument } from "./providers/telegram";
import log from "encore.dev/log";

// Simple notification service abstraction
const notificationService = {
  sendMail,
  sendTg: async ({
    id,
    message,
    fileName,
    file,
  }: {
    id: string | null | undefined;
    message: string;
    fileName?: string;
    file?: Buffer;
  }) => {
    if (fileName && file) {
      await sendTgDocument({
        id,
        caption: message,
        fileName,
        file,
      });
    } else {
      await sendTgMessage({ id, message });
    }
  },
};

// Helper function to send notifications to a single recipient via available channels
export async function sendNotificationToRecipient({
  recipient,
  subject,
  html,
  text,
  fileName,
  file,
  fileType,
}: ({
  recipient?: Partial<components["schemas"]["Users"]> | null;
  subject?: string;
} & (
  | { text?: string; html: string }
  | { text: string; html?: string }
  | { text: string; html: string }
)) &
  (
    | { fileName: string; file: Uint8Array<ArrayBufferLike>; fileType: string }
    | { fileName?: undefined; file?: undefined; fileType?: undefined }
  )) {
  if (!recipient) {
    log.error(`Получатель уведомления не найден`);
    return;
  }

  if (!text && !html && !file && !fileName && !fileType) {
    log.error(`Не указано сообщение для ${recipient.email}`);
    return;
  }

  if (recipient.telegram_id) {
    try {
      await notificationService.sendTg({
        id: recipient.telegram_id,
        message: file ? (subject ?? html ?? text!) : (html ?? text!),
        fileName, // Use the new filename here
        file: file && Buffer.from(file), // pdfBytes is the Buffer content of the PDF
      });
      log.info(`Отправлено TG уведомление (${recipient.telegram_id})`);
    } catch (error) {
      log.error(
        `Ошибка при отправке TG уведомления (${recipient.telegram_id})`,
        {
          error: error,
        },
      );
    }
  } else {
    log.warn(`Telegram ID получателя (${recipient.email}) не найден`);
  }

  if (recipient.email) {
    try {
      await notificationService.sendMail({
        to: recipient.email,
        subject,
        text,
        html,
        attachments:
          fileName && file && fileType
            ? [
                {
                  filename: fileName,
                  content: file, // pdfBytes is the Buffer content of the PDF
                  contentType: fileType,
                },
              ]
            : undefined,
      });
      log.info(`Отправлено Email уведомление (${recipient.email})`);
    } catch (error) {
      log.error(`Ошибка при отправке Email уведомления (${recipient.email})`, {
        error,
      });
    }
  } else {
    log.warn(`Email получателя (${recipient.telegram_id}) не найден`);
  }
}

export default notificationService;
