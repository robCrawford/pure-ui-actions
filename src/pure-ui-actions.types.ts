import { VNode } from "./vdom";

type ValueOf<TType> = TType[keyof TType];

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
  props?: TProps;
  state?: TState;
  rootState?: TRootState;
  event?: Event;
};

export type ActionHandler<TData, TProps, TState, TRootState> = (
  data?: TData,
  ctx?: Context<TProps, TState, TRootState>
) => { state: TState; next?: Next };

export type TaskHandler<TData, TProps, TState, TRootState> = (
  data?: TData
) => Task<any, TProps, TState, TRootState>;

export type Task<TResult, TProps, TState, TRootState> = {
  perform: () => Promise<TResult | void> | TResult | void;
  success?: (result: TResult, ctx: Context<TProps, TState, TRootState>) => Next;
  failure?: (error: unknown, ctx: Context<TProps, TState, TRootState>) => Next;
};

export type Component = {
  Props?: Record<string, unknown>;
  State?: Record<string, unknown>;
  Actions?: Record<string, unknown>;
  Tasks?: Record<string, unknown>;
  RootState?: Record<string, unknown>;
  RootActions?: Record<string, unknown>;
  RootTasks?: Record<string, unknown>;
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
  state?: (props?: TComponent["Props"]) => TComponent["State"];
  init?: Next;
  actions?: {
    [TKey in keyof TComponent["Actions"]]: ActionHandler<
      TComponent["Actions"][TKey],
      TComponent["Props"],
      TComponent["State"],
      TComponent["RootState"]
    >;
  };
  tasks?: {
    [TKey in keyof TComponent["Tasks"]]: TaskHandler<
      TComponent["Tasks"][TKey],
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
  action: GetActionThunk<TComponent["Actions"]>;
  task: GetTaskThunk<TComponent["Tasks"]>;
  rootAction: GetActionThunk<TComponent["RootActions"]>;
  rootTask: GetTaskThunk<TComponent["RootTasks"]>;
}) => Config<TComponent>;

export type RenderFn<TProps> = (props?: TProps) => VNode | void;
