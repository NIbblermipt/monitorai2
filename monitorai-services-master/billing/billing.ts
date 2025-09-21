import "@dotenvx/dotenvx/config";
import { api } from "encore.dev/api";
import log from "encore.dev/log";
import { client } from "../directus";
import {
  readItems,
  createItems,
  updateItemsBatch,
  isDirectusError,
  readSingleton,
} from "@directus/sdk";
import { sendNotificationToRecipient } from "../notifications"; // Import notification functions
import { Cron } from "croner";
import { components } from "../directus/schema";

interface Company {
  id: string;
  name: string; // Add name
  balance: number;
  price_per_screen: number;
  video_screens: string[];
  days_paid?: number | null;
  manager?: {
    // Add manager with optional fields
    email?: string | null;
    telegram_id?: string | null;
  } | null;
}

interface Holding {
  id: string;
  name: string;
  balance: number;
  price_per_screen: number;
  companies: {
    video_screens: string[];
  }[];
  days_paid?: number | null;
  manager?: {
    // Add manager with optional fields
    email?: string | null;
    telegram_id?: string | null;
  } | null;
}

const calculateFullAmount = (
  pricePerScreen: number,
  screensCount: number,
): number => {
  return pricePerScreen * screensCount;
};

const fetchCompanies = async (): Promise<Company[]> => {
  log.info("Чтение данных компаний");
  try {
    const companies = (await client.request(
      readItems("companies", {
        deep: {
          video_screens: {
            _limit: -1,
          },
        },
        fields: [
          "id",
          "name", // Include name
          "balance",
          "price_per_screen",
          "days_paid",
          "video_screens",
          { manager: ["email", "telegram_id"] }, // Include manager fields
        ],
        limit: -1,
        filter: {
          _and: [
            {
              holding: {
                _null: true,
              },
            },
            {
              price_per_screen: {
                _nnull: true,
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
    )) as Company[];
    log.info("Найдены компании для списания", companies);
    return companies;
  } catch (error) {
    if (isDirectusError(error)) {
      log.error("Ошибка при чтении компаний", { error: error.errors });
      throw error;
    }
    throw new Error(`Неизвестная ошибка при чтении компаний: ${error}`);
  }
};

const fetchHoldings = async (): Promise<Holding[]> => {
  log.info("Чтение данных медиагрупп");
  try {
    const holdings = (await client.request(
      readItems("holdings", {
        deep: {
          companies: {
            _limit: -1,
            video_screens: {
              _limit: -1,
            },
            _filter: {
              "count(video_screens)": {
                _gt: 0,
              },
            },
          },
        },
        fields: [
          "id",
          "name",
          "balance",
          "price_per_screen",
          "days_paid",
          { manager: ["email", "telegram_id"] }, // Include manager fields
          // @ts-expect-error
          "companies.video_screens",
        ] as const,
        limit: -1,
        filter: {
          price_per_screen: {
            _nnull: true,
          },
          "count(companies)": {
            _gt: 0,
          },
          companies: {
            // @ts-expect-error
            "count(video_screens)": {
              _gt: 0,
            },
          },
        },
      }),
    )) as Holding[];
    log.info("Найдены медиагруппы для списания", holdings);
    return holdings;
  } catch (error) {
    if (isDirectusError(error)) {
      log.error("Ошибка при чтении медиагрупп", { error: error.errors });
      throw error;
    }
    throw new Error(`Неизвестная ошибка при чтении медиагрупп: ${error}`);
  }
};

const fetchAdmin = async (): Promise<
  | {
      telegram_id?: string | null;
      email: string;
    }
  | null
  | undefined
> => {
  log.info("Чтение данных админа");
  try {
    const meta = (await client.request(
      // @ts-expect-error // Directus SDK might have type issues with singleton reads
      readSingleton("meta", {
        fields: ["manager.telegram_id", "manager.email"],
      }),
    )) as unknown as
      | {
          manager: { telegram_id?: string | null; email: string } | null;
        }
      | null
      | undefined; // Added undefined to potential types
    log.info("Найдены данные админа", meta?.manager);
    return meta?.manager;
  } catch (error) {
    if (isDirectusError(error)) {
      log.error("Ошибка при чтении данных админа", { error: error.errors }); // Corrected log message
      throw error;
    }
    log.error("Неизвестная ошибка при чтении данных админа", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }); // More detailed error logging
    throw new Error(`Неизвестная ошибка при чтении данных админа: ${error}`);
  }
};

const createDeductionRecords = async (deductions: any[]) => {
  if (deductions.length > 0) {
    log.info("Создание записей списаний в Directus", {
      count: deductions.length,
    });
    try {
      await client.request(createItems("deductions", deductions));
      log.info("Записи списаний успешно созданы");
    } catch (error) {
      if (isDirectusError(error)) {
        log.error("Ошибка при создании списаний", { error: error.errors });
        throw error;
      }
      throw new Error(`Неизвестная ошибка при создании списаний: ${error}`);
    }
  } else {
    log.info("Нет списаний для создания");
  }
};

const updateBalances = async (
  entityType: "companies" | "holdings",
  updates: { id: string; balance: number; days_paid?: number | null }[],
) => {
  if (updates.length > 0) {
    log.info(`Обновление баланса ${entityType}`, {
      count: updates.length,
    });
    try {
      await client.request(updateItemsBatch(entityType, updates));
      log.info(`Баланс ${entityType} успешно обновлен`);
    } catch (error) {
      if (isDirectusError(error)) {
        log.error(`Ошибка при обновлении баланса ${entityType}`, {
          error: error.errors,
        });
        throw error;
      }
      throw new Error(
        `Неизвестная ошибка при обновлении баланса ${entityType}: ${error}`,
      );
    }
  } else {
    log.info(`Нет балансов ${entityType} для обновления`);
  }
};

export const createDeductions = api<void, void>(
  { expose: false, path: "/create-deductions", method: "GET" },
  async () => {
    try {
      log.info("Запуск процесса создания списаний");

      const companies = await fetchCompanies();
      const holdings = await fetchHoldings();
      const adminContacts = await fetchAdmin(); // Fetch admin contacts

      log.info("Расчет списаний для компаний");
      const companiesDeductions = companies.map(
        ({ id, name, price_per_screen, video_screens, balance, manager }) => ({
          // Destructure name and manager
          company: id,
          companyName: name, // Store company name
          price_per_screen,
          screens_number: video_screens.length,
          full_amount: calculateFullAmount(
            price_per_screen,
            video_screens.length,
          ),
          updated_balance:
            balance -
            calculateFullAmount(price_per_screen, video_screens.length),
          original_balance: balance, // Store original balance
          managerEmail: manager?.email, // Store manager email
          managerTelegramId: manager?.telegram_id, // Store manager Telegram ID
          days_paid:
            price_per_screen > 0 && video_screens.length > 0
              ? Math.floor(
                  Math.max(
                    0,
                    (balance -
                      calculateFullAmount(
                        price_per_screen,
                        video_screens.length,
                      )) /
                      ((price_per_screen * video_screens.length) / 30),
                  ),
                )
              : null, // Calculate days_paid
        }),
      );
      log.info("Рассчитаны списания для компаний", {
        // Corrected typo
        count: companiesDeductions.length,
      });

      log.info("Расчет списаний для медиагрупп");
      const holdingsDeductions = holdings.map(
        ({
          id,
          name, // Add name here
          price_per_screen,
          companies: holdingCompanies,
          balance,
          manager,
        }) => {
          const screensNumber = holdingCompanies.reduce(
            (acc, company) => acc + company.video_screens.length,
            0,
          );
          const fullAmount = calculateFullAmount(
            price_per_screen,
            screensNumber,
          );
          return {
            holding: id,
            holdingName: name, // Store holding name
            price_per_screen,
            screens_number: screensNumber,
            full_amount: fullAmount,
            updated_balance: balance - fullAmount,
            original_balance: balance, // Store original balance
            managerEmail: manager?.email, // Store manager email
            managerTelegramId: manager?.telegram_id, // Store manager Telegram ID
            days_paid:
              price_per_screen > 0 && screensNumber > 0
                ? Math.floor(
                    Math.max(
                      0,
                      (balance - fullAmount) /
                        ((price_per_screen * screensNumber) / 30),
                    ),
                  )
                : null, // Calculate days_paid
          };
        },
      );
      log.info("Рассчитаны списания для медиагрупп", {
        count: holdingsDeductions.length,
      });

      const allDeductions = [...companiesDeductions, ...holdingsDeductions];
      await createDeductionRecords(allDeductions);

      await updateBalances(
        "companies",
        companiesDeductions.map(({ company, updated_balance, days_paid }) => ({
          id: company,
          balance: updated_balance,
          days_paid: days_paid, // Pass days_paid
        })),
      );

      // Add notification logic here after company balances are updated
      for (const deduction of companiesDeductions) {
        if (deduction.updated_balance <= 0) {
          log.warn("Баланс компании достиг нуля или меньше", {
            companyId: deduction.company,
            companyName: deduction.companyName,
            originalBalance: deduction.original_balance, // Log original balance
            updatedBalance: deduction.updated_balance,
            fullAmount: deduction.full_amount, // Log full amount
          });

          const managerSubject = `Уведомление о нулевом балансе компании "${deduction.companyName}"`; // Changed subject for manager
          const managerMessage = `Добрый день! Баланс компании "${deduction.companyName}" после списания составил ${deduction.updated_balance.toFixed(2)}. Этого недостаточно для дальнейшей работы. Пожалуйста, пополните баланс.`; // Changed message for manager

          // Send notification to manager using the common function
          const managerRecipient = {
            email: deduction.managerEmail,
            telegram_id: deduction.managerTelegramId,
            // Add other necessary user properties if sendNotificationToRecipient requires them and they are available
            // e.g., first_name, last_name, status, etc. based on components["schemas"]["Users"]
            // For now, assuming email and telegram_id are sufficient based on sendNotificationToRecipient implementation
          } as components["schemas"]["Users"] | null | undefined; // Cast to match expected type

          await sendNotificationToRecipient({
            recipient: managerRecipient,
            text: managerMessage,
            subject: managerSubject,
          });

          // --- Admin Notification ---
          if (adminContacts) {
            const adminSubject = `Нулевой баланс компании: "${deduction.companyName}"`;
            const adminEmailMessage = `Добрый день! Баланс компании "${deduction.companyName}" после списания составил ${deduction.updated_balance.toFixed(2)}. Требуется ваше внимание.`;
            const adminTelegramMessage = `Добрый день! Баланс компании "${deduction.companyName}" после списания составил ${deduction.updated_balance.toFixed(2)}. Требуется ваше внимание. <a href="${process.env.DIRECTUS_URL}/admin/content/companies/${deduction.company}">Ссылка на компанию</a>`;

            await sendNotificationToRecipient({
              recipient: adminContacts, // Assuming adminContacts has the necessary email and telegram_id fields
              text: adminEmailMessage,
              html: adminTelegramMessage, // Use HTML for Telegram message as it contains a link
              subject: adminSubject,
            });
          } else {
            log.warn(
              "Контакты админа не найдены для отправки уведомления о критически низком балансе",
              {
                companyId: deduction.company,
                companyName: deduction.companyName,
              },
            );
          }
        } else if (
          deduction.updated_balance > 0 &&
          deduction.updated_balance <= deduction.full_amount
        ) {
          // Existing low balance condition for manager
          log.warn("Баланс компании меньше месячного расхода", {
            companyId: deduction.company,
            companyName: deduction.companyName,
            originalBalance: deduction.original_balance,
            updatedBalance: deduction.updated_balance,
            fullAmount: deduction.full_amount,
          });

          const subject = `Уведомление о низком балансе компании "${deduction.companyName}"`;
          const message = `Добрый день! Баланс компании "${deduction.companyName}" (${deduction.updated_balance.toFixed(2)}) меньше месячного расхода (${deduction.full_amount.toFixed(2)}). Пожалуйста, пополните баланс для покрытия следующих списаний.`;

          // Send notification to manager using the common function
          const managerRecipient = {
            email: deduction.managerEmail,
            telegram_id: deduction.managerTelegramId,
            // Add other necessary user properties if sendNotificationToRecipient requires them and they are available
            // e.g., first_name, last_name, status, etc. based on components["schemas"]["Users"]
            // For now, assuming email and telegram_id are sufficient based on sendNotificationToRecipient implementation
          } as components["schemas"]["Users"] | null | undefined; // Cast to match expected type

          await sendNotificationToRecipient({
            recipient: managerRecipient,
            text: message,
            subject: subject,
          });
        }
      }

      await updateBalances(
        "holdings",
        holdingsDeductions.map(({ holding, updated_balance, days_paid }) => ({
          id: holding,
          balance: updated_balance,
          days_paid: days_paid, // Pass days_paid
        })),
      );

      // Add notification logic here after holding balances are updated
      for (const deduction of holdingsDeductions) {
        if (deduction.updated_balance <= 0) {
          log.warn("Баланс медиагруппы достиг нуля или меньше", {
            holdingId: deduction.holding,
            updatedBalance: deduction.updated_balance,
            originalBalance: deduction.original_balance, // Log original balance
            fullAmount: deduction.full_amount, // Log full amount
          });

          const managerSubject = `Уведомление о нулевом балансе медиагруппы`; // Subject for manager
          const managerMessage = `Добрый день! Баланс вашей медиагруппы после списания составил ${deduction.updated_balance.toFixed(2)}. Этого недостаточно для дальнейшей работы. Пожалуйста, срочно пополните баланс.`; // Message for manager

          // Send notification to manager using the common function
          const managerRecipient = {
            email: deduction.managerEmail,
            telegram_id: deduction.managerTelegramId,
            // Add other necessary user properties if sendNotificationToRecipient requires them and they are available
            // e.g., first_name, last_name, status, etc. based on components["schemas"]["Users"]
            // For now, assuming email and telegram_id are sufficient based on sendNotificationToRecipient implementation
          } as components["schemas"]["Users"] | null | undefined; // Cast to match expected type

          await sendNotificationToRecipient({
            recipient: managerRecipient,
            text: managerMessage,
            subject: managerSubject,
          });

          // --- Admin Notification ---
          if (adminContacts) {
            const adminSubject = `Критически низкий баланс медиагруппы: "${deduction.holdingName}"`; // Subject for admin
            const adminEmailMessage = `Добрый день! Баланс медиагруппы "${deduction.holdingName}" после списания составил ${deduction.updated_balance.toFixed(2)}. Требуется ваше внимание.`; // Message for admin email
            const adminTelegramMessage = `Добрый день! Баланс медиагруппы "${deduction.holdingName}" после списания составил ${deduction.updated_balance.toFixed(2)}. Требуется ваше внимание. <a href="${process.env.DIRECTUS_URL}/admin/content/holdings/${deduction.holding}">Ссылка на медиагруппу</a>`; // Message for admin Telegram

            // Send notification to admin using the common function
            // Assuming adminContacts has the necessary email and telegram_id fields and matches the recipient type
            await sendNotificationToRecipient({
              recipient: adminContacts, // Cast to match expected type
              text: adminEmailMessage,
              html: adminTelegramMessage, // Use HTML for Telegram message as it contains a link
              subject: adminSubject,
            });
          } else {
            log.warn(
              "Контакты админа не найдены для отправки уведомления о критически низком балансе медиагруппы",
              { holdingId: deduction.holding },
            );
          }
        } else if (
          deduction.updated_balance > 0 &&
          deduction.updated_balance <= deduction.full_amount
        ) {
          // Low balance condition for manager
          log.warn("Баланс медиагруппы меньше месячного расхода", {
            holdingId: deduction.holding,
            originalBalance: deduction.original_balance,
            updatedBalance: deduction.updated_balance,
            fullAmount: deduction.full_amount,
          });

          const subject = `Уведомление о низком балансе медиагруппы`;
          const message = `Добрый день! Баланс вашей медиагруппы (${deduction.updated_balance.toFixed(2)}) меньше месячного расхода (${deduction.full_amount.toFixed(2)}). Пожалуйста, пополните баланс для покрытия следующих списаний.`;

          // Send notification to manager using the common function
          const managerRecipient = {
            email: deduction.managerEmail,
            telegram_id: deduction.managerTelegramId,
            // Add other necessary user properties if sendNotificationToRecipient requires them and they are available
            // e.g., first_name, last_name, status, etc. based on components["schemas"]["Users"]
            // For now, assuming email and telegram_id are sufficient based on sendNotificationToRecipient implementation
          } as components["schemas"]["Users"] | null | undefined; // Cast to match expected type

          await sendNotificationToRecipient({
            recipient: managerRecipient,
            text: message,
            subject: subject,
          });
        }
      }

      log.info("Процесс создания списаний завершен");
    } catch (error) {
      log.error("Критическая ошибка в процессе создания списаний", { error });
      throw error;
    }
  },
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _job = new Cron(
  "0 9 */1 * *",
  {
    timezone: "Europe/Moscow",
    name: "createDeductions",
  },
  createDeductions,
);
