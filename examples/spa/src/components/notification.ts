import { ActionThunk, component, html, Config, VNode, Next } from "pure-ui-actions";
const { div, button } = html;

export type Props = Readonly<{
  text: string;
  onDismiss: ActionThunk;
}>;

export type State = Readonly<{
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
      Dismiss: (_, { props, state }): {state: State; next: Next} => {
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
      return div(`#${id}.notification`, {
        class: {
          show: state.show && props.text.length
        }
      }, [
        props.text,
        button({ on: { click: action("Dismiss") } }, "Dismiss")
      ]);
    }

  })
);
