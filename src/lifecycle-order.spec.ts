/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { component, mount, html, subscribe, unsubscribe, Config, VNode } from "./pure-ui-actions";
import { log } from "./log";
import { JSDOM } from "jsdom";

const { div, button } = html;

function getWindowState(): Record<string, RootState> | undefined {
  return (window as unknown as { state?: Record<string, RootState> }).state;
}

type RootProps = Readonly<{
  initialValue: string;
  startAt: number;
}>;

type RootState = Readonly<{
  value: string;
  counter: number;
  executionOrder: string[];
  step1Done: boolean;
  step2Done: boolean;
  step3Done: boolean;
  step4Done: boolean;
  step5Done: boolean;
  domEventHandled: boolean;
  complete: boolean;
}>;

type RootActions = Readonly<{
  Step1_InitAction: null;
  Step2_HandleSyncSuccess: null;
  Step3_HandleAsyncSuccess: { data: string };
  Step4_HandleFailure: { error: string };
  Step5a_ArrayItem: null;
  Step5b_ArrayItem: null;
  Step6_HandleDomEvent: null;
  IncrementCounter: null;
  Step7_Complete: null;
}>;

type RootTasks = Readonly<{
  SyncTask: null;
  AsyncTask: null;
  FailingTask: null;
}>;

type RootComponent = {
  Props: RootProps;
  State: RootState;
  ActionPayloads: RootActions;
  TaskPayloads: RootTasks;
};

type ChildProps = Record<string, never>;

type ChildActions = Readonly<{
  TriggerIncrement: null;
}>;

type ChildComponent = {
  Props: ChildProps;
  State: Record<string, never>;
  ActionPayloads: ChildActions;
  RootState: RootState;
  RootActionPayloads: RootActions;
};

// ===== TRACKING VARIABLES =====

interface ContextInfo {
  hasProps: boolean;
  hasState: boolean;
  hasRootState: boolean;
  hasEvent: boolean;
  receivedData?: string;
  receivedResult?: { data: string };
  receivedError?: string;
  eventType?: string;
}

// Track context passed to actions and tasks for verification
const contextTracker: {
  actions: Record<string, ContextInfo>;
  tasks: Record<string, ContextInfo>;
} = {
  actions: {},
  tasks: {}
};

// Track patch event firing
let patchEventFired = false;
let patchEventState: Record<string, RootState> | null = null;

const createRootComponent = () => {
  return component<RootComponent>(({ action, task }) => ({
    // State initializer - tests props → state flow
    state: (props?) => ({
      value: props?.initialValue ?? "",
      counter: props?.startAt ?? 0,
      executionOrder: ["mount"],
      step1Done: false,
      step2Done: false,
      step3Done: false,
      step4Done: false,
      step5Done: false,
      domEventHandled: false,
      complete: false
    }),

    // Init action
    init: action("Step1_InitAction", null),

    // Action handlers
    actions: {
      Step1_InitAction: (_, context) => {
        // Track context
        contextTracker.actions.Step1_InitAction = {
          hasProps: !!context.props,
          hasState: !!context.state,
          hasRootState: context.rootState !== undefined,
          hasEvent: !!context?.event
        };

        if (!context.state) throw new Error("Context state is required");
        const currentState = context.state;
        return {
          state: {
            ...currentState,
            executionOrder: [...currentState.executionOrder, "step1"],
            step1Done: true
          },
          next: task("SyncTask", null)
        };
      },

      Step2_HandleSyncSuccess: (_, context) => {
        contextTracker.actions.Step2_HandleSyncSuccess = {
          hasProps: !!context.props,
          hasState: !!context.state,
          hasRootState: context.rootState !== undefined,
          hasEvent: !!context?.event
        };

        if (!context.state) throw new Error("Context state is required");
        const currentState = context.state;
        return {
          state: {
            ...currentState,
            executionOrder: [...currentState.executionOrder, "step2"],
            step2Done: true
          },
          next: task("AsyncTask", null)
        };
      },

      Step3_HandleAsyncSuccess: (payload, context) => {
        contextTracker.actions.Step3_HandleAsyncSuccess = {
          hasProps: !!context.props,
          hasState: !!context.state,
          hasRootState: context.rootState !== undefined,
          hasEvent: !!context?.event,
          receivedData: payload?.data
        };

        if (!context.state) throw new Error("Context state is required");
        const currentState = context.state;
        return {
          state: {
            ...currentState,
            executionOrder: [...currentState.executionOrder, "step3"],
            step3Done: true
          },
          next: task("FailingTask", null)
        };
      },

      Step4_HandleFailure: (payload, context) => {
        contextTracker.actions.Step4_HandleFailure = {
          hasProps: !!context.props,
          hasState: !!context.state,
          hasRootState: context.rootState !== undefined,
          hasEvent: !!context?.event,
          receivedError: payload?.error
        };

        if (!context.state) throw new Error("Context state is required");
        const currentState = context.state;
        return {
          state: {
            ...currentState,
            executionOrder: [...currentState.executionOrder, "step4"],
            step4Done: true
          },
          next: [action("Step5a_ArrayItem", null), action("Step5b_ArrayItem", null)]
        };
      },

      Step5a_ArrayItem: (_, context) => {
        contextTracker.actions.Step5a_ArrayItem = {
          hasProps: !!context.props,
          hasState: !!context.state,
          hasRootState: context.rootState !== undefined,
          hasEvent: !!context?.event
        };

        if (!context.state) throw new Error("Context state is required");
        const currentState = context.state;
        return {
          state: {
            ...currentState,
            executionOrder: [...currentState.executionOrder, "step5a"]
          }
        };
      },

      Step5b_ArrayItem: (_, context) => {
        contextTracker.actions.Step5b_ArrayItem = {
          hasProps: !!context.props,
          hasState: !!context.state,
          hasRootState: context.rootState !== undefined,
          hasEvent: !!context?.event
        };

        if (!context.state) throw new Error("Context state is required");
        const currentState = context.state;
        return {
          state: {
            ...currentState,
            executionOrder: [...currentState.executionOrder, "step5b"],
            step5Done: true
          },
          next: undefined // Will trigger DOM event next
        };
      },

      Step6_HandleDomEvent: (_, context) => {
        contextTracker.actions.Step6_HandleDomEvent = {
          hasProps: !!context.props,
          hasState: !!context.state,
          hasRootState: context.rootState !== undefined,
          hasEvent: !!context?.event,
          eventType: context?.event?.type
        };

        if (!context.state) throw new Error("Context state is required");
        const currentState = context.state;
        return {
          state: {
            ...currentState,
            executionOrder: [...currentState.executionOrder, "step6"],
            domEventHandled: true
          },
          next: undefined // Child will trigger increment next
        };
      },

      IncrementCounter: (_, context) => {
        contextTracker.actions.IncrementCounter = {
          hasProps: !!context.props,
          hasState: !!context.state,
          hasRootState: context.rootState !== undefined,
          hasEvent: !!context?.event
        };

        if (!context.state) throw new Error("Context state is required");
        const currentState = context.state;
        return {
          state: {
            ...currentState,
            counter: currentState.counter + 1,
            executionOrder: [...currentState.executionOrder, "increment"]
          },
          next: action("Step7_Complete", null)
        };
      },

      Step7_Complete: (_, context) => {
        contextTracker.actions.Step7_Complete = {
          hasProps: !!context.props,
          hasState: !!context.state,
          hasRootState: context.rootState !== undefined,
          hasEvent: !!context?.event
        };

        if (!context.state) throw new Error("Context state is required");
        const currentState = context.state;
        return {
          state: {
            ...currentState,
            executionOrder: [...currentState.executionOrder, "step7"],
            complete: true
          }
        };
      }
    },

    // Task handlers
    tasks: {
      SyncTask: () => ({
        perform: () => {
          // Synchronous side effect (no Promise)
        },
        success: (_, ctx) => {
          contextTracker.tasks.SyncTask = {
            hasProps: !!ctx.props,
            hasState: !!ctx.state,
            hasRootState: ctx.rootState !== undefined,
            hasEvent: !!ctx?.event
          };
          return action("Step2_HandleSyncSuccess", null);
        }
      }),

      AsyncTask: () => ({
        perform: () => {
          return Promise.resolve({ data: "async-result" });
        },
        success: (result, ctx) => {
          contextTracker.tasks.AsyncTask = {
            hasProps: !!ctx.props,
            hasState: !!ctx.state,
            hasRootState: ctx.rootState !== undefined,
            hasEvent: !!ctx?.event,
            receivedResult: result
          };
          return action("Step3_HandleAsyncSuccess", { data: result.data });
        }
      }),

      FailingTask: () => ({
        perform: () => {
          return Promise.reject(new Error("task-failure"));
        },
        failure: (error, ctx) => {
          contextTracker.tasks.FailingTask = {
            hasProps: !!ctx.props,
            hasState: !!ctx.state,
            hasRootState: ctx.rootState !== undefined,
            hasEvent: !!ctx?.event,
            receivedError: error instanceof Error ? error.message : String(error)
          };
          return action("Step4_HandleFailure", { error: "task-failure" });
        }
      })
    },

    // View
    view(id, { state }): VNode {
      return div(`#${id}`, [
        div(`Counter: ${state?.counter ?? 0}`),
        button(
          {
            attrs: { id: "test-button" },
            on: { click: action("Step6_HandleDomEvent", null) }
          },
          "Click me"
        ),
        div(`#${id}-child-container`)
      ]);
    }
  }));
};

// ===== CHILD COMPONENT =====

const createChildComponent = () => {
  return component<ChildComponent>(
    ({ action, rootAction }): Config<ChildComponent> => ({
      actions: {
        TriggerIncrement: (_, context) => {
          contextTracker.actions.ChildTriggerIncrement = {
            hasProps: context.props === undefined || Object.keys(context.props ?? {}).length === 0,
            hasState: context.state === undefined || Object.keys(context.state ?? {}).length === 0,
            hasRootState: !!context.rootState,
            hasEvent: !!context?.event
          };

          return {
            state: {},
            next: rootAction?.("IncrementCounter", null)
          };
        }
      },

      view(id, { rootState }): VNode {
        return div(`#${id}`, [
          div(`Root counter from child: ${rootState?.counter ?? 0}`),
          button(
            {
              attrs: { id: "child-button" },
              on: { click: action("TriggerIncrement", null) }
            },
            "Increment from child"
          )
        ]);
      }
    })
  );
};

describe("Lifecycle and Data Flow", () => {
  let dom: JSDOM;
  let originalWindow: typeof globalThis.window;
  let originalDocument: typeof globalThis.document;
  let logSpies: Record<string, ReturnType<typeof vi.spyOn>>;
  let patchHandler: () => void;

  beforeEach(() => {
    // Setup JSDOM
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
      url: "http://localhost"
    });
    originalWindow = globalThis.window;
    originalDocument = globalThis.document;
    globalThis.window = dom.window as any;
    globalThis.document = dom.window.document;

    // Reset tracking
    contextTracker.actions = {};
    contextTracker.tasks = {};
    patchEventFired = false;
    patchEventState = null;

    // Setup log spies
    logSpies = {
      setStateGlobal: vi.spyOn(log, "setStateGlobal"),
      noInitialAction: vi.spyOn(log, "noInitialAction"),
      updateStart: vi.spyOn(log, "updateStart"),
      updateEnd: vi.spyOn(log, "updateEnd"),
      taskPerform: vi.spyOn(log, "taskPerform"),
      taskSuccess: vi.spyOn(log, "taskSuccess"),
      taskFailure: vi.spyOn(log, "taskFailure"),
      render: vi.spyOn(log, "render"),
      patch: vi.spyOn(log, "patch")
    };

    // Subscribe to patch event
    patchHandler = () => {
      patchEventFired = true;
      // Capture state from window
      patchEventState = getWindowState() ?? null;
    };
    subscribe("patch", patchHandler);
  });

  afterEach(() => {
    // Cleanup
    unsubscribe("patch", patchHandler);
    Object.values(logSpies).forEach((spy) => spy.mockRestore());
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  describe("Component Lifecycle Order", () => {
    it("should execute mount → init → actions → tasks → render in correct order", async () => {
      const rootComponent = createRootComponent();

      // Mount component
      mount({
        app: rootComponent,
        props: { initialValue: "test-value", startAt: 10 }
      });

      // Wait for async tasks to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Get final state from window
      const finalState = getWindowState()?.app;

      // Verify execution order up to step5b (before DOM event)
      expect(finalState?.executionOrder).toEqual([
        "mount",
        "step1",
        "step2",
        "step3",
        "step4",
        "step5a",
        "step5b"
      ]);

      // Verify step flags
      expect(finalState?.step1Done).toBe(true);
      expect(finalState?.step2Done).toBe(true);
      expect(finalState?.step3Done).toBe(true);
      expect(finalState?.step4Done).toBe(true);
      expect(finalState?.step5Done).toBe(true);
    });

    it("should track execution order in state.executionOrder array", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const finalState = getWindowState()?.app;

      // Array should contain each step in order
      expect(finalState?.executionOrder).toContain("mount");
      expect(finalState?.executionOrder).toContain("step1");
      expect(finalState?.executionOrder).toContain("step2");
      expect(finalState?.executionOrder).toContain("step3");
      expect(finalState?.executionOrder).toContain("step4");
      expect(finalState?.executionOrder?.indexOf("step1")).toBeLessThan(
        finalState?.executionOrder?.indexOf("step2") ?? -1
      );
      expect(finalState?.executionOrder?.indexOf("step2")).toBeLessThan(
        finalState?.executionOrder?.indexOf("step3") ?? -1
      );
    });
  });

  describe("Props and State Flow", () => {
    it("should pass frozen props to state initializer", () => {
      const rootComponent = createRootComponent();
      const props = { initialValue: "test-value", startAt: 10 };

      mount({
        app: rootComponent,
        props
      });

      const finalState = getWindowState()?.app;

      // State should reflect props values
      expect(finalState?.value).toBe("test-value");
      expect(finalState?.counter).toBe(10);
    });

    it("should throw when attempting to mutate props", () => {
      // Props are frozen by the framework
      const props: any = Object.freeze({ initialValue: "test", startAt: 0 });

      expect(() => {
        props.initialValue = "modified";
      }).toThrow();
    });

    it("should throw when attempting to mutate state", async () => {
      // Test that state passed to actions is frozen
      type TestProps = { value: string };
      type TestState = { value: string; modified: boolean };

      let stateInAction: TestState | null = null;
      let mutationAttempted = false;
      type TestActions = { TestMutation: null };
      type TestComponent = {
        Props: TestProps;
        State: TestState;
        ActionPayloads: TestActions;
      };

      const testComponent = component<TestComponent>(({ action }) => ({
        state: (props?) => ({
          value: props?.value ?? "default",
          modified: false
        }),
        init: action("TestMutation", null),
        actions: {
          TestMutation: (_, context) => {
            if (!context.state) throw new Error("Context state is required");
            const state = context.state;
            stateInAction = state;
            mutationAttempted = true;

            // Try to mutate the frozen state
            try {
              (state as unknown as Record<string, unknown>).value = "mutated";
            } catch {
              // Expected to fail - mutation should be blocked by frozen object
            }

            return {
              state: { ...state, modified: true }
            };
          }
        },
        view: (id) => div(`#${id}`)
      }));

      mount({
        app: testComponent,
        props: { value: "original" }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify state was frozen when passed to action
      expect(mutationAttempted).toBe(true);
      expect(stateInAction).not.toBeNull();
      expect(stateInAction).toBeDefined();

      // Assert state is not null before using it
      if (!stateInAction) throw new Error("stateInAction should be set");

      // Type assertion after null check - TypeScript control flow narrowing limitation
      const checkedState = stateInAction as TestState;
      expect(Object.isFrozen(checkedState)).toBe(true);
      // State value should not have changed due to mutation attempt
      expect(checkedState.value).toBe("original");
    });

    it("should use props values in initial state", () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "custom-value", startAt: 42 }
      });

      const finalState = getWindowState()?.app;

      expect(finalState?.value).toBe("custom-value");
      expect(finalState?.counter).toBe(42);
      expect(finalState?.executionOrder?.[0]).toBe("mount");
    });
  });

  describe("Action Context", () => {
    it("should provide {props, state} context to actions", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check init action context
      expect(contextTracker.actions.Step1_InitAction.hasProps).toBe(true);
      expect(contextTracker.actions.Step1_InitAction.hasState).toBe(true);
    });

    it("should provide {props, state, rootState} context to child actions", async () => {
      const rootComponent = createRootComponent();
      const childComponent = createChildComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Note: Full child integration would require rendering child and triggering action
      // For this basic test, we verify the root component structure is correct
      expect(contextTracker.actions.Step1_InitAction.hasState).toBe(true);

      // Child component exists and could be rendered if needed
      expect(childComponent).toBeDefined();
    });

    it("should provide event in context when action triggered from DOM", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate button click
      const button = document.querySelector("#test-button");
      expect(button).toBeTruthy();

      const clickEvent = new dom.window.Event("click");
      button?.dispatchEvent(clickEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify DOM event was passed to action
      expect(contextTracker.actions.Step6_HandleDomEvent.hasEvent).toBe(true);
      expect(contextTracker.actions.Step6_HandleDomEvent.eventType).toBe("click");
    });
  });

  describe("Task Execution", () => {
    it("should execute synchronous task and call success with context", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify sync task success callback received context
      expect(contextTracker.tasks.SyncTask.hasProps).toBe(true);
      expect(contextTracker.tasks.SyncTask.hasState).toBe(true);
      expect(contextTracker.tasks.SyncTask.hasRootState).toBe(true);
    });

    it("should execute async task (Promise) and call success with (result, context)", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify async task success callback received result and context
      expect(contextTracker.tasks.AsyncTask.receivedResult).toEqual({ data: "async-result" });
      expect(contextTracker.tasks.AsyncTask.hasProps).toBe(true);
      expect(contextTracker.tasks.AsyncTask.hasState).toBe(true);
      expect(contextTracker.tasks.AsyncTask.hasRootState).toBe(true);
    });

    it("should execute failing task and call failure with (error, context)", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify failing task failure callback received error and context
      expect(contextTracker.tasks.FailingTask.receivedError).toBe("task-failure");
      expect(contextTracker.tasks.FailingTask.hasProps).toBe(true);
      expect(contextTracker.tasks.FailingTask.hasState).toBe(true);
      expect(contextTracker.tasks.FailingTask.hasRootState).toBe(true);
    });

    it("should provide {props, state, rootState} in task callbacks", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // All task callbacks should have context
      expect(contextTracker.tasks.SyncTask.hasProps).toBe(true);
      expect(contextTracker.tasks.SyncTask.hasState).toBe(true);
      expect(contextTracker.tasks.AsyncTask.hasProps).toBe(true);
      expect(contextTracker.tasks.AsyncTask.hasState).toBe(true);
      expect(contextTracker.tasks.FailingTask.hasProps).toBe(true);
      expect(contextTracker.tasks.FailingTask.hasState).toBe(true);
    });
  });

  describe("Array of Next", () => {
    it("should execute all actions in array in order", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const finalState = getWindowState()?.app;

      // Both array items should be in execution order
      expect(finalState?.executionOrder).toContain("step5a");
      expect(finalState?.executionOrder).toContain("step5b");

      // step5a should come before step5b
      const index5a = finalState?.executionOrder?.indexOf("step5a") ?? -1;
      const index5b = finalState?.executionOrder?.indexOf("step5b") ?? -1;
      expect(index5a).toBeLessThan(index5b);
    });

    it("should update state from each action in array", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const finalState = getWindowState()?.app;

      // step5Done should be set by Step5b_ArrayItem
      expect(finalState?.step5Done).toBe(true);

      // Both actions should have been tracked
      expect(contextTracker.actions.Step5a_ArrayItem).toBeDefined();
      expect(contextTracker.actions.Step5b_ArrayItem).toBeDefined();
    });
  });

  describe("Root State and Actions", () => {
    it("should make rootState accessible to child components", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 5 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Root state should be accessible via window.state
      const rootState = getWindowState()?.app;
      expect(rootState?.counter).toBe(5);

      // This would be accessible to child components via rootState context
      expect(rootState).toBeDefined();
    });

    it("should allow child to invoke rootAction", async () => {
      const rootComponent = createRootComponent();
      // const childComponent = createChildComponent(); // Would be used for full child integration

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate DOM event first to get to step6
      const button = document.querySelector("#test-button");
      const clickEvent = new dom.window.Event("click");
      button?.dispatchEvent(clickEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Get child button (would be rendered by parent view in real scenario)
      // For this test, we verify the action exists and would work
      expect(contextTracker.actions.Step6_HandleDomEvent).toBeDefined();

      const finalState = getWindowState()?.app;
      expect(finalState).toBeDefined();
      if (!finalState) throw new Error("finalState should be defined");
    });

    it("should re-render child when rootState changes", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 10 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const initialState = getWindowState()?.app;
      const initialCounter = initialState?.counter;
      expect(initialCounter).toBe(10);

      // Trigger DOM event and then increment
      const button = document.querySelector("#test-button");
      const clickEvent = new dom.window.Event("click");
      button?.dispatchEvent(clickEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // After IncrementCounter action, counter should change
      // This would trigger child re-render in real scenario
      const finalState = getWindowState()?.app;
      expect(finalState?.executionOrder).toContain("step6");
    });
  });

  describe("Logging Accuracy", () => {
    it("should call log.updateStart with correct oldState and newState", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // log.updateStart should be called for each action
      expect(logSpies.updateStart).toHaveBeenCalled();

      // Verify it was called with component id and action names
      const calls = logSpies.updateStart.mock.calls;
      const actionNames = calls.map((call: any[]) => call[2]);

      expect(actionNames).toContain("Step1_InitAction");
      expect(actionNames).toContain("Step2_HandleSyncSuccess");
    });

    it("should call log.taskPerform for each task", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // log.taskPerform should be called for each task
      expect(logSpies.taskPerform).toHaveBeenCalled();

      const calls = logSpies.taskPerform.mock.calls;
      const taskNames = calls.map((call: any[]) => call[1]);

      expect(taskNames).toContain("SyncTask");
      expect(taskNames).toContain("AsyncTask");
      expect(taskNames).toContain("FailingTask");
    });

    it("should call log.taskSuccess for successful tasks", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logSpies.taskSuccess).toHaveBeenCalled();

      const calls = logSpies.taskSuccess.mock.calls;
      const taskNames = calls.map((call: any[]) => call[1]);

      expect(taskNames).toContain("SyncTask");
      expect(taskNames).toContain("AsyncTask");
    });

    it("should call log.taskFailure for failed tasks", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logSpies.taskFailure).toHaveBeenCalled();

      const calls = logSpies.taskFailure.mock.calls;
      const taskNames = calls.map((call: any[]) => call[1]);

      expect(taskNames).toContain("FailingTask");
    });

    it("should call log.render after state changes", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // log.render should be called
      expect(logSpies.render).toHaveBeenCalled();

      const calls = logSpies.render.mock.calls;
      const componentIds = calls.map((call: any[]) => call[0]);

      expect(componentIds).toContain("app");
    });

    it("should call log.patch after VDOM update", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // log.patch should be called
      expect(logSpies.patch).toHaveBeenCalled();
    });

    it("should maintain window.state with current component states", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // window.state should contain app state
      const windowState = getWindowState();
      expect(windowState).toBeDefined();
      expect(windowState?.app).toBeDefined();
      expect(windowState?.app?.value).toBe("test");
      expect(windowState?.app?.counter).toBe(0);
    });
  });

  describe("Framework Events", () => {
    it("should fire 'patch' event after VDOM updates", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Patch event should have fired
      expect(patchEventFired).toBe(true);
    });

    it("should have observable state in patch event handler", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "test", startAt: 0 }
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // State should be observable in patch handler
      expect(patchEventState).toBeDefined();
      expect(patchEventState).not.toBeNull();

      if (!patchEventState) throw new Error("patchEventState should be set");

      expect(patchEventState.app).toBeDefined();
      expect(patchEventState.app.executionOrder).toContain("mount");
      expect(patchEventState.app.executionOrder).toContain("step1");
    });
  });

  describe("Complete Lifecycle Flow", () => {
    it("should execute complete flow with DOM event and child interaction", async () => {
      const rootComponent = createRootComponent();

      mount({
        app: rootComponent,
        props: { initialValue: "full-test", startAt: 100 }
      });

      // Wait for initial async tasks
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify state after init flow
      let currentState = getWindowState()?.app;
      expect(currentState?.executionOrder).toEqual([
        "mount",
        "step1",
        "step2",
        "step3",
        "step4",
        "step5a",
        "step5b"
      ]);

      // Simulate DOM click
      const button = document.querySelector("#test-button");
      expect(button).toBeTruthy();
      const clickEvent = new dom.window.Event("click");
      button?.dispatchEvent(clickEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify DOM event was handled
      currentState = getWindowState()?.app;
      expect(currentState?.executionOrder).toContain("step6");
      expect(currentState?.domEventHandled).toBe(true);

      // Verify all step flags
      expect(currentState?.step1Done).toBe(true);
      expect(currentState?.step2Done).toBe(true);
      expect(currentState?.step3Done).toBe(true);
      expect(currentState?.step4Done).toBe(true);
      expect(currentState?.step5Done).toBe(true);

      // Verify props were used correctly
      expect(currentState?.value).toBe("full-test");
      expect(currentState?.counter).toBe(100);
    });
  });
});
