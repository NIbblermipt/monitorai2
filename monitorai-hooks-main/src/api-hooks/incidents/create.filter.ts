import { components } from "../../schema";
import {
  Collection,
  FilterEvent,
  FilterParams,
  IFilesService,
  IItemsService,
  SystemCollection,
} from "../../types";
import { RecordNotUniqueError } from "@directus/errors";
import { movePhotosToIncidentsFolder } from "../../logic/move-photos-to-incidents-folder";

export function incidentsCreateFilter({
  filter,
  logger,
  getSchema,
  ItemsService,
  FilesService,
}: FilterParams) {
  return filter<
    Omit<components["schemas"]["ItemsIncidents"], "extra_photos"> & {
      extra_photos?: {
        create: [
          {
            incidents_id: "+";
            directus_files_id: {
              id: string;
            };
          },
        ];
        update: [];
        delete: [];
      };
    }
  >("incidents.items.create" as FilterEvent, async (payload) => {
    logger.info("Начало работы с инцидентом");
    logger.debug(`Получен payload: ${JSON.stringify(payload)}`);

    if (!payload.video_screen) {
      logger.error("Отсутствует video_screen, пропускаем обработку");
      return payload;
    }

    // проверять, что не существует инцидент того же типа для этого экрана
    const incidentsService = new ItemsService(
      "incidents" as Collection | SystemCollection,
      {
        schema: await getSchema(),
      },
    ) as IItemsService<components["schemas"]["ItemsIncidents"], "incidents">;

    let similarIncidents: components["schemas"]["ItemsIncidents"][];
    let unverifiedIncident: components["schemas"]["ItemsIncidents"] | undefined;

    try {
      logger.info("Поиск открытых инцидентов");
      similarIncidents = await incidentsService.readByQuery({
        fields: ["id", "status"],
        filter: {
          _and: [
            {
              video_screen: {
                _eq:
                  typeof payload.video_screen === "string"
                    ? payload.video_screen
                    : payload.video_screen.id,
              },
            },
            {
              status: {
                _neq: "resolved",
              },
            },
          ],
        },
      });
      logger.debug(`Найдено инцидентов для экрана: ${similarIncidents.length}`);
    } catch (error) {
      logger.error(`Failed to fetch similar incidents: ${error}`);
      throw error;
    }
    if (similarIncidents.length > 0) {
      unverifiedIncident = similarIncidents.find(
        (incident) => incident.status === "verification",
      );

      if (unverifiedIncident) {
        // await movePhotosToIncidentsFolder(
        //   new FilesService({ schema: await getSchema() }) as IFilesService,
        //   typeof payload.defect_photo == "string"
        //     ? [payload.defect_photo]
        //     : [payload.defect_photo?.id],
        //   logger,
        // );

        try {
          logger.info("Обновляем статус инцидента");
          await incidentsService.updateOne(unverifiedIncident.id!, {
            status: "not_resolved",
            // Проверить, что при отсутствии фото не удаляется старое
            // defect_photo: payload.defect_photo
            //   ? payload.defect_photo
            //   : undefined,
          });
        } catch (error) {
          logger.error(`Failed to update unverified incident: ${error}`);
          throw error;
        }
      }

      logger.info("Найден существующий инцидент, пропускаем создание");
      throw new RecordNotUniqueError({
        collection: "incidents",
        field: "defect_types",
      });
    }

    const allPhotoIdsToMove: string[] = [];

    // Add defect_photo to the list if present
    if (payload.defect_photo) {
      const photoId =
        typeof payload.defect_photo === "string"
          ? payload.defect_photo
          : (payload.defect_photo as { id: string })?.id;
      if (photoId) {
        allPhotoIdsToMove.push(photoId);
      }
    }

    // Process extra_photos if present
    if (
      payload.extra_photos?.create &&
      Array.isArray(payload.extra_photos.create) &&
      payload.extra_photos.create.length > 0
    ) {
      const fileIdsFromExtraPhotos: string[] = payload.extra_photos.create.map(
        (photo) => photo.directus_files_id.id,
      );

      allPhotoIdsToMove.push(...fileIdsFromExtraPhotos);
    }

    // Only call movePhotosToIncidentsFolder if there are photos to move
    if (allPhotoIdsToMove.length > 0) {
      await movePhotosToIncidentsFolder(
        new FilesService({ schema: await getSchema() }) as IFilesService,
        allPhotoIdsToMove,
        logger,
      );
    }

    // добавлять данные из экрана (ремонтник)
    const screenService = new ItemsService(
      "video_screens" as Collection | SystemCollection,
      {
        schema: await getSchema(),
      },
    ) as IItemsService<
      components["schemas"]["ItemsVideoScreens"],
      "video_screens"
    >;

    let screen: { assigned_user?: string | null } | null;

    try {
      logger.info("Получение данных экрана");
      screen = (await screenService.readOne(
        typeof payload.video_screen === "string"
          ? payload.video_screen
          : payload.video_screen.id,
        {
          fields: [
            // "id",
            // "installation_code",
            "assigned_user",
            // { assigned_user: ["id", "telegram_id", "email"] },
            // { company: [{ manager: ["id", "telegram_id", "email"] }] },
          ],
        },
      )) as { assigned_user?: string | null };
      logger.debug(`Данные экрана: ${JSON.stringify(screen)}`);
    } catch (error) {
      logger.error(`Failed to fetch screen data: ${error}`);
      throw error;
    }

    if (screen?.assigned_user) {
      logger.info("Назначение ответственного из данных экрана");
      payload.responsible = screen.assigned_user;
    }

    logger.info("Обработка инцидента завершена");
    return payload;
  });
}
