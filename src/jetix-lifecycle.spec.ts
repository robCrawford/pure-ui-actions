import { _setTestKey, component, html, mount, getComponentRegistry } from "./jetix";
import { log } from "./jetixLog";
import * as vdom from "./vdom";
const { div } = html;
const testKey = _setTestKey({});

const patchSpy = jest.spyOn(vdom, "patch");
const renderSpy = jest.spyOn(log, "render");

describe("Component Lifecycle & State Management", () => {
  beforeEach(() => {
    patchSpy.mockClear();
    renderSpy.mockClear();

    // Initialize app
    const appEl = document.createElement("div");
    appEl.setAttribute("id", "app");
    document.body.innerHTML = '';
    document.body.appendChild(appEl);
  });

  describe("Thunk Caching & Memoization", () => {
    it("should return same action thunk for identical params", () => {
      let action: Function = () => {};

      const comp = component<{
        Props: { value: number };
        State: { count: number };
        Actions: { Increment: { step: number } };
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
        Props: {};
        State: { result: number };
        Tasks: { FetchData: { id: number } };
      }>(({ task: t }) => {
        task = t;
        return {
          state: () => ({ result: 0 }),
          tasks: {
            FetchData: (data) => ({
              perform: () => Promise.resolve((data?.id ?? 0) * 2),
              success: (result, ctx) => undefined
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
        Props: {};
        State: { count: number };
        Actions: { Increment: null };
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
        Props: {};
        State: { showChild: boolean };
        Actions: { Toggle: null };
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
          view: (id, ctx) => div(`#${id}`, (ctx.state?.showChild ?? true) ? [child("#child", {})] : [])
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

    it("should support action currying with cache", () => {
      let action: Function = () => {};

      const comp = component<{
        Props: {};
        State: { count: number };
        Actions: { Add: { value: number } };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            Add: (data, ctx) => {
              const count = (ctx?.state?.count ?? 0) + (data?.value ?? 0);
              return { state: { count } };
            }
          },
          view: (id, ctx) => div(`#${id}`, `${ctx.state?.count ?? 0}`)
        };
      });

      mount({ app: comp, props: {} });

      // Create a base thunk
      const addThunk = action("Add");

      // Curry it with data
      const add5 = addThunk({ value: 5 });
      const add10 = addThunk({ value: 10 });

      // Calling with same data should return cached thunk
      const add5Again = action("Add", { value: 5 });
      expect(add5).toBe(add5Again);

      // Different data should be different thunk
      expect(add5).not.toBe(add10);
    });
  });

  describe("Props Management", () => {
    it("should freeze props and prevent mutation", () => {
      let action: Function = () => {};
      let capturedProps: any;

      const comp = component<{
        Props: { data: { value: number } };
        State: {};
        Actions: { MutateProps: null };
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

      expect(() => {
        capturedProps.data.value = 99;
      }).toThrow();
    });

    it("should track prevProps correctly across renders", () => {
      let action: Function = () => {};

      const child = component<{
        Props: { value: number };
        State: {};
        Actions: {};
      }>(({ action: a }) => {
        return {
          state: () => ({}),
          actions: {},
          view: (id, ctx) => div(`#${id}`, `${ctx.props?.value ?? 0}`)
        };
      });

      const parent = component<{
        Props: {};
        State: { childValue: number };
        Actions: { UpdateChild: null };
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
        Props: {};
        State: {};
        Actions: {};
      }>(({ action: a }) => {
        return {
          state: () => ({}),
          actions: {},
          view: (id) => div(`#${id}`, "child")
        };
      });

      const grandchild = component<{
        Props: {};
        State: {};
        Actions: {};
      }>(({ action: a }) => {
        return {
          state: () => ({}),
          actions: {},
          view: (id) => div(`#${id}`, "grandchild")
        };
      });

      const parent = component<{
        Props: {};
        State: { show: boolean };
        Actions: { Toggle: null };
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
          view: (id, ctx) => div(`#${id}`,
            (ctx.state?.show ?? true)
              ? [child("#child", {}), grandchild("#grandchild", {})]
              : []
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
        Props: {};
        State: { count: number };
        Actions: { Increment: null };
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
        Props: {};
        State: { count: number };
        Actions: { NoChange: null; Change: null };
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
    it("should execute init actions and cache thunks", () => {
      let action: Function = () => {};
      let initExecuted = false;

      const comp = component<{
        Props: {};
        State: { initialized: boolean };
        Actions: { Init: null };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ initialized: false }),
          init: a("Init"),
          actions: {
            Init: (_, ctx) => {
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

      // Verify init thunk is cached
      const initThunk1 = action("Init");
      const initThunk2 = action("Init");
      expect(initThunk1).toBe(initThunk2);
    });
  });
});
