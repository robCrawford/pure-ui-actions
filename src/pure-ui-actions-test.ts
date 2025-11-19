/*
API for unit testing components

- Initialise component test API
import counter from "./counter";
const { initialState, action, task, config } = testComponent(counter, { start: 0 });

- Test an action: outputs `state` and `next` results as data
const { state, next } = testAction("Increment", { step: 1 });

- Test a task: returns `success` and `failure` callbacks for tests to invoke
const { perform, success, failure } = testTask("ValidateCount", { count: 0 });
const { name, data } = success({ text: "Test" });
*/
import { Context, Next } from "./pure-ui-actions.types";

type ComponentTestApi = {
  config: {
    state?: Function;
    init?: Next;
    actions?: Record<string, unknown>;
    tasks?: Record<string, unknown>;
    view: Function;
  };
  initialState: Record<string, unknown>;
  testAction: <TState>(name: string, data?: Record<string, unknown>) => { state: TState; next?: NextData | NextData[] };
  testTask: (name: string, data?: Record<string, unknown>) => TestTaskSpec;
};

export type NextData = {
  name: string;
  data?: Record<string, unknown>;
};

type TestTaskSpec<TProps = Record<string, unknown>, TState = Record<string, unknown>, TRootState = Record<string, unknown>> = {
  perform: () => Promise<unknown> | void;
  success?: (result?: unknown, ctx?: Context<TProps, TState, TRootState>) => NextData | NextData[];
  failure?: (error?: unknown, ctx?: Context<TProps, TState, TRootState>) => NextData | NextData[];
};

// Returns next action/task inputs as data
const nextToData = (name: string, data?: Record<string, unknown>): NextData => ({ name, data });

export function testComponent(component: { getConfig: Function }, props?: object): ComponentTestApi {
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

    // Test an action
    testAction<TState>(name: string, data?: Record<string, unknown>): { state: TState; next?: NextData } {
      // Returns any next operations as data
      return config.actions[name](data, { props, state: initialState });
    },

    // Get task spec for manually testing `success` and `failure` output
    testTask(name: string, data?: Record<string, unknown>): TestTaskSpec {
      // Returns task spec
      return config.tasks[name](data);
    }
  };
}

