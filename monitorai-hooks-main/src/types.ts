import type { DirectusError } from "@directus/errors";
import type {
  Accountability,
  ActionHandler,
  Item as AnyItem, // Used in properties
  BusboyFileStream,
  EventContext,
  File,
  FilterHandler,
  Item,
  PermissionsAction, // Used in QueryOptions
  PrimaryKey,
  Query, // Used in various methods
  SchemaOverview, // Used in properties
} from "@directus/types";
import type { Readable } from "node:stream";
import type { components } from "./schema";
import { ApiExtensionContext } from "@directus/extensions";

export interface CreatedCheck {
  checks_id: any;
  directus_files_id: {
    id: string;
  };
}

export interface IncidentContacts {
  responsible?: {
    id: string;
    telegram_id?: string | null;
    email: string;
  } | null;
  video_screen?: {
    installation_code: string;
    company?: {
      manager?: {
        id: string;
        telegram_id?: string | null;
        email: string;
      } | null;
    } | null;
  } | null;
}

export interface FilterParams {
  filter: <T = unknown>(event: string, handler: FilterHandler<T>) => void;
  logger: ApiExtensionContext["logger"];
  getSchema: (
    options?: {
      database?: any;
      bypassCache?: boolean;
    },
    attempt?: number,
  ) => Promise<SchemaOverview>;
  ItemsService: new (
    collection: Collection | SystemCollection,
    { schema }: { schema: SchemaOverview },
  ) => IItemsService;
  FilesService: new ({ schema }: { schema: SchemaOverview }) => IFilesService;
}

export interface ActionParams {
  action: (event: string, handler: ActionHandler) => void;
  logger: ApiExtensionContext["logger"];
  getSchema: (
    options?: {
      database?: any;
      bypassCache?: boolean;
    },
    attempt?: number,
  ) => Promise<SchemaOverview>;
  ItemsService: new (
    collection: Collection | SystemCollection,
    { schema }: { schema: SchemaOverview },
  ) => IItemsService;
  FilesService: new ({ schema }: { schema: SchemaOverview }) => IFilesService;
}

export interface Schema {
  video_screens: components["schemas"]["ItemsVideoScreens"][];
  checks: components["schemas"]["ItemsChecks"][];
  incidents: components["schemas"]["ItemsIncidents"][];
  pings: components["schemas"]["ItemsPings"][];
  holdings: components["schemas"]["ItemsHoldings"][];
  companies: components["schemas"]["ItemsCompanies"][];
  reports: components["schemas"]["ItemsReports"][];
  deductions: components["schemas"]["ItemsDeductions"][];
  repair_teams: components["schemas"]["ItemsRepairTeams"][];
  telecom_operators: components["schemas"]["ItemsTelecomOperators"][];
}

export type Collection =
  | "meta"
  | "video_screens"
  | "checks"
  | "incidents"
  | "pings"
  | "holdings"
  | "companies"
  | "reports"
  | "deductions"
  | "repair_teams"
  | "telecom_operators";

export type SystemCollection = `directus_${
  | "activity"
  | "collections"
  | "dashboards"
  | "extensions"
  | "fields"
  | "files"
  | "flows"
  | "folders"
  | "migrations"
  | "notifications"
  | "operations"
  | "panels"
  | "permissions"
  | "presets"
  | "relations"
  | "revisions"
  | "roles"
  | "sessions"
  | "settings"
  | "shares"
  | "translations"
  | "users"
  | "versions"}`;

type CommonEvent =
  | "websocket.message"
  | "auth.login"
  | `${Collection}.items.read`
  | `${Collection}.items.create`
  | `${Collection}.items.update`
  | `${Collection}.items.delete`
  | `${Collection}.items.promote`
  | `${SystemCollection}.read`
  | `${SystemCollection}.create`
  | `${SystemCollection}.update`
  | `${SystemCollection}.delete`;

export type FilterEvent =
  | CommonEvent
  | "request.not_found"
  | "request.error"
  | "database.error"
  | "auth.jwt"
  | "auth.create"
  | "auth.update"
  | "authenticate"
  | "email.send"
  | `${Collection}.items.query`
  | `${SystemCollection}.query`;

export type ActionEvent =
  | CommonEvent
  | "websocket.error"
  | "websocket.close"
  | "websocket.connect"
  | "websocket.auth.success"
  | "websocket.auth.failure"
  | "server.start"
  | "server.stop"
  | "response"
  | "files.upload"
  | `${Collection}.items.sort`;

export interface Meta {
  event?: ActionEvent | FilterEvent;
  collection: Collection;
}

/**
 * Represents the public contract for the Directus FilesService.
 *
 * Extends the base ItemsService for the 'directus_files' collection
 * and adds file-specific methods like uploadOne and importOne.
 */
export interface IFilesService extends IItemsService<File> {
  /**
   * Uploads a single new file to the configured storage adapter.
   */
  uploadOne(
    stream: BusboyFileStream | Readable,
    data: Partial<File> & { storage: string },
    primaryKey?: PrimaryKey,
    opts?: MutationOptions,
  ): Promise<PrimaryKey>;

  /**
   * Imports a single file from an external URL.
   */
  importOne(importURL: string, body: Partial<File>): Promise<PrimaryKey>;
}

type Knex = unknown;
type Keyv = unknown;

export enum UserIntegrityCheckFlag {
  None = 0,
  /** Check if the number of remaining admin users is greater than 0 */
  RemainingAdmins = 1 << 0,
  /** Check if the number of users is within the limits */
  UserLimits = 1 << 1,
  All = ~(~0 << 2),
}
export type MutationOptions = {
  /**
   * Callback function that's fired whenever a revision is made in the mutation
   */
  onRevisionCreate?: ((pk: PrimaryKey) => void) | undefined;

  /**
   * Flag to disable the auto purging of the cache. Is ignored when CACHE_AUTO_PURGE isn't enabled.
   */
  autoPurgeCache?: false | undefined;

  /**
   * Flag to disable the auto purging of the system cache.
   */
  autoPurgeSystemCache?: false | undefined;

  /**
   * Allow disabling the emitting of hooks. Useful if a custom hook is fired (like files.upload)
   */
  emitEvents?: boolean | undefined;

  /**
   * To bypass the emitting of action events if emitEvents is enabled
   * Can be used to queue up the nested events from item service's create, update and delete
   */
  bypassEmitAction?: ((params: ActionEventParams) => void) | undefined;

  /**
   * To bypass limits so that functions would work as intended
   */
  bypassLimits?: boolean | undefined;

  /**
   * To keep track of mutation limits
   */
  mutationTracker?: MutationTracker | undefined;

  /*
   * The validation error to throw right before the mutation takes place
   */
  preMutationError?: DirectusError | undefined;

  bypassAutoIncrementSequenceReset?: boolean;

  /**
   * Indicate that the top level mutation needs to perform a user integrity check before commiting the transaction
   * This is a combination of flags
   * @see UserIntegrityCheckFlag
   */
  userIntegrityCheckFlags?: UserIntegrityCheckFlag;

  /**
   * Callback function that is called whenever a mutation requires a user integrity check to be made
   */
  onRequireUserIntegrityCheck?:
    | ((flags: UserIntegrityCheckFlag) => void)
    | undefined;
};

export type ActionEventParams = {
  event: string | string[];
  meta: Record<string, any>;
  context: EventContext;
};

export type AbstractServiceOptions = {
  knex?: undefined;
  accountability?: Accountability | null | undefined;
  schema: SchemaOverview;
  nested?: string[];
};

export interface AbstractService {
  knex: Knex;
  accountability: Accountability | null | undefined;
  nested: string[];

  createOne(data: Partial<Item>): Promise<PrimaryKey>;
  createMany(data: Partial<Item>[]): Promise<PrimaryKey[]>;

  readOne(key: PrimaryKey, query?: Query): Promise<Item>;
  readMany(keys: PrimaryKey[], query?: Query): Promise<Item[]>;
  readByQuery(query: Query): Promise<Item[]>;

  updateOne(key: PrimaryKey, data: Partial<Item>): Promise<PrimaryKey>;
  updateMany(keys: PrimaryKey[], data: Partial<Item>): Promise<PrimaryKey[]>;

  deleteOne(key: PrimaryKey): Promise<PrimaryKey>;
  deleteMany(keys: PrimaryKey[]): Promise<PrimaryKey[]>;
}
// Define types used specifically within the method signatures
export type QueryOptions = {
  stripNonRequested?: boolean;
  permissionsAction?: PermissionsAction;
  emitEvents?: boolean;
};

export type MutationTracker = {
  trackMutations: (count: number) => void;
  getCount: () => number;
};

/**
 * Represents the public contract for the ItemsService.
 *
 * Defines the properties and public methods available on an instance
 * of the Directus ItemsService class.
 */
export interface IItemsService<
  Item extends AnyItem = AnyItem,
  Collection extends string = string,
> extends AbstractService {
  // Inherit from AbstractService if it defines common service properties/methods
  // Properties (instance variables)
  collection: Collection;
  knex: Knex;
  accountability: Accountability | null;
  eventScope: string;
  schema: SchemaOverview;
  cache: Keyv | null;
  nested: string[];

  // Public Methods

  /**
   * Creates a MutationTracker instance.
   */
  createMutationTracker(initialCount?: number): MutationTracker;

  /**
   * Gets primary keys based on a query.
   */
  getKeysByQuery(query: Query): Promise<PrimaryKey[]>;

  /**
   * Creates a single new item.
   */
  createOne(data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey>;

  /**
   * Creates multiple new items at once.
   */
  createMany(
    data: Partial<Item>[],
    opts?: MutationOptions,
  ): Promise<PrimaryKey[]>;

  /**
   * Gets items by query.
   */
  readByQuery(query: Query, opts?: QueryOptions): Promise<Item[]>;

  /**
   * Gets single item by primary key.
   */
  readOne(key: PrimaryKey, query?: Query, opts?: QueryOptions): Promise<Item>;

  /**
   * Gets multiple items by primary keys.
   */
  readMany(
    keys: PrimaryKey[],
    query?: Query,
    opts?: QueryOptions,
  ): Promise<Item[]>;

  /**
   * Updates multiple items by query.
   */
  updateByQuery(
    query: Query,
    data: Partial<Item>,
    opts?: MutationOptions,
  ): Promise<PrimaryKey[]>;

  /**
   * Updates a single item by primary key.
   */
  updateOne(
    key: PrimaryKey,
    data: Partial<Item>,
    opts?: MutationOptions,
  ): Promise<PrimaryKey>;

  /**
   * Updates multiple items in a single transaction.
   */
  updateBatch(
    data: Partial<Item>[],
    opts?: MutationOptions,
  ): Promise<PrimaryKey[]>;

  /**
   * Updates many items by primary key, setting all items to the same change.
   */
  updateMany(
    keys: PrimaryKey[],
    data: Partial<Item>,
    opts?: MutationOptions,
  ): Promise<PrimaryKey[]>;

  /**
   * Upserts a single item.
   */
  upsertOne(
    payload: Partial<Item>,
    opts?: MutationOptions,
  ): Promise<PrimaryKey>;

  /**
   * Upserts many items.
   */
  upsertMany(
    payloads: Partial<Item>[],
    opts?: MutationOptions,
  ): Promise<PrimaryKey[]>;

  /**
   * Deletes multiple items by query.
   */
  deleteByQuery(query: Query, opts?: MutationOptions): Promise<PrimaryKey[]>;

  /**
   * Deletes a single item by primary key.
   */
  deleteOne(key: PrimaryKey, opts?: MutationOptions): Promise<PrimaryKey>;

  /**
   * Deletes multiple items by primary key.
   */
  deleteMany(keys: PrimaryKey[], opts?: MutationOptions): Promise<PrimaryKey[]>;

  /**
   * Reads/treats collection as singleton.
   */
  readSingleton(query: Query, opts?: QueryOptions): Promise<Partial<Item>>;

  /**
   * Upserts/treats collection as singleton.
   */
  upsertSingleton(
    data: Partial<Item>,
    opts?: MutationOptions,
  ): Promise<PrimaryKey>;
}
