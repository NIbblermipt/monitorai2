import { defineHook } from "@directus/extensions-sdk";

import {
  checksCreateAction,
  checksUpdateAction,
  incidentsCreateAction,
  incidentsCreateFilter,
  incidentsUpdateAction,
  incidentsUpdateFilter,
} from "./api-hooks";

export default defineHook(
  ({ filter, action }, { services, getSchema, logger }) => {
    const { ItemsService, FilesService } = services;
    incidentsCreateFilter({
      filter,
      logger,
      FilesService,
      ItemsService,
      getSchema,
    });

    incidentsUpdateFilter({
      filter,
      logger,
      FilesService,
      ItemsService,
      getSchema,
    });

    incidentsUpdateAction({
      action,
      logger,
      FilesService,
      ItemsService,
      getSchema,
    });

    incidentsCreateAction({
      action,
      logger,
      FilesService,
      ItemsService,
      getSchema,
    });

    checksCreateAction({
      action,
      logger,
      FilesService,
      ItemsService,
      getSchema,
    });

    checksUpdateAction({
      action,
      logger,
      FilesService,
      ItemsService,
      getSchema,
    });
  },
);
