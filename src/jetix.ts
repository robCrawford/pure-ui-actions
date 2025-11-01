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
  (data?: Record<string, unknown>): void | ActionThunk; // Returns another `ActionThunk` when currying
  type: ThunkType;
}

export type GetActionThunk<TActions> = <TKey extends keyof TActions>(actionName: TKey, data?: TActions[TKey]) => ActionThunk;

export type RunAction<TActions> = (actionName: keyof TActions, data?: ValueOf<TActions>) => void;

export type TaskThunk = {
  (data?: Record<string, unknown>): Promise<Next | void> | void;
  type: ThunkType;
  taskName: string;
};

export type GetTaskThunk<TTasks> = (taskName: keyof TTasks, data?: ValueOf<TTasks>) => TaskThunk;

export type Next = undefined | ActionThunk | TaskThunk | (ActionThunk | TaskThunk)[];

export type Context<TProps, TState, TRootState> = {
  props?: TProps;
  state?: TState;
  rootState?: TRootState;
};

export type ActionHandler<TData = Record<string, unknown>, TProps = Record<string, unknown>, TState = Record<string, unknown>, TRootState = Record<string, unknown>> = (
  data?: TData,
  ctx?: Context<TProps, TState, TRootState>
) => { state: TState; next?: Next };

type TaskHandler<TData = Record<string, unknown>, TProps = Record<string, unknown>, TState = Record<string, unknown>, TRootState = Record<string, unknown>> = (data?: TData) => Task<TProps, TState, TRootState>;

export type Task<TProps = Record<string, unknown>, TState = Record<string, unknown>, TRootState = Record<string, unknown>> = {
  perform: () => Promise<unknown> | unknown;
  success?: (result: unknown, ctx: Context<TProps, TState, TRootState>) => Next;
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

export type Config<TComponent extends Component = Record<string, unknown>> = {
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


// App state
export let renderRefs: { [id: string]: RenderFn<Record<string, unknown>> } = {};
export let prevProps: Record<string, Record<string, unknown> | undefined> = {};
export let renderIds: Record<string, boolean> = {};
let rootState: Record<string, unknown> | undefined;
let renderRootId: string | undefined;

function resetAppState(): void {
  renderRefs = {};
  prevProps = {};
  renderIds = {};
  rootState = undefined;
  renderRootId = undefined;
}

const appId = "app";
let internalKey = {}; // Private unique value
export const _setTestKey = // Set for tests
  <T extends object>(k: T): T => internalKey = k;
let noRender = 0;
let rootStateChanged = false;
let stateChanged = false;
let rootAction: Function;
let rootTask: Function;

export function component<TComponent extends Component>(
  getConfig: GetConfig<TComponent>
): { (idStr: string, props?: TComponent['Props']): VNode; getConfig: Function } {
  // Pass in callback that returns component config
  // Returns render function that is called by parent e.g. `counter("counter-0", { start: 0 })`
  const renderFn = (idStr: string, props?: TComponent['Props']): VNode => {
    const id = (idStr || "").replace(/^#/, "");
    if (!id.length || (!noRender && renderIds[id])) {
      throw Error(`Component${id ? ` "${id}" ` : ' '}must have a unique id!`);
    }
    // Ids included in this render
    renderIds[id] = true;
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

  // If component already exists, just run render() again
  const existingComponentRoot = renderById(id, props);
  if (existingComponentRoot) {
    return existingComponentRoot;
  }

  const action: GetActionThunk<TComponent['Actions']> = (actionName, data): ActionThunk => {
    const actionThunk = (thunkInput?: ValueOf<TComponent['Actions']> | object): void => {
      if (isDomEvent(thunkInput as Record<string, unknown>)) {
        // Invoked from the DOM, `thunkInput` is the (unused) event
        update(actionName, data);
      }
      else if (thunkInput === internalKey) {
        // Called by internal method `run()`
        // `internalKey` disallows an action being invoked manually from outside
        update(actionName, data);
      }
      else if (thunkInput) {
        // If a data argument is supplied, return a new thunk instead of invoking the current one
        // This enables currying e.g. when passing an action from parent to child via props
        action(actionName, thunkInput as ValueOf<TComponent['Actions']>);
      }
      else {
        log.manualError(id, String(actionName));
      }
    };
    actionThunk.type = ThunkType.Action;
    return actionThunk;
  };

  const task: GetTaskThunk<TComponent['Tasks']> = (taskName, data): TaskThunk => {
    if (!config.tasks) {
      throw Error(`tasks ${String(config.tasks)}`);
    }
    const performTask = (): Promise<Next> | void => {
      const tasks = config.tasks;
      if (tasks) {
        const { perform, success, failure }: Task<TComponent['Props'], TComponent['State'], TComponent['RootState']> = tasks[taskName as keyof TComponent['Tasks']](data);
        const runSuccess = (result: unknown): Next | undefined => success && success(result, { props, state, rootState });
        const runFailure = (err: unknown): Next | undefined => failure && failure(err, { props, state, rootState });
        try {
          const output = perform();
          log.taskPerform(String(taskName), isPromise(output));
          if (isPromise(output)) {
            render(props); // Render any pending state updates
            return output
              .then((result: unknown): Next => {
                log.taskSuccess(id, String(taskName));
                return runSuccess(result);
              })
              .catch((err: Error): Next => {
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
    };
    const taskThunk = (thunkInput?: Record<string, unknown>): Promise<Next | void> | void => {
      // When invoked from the DOM, `thunkInput` is the (unused) event
      if (isDomEvent(thunkInput) || thunkInput === internalKey) {
        const result = performTask();
        return isPromise(result)
          ? result.then((next?: Next): void => run(next, props))
          : result;
      }
      else {
        log.manualError(id, String(taskName));
      }
    };
    taskThunk.type = ThunkType.Task;
    taskThunk.taskName = String(taskName);
    return taskThunk;
  };

  const config = getConfig({
    action,
    task,
    rootAction: rootAction as GetActionThunk<TComponent['RootActions']>,
    rootTask: rootTask as GetTaskThunk<TComponent['RootTasks']>
  });
  let state = config.state && config.state(props);

  function update(actionName: keyof TComponent['Actions'], data?: ValueOf<TComponent['Actions']>): void {
    let next: Next;
    const prevState = deepFreeze(state);
    const actions = config.actions;

    if (actions) {
      ({ state, next } = (actions[actionName as keyof TComponent['Actions']] as ActionHandler<ValueOf<TComponent['Actions']>, TComponent['Props'], TComponent['State'], TComponent['RootState']>)(
        data, { props, state: prevState, rootState }
      ));

      // Action handlers should return existing state by ref if no changes
      const currStateChanged = state !== prevState;
      stateChanged = stateChanged || currStateChanged;
      log.updateStart(id, currStateChanged && prevState, String(actionName), data as Record<string, unknown>);

      if (isRoot) {
        rootState = state;
        rootStateChanged = currStateChanged;
      }
      log.updateEnd(currStateChanged && state as Record<string, unknown>);
      run(next, props, String(actionName));
    }
  }

  function run(next: Next | undefined, props?: TComponent['Props'], prevTag?: string): void {
    if (!next) {
      render(props);
    }
    else if (isThunk(next)) {
      // Thunks may only be invoked here or from the DOM
      // `internalKey` prevents any manual calls from outside
      next(internalKey);
    }
    else if (Array.isArray(next)) {
      noRender++;
      next.forEach((n: Next): void => run(n, props, prevTag));
      noRender--;
      render(props);
    }
  }

  const render: RenderFn<TComponent['Props']> = (props?: TComponent['Props']): VNode | void => {
    if (!noRender) {
      if (rootStateChanged) {
        const rootRender = renderRefs[appId];
        rootStateChanged = false;
        rootRender && rootRender(prevProps[appId]);
      }
      else if (stateChanged) {
        let isRenderRoot = false;
        if (!renderRootId) {
          // The root component of this render
          renderRootId = id;
          isRenderRoot = true;
        }
        const prevComponentRoot = componentRoot;
        componentRoot = config.view( id, { props, state, rootState });
        log.render(id, props);

        if (isRenderRoot) {
          patch(prevComponentRoot as VNode, componentRoot);
          log.patch();
          stateChanged = false;
          renderRootId = undefined;
          renderIds = {};
        }
        log.setStateGlobal(id, state);
        if (isRenderRoot) {
          publish("patch");
        }
        setRenderRef(componentRoot as VNode, id, render as RenderFn<Record<string, unknown>>);
      }
    }
    prevProps[id] = props;
    return componentRoot;
  }

  if (config.init) {
    noRender++;
    run(config.init, props);
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
  let componentRoot = config.view(id, { props, state, rootState });
  prevProps[id] = props;
  setRenderRef(componentRoot, id, render as RenderFn<Record<string, unknown>>);
  log.setStateGlobal(id, state);

  return componentRoot;
}

export function mount<TActions, TProps>({ app, props, init }: {
  app: (idStr: string, props?: TProps) => VNode;
  props: TProps;
  init?: (runRootAction: RunAction<TActions>) => void;
}): void {
  resetAppState();
  // Mount the top-level app component
  patch(
    document.getElementById(appId) as Element,
    app(appId, props)
  );
  log.patch();
  publish("patch");
  renderIds = {};

  // Manually invoking an action without `internalKey` is an error, so `runRootAction`
  // is provided by `mount` for wiring up events to root actions (e.g. routing)
  if (init) {
    const runRootAction: RunAction<TActions> = (actionName, data): void => {
      rootAction(actionName as string, data)(internalKey);
    };
    init(runRootAction);
  }
}

export function withKey(key: string, vnode: VNode): VNode {
  vnode.key = key;
  return vnode;
}

function isDomEvent(e?: Record<string, unknown>): boolean {
  return Boolean(e && "eventPhase" in e);
}

function renderById(id: string, props?: Record<string, unknown>): VNode | void {
  const render = renderRefs[id];
  if (render) {
    return render(props);
  }
}

function setRenderRef(vnode: VNode, id: string, render: RenderFn<Record<string, unknown>>): void {
  renderRefs[id] = render;
  setHook(vnode, "destroy", (): void => {
    // Component not found in `renderIds` for this render
    if(!renderIds[id] && id !== renderRootId) {
      delete renderRefs[id];
      delete prevProps[id];
      log.setStateGlobal(id, undefined);
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
