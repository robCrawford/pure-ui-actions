/* eslint-disable @typescript-eslint/no-explicit-any */
/*
Logging for pure-ui-actions lifecycle with Redux DevTools integration
*/
let groupId = "";

// Logging controls based on URL query parameters
const searchParams =
  typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
const logToConsole = searchParams?.get("debug") === "console"; // Enable with ?debug=console

const logEnabled = logToConsole;

// Redux DevTools integration
interface DevToolsConnection {
  init(state: unknown): void;
  send(action: { type: string; [key: string]: any }, state: unknown): void;
}

let devToolsConnection: DevToolsConnection | null = null;

// Initialize Redux DevTools connection (if extension is active)
if (typeof window !== "undefined") {
  const devToolsExtension = (window as any).__REDUX_DEVTOOLS_EXTENSION__;
  if (devToolsExtension) {
    devToolsConnection = devToolsExtension.connect({
      name: "pure-ui-actions App",
      features: {
        jump: false, // Disable time travel
        skip: false, // Disable skip
        reorder: false, // Disable reorder
        dispatch: false, // Disable dispatch
        persist: false // Disable persist
      }
    });

    // Initialize with empty state
    if (devToolsConnection) {
      devToolsConnection.init({});
    }
  }
}

// Helper to get aggregated state for DevTools
function getAggregatedState(): Record<string, any> {
  const win = window as any;
  // Return a shallow copy to avoid mutating window.state
  return { ...(win.state || {}) };
}

export const log = {
  setStateGlobal(id: string, state: object | undefined | null): void {
    // Maintain global state registry (DevTools and logging rely on this)
    // Called after actions update state and during render lifecycle
    const win = window as unknown as { state: Record<string, object | undefined | null> };
    const stateGlobal = win.state || (win.state = {});

    if (state === undefined || state === null) {
      delete stateGlobal[id];
    } else {
      stateGlobal[id] = state;
    }

    // Note: State updates are sent to DevTools by updateStart, not here
    // This just maintains window.state for getAggregatedState() to read
  },
  noInitialAction(id: string, state?: Record<string, unknown> | null): void {
    // Send initial mount to Redux DevTools
    if (devToolsConnection && state) {
      // Build aggregated state with the initial state for this component
      const aggregatedState = getAggregatedState();
      aggregatedState[id] = state;

      devToolsConnection.send(
        {
          type: `${id}/[Mount]`,
          meta: { lifecycle: true }
        },
        aggregatedState
      );
    }

    // Console logging
    if (logEnabled) {
      console.group(`%c#${id}`, "color: #69f");
      if (state) {
        console.log(`${JSON.stringify(state)}`);
      }
      groupId = id;
    }
  },
  updateStart(
    id: string,
    state: Record<string, unknown> | undefined | null,
    label: string,
    data?: Record<string, unknown>,
    newState?: Record<string, unknown> | null
  ): void {
    // Send to Redux DevTools with current state
    if (devToolsConnection && newState !== undefined) {
      // Update window.state FIRST so subsequent getAggregatedState() calls are accurate
      const win = window as unknown as { state: Record<string, object | undefined | null> };
      const stateGlobal = win.state || (win.state = {});
      stateGlobal[id] = newState;

      // Build aggregated state with the NEW state for this component
      const aggregatedState = getAggregatedState();

      devToolsConnection.send(
        {
          type: `${id}/${label}`,
          payload: data || null
        },
        aggregatedState
      );
    }

    // Console logging
    if (logEnabled) {
      if (!groupId || groupId !== id) {
        console.group(`%c#${id}`, "color: #69f");
        groupId = id;
      }
      if (state) {
        console.log(`%c${JSON.stringify(state)}`, "text-decoration: line-through;");
      }
      let msg = `${String(label)}`;
      if (data) {
        msg += ` ${JSON.stringify(data)}`;
      }
      console.log(`%c${msg}`, "color: #f6b");
      if (!state) {
        console.log(`No change`);
      }
    }
  },
  updateEnd(state: Record<string, unknown>): void {
    // Note: updateEnd is informational only - state already sent in updateStart
    // Console logging
    if (logEnabled && state) {
      console.log(`${JSON.stringify(state)}`);
    }
  },
  taskPerform(id: string, label: string, isPromise: boolean): void {
    // Send task start to Redux DevTools
    if (devToolsConnection) {
      devToolsConnection.send(
        {
          type: `${id}/[Task] ${label}/start`,
          meta: { isTask: true, status: "start", isPromise }
        },
        getAggregatedState()
      );
    }

    // Console logging
    if (logEnabled) {
      console.log(`%cTask "${label}" perform${isPromise ? "..." : "ed"}`, "color: #dd8");
    }
  },
  taskSuccess(id: string, label: string): void {
    // Send to Redux DevTools
    if (devToolsConnection) {
      devToolsConnection.send(
        {
          type: `${id}/[Task] ${label}/success`,
          meta: { isTask: true, status: "success" }
        },
        getAggregatedState()
      );
    }

    // Console logging
    if (logEnabled) {
      console.log(`%c\n...#${id} task "${label}" success`, "color: #dd8");
    }
  },
  taskFailure(id: string, label: string, err: unknown): void {
    // Send to Redux DevTools
    if (devToolsConnection) {
      devToolsConnection.send(
        {
          type: `${id}/[Task] ${label}/failure`,
          payload: {
            error: err && typeof err === "object" && "message" in err ? err.message : String(err)
          },
          meta: { isTask: true, status: "failure" }
        },
        getAggregatedState()
      );
    }

    // Console logging
    if (logEnabled) {
      console.log(`%c\n...#${id} task "${label}" failure`, "color: #dd8");
      if (err) console.error(JSON.stringify(err));
    }
  },
  render(id: string, props?: Record<string, unknown> | null): void {
    // Console logging
    if (logEnabled) {
      console.groupEnd();
      let msg = `⟳ Render #${id}`;
      if (props && Object.keys(props).length) {
        msg += `, props: ${JSON.stringify(props, replacer)}`;
      }
      console.log(`%c${msg}`, "color: #888");
      groupId = "";
    }
  },
  patch(): void {
    // Send updated state to Redux DevTools after VDOM patch completes
    // At this point, destroy hooks have run and window.state is clean
    // ALWAYS sent - critical for state synchronization (shows component cleanup)
    if (devToolsConnection) {
      devToolsConnection.send(
        {
          type: "[PATCH]",
          meta: { isPatch: true }
        },
        getAggregatedState()
      );
    }

    // Console logging
    if (logEnabled) {
      console.log(`%c» PATCH`, "color: #888");
      console.groupEnd();
    }
  },
  manualError(id: string, name: string): void {
    throw Error(`#${id} "${name}" cannot be invoked manually`);
  }
};

function replacer(k: string, v: string | Function): string {
  return typeof v === "function" ? "[fn]" : v;
}

window.addEventListener("error", () => {
  setTimeout(() => {
    console.groupEnd();
    groupId = "";
  });
});
