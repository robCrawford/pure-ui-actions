import { vi, type Mock } from "vitest";
import { _setTestKey, component, html, mount, getComponentRegistry } from "./pure-ui-actions";
import { log } from "./log";
import * as vdom from "./vdom";
const { div } = html;
const testKey = _setTestKey({});

const patchSpy = vi.spyOn(vdom, "patch");
const renderSpy = vi.spyOn(log, "render");
const ctx = { rootState: { theme: "a" }, props: { test: "x" }, state: { count: 0 } };

describe("pure-ui-actions components", () => {
  let rootAction: Function = () => {};
  let parentAction: Function = () => {};
  let parentTask: Function = () => {};
  let childAction: Function = () => {};
  let validatePerform: Function = () => {};

  const parentActions = {
    Increment: vi.fn(({ step }, { state }) => ({ state: { ...state, count: state.count + step } })),
    Decrement: vi.fn(({ step }, { state }) => ({ state: { ...state, count: state.count - step } }))
  };
  const validateSuccess = vi.fn((result) => parentAction("Increment", { step: result }));
  const validateFailure = vi.fn((err) => parentAction("Decrement", { step: err }));
  const parentTasks = {
    Validate: () => {
      return {
        perform: () => validatePerform(),
        success: validateSuccess,
        failure: validateFailure
      };
    }
  };

  const jestReset = () => {
    patchSpy.mockClear();
    renderSpy.mockClear();
    validateSuccess.mockClear();
    validateFailure.mockClear();
    Object.keys(parentActions).forEach((k) =>
      (parentActions as Record<string, Mock>)[k].mockClear()
    );
  };

  // Initialise app
  const appEl = document.createElement("div");
  appEl.setAttribute("id", "app");
  document.body.appendChild(appEl);

  beforeEach(() => {
    const child = component<{
      Props: { test: string };
      State: { count: number };
      ActionPayloads: {
        Increment: { step: number };
        NoOp: null;
        Mutate: { k: string };
      };
    }>(({ action: a }) => {
      childAction = a;
      return {
        state: () => ({ count: 0 }),
        actions: {
          Increment: (data, ctx) => {
            const step = data?.step ?? 0;
            const state = ctx.state ?? { count: 0 };
            return { state: { ...state, count: state.count + step } };
          },
          NoOp: (_, ctx) => {
            const state = ctx.state ?? { count: 0 };
            return { state };
          },
          Mutate: (data, ctx) => {
            const k = data?.k;
            const state = ctx.state ?? { count: 0 };
            const props = ctx.props ?? { test: "" };
            if (k === "state") state.count = 999;
            if (k === "props") props.test = "999";
            return { state };
          }
        },
        view: (id) => div(`#${id}`, "test")
      };
    });

    const parent = component<{
      Props: { test: string };
      State: { count: number };
      Actions: {
        Increment: { step: number };
        Decrement: { step: number };
      };
      Tasks: {
        Validate: { count: number };
      };
    }>(({ action: a, task: t }) => {
      parentAction = a;
      parentTask = t;
      return {
        state: () => ({ count: 0 }),
        actions: parentActions,
        tasks: parentTasks,
        view: (id, { state }) => {
          const count = state?.count ?? 0;
          return div(
            `#${id}`,
            count < 100
              ? // < 100 renders child component
                child(`#child`, { test: "x" })
              : count < 1000
                ? // 100 to 999 renders with no child component
                  "-"
                : // 1000+ renders child component but with a duplicate id
                  child(`#parent`, { test: "x" })
          );
        }
      };
    });

    const app = component<{
      Props: { test: string };
      State: { theme: string };
      ActionPayloads: {
        SetTheme: { theme: string };
        NoOp: null;
      };
    }>(({ action: a }) => {
      rootAction = a;
      return {
        state: () => ({ theme: "a" }),
        actions: {
          SetTheme: (data, ctx) => {
            const theme = data?.theme ?? "";
            const state = ctx.state ?? { theme: "" };
            return { state: { ...state, theme } };
          },
          NoOp: (_, ctx) => {
            const state = ctx.state ?? { theme: "" };
            return { state };
          }
        },
        view: (id) => div(`#${id}`, [parent(`#parent`, { test: "x" })])
      };
    });

    mount({ app, props: { test: "x" } });
    jestReset();
  });

  it("should render component and children when state changes", () => {
    parentAction("Increment", { step: 1 })(testKey);
    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });

  it("should not render parent when child state changes", () => {
    childAction("Increment", { step: 1 })(testKey);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });

  it("should render all when root state changes", () => {
    rootAction("SetTheme", { theme: "test" })(testKey);
    expect(renderSpy).toHaveBeenCalledTimes(3);
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });

  it("should not render when state does not change", () => {
    childAction("NoOp")(testKey);
    expect(renderSpy).not.toHaveBeenCalled();
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it("should not render when rootState does not change", () => {
    rootAction("NoOp")(testKey);
    expect(renderSpy).not.toHaveBeenCalled();
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it("should run the success action of a synchronous task", () => {
    validatePerform = () => 5;
    return parentTask("Validate", { count: 1 })(testKey).then(() => {
      expect(validateSuccess).toHaveBeenCalled();
      expect(validateFailure).not.toHaveBeenCalled();
      expect(parentActions.Increment).toHaveBeenCalledWith({ step: 5 }, ctx);
      expect(renderSpy).toHaveBeenCalledTimes(2);
      expect(patchSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("should run the failure action of a synchronous task", () => {
    validatePerform = () => {
      throw 3;
    };
    return parentTask("Validate", { count: 1 })(testKey).then(() => {
      expect(validateSuccess).not.toHaveBeenCalled();
      expect(validateFailure).toHaveBeenCalled();
      expect(parentActions.Decrement).toHaveBeenCalledWith({ step: 3 }, ctx);
      expect(renderSpy).toHaveBeenCalledTimes(2);
      expect(patchSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("should run the success action of an asynchronous task", () => {
    validatePerform = () => new Promise((res) => setTimeout(() => res(5), 100));
    return parentTask("Validate", { count: 1 })(testKey).then(() => {
      expect(validateSuccess).toHaveBeenCalled();
      expect(validateFailure).not.toHaveBeenCalled();
      expect(parentActions.Increment).toHaveBeenCalledWith({ step: 5 }, ctx);
      expect(renderSpy).toHaveBeenCalledTimes(2);
      expect(patchSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("should run the failure action of an asynchronous task", () => {
    validatePerform = () => new Promise((res, rej) => setTimeout(() => rej(3), 100));
    return parentTask("Validate", { count: 1 })(testKey).then(() => {
      expect(validateSuccess).not.toHaveBeenCalled();
      expect(validateFailure).toHaveBeenCalled();
      expect(parentActions.Decrement).toHaveBeenCalledWith({ step: 3 }, ctx);
      expect(renderSpy).toHaveBeenCalledTimes(2);
      expect(patchSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("should throw when state is mutated", () => {
    expect(() => childAction("Mutate", { k: "state" })(testKey)).toThrow(
      "Cannot assign to read only property 'count' of object"
    );
  });

  it("should throw when props is mutated", () => {
    expect(() => childAction("Mutate", { k: "props" })(testKey)).toThrow(
      "Cannot assign to read only property 'test' of object"
    );
  });

  it("should throw when a duplicate id is found", () => {
    expect(() => parentAction("Increment", { step: 1000 })(testKey)).toThrow(
      'Component "parent" must have a unique id!'
    );
  });

  it("should throw when an action is called manually", () => {
    expect(() => parentAction("Increment", { step: 1 })()).toThrow(
      '#parent "Increment" cannot be invoked manually'
    );
  });

  it("should allow action calls with a DOM event input", () => {
    expect(() =>
      parentAction("Increment", { step: 1 })({ eventPhase: 1, target: null, type: "test" })
    ).not.toThrow();
  });

  it("should throw when a task is called manually", () => {
    expect(() => parentTask("Validate", { count: 1 })()).toThrow(
      '#parent "Validate" cannot be invoked manually'
    );
  });

  it("should allow task calls with a DOM event input", () => {
    const mockEvent = { eventPhase: 1, target: null, type: "test" };

    expect(() => parentTask("Validate", { count: 1 })(mockEvent)).not.toThrow();
  });

  it("should remove references when an existing component is not rendered", () => {
    const testRefs = (expectedIds: string[]) => {
      const registry = getComponentRegistry();
      const refIds = Array.from(registry.keys()).sort();
      expect(refIds).toEqual(expectedIds.sort());

      // Verify all components have prevProps set
      refIds.forEach((id) => {
        const instance = registry.get(id);
        expect(instance?.prevProps).toBeDefined();
      });

      // Verify no components are marked as inCurrentRender after render completes
      refIds.forEach((id) => {
        const instance = registry.get(id);
        expect(instance?.inCurrentRender).toBe(false);
      });
    };

    parentAction("Increment", { step: 1 })(testKey);
    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(patchSpy).toHaveBeenCalledTimes(1);
    testRefs(["child", "parent", "app"]);

    parentAction("Increment", { step: 99 })(testKey);
    expect(renderSpy).toHaveBeenCalledTimes(3);
    expect(patchSpy).toHaveBeenCalledTimes(2);
    testRefs(["parent", "app"]);

    parentAction("Decrement", { step: 1 })(testKey);
    expect(renderSpy).toHaveBeenCalledTimes(5);
    expect(patchSpy).toHaveBeenCalledTimes(3);
    testRefs(["parent", "app", "child"]);
  });
});
