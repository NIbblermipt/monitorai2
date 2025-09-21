import { components } from "../../schema";
import {
  ActionEvent,
  ActionParams,
  Collection,
  IItemsService,
  SystemCollection,
} from "../../types";

export function checksUpdateAction({
  action,
  logger,
  getSchema,
  ItemsService,
}: ActionParams) {
  action(
    "checks.items.update" as ActionEvent,
    async (meta: Record<"payload" | "keys" | "collection", any>) => {
      const ids = meta.keys as string[];
      const payload = meta.payload as {
        is_successful: boolean;
        incidents?: any;
      };

      // TODO: посмотреть payload: id упешных фото
      logger.info({ ...payload, id: ids[0] }, "Обновлена проверка");

      if (payload.is_successful && ids.length > 0 && ids[0]) {
        const incidentsService = new ItemsService(
          "incidents" as Collection | SystemCollection,
          {
            schema: await getSchema(),
          },
        ) as IItemsService<
          components["schemas"]["ItemsIncidents"],
          "incidents"
        >;

        const unresolvedIncidents = (await incidentsService.readByQuery({
          fields: ["id"],
          filter: {
            _and: [
              { video_screen: { checks: { _eq: ids[0] } } },
              { status: { _eq: "verification" } },
            ],
          },
        })) as { id: number }[];

        logger.info(
          unresolvedIncidents,
          "Получены инциденты со статусом `verification`",
        );

        if (unresolvedIncidents.length > 0) {
          await incidentsService.updateMany(
            unresolvedIncidents.map((incident) => incident.id!),
            { status: "resolved" },
          );
        }
      }
    },
  );
}
