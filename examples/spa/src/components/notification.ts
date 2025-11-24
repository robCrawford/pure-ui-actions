import { ActionThunk, component, html } from "pure-ui-actions";
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

export type Component = {
  Props: Props;
  State: State;
  Actions: Actions;
};


export default component<Component>(
  ({ action }) => ({

    state: () => ({
      show: true
    }),

    actions: {
      Dismiss: (_, { props, state }) => {
        return {
          state: {
            ...state,
            show: false
          },
          next: props.onDismiss
        };
      }
    },

    view(id, { props, state }) {
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
