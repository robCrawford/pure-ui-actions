import { component, html } from "pure-ui-actions";
import { Page, RootState, RootActionPayloads, RootTaskPayloads } from "../app";
const { button } = html;

export type Props = Readonly<{
  page: Page;
}>;

type ActionPayloads = Readonly<{
  Like: null;
}>;

export type Component = {
  Props: Props;
  State: null;
  ActionPayloads: ActionPayloads;
  RootState: RootState;
  RootActionPayloads: RootActionPayloads;
  RootTaskPayloads: RootTaskPayloads;
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
