import { patch, setHook, VNode } from "./vdom";
export { html, VNode } from "./vdom";
import { log } from "./jetixLog";
export * from './jetixTest';

type ValueOf<TType> = TType[keyof TType];

enum ThunkType {
  Action,
  Task
};

export type ActionThunk = {
  (data?: Record<string, unknown>): void;
  type: ThunkType.Action;
}

export type GetActionThunk<TActions> = <TKey extends keyof TActions>(actionName: TKey, data?: TActions[TKey]) => ActionThunk;

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

export type ActionHandler<TData = Record<string, unknown>, TProps = Record<string, unknown>, TState = Record<string, unknown>, TRootState = Record<string, unknown>> = (
  data?: TData,
  ctx?: Context<TProps, TState, TRootState>
) => { state: TState; next?: Next };

type TaskHandler<TData = Record<string, unknown>, TProps = Record<string, unknown>, TState = Record<string, unknown>, TRootState = Record<string, unknown>> = (data?: TData) => Task<any, TProps, TState, TRootState>;

export type Task<TResult = unknown, TProps = Record<string, unknown>, TState = Record<string, unknown>, TRootState = Record<string, unknown>> = {
  perform: () => Promise<TResult | void> | TResult | void;
  success?: (result: TResult, ctx: Context<TProps, TState, TRootState>) => Next;
  failure?: (error: unknown, ctx: Context<TProps, TState, TRootState>) => Next;
};

type Component = {
  Props?: Record<string, unknown>;
  State?: Record<string, unknown>;
  Actions?: Record<string, unknown>;
  Tasks?: Record<string, unknown>;
  RootState?: Record<string, unknown>;
  RootActions?: Record<string, unknown>;
  RootTasks?: Record<string, unknown>;
};

export type Config<TComponent extends Component = Component> = {
  state?: (props?: TComponent['Props']) => TComponent['State'];
  init?: Next;
  actions?: {[TKey in keyof TComponent['Actions']]: ActionHandler<TComponent['Actions'][TKey], TComponent['Props'], TComponent['State'], TComponent['RootState']>};
  tasks?: {[TKey in keyof TComponent['Tasks']]: TaskHandler<TComponent['Tasks'][TKey], TComponent['Props'], TComponent['State'], TComponent['RootState']>};
  view: (
    id: string,
    ctx: Context<TComponent['Props'], TComponent['State'], TComponent['RootState']>
  ) => VNode;
};

export type GetConfig<TComponent extends Component> = (fns: {
  action: GetActionThunk<TComponent['Actions']>;
  task: GetTaskThunk<TComponent['Tasks']>;
  rootAction: GetActionThunk<TComponent['RootActions']>;
  rootTask: GetTaskThunk<TComponent['RootTasks']>;
}) => Config<TComponent>;

type RenderFn<TProps> = (props?: TProps) => VNode | void;

// Internal type for component registry
type ComponentInstance = {
  id: string;
  config: Config<any>;
  state: Record<string, unknown> | undefined;
  props: Record<string, unknown> | undefined;
  prevProps: Record<string, unknown> | undefined;
  render: RenderFn<Record<string, unknown>>;
  vnode: VNode | undefined;
  isRoot: boolean;
  inCurrentRender: boolean;
};

const componentRegistry = new Map<string, ComponentInstance>();

// Thunk caches for memoization
const actionThunkCache = new Map<string, ActionThunk>();
const taskThunkCache = new Map<string, TaskThunk>();

// Export for testing
export const getComponentRegistry = (): Map<string, ComponentInstance> => componentRegistry;

let rootAction: GetActionThunk<any> | undefined;
let rootTask: GetTaskThunk<any> | undefined;
let rootState: Record<string, unknown> | undefined;
let renderRootId: string | undefined;

function resetAppState(): void {
  componentRegistry.clear();
  actionThunkCache.clear();
  taskThunkCache.clear();

  rootState = undefined;
  renderRootId = undefined;
  rootAction = undefined;
  rootTask = undefined;
}

const appId = "app";
let internalKey = {}; // Private unique value
export const _setTestKey = // Set for tests
  <T extends object>(k: T): T => internalKey = k;
let noRender = 0;
let rootStateChanged = false;
let stateChanged = false;

// Helper to create stable cache keys
function createCacheKey(id: string, name: string, data: unknown): string {
  const dataKey = data === null || data === undefined
    ? ''
    : JSON.stringify(data);
  return `${id}:${name}:${dataKey}`;
}

// Action thunk creator with memoization
function createActionThunk(componentId: string, actionName: string, data: unknown): ActionThunk {
  const cacheKey = createCacheKey(componentId, actionName, data);

  const cached = actionThunkCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const actionThunk: {
    (thunkInput?: Record<string, unknown> | Event): void | ActionThunk;
    type: ThunkType.Action;
  } = (thunkInput) => {
    if (isDomEvent(thunkInput)) {
      const instance = componentRegistry.get(componentId);
      if (!instance) {
        throw Error(`Component ${componentId} not found in registry`);
      }
      executeAction(instance, actionName, data, thunkInput as Event);
    }
    else if (thunkInput === internalKey) {
      const instance = componentRegistry.get(componentId);
      if (!instance) {
        throw Error(`Component ${componentId} not found in registry`);
      }
      executeAction(instance, actionName, data);
    }
    else {
      log.manualError(componentId, actionName);
    }
  };

  actionThunk.type = ThunkType.Action;
  actionThunkCache.set(cacheKey, actionThunk);
  return actionThunk;
}

// Task thunk creator with memoization
function createTaskThunk(componentId: string, taskName: string, data: unknown): TaskThunk {
  const cacheKey = createCacheKey(componentId, taskName, data);

  const cached = taskThunkCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const taskThunk: {
    (thunkInput?: Record<string, unknown> | Event): Promise<Next | void> | void;
    type: ThunkType.Task;
    taskName: string;
    taskData?: unknown;
  } = (thunkInput) => {
    // Defer instance lookup until thunk is actually invoked
    if (isDomEvent(thunkInput) || thunkInput === internalKey) {
      const instance = componentRegistry.get(componentId);
      if (!instance) {
        throw Error(`Component ${componentId} not found in registry`);
      }
      const result = performTask(instance, taskName, data);
      return result.then((next?: Next): void => runNext(instance, next));
    }
    else {
      log.manualError(componentId, taskName);
    }
  };

  taskThunk.type = ThunkType.Task;
  taskThunk.taskName = String(taskName);
  taskThunk.taskData = data;
  taskThunkCache.set(cacheKey, taskThunk);
  return taskThunk;
}

function executeAction(
  instance: ComponentInstance,
  actionName: string,
  data: unknown,
  event?: Event
): void {
  const { config, state: prevState, props, isRoot, id } = instance;
  const actions = config.actions;

  if (!actions || !actions[actionName]) {
    return;
  }

  let next: Next;
  const prevStateFrozen = deepFreeze(prevState);

  ({ state: instance.state, next } = (actions[actionName] as ActionHandler)(
    data as Record<string, unknown>,
    { props, state: prevStateFrozen, rootState, event }
  ));

  const currStateChanged = instance.state !== prevState;
  stateChanged = stateChanged || currStateChanged;
  log.updateStart(id, currStateChanged && prevState, actionName, data as Record<string, unknown>);

  if (isRoot) {
    rootState = instance.state;
    rootStateChanged = currStateChanged;
  }

  if (currStateChanged && instance.state) {
    log.updateEnd(instance.state);
  }
  runNext(instance, next);
}

function performTask(
  instance: ComponentInstance,
  taskName: string,
  data: unknown
): Promise<Next | undefined> {
  const { config, state, props, id } = instance;
  const tasks = config.tasks;

  if (!tasks || !tasks[taskName]) {
    throw Error(`Task ${taskName} not found in component ${id}`);
  }

  const { perform, success, failure }: Task = tasks[taskName](data);
  const runSuccess = (result: unknown): Next | undefined =>
    success && success(result, { props, state, rootState });
  const runFailure = (err: unknown): Next | undefined =>
    failure && failure(err, { props, state, rootState });

  try {
    const output = perform();
    log.taskPerform(String(taskName), isPromise(output));

    if (isPromise(output)) {
      renderComponentInstance(instance); // Render pending state updates
      return output
        .then((result: unknown): Next | undefined => {
          log.taskSuccess(id, String(taskName));
          return runSuccess(result);
        })
        .catch((err: Error): Next | undefined => {
          log.taskFailure(id, String(taskName), err);
          return runFailure(err);
        });
    }
    else {
      log.taskSuccess(id, String(taskName));
      return Promise.resolve(runSuccess(output));
    }
  }
  catch(err) {
    log.taskFailure(id, String(taskName), err as Error);
    return Promise.resolve(runFailure(err));
  }
}

// Next executor
function runNext(instance: ComponentInstance, next: Next | undefined): void {
  if (!next) {
    renderComponentInstance(instance);
  }
  else if (isThunk(next)) {
    // Thunks may only be invoked here or from the DOM
    // `internalKey` prevents any manual calls from outside
    next(internalKey);
  }
  else if (Array.isArray(next)) {
    noRender++;
    next.forEach((n: Next): void => runNext(instance, n));
    noRender--;
    renderComponentInstance(instance);
  }
}

// Render function
function renderComponentInstance(instance: ComponentInstance): VNode | undefined {
  if (!noRender) {
    if (rootStateChanged) {
      const rootInstance = componentRegistry.get(appId);
      rootStateChanged = false;
      if (rootInstance) {
        return renderComponentInstance(rootInstance);
      }
    }
    else if (stateChanged) {
      let isRenderRoot = false;
      if (!renderRootId) {
        renderRootId = instance.id;
        isRenderRoot = true;
      }

      const prevVNode = instance.vnode;
      instance.vnode = instance.config.view(instance.id, {
        props: instance.props,
        state: instance.state,
        rootState
      });
      log.render(instance.id, instance.props);

      if (isRenderRoot && prevVNode) {
        patch(prevVNode, instance.vnode);
        log.patch();
        stateChanged = false;
        renderRootId = undefined;

        // Reset render flags
        Array.from(componentRegistry.values()).forEach((inst) => {
          inst.inCurrentRender = false;
        });
      }

      log.setStateGlobal(instance.id, instance.state);

      if (isRenderRoot) {
        publish("patch");
      }

      setRenderRef(instance);
    }
  }

  instance.prevProps = instance.props;

  return instance.vnode;
}

export function component<TComponent extends Component>(
  getConfig: GetConfig<TComponent>
): { (idStr: string, props?: TComponent['Props']): VNode; getConfig: Function } {
  // Pass in callback that returns component config
  // Returns render function that is called by parent e.g. `counter("counter-0", { start: 0 })`
  const renderFn = (idStr: string, props?: TComponent['Props']): VNode => {
    const id = (idStr || "").replace(/^#/, "");

    // Check if component exists in registry
    const existing = componentRegistry.get(id);

    if (!id.length || (!noRender && existing && existing.inCurrentRender)) {
      throw Error(`Component${id ? ` "${id}" ` : ' '}must have a unique id!`);
    }

    // Mark as in current render
    if (existing) {
      existing.inCurrentRender = true;
    }

    return renderComponent<TComponent>(id, getConfig, props);
  };
  // Add a handle to `getConfig` for tests
  renderFn.getConfig = getConfig;
  return renderFn;
}

export function renderComponent<TComponent extends Component>(
  id: string,
  getConfig: GetConfig<TComponent>,
  props?: TComponent['Props']
): VNode {
  deepFreeze(props);
  const isRoot = id === appId;

  // If component already exists, just render again
  const existing = componentRegistry.get(id);
  if (existing) {
    // Check if props changed (by reference)
    const propsChanged = existing.props !== props;
    existing.props = props;

    if (propsChanged) {
      log.render(existing.id, existing.props);
      existing.vnode = existing.config.view(existing.id, {
        props: existing.props,
        state: existing.state,
        rootState
      });
      existing.prevProps = existing.props;
      setRenderRef(existing);
    }

    return existing.vnode as VNode;
  }

  const action: GetActionThunk<TComponent['Actions']> = (actionName, data): ActionThunk => {
    return createActionThunk(id, String(actionName), data);
  };

  const task: GetTaskThunk<TComponent['Tasks']> = (taskName, data): TaskThunk => {
    return createTaskThunk(id, String(taskName), data);
  };

  const config = getConfig({
    action,
    task,
    rootAction: rootAction as GetActionThunk<TComponent['RootActions']>,
    rootTask: rootTask as GetTaskThunk<TComponent['RootTasks']>
  });

  const state = config.state && config.state(props);

  // Create component instance
  const instance: ComponentInstance = {
    id,
    config,
    state,
    props,
    prevProps: undefined,
    render: (p) => {
      const inst = componentRegistry.get(id);
      if (inst) {
        inst.props = p;
        return renderComponentInstance(inst);
      }
    },
    vnode: undefined,
    isRoot,
    inCurrentRender: true
  };

  componentRegistry.set(id, instance);

  if (config.init) {
    noRender++;
    runNext(instance, config.init);
    noRender--;
  }
  else {
    log.noInitialAction(id, state);
  }

  if (isRoot) {
    rootAction = action;
    rootTask = task;
    rootState = state;
  }

  log.render(id, props);
  instance.vnode = config.view(id, { props, state: instance.state, rootState });
  instance.prevProps = props;

  setRenderRef(instance);
  log.setStateGlobal(id, state);

  return instance.vnode;
}

export function mount<TActions, TProps>({ app, props, init }: {
  app: (idStr: string, props?: TProps) => VNode;
  props: TProps;
  init?: (runRootAction: RunAction<TActions>) => void;
}): void {
  resetAppState();
  // Mount the top-level app component
  const appElement = document.getElementById(appId);
  if (!appElement) {
    throw Error(`Element with id "${appId}" not found`);
  }
  patch(appElement, app(appId, props));
  log.patch();
  publish("patch");

  // Reset render flags
  Array.from(componentRegistry.values()).forEach((instance) => {
    instance.inCurrentRender = false;
  });

  // Manually invoking an action without `internalKey` is an error, so `runRootAction`
  // is provided by `mount` for wiring up events to root actions (e.g. routing)
  if (init) {
    const runRootAction: RunAction<TActions> = (actionName, data): void => {
      rootAction?.(actionName, data)(internalKey);
    };
    init(runRootAction);
  }
}

export function withKey(key: string, vnode: VNode): VNode {
  vnode.key = key;
  return vnode;
}

function isDomEvent(e?: Record<string, unknown> | Event): boolean {
  return Boolean(e && "eventPhase" in e && "target" in e && "type" in e);
}

function setRenderRef(instance: ComponentInstance): void {
  if (!instance.vnode) return;

  setHook(instance.vnode, "destroy", (): void => {
    const inst = componentRegistry.get(instance.id);
    if (inst && !inst.inCurrentRender && instance.id !== renderRootId) {
      // Clean up registry
      componentRegistry.delete(instance.id);

      // Clean up thunk caches
      Array.from(actionThunkCache.keys()).forEach((key) => {
        if (key.startsWith(`${instance.id}:`)) {
          actionThunkCache.delete(key);
        }
      });
      Array.from(taskThunkCache.keys()).forEach((key) => {
        if (key.startsWith(`${instance.id}:`)) {
          taskThunkCache.delete(key);
        }
      });

      log.setStateGlobal(instance.id, undefined);
    }
  });
}

function isThunk(next: Next): next is ActionThunk | TaskThunk {
  if (next) {
    return !Array.isArray(next) && next.type in ThunkType;
  }
  return false;
}

function isPromise<TValue>(o: Promise<TValue> | unknown): o is Promise<TValue> {
  return Boolean(o && (o as Promise<unknown>).then);
}

function deepFreeze<TObject extends Record<string, unknown>>(o?: TObject): TObject | undefined {
  if (o) {
    Object.freeze(o);
    Object.getOwnPropertyNames(o).forEach((p: string): void => {
      if (o.hasOwnProperty(p) &&
          o[p] !== null &&
          (typeof o[p] === "object" || typeof o[p] === "function") &&
          !Object.isFrozen(o[p])
      ) {
        deepFreeze(o[p] as Record<string, unknown>);
      }
    });
  }
  return o;
}

// Pub/sub
export function subscribe(type: string, listener: EventListener): void {
  document.addEventListener(type, listener);
}

export function unsubscribe(type: string, listener: EventListener): void {
  document.removeEventListener(type, listener);
}

export function publish(type: string, detail?: Record<string, unknown>): void {
  document.dispatchEvent(new CustomEvent(type, detail ? { detail } : undefined));
}
