import { VNode } from "./vdom";

type ValueOf<T> = T[keyof T];

type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

export enum ThunkType {
  Action,
  Task
}

export type ActionThunk = {
  (data?: Record<string, unknown>): void;
  type: ThunkType.Action;
};

export type GetActionThunk<TActions> = <TKey extends keyof TActions>(
  actionName: TKey,
  data?: TActions[TKey]
) => ActionThunk;

export type RunAction<TActions> = (actionName: keyof TActions, data?: ValueOf<TActions>) => void;

export type TaskThunk = {
  (data?: Record<string, unknown> | Event): Promise<Next | void> | void;
  type: ThunkType.Task;
  taskName: string;
  taskData?: unknown;
};

export type GetTaskThunk<TTasks> = (taskName: keyof TTasks, data?: ValueOf<TTasks>) => TaskThunk;

export type Next = undefined | ActionThunk | TaskThunk | (ActionThunk | TaskThunk)[];

export type Context<TProps, TState, TRootState> = {
  props: TProps;
  state: TState;
  rootState: TRootState;
  event?: Event;
};

export type ActionHandler<TData, TProps, TState, TRootState> = (
  data: TData,
  ctx: Context<TProps, TState, TRootState>
) => { state: TState; next?: Next };

export type TaskHandler<TData, TProps, TState, TRootState> = (
  data: TData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => Task<any, TProps, TState, TRootState, any>;

export type Task<TResult, TProps, TState, TRootState = unknown, TError = unknown> = {
  perform: () => Promise<TResult | void> | TResult | void;
  success?: (result: TResult, ctx: Context<TProps, TState, TRootState>) => Next;
  failure?: (error: DeepPartial<TError>, ctx: Context<TProps, TState, TRootState>) => Next;
};

export type Component = {
  Props?: Record<string, unknown>;
  State?: Record<string, unknown>;
  ActionPayloads?: Record<string, unknown>;
  TaskPayloads?: Record<string, unknown>;
  RootState?: Record<string, unknown>;
  RootActionPayloads?: Record<string, unknown>;
  RootTaskPayloads?: Record<string, unknown>;
};

export type ComponentInstance = {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Config<any>;
  state?: Record<string, unknown>;
  props?: Record<string, unknown>;
  prevProps?: Record<string, unknown>;
  render: RenderFn<Record<string, unknown>>;
  vnode?: VNode;
  isRoot: boolean;
  inCurrentRender: boolean;
};

export type Config<TComponent extends Component = Component> = {
  state?: (props: TComponent["Props"]) => TComponent["State"];
  init?: Next;
  actions?: {
    [TKey in keyof TComponent["ActionPayloads"]]: ActionHandler<
      TComponent["ActionPayloads"][TKey],
      TComponent["Props"],
      TComponent["State"],
      TComponent["RootState"]
    >;
  };
  tasks?: {
    [TKey in keyof TComponent["TaskPayloads"]]: TaskHandler<
      TComponent["TaskPayloads"][TKey],
      TComponent["Props"],
      TComponent["State"],
      TComponent["RootState"]
    >;
  };
  view: (
    id: string,
    ctx: Context<TComponent["Props"], TComponent["State"], TComponent["RootState"]>
  ) => VNode;
};

export type GetConfig<TComponent extends Component> = (fns: {
  action: GetActionThunk<TComponent["ActionPayloads"]>;
  task: GetTaskThunk<TComponent["TaskPayloads"]>;
  rootAction: GetActionThunk<TComponent["RootActionPayloads"]>;
  rootTask: GetTaskThunk<TComponent["RootTaskPayloads"]>;
}) => Config<TComponent>;

export type RenderFn<TProps> = (props?: TProps) => VNode | void;
