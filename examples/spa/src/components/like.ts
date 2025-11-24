import { component, html } from "pure-ui-actions";
import { Page, RootState, RootActions, RootTasks } from "../app";
const { button } = html;

export type Props = Readonly<{
  page: Page;
}>;

type Actions = Readonly<{
  Like: null;
}>;

export type Component = {
  Props: Props;
  State: null;
  Actions: Actions;
  RootState: RootState;
  RootActions: RootActions;
  RootTasks: RootTasks;
};

export default component<Component>(({ action, rootAction, rootTask }) => ({
  actions: {
    Like: (_, { props, state }) => {
      return {
        state,
        next: [
          rootAction("Like", { page: props.page }),
          rootTask("SetDocTitle", { title: "You like this!" })
        ]
      };
    }
  },
  view: (id, { props, rootState }) =>
    button(`#${id}.like`, { on: { click: action("Like") } }, `👍${rootState.likes[props.page]}`)
}));
