/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";
import {
  _setTestKey,
  _resetForTest,
  component,
  html,
  mount,
  getComponentRegistry,
  renderComponent
} from "./pure-ui-actions";
import { log } from "./log";
import * as vdom from "./vdom";
const { div } = html;
const testKey = _setTestKey({});

const patchSpy = vi.spyOn(vdom, "patch");
const renderSpy = vi.spyOn(log, "render");

describe("Component Lifecycle & State Management", () => {
  beforeEach(() => {
    patchSpy.mockClear();
    renderSpy.mockClear();
    _resetForTest();

    // Initialize app element
    const appEl = document.createElement("div");
    appEl.setAttribute("id", "app");
    document.body.innerHTML = "";
    document.body.appendChild(appEl);
  });

  describe("Thunk Caching & Memoization", () => {
    it("should return same action thunk for identical params", () => {
      let action: Function = () => {};

      const comp = component<{
        Props: { value: number };
        State: { count: number };
        ActionPayloads: { Increment: { step: number } };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            Increment: (data, ctx) => {
              const state = ctx?.state ?? { count: 0 };
              const step = data?.step ?? 0;
              return { state: { ...state, count: state.count + step } };
            }
          },
          view: (id, ctx) => div(`#${id}`, `${ctx.state?.count ?? 0}`)
        };
      });

      mount({ app: comp, props: { value: 1 } });

      const thunk1 = action("Increment", { step: 1 });
      const thunk2 = action("Increment", { step: 1 });
      const thunk3 = action("Increment", { step: 2 }); // Different data

      expect(thunk1).toBe(thunk2); // Same cache
      expect(thunk1).not.toBe(thunk3); // Different cache
    });

    it("should return same task thunk for identical params", () => {
      let task: Function = () => {};

      const comp = component<{
        Props: Record<string, never>;
        State: { result: number };
        TaskPayloads: { FetchData: { id: number } };
      }>(({ task: t }) => {
        task = t;
        return {
          state: () => ({ result: 0 }),
          tasks: {
            FetchData: (data) => ({
              perform: () => Promise.resolve((data?.id ?? 0) * 2),
              success: () => undefined
            })
          },
          view: (id, ctx) => div(`#${id}`, `${ctx.state?.result ?? 0}`)
        };
      });

      mount({ app: comp, props: {} });

      const thunk1 = task("FetchData", { id: 1 });
      const thunk2 = task("FetchData", { id: 1 });
      const thunk3 = task("FetchData", { id: 2 });

      expect(thunk1).toBe(thunk2);
      expect(thunk1).not.toBe(thunk3);
    });

    it("should invalidate thunk cache on component cleanup", () => {
      let parentAction: Function = () => {};
      let childAction: Function = () => {};
      let cachedChildThunk: any;

      const child = component<{
        Props: Record<string, never>;
        State: { count: number };
        ActionPayloads: { Increment: null };
      }>(({ action: a }) => {
        childAction = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            Increment: (_, ctx) => {
              const state = ctx?.state ?? { count: 0 };
              return { state: { ...state, count: state.count + 1 } };
            }
          },
          view: (id, ctx) => div(`#${id}`, `Child: ${ctx.state?.count ?? 0}`)
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { showChild: boolean };
        ActionPayloads: { Toggle: null };
      }>(({ action: a }) => {
        parentAction = a;
        return {
          state: () => ({ showChild: true }),
          actions: {
            Toggle: (_, ctx) => {
              const state = ctx?.state ?? { showChild: true };
              return { state: { showChild: !state.showChild } };
            }
          },
          view: (id, ctx) =>
            div(`#${id}`, (ctx.state?.showChild ?? true) ? [child("#child", {})] : [])
        };
      });

      mount({ app: parent, props: {} });

      // Cache child action thunk
      cachedChildThunk = childAction("Increment");
      expect(cachedChildThunk).toBeDefined();

      const registryBefore = getComponentRegistry();
      expect(registryBefore.has("child")).toBe(true);

      // Toggle to unmount child
      parentAction("Toggle")(testKey);

      const registryAfter = getComponentRegistry();
      expect(registryAfter.has("child")).toBe(false);

      // Re-mount child
      parentAction("Toggle")(testKey);

      // Get new action thunk - should be different instance (cache invalidated)
      const newChildThunk = childAction("Increment");
      expect(newChildThunk).not.toBe(cachedChildThunk);

      // Verify new component has fresh state
      const newChild = getComponentRegistry().get("child");
      expect(newChild?.state).toEqual({ count: 0 });
    });
  });

  describe("Props Management", () => {
    it("should freeze props deeply and prevent mutation", () => {
      let action: Function = () => {};
      let capturedProps: any;

      const comp = component<{
        Props: { data: { value: number } };
        State: Record<string, never>;
        ActionPayloads: { MutateProps: null };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({}),
          actions: {
            MutateProps: (_, ctx) => {
              capturedProps = ctx?.props;
              return { state: ctx?.state ?? {} };
            }
          },
          view: (id) => div(`#${id}`, "test")
        };
      });

      mount({ app: comp, props: { data: { value: 42 } } });

      action("MutateProps")(testKey);

      // Props should be frozen at all levels
      expect(Object.isFrozen(capturedProps)).toBe(true);
      expect(Object.isFrozen(capturedProps?.data)).toBe(true);

      // Attempting to mutate should throw
      expect(() => {
        capturedProps.data.value = 99;
      }).toThrow();
    });

    it("should track prevProps correctly across renders", () => {
      let action: Function = () => {};

      const child = component<{
        Props: { value: number };
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: (id, ctx) => div(`#${id}`, `${ctx.props?.value ?? 0}`)
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { childValue: number };
        ActionPayloads: { UpdateChild: null };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ childValue: 1 }),
          actions: {
            UpdateChild: (_, ctx) => {
              const childValue = (ctx?.state?.childValue ?? 1) + 1;
              return { state: { childValue } };
            }
          },
          view: (id, ctx) => div(`#${id}`, [child("#child", { value: ctx.state?.childValue ?? 1 })])
        };
      });

      mount({ app: parent, props: {} });

      const registry = getComponentRegistry();
      let childInstance = registry.get("child");
      expect(childInstance?.props).toEqual({ value: 1 });
      expect(childInstance?.prevProps).toEqual({ value: 1 });

      // Update child props
      action("UpdateChild")(testKey);

      childInstance = registry.get("child");
      expect(childInstance?.props).toEqual({ value: 2 });
      expect(childInstance?.prevProps).toEqual({ value: 2 });
    });
  });

  describe("Component Registry", () => {
    it("should cleanup registry when component unmounts", () => {
      let action: Function = () => {};

      const child = component<{
        Props: Record<string, never>;
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: (id) => div(`#${id}`, "child")
        };
      });

      const grandchild = component<{
        Props: Record<string, never>;
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: (id) => div(`#${id}`, "grandchild")
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { show: boolean };
        ActionPayloads: { Toggle: null };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ show: true }),
          actions: {
            Toggle: (_, ctx) => {
              const show = !(ctx?.state?.show ?? true);
              return { state: { show } };
            }
          },
          view: (id, ctx) =>
            div(
              `#${id}`,
              (ctx.state?.show ?? true) ? [child("#child", {}), grandchild("#grandchild", {})] : []
            )
        };
      });

      mount({ app: parent, props: {} });

      let registry = getComponentRegistry();
      expect(registry.size).toBe(3); // parent + child + grandchild
      expect(registry.has("app")).toBe(true);
      expect(registry.has("child")).toBe(true);
      expect(registry.has("grandchild")).toBe(true);

      // Unmount children
      action("Toggle")(testKey);

      registry = getComponentRegistry();
      expect(registry.size).toBe(1); // parent only
      expect(registry.has("child")).toBe(false);
      expect(registry.has("grandchild")).toBe(false);
    });

    it("should reset inCurrentRender flag after patch", () => {
      let action: Function = () => {};

      const comp = component<{
        Props: Record<string, never>;
        State: { count: number };
        ActionPayloads: { Increment: null };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            Increment: (_, ctx) => {
              const count = (ctx?.state?.count ?? 0) + 1;
              return { state: { count } };
            }
          },
          view: (id, ctx) => div(`#${id}`, `${ctx.state?.count ?? 0}`)
        };
      });

      mount({ app: comp, props: {} });

      const registry = getComponentRegistry();
      const instance = registry.get("app");

      // After mount, flag should be reset
      expect(instance?.inCurrentRender).toBe(false);

      // Trigger update
      action("Increment")(testKey);

      // After update, flag should be reset
      expect(instance?.inCurrentRender).toBe(false);
    });
  });

  describe("State Optimization", () => {
    it("should skip render when state reference unchanged", () => {
      let action: Function = () => {};
      let renderCount = 0;

      const comp = component<{
        Props: Record<string, never>;
        State: { count: number };
        ActionPayloads: { NoChange: null; Change: null };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            NoChange: (_, ctx) => ({ state: ctx?.state ?? { count: 0 } }), // Same reference
            Change: (_, ctx) => {
              const state = ctx?.state ?? { count: 0 };
              return { state: { ...state, count: state.count + 1 } };
            }
          },
          view: (id, ctx) => {
            renderCount++;
            return div(`#${id}`, `${ctx.state?.count ?? 0}`);
          }
        };
      });

      mount({ app: comp, props: {} });
      const afterMountRenderCount = renderCount;
      patchSpy.mockClear();

      // No change - should not render (state reference is same)
      action("NoChange")(testKey);
      expect(renderCount).toBe(afterMountRenderCount); // View not called
      expect(patchSpy).not.toHaveBeenCalled(); // No patch

      // With change - should render
      action("Change")(testKey);
      expect(renderCount).toBe(afterMountRenderCount + 1);
      expect(patchSpy).toHaveBeenCalled();

      patchSpy.mockClear();

      // After a change, NoChange should still not render
      action("NoChange")(testKey);
      expect(patchSpy).not.toHaveBeenCalled();
    });
  });

  describe("Initialization", () => {
    it("should execute init actions", () => {
      let initExecuted = false;

      const comp = component<{
        Props: Record<string, never>;
        State: { initialized: boolean };
        ActionPayloads: { Init: null };
      }>(({ action: a }) => {
        return {
          state: () => ({ initialized: false }),
          init: a("Init"),
          actions: {
            Init: () => {
              initExecuted = true;
              return { state: { initialized: true } };
            }
          },
          view: (id, ctx) => div(`#${id}`, `${ctx.state?.initialized ?? false}`)
        };
      });

      mount({ app: comp, props: {} });

      expect(initExecuted).toBe(true);

      const registry = getComponentRegistry();
      const instance = registry.get("app");
      expect(instance?.state).toEqual({ initialized: true });
    });

    it("should execute init tasks from component's own tasks", async () => {
      let performCalled = false;
      let successCalled = false;

      const comp = component<{
        Props: Record<string, never>;
        State: { data: string };
        ActionPayloads: { SetData: { value: string } };
        TaskPayloads: { LoadData: null };
      }>(({ action: a, task: t }) => {
        return {
          state: () => ({ data: "" }),
          init: t("LoadData"),
          actions: {
            SetData: (payload) => {
              successCalled = true;
              return { state: { data: payload?.value ?? "" } };
            }
          },
          tasks: {
            LoadData: () => ({
              perform: async (): Promise<string> => {
                performCalled = true;
                return Promise.resolve("loaded data");
              },
              success: (result: string) => {
                return a("SetData", { value: result });
              }
            })
          },
          view: (id, ctx) => div(`#${id}`, ctx.state?.data ?? "")
        };
      });

      mount({ app: comp, props: {} });

      // Task perform should be called immediately
      expect(performCalled).toBe(true);

      // Wait for async task to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Success handler should have run and updated state
      expect(successCalled).toBe(true);

      const registry = getComponentRegistry();
      const instance = registry.get("app");
      expect(instance?.state).toEqual({ data: "loaded data" });
    });
  });

  describe("Props Changes & Re-rendering", () => {
    it("should re-render when props change via direct renderComponent call", () => {
      // Track child view calls to verify it's being called with updated props
      const childViewCalls: string[] = [];
      let componentId = 0;
      const getId = () => `_${componentId++}`;
      const childId = getId();

      const getConfig = () => ({
        state: () => ({ internalState: 0 }),
        view: (id: string, { props }: any) => {
          const msg = props?.message || "";
          childViewCalls.push(msg);
          return div(`#${id}.child`, msg);
        }
      });

      // Initial render with props
      const initialVnode = renderComponent(childId, getConfig, { message: "initial" });
      expect(childViewCalls).toEqual(["initial"]);

      // Patch initial vnode to DOM
      const container = document.createElement("div");
      document.body.appendChild(container);
      vdom.patch(container, initialVnode);

      // Re-render the same component with different props
      renderComponent(childId, getConfig, { message: "updated" });

      // Child view should have been called again with "updated"
      expect(childViewCalls).toEqual(["initial", "updated"]);
    });

    it("should re-render child when parent state changes child props", () => {
      let childRenderCount = 0;
      let action: Function = () => {};

      const child = component<{
        Props: { message: string };
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: (id, { props }) => {
            childRenderCount++;
            return div(`#${id}.child`, props?.message || "");
          }
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { message: string };
        ActionPayloads: { UpdateMessage: { text: string } };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ message: "initial" }),
          actions: {
            UpdateMessage: (data, ctx) => ({
              state: { ...(ctx?.state ?? { message: "" }), message: data?.text ?? "" }
            })
          },
          view: (id, { state }) => {
            return div(`#${id}.parent`, [child("#child", { message: state?.message || "" })]);
          }
        };
      });

      mount({ app: parent, props: {} });
      const afterMountCount = childRenderCount;

      // Update parent state which changes child props
      action("UpdateMessage", { text: "updated" })(testKey);

      // Child should re-render with new props from parent
      expect(childRenderCount).toBe(afterMountCount + 1);
    });

    it("should handle action thunks passed as props", () => {
      const parentActionCalls: string[] = [];
      let parentAction: Function = () => {};

      const child = component<{
        Props: { onAction: any };
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: (id) => {
            return div(`#${id}.child`, "child");
          }
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { value: number };
        ActionPayloads: { ParentAction: { value: string } };
      }>(({ action: a }) => {
        parentAction = a;
        return {
          state: () => ({ value: 0 }),
          actions: {
            ParentAction: (data, ctx) => {
              parentActionCalls.push(data?.value ?? "");
              return { state: ctx?.state ?? { value: 0 } };
            }
          },
          view: (id) => {
            return div(`#${id}.parent`, [
              child("#child", {
                onAction: parentAction("ParentAction", { value: "from-child" })
              })
            ]);
          }
        };
      });

      mount({ app: parent, props: {} });

      // Get child instance and trigger the action thunk
      const registry = getComponentRegistry();
      const childInstance = registry.get("child");
      expect(childInstance).toBeDefined();

      // Simulate child calling parent action
      const onAction = childInstance?.props?.onAction as any;
      if (onAction && typeof onAction === "function") {
        onAction(testKey);
      }

      expect(parentActionCalls).toEqual(["from-child"]);
    });

    it("should handle props change AND state change in same component", () => {
      const viewCalls: Array<{ props: string; state: number }> = [];
      let parentAction: Function = () => {};
      let childAction: Function = () => {};

      const child = component<{
        Props: { message: string };
        State: { count: number };
        ActionPayloads: { Increment: null };
      }>(({ action: a }) => {
        childAction = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            Increment: (_, ctx) => ({
              state: { ...(ctx?.state ?? { count: 0 }), count: (ctx?.state?.count ?? 0) + 1 }
            })
          },
          view: (id, { props, state }) => {
            viewCalls.push({
              props: props?.message || "",
              state: state?.count || 0
            });
            return div(`#${id}`, `${props?.message}-${state?.count}`);
          }
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { message: string };
        ActionPayloads: { UpdateMessage: { text: string } };
      }>(({ action: a }) => {
        parentAction = a;
        return {
          state: () => ({ message: "v1" }),
          actions: {
            UpdateMessage: (data, ctx) => ({
              state: { ...(ctx?.state ?? { message: "" }), message: data?.text ?? "" }
            })
          },
          view: (id, { state }) => {
            return div(`#${id}.parent`, [child("#child", { message: state?.message || "" })]);
          }
        };
      });

      mount({ app: parent, props: {} });
      expect(viewCalls).toEqual([{ props: "v1", state: 0 }]);

      // Change child state
      childAction("Increment")(testKey);
      expect(viewCalls).toEqual([
        { props: "v1", state: 0 },
        { props: "v1", state: 1 }
      ]);

      // Change props from parent
      parentAction("UpdateMessage", { text: "v2" })(testKey);
      expect(viewCalls).toEqual([
        { props: "v1", state: 0 },
        { props: "v1", state: 1 },
        { props: "v2", state: 1 }
      ]);
    });
  });

  describe("Component Lifecycle Edge Cases", () => {
    it("should handle rapid sequential prop changes", () => {
      const viewCalls: string[] = [];
      let action: Function = () => {};

      const child = component<{
        Props: { value: string };
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: (id, { props }) => {
            viewCalls.push(props?.value || "");
            return div(`#${id}`, props?.value || "");
          }
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { value: string };
        ActionPayloads: { SetValue: { value: string } };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ value: "v1" }),
          actions: {
            SetValue: (data, ctx) => ({
              state: { ...(ctx?.state ?? { value: "" }), value: data?.value ?? "" }
            })
          },
          view: (id, { state }) => {
            return div(`#${id}.parent`, [child("#child", { value: state?.value || "" })]);
          }
        };
      });

      mount({ app: parent, props: {} });
      expect(viewCalls).toEqual(["v1"]);

      // Rapid prop changes
      action("SetValue", { value: "v2" })(testKey);
      action("SetValue", { value: "v3" })(testKey);
      action("SetValue", { value: "v4" })(testKey);

      expect(viewCalls).toEqual(["v1", "v2", "v3", "v4"]);
    });

    it("should handle undefined props becoming defined", () => {
      const viewCalls: Array<any> = [];
      let action: Function = () => {};

      const child = component<{
        Props: { value?: string };
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: (id, { props }) => {
            viewCalls.push(props);
            return div(`#${id}`, props?.value || "empty");
          }
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { childProps: { value?: string } | undefined };
        ActionPayloads: { SetProps: { props: { value?: string } | undefined } };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ childProps: undefined }),
          actions: {
            SetProps: (data, ctx) => ({
              state: { ...(ctx?.state ?? { childProps: undefined }), childProps: data?.props }
            })
          },
          view: (id, { state }) => {
            return div(`#${id}.parent`, [child("#child", state?.childProps)]);
          }
        };
      });

      mount({ app: parent, props: {} });
      expect(viewCalls[0]).toEqual({});

      // Props become defined
      action("SetProps", { props: { value: "defined" } })(testKey);
      expect(viewCalls[1]).toEqual({ value: "defined" });

      // Props back to empty object (no longer undefined)
      action("SetProps", { props: undefined })(testKey);
      expect(viewCalls[2]).toEqual({});
    });
  });

  describe("State and Props Interaction", () => {
    it("should have access to both state and props in view", () => {
      const viewCalls: Array<{ props: string; state: number }> = [];
      let childAction: Function = () => {};

      const child = component<{
        Props: { label: string };
        State: { count: number };
        ActionPayloads: { Increment: null };
      }>(({ action: a }) => {
        childAction = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            Increment: (_, ctx) => ({
              state: { ...(ctx?.state ?? { count: 0 }), count: (ctx?.state?.count ?? 0) + 1 }
            })
          },
          view: (id, { props, state }) => {
            viewCalls.push({
              props: props?.label || "",
              state: state?.count || 0
            });
            return div(`#${id}`, `${props?.label}: ${state?.count}`);
          }
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: (id) => {
            return div(`#${id}.parent`, [child("#child", { label: "Counter" })]);
          }
        };
      });

      mount({ app: parent, props: {} });
      expect(viewCalls).toEqual([{ props: "Counter", state: 0 }]);

      childAction("Increment")(testKey);
      expect(viewCalls).toEqual([
        { props: "Counter", state: 0 },
        { props: "Counter", state: 1 }
      ]);
    });
  });
});
