import { ActionThunk, component, html, Next, VNode } from "pure-ui-actions";
const { div, button } = html;

export type Props = Readonly<{
  text: string;
  onDismiss: ActionThunk;
}>;

export type State = Readonly<{
  show: boolean;
}>;

type ActionPayloads = Readonly<{
  Dismiss: null;
}>;

export type Component = {
  Props: Props;
  State: State;
  ActionPayloads: ActionPayloads;
};

export default component<Component>(({ action }) => ({
  state: (): State => ({
    show: true
  }),

  actions: {
    Dismiss: (_, { props, state }): { state: State; next: Next } => {
      return {
        state: {
          ...state,
          show: false
        },
        next: props.onDismiss
      };
    }
  },

  view(id, { props, state }): VNode {
    return div(
      `#${id}.notification`,
      {
        class: {
          show: state.show && props.text.length
        }
      },
      [props.text, button({ on: { click: action("Dismiss") } }, "Dismiss")]
    );
  }
}));
