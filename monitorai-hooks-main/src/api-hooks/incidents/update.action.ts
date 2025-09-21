import { DefectTypes } from "../../consts";
import { sendTg, sendMail } from "../../notifications";
import { components } from "../../schema";
import {
  ActionEvent,
  ActionParams,
  Collection,
  IItemsService,
  IncidentContacts,
  SystemCollection,
} from "../../types";

export function incidentsUpdateAction({
  action,
  logger,
  getSchema,
  ItemsService,
}: ActionParams) {
  action(
    "incidents.items.update" as ActionEvent,
    async (meta: Record<"payload" | "keys" | "collection", any>) => {
      logger.info("Начало обработки обновления инцидента");
      logger.debug(
        `Payload: ${JSON.stringify(meta.payload)} Keys: ${JSON.stringify(meta.keys)}`,
      );

      if (!meta.keys || !meta.keys[0]) {
        logger.info("Нет ключей для обновления, пропускаем");
        return;
      }
      const id = meta.keys[0] as number;
      const payload = meta.payload as {
        status?: string;
      };

      logger.info({ ...payload, id }, "Обработка обновления инцидента");

      const incidentsService = new ItemsService(
        "incidents" as Collection | SystemCollection,
        {
          schema: await getSchema(),
        },
      ) as IItemsService<components["schemas"]["ItemsIncidents"], "incidents">;
      let incident: (IncidentContacts & { defect_types: string[] }) | null =
        null;
      try {
        logger.info(`Чтение данных инцидента #${id} для уведомлений`);
        incident = (await incidentsService.readOne(id, {
          fields: [
            "defect_types",
            "responsible.id",
            "responsible.telegram_id",
            "responsible.email",
            "video_screen.installation_code",
            "video_screen.company.manager.id",
            "video_screen.company.manager.telegram_id",
            "video_screen.company.manager.email",
            // // @ts-expect-error
            // { responsible: ["id", "telegram_id", "email"] },
            // // @ts-expect-error
            // {
            //   video_screen: [
            //     "installation_code",
            //     { company: [{ manager: ["id", "telegram_id", "email"] }] },
            //   ],
            // },
          ],
        })) as IncidentContacts & { defect_types: string[] };
        logger.debug(
          `Полученные контактные данные: ${JSON.stringify(incident)}`,
        );
      } catch (e) {
        logger.error(`Ошибка при чтении данных инцидента #${id}: ${e}`);
        // Не бросаем ошибку, чтобы не прерывать обновление инцидента
      }

      if (
        incident?.responsible &&
        incident.video_screen &&
        payload.status === "resolved"
      ) {
        const defectName = (incident.defect_types || [])
          .map((type) => DefectTypes[type as keyof typeof DefectTypes] ?? type)
          .join(", ");
        const responsible = incident.responsible;
        const text =
          `Инцидент #${id} (${defectName}) ` +
          `для экрана ${incident.video_screen.installation_code} закрыт: ` +
          `<a href="${process.env.PUBLIC_URL}/admin/content/incidents/${id}">` +
          `${process.env.PUBLIC_URL}/admin/content/incidents/${id}</a>`;
        logger.info(
          `Отправка TG уведомления ответственному ${responsible.id} для инцидента #${id}: ${text}`,
        );
        await sendTg(responsible.telegram_id, text, logger);
      } else {
        logger.info(
          `Нет данных ответственного или экрана для инцидента #${id}, TG уведомление не отправлено.`,
        );
      }

      if (
        incident?.video_screen?.company?.manager &&
        payload.status === "resolved"
      ) {
        const defectName = (incident.defect_types || [])
          .map((type) => DefectTypes[type as keyof typeof DefectTypes] ?? type)
          .join(", ");
        const manager = incident.video_screen.company.manager;
        logger.info(
          `Отправка Email уведомления менеджеру ${manager.id} для инцидента #${id}`,
        );
        await sendMail(
          {
            to: manager.email,
            cc: incident?.responsible?.email,
            subject: `Инцидент #${id} (${defectName}) закрыт`,
            text:
              `Инцидент #${id} (${defectName}) ` +
              `для экрана ${incident.video_screen.installation_code} закрыт: ` +
              `${process.env.PUBLIC_URL}/admin/content/incidents/${id}`,
          },
          logger,
        );
        const text =
          `Инцидент #${id} (${defectName}) ` +
          `для экрана ${incident.video_screen.installation_code} закрыт: ` +
          `<a href="${process.env.PUBLIC_URL}/admin/content/incidents/${id}">` +
          `${process.env.PUBLIC_URL}/admin/content/incidents/${id}</a>`;
        logger.info(
          `Отправка TG уведомления менеджеру ${manager.id} для инцидента #${id}: ${text}`,
        );
        await sendTg(manager.telegram_id, text, logger);
      } else {
        logger.info(
          `Нет данных менеджера для инцидента #${id}, уведомления менеджеру не отправлены.`,
        );
      }

      logger.info("Завершение обработки обновления инцидента");
    },
  );
}
