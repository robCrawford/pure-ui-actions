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

### Pure Functions and I/O Separation

**Core Principle: Actions are pure functions. All I/O and side effects must be isolated in Tasks.**

Jetix follows the Elm Architecture pattern, enforcing a strict separation between pure logic and side effects:

**Actions**: Pure functions that transform state
- Receive input (payload + context) and return output (new state + next actions/tasks)
- Must not perform I/O, mutate external state, or have side effects
- Predictable and easy to test without mocks
- Example: Incrementing a counter, updating form state, filtering a list

```typescript
actions: {
  Increment: ({ step }, { state }): { state: State; next: Next } => {
    // Pure function: input → output, no side effects
    return {
      state: { ...state, count: state.count + step },
      next: action("Validate")  // Declare next action as data
    };
  }
}
```

**Tasks**: The exclusive location for all side effects
- API calls and network requests
- DOM mutations (except rendering via the view function)
- Browser APIs (localStorage, sessionStorage, document.title, etc.)
- Timers, setTimeout, setInterval
- Logging, analytics, and tracking
- Any operation that affects the outside world

```typescript
tasks: {
  // Effect-only task (synchronous side effect)
  SetDocTitle: ({ title }) => ({
    perform: (): void => {
      document.title = title;  // Side effect isolated here
    }
  }),
  
  // Async task with success/failure handling
  FetchUser: ({ id }) => ({
    perform: (): Promise<User> => fetch(`/api/users/${id}`).then(r => r.json()),
    success: (user: User): Next => action("UserLoaded", { user }),
    failure: (error: Error): Next => action("UserLoadFailed", { error: error.message })
  })
}
```

**External I/O**: Use the `init` callback from `mount()` to wire external events (routing, websockets, browser events) to root actions:

```typescript
mount({
  app,
  props: {},
  init: (runRootAction) => {
    // Connect router to actions
    router.on({ 
      about: () => runRootAction("SetPage", { page: "about" }),
      home: () => runRootAction("SetPage", { page: "home" })
    }).resolve();
    
    // Connect other external events
    window.addEventListener("online", () => 
      runRootAction("SetOnlineStatus", { online: true })
    );
  }
});
```

This architecture provides:
- **Testability**: Actions are just data transformations, testable without mocks
- **Predictability**: Pure functions always return the same output for the same input
- **Maintainability**: Clear boundaries between logic and effects
- **Debuggability**: Actions and tasks are declarative data, enabling time-travel debugging

### Common Mistakes and Anti-Patterns

Understanding what NOT to do is as important as knowing the correct patterns. Jetix enforces these rules at runtime (throwing errors or logging warnings), but following these guidelines will help you write correct code from the start.

**❌ WRONG: Side effects in actions**

```typescript
actions: {
  SaveData: ({ data }, { state }) => {
    // Wrong - Side effects belong in tasks
    localStorage.setItem('data', JSON.stringify(data));
    fetch('/api/save', { method: 'POST', body: JSON.stringify(data) });
    document.title = 'Data Saved';
    
    return { state: { ...state, saved: true } };
  }
}
```

**✅ CORRECT: Side effects in tasks**

```typescript
actions: {
  SaveData: ({ data }, { state }) => {
    return { 
      state: { ...state, data },
      next: task("PersistData", { data })
    };
  }
},
tasks: {
  PersistData: ({ data }) => ({
    perform: () => {
      // All side effects go here
      localStorage.setItem('data', JSON.stringify(data));
      return fetch('/api/save', { 
        method: 'POST', 
        body: JSON.stringify(data) 
      });
    },
    success: () => action("DataSaved"),
    failure: (error) => action("SaveFailed", { error: error.message })
  })
}
```

**❌ WRONG: Mutating state directly**

```typescript
actions: {
  AddItem: ({ item }, { state }) => {
    // Wrong - Mutation will throw error due to deepFreeze
    state.items.push(item);
    state.count = state.count + 1;
    
    return { state };
  }
}
```

**✅ CORRECT: Immutable updates with spread operators**

```typescript
actions: {
  AddItem: ({ item }, { state }) => {
    return {
      state: {
        ...state,
        items: [...state.items, item],
        count: state.count + 1
      }
    };
  }
}
```

**❌ WRONG: Manually calling action thunks**

```typescript
// In some arbitrary function
const myAction = action("DoSomething", { value: 1 });
myAction(); // Wrong - Will log error, actions must be triggered by framework
```

**✅ CORRECT: Actions triggered by DOM events or as Next**

```typescript
// In view - bound to DOM event
view(id, { state }): VNode {
  return button(
    { on: { click: action("DoSomething", { value: 1 }) } },
    "Click me"
  );
}

// In action - returned as Next
actions: {
  FirstAction: (_, { state }) => {
    return {
      state,
      next: action("DoSomething", { value: 1 })
    };
  }
}
```

**❌ WRONG: Async operations in actions**

```typescript
actions: {
  LoadUser: async ({ id }, { state }) => {
    // Wrong - Actions must be synchronous
    const user = await fetch(`/api/users/${id}`).then(r => r.json());
    return { state: { ...state, user } };
  }
}
```

**✅ CORRECT: Async operations in tasks**

```typescript
actions: {
  LoadUser: ({ id }, { state }) => {
    return {
      state: { ...state, loading: true },
      next: task("FetchUser", { id })
    };
  },
  UserLoaded: ({ user }, { state }) => {
    return {
      state: { ...state, user, loading: false }
    };
  }
},
tasks: {
  FetchUser: ({ id }) => ({
    perform: () => fetch(`/api/users/${id}`).then(r => r.json()),
    success: (user) => action("UserLoaded", { user }),
    failure: (error) => action("LoadFailed", { error: error.message })
  })
}
```

**❌ WRONG: Conditional task execution in action**

```typescript
actions: {
  Submit: ({ data }, { state }) => {
    if (data.needsValidation) {
      // Wrong - Can't conditionally execute tasks inline
      validateData(data);
    }
    return { state: { ...state, data } };
  }
}
```

**✅ CORRECT: Conditional Next based on state**

```typescript
actions: {
  Submit: ({ data }, { state }) => {
    return {
      state: { ...state, data },
      next: data.needsValidation 
        ? task("ValidateData", { data })
        : action("SubmitComplete")
    };
  }
}
```

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

### Service Functions Pattern

Service functions are reusable, pure I/O operations that encapsulate API calls, browser APIs, and other external interactions. They are called from task `perform` functions, keeping your component logic clean and testable.

**Organizing service functions:**

```typescript
// src/services/api.ts - API calls
export async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }
  return response.json();
}

export async function saveUser(user: User): Promise<void> {
  const response = await fetch(`/api/users/${user.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  if (!response.ok) {
    throw new Error(`Failed to save user: ${response.statusText}`);
  }
}

// src/services/storage.ts - Browser storage
export function saveToLocalStorage(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadFromLocalStorage<T>(key: string): T | null {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

// src/services/browser.ts - Browser APIs
export async function setDocTitle(title: string): Promise<void> {
  document.title = title;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
```

**Using service functions in tasks:**

```typescript
import { fetchUser, saveUser } from "./services/api";
import { saveToLocalStorage } from "./services/storage";

export default component<Component>(
  ({ action, task }): Config<Component> => ({
    
    actions: {
      LoadUser: ({ id }, { state }) => ({
        state: { ...state, loading: true, error: null },
        next: task("FetchUser", { id })
      }),
      UserLoaded: ({ user }, { state }) => ({
        state: { ...state, user, loading: false }
      })
    },
    
    tasks: {
      FetchUser: ({ id }) => ({
        perform: () => fetchUser(id),  // Service function
        success: (user) => action("UserLoaded", { user }),
        failure: (error) => action("LoadFailed", { error: error.message })
      }),
      
      SaveUser: ({ user }) => ({
        perform: async () => {
          await saveUser(user);  // Service function
          saveToLocalStorage('lastSaved', Date.now());  // Service function
        },
        success: () => action("SaveComplete"),
        failure: (error) => action("SaveFailed", { error: error.message })
      })
    },
    
    view(id, { state }): VNode {
      return div(`#${id}`, [
        state.loading ? div("Loading...") : div(state.user?.name ?? "")
      ]);
    }
  })
);
```

**Benefits of service functions:**
- **Reusability**: Same function used across multiple components
- **Testability**: Easy to unit test in isolation
- **Type safety**: TypeScript ensures correct parameters and return types
- **Separation of concerns**: Business logic separate from I/O implementation

### Error Handling Patterns

Proper error handling ensures your application gracefully handles failures and provides good user feedback.

**Pattern 1: Loading, Error, and Data states**

```typescript
type State = Readonly<{
  user: User | null;
  loading: boolean;
  error: string | null;
}>;

export default component<Component>(
  ({ action, task }): Config<Component> => ({
    
    state: (): State => ({
      user: null,
      loading: false,
      error: null
    }),
    
    actions: {
      LoadUser: ({ id }, { state }) => ({
        state: { ...state, loading: true, error: null },
        next: task("FetchUser", { id })
      }),
      
      UserLoaded: ({ user }, { state }) => ({
        state: { ...state, user, loading: false, error: null }
      }),
      
      LoadFailed: ({ error }, { state }) => ({
        state: { ...state, loading: false, error }
      }),
      
      ClearError: (_, { state }) => ({
        state: { ...state, error: null }
      })
    },
    
    tasks: {
      FetchUser: ({ id }) => ({
        perform: () => fetchUser(id),
        success: (user) => action("UserLoaded", { user }),
        failure: (error) => action("LoadFailed", { 
          error: error.message || "An unknown error occurred" 
        })
      })
    },
    
    view(id, { state }): VNode {
      return div(`#${id}`, [
        state.loading && div(".loading", "Loading..."),
        state.error && div(".error", [
          span(state.error),
          button({ on: { click: action("ClearError") } }, "Dismiss")
        ]),
        state.user && div(".user-profile", [
          h2(state.user.name),
          p(state.user.email)
        ])
      ]);
    }
  })
);
```

**Pattern 2: Retry logic**

```typescript
type State = Readonly<{
  data: Data | null;
  retryCount: number;
  maxRetries: number;
  error: string | null;
}>;

actions: {
  LoadData: (_, { state }) => ({
    state: { ...state, error: null },
    next: task("FetchData", {})
  }),
  
  LoadFailed: ({ error }, { state }) => {
    const shouldRetry = state.retryCount < state.maxRetries;
    return {
      state: {
        ...state,
        retryCount: state.retryCount + 1,
        error: shouldRetry ? null : error
      },
      next: shouldRetry 
        ? task("FetchData", {})
        : undefined
    };
  },
  
  DataLoaded: ({ data }, { state }) => ({
    state: { ...state, data, retryCount: 0, error: null }
  })
}
```

**Pattern 3: Validation errors**

```typescript
type ValidationError = {
  field: string;
  message: string;
};

type State = Readonly<{
  formData: FormData;
  validationErrors: ValidationError[];
  submitting: boolean;
}>;

actions: {
  Submit: (_, { state }) => ({
    state: { ...state, submitting: true, validationErrors: [] },
    next: task("ValidateAndSubmit", { data: state.formData })
  }),
  
  ValidationFailed: ({ errors }, { state }) => ({
    state: { 
      ...state, 
      submitting: false, 
      validationErrors: errors 
    }
  }),
  
  SubmitSuccess: (_, { state }) => ({
    state: { 
      ...state, 
      submitting: false, 
      validationErrors: [],
      formData: initialFormData 
    }
  })
},

view(id, { state }): VNode {
  return form(`#${id}`, [
    input({
      props: { value: state.formData.email },
      class: { 
        error: state.validationErrors.some(e => e.field === 'email') 
      }
    }),
    state.validationErrors
      .filter(e => e.field === 'email')
      .map(e => div(".error", e.message)),
    
    button(
      { 
        on: { click: action("Submit") },
        props: { disabled: state.submitting }
      },
      state.submitting ? "Submitting..." : "Submit"
    )
  ]);
}
```

### Project Structure Convention

A consistent project structure helps maintain organization as your application grows. Here's the recommended structure based on the example applications:

```
your-project/
├── index.html                 # Entry HTML with <div id="app"></div>
├── package.json
├── tsconfig.json
├── vitest.config.ts          # Testing configuration
└── src/
    ├── app.ts                # Root component (mounted to #app)
    ├── router.ts             # External I/O wiring (routing, etc.)
    │
    ├── components/           # Reusable components
    │   ├── button.ts
    │   ├── button.spec.ts
    │   ├── notification.ts
    │   └── notification.spec.ts
    │
    ├── pages/                # Page-level components
    │   ├── homePage.ts
    │   ├── homePage.spec.ts
    │   ├── aboutPage.ts
    │   └── aboutPage.spec.ts
    │
    ├── services/             # I/O functions (API, storage, etc.)
    │   ├── api.ts
    │   ├── api.spec.ts
    │   ├── storage.ts
    │   └── browser.ts
    │
    ├── types/                # Shared TypeScript types
    │   └── models.ts
    │
    └── css/                  # Styles
        └── main.css
```

**File naming conventions:**
- `*.ts` - Component or service implementation
- `*.spec.ts` - Unit tests
- Use camelCase for file names: `userProfile.ts`, not `user-profile.ts`
- Export components as default: `export default component<Component>(...)`

**Component structure (app.ts):**

```typescript
import { component, html, Config, VNode, Next, Task } from "jetix";
import homePage from "./pages/homePage";
import aboutPage from "./pages/aboutPage";
const { div } = html;

// 1. Export types for use by child components
export type RootProps = Readonly<{
  // ...
}>;

export type RootState = Readonly<{
  // ...
}>;

export type RootActions = Readonly<{
  // ...
}>;

export type RootTasks = Readonly<{
  // ...
}>;

// 2. Define Component type
type Component = {
  Props: RootProps;
  State: RootState;
  Actions: RootActions;
  Tasks: RootTasks;
};

// 3. Create and export component
export default component<Component>(
  ({ action, task }): Config<Component> => ({
    state: (): RootState => ({ /* ... */ }),
    init: action("Initialize"),
    actions: { /* ... */ },
    tasks: { /* ... */ },
    view(id, { state }): VNode { /* ... */ }
  })
);
```

**Router structure (router.ts):**

```typescript
import { mount, subscribe, RunAction } from "jetix";
import Navigo from "navigo";
import app, { RootActions, RootProps } from "./app";

const router = new Navigo("/");

document.addEventListener("DOMContentLoaded", (): void => {
  mount<RootActions, RootProps>({
    app,
    props: {},
    init: (runRootAction: RunAction<RootActions>): void => {
      // Wire up routing
      router.on({
        home: () => runRootAction("SetPage", { page: "home" }),
        about: () => runRootAction("SetPage", { page: "about" })
      }).resolve();
      
      // Wire up other external events
      window.addEventListener("online", () => 
        runRootAction("SetOnlineStatus", { online: true })
      );
      
      // Subscribe to patch events for router updates
      subscribe("patch", (): void => {
        router.updatePageLinks();
      });
    }
  });
});
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