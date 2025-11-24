# pure-ui-actions

Co-authored with an AI agent to produce clean, predictable state flows that humans and AI can follow.

- Emphasis on pure functions
- Named actions with deferred effects, allows [testing without mocks](https://www.youtube.com/watch?v=6EdXaWfoslc) and works with redux dev tools
- Data flow inspired by [The Elm Architecture](https://guide.elm-lang.org/architecture/), see also [Redux comparison](#redux-comparison) below
- Uses [Snabbdom VDOM](https://github.com/snabbdom/snabbdom) and is [optimized for minimal renders](https://github.com/robCrawford/pure-ui-actions/blob/master/src/pure-ui-actions.spec.ts)
- [AGENTS.md](./AGENTS.md) (written by AI)

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

**Root actions and tasks:** The root app component can export `RootState`, `RootActions`, and `RootTasks` types that child components import and access via `rootAction()`, `rootTask()`, and `rootState`. This enables application-wide state and actions accessible from any component. See [AGENTS.md](./AGENTS.md) for full examples.

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
import { component, html, mount } from "pure-ui-actions";
import { setDocTitle} from "./services/browser";
const { h3, div } = html;

export type Props = Readonly<{
  date: string;
}>;

export type State = Readonly<{
  title: string;
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

export type Component = {
  Props: Props;
  State: State;
  Actions: Actions;
  Tasks: Tasks;
};


const app = component<Component>(
  ({ action, task }) => ({

    // Initial state
    state: (props) => ({
      title: `Welcome! ${props.date}`,
      text: '',
      done: false
    }),

    // Initial action
    init: action("ShowMessage", { text: "Hello World!" }),

    // Action handlers return new state, and any next actions/tasks
    actions: {
      ShowMessage: (data, context) => {
        return {
          state: {
            ...context.state,
            text: data.text
          },
          next: task("SetDocTitle", { title: data.text })
        };
      },
      PageReady: (data, context) => {
        return {
          state: {
            ...context.state,
            done: data.done
          }
        };
      },
    },

    // Task handlers provide callbacks for effects and async operations that may fail
    tasks: {
      SetDocTitle: (data) => ({
        perform: () => setDocTitle(data.title),
        success: () => action("PageReady", { done: true }),
        failure: () => action("PageReady", { done: false })
      })
    },

    // View renders from props & state
    view(id, context) {
      return div(`#${id}-message`, [
        h3(context.state.title),
        div(context.state.text),
        div(context.state.done ? '✅' : '❎')
      ]);
    }

  })
);

document.addEventListener(
  "DOMContentLoaded",
  (): void => mount({ app, props: { date: new Date().toDateString() } })
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

### Testing Actions with Custom Context

Pass an optional third parameter to test actions with specific state, rootState, or events:

```JavaScript
// Test with custom state
const { state } = testAction("ProcessData", { value: 10 }, {
  state: { count: 5, data: [] }
});

// Test action that accesses rootState
const { state } = testAction("ApplyTheme", {}, {
  state: initialState,
  rootState: { theme: "dark" }
});

// Test action that accesses DOM event
const mockEvent = { target: { value: "test input" } };
const { state } = testAction("HandleInput", {}, {
  state: initialState,
  event: mockEvent
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

**Logging controls:**
- Redux DevTools logging is automatic when the extension is installed
- Add `?logRenders=true` to include render events
- Add `?debug=console` to enable console logging (includes renders)

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

Both Redux and pure-ui-actions emphasize **pure functions for state updates**, but with different patterns:

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
