# AGENTS.md - pure-ui-actions Development Guide for AI Agents

## Purpose
This document provides comprehensive guidance for AI agents working with the pure-ui-actions framework. It contains architectural patterns, best practices, testing conventions, and code organization principles.

## Framework Overview

**pure-ui-actions** is a TypeScript component framework based on the Elm Architecture pattern with the following characteristics:

- **Pure functional architecture**: Actions are pure functions, effects are isolated in Tasks
- **Unidirectional data flow**: State changes flow through actions → state updates → view rendering
- **Deferred effects**: Actions return effect thunks; framework controls execution timing
- **Testable without mocks**: Test helpers substitute thunks with plain data for testing
- **Type-safe**: High TypeScript coverage with strongly typed components
- **Virtual DOM**: Uses Snabbdom for efficient DOM updates
- **Immutable state**: Props and state are frozen to prevent mutations

## Core Architecture Principles

### 1. Separation of Pure Logic and Side Effects

**CRITICAL RULE**: Actions must be pure functions. All I/O and side effects must be in Tasks.

#### Actions (Pure Functions)
- Transform state based on input
- Return new state and optional Next actions/tasks
- No I/O, no mutations, no side effects
- Synchronous only
- Testable without mocks

**Example - Pure action:**
```typescript
actions: {
  Increment: ({ step }, { state }): { state: State; next: Next } => {
    return {
      state: { ...state, count: state.count + step },
      next: action("Validate")
    };
  }
}
```

#### Tasks (Side Effects Container)
Tasks are the ONLY place for:
- API calls and network requests
- Browser APIs (localStorage, sessionStorage, document.title)
- DOM mutations (except view rendering)
- Timers (setTimeout, setInterval)
- Logging and analytics
- Any operation affecting the outside world

**Example - Task with async operation:**
```typescript
tasks: {
  FetchUser: ({ id }) => ({
    perform: (): Promise<User> => fetch(`/api/users/${id}`).then(r => r.json()),
    success: (user: User): Next => action("UserLoaded", { user }),
    failure: (error: Error): Next => action("UserLoadFailed", { error: error.message })
  })
}
```

**Example - Effect-only task (synchronous):**
```typescript
tasks: {
  SetDocTitle: ({ title }) => ({
    perform: (): void => {
      document.title = title;
    }
  })
}
```

### 2. External I/O Wiring

Use `mount()` with `init` callback to connect external events to root actions:

```typescript
mount({
  app,
  props: {},
  init: (runRootAction) => {
    // Router integration
    router.on({ 
      about: () => runRootAction("SetPage", { page: "about" }),
      home: () => runRootAction("SetPage", { page: "home" })
    }).resolve();
    
    // Browser events
    window.addEventListener("online", () => 
      runRootAction("SetOnlineStatus", { online: true })
    );
    
    // Subscribe to framework events
    subscribe("patch", () => {
      router.updatePageLinks();
    });
  }
});
```

### 3. Framework Events (Pub/Sub)

pure-ui-actions provides a pub/sub system for reacting to lifecycle events and creating custom application events.

#### Built-in Events

**`"patch"` event** - Fires after every VDOM patch (DOM update)

```typescript
import { subscribe } from "pure-ui-actions";

subscribe("patch", () => {
  // React to DOM updates
  // Common use: Update third-party libraries that need to know about DOM changes
  router.updatePageLinks();
  updateCustomScrollbars();
  highlightCodeBlocks();
});
```

#### Custom Events

Publish custom application events for cross-cutting concerns:

```typescript
import { publish, subscribe } from "pure-ui-actions";

// In a task - publish an event
tasks: {
  UserLoggedIn: ({ user }) => ({
    perform: async () => {
      const result = await authenticateUser(user);
      publish("user:login", { userId: result.id });
      return result;
    },
    success: (result) => action("LoginSuccess", result)
  })
}

// Elsewhere in your app - subscribe to events
mount({
  app,
  props: {},
  init: (runRootAction) => {
    subscribe("user:login", (event) => {
      const { userId } = event.detail;
      analytics.track("login", userId);
    });
  }
});
```

#### Cleanup

Always clean up subscriptions when they're no longer needed:

```typescript
import { subscribe, unsubscribe } from "pure-ui-actions";

const handler = () => { /* ... */ };
subscribe("patch", handler);

// Later, clean up
unsubscribe("patch", handler);
```

**Best Practice:** Use framework events sparingly. Most component-to-component communication should use props and actions. Use pub/sub for:
- Integration with third-party libraries
- Cross-cutting concerns (analytics, logging)
- Reacting to framework lifecycle events

## Anti-Patterns and Common Mistakes

### ❌ WRONG: Side effects in actions
```typescript
actions: {
  SaveData: ({ data }, { state }) => {
    localStorage.setItem('data', JSON.stringify(data)); // WRONG
    fetch('/api/save', { method: 'POST', body: JSON.stringify(data) }); // WRONG
    document.title = 'Data Saved'; // WRONG
    return { state: { ...state, saved: true } };
  }
}
```

### ✅ CORRECT: Side effects in tasks
```typescript
actions: {
  SaveData: ({ data }, { state }) => ({
    state: { ...state, data },
    next: task("PersistData", { data })
  })
},
tasks: {
  PersistData: ({ data }) => ({
    perform: () => {
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

### ❌ WRONG: State mutation
```typescript
actions: {
  AddItem: ({ item }, { state }) => {
    state.items.push(item); // WRONG - Will throw due to deepFreeze
    return { state };
  }
}
```

### ✅ CORRECT: Immutable updates
```typescript
actions: {
  AddItem: ({ item }, { state }) => ({
    state: {
      ...state,
      items: [...state.items, item]
    }
  })
}
```

### ❌ WRONG: Manually calling action thunks
```typescript
const myAction = action("DoSomething", { value: 1 });
myAction(); // WRONG - Will log error
```

### ✅ CORRECT: Actions via DOM events or Next
```typescript
// In view
view(id, { state }): VNode {
  return button(
    { on: { click: action("DoSomething", { value: 1 }) } },
    "Click me"
  );
}

// In action
actions: {
  FirstAction: (_, { state }) => ({
    state,
    next: action("DoSomething", { value: 1 })
  })
}
```

### ❌ WRONG: Async operations in actions
```typescript
actions: {
  LoadUser: async ({ id }, { state }) => { // WRONG
    const user = await fetch(`/api/users/${id}`).then(r => r.json());
    return { state: { ...state, user } };
  }
}
```

### ✅ CORRECT: Async operations in tasks
```typescript
actions: {
  LoadUser: ({ id }, { state }) => ({
    state: { ...state, loading: true },
    next: task("FetchUser", { id })
  }),
  UserLoaded: ({ user }, { state }) => ({
    state: { ...state, user, loading: false }
  })
},
tasks: {
  FetchUser: ({ id }) => ({
    perform: () => fetch(`/api/users/${id}`).then(r => r.json()),
    success: (user) => action("UserLoaded", { user }),
    failure: (error) => action("LoadFailed", { error: error.message })
  })
}
```

## TypeScript Type Definitions

### Component Type Structure

All components must define a Component type with these fields:

```typescript
type Component = {
  Props: Props;          // Component props (or null if none)
  State: State;          // Component state (or null if stateless)
  Actions: Actions;      // Available actions (or empty object)
  Tasks: Tasks;          // Available tasks (or empty object)
  RootState: RootState;      // Optional - access to root state
  RootActions: RootActions;  // Optional - access to root actions
  RootTasks: RootTasks;      // Optional - access to root tasks
};
```

### Type Definition Patterns

**Props and State - Always Readonly:**
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

**Actions - Mapped payload types:**
```typescript
export type Actions = Readonly<{
  ShowMessage: { text: string };
  PageReady: { done: boolean };
  Reset: null;  // No payload
}>;
```

**Tasks - Mapped payload types:**
```typescript
export type Tasks = Readonly<{
  SetDocTitle: { title: string };
  FetchData: { id: string };
}>;
```

**Stateless Components:**
```typescript
type Component = {
  Props: Props;
  State: null;  // No local state
  Actions: Actions;
};

// Action handlers return null for state
actions: {
  DoSomething: (_, { props }): { state: null } => {
    return { state: null };
  }
}
```

### Function Signatures

**State initializer:**
```typescript
state: (props: Props): State => ({
  count: props.initialCount
})
```

**Action handler:**
```typescript
actions: {
  Increment: ({ step }, { state }): { state: State; next: Next } => {
    return {
      state: { ...state, count: state.count + step },
      next: action("Validate")
    };
  }
}
```

**Task handler:**
```typescript
tasks: {
  FetchData: ({ id }): Task<Data> => ({
    perform: (): Promise<Data> => fetch(`/api/${id}`).then(r => r.json()),
    success: (data: Data): Next => action("DataLoaded", { data }),
    failure: (error: Error): Next => action("DataFailed", { error: error.message })
  })
}
```

**View function:**
```typescript
view(id: string, { props, state }: Context<Props, State, null>): VNode {
  return div(`#${id}`, state.count.toString());
}
```

### Context Object

All action handlers, task callbacks, and view functions receive a `Context` object:

```typescript
export type Context<TProps, TState, TRootState> = {
  props?: TProps;         // Component's props
  state?: TState;         // Component's local state
  rootState?: TRootState; // Root application state
  event?: Event;          // DOM event (only in action handlers)
};
```

**When `event` is available:**
- Only in action handlers
- Only when triggered by a DOM event (click, input, submit, etc.)
- Not available in tasks or view functions
- Undefined when action is triggered programmatically via `next`

**Accessing DOM events in actions:**
```typescript
actions: {
  HandleInput: (_, { state, event }) => {
    // Access native DOM event
    const value = (event?.target as HTMLInputElement)?.value ?? "";
    return {
      state: { ...state, inputValue: value }
    };
  },
  
  HandleSubmit: (_, { state, event }) => {
    event?.preventDefault(); // Prevent form submission
    return {
      state,
      next: task("SubmitForm", { data: state.formData })
    };
  }
}
```

**Context in tasks:**
Task success and failure callbacks also receive context (without event):
```typescript
tasks: {
  FetchData: ({ id }) => ({
    perform: () => fetch(`/api/${id}`).then(r => r.json()),
    
    // Context available: props, state, rootState (no event)
    success: (data, { props, state, rootState }) => {
      // Can access current component state and rootState
      if (rootState.theme === "dark") {
        return action("DataLoadedDark", { data });
      }
      return action("DataLoaded", { data });
    },
    
    failure: (error, { state }) => {
      console.error("Failed with state:", state);
      return action("LoadFailed", { error: error.message });
    }
  })
}
```

## Immutability Patterns

### Object Updates

**Simple property update:**
```typescript
return {
  state: { ...state, count: state.count + 1 }
};
```

**Nested object update:**
```typescript
return {
  state: {
    ...state,
    likes: {
      ...state.likes,
      [page]: state.likes[page] + 1
    }
  }
};
```

**Conditional same-state optimization:**
```typescript
return {
  state: theme === state.theme ? state : {
    ...state,
    theme
  }
};
```

### Array Updates

**Add item:**
```typescript
return {
  state: {
    ...state,
    items: [...state.items, newItem]
  }
};
```

**Remove item:**
```typescript
return {
  state: {
    ...state,
    items: state.items.filter((_, i) => i !== index)
  }
};
```

**Update item:**
```typescript
return {
  state: {
    ...state,
    items: state.items.map((item, i) => 
      i === index ? updatedItem : item
    )
  }
};
```

## State Management Best Practices

### Local State vs Root State

**CRITICAL PERFORMANCE RULE**: Prefer local component state over root state whenever possible.

#### Why Local State is More Efficient

When a component's local state changes, **only that component re-renders**. When root state changes, **every component that accesses rootState will re-render**, even if they only read unrelated parts of the root state.

```typescript
// BAD: Using rootState for component-local concerns
type RootState = Readonly<{
  theme: string;
  inputValue: string;  // ❌ Component-specific state in root
  buttonClicked: boolean;  // ❌ Component-specific state in root
}>;

// GOOD: Component-local state stays local
type RootState = Readonly<{
  theme: string;  // ✅ Truly global concern
}>;

type ComponentState = Readonly<{
  inputValue: string;  // ✅ Local to this component
  buttonClicked: boolean;  // ✅ Local to this component
}>;
```

#### State Location Decision Tree

**Use Local State when:**
- Only one component needs the data
- Data is ephemeral (form inputs, UI toggles, animation state)
- Frequent updates that don't affect other components
- Component-specific UI state (expanded/collapsed, selected tabs)

**Use Root State when:**
- Multiple unrelated components need the same data
- Data persists across navigation (user auth, theme, global settings)
- Data is truly application-wide
- Cross-cutting concerns (feature flags, API tokens)

#### State Lifting Pattern

When multiple components need to share state, **lift state to the nearest common parent** and pass actions down as props. Do NOT use root state for this.

**❌ WRONG: Using root state for shared sibling state**
```typescript
// Inefficient - changes trigger re-renders in ALL components using rootState
export type RootState = Readonly<{
  theme: string;
  selectedUserId: string;  // ❌ Only needed by UserList and UserDetail
}>;
```

**✅ CORRECT: Lift state to common parent**
```typescript
// Parent component holds shared state
type ParentState = Readonly<{
  selectedUserId: string;  // ✅ Scoped to this component tree
}>;

export default component<ParentComponent>(
  ({ action }): Config<ParentComponent> => ({
    state: (): ParentState => ({
      selectedUserId: null
    }),
    
    actions: {
      SelectUser: ({ userId }, { state }) => ({
        state: { ...state, selectedUserId: userId }
      })
    },
    
    view(id, { state }): VNode {
      return div(`#${id}`, [
        // Pass action down to child
        userList(`#${id}-list`, {
          onSelect: action("SelectUser")
        }),
        // Pass state as prop to child
        userDetail(`#${id}-detail`, {
          userId: state.selectedUserId
        })
      ]);
    }
  })
);
```

#### Action Callback Pattern

Pass action thunks as props to enable child-to-parent communication without root state.

```typescript
// Child component
export type ChildProps = Readonly<{
  value: string;
  onChange: ActionThunk;  // Action from parent
}>;

export default component<ChildComponent>(
  ({ action }): Config<ChildComponent> => ({
    actions: {
      HandleInput: (_, { props, event }) => ({
        state: null,
        // Invoke parent's action
        next: props.onChange({ value: event.target.value })
      })
    },
    
    view(id, { props }): VNode {
      return input({
        props: { value: props.value },
        on: { input: action("HandleInput") }
      });
    }
  })
);

// Parent component
export default component<ParentComponent>(
  ({ action }): Config<ParentComponent> => ({
    state: (): ParentState => ({
      inputValue: ""
    }),
    
    actions: {
      UpdateInput: ({ value }, { state }) => ({
        state: { ...state, inputValue: value }
      })
    },
    
    view(id, { state }): VNode {
      return div(`#${id}`, [
        // Pass action down as callback prop
        childInput(`#${id}-input`, {
          value: state.inputValue,
          onChange: action("UpdateInput")
        })
      ]);
    }
  })
);
```

#### Root State Performance Impact Example

```typescript
// Scenario: App with theme setting and 50 components

// BAD: All 50 components access rootState
type RootState = Readonly<{
  theme: string;
  user: User;
  notifications: Notification[];
  // ... more global state
}>;

// When theme changes:
// ❌ ALL 50 components re-render (even those not using theme)
// ❌ Every component's view function is called
// ❌ VDOM diff happens for all 50 components

// GOOD: Only components that need theme access it
// Most components use local state or props
// When theme changes:
// ✅ Only 5 components that use rootState.theme re-render
// ✅ Other 45 components are unaffected
// ✅ Minimal VDOM diffing
```

#### When Root State is Appropriate

```typescript
// Appropriate root state - truly global concerns
export type RootState = Readonly<{
  theme: "light" | "dark";           // UI theme (used by layout components)
  currentUser: User | null;          // Auth state (checked by multiple pages)
  isOnline: boolean;                 // Network status (affects many features)
  featureFlags: Record<string, boolean>;  // A/B tests (cross-cutting)
}>;

// Examples of what should NOT be in root state:
// - Form input values (local state)
// - Modal open/closed state (local state or lifted to page)
// - Selected list items (lifted to parent component)
// - Animation states (local state)
// - Component-specific loading indicators (local state)
```

#### Migration Strategy

If you have too much in root state, refactor using this priority:

1. **Most frequent updates** → Move to local state first (biggest perf win)
2. **Component-specific UI state** → Move to local state
3. **Shared between siblings** → Lift to nearest common parent
4. **Truly global** → Keep in root state

### Summary: State Location Rules

| State Type | Location | Reason |
|------------|----------|---------|
| Form input values | Local | High update frequency, single component |
| UI toggles (expanded/collapsed) | Local | Single component concern |
| Selected item in list | Local or Parent | Depends on if detail view is sibling |
| Active tab | Local | Component-specific UI state |
| Theme preference | Root | Affects multiple components globally |
| Current user / auth | Root | Required by many unrelated components |
| API loading state | Local | Unless multiple components need it |
| Error messages | Local | Unless global error handler needed |

**Golden Rule**: State lives at the lowest common ancestor that needs it. Root state is the highest ancestor, so it should be used sparingly.

## Component Composition

### Parent-Child Communication

**Child component with callback prop:**
```typescript
export type Props = Readonly<{
  text: string;
  onDismiss: ActionThunk;  // Parent action passed as prop
}>;

export default component<Component>(
  ({ action }): Config<Component> => ({
    actions: {
      Dismiss: (_, { props, state }) => ({
        state: { ...state, show: false },
        next: props.onDismiss  // Invoke parent action
      })
    },
    view(id, { props }) {
      return div(`#${id}`, [
        props.text,
        button({ on: { click: action("Dismiss") } }, "Dismiss")
      ]);
    }
  })
);
```

**Parent rendering child:**
```typescript
view(id, { state }): VNode {
  return div(`#${id}`, [
    notification(`#${id}-feedback`, {
      text: state.feedback,
      onDismiss: action("SetFeedback", { text: "" })
    })
  ]);
}
```

### Root Actions and Tasks

**Define root types in parent (app.ts):**
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

**Child component using root types:**
```typescript
import { RootState, RootActions, RootTasks } from "../app";

type Component = {
  Props: Props;
  State: null;
  Actions: Actions;
  RootState: RootState;
  RootActions: RootActions;
  RootTasks: RootTasks;
};

export default component<Component>(
  ({ action, rootAction, rootTask }): Config<Component> => ({
    actions: {
      Like: (_, { props }) => ({
        state: null,
        next: [
          rootAction("Like", { page: props.page }),
          rootTask("SetDocTitle", { title: "Liked!" })
        ]
      })
    },
    view: (id, { rootState }) =>
      button(
        { on: { click: action("Like") } },
        `👍${rootState.likes[props.page]}`
      )
  })
);
```

## Task Patterns

### Effect-Only Tasks
No success/failure handlers needed for synchronous side effects:

```typescript
tasks: {
  SetDocTitle: ({ title }) => ({
    perform: (): void => {
      document.title = title;
    }
  })
}
```

### Async Tasks with Success/Failure
```typescript
tasks: {
  FetchData: ({ id }) => ({
    perform: (): Promise<Data> => fetch(`/api/${id}`).then(r => r.json()),
    
    // Success and failure callbacks receive context
    success: (data: Data, { props, state, rootState }): Next => {
      return action("DataLoaded", { data });
    },
    
    failure: (error: Error, { props, state, rootState }): Next => {
      return action("DataFailed", { error: error.message });
    }
  })
}
```

### Conditional Next Based on Result
```typescript
tasks: {
  ValidateInput: ({ value }) => ({
    perform: (): Promise<ValidationResult> => validateAsync(value),
    success: (result: ValidationResult): Next => {
      if (result.valid) {
        return action("ValidationPassed");
      } else {
        return action("ValidationFailed", { errors: result.errors });
      }
    },
    failure: (error: Error): Next => action("ValidationError", { message: error.message })
  })
}
```

### Multiple Next Actions
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

## Service Functions Pattern

Service functions encapsulate I/O operations and are called from task `perform` functions.

### Service Organization

**src/services/api.ts:**
```typescript
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
```

**src/services/storage.ts:**
```typescript
export function saveToLocalStorage(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadFromLocalStorage<T>(key: string): T | null {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}
```

**src/services/browser.ts:**
```typescript
export async function setDocTitle(title: string): Promise<void> {
  document.title = title;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
```

### Using Services in Tasks
```typescript
import { fetchUser, saveUser } from "./services/api";
import { saveToLocalStorage } from "./services/storage";

tasks: {
  FetchUser: ({ id }) => ({
    perform: () => fetchUser(id),
    success: (user) => action("UserLoaded", { user }),
    failure: (error) => action("LoadFailed", { error: error.message })
  }),
  
  SaveUser: ({ user }) => ({
    perform: async () => {
      await saveUser(user);
      saveToLocalStorage('lastSaved', Date.now());
    },
    success: () => action("SaveComplete"),
    failure: (error) => action("SaveFailed", { error: error.message })
  })
}
```

## Error Handling Patterns

### Loading, Error, and Data States
```typescript
type State = Readonly<{
  user: User | null;
  loading: boolean;
  error: string | null;
}>;

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
  })
}
```

### Retry Logic
```typescript
type State = Readonly<{
  data: Data | null;
  retryCount: number;
  maxRetries: number;
  error: string | null;
}>;

actions: {
  LoadFailed: ({ error }, { state }) => {
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

### Validation Errors
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
  })
}
```

## Testing

### Testing Component Logic

Tests use `testComponent` to get pure data representations of actions and tasks:

```typescript
import { testComponent, NextData } from "pure-ui-actions";
import app, { State } from "./app";

describe("App", () => {
  const { testAction, testTask, config, initialState } = testComponent(app, { placeholder: "test" });

  it("should set initial state", () => {
    expect(initialState).toEqual({ text: "test", done: false });
  });

  it("should run initial action", () => {
    expect(config.init).toEqual({
      name: "ShowMessage",
      data: { text: "Hello World!" }
    });
  });

  describe("'ShowMessage' action", () => {
    const { state, next } = testAction<State>("ShowMessage", { text: "Test" });

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        text: "Test"
      });
    });

    it("should return next task", () => {
      const { name, data } = next as NextData;
      expect(name).toBe("SetDocTitle");
      expect(data).toEqual({ title: "Test" });
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
  });
});
```

### Testing Service Functions

Service functions are pure I/O and can be tested independently:

```typescript
import { fetchUser, saveUser } from "./api";

describe("API Service", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("should fetch user", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', name: 'Alice' })
    });

    const user = await fetchUser('1');
    expect(user).toEqual({ id: '1', name: 'Alice' });
  });

  it("should throw on fetch error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: 'Not Found'
    });

    await expect(fetchUser('1')).rejects.toThrow('Failed to fetch user');
  });
});
```

### Thunks vs Data: Runtime and Testing

Understanding the difference between runtime and test behavior is key to pure-ui-actions' architecture.

#### In Runtime:

Actions return **thunks** - executable functions with metadata:

```typescript
// Runtime behavior
const nextThunk = action("DoSomething", { value: 1 });

// Thunk structure:
{
  (input): void,              // Callable function
  type: ThunkType.Action,     // Metadata tag
  // ... other metadata
}
```

**Key points:**
- Framework controls when effects execute (not user code)
- Actions stay pure by returning thunks instead of executing them
- Thunks enable memoization and efficient re-renders
- User code never invokes `perform()` - only the framework does

#### In Tests:

`testComponent()` substitutes action/task creators to return **plain data**:

```typescript
// Test behavior with testComponent
const { testAction, testTask } = testComponent(app, props);

// testAction() and testTask() now return plain objects:
const { state, next } = testAction("DoSomething", { value: 1 });
// next = { name: "DoSomething", data: { value: 1 } }  // Plain data!
```

**Key points:**
- No mocks needed to test logic
- Inspect what effects would run without executing them
- Test pure transformations in isolation
- `testComponent` swaps thunk creators with `nextToData()` function

#### Why This Matters:

This substitution pattern is what enables testing without mocks. Actions are written to be pure - they don't know or care whether `action()` and `task()` return executable thunks or plain data. This allows the same action code to:

1. **Run normally** in the app (returns thunks, framework executes)
2. **Test easily** with `testComponent` (returns data, inspect without executing)

The decoupling of declaration (what effect to run) from execution (actually running it) is what makes pure-ui-actions testable and predictable.

## Project Structure

### Recommended Directory Layout
```
your-project/
├── index.html                 # Entry HTML with <div id="app"></div>
├── package.json
├── tsconfig.json
├── vitest.config.ts          # Testing configuration
└── src/
    ├── app.ts                # Root component (exports RootState, RootActions, RootTasks)
    ├── router.ts             # External I/O wiring (routing, browser events)
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
    ├── services/             # I/O functions (API, storage, browser)
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

### File Naming Conventions
- `*.ts` - Component or service implementation
- `*.spec.ts` - Unit tests (co-located with implementation)
- Use camelCase: `userProfile.ts`, not `user-profile.ts`
- Export components as default: `export default component<Component>(...)`
- Export types as named exports: `export type RootState = ...`

### Component File Structure (app.ts)
```typescript
import { component, html, Config, VNode, Next, Task } from "pure-ui-actions";
import homePage from "./pages/homePage";
import aboutPage from "./pages/aboutPage";
const { div } = html;

// 1. Export types for child components
export type RootProps = Readonly<{ /* ... */ }>;
export type RootState = Readonly<{ /* ... */ }>;
export type RootActions = Readonly<{ /* ... */ }>;
export type RootTasks = Readonly<{ /* ... */ }>;

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

### Router File Structure (router.ts)
```typescript
import { mount, subscribe, RunAction } from "pure-ui-actions";
import Navigo from "navigo";
import app, { RootActions, RootProps } from "./app";

const router = new Navigo("/");

document.addEventListener("DOMContentLoaded", (): void => {
  mount<RootActions, RootProps>({
    app,
    props: {},
    init: (runRootAction: RunAction<RootActions>): void => {
      // Wire routing
      router.on({
        home: () => runRootAction("SetPage", { page: "home" }),
        about: () => runRootAction("SetPage", { page: "about" })
      }).resolve();
      
      // Wire browser events
      window.addEventListener("online", () => 
        runRootAction("SetOnlineStatus", { online: true })
      );
      
      // Subscribe to patch events
      subscribe("patch", (): void => {
        router.updatePageLinks();
      });
    }
  });
});
```

## Component Lifecycle

### Render Sequence

**Initial render:**
1. `state` function called with props → initial state
2. `init` action/task runs (if defined)
3. `view` function renders initial VNode
4. VDOM patches DOM

**Re-render on state change:**
1. Action handler returns new state
2. Framework checks if state reference changed
3. If changed, `view` function called with new state
4. VDOM patches only changed DOM elements

**Re-render on props change:**
1. Parent re-renders with new props for child
2. Child's `view` function called with new props
3. VDOM patches DOM

### Optimization

**Memoized action thunks:**
Action/task thunks are automatically memoized by parameters. Same parameters = same function reference, preventing unnecessary re-renders.

```typescript
const onClick1 = action("Click", { id: 1 });
const onClick2 = action("Click", { id: 1 });
// onClick1 === onClick2 → true

const onClick3 = action("Click", { id: 2 });
// onClick1 === onClick3 → false
```

**Same-state optimization:**
If action returns same state reference, no re-render occurs:

```typescript
actions: {
  SetTheme: ({ theme }, { state }) => ({
    state: theme === state.theme ? state : { ...state, theme }
  })
}
```

## View Rendering

### Hyperscript Helpers
Use imported helpers from `html` constant:

```typescript
import { component, html } from "pure-ui-actions";
const { div, span, button, input, form, h1, h2, p, ul, li } = html;
```

### Element Syntax
```typescript
// ID and classes
div(`#${id}.container.active`, content)

// With attributes
input({
  props: { value: state.text, type: "text" },
  on: { input: action("Input") }
})

// With event handlers
button(
  { on: { click: action("Submit") } },
  "Submit"
)

// Nested children
div(`#${id}`, [
  h1("Title"),
  p("Content"),
  button({ on: { click: action("Click") } }, "Click")
])
```

### Efficient List Rendering
Use `withKey` for lists to enable efficient VDOM updates:

```typescript
import { withKey } from "pure-ui-actions";

view(id, { state }) {
  return ul([
    ...state.items.map(item =>
      withKey(item.id, li(item.name))
    )
  ]);
}
```

Keys are essential when items can be reordered, added, or removed.

### Component Memoization

pure-ui-actions exports Snabbdom's `thunk` as both `thunk` and `memo` for optimizing expensive components.

**CRITICAL CONSTRAINT**: Only use `memo` for components that **DO NOT access `rootState`**.

#### Why This Matters

Memoized components bypass pure-ui-actions' normal render flow. When `rootState` changes:
1. pure-ui-actions re-renders from the root component
2. Memoized components check their comparison key
3. If key unchanged → skip re-render
4. Component never receives the new `rootState`

This creates stale state bugs that are difficult to debug.

#### Safe Usage Pattern

```typescript
import { memo } from "pure-ui-actions";

// Component that ONLY uses props - safe to memoize
const listComponent = (id, { items }) => 
  div(`#${id}`, [
    ul(items.map(item => li(item.name)))
  ]);

view(id, { state }) {
  return div(`#${id}`, [
    div(`Counter: ${state.counter}`),
    
    // Safe: listComponent doesn't access rootState
    memo(
      `#${id}-list`,
      listComponent,
      { items: state.items },
      state.items  // Re-renders only when items change
    )
  ]);
}
```

#### Unsafe Patterns

**❌ WRONG: Component accesses rootState**
```typescript
// This component reads rootState.theme
const themedList = (id, { items, rootState }) => 
  div(`#${id}.${rootState.theme}`, [  // ❌ Uses rootState
    ul(items.map(item => li(item.name)))
  ]);

view(id, { state, rootState }) {
  return div(`#${id}`, [
    // ❌ WRONG: When theme changes, memo blocks the re-render
    memo(
      `#${id}-list`,
      themedList,
      { items: state.items, rootState },
      state.items  // Key doesn't include theme!
    )
  ]);
}
```

**✅ CORRECT: Don't memoize components that need rootState**
```typescript
view(id, { state, rootState }) {
  return div(`#${id}`, [
    // Render normally - will see rootState changes
    themedList(`#${id}-list`, { items: state.items, rootState })
  ]);
}
```

**✅ CORRECT ALTERNATIVE: Pass rootState as explicit prop**
```typescript
// Component takes theme as explicit prop (no rootState)
const themedList = (id, { items, theme }) => 
  div(`#${id}.${theme}`, [
    ul(items.map(item => li(item.name)))
  ]);

view(id, { state, rootState }) {
  return div(`#${id}`, [
    // Include all dependencies in the key
    memo(
      `#${id}-list`,
      themedList,
      { items: state.items, theme: rootState.theme },
      { items: state.items, theme: rootState.theme }  // ✅ Key includes theme
    )
  ]);
}
```

#### When to Use Memo

Use `memo` when:
- Component is computationally expensive
- Component renders frequently due to unrelated state changes
- Component **only uses local state or explicit props**
- Component does **NOT access rootState**

Don't use `memo` when:
- Component is already fast
- Component needs rootState
- The memoization overhead exceeds the rendering cost

#### Best Practice

Prefer the state management approach that avoids the need for memoization:
1. Keep state local to components
2. Lift state only to nearest common parent
3. Pass data as explicit props
4. Minimize rootState usage (see "State Management Best Practices" above)

This approach avoids both the performance cost of excessive rootState re-renders AND the complexity of memoization.

## Advanced Patterns

### VDOM Lifecycle Hooks

For advanced use cases, you can hook into Snabbdom's Virtual DOM lifecycle using `setHook`. This is useful for third-party integrations or special DOM manipulation needs.

```typescript
import { setHook } from "pure-ui-actions";

view(id, { state }): VNode {
  const vnode = div(`#${id}`, "Content");
  
  // Hook into VDOM lifecycle
  setHook(vnode, "insert", () => {
    // Called when element is inserted into DOM
    console.log("Element mounted");
    // Initialize third-party library
    initializeChartLibrary(id);
  });
  
  setHook(vnode, "destroy", () => {
    // Called when element is removed from DOM
    // Useful for cleanup (e.g., removing event listeners, destroying instances)
    console.log("Element unmounted");
    cleanupChartLibrary(id);
  });
  
  return vnode;
}
```

#### Available Hooks

- **`init`** - A vnode has been added
- **`create`** - A DOM element has been created based on a vnode
- **`insert`** - An element has been inserted into the DOM
- **`prepatch`** - An element is about to be patched
- **`update`** - An element is being updated
- **`postpatch`** - An element has been patched
- **`destroy`** - An element is directly or indirectly being removed
- **`remove`** - An element is directly being removed from the DOM

See [Snabbdom hooks documentation](https://github.com/snabbdom/snabbdom#hooks) for complete details.

#### Common Use Cases

**Integrating third-party libraries:**
```typescript
view(id, { state }): VNode {
  const chartContainer = div(`#${id}-chart`);
  
  setHook(chartContainer, "insert", () => {
    // Initialize chart after element is in DOM
    const chart = new Chart(document.getElementById(`${id}-chart`), {
      type: 'bar',
      data: state.chartData
    });
  });
  
  setHook(chartContainer, "update", () => {
    // Update chart when data changes
    const element = document.getElementById(`${id}-chart`);
    if (element) {
      Chart.getChart(element)?.update();
    }
  });
  
  setHook(chartContainer, "destroy", () => {
    // Clean up chart instance
    const element = document.getElementById(`${id}-chart`);
    if (element) {
      Chart.getChart(element)?.destroy();
    }
  });
  
  return chartContainer;
}
```

**Managing focus:**
```typescript
view(id, { state }): VNode {
  const input = html.input({
    props: { value: state.value }
  });
  
  if (state.shouldFocus) {
    setHook(input, "insert", () => {
      const el = document.querySelector(`#${id} input`) as HTMLInputElement;
      el?.focus();
    });
  }
  
  return div(`#${id}`, [input]);
}
```

**Note:** Most applications won't need lifecycle hooks. Use them only when:
- Integrating third-party libraries that need direct DOM access
- Performing imperative DOM operations that can't be expressed declaratively
- Managing resources that need cleanup (WebGL contexts, observers, etc.)

For most component lifecycle needs, use `init` actions and tasks instead.

## Common Workflows

### Adding a New Feature

1. **Define types** - Add action/task types
2. **Implement action handlers** - Pure state transformations
3. **Implement task handlers** - Side effects
4. **Update view** - Render new state
5. **Write tests** - Test actions and tasks
6. **Wire external events** (if needed) - In router.ts or mount init

### Refactoring Tips

- Extract service functions when tasks have duplicate I/O logic
- Create reusable components for repeated UI patterns
- Use root actions for cross-component state (theme, auth, etc.)
- Keep action handlers small and focused
- Prefer multiple simple actions over complex conditional logic

### Debugging

**Redux DevTools Integration:**

pure-ui-actions automatically integrates with [Redux DevTools](https://github.com/reduxjs/redux-devtools) browser extension:

```
Install Redux DevTools Extension → Open your pure-ui-actions app → Open DevTools → Redux tab
```

**What you get:**
- **Action History** - All actions with payloads: `counter/Increment { step: 1 }`
- **State Tree** - Component states: `{ app: {...}, counter: {...} }`
- **State Diff** - Auto-computed changes for each action
- **Task Tracking** - `counter/[Task] FetchData/success`
- **Export/Import** - Save sessions for bug reports

**Limitations:**
- Time travel is disabled (not compatible with pure-ui-actions' functional architecture)
- Read-only monitoring (can't dispatch actions from DevTools)

**Logging Controls:**

pure-ui-actions provides flexible logging via URL query parameters:

- **Redux DevTools** - Automatic when extension is installed
- **Console logging** - Add `?debug=console` to URL
- **Render events** - Add `?logRenders=true` to include render/patch events (verbose)

```
Example URLs:
http://localhost:3000/                              → Redux DevTools only (if installed)
http://localhost:3000/?debug=console                → Console + Redux DevTools
http://localhost:3000/?debug=console&logRenders=true → Everything with render events
```

Both console and DevTools logging can run simultaneously for maximum insight.

**Framework enforces:**
- No state mutation (deepFreeze throws errors)
- No manual action thunk calls (logs errors)
- Actions must be synchronous (returned values validated)

## Summary of Key Rules

1. **Actions are pure** - No I/O, no side effects, no async
2. **Tasks contain all side effects** - API calls, browser APIs, logging
3. **State is immutable** - Use spread operators for updates
4. **Types are Readonly** - Props and State must be Readonly
5. **Prefer local state over rootState** - Only use rootState for truly global concerns
6. **Only memo components without rootState** - Memoized components won't see rootState changes
7. **External events in mount init** - Wire routing and browser events there
8. **Use pub/sub sparingly** - Subscribe to "patch" events; publish custom events for cross-cutting concerns
9. **Service functions for reusable I/O** - Called from task perform
10. **Test with testComponent** - Test helper substitutes thunks with plain data
11. **Components are default exports** - Root types are named exports
12. **Co-locate tests** - `*.spec.ts` files next to implementation
13. **Use withKey for lists** - Enable efficient VDOM updates
14. **Context provides event in actions** - Access DOM events via context.event in action handlers
15. **Use setHook for advanced needs** - VDOM lifecycle hooks for third-party integrations only

## Build and Test Commands

```bash
# Install dependencies
npm install
# or
yarn install

# Run tests
npm test
# or
yarn test

# Build for production
npm run build
# or
yarn build

# Development with watch
npm run dev
# or
yarn dev
```

## Dependencies

Core dependencies for a pure-ui-actions project:
- `pure-ui-actions` - The framework
- `snabbdom` - Virtual DOM (peer dependency)
- `typescript` - Type checking
- `vitest` - Testing framework

Optional:
- `navigo` - Client-side routing
- Bundler: Parcel, Vite, or Webpack

