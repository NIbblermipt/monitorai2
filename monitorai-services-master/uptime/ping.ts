import { api } from "encore.dev/api";
import { uptime } from "~encore/clients";
import { Cron } from "croner";
import log from "encore.dev/log";
import {
  fetchActiveScreensWithRecentPings,
  savePings,
  fetchScreensWithPingsCount,
  fetchPingsForScreenLastMonth,
  updateScreenUptime,
} from "../directus";
import { sendNotificationToRecipient } from "../notifications";

interface User {
  email: string;
  telegram_id?: string | null;
}

export interface Screen {
  installation_code: string;
  id: string;
  ip: string;
  assigned_user: User | null;
  company: { manager: User | null } | null;
  pings?: { up: boolean }[] | null;
}

export interface PingResponse {
  up: boolean;
  video_screen: string;
}

const NUM_PREVIOUS_PINGS_TO_CHECK = 2;

// Ping pings a specific site and determines whether it's up or down right now.
export const ping = api<{ screen: Screen }, PingResponse>(
  { expose: false, path: "/ping", method: "POST" },
  async ({ screen }) => {
    let currentUpStatus: boolean;

    try {
      log.debug("Проверка статуса экрана", {
        screen_id: screen.id,
        ip: screen.ip,
      });
      // Make an HTTP request to check if it's up.
      const resp = await fetch(`http://${screen.ip}`, { method: "GET" });
      // 2xx and 5xx status codes are considered up
      currentUpStatus = resp.status >= 200 && resp.status < 600;
      log.debug("Результат проверки экрана", {
        screen_id: screen.id,
        status: currentUpStatus,
      });
    } catch (err) {
      log.error("Ошибка при проверке экрана", {
        screen_id: screen.id,
        error: err,
      });
      currentUpStatus = false; // Ping failed, so current status is down
    }

    // After determining the current status, check if notifications should be sent
    await notifyIfConsecutivelyDown(screen, currentUpStatus);

    return { video_screen: screen.id, up: currentUpStatus };
  },
);

// Helper function to check for consecutive failed pings and send notifications
async function notifyIfConsecutivelyDown(
  screen: Screen,
  currentUpStatus: boolean,
) {
  if (!currentUpStatus) {
    // If current ping failed
    const lastNPings = screen.pings?.slice(0, NUM_PREVIOUS_PINGS_TO_CHECK); // Get the required number of most recent historical pings from the provided screen object
    // Check if there are enough historical pings and if all of them (plus the current) were down
    if (
      lastNPings &&
      lastNPings.length === NUM_PREVIOUS_PINGS_TO_CHECK &&
      lastNPings.every((p) => !p.up)
    ) {
      // Condition met: current ping failed AND the specified number of previous ones failed
      // The message implies 3 consecutive failures, which is NUM_PREVIOUS_PINGS_TO_CHECK (2) + current (1)
      const message = `Экран ${screen.installation_code} (${screen.ip}) недоступен. Последние ${NUM_PREVIOUS_PINGS_TO_CHECK + 1} проверки завершились ошибкой. Экран: ${process.env.DIRECTUS_URL}/admin/content/video_screens/${screen.id}`;
      const subject = `Экран ${screen.installation_code} недоступен`;

      log.warn("Экран недоступен, отправка уведомлений", {
        screen_id: screen.id,
        ip: screen.ip,
      });

      // Notify assigned user
      await sendNotificationToRecipient({
        recipient: screen.assigned_user,
        subject: subject,
        text: message,
      });

      // Notify company manager
      await sendNotificationToRecipient({
        recipient: screen.company?.manager,
        subject: subject,
        text: message,
      });
    }
  }
}

export const pingAllScreens = api<void, void>(
  { expose: false, path: "/ping-screens", method: "GET" },
  async () => {
    log.debug("Начало проверки всех экранов");
    try {
      const screens = await fetchActiveScreensWithRecentPings(); // Use helper

      log.debug("Найдены экраны для проверки", { count: screens.length });
      const pings = await Promise.all(
        screens.map(async (screen) => await uptime.ping({ screen })),
      );

      await savePings(pings); // Use helper
    } catch (err) {
      // The helpers re-throw, so the main catch block is still relevant for initial fetch errors
      log.error("Критическая ошибка в процессе проверки всех экранов", {
        error: err,
      });
    }
  },
);

export const calculateMonthlyUptime = api<void, void>(
  { expose: false, path: "/calculate-uptime", method: "GET" },
  async () => {
    log.debug("Начало расчета uptime за месяц");
    try {
      const screens = await fetchScreensWithPingsCount();

      for (const screen of screens) {
        try {
          const pings = await fetchPingsForScreenLastMonth(screen.id);

          if (pings.length === 0) {
            log.warn("Нет пингов за последний месяц для расчета uptime", {
              screen_id: screen.id,
            });
            continue; // Пропустить расчет, если нет пингов
          }

          const upCount = pings.filter((p) => p.up).length;
          const uptimePercentage = (upCount / pings.length) * 100;

          await updateScreenUptime(screen.id, uptimePercentage);
        } catch (err) {
          // Errors from fetchPingsForScreenLastMonth or updateScreenUptime are logged inside those functions
          // and re-thrown. We catch them here to continue processing other screens.
          log.error(
            `Ошибка при обработке экрана ${screen.id} для расчета uptime`,
            { screen_id: screen.id, error: err },
          );
          // Do not re-throw to allow processing of other screens
        }
      }
      log.debug("Завершение расчета uptime за месяц");
    } catch (err) {
      // Errors from fetchScreensWithPingsCount are logged inside that function
      // and re-thrown. We log a general error here.
      log.error("Ошибка в процессе расчета uptime за месяц", { error: err });
    }
  },
);

const _pingJob = new Cron(
  "*/5 * * * *",
  {
    timezone: "Europe/Moscow",
    name: "pingAllScreens",
  },
  pingAllScreens,
);

const _uptimeJob = new Cron(
  "0 0 1 * *",
  {
    timezone: "Europe/Moscow",
    name: "calculateMonthlyUptime",
  },
  calculateMonthlyUptime,
);
