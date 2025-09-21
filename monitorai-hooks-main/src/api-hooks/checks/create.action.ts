import { CHECKS_FRAMES_FOLDER } from "../../consts";
import { components } from "../../schema";
import {
  ActionParams,
  Collection,
  ActionEvent,
  CreatedCheck,
  SystemCollection,
  IItemsService,
  IFilesService,
} from "../../types";

export function checksCreateAction({
  action,
  logger,
  getSchema,
  ItemsService,
  FilesService,
}: ActionParams) {
  action(
    "checks.items.create" as ActionEvent,
    async (meta: Record<"payload" | "key" | "collection", any>) => {
      const payload = meta["payload"] as {
        video_screen: string;
        frames: {
          create: CreatedCheck[];
          update: CreatedCheck[];
          delete: CreatedCheck[];
        };
      };
      const id = meta["key"] as string;

      logger.info(payload, "Создана проверка");

      const checksService = new ItemsService(
        "checks" as Collection | SystemCollection,
        {
          schema: await getSchema(),
        },
      ) as IItemsService<components["schemas"]["ItemsChecks"], "checks">;

      let checks;
      try {
        logger.info("Получение данных проверок");
        checks = (await checksService.readByQuery({
          fields: ["id", "frames.directus_files_id"],
          filter: {
            _and: [
              {
                video_screen: {
                  _eq: payload.video_screen,
                },
              },
              // {
              //   is_successful: {
              //     _nnull: true,
              //   },
              // },
              {
                id: {
                  _neq: id,
                },
              },
              {
                "count(frames)": {
                  _gt: 0,
                },
              },
            ],
          },
        })) as { frames: [{ directus_files_id: string }] }[];
        logger.info(checks, "Данные проверок");
      } catch (error) {
        logger.error(`Не удалось получить проверки: ${error}`);
        throw error;
      }
      if (checks.length > 0) {
        const filesService = new FilesService({
          schema: await getSchema(),
        }) as IFilesService;

        const imagesToDelete = [
          ...new Set(
            checks
              .flatMap((check) => check.frames)
              .map((frame) => frame.directus_files_id)
              .filter(Boolean),
          ),
        ];

        logger.info(imagesToDelete, "Удаление старых фреймов");

        await filesService.deleteByQuery({
          filter: {
            _and: [
              {
                folder: {
                  _eq: CHECKS_FRAMES_FOLDER,
                },
              },
              {
                id: {
                  _in: imagesToDelete,
                },
              },
            ],
          },
        });
      }
    },
  );
}
