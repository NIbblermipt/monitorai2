import { client } from "../../directus";
import {
  readItems,
  createItems,
  updateItem,
  isDirectusError,
} from "@directus/sdk";
import log from "encore.dev/log";
import { Screen, PingResponse } from "../../uptime/ping";

export async function fetchActiveScreensWithRecentPings(): Promise<Screen[]> {
  try {
    const screens = (await client.request(
      readItems("video_screens", {
        fields: [
          "id",
          "ip",
          "installation_code",
          // @ts-expect-error
          "assigned_user.email",
          // @ts-expect-error
          "assigned_user.telegram_id",
          // @ts-expect-error
          "company.manager.email",
          // @ts-expect-error
          "company.manager.telegram_id",
          // @ts-expect-error
          "pings.up",
        ],
        deep: {
          pings: {
            _sort: ["-date_created"],
            _limit: 2,
          },
        },
        limit: -1,
        filter: {
          _and: [{ status: { _eq: "active" } }, { ip: { _nempty: true } }],
        },
      }),
    )) as Screen[];
    log.debug("Получены активные экраны", { count: screens.length });
    return screens;
  } catch (err) {
    log.error("Ошибка при получении активных экранов из Directus", {
      error: err,
    });
    throw err;
  }
}

export async function savePings(pings: PingResponse[]): Promise<void> {
  try {
    await client.request(createItems("pings", pings));
    log.debug("Результаты пингов сохранены в Directus", {
      count: pings.length,
    });
  } catch (err) {
    if (isDirectusError(err)) {
      log.error("Ошибка Directus при сохранении результатов проверки", {
        error: err,
      });
    } else {
      log.error("Неизвестная ошибка при сохранении результатов проверки", {
        error: err,
      });
    }
    throw err; // Re-throw to be caught by the calling function
  }
}

export async function fetchScreensWithPingsCount(): Promise<{ id: string }[]> {
  try {
    const screens = (await client.request(
      readItems("video_screens", {
        filter: {
          // @ts-expect-error
          "count(pings)": {
            _gt: 0,
          },
        },
        fields: ["id"],
        limit: -1,
      }),
    )) as { id: string }[];

    log.debug("Экраны для расчета uptime", { count: screens.length });
    return screens;
  } catch (err) {
    if (isDirectusError(err)) {
      log.error("Ошибка Directus при получении списка экранов для uptime", {
        error: err,
      });
    } else {
      log.error("Неизвестная ошибка при получении списка экранов для uptime", {
        error: err,
      });
    }
    throw err; // Re-throw to be caught by the calling function
  }
}

export async function fetchPingsForScreenLastMonth(
  screenId: string,
): Promise<{ up: boolean }[]> {
  try {
    const pings = await client.request(
      readItems("pings", {
        fields: ["up"],
        limit: -1,
        filter: {
          video_screen: { _eq: screenId },
          date_created: {
            // @ts-expect-error
            _gte: "$NOW(-1 month)",
          },
        },
      }),
    );
    return pings as { up: boolean }[]; // Explicit cast
  } catch (err) {
    if (isDirectusError(err)) {
      log.error("Ошибка Directus при получении пингов для экрана", {
        screen_id: screenId,
        error: err,
      });
    } else {
      log.error("Неизвестная ошибка при получении пингов для экрана", {
        screen_id: screenId,
        error: err,
      });
    }
    throw err; // Re-throw
  }
}

export async function updateScreenUptime(
  screenId: string,
  uptimePercentage: number,
): Promise<void> {
  try {
    await client.request(
      updateItem("video_screens", screenId, {
        uptime: Math.round(uptimePercentage),
      }),
    );
    log.debug("Uptime рассчитан и обновлен для экрана", {
      screen_id: screenId,
      uptime: uptimePercentage,
    });
  } catch (err) {
    if (isDirectusError(err)) {
      log.error("Ошибка Directus при обновлении uptime экрана", {
        screen_id: screenId,
        error: err,
      });
    } else {
      log.error("Неизвестная ошибка при обновлении uptime экрана", {
        screen_id: screenId,
        error: err,
      });
    }
    throw err; // Re-throw
  }
}
