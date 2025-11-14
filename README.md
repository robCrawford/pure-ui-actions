# Jetix

Minimal wiring for TypeScript components made of pure functions.

- [Effects as data](https://www.youtube.com/watch?v=6EdXaWfoslc) for separation and cleaner tests
- [Snabbdom VDOM](https://github.com/snabbdom/snabbdom) for a [unidirectional data flow](https://guide.elm-lang.org/architecture/)
- [hyperscript-helpers](https://github.com/ohanhi/hyperscript-helpers) means the view is just functions
- [Optimized](https://github.com/robCrawford/jetix/blob/master/src/jetix.spec.ts) for fewer renders/patches
- High type coverage

Also contains lightweight prevention of anti-patterns like state mutation and manually calling declarative actions.

**For developers and AI agents:** See [AGENTS.md](./AGENTS.md) for comprehensive architectural patterns, best practices, and development guidelines.

### Examples:
- [Single page app demo](http://robcrawford.github.io/demos/jetix/spa?debug) *[[ source ]](https://github.com/robCrawford/jetix/tree/master/examples/spa)*
- Hello World *[[ source ]](https://github.com/robCrawford/jetix/tree/master/examples/hello-world)*

------------------------

### Actions and tasks
The `component` callback receives an object exposing `action`, `task`, `rootAction` and `rootTask` functions.

```JavaScript
export default component(
  ({ action, task, rootAction, rootTask }) => ({
    // Initial action
    init: action( "ShowMessage", { text: "Hello World!" } ),
  })
);
```

### Context: Props and state
All `action` handlers, `task` callbacks and `view` functions receive `props`, `state` and `rootState` via a `Context` input.

```JavaScript
view(id, { props, state, rootState }) {
  return div(`#${id}-message`, [
    // Render from props and state
    h1(props.title),
    div(state.text)
  ]);
}
```

### Context: DOM Events
If a DOM event is available, an `event` prop will also be populated on `Context`.

```JavaScript
    actions: {
      Input: (_, { props, state, event }) => ({
        state: { 
          ...state, 
          text: event?.target?.value ?? "" 
        }
      })
    },
    view: (id, { state }) =>
      html.input(`#${id}-input`, {
        props: { value: state.text },
        on: { input: action("Input") }
      })
```


## Hello World!

```JavaScript
import { component, html, mount, Config, Next, Task, VNode } from "jetix";
import { setDocTitle} from "../services/browser";
const { div } = html;

export type Props = Readonly<{
  placeholder: string;
}>;

export type State = Readonly<{
  text: string;
  done: boolean;
}>;

export type Actions = Readonly<{
  ShowMessage: { text: string };
  PageReady: { done: boolean };
}>;

export type Tasks = Readonly<{
  SetDocTitle: { title: string };
}>;

type Component = {
  Props: Props;
  State: State;
  Actions: Actions;
  Tasks: Tasks;
};


const app = component<Component>(
  ({ action, task }): Config<Component> => ({

    // Initial state
    state: ({ placeholder }): State => ({
      text: placeholder,
      done: false
    }),

    // Initial action
    init: action(
      "ShowMessage",
      { text: "Hello World!" }
    ),

    // Action handlers return new state, and any next actions/tasks
    actions: {
      ShowMessage: ({ text }, { state }): { state: State; next: Next } => {
        return {
          state: { ...state, text },
          next: task("SetDocTitle", { title: text })
        };
      },
      PageReady: ({ done }, { state }): { state: State } => {
        return {
          state: { ...state, done }
        };
      },
    },

    // Task handlers provide callbacks for effects and async operations that may fail
    tasks: {
      SetDocTitle: ({ title }): Task<null, State> => ({
        perform: (): Promise<void> => setDocTitle(title),
        success: (): Next => action("PageReady", { done: true }),
        failure: (): Next => action("PageReady", { done: false })
      })
    },

    // View renders from props & state
    view(id, { state }): VNode {
      return div(`#${id}-message`, [
        div(state.text),
        div(state.done ? '✅' : '❎')
      ]);
    }

  })
);

document.addEventListener(
  "DOMContentLoaded",
  (): void => mount({ app, props: { placeholder: "Loading" } })
);

export default app;
```

## Unit tests

For tests the `action` and `task` functions just return data, so component logic can be tested without mocks.

```JavaScript
import { testComponent, NextData } from "jetix";
import app, { State } from "./app";

describe("App", () => {

  const { action, task, config, initialState } = testComponent(app, { placeholder: "placeholder" });

  it("should set initial state", () => {
    expect(initialState).toEqual({ text: "placeholder", done: false });
  });

  it("should run initial action", () => {
    expect(config.init).toEqual({
      name: "ShowMessage",
      data: { text: "Hello World!" }
    });
  });

  describe("'ShowMessage' action", () => {
    const { state, next } = action<State>("ShowMessage", { text: "Hello World!"});

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        text: "Hello World!"
      });
    });

    it("should return next", () => {
      const { name, data } = next as NextData;
      expect(name).toBe("SetDocTitle");
      expect(data).toEqual({ title: "Hello World!" });
    });
  });

  describe("'SetDocTitle' task", () => {
    const { perform, success, failure } = task("SetDocTitle", { title: "test" });

    it("should provide perform", () => {
      expect(perform).toBeDefined();
    });

    it("should handle success", () => {
      const { name, data } = success() as NextData;
      expect(name).toBe("PageReady");
      expect(data).toEqual({ done: true });
    });

    it("should handle failure", () => {
      const { name, data } = failure() as NextData;
      expect(name).toBe("PageReady");
      expect(data).toEqual({ done: false });
    });
  });

});
```

## Efficient List Rendering

Use `withKey` to add unique identifiers to list items for efficient updates

```JavaScript
import { component, html, withKey } from "jetix";
const { div, ul, li } = html;

export default component(() => ({
  state: () => ({
    items: [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Charlie' }
    ]
  }),

  view(id, { state }) {
    return div(`#${id}`, [
      ul([
        // Keys help the VDOM library efficiently track changes
        ...state.items.map(item =>
          withKey(item.id, li(item.name))
        )
      ])
    ]);
  }
}));
```

Keys are essential when items can be reordered, added, or removed
