import "@dotenvx/dotenvx/config";
import { Bot } from "grammy";
import log from "encore.dev/log";
import { InputFile } from "grammy";

export const bot = process.env.BOT_TOKEN
  ? new Bot(process.env.BOT_TOKEN)
  : null;

export async function sendTgMessage({
  id,
  message,
}: {
  id: string | null | undefined;
  message: string;
}) {
  if (bot && id) {
    try {
      await bot.api.sendMessage(id, message, { parse_mode: "HTML" });
    } catch (e) {
      log.error(e);
    }
  }
}

export async function sendTgDocument({
  id,
  caption,
  fileName,
  file,
}: {
  id: string | null | undefined;
  caption: string;
  fileName: string;
  file: Buffer;
}) {
  if (bot && id) {
    try {
      await bot.api.sendDocument(id, new InputFile(file, fileName), {
        caption: caption,
      });
    } catch (e) {
      log.error(e);
    }
  }
}
