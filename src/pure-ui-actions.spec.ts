import { vi } from "vitest";
import { renderComponent, withKey, _setTestKey, html, VNode } from "./pure-ui-actions";
import * as vdom from "./vdom";
import { Context, GetActionThunk } from "./pure-ui-actions.types";
const { div } = html;

const patchSpy = vi.spyOn(vdom, "patch");
const testKey = _setTestKey({});

describe("pure-ui-actions", () => {
  let state: { count: number };
  let action: GetActionThunk<Record<string, unknown>>;
  let componentId = 0;
  const getId = () => `_${componentId++}`;

  function view(id: string, ctx: Context<any, any, any>): VNode {
    state = ctx.state ?? { count: 0 };
    return div(`#${id}`, "Test");
  }

  beforeEach(() => {
    patchSpy.mockClear();

    // Set up DOM element for patching
    document.body.innerHTML = '';
  });

  it("should patch once following a chain of actions", () => {
    const numTestActions = 20;

    const id = getId();
    const initialVnode = renderComponent(id, ({ action: a }) => {
      action = a;
      const actions: Record<string, (data: any, ctx: any) => { state: { count: number }; next?: any }> = {};

      for (let i = 1; i < numTestActions; i++) {
        actions["Increment" + i] =
        (_: any, { props, state }: { props: any; state: { count: number } }) => {
          return {
            state: { ...state, count: state.count + 1 }, next: action("Increment" + (i+1))
          };
        };
      }
      actions["Increment" + numTestActions] =
      (_: any, { props, state }: { props: any; state: { count: number } }) => {
        return {
          state: { ...state, count: state.count + 1 }
        };
      };

      return {
        state: () => ({ count: 0 }),
        actions,
        view
      };
    });

    // Patch initial vnode to DOM
    const container = document.createElement('div');
    document.body.appendChild(container);
    vdom.patch(container, initialVnode);

    patchSpy.mockClear(); // Clear the initial patch call
    action("Increment1")(testKey);
    logResult(state.count, patchSpy.mock.calls.length);
    expect(state.count).toBe(numTestActions);
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });

  it("should patch once following an array of actions", () => {
    const numTestActions = 20;

    const id = getId();
    const initialVnode = renderComponent(id, ({ action: a }) => {
      action = a;
      const actions: Record<string, (data: any, ctx: any) => { state: { count: number }; next?: any }> = {};
      const incrementRetActions: any[] = [];

      for (let i = 1; i <= numTestActions; i++) {
        actions["Increment" + i] =
        (_: any, { props, state }: { props: any; state: { count: number } }) => {
          return {
            state: { ...state, count: state.count + 1 }
          };
        };
        incrementRetActions.push(action("Increment" + i));
      }
      actions["Increment"] =
      (_: any, { props, state }: { props: any; state: { count: number } }) => ({ state, next: incrementRetActions });

      return {
        state: () => ({ count: 0 }),
        actions,
        view
      };
    });

    // Patch initial vnode to DOM
    const container = document.createElement('div');
    document.body.appendChild(container);
    vdom.patch(container, initialVnode);

    patchSpy.mockClear(); // Clear the initial patch call
    action("Increment")(testKey);
    logResult(state.count, patchSpy.mock.calls.length);
    expect(state.count).toBe(numTestActions);
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });

  it("should patch twice when a chain of actions contains a promise", () => {
    const numTestActions = 20;
    return new Promise<void>((resolve) => {
      runActionsWithPromise(numTestActions, 2, resolve);
      expect(patchSpy).not.toHaveBeenCalled();
      action("Increment1")(testKey);
    });
  });

  it("should patch once when initial action chain contains a promise", () => {
    const numTestActions = 20;
    return new Promise<void>((resolve) => {
      runActionsWithPromise(numTestActions, 1, resolve, "Increment1"); // 1 patch after promise
      expect(patchSpy).not.toHaveBeenCalled(); // No patch after init
    });
  });

  function runActionsWithPromise(numTestActions: number, expectedPatchCount: number, done: any, initialAction?: string) {
    const id = getId();
    const initialVnode = renderComponent(id, ({ action: a, task }) => {
      action = a;
      const actions: Record<string, (data: any, ctx: any) => { state: { count: number }; next?: any }> = {};

      for (let i = 1; i < numTestActions; i++) {
        actions["Increment" + i] =
        (_: any, { props, state }: { props: any; state: { count: number } }) => {
          return {
            state: { ...state, count: state.count + 1 },
            next: action("Increment" + (i+1))
          };
        };
      }
      actions["Increment" + numTestActions] =
      (_: any, { props, state }: { props: any; state: { count: number } }) => {
        const newState = { ...state, count: state.count + 1 };
        setTimeout(() => {
          // After last action has been processed
          logResult(newState.count, patchSpy.mock.calls.length);
          expect(newState.count).toBe(numTestActions);
          expect(patchSpy).toHaveBeenCalledTimes(expectedPatchCount);
          done();
        });
        return {
          state: newState
        };
      };

      // Overwrite middle action with task
      const midIndex = numTestActions/2;
      actions["Increment" + midIndex] =
      (_: any, { props, state }: { props: any; state: { count: number } }) => {
        return {
          state: { ...state, count: state.count + 1 },
          next: (task as any)("TestAsync")
        };
      };

      return {
        state: () => ({ count: 0 }),
        init: initialAction ? (a as any)(initialAction) : undefined,
        actions,
        tasks: {
          TestAsync: () => ({
            perform: () => new Promise<void>(resolve => setTimeout(() => resolve(), 100)),
            success: () => action("Increment" + (midIndex + 1))
          })
        },
        view
      };
    });

    // Patch initial vnode to DOM
    const container = document.createElement('div');
    document.body.appendChild(container);
    vdom.patch(container, initialVnode);
    patchSpy.mockClear(); // Clear the initial patch call
  }

  it("should patch twice when a promise returns an array of actions", () => {
    return new Promise<void>((resolve) => {
      const id = getId();
      const initialVnode = renderComponent(id, ({ action: a, task }) => {
        action = a;

        return {
          state: () => ({ count: 0 }),
          actions: {
            Increment1: (_: any, ctx: any) => {
              return {
                state: { ...ctx.state, count: (ctx.state.count as number) + 1 },
                next: (task as any)("TestAsync")
              };
            },
            Increment2: (_: any, ctx: any) => {
              return {
                state: { ...ctx.state, count: (ctx.state.count as number) + 1 }
              };
            },
            Increment3: (_: any, ctx: any) => {
              const newState = { ...ctx.state, count: (ctx.state.count as number) + 1 };
              setTimeout(() => {
                // After last action has been processed
                logResult(newState.count, patchSpy.mock.calls.length);
                expect(newState.count).toBe(3);
                expect(patchSpy).toHaveBeenCalledTimes(2);
                resolve();
              });
              return {
                state: newState
              };
            }
          },
          tasks: {
            "TestAsync": () => ({
              perform: () => new Promise<void>(resolve => setTimeout(() => resolve(), 100)),
              success: () => [ action("Increment2"), action("Increment3") ]
            })
          },
          view
        };
      });

      // Patch initial vnode to DOM
      const container = document.createElement('div');
      document.body.appendChild(container);
      vdom.patch(container, initialVnode);

      patchSpy.mockClear(); // Clear the initial patch call
      action("Increment1")(testKey);
    });
  });

  it("should patch once following a mix of action arrays and chains", () => {
    const numTestActions = 20; // Must be even due to `i % 2`

    expect(patchSpy).not.toHaveBeenCalled();
    runMixedActions(numTestActions);
    action("IncrementA2-Init")(testKey);

    logResult(state.count, patchSpy.mock.calls.length);
    expect(state.count).toBe(
      getMixedActionsIncr(numTestActions)
    );
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });

  it("should not patch when initial action is a mix of arrays and chains", () => {
    const numTestActions = 20; // Must be even due to `i % 2`

    expect(patchSpy).not.toHaveBeenCalled();
    runMixedActions(numTestActions, "IncrementA2-Init");

    logResult(state.count, patchSpy.mock.calls.length);
    expect(state.count).toBe(
      getMixedActionsIncr(numTestActions)
    );
    expect(patchSpy).not.toHaveBeenCalled();
  });

  function runMixedActions(numTestActions: number, initialAction?: string) {
    const id = getId();
    const initialVnode = renderComponent(id, ({ action: a }) => {
      action = a;
      const actions: Record<string, any> = {};
      const actionsArray1: any[] = [];
      const actionsArray2: any[] = [];

      // Array of single increment actions that return nothing
      for (let i = 1; i <= numTestActions; i++) {
        actions["IncrementA1-" + i] =
        (_: any, ctx: any) => {
          return {
            state: { ...ctx.state, count: ctx.state.count + 1 }
          };
        };
        actionsArray1.push(action("IncrementA1-" + i));
      }
      // Series of increment actions "IncrementS1-1" - "IncrementS1-19"
      for (let i = 1; i < numTestActions; i++) {
        actions["IncrementS1-" + i] =
        (_: any, ctx: any) => {
          return {
            state: { ...ctx.state, count: ctx.state.count + 1 },
            next: action("IncrementS1-" + (i+1))
          };
        };
      }
      actions["IncrementS1-" + numTestActions] =
      (_: any, ctx: any) => {
        // "IncrementS1-20" returns `actionsArray1` array
        return {
          state: { ...ctx.state, count: ctx.state.count + 1 },
          next: actionsArray1
        };
      };
      // Series of increment actions "IncrementS2-1" - "IncrementS2-10"
      for (let i = 1; i < numTestActions/2; i++) {
        actions["IncrementS2-" + i] =
        (_: any, ctx: any) => {
          return {
            state: { ...ctx.state, count: ctx.state.count + 1 },
            next: action("IncrementS2-" + (i+1))
          };
        };
      }
      actions["IncrementS2-" + numTestActions/2] =
      (_: any, ctx: any) => {
        return { state: { ...ctx.state, count: ctx.state.count + 1 } };
      };

      // "IncrementA2-Init" returns `actionsArray2` array
      for (let i = 1; i <= numTestActions; i++) {
        actions["IncrementA2-" + i] =
        (_: any, ctx: any) => {
          // Half return chain "IncrementS1-1" - "IncrementS1-20",
          // where "IncrementS1-20" returns `actionsArray1`
          if (i % 2) {
            return { state: { ...ctx.state, count: ctx.state.count + 1 }, next: action("IncrementS1-1") };
          }
          // Half return chain "IncrementS2-1" - "IncrementS2-10"
          else {
            return { state: { ...ctx.state, count: ctx.state.count + 1 }, next: action("IncrementS2-1") };
          }
        };
        actionsArray2.push(action("IncrementA2-" + i));
      }
      actions["IncrementA2-Init"] =
      (_: any, ctx: any) => ({ state: ctx.state, next: actionsArray2 });

      return {
        state: () => ({ count: 0 }),
        init: initialAction ? (a as any)(initialAction) : undefined,
        actions,
        view
      };
    });

    // Patch initial vnode to DOM
    const container = document.createElement('div');
    document.body.appendChild(container);
    vdom.patch(container, initialVnode);
    patchSpy.mockClear(); // Clear the initial patch call
  }

  function getMixedActionsIncr(numTestActions: number) {
    const array1Incr = numTestActions;
    const series1Incr = numTestActions + array1Incr;
    const series2Incr = numTestActions/2;
    const array2Incr = numTestActions + (numTestActions/2 * series1Incr) + (numTestActions/2 * series2Incr);
    return array2Incr;
  }

  function logResult(numActions: number, patchCount: number) {
    console.log('Completed ' + numActions + ' actions with '
    + patchCount + ' patch' + (patchCount === 1 ? '' : 'es'));
  }

  describe("withKey", () => {
    it("should add a key property to a VNode", () => {
      const vnode = div("test");
      const keyedVnode = withKey("unique-id", vnode);

      expect(keyedVnode.key).toBe("unique-id");
      expect(keyedVnode).toBe(vnode); // Should mutate and return the same VNode
    });

    it("should support numeric keys", () => {
      const vnode = div("test");
      const keyedVnode = withKey('123', vnode);

      expect(keyedVnode.key).toBe('123');
    });

    it("should work with component VNodes", () => {
      const component = renderComponent(getId(), () => ({
        state: () => ({ count: 0 }),
        view: (id: string): VNode => div(`#${id}`, "Component")
      }));

      const keyedComponent = withKey("comp-1", component);
      expect(keyedComponent.key).toBe("comp-1");
    });

    it("should work with list rendering", () => {
      const items = [
        { id: '1', name: "Item 1" },
        { id: '2', name: "Item 2" },
        { id: '3', name: "Item 3" }
      ];

      const vnode = renderComponent(getId(), () => {
        return {
          state: () => ({ items }),
          view: (id: string, { state }: Context<any, any, any>): VNode => {
            return div(`#${id}`, [
              ...state.items.map((item: typeof items[0]) =>
                withKey(item.id, div(`.item-${item.id}`, item.name))
              )
            ]);
          }
        };
      });

      // Verify that children have keys
      const children = vnode.children as VNode[];
      expect(children[0].key).toBe("1");
      expect(children[1].key).toBe("2");
      expect(children[2].key).toBe("3");
    });

    it("should preserve keys through component renders", () => {
      const vnode = div("test content");
      withKey("my-key", vnode);

      expect(vnode.key).toBe("my-key");

      // Keys should persist on the VNode
      expect(vnode.key).toBe("my-key");
    });
  });

  describe("event context", () => {
    it("should pass DOM event to action handler context", () => {
      let capturedEvent: Event | undefined;
      let action: GetActionThunk<{ Click: null }>;

      renderComponent(getId(), ({ action: a }) => {
        action = a;
        return {
          state: () => ({ clicked: false }),
          actions: {
            Click: (_, ctx) => {
              capturedEvent = ctx?.event;
              return { state: { clicked: true } };
            }
          },
          view: (id: string) => div(`#${id}`, "test")
        };
      });

      // Create a mock DOM event
      const mockEvent = new Event('click');
      Object.defineProperty(mockEvent, 'eventPhase', { value: 1 });
      Object.defineProperty(mockEvent, 'target', { value: null });
      Object.defineProperty(mockEvent, 'type', { value: 'click' });

      // Trigger action with event (simulating DOM click)
      // @ts-expect-error test data
      action("Click")(mockEvent);

      // Verify event was passed to context
      expect(capturedEvent).toBeDefined();
      expect(capturedEvent).toBe(mockEvent);
    });
  });

});
