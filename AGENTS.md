# AGENTS.md - pure-ui-actions Development Guide for AI Agents

## Framework Overview

**pure-ui-actions** is a TypeScript framework implementing Elm Architecture:

- **Actions are pure functions**: State transformations only, no I/O
- **Tasks contain side effects**: All I/O, async, browser APIs
- **Unidirectional data flow**: Actions → state updates → view rendering
- **Testable without mocks**: Test helpers return data instead of thunks
- **Immutable state**: Props/state frozen, use spread operators
- **Virtual DOM**: Snabbdom for efficient updates

## Core Architecture

### Actions (Pure Functions)

**CRITICAL**: Actions are pure, synchronous, no I/O. Return new state and optional `next` actions/tasks.

```typescript
actions: {
  Increment: ({ step }, { state }): { state: State; next: Next } => ({
    state: { ...state, count: state.count + step },
    next: action("Validate")
  }),

  NoNext: ({ value }, { state }): { state: State } => ({
    state: { ...state, value }
  })
}
```

### Tasks (Side Effects)

**ONLY place for**: API calls, browser APIs, localStorage, timers, logging, DOM mutations.

```typescript
tasks: {
  // Async with success/failure
  FetchUser: ({ id }): Task<User, Props, State, RootState> => ({
    perform: () => fetch(`/api/users/${id}`).then((r) => r.json()),
    success: (user) => action("UserLoaded", { user }),
    failure: (error: Error) => action("LoadFailed", { error: error.message })
  }),

  // Effect-only (sync)
  SetDocTitle: ({ title }): Task<void, Props, State, RootState> => ({
    perform: (): void => {
      document.title = title;
    }
  })
}
```

### External I/O Wiring

Connect external events to root actions in `mount()` init callback:

```typescript
mount({
  app,
  props: {},
  init: (runRootAction) => {
    // Router
    router
      .on({
        about: () => runRootAction("SetPage", { page: "about" }),
        home: () => runRootAction("SetPage", { page: "home" })
      })
      .resolve();

    // Browser events
    window.addEventListener("online", () => runRootAction("SetOnlineStatus", { online: true }));

    // VDOM patch events (update third-party libs)
    subscribe("patch", () => router.updatePageLinks());
  }
});
```

### Framework Events (Pub/Sub)

**Built-in**: `"patch"` fires after every VDOM patch.

**Custom events**: For cross-cutting concerns (analytics, logging). Use sparingly—prefer props/actions for component communication.

```typescript
// Publish
tasks: {
  UserLoggedIn: ({ user }): Task<AuthResult, Props, State, RootState> => ({
    perform: async () => {
      const result = await authenticateUser(user);
      publish("user:login", { userId: result.id });
      return result;
    },
    success: (result) => action("LoginSuccess", result)
  });
}

// Subscribe
subscribe("user:login", (event) => analytics.track("login", event.detail.userId));

// Cleanup
unsubscribe("user:login", handler);
```

## Anti-Patterns

### ❌ Side effects in actions → ✅ Tasks

```typescript
// WRONG
actions: {
  SaveData: ({ data }, { state }): { state: State } => {
    localStorage.setItem("data", JSON.stringify(data)); // WRONG
    return { state: { ...state, saved: true } };
  }
}

// CORRECT
actions: {
  SaveData: ({ data }, { state }): { state: State; next: Next } => ({
    state: { ...state, data },
    next: task("PersistData", { data })
  })
},
tasks: {
  PersistData: ({ data }): Task<Response, Props, State, RootState> => ({
    perform: () => {
      localStorage.setItem('data', JSON.stringify(data));
      return fetch('/api/save', { method: 'POST', body: JSON.stringify(data) });
    },
    success: () => action("DataSaved"),
    failure: (error) => action("SaveFailed", { error: error.message })
  })
}
```

### ❌ State mutation → ✅ Immutable updates

```typescript
// WRONG - throws due to deepFreeze
state.items.push(item);

// CORRECT
state: { ...state, items: [...state.items, item] }
```

### ❌ Async actions → ✅ Tasks

```typescript
// WRONG
actions: {
  LoadUser: async ({ id }, { state }) => { /* ... */ }
}

// CORRECT
actions: {
  LoadUser: ({ id }, { state }): { state: State; next: Next } => ({
    state: { ...state, loading: true },
    next: task("FetchUser", { id })
  })
},
tasks: {
  FetchUser: ({ id }): Task<User, Props, State, RootState> => ({
    perform: () => fetch(`/api/users/${id}`).then(r => r.json()),
    success: (user) => action("UserLoaded", { user })
  })
}
```

## TypeScript Types

### Component Type Structure

```typescript
export type Component = {
  Props: Props; // or null if no props
  State: State; // or null if stateless
  ActionPayloads: ActionPayloads;
  TaskPayloads: TaskPayloads; // optional if no tasks
  RootState: RootState; // optional - for child components
  RootActionPayloads: RootActionPayloads; // optional
  RootTaskPayloads: RootTaskPayloads; // optional
};
```

### Type Patterns

```typescript
// Props/State - always Readonly
export type Props = Readonly<{ title: string; count: number }>;
export type State = Readonly<{ items: string[]; selected: boolean }>;

// Empty props
export type Props = Readonly<Record<string, never>>;

// ActionPayloads - map action names to payload types
export type ActionPayloads = Readonly<{
  ShowMessage: { text: string };
  Reset: null; // No payload
}>;

// TaskPayloads
export type TaskPayloads = Readonly<{
  FetchData: { id: string };
}>;

// Stateless component
export type Component = {
  Props: Props;
  State: null;
  ActionPayloads: ActionPayloads;
};
```

### Function Signatures (TypeScript Strict Mode)

```typescript
// State initializer
state: (props: Props): State => ({
  count: props.initialCount
})

// Action with next
actions: {
  Increment: ({ step }, { state }): { state: State; next: Next } => ({
    state: { ...state, count: state.count + step },
    next: action("Validate")
  })
}

// Action without next
actions: {
  Reset: (_, { state }): { state: State } => ({
    state: { ...state, count: 0 }
  })
}

// Stateless action
actions: {
  DoSomething: (_, { props }): { state: null; next: Next } => ({
    state: null,
    next: rootAction("Something", { data: props.value })
  })
}

// Task
tasks: {
  FetchData: ({ id }): Task<Data, Props, State, RootState> => ({
    perform: () => fetch(`/api/${id}`).then((r) => r.json()),
    success: (data) => action("DataLoaded", { data }),
    failure: (error: Error) => action("DataFailed", { error: error.message })
  })
}

// View
view(id: string, { props, state }: Context<Props, State, RootState>): VNode {
  return div(`#${id}`, state.count.toString());
}
```

### Context Object

```typescript
type Context<TProps, TState, TRootState> = {
  props: TProps; // Always defined (defaults to {})
  state: TState; // Always defined (defaults to {})
  rootState: TRootState; // Always defined (defaults to {})
  event?: Event; // Optional - only in actions from DOM events
};
```

**Key points**:

- `props`, `state`, `rootState` are **non-optional** (strict mode compatible)
- `event` only available in actions triggered by DOM events (not in `next`)
- Task success/failure callbacks receive context without `event`

```typescript
actions: {
  HandleInput: (_, { state, event }): { state: State } => {
    const value = (event?.target as HTMLInputElement)?.value ?? "";
    return { state: { ...state, inputValue: value } };
  },

  HandleSubmit: (_, { state, event }): { state: State; next: Next } => {
    event?.preventDefault();
    return {
      state,
      next: task("SubmitForm", { data: state.formData })
    };
  }
},

tasks: {
  FetchData: ({ id }): Task<Data, Props, State, RootState> => ({
    perform: () => fetch(`/api/${id}`).then((r) => r.json()),
    // Context available in callbacks: props, state, rootState (no event)
    success: (data, { rootState }) => {
      if (rootState.theme === "dark") {
        return action("DataLoadedDark", { data });
      }
      return action("DataLoaded", { data });
    }
  })
}
```

## Immutability Patterns

```typescript
// Object update
{ ...state, count: state.count + 1 }

// Nested object
{
  ...state,
  likes: {
    ...state.likes,
    [page]: state.likes[page] + 1
  }
}

// Same-state optimization (prevents re-render)
theme === state.theme ? state : { ...state, theme }

// Array add
{ ...state, items: [...state.items, newItem] }

// Array remove
{ ...state, items: state.items.filter((_, i) => i !== index) }

// Array update
{ ...state, items: state.items.map((item, i) => i === index ? updatedItem : item) }
```

## State Management

### Local vs Root State

**CRITICAL**: Prefer local state. Root state changes re-render **all** components accessing `rootState`.

**Local state**: Form inputs, UI toggles, component-specific data, frequent updates
**Root state**: Auth, theme, truly global data shared across unrelated components

```typescript
// BAD
type RootState = Readonly<{
  theme: string;
  inputValue: string; // ❌ Component-specific
  buttonClicked: boolean; // ❌ Component-specific
}>;

// GOOD
type RootState = Readonly<{
  theme: string; // ✅ Truly global
}>;

type ComponentState = Readonly<{
  inputValue: string; // ✅ Local
  buttonClicked: boolean; // ✅ Local
}>;
```

### State Lifting Pattern

For shared sibling state, **lift to nearest common parent**, NOT root state.

```typescript
// Parent holds shared state
type ParentState = Readonly<{ selectedUserId: string }>;

export default component<ParentComponent>(({ action }) => ({
  state: (): ParentState => ({ selectedUserId: null }),

  actions: {
    SelectUser: ({ userId }, { state }): { state: ParentState } => ({
      state: { ...state, selectedUserId: userId }
    })
  },

  view(id, { state }): VNode {
    return div(`#${id}`, [
      userList(`#${id}-list`, { onSelect: action("SelectUser") }),
      userDetail(`#${id}-detail`, { userId: state.selectedUserId })
    ]);
  }
}));
```

### Action Callback Pattern

Pass action thunks as props for child-to-parent communication.

```typescript
// Child
export type ChildProps = Readonly<{
  value: string;
  onChange: ActionThunk;
}>;

// Child component
actions: {
  HandleInput: (_, { props, event }): { state: null; next: Next } => ({
    state: null,
    next: props.onChange({ value: (event?.target as HTMLInputElement)?.value })
  })
}

// Parent passes action as prop
view(id, { state }): VNode {
  return childInput(`#${id}-input`, {
    value: state.inputValue,
    onChange: action("UpdateInput")
  });
}
```

### State Location Guide

| State Type                      | Location | Why                              |
| ------------------------------- | -------- | -------------------------------- |
| Form inputs, UI toggles         | Local    | High frequency, single component |
| Selected item (shared siblings) | Parent   | Lift to common ancestor          |
| Theme, auth, feature flags      | Root     | Cross-cutting, many components   |

## Component Composition

### Parent-Child Communication

```typescript
// Child receives callback prop
export type Props = Readonly<{
  text: string;
  onDismiss: ActionThunk;
}>;

export default component<Component>(({ action }) => ({
  actions: {
    Dismiss: (_, { props, state }): { state: State; next: Next } => ({
      state: { ...state, show: false },
      next: props.onDismiss  // Invoke parent action
    })
  },
  view(id, { props }): VNode {
    return div(`#${id}`, [props.text, button({ on: { click: action("Dismiss") } }, "Dismiss")]);
  }
}));

// Parent passes action down
view(id, { state }): VNode {
  return notification(`#${id}-feedback`, {
    text: state.feedback,
    onDismiss: action("SetFeedback", { text: "" })
  });
}
```

### Root Actions and Tasks

Root app exports `RootState`, `RootActionPayloads`, `RootTaskPayloads` for truly global concerns (theme, auth). Child components import these types.

```typescript
// app.ts - Root component
export type RootState = Readonly<{
  theme: string;
  likes: Record<string, number>;
}>;

export type RootActionPayloads = Readonly<{
  SetTheme: { theme: string };
  Like: { page: string };
}>;

export type RootTaskPayloads = Readonly<{
  SetDocTitle: { title: string };
}>;

export type Component = {
  Props: null;
  State: RootState;
  ActionPayloads: RootActionPayloads;
  TaskPayloads: RootTaskPayloads;
};

export default component<Component>(({ action, task }) => ({
  state: (): RootState => ({
    theme: "light",
    likes: { home: 0, about: 0 }
  }),

  actions: {
    Like: ({ page }, { state }): { state: RootState; next: Next } => ({
      state: {
        ...state,
        likes: { ...state.likes, [page]: state.likes[page] + 1 }
      },
      next: task("SetDocTitle", { title: `Liked ${page}!` })
    })
  },

  tasks: {
    SetDocTitle: ({ title }): Task<void, null, RootState, unknown> => ({
      perform: (): void => {
        document.title = title;
      }
    })
  },

  view(id, { state }): VNode {
    return div(`#${id}.${state.theme}`, [likeButton(`#${id}-like-home`, { page: "home" })]);
  }
}));

// likeButton.ts - Child component
import { RootState, RootActionPayloads, RootTaskPayloads } from "../app";

type Component = {
  Props: Props;
  State: null;
  ActionPayloads: ActionPayloads;
  RootState: RootState;
  RootActionPayloads: RootActionPayloads;
  RootTaskPayloads: RootTaskPayloads;
};

export default component<Component>(({ action, rootAction, rootTask }) => ({
  actions: {
    Like: (_, { props }): { state: null; next: Next } => ({
      state: null,
      next: [rootAction("Like", { page: props.page }), rootTask("SetDocTitle", { title: "Liked!" })]
    })
  },

  view: (id, { props, rootState }): VNode =>
    button({ on: { click: action("Like") } }, `👍 ${rootState.likes[props.page]}`)
}));
```

**Note**: Changes to `rootState` re-render ALL components accessing it. Use sparingly.

## Task Patterns

```typescript
// Effect-only (sync)
tasks: {
  SetDocTitle: ({ title }): Task<void, Props, State, RootState> => ({
    perform: (): void => {
      document.title = title;
    }
  });
}

// Async with success/failure
tasks: {
  FetchData: ({ id }): Task<Data, Props, State, RootState> => ({
    perform: () => fetch(`/api/${id}`).then((r) => r.json()),
    success: (data, { props, state, rootState }) => action("DataLoaded", { data }),
    failure: (error: Error) => action("DataFailed", { error: error.message })
  });
}

// Conditional next based on result
tasks: {
  ValidateInput: ({ value }): Task<ValidationResult, Props, State, RootState> => ({
    perform: () => validateAsync(value),
    success: (result) =>
      result.valid
        ? action("ValidationPassed")
        : action("ValidationFailed", { errors: result.errors })
  });
}

// Multiple next actions
tasks: {
  Initialize: (): Task<AppData, Props, State, RootState> => ({
    perform: () => loadAppData(),
    success: (data) => [
      action("SetData", data),
      action("LoadComplete"),
      task("TrackAnalytics", { event: "app_loaded" })
    ]
  });
}
```

## Service Functions

Extract I/O operations into service functions. Call from task `perform`.

```typescript
// src/services/api.ts
export async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error(`Failed to fetch user: ${response.statusText}`);
  return response.json();
}

// src/services/browser.ts
export function setDocTitle(title: string): void {
  document.title = title;
}

// Use in tasks
import { fetchUser } from "./services/api";

tasks: {
  FetchUser: ({ id }): Task<User, Props, State, RootState> => ({
    perform: () => fetchUser(id),
    success: (user) => action("UserLoaded", { user }),
    failure: (error) => action("LoadFailed", { error: error.message })
  });
}
```

## Error Handling

```typescript
// Loading/error/data states
type State = Readonly<{
  user: User | null;
  loading: boolean;
  error: string | null;
}>;

actions: {
  LoadUser: ({ id }, { state }): { state: State; next: Next } => ({
    state: { ...state, loading: true, error: null },
    next: task("FetchUser", { id })
  }),
  UserLoaded: ({ user }, { state }): { state: State } => ({
    state: { ...state, user, loading: false, error: null }
  }),
  LoadFailed: ({ error }, { state }): { state: State } => ({
    state: { ...state, loading: false, error }
  })
}

// Retry logic
actions: {
  LoadFailed: ({ error }, { state }): { state: State; next?: Next } => {
    const shouldRetry = state.retryCount < state.maxRetries;
    return {
      state: {
        ...state,
        retryCount: state.retryCount + 1,
        error: shouldRetry ? null : error
      },
      next: shouldRetry ? task("FetchData", {}) : undefined
    };
  }
}
```

## Testing

Use `componentTest` to test component logic without mocks. Returns plain data instead of thunks.

```typescript
import { componentTest, NextData } from "pure-ui-actions";
import app, { State, Component } from "./app";

describe("App", () => {
  const { actionTest, taskTest, config, initialState } = componentTest<Component>(app, {
    date: "Test Date"
  });

  it("initial state", () => {
    expect(initialState).toEqual({ title: "Welcome! Test Date", text: "", done: false });
  });

  it("init action", () => {
    expect(config.init).toEqual({ name: "ShowMessage", data: { text: "Hello World!" } });
  });

  describe("ShowMessage action", () => {
    const { state, next } = actionTest<State>("ShowMessage", { text: "Test" });

    it("updates state", () => {
      expect(state).toEqual({ ...initialState, text: "Test" });
    });

    it("returns next", () => {
      const { name, data } = next as NextData;
      expect(name).toBe("SetDocTitle");
      expect(data).toEqual({ title: "Test" });
    });
  });

  describe("SetDocTitle task", () => {
    const { perform, success } = taskTest("SetDocTitle", { title: "test" });

    it("provides perform", () => {
      expect(perform).toBeDefined();
    });

    it("handles success", () => {
      const { name, data } = success?.() as NextData;
      expect(name).toBe("PageReady");
      expect(data).toEqual({ done: true });
    });
  });
});

// Custom context (state, rootState, event)
const { state } = actionTest<State>(
  "ProcessData",
  { value: 10 },
  { state: { count: 5, data: [] } }
);

// Mock event
const { state: eventState } = actionTest<State>(
  "HandleInput",
  {},
  {
    state: initialState,
    event: { target: { value: "input text" } } as unknown as Event
  }
);
```

**Key concept**: Runtime returns thunks (executable), tests return data (inspectable). Actions don't know the difference—they're pure.

## Project Structure

```
your-project/
├── src/
│   ├── app.ts                # Root component (exports RootState, RootActionPayloads, RootTaskPayloads)
│   ├── router.ts             # External I/O wiring (routing, browser events)
│   ├── components/           # Reusable components
│   │   ├── button.ts
│   │   └── button.spec.ts
│   ├── pages/                # Page components
│   ├── services/             # I/O functions (api.ts, storage.ts, browser.ts)
│   └── css/
├── index.html
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Component File Structure

```typescript
import { component, html, VNode, Next, Task } from "pure-ui-actions";
const { div } = html;

// Export types
export type RootProps = Readonly<{
  /* ... */
}>;
export type RootState = Readonly<{
  /* ... */
}>;
export type RootActionPayloads = Readonly<{
  /* ... */
}>;
export type RootTaskPayloads = Readonly<{
  /* ... */
}>;

export type Component = {
  Props: RootProps;
  State: RootState;
  ActionPayloads: RootActionPayloads;
  TaskPayloads: RootTaskPayloads;
};

export default component<Component>(({ action, task }) => ({
  state: (): RootState => ({
    /* ... */
  }),
  init: action("Initialize"),
  actions: {
    /* ... */
  },
  tasks: {
    /* ... */
  },
  view(id, { state }): VNode {
    /* ... */
  }
}));
```

### Router File

```typescript
import { mount, subscribe } from "pure-ui-actions";
import app, { RootActionPayloads, RootProps } from "./app";

document.addEventListener("DOMContentLoaded", () => {
  mount<RootActionPayloads, RootProps>({
    app,
    props: {},
    init: (runRootAction) => {
      router
        .on({
          home: () => runRootAction("SetPage", { page: "home" }),
          about: () => runRootAction("SetPage", { page: "about" })
        })
        .resolve();

      subscribe("patch", () => router.updatePageLinks());
    }
  });
});
```

## Component Lifecycle

**Initial render**: `state(props)` → `init` action/task → `view()` → VDOM patch

**Re-render**: State/props change → `view()` → VDOM patch (only changed elements)

**Optimization**:

- Action thunks memoized by params: `action("Click", { id: 1 })` returns same reference
- Same state reference = no re-render: `state: value === state.value ? state : { ...state, value }`

## View Rendering

```typescript
import { component, html, withKey } from "pure-ui-actions";
const { div, button, ul, li } = html;

view(id, { state }): VNode {
  return div(`#${id}.container.active`, [
    // Event handler
    button({ on: { click: action("Submit") } }, "Submit"),

    // Attributes
    input({ props: { value: state.text, type: "text" } }),

    // List with keys (for efficient updates when reordering/removing)
    ul(state.items.map(item => withKey(item.id, li(item.name))))
  ]);
}
```

### Component Memoization

**CRITICAL**: Only `memo` components that **DO NOT access `rootState`**. Memoized components won't see rootState changes.

```typescript
import { memo } from "pure-ui-actions";

// Component uses only props - safe to memoize
const listComponent = (id, { items }) =>
  div(`#${id}`, ul(items.map(item => li(item.name))));

view(id, { state }): VNode {
  return div(`#${id}`, [
    // Re-renders only when items change
    memo(`#${id}-list`, listComponent, { items: state.items }, state.items)
  ]);
}

// If component needs rootState, DON'T memoize or pass as explicit prop:
memo(
  `#${id}-list`,
  themedList,
  { items: state.items, theme: rootState.theme },
  { items: state.items, theme: rootState.theme }  // Include ALL dependencies in key
)
```

Use `memo` for expensive components with frequent parent re-renders. Prefer local state to avoid needing it.

## Advanced Patterns

### VDOM Lifecycle Hooks

For third-party library integration. Use `setHook` to hook into Snabbdom lifecycle.

```typescript
import { setHook } from "pure-ui-actions";

view(id, { state }): VNode {
  const vnode = div(`#${id}`, "Content");

  setHook(vnode, "insert", () => {
    // Element inserted into DOM
    initializeChartLibrary(id);
  });

  setHook(vnode, "destroy", () => {
    // Element removed from DOM - cleanup
    cleanupChartLibrary(id);
  });

  return vnode;
}
```

**Available hooks**: `init`, `create`, `insert`, `prepatch`, `update`, `postpatch`, `destroy`, `remove`

**Use only for**: Third-party lib integration, imperative DOM ops, resource cleanup. Most apps don't need this.

## Debugging

**Redux DevTools** automatically integrates (browser extension):

- Action history with payloads: `counter/Increment { step: 1 }`
- State tree: `{ app: {...}, counter: {...} }`
- State diffs for each action
- Task tracking: `counter/[Task] FetchData/success`
- Export/import sessions

Limitations: Time travel disabled, read-only monitoring

**Framework enforces**:

- State mutations throw (deepFreeze)
- Manual thunk calls log errors
- Actions must be synchronous

## Key Rules

1. **Actions are pure** - No I/O, no side effects, no async
2. **Tasks contain all side effects** - API calls, browser APIs, logging
3. **State is immutable** - Use spread operators
4. **Types are Readonly** - Props and State must be `Readonly<...>`
5. **Prefer local state** - Root state re-renders ALL components accessing it
6. **Don't memo components with rootState** - They won't see changes
7. **External events in mount init** - Wire routing/browser events there
8. **Service functions for I/O** - Extract reusable I/O to services/
9. **Test with componentTest** - Export Component type for type inference
10. **Use withKey for lists** - Enable efficient VDOM updates when reordering
11. **Context in actions** - `props`, `state`, `rootState` non-optional; `event` optional
12. **TypeScript strict mode** - Add return types: `{ state: State; next: Next }`, `Task<Result, Props, State, RootState>`, `VNode`

## TypeScript Strict Mode

Fully compatible with `"strict": true`. Add explicit return types:

```typescript
// Action
({ step }, { state }): { state: State; next: Next } => ({ ... })
({ step }, { state }): { state: State } => ({ ... })

// Task
({ id }): Task<User, Props, State, RootState> => ({ ... })

// View
(id, { state }): VNode => div(`#${id}`, ...)

// State initializer
(props): State => ({ ... })
```

**Context**: `props`, `state`, `rootState` non-optional (no `?.` needed). Only `event` optional.

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "lib": ["dom", "es2022"],
    "target": "es2022",
    "module": "esnext"
  }
}
```
