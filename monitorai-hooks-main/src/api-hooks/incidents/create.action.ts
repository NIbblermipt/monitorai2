import { DefectTypes } from "../../consts";
import { sendMail, sendTg } from "../../notifications";
import { components } from "../../schema";
import {
  ActionParams,
  ActionEvent,
  SystemCollection,
  Collection,
  IItemsService,
  IncidentContacts,
} from "../../types";

export function incidentsCreateAction({
  action,
  logger,
  getSchema,
  ItemsService,
}: ActionParams) {
  action(
    "incidents.items.create" as ActionEvent,
    async (meta: Record<"payload" | "key" | "collection", any>) => {
      logger.info("Начало обработки создания инцидента");
      logger.debug(`Payload: ${JSON.stringify(meta.payload)} Key: ${meta.key}`);

      const payload = meta["payload"] as {
        video_screen: string;
        defect_types: string[];
        defect_photo: string;
        extra_photos: (string | { id: string })[] | null | undefined;
        check: number;
        responsible: string;
      };
      const id = meta["key"] as number;

      logger.info({ ...payload, id }, "Создан инцидент");

      const incidentsService = new ItemsService(
        "incidents" as Collection | SystemCollection,
        {
          schema: await getSchema(),
        },
      ) as IItemsService<components["schemas"]["ItemsIncidents"], "incidents">;
      let incidentContacts: IncidentContacts | null = null;
      try {
        logger.info(`Чтение данных инцидента #${id} для уведомлений`);
        incidentContacts = (await incidentsService.readOne(id, {
          fields: [
            "responsible.id",
            "responsible.telegram_id",
            "responsible.email",
            "video_screen.installation_code",
            "video_screen.company.manager.id",
            "video_screen.company.manager.telegram_id",
            "video_screen.company.manager.email",
          ],
        })) as IncidentContacts;
        logger.info(
          `Полученные контактные данные: ${JSON.stringify(incidentContacts)}`,
        );
      } catch (e) {
        logger.error(`Ошибка при чтении данных инцидента #${id}: ${e}`);
        // Не бросаем ошибку, чтобы не прерывать создание инцидента
      }

      if (incidentContacts?.responsible && incidentContacts.video_screen) {
        const responsible = incidentContacts.responsible;
        const defectName = (payload.defect_types || [])
          .map((type) => DefectTypes[type as keyof typeof DefectTypes] ?? type)
          .join(", ");

        logger.info(
          `Отправка Email уведомления ответственному ${responsible.id} для инцидента #${id}`,
        );
        await sendMail(
          {
            to: responsible.email,
            cc: incidentContacts?.video_screen?.company?.manager?.email,
            subject: `Новый инцидент #${id} (${defectName})`,
            text:
              `Новый инцидент #${id} (${defectName}) ` +
              `для экрана ${incidentContacts.video_screen.installation_code}: ` +
              `${process.env.PUBLIC_URL}/admin/content/incidents/${id}`,
          },
          logger,
        );
        const text =
          `Новый инцидент #${id} (${defectName}) ` +
          `для экрана ${incidentContacts.video_screen.installation_code}: ` +
          `<a href="${process.env.PUBLIC_URL}/admin/content/incidents/${id}">` +
          `${process.env.PUBLIC_URL}/admin/content/incidents/${id}</a>`;
        logger.info(
          `Отправка TG уведомления ответственному ${responsible.id} для инцидента #${id}: ${text}`,
        );
        await sendTg(responsible.telegram_id, text, logger);
      } else {
        logger.info(
          `Нет данных ответственного или экрана для инцидента #${id}, уведомления ответственному не отправлены.`,
        );
      }

      if (incidentContacts?.video_screen?.company?.manager) {
        const manager = incidentContacts.video_screen.company.manager;
        const defectName = (payload.defect_types || [])
          .map((type) => DefectTypes[type as keyof typeof DefectTypes] ?? type)
          .join(", ");

        const text =
          `Новый инцидент #${id} (${defectName}) ` +
          `для экрана ${incidentContacts.video_screen.installation_code}: ` +
          `<a href="${process.env.PUBLIC_URL}/admin/content/incidents/${id}">` +
          `${process.env.PUBLIC_URL}/admin/content/incidents/${id}</a>`;
        logger.info(
          `Отправка TG уведомления менеджеру ${manager.id} для инцидента #${id}: ${text}`,
        );
        await sendTg(manager.telegram_id, text, logger);
      } else {
        logger.info(
          `Нет данных менеджера для инцидента #${id}, TG уведомление менеджеру не отправлено.`,
        );
      }

      logger.info("Завершение обработки создания инцидента");
    },
  );
}
