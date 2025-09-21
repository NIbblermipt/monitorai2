import { movePhotosToIncidentsFolder } from "../../logic/move-photos-to-incidents-folder";
import { components } from "../../schema";
import { FilterEvent, FilterParams, IFilesService } from "../../types";

export function incidentsUpdateFilter({
  filter,
  logger,
  getSchema,
  FilesService,
}: FilterParams) {
  filter<
    Omit<components["schemas"]["ItemsIncidents"], "extra_photos"> & {
      extra_photos?: {
        create: [
          {
            incidents_id: string;
            directus_files_id: {
              id: string;
            };
          },
        ];
        update: [];
        delete: [];
      };
    }
  >(
    "incidents.items.update" as FilterEvent,
    async (payload, _meta, _context) => {
      logger.info("Начало работы с обновленным инцидентом");
      logger.debug(`Получен payload: ${JSON.stringify(payload)}`);

      // Process extra_photos if present
      if (
        payload.extra_photos?.create &&
        Array.isArray(payload.extra_photos.create) &&
        payload.extra_photos.create.length > 0
      ) {
        const fileIdsFromExtraPhotos: string[] =
          payload.extra_photos.create.map(
            (photo) => photo.directus_files_id.id,
          );

        if (fileIdsFromExtraPhotos.length > 0) {
          await movePhotosToIncidentsFolder(
            new FilesService({ schema: await getSchema() }) as IFilesService,
            fileIdsFromExtraPhotos,
            logger,
          );
        }
      }

      if (payload.status === "in_progress" && !payload.repairs_started_at) {
        logger.info("Добавляем время начала устранения инцидента");
        payload.repairs_started_at = new Date().toJSON();
      }

      if (payload.status === "resolved") {
        logger.info("Добавляем время окончания устранения инцидента");
        payload.closed_at = new Date().toJSON();
      }

      if (payload.status === "not_resolved") {
        payload.button_change_status = "in_progress";
      }

      return payload;
    },
  );
}
