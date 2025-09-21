import { api } from "encore.dev/api";
import { client } from "../directus";
import { generatePDF } from "./pdf-generator";
import {
  readItems,
  createItem,
  uploadFiles,
  readItem,
  isDirectusError,
} from "@directus/sdk";
import { reports } from "~encore/clients";
import { formatDistance, format, intervalToDuration } from "date-fns";
import { ru } from "date-fns/locale";
import "@dotenvx/dotenvx/config";
import log from "encore.dev/log";
import { sendNotificationToRecipient } from "../notifications";
import { Cron } from "croner";
import { ReportData, ReportScreenDetail, ReportRepairmanDetail } from "./types"; // Import new types

interface DirectusUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface Incident {
  date_created: string;
  closed_at: string;
  status: string;
  responsible?: DirectusUser | null; // Add responsible user
  repairs_started_at?: string | null; // Add repairs_started_at
}

interface Screen {
  id: string; // Add screen ID for `screenDetails`
  installation_code: string;
  uptime: number;
  telecom_operator: { name: string };
  incidents: Incident[];
  coordinates?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  } | null; // Add coordinates
  assigned_user?: DirectusUser | null; // Add assigned user
}

interface Manager {
  telegram_id?: string | null;
  email: string;
  id: string;
}

interface Company {
  manager?: Manager | null;
  video_screens: Screen[];
  name: string;
}

export const generateReport = api<{ id: string }, { success: boolean }>(
  { expose: false, path: "/monthly-reports/:id", method: "GET" },
  async ({ id }) => {
    try {
      log.info("Генерация отчета для компании", { companyId: id });

      const company = (await client.request(
        readItem("companies", id, {
          deep: {
            video_screens: {
              incidents: {
                _filter: {
                  date_created: {
                    _gte: "$NOW(-1 month)",
                  },
                },
              },
            },
          },
          fields: [
            "name",
            { manager: ["email", "telegram_id", "id"] },
            {
              // @ts-expect-error
              video_screens: [
                "id", // Fetch screen ID
                "installation_code",
                "uptime",
                "telecom_operator.name",
                "coordinates", // Fetch coordinates
                { assigned_user: ["id", "first_name", "last_name"] }, // Fetch assigned user
                {
                  incidents: [
                    "date_created",
                    "closed_at",
                    "status",
                    { responsible: ["id", "first_name", "last_name"] }, // Fetch responsible user
                    "repairs_started_at", // Fetch repairs_started_at
                  ],
                },
              ],
            },
          ],
          filter: {
            // @ts-expect-error
            "count(video_screens)": {
              _gt: 0,
            },
          },
        }),
      )) as Company;

      if (!company) {
        log.warn("Компания не найдена или не имеет экранов", { companyId: id });
        return { success: false };
      }

      log.info("Данные компании получены", {
        companyName: company.name,
        screenCount: company.video_screens.length,
      });

      const totalIncidents = company.video_screens.reduce(
        (total, screen) => total + screen.incidents.length,
        0,
      );
      const unresolvedIncidents = company.video_screens.reduce(
        (total, screen) =>
          total +
          screen.incidents.filter((i) => i.status !== "resolved").length,
        0,
      );

      const averageUptime =
        company.video_screens.length > 0
          ? company.video_screens.reduce(
              (sum, screen) => sum + (screen.uptime || 0),
              0,
            ) / company.video_screens.length
          : 0;

      const resolvedIncidents = company.video_screens.flatMap((screen) =>
        screen.incidents.filter(
          (i) => i.status === "resolved" && i.closed_at && i.date_created,
        ),
      );

      const avgResolutionTimeInMs =
        resolvedIncidents.length > 0
          ? resolvedIncidents.reduce(
              (sum, incident) =>
                sum +
                (new Date(incident.closed_at!).getTime() -
                  new Date(incident.date_created).getTime()),
              0,
            ) / resolvedIncidents.length
          : 0;

      const avgResolutionTimeFormatted =
        avgResolutionTimeInMs > 0
          ? formatDistance(0, avgResolutionTimeInMs, {
              locale: ru,
              includeSeconds: true,
            })
          : null;

      // --- New data processing for screenDetails and repairmanDetails ---

      const screenDetails: ReportScreenDetail[] = company.video_screens.map(
        (screen) => ({
          installationCode: screen.installation_code,
          uptime: screen.uptime || 0,
          telecomOperatorName: screen.telecom_operator?.name || "Неизвестно",
          incidentCount: screen.incidents.length,
          coordinates: screen.coordinates?.coordinates || null,
        }),
      );

      interface RepairmanStats {
        fullName: string;
        screensAssignedCount: number;
        totalIncidentsCount: number;
        resolvedIncidentsCount: number;
        unresolvedIncidentsCount: number;
        totalResolutionTimeMs: number;
        resolutionCount: number;
        totalAcceptanceTimeMs: number;
        acceptanceCount: number;
      }

      const repairmanMap = new Map<string, RepairmanStats>();

      const getRepairmanStats = (user: DirectusUser): RepairmanStats => {
        const id = user.id;
        if (!repairmanMap.has(id)) {
          repairmanMap.set(id, {
            fullName: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
            screensAssignedCount: 0,
            totalIncidentsCount: 0,
            resolvedIncidentsCount: 0,
            unresolvedIncidentsCount: 0,
            totalResolutionTimeMs: 0,
            resolutionCount: 0,
            totalAcceptanceTimeMs: 0,
            acceptanceCount: 0,
          });
        }
        return repairmanMap.get(id)!;
      };

      // Process screens for assigned users
      for (const screen of company.video_screens) {
        if (screen.assigned_user) {
          const stats = getRepairmanStats(screen.assigned_user);
          stats.screensAssignedCount++;
        }

        // Process incidents for responsible users
        for (const incident of screen.incidents) {
          if (incident.responsible) {
            const stats = getRepairmanStats(incident.responsible);
            stats.totalIncidentsCount++;

            if (incident.status === "resolved") {
              stats.resolvedIncidentsCount++;
              if (incident.closed_at && incident.date_created) {
                const resolutionMs =
                  new Date(incident.closed_at).getTime() -
                  new Date(incident.date_created).getTime();
                if (resolutionMs > 0) {
                  // Ensure positive duration
                  stats.totalResolutionTimeMs += resolutionMs;
                  stats.resolutionCount++;
                }
              }
            } else {
              stats.unresolvedIncidentsCount++;
            }

            if (incident.repairs_started_at && incident.date_created) {
              const acceptanceMs =
                new Date(incident.repairs_started_at).getTime() -
                new Date(incident.date_created).getTime();
              if (acceptanceMs > 0) {
                // Ensure positive duration
                stats.totalAcceptanceTimeMs += acceptanceMs;
                stats.acceptanceCount++;
              }
            }
          }
        }
      }

      const repairmanDetails: ReportRepairmanDetail[] = Array.from(
        repairmanMap.values(),
      ).map((stats) => {
        const avgResTime =
          stats.resolutionCount > 0
            ? formatDistance(
                0,
                stats.totalResolutionTimeMs / stats.resolutionCount,
                { locale: ru, includeSeconds: true },
              )
            : null;

        const avgAccTime =
          stats.acceptanceCount > 0
            ? formatDistance(
                0,
                stats.totalAcceptanceTimeMs / stats.acceptanceCount,
                { locale: ru, includeSeconds: true },
              )
            : null;

        return {
          fullName: stats.fullName,
          screensAssignedCount: stats.screensAssignedCount,
          totalIncidentsCount: stats.totalIncidentsCount,
          resolvedIncidentsCount: stats.resolvedIncidentsCount,
          unresolvedIncidentsCount: stats.unresolvedIncidentsCount,
          avgResolutionTime: avgResTime,
          avgAcceptanceTime: avgAccTime,
        };
      });

      log.info("Генерация PDF отчета", {
        totalIncidents,
        unresolvedIncidents,
        averageUptime,
        screenDetailsCount: screenDetails.length,
        repairmanDetailsCount: repairmanDetails.length,
      });

      // Calculate the previous month date
      const now = new Date();
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      // Format month and year for filename and messages using date-fns
      const reportMonthYearFormatted = format(lastMonthDate, "LLLL_yyyy", {
        locale: ru,
      }); // e.g., "апрель_2023"
      const reportMonthNameFormatted = format(lastMonthDate, "LLLL", {
        locale: ru,
      }); // e.g., "апрель"

      // Format the current timestamp for the filename
      const reportTimestampFormatted = format(now, "dd-MM-yy"); // e.g., "10-30_26-04-23"

      // Generate the new filename
      const reportFilename = `отчет_${reportMonthYearFormatted}_${reportTimestampFormatted}.pdf`; // Combine parts

      const reportData: ReportData = {
        companyName: company.name,
        uptime: averageUptime,
        totalScreens: company.video_screens.length,
        totalIncidents,
        unresolvedIncidents,
        avgResolutionTime: avgResolutionTimeFormatted,
        screenDetails: screenDetails,
        repairmanDetails: repairmanDetails,
      };

      const pdfBytes = await generatePDF(reportData);

      // Upload PDF to Directus
      const formData = new FormData();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      if (process.env.REPORTS_FOLDER) {
        formData.append("folder", process.env.REPORTS_FOLDER);
      }
      formData.append(
        "file",
        blob,
        reportFilename, // Use the new filename here
      );

      let fileResponse;
      try {
        fileResponse = await client.request(uploadFiles(formData));
        log.info("PDF загружен в Directus", { fileId: fileResponse.id });

        await client.request(
          createItem("reports", {
            doc: fileResponse.id,
            company: id,
          }),
        );
        log.info("Запись отчета создана", { companyId: id });

        sendNotificationToRecipient({
          recipient: company.manager,
          subject: `Ежемесячный отчет за ${reportMonthNameFormatted}`,
          text: `Добрый день! Прилагаем ежемесячный отчет за ${reportMonthNameFormatted}.`,
          file: pdfBytes,
          fileName: reportFilename,
          fileType: "application/pdf",
        });

        return { success: true };
      } catch (error) {
        if (isDirectusError(error)) {
          log.error("Ошибка загрузки в Directus", { error: error.errors });
        } else {
          log.error("Неизвестная ошибка загрузки", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
        return { success: false };
      }
    } catch (error) {
      if (isDirectusError(error)) {
        log.error("Ошибка Directus в generateReport", {
          companyId: id,
          error: error.errors,
        });
      } else {
        log.error("Ошибка в generateReport", {
          companyId: id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      return { success: false };
    }
  },
);

export const fetchCompanies = api<void, { success: boolean }>(
  { expose: false, path: "/fetch-companies", method: "GET" },
  async (): Promise<{ success: boolean }> => {
    try {
      log.info("Начало генерации ежемесячных отчетов для всех компаний");

      const companies = await client.request(
        readItems("companies", {
          fields: ["id"],
          limit: -1,
          filter: {
            // @ts-expect-error
            "count(video_screens)": {
              _gt: 0,
            },
          },
        }),
      );

      log.info("Найдены компании для генерации отчетов", {
        companyCount: companies.length,
      });

      let allSuccess = true;
      for await (const company of companies) {
        const result = await reports.generateReport({ id: company.id });
        if (result.success) {
          log.info("Отчет успешно сгенерирован", { companyId: company.id });
        } else {
          allSuccess = false;
          log.error("Ошибка при генерации отчёта", { companyId: company.id });
        }
      }
      return { success: allSuccess };
    } catch (error) {
      if (isDirectusError(error)) {
        log.error("Ошибка Directus в fetchCompanies", { error: error.errors });
      } else {
        log.error("Ошибка в fetchCompanies", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      return { success: false };
    }
  },
);

export const fetchSelectedCompanies = api<
  { keys: string[] },
  { success: boolean }
>(
  { expose: true, path: "/fetch-selected-companies", method: "POST" },
  async ({ keys }) => {
    try {
      log.info("Начало генерации ежемесячных отчетов для выбранных компаний");

      const companies = await client.request(
        readItems("companies", {
          fields: ["id"],
          limit: -1,
          filter: {
            _and: [
              {
                id: {
                  _in: keys,
                },
              },
              {
                // @ts-expect-error
                "count(video_screens)": {
                  _gt: 0,
                },
              },
            ],
          },
        }),
      );

      log.info("Найдены компании для генерации отчетов", {
        companyCount: companies.length,
      });

      let allSuccess = true;
      for await (const company of companies) {
        const result = await reports.generateReport({ id: company.id });
        if (result.success) {
          log.info("Отчет успешно сгенерирован", { companyId: company.id });
        } else {
          allSuccess = false;
          log.error("Ошибка при генерации отчёта", { companyId: company.id });
        }
      }
      return { success: allSuccess };
    } catch (error) {
      if (isDirectusError(error)) {
        log.error("Ошибка Directus в fetchCompanies", { error: error.errors });
      } else {
        log.error("Ошибка в fetchCompanies", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      return { success: false };
    }
  },
);

export const assets = api.static({
  expose: true,
  path: "/static/*path",
  dir: "./assets",
});

// Schedule monthly report generation
const _monthlyReportJob = new Cron(
  "0 9 1 * *",
  {
    timezone: "Europe/Moscow",
    name: "fetchCompanies",
  },
  fetchCompanies,
);
