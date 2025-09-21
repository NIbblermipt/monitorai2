import { Bot } from "grammy";
import type { ApiExtensionContext } from "@directus/extensions";

export const bot = process.env.BOT_TOKEN
  ? new Bot(process.env.BOT_TOKEN)
  : null;

export async function sendTg(
  id: string | null | undefined,
  message: string,
  logger: ApiExtensionContext["logger"],
) {
  if (bot && id) {
    try {
      await bot.api.sendMessage(id, message, { parse_mode: "HTML" });
    } catch (e) {
      logger.error(e);
    }
  }
}
