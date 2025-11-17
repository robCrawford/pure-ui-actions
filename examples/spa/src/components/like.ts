import { component, html, Config, VNode, Next } from "pure-ui-actions";
import { Page, RootState, RootActions, RootTasks } from "../app";
const { button } = html;

export type Props = Readonly<{
  page: Page;
}>;

type Actions = Readonly<{
  Like: null;
}>;

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
      Like: (_, { props, state }): { state: null; next: Next } => {
        return {
          state,
          next: [
            rootAction("Like", { page: props.page }),
            rootTask("SetDocTitle", { title: "You like this!" })
          ]
        };
      }
    },
    view: (id, { props, rootState }): VNode =>
      button(`#${id}.like`, { on: { click: action("Like") } }, `👍${rootState.likes[props.page]}`)
  })
);
