import { component, html, mount } from "pure-ui-actions";
import { setDocTitle } from "./services/browser";
const { h3, div } = html;

export type Props = Readonly<{
  date: string;
}>;

export type State = Readonly<{
  title: string;
  text: string;
  done: boolean;
}>;

export type ActionPayloads = Readonly<{
  ShowMessage: { text: string };
  PageReady: { done: boolean };
}>;

export type TaskPayloads = Readonly<{
  SetDocTitle: { title: string };
}>;

export type Component = {
  Props: Props;
  State: State;
  ActionPayloads: ActionPayloads;
  TaskPayloads: TaskPayloads;
};

const app = component<Component>(({ action, task }) => ({
  // Initial state
  state: (props) => ({
    title: `Welcome! ${props.date}`,
    text: "",
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
    }
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
      div(context.state.done ? "✅" : "❎")
    ]);
  }
}));

document.addEventListener("DOMContentLoaded", () =>
  mount({ app, props: { date: new Date().toDateString() } })
);

export default app;
