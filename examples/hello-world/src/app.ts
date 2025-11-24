import { component, html, mount, Config, Next, VNode } from "pure-ui-actions";
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
  ({ action, task }): Config<Component> => ({

    // Initial state
    state: (props): State => ({
      title: `Welcome! ${props.date}`,
      text: '',
      done: false
    }),

    // Initial action
    init: action("ShowMessage", { text: "Hello World!" }),

    // Action handlers return new state, and any next actions/tasks
    actions: {
      ShowMessage: (data, context): { state: State; next: Next } => {
        return {
          state: {
            ...context.state,
            text: data.text
          },
          next: task("SetDocTitle", { title: data.text })
        };
      },
      PageReady: (data, context): { state: State } => {
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
        perform: (): Promise<void> => setDocTitle(data.title),
        success: (): Next => action("PageReady", { done: true }),
        failure: (): Next => action("PageReady", { done: false })
      })
    },

    // View renders from props & state
    view(id, context): VNode {
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
