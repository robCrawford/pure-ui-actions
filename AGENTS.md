# AGENTS.md - pure-ui-actions Development Guide for AI Agents

## Reference Implementation

The `examples/spa/` directory is the canonical reference. Study these files:

| File                             | Pattern Demonstrated                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/app.ts`                     | Root component, RootState/RootActionPayloads/RootTaskPayloads exports, IIFE view pattern |
| `src/router.ts`                  | External I/O wiring, mount(), subscribe("patch"), RunAction                              |
| `src/components/counter.ts`      | Full component: props, state, actions, tasks, child composition                          |
| `src/components/notification.ts` | ActionThunk callback props, conditional classes                                          |
| `src/components/like.ts`         | Stateless component with rootState/rootAction/rootTask                                   |
| `src/components/themeMenu.ts`    | Minimal component (only RootActionPayloads, no local state)                              |
| `src/pages/counterPage.ts`       | Page component with rootTask init                                                        |
| `src/services/validation.ts`     | Service function pattern                                                                 |
| `*.spec.ts` files                | Testing patterns                                                                         |

## Core Architecture

### Actions (Pure Functions)

**CRITICAL**: Actions are pure, synchronous, no I/O. Return new state and optional `next` actions/tasks.

```typescript
actions: {
  // With next - include Next in return type
  Increment: ({ step }, { state }): { state: State; next: Next } => ({
    state: { ...state, count: state.count + step },
    next: action("Validate")
  }),

  // Without next - omit Next from return type
  SetValue: ({ value }, { state }): { state: State } => ({
    state: { ...state, value }
  }),

  // No payload - use `_` for unused params
  Reset: (_, { state }): { state: State } => ({
    state: { ...state, count: 0 }
  }),

  // Same-state optimization (prevents re-render)
  SetTheme: ({ theme }, { state }): { state: State } => ({
    state: theme === state.theme ? state : { ...state, theme }
  })
}
```

See `examples/spa/src/components/counter.ts` for complete action patterns.

### Tasks (Side Effects)

**ONLY place for**: API calls, browser APIs, localStorage, timers, logging, DOM mutations.

**Task Type Signature**: `Task<TResult, TProps, TState, TRootState = unknown, TError = unknown>`

- All error properties are automatically made **optional (deep)** for runtime safety

```typescript
tasks: {
  // Async task
  ValidateCount: ({ count }): Task<{ text: string }, Props, State> => ({
    perform: () => validateCount(count),
    success: (result) => action("SetFeedback", result),
    failure: () => action("SetFeedback", { text: "Unavailable" })
  }),

  // Effect-only (sync) - no success/failure needed
  SetDocTitle: ({ title }): Task<void, RootProps, RootState> => ({
    perform: (): void => {
      document.title = title;
    }
  })
}
```

See `examples/spa/src/app.ts` (SetDocTitle) and `examples/spa/src/components/counter.ts` (ValidateCount).

### External I/O Wiring

Connect external events to root actions in `mount()` init callback. See `examples/spa/src/router.ts` for the complete pattern.

### Framework Events (Pub/Sub)

**Built-in**: `"patch"` fires after every VDOM patch - used to update router links after render.

**Custom events**: For cross-cutting concerns (analytics, logging). Use sparingly—prefer props/actions.

```typescript
publish("user:login", { userId: result.id });
subscribe("user:login", (event) => analytics.track("login", event.detail.userId));
unsubscribe("user:login", handler);
```

## Anti-Patterns

### ❌ Side effects in actions → ✅ Tasks

```typescript
// WRONG
actions: {
  SaveData: ({ data }, { state }): { state: State } => {
    localStorage.setItem("data", JSON.stringify(data)); // WRONG - side effect!
    return { state: { ...state, saved: true } };
  };
}

// CORRECT - delegate to task
actions: {
  SaveData: ({ data }, { state }): { state: State; next: Next } => ({
    state: { ...state, data },
    next: task("PersistData", { data })
  });
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
  LoadUser: async ({ id }, { state }) => {
    /* ... */
  };
}

// CORRECT
actions: {
  LoadUser: ({ id }, { state }): { state: State; next: Next } => ({
    state: { ...state, loading: true },
    next: task("FetchUser", { id })
  });
}
```

## TypeScript Types

### Component Type Structure

**ALL fields are optional** - only include what your component uses:

```typescript
// Full component - see examples/spa/src/components/counter.ts
type Component = { Props; State; ActionPayloads; TaskPayloads };

// With root access - see examples/spa/src/components/like.ts
type Component = { Props; State; ActionPayloads; RootState; RootActionPayloads; RootTaskPayloads };

// Minimal (view-only) - see examples/spa/src/components/themeMenu.ts
type Component = { RootActionPayloads };

// Page component - see examples/spa/src/pages/counterPage.ts
type Component = { Props; State; RootState; RootTaskPayloads };
```

### Type Patterns

```typescript
// Props/State - always Readonly
export type Props = Readonly<{ title: string; count: number }>;
export type Props = Readonly<Record<string, never>>; // No props
export type State = Readonly<{ items: string[]; selected: boolean }>;
export type State = Readonly<Record<string, never>>; // Stateless

// ActionPayloads - map action names to payload types
type ActionPayloads = Readonly<{
  ShowMessage: { text: string };
  Reset: null; // No payload
}>;

// TaskPayloads
type TaskPayloads = Readonly<{
  FetchData: { id: string };
}>;
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

- `props`, `state`, `rootState` are **non-optional** - no need for `?.`
- `event` only available in actions triggered by DOM events (not in `next` chains)
- Destructure only what you need: `{ state }`, `{ props, state }`, `{ props, rootState }`

## Immutability Patterns

```typescript
{ ...state, count: state.count + 1 }                    // Object update
{ ...state, likes: { ...state.likes, [page]: n + 1 } }  // Nested object
theme === state.theme ? state : { ...state, theme }     // Same-state optimization
{ ...state, items: [...state.items, newItem] }          // Array add
{ ...state, items: state.items.filter((_, i) => i !== index) }  // Array remove
{ ...state, items: state.items.map((item, i) => i === index ? updated : item) }  // Array update
```

## State Management

### Local vs Root State

**CRITICAL**: Prefer local state. Root state changes re-render **all** components accessing `rootState`.

| State Type                      | Location | Why                              |
| ------------------------------- | -------- | -------------------------------- |
| Form inputs, UI toggles         | Local    | High frequency, single component |
| Selected item (shared siblings) | Parent   | Lift to common ancestor          |
| Theme, auth, feature flags      | Root     | Cross-cutting, many components   |

### Action Callback Pattern

Pass action thunks as props for child-to-parent communication. See `examples/spa/src/components/notification.ts`:

```typescript
// Child receives callback
export type Props = Readonly<{ text: string; onDismiss: ActionThunk }>;

// Child invokes parent action
next: props.onDismiss;

// Parent passes action as prop
notification(`#${id}-feedback`, {
  text: state.feedback,
  onDismiss: action("SetFeedback", { text: "" })
});
```

## View Rendering

### Selector Strings

Elements use CSS selector syntax: `div(`#${id}.container.active`, children)`

### Event Handlers

```typescript
button({ on: { click: action("Submit") } }, "Submit");
input({ on: { input: action("HandleInput"), blur: action("HandleBlur") } });
```

### Attributes and Properties

```typescript
a({ attrs: { href: "/about", "data-navigo": true } }, "About"); // HTML attributes
input({ props: { value: state.text, type: "text" } }); // DOM properties
```

### Conditional Classes

See `examples/spa/src/components/notification.ts`:

```typescript
div(`#${id}.notification`, { class: { show: state.show && props.text.length } }, children);
```

### Component Memoization

**CRITICAL**: Only `memo` components that **DO NOT access `rootState`**.

```typescript
import { memo } from "pure-ui-actions";
memo(`#${id}-list`, listComponent, { items: state.items }, state.items);
```

## Testing

Use `componentTest` to test component logic without mocks. Returns plain data instead of thunks.

See `examples/spa/src/components/counter.spec.ts` for comprehensive patterns:

- Testing initial state and init action
- Testing actions with/without next
- Testing tasks (perform, success, failure)

See `examples/spa/src/components/notification.spec.ts` for:

- Testing components with ActionThunk props (mock with `ThunkType.Action`)

See `examples/spa/src/pages/counterPage.spec.ts` for:

- Testing page components with rootTask init

```typescript
import { componentTest, NextData } from "pure-ui-actions";

const { initialState, actionTest, taskTest, config } = componentTest<Component>(counter, {
  start: 0
});

// Test action
const { state, next } = actionTest<State>("Increment", { step: 1 });

// Test task callbacks
const { perform, success, failure } = taskTest("ValidateCount", { count: 0 });
const result = success?.({ text: "Even" }) as NextData;
```

## Project Structure

```
src/
├── app.ts           # Root component (exports RootState, RootActionPayloads, RootTaskPayloads)
├── router.ts        # External I/O wiring (routing, browser events)
├── components/      # Reusable components (*.ts, *.spec.ts)
├── pages/           # Page components
├── services/        # I/O functions (api.ts, storage.ts, browser.ts)
└── css/
```

## Advanced Patterns

### VDOM Lifecycle Hooks

For third-party library integration only:

```typescript
import { setHook } from "pure-ui-actions";
setHook(vnode, "insert", () => initializeChartLibrary(id));
setHook(vnode, "destroy", () => cleanupChartLibrary(id));
```

**Available hooks**: `init`, `create`, `insert`, `prepatch`, `update`, `postpatch`, `destroy`, `remove`

## Debugging

**Redux DevTools** automatically integrates:

- Action history: `counter/Increment { step: 1 }`
- State tree and diffs
- Task tracking: `counter/[Task] FetchData/success`

## Key Rules

1. **Actions are pure** - No I/O, no side effects, no async
2. **Tasks contain all side effects** - API calls, browser APIs, logging
3. **State is immutable** - Use spread operators, return same reference if unchanged
4. **Types are Readonly** - Props and State must be `Readonly<...>`
5. **Prefer local state** - Root state re-renders ALL components accessing it
6. **Don't memo components with rootState** - They won't see changes
7. **External events in mount init** - Wire routing/browser events there
8. **Service functions for I/O** - Extract reusable I/O to services/
9. **Test with componentTest** - Export Component type for type inference
10. **Context in actions** - `props`, `state`, `rootState` non-optional; `event` optional
11. **Component type fields are optional** - Only include what you use
12. **TypeScript strict mode** - Add return types: `{ state: State; next: Next }`, `Task<...>`, `VNode`
