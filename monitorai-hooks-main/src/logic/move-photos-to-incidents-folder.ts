import { INCIDENTS_FRAMES_FOLDER } from "../consts";
import { IFilesService } from "../types";

export const movePhotosToIncidentsFolder = async (
  filesService: IFilesService,
  photoIds: (string | { id: string } | null | undefined)[],
  logger: any,
) => {
  const validPhotoIds = photoIds
    .filter(
      (id): id is string | { id: string } => id !== null && id !== undefined,
    )
    .map((id) => (typeof id === "string" ? id : id.id!));

  if (validPhotoIds.length > 0) {
    try {
      logger.info(`Обновление папки для ${validPhotoIds.length} фото`);
      await filesService.updateMany(validPhotoIds, {
        folder: INCIDENTS_FRAMES_FOLDER,
      });
      logger.info("Фото успешно перемещено");
    } catch (error) {
      logger.error(`Failed to update defect photo(s): ${error}`);
      throw error;
    }
  }
};
