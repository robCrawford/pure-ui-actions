# Jetix

Minimal wiring for TypeScript components made of pure functions.

- [Effects as data](https://www.youtube.com/watch?v=6EdXaWfoslc) for separation and cleaner tests
- [Snabbdom VDOM](https://github.com/snabbdom/snabbdom) for a [unidirectional data flow](https://guide.elm-lang.org/architecture/)
- [hyperscript-helpers](https://github.com/ohanhi/hyperscript-helpers) means the view is just functions
- [Optimized](https://github.com/robCrawford/jetix/blob/master/src/jetix.spec.ts) for fewer renders/patches
- High type coverage

Also contains lightweight prevention of anti-patterns like state mutation and manually calling declarative actions.

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

## Idiomatic Patterns and Best Practices

This section provides in-depth guidance for writing idiomatic Jetix applications with TypeScript.

### Component Composition

Components can be composed by rendering child components in the parent's view. Child components receive props including action thunks for communication back to the parent.

**Defining a child component that accepts callbacks:**

```typescript
import { ActionThunk, component, html, Config, VNode, Next } from "jetix";
const { div, button } = html;

export type Props = Readonly<{
  text: string;
  onDismiss: ActionThunk;  // Parent action thunk passed as prop
}>;

type State = Readonly<{
  show: boolean;
}>;

type Actions = Readonly<{
  Dismiss: null;
}>;

type Component = {
  Props: Props;
  State: State;
  Actions: Actions;
};

export default component<Component>(
  ({ action }): Config<Component> => ({
    state: (): State => ({
      show: true
    }),

    actions: {
      Dismiss: (_, { props, state }): { state: State; next: Next } => {
        return {
          state: { ...state, show: false },
          next: props.onDismiss  // Invoke parent's action thunk
        };
      }
    },

    view(id, { props, state }): VNode {
      return div(`#${id}.notification`, [
        props.text,
        button({ on: { click: action("Dismiss") } }, "Dismiss")
      ]);
    }
  })
);
```

**Using the child component from a parent:**

```typescript
import notification from "./components/notification";

export default component<Component>(
  ({ action }): Config<Component> => ({
    state: (): State => ({
      feedback: ""
    }),

    actions: {
      SetFeedback: ({ text }, { state }): { state: State } => {
        return {
          state: { ...state, feedback: text }
        };
      }
    },

    view(id, { state }): VNode {
      return div(`#${id}`, [
        // Render child component, passing action thunk as prop
        notification(`#${id}-feedback`, {
          text: state.feedback,
          onDismiss: action("SetFeedback", { text: "" })
        })
      ]);
    }
  })
);
```

### Root Actions and Tasks

Child components can access root-level actions and tasks by declaring them in their Component type and using `rootAction` and `rootTask` from the component callback.

**Declaring root types in parent:**

```typescript
export type RootState = Readonly<{
  theme: string;
  likes: Record<string, number>;
}>;

export type RootActions = Readonly<{
  SetTheme: { theme: string };
  Like: { page: string };
}>;

export type RootTasks = Readonly<{
  SetDocTitle: { title: string };
}>;
```

**Using rootAction and rootTask from a child component:**

```typescript
import { component, html, Config, VNode, Next } from "jetix";
import { RootState, RootActions, RootTasks } from "../app";
const { button } = html;

export type Props = Readonly<{
  page: string;
}>;

type Actions = Readonly<{
  Like: null;
}>;

type Component = {
  Props: Props;
  State: null;
  Actions: Actions;
  RootState: RootState;    // Access root state
  RootActions: RootActions; // Access root actions
  RootTasks: RootTasks;    // Access root tasks
};

export default component<Component>(
  ({ action, rootAction, rootTask }): Config<Component> => ({
    actions: {
      Like: (_, { props }): { state: null; next: Next } => {
        return {
          state: null,
          next: [
            rootAction("Like", { page: props.page }),
            rootTask("SetDocTitle", { title: "You like this!" })
          ]
        };
      }
    },

    view: (id, { props, rootState }): VNode =>
      button(
        `#${id}.like`,
        { on: { click: action("Like") } },
        `👍${rootState.likes[props.page]}`
      )
  })
);
```

Components can also use `rootAction` and `rootTask` in their `init` property:

```typescript
export default component<Component>(
  ({ rootTask }): Config<Component> => ({
    init: rootTask("SetDocTitle", { title: "Page Title" }),
    
    view(id): VNode {
      return div(`#${id}`, "Content");
    }
  })
);
```

### TypeScript Best Practices

Follow these patterns for type-safe, idiomatic Jetix components:

**1. Always use Readonly types for Props and State:**

```typescript
export type Props = Readonly<{
  title: string;
  count: number;
}>;

export type State = Readonly<{
  items: string[];
  selected: boolean;
}>;
```

**2. Define the Component type with all generic parameters:**

```typescript
type Component = {
  Props: Props;      // Required if component accepts props
  State: State;      // Required if component has state (or null)
  Actions: Actions;  // Required if component has actions
  Tasks: Tasks;      // Required if component has tasks
  RootState: RootState;    // Optional - for accessing root state
  RootActions: RootActions; // Optional - for accessing root actions
  RootTasks: RootTasks;    // Optional - for accessing root tasks
};
```

**3. Include return type annotations on functions:**

```typescript
// State initializer
state: (props: Props): State => ({
  count: props.initialCount
}),

// Action handlers
actions: {
  Increment: ({ step }, { state }): { state: State; next: Next } => {
    return {
      state: { ...state, count: state.count + step },
      next: action("Validate")
    };
  }
},

// View function
view(id: string, { props, state }: Context<Props, State, null>): VNode {
  return div(`#${id}`, state.count.toString());
}
```

**4. Use null for components without State:**

```typescript
type Component = {
  Props: Props;
  State: null;      // No local state
  Actions: Actions;
};

export default component<Component>(
  ({ action }): Config<Component> => ({
    // No state property needed
    
    actions: {
      DoSomething: (_, { props }): { state: null } => {
        return { state: null };  // Return null for state
      }
    }
  })
);
```

### Immutability Patterns

Jetix freezes state and props to prevent mutations. Follow these patterns for updating state immutably:

**1. Conditional same-state optimization:**

```typescript
actions: {
  SetTheme: ({ theme }, { state }): { state: State } => {
    // Return same state reference if value hasn't changed
    return {
      state: theme === state.theme ? state : {
        ...state,
        theme
      }
    };
  }
}
```

**2. Nested object spreading:**

```typescript
actions: {
  IncrementLike: ({ page }, { state }): { state: State } => {
    return {
      state: {
        ...state,
        likes: {
          ...state.likes,
          [page]: state.likes[page] + 1
        }
      }
    };
  }
}
```

**3. Array updates:**

```typescript
actions: {
  AddItem: ({ item }, { state }): { state: State } => {
    return {
      state: {
        ...state,
        items: [...state.items, item]
      }
    };
  },
  
  RemoveItem: ({ index }, { state }): { state: State } => {
    return {
      state: {
        ...state,
        items: state.items.filter((_, i) => i !== index)
      }
    };
  },
  
  UpdateItem: ({ index, item }, { state }): { state: State } => {
    return {
      state: {
        ...state,
        items: state.items.map((existing, i) => 
          i === index ? item : existing
        )
      }
    };
  }
}
```

### Task Variations

Tasks can be used for various types of side effects and async operations.

**1. Effect-only tasks (no success/failure):**

```typescript
tasks: {
  SetDocTitle: ({ title }) => ({
    perform: (): void => {
      document.title = title;
    }
    // No success or failure handlers needed
  })
}
```

**2. Async tasks with success and failure:**

```typescript
tasks: {
  FetchData: ({ id }) => ({
    perform: (): Promise<Data> => fetch(`/api/${id}`).then(r => r.json()),
    
    success: (data: Data, { state }): Next => {
      return action("DataLoaded", { data });
    },
    
    failure: (error: Error, { state }): Next => {
      return action("DataFailed", { error: error.message });
    }
  })
}
```

**3. Tasks that return actions based on results:**

```typescript
tasks: {
  ValidateInput: ({ value }) => ({
    perform: (): Promise<ValidationResult> => validateAsync(value),
    
    success: (result: ValidationResult): Next => {
      // Return different actions based on result
      if (result.valid) {
        return action("ValidationPassed");
      } else {
        return action("ValidationFailed", { errors: result.errors });
      }
    },
    
    failure: (error: Error): Next => {
      return action("ValidationError", { message: error.message });
    }
  })
}
```

**4. Tasks that return multiple next actions:**

```typescript
tasks: {
  Initialize: () => ({
    perform: (): Promise<AppData> => loadAppData(),
    
    success: (data: AppData): Next => {
      return [
        action("SetData", data),
        action("LoadComplete"),
        task("TrackAnalytics", { event: "app_loaded" })
      ];
    }
  })
}
```

### Component Lifecycle

Understanding when components render and update:

**1. Initial render:**
- Component's `state` function is called with props
- `init` action/task runs (if defined)
- `view` function renders the initial VNode

**2. Re-rendering on state changes:**
- Action handler returns new state
- Component's `view` function is called with new state
- VDOM patch updates only the changed DOM elements

**3. Re-rendering on props changes:**
- Parent re-renders and passes new props to child
- Child's `view` function is called with new props
- VDOM patch updates the DOM

**4. Props updates flow parent to child:**

```typescript
// Parent component
actions: {
  UpdateCounter: ({ value }, { state }): { state: State } => {
    return {
      state: { ...state, counterValue: value }
    };
  }
},

view(id, { state }): VNode {
  return div(`#${id}`, [
    // When counterValue changes, child receives new props and re-renders
    counter(`#${id}-counter`, { value: state.counterValue })
  ]);
}
```

**5. Optimization - memoized thunks:**

Action and task thunks returned by `action()`, `task()`, `rootAction()`, and `rootTask()` are automatically memoized. If called with the same parameters, they return the same function reference, preventing unnecessary re-renders when passed as props.

```typescript
// These will be the same reference if called multiple times with same params
const onClick1 = action("Click", { id: 1 });
const onClick2 = action("Click", { id: 1 });
// onClick1 === onClick2 → true

const onClick3 = action("Click", { id: 2 });
// onClick1 === onClick3 → false
```