# pure-ui-actions

Type-safe components made with pure declarative actions

- Actions with deferred effects for [testing without mocks](https://www.youtube.com/watch?v=6EdXaWfoslc), works with redux dev tools
- Data flow inspired by [The Elm Architecture](https://guide.elm-lang.org/architecture/), see also [Redux comparison](#redux-comparison) below
- Uses [Snabbdom VDOM](https://github.com/snabbdom/snabbdom) and is [optimized for minimal renders](https://github.com/robCrawford/pure-ui-actions/blob/master/src/pure-ui-actions.spec.ts)
- Designed for AI agents to generate explicit, semantic code that’s easy for humans and LLMs to read and maintain

**For developers and AI agents:** See [AGENTS.md](./AGENTS.md) for comprehensive architectural patterns, best practices, and development guidelines.

### Examples:
- [Single page app demo](http://robcrawford.github.io/demos/pure-ui-actions/spa?debug=console) *[[ source ]](https://github.com/robCrawford/pure-ui-actions/tree/master/examples/spa)*
- Hello World *[[ source ]](https://github.com/robCrawford/pure-ui-actions/tree/master/examples/hello-world)*

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

## Hello World!

```JavaScript
import { component, html, mount, Config, Next, Task, VNode } from "pure-ui-actions";
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
      SetDocTitle: ({ title }): Task<void> => ({
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

### Context: DOM Events
An `event` prop is also passed via `Context` when actions are invoked from the DOM.

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

## Unit tests

For tests, `testAction` and `testTask` functions return plain data, so component logic can be tested without mocks or executing actual effects.

```JavaScript
import { testComponent, NextData } from "pure-ui-actions";
import app, { State } from "./app";

describe("App", () => {

  const { testAction, testTask, config, initialState } = testComponent(app, { placeholder: "placeholder" });

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
    const { state, next } = testAction<State>("ShowMessage", { text: "Hello World!"});

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
    const { perform, success, failure } = testTask("SetDocTitle", { title: "test" });

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

## Redux DevTools Integration

`pure-ui-actions` automatically integrates with [Redux DevTools](https://github.com/reduxjs/redux-devtools) browser extension for enhanced debugging:

- **Action History** - See all actions fired with their payloads
- **State Inspector** - View component states in a tree structure
- **State Diff** - Automatically see what changed with each action
- **Task Tracking** - Monitor async operations (success/failure)

**Setup:**
1. Install the [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools/tree/main/extension) for your browser
2. Open your app
3. Open browser DevTools → Redux tab
4. Watch actions and state updates in real-time

**Example DevTools output:**
```
app/Initialize
app/ShowMessage { text: "Hello World!" }
app/[Task] SetDocTitle/success
counter/Increment { step: 1 }
counter/[Task] ValidateCount/success
```

**Logging controls:**
- Redux DevTools logging is automatic when the extension is installed
- Add `?debug=console` to enable console logging
- Add `?logRenders=true` to include render events in both outputs

## Efficient List Rendering

Use `withKey` to add unique identifiers to list items for efficient updates when items can be reordered, added, or removed

```JavaScript
import { component, html, withKey } from "pure-ui-actions";
const { div, ul, li } = html;

export default component(() => ({
  state: () => ({
    items: [
      { id: '1', label: 'A' },
      { id: '2', label: 'B' },
      { id: '3', label: 'C' }
    ]
  }),

  view(id, { state }) {
    return div(`#${id}`, [
      ul([
        // Keys help the VDOM library efficiently track changes
        ...state.items.map(item =>
          withKey(item.id, li(item.label))
        )
      ])
    ]);
  }
}));
```

## Component Memoization

Use `memo` to skip re-rendering expensive components that **don't access `rootState`**. Like React's `memo`, it only re-renders when the comparison key changes.

**⚠️ Only use for components that don't read `rootState`** — memoized components bypass the normal render flow when rootState changes, so they won't see updates. Prefer local state or props (see [AGENTS.md](./AGENTS.md) for state management guidance).

```JavaScript
import { component, html, memo } from "pure-ui-actions";
const { div, ul, li } = html;

const listComponent = (id, { items }) => 
  div(`#${id}`, [
    ul(items.map(item => li(item.name)))
  ]);

export default component(() => ({
  state: () => ({
    items: [/* ... */],
    counter: 0  // Unrelated state
  }),

  actions: {
    Increment: (_, { state }) => ({
      state: { ...state, counter: state.counter + 1 }
    })
  },

  view(id, { state }) {
    return div(`#${id}`, [
      div(`Counter: ${state.counter}`),
      
      // Memoized: counter changes don't re-render the list
      memo(
        `#${id}-list`,
        listComponent,
        { items: state.items },
        state.items  // Only re-renders when items change
      )
    ]);
  }
}));
```

Components that need `rootState` should be rendered normally or receive it as explicit props.

---

## Additional APIs

`pure-ui-actions` provides additional utilities for advanced use cases:

- **`subscribe(event, handler)`** / **`unsubscribe(event, handler)`** - Subscribe to framework lifecycle events (like `"patch"`)
- **`publish(event, detail?)`** - Emit custom application events
- **`setHook(vnode, hookName, callback)`** - Access VDOM lifecycle hooks

See [AGENTS.md](./AGENTS.md) for complete documentation on these APIs and when to use them.

---

## <a id="redux-comparison"></a>Redux Comparison

Both Redux and pure-ui-actions emphasize **pure functions for state transformations**, but with different patterns:

### Redux: Actions as Data

```javascript
// 1. Action creator returns plain object
const increment = (step) => ({ 
  type: 'INCREMENT', 
  payload: { step } 
});

// 2. Dispatch the action
dispatch(increment(5));

// 3. Reducer handles the action (pure function)
function counterReducer(state, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, count: state.count + action.payload.step };
    default:
      return state;
  }
}
```

### pure-ui-actions: Actions as Functions

```javascript
// 1. action() creates a thunk
const incrementThunk = action("Increment", { step: 5 });

// 2. Framework invokes handler (pure function)
actions: {
  Increment: ({ step }, { state }) => ({
    state: { ...state, count: state.count + step }
  })
}
```

### Key Insight

In pure-ui-actions, **`action()` combines both action creator and dispatch** into a single deferred function. The action handler (equivalent to a Redux reducer) is still a pure function called by the framework.

**Differences:**
- Redux actions are plain data; pure-ui-actions actions are functions
- pure-ui-actions has built-in async handling (Tasks)
- Automatic action thunk memoization vs manual selector memoization
