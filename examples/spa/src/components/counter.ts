import { component, html } from "pure-ui-actions";
import notification from "./notification";
import { validateCount } from "../services/validation";
const { div, button } = html;

export type Props = Readonly<{
  start: number;
}>;

export type State = Readonly<{
  counter: number;
  feedback: string;
}>;

type Actions = Readonly<{
  Increment: { step: number };
  Decrement: { step: number };
  Validate: null;
  SetFeedback: { text: string };
}>;

type Tasks = Readonly<{
  ValidateCount: { count: number };
}>;

export type Component = {
  Props: Props;
  State: State;
  Actions: Actions;
  Tasks: Tasks;
};

export default component<Component>(({ action, task }) => ({
  state: (props) => ({
    counter: props.start,
    feedback: ""
  }),

  init: action("Validate"),

  actions: {
    Increment: ({ step }, { state }) => {
      return {
        state: {
          ...state,
          counter: state.counter + step
        },
        next: action("Validate")
      };
    },
    Decrement: ({ step }, { state }) => {
      return {
        state: {
          ...state,
          counter: state.counter - step
        },
        next: action("Validate")
      };
    },
    Validate: (_, { state }) => {
      return {
        state,
        next: [
          action("SetFeedback", { text: "Validating..." }),
          // An async task
          task("ValidateCount", { count: state.counter })
        ]
      };
    },
    SetFeedback: ({ text }, { state }) => {
      return {
        state:
          text === state.feedback
            ? state
            : {
                ...state,
                feedback: text
              }
      };
    }
  },

  tasks: {
    ValidateCount: ({ count }) => {
      return {
        perform: (): Promise<{ text: string }> => validateCount(count),
        success: (result: { text: string }) => {
          return action("SetFeedback", result);
        },
        failure: () => {
          return action("SetFeedback", { text: "Unavailable" });
        }
      };
    }
  },

  view(id, { state }) {
    return div(`#${id}.counter`, [
      button({ on: { click: action("Increment", { step: 1 }) } }, "+"),
      div(String(state.counter)),
      button({ on: { click: action("Decrement", { step: 1 }) } }, "-"),
      // Child component - `notification` module
      notification(`#${id}-feedback`, {
        text: state.feedback,
        onDismiss: action("SetFeedback", { text: "" })
      })
    ]);
  }
}));
