import { component, html, Next, VNode } from "pure-ui-actions";
import { Page, RootState, RootActionPayloads, RootTaskPayloads } from "../app";
const { button } = html;

export type Props = Readonly<{
  page: Page;
}>;

export type State = Readonly<Record<string, never>>;

type ActionPayloads = Readonly<{
  Like: null;
}>;

export type Component = {
  Props: Props;
  State: State;
  ActionPayloads: ActionPayloads;
  RootState: RootState;
  RootActionPayloads: RootActionPayloads;
  RootTaskPayloads: RootTaskPayloads;
};

export default component<Component>(({ action, rootAction, rootTask }) => ({
  actions: {
    Like: (_, { props, state }): { state: State; next: Next } => ({
      state, // Return existing state to avoid unnecessary render
      next: [
        rootAction("Like", { page: props.page }),
        rootTask("SetDocTitle", { title: "You like this!" })
      ]
    })
  },
  view: (id, { props, rootState }): VNode =>
    button(`#${id}.like`, { on: { click: action("Like") } }, `👍 ${rootState.likes[props.page]}`)
}));
