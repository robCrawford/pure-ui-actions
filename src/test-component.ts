/*
API for unit testing components

- Initialise component test API
import counter from "./counter";
const { initialState, testAction, testTask, config } = testComponent(counter, { start: 0 });

- Test an action: outputs `state` and `next` results as data
const { state, next } = testAction("Increment", { step: 1 });

- Test an action with custom state
const { state, next } = testAction("Increment", { step: 1 }, { state: { count: 5 } });

- Test an action with rootState or event
const { state, next } = testAction("HandleSubmit", {}, {
  state: customState,
  rootState: { theme: "dark" },
  event: mockEvent
});

- Test a task: returns `success` and `failure` callbacks for tests to invoke
const { perform, success, failure } = testTask("ValidateCount", { count: 0 });
const { name, data } = success({ text: "Test" });
*/
import { Config, Context } from "./pure-ui-actions.types";

// Options for testing actions with custom context
// Note: Props are set during component initialization and cannot be overridden per-action
export type TestActionOptions<TState, TRootState> = {
  // Override the component state for this test (defaults to initialState)
  state?: TState;
  // Provide rootState for components that access it
  rootState?: TRootState;
  // Provide a DOM event for actions that access event context
  event?: Event;
};

export type NextData = {
  name: string;
  data?: Record<string, unknown>;
};

// Type helper to extract component type structure
export type ComponentType<TProps = unknown, TState = unknown, TRootState = unknown> = {
  Props: TProps;
  State: TState;
  RootState?: TRootState;
};

export type ComponentTestApi<
  TState = Record<string, unknown>,
  TRootState = Record<string, unknown>
> = {
  config: Config;
  initialState: TState;
  testAction: <TActionState = TState>(
    name: string,
    data?: Record<string, unknown>,
    options?: TestActionOptions<TActionState, TRootState>
  ) => { state: TActionState; next?: NextData | NextData[] };
  testTask: (name: string, data?: Record<string, unknown>) => TestTaskSpec;
};

export type TestTaskSpec<
  TProps = Record<string, unknown>,
  TState = Record<string, unknown>,
  TRootState = Record<string, unknown>
> = {
  perform: () => Promise<unknown> | void;
  success?: (
    result?: unknown,
    ctx?: Context<TProps, TState, TRootState>
  ) => NextData | NextData[] | undefined;
  failure?: (
    error?: unknown,
    ctx?: Context<TProps, TState, TRootState>
  ) => NextData | NextData[] | undefined;
};

// Returns next action/task inputs as data
const nextToData = (name: string, data?: Record<string, unknown>): NextData => ({ name, data });

export function testComponent<TComponent extends Partial<ComponentType>>(
  component: { getConfig: Function },
  props?: TComponent["Props"]
): ComponentTestApi<TComponent["State"], TComponent["RootState"]> {
  // Initialise component passing in `nextToData()` instead of `action()` and `task()` functions
  const config = component.getConfig({
    action: nextToData,
    task: nextToData,
    rootAction: nextToData,
    rootTask: nextToData
  });
  const initialState = config.state && config.state(props);

  return {
    // Output from the callback passed into `component(...)`
    config,

    // For comparing state changes
    initialState,

    testAction<TState, TRootState = Record<string, unknown>>(
      name: string,
      data?: Record<string, unknown>,
      options?: TestActionOptions<TState, TRootState>
    ): { state: TState; next?: NextData | NextData[] } {
      // Returns any next operations as data
      return config.actions[name](data, {
        props: props ?? {},
        state: options?.state !== undefined ? options.state : (initialState ?? {}),
        rootState: options?.rootState ?? {},
        event: options?.event
      });
    },

    // Get task spec for manually testing `success` and `failure` output
    testTask(name: string, data?: Record<string, unknown>): TestTaskSpec {
      // Returns task spec
      return config.tasks[name](data);
    }
  };
}
