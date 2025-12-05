import { component, html, VNode } from "pure-ui-actions";
import counter from "../components/counter";
import themeMenu from "../components/themeMenu";
import like from "../components/like";
import { RootState, RootTaskPayloads } from "../app";
const { div, span, a } = html;

export type Props = Readonly<Record<string, never>>;

export type State = Readonly<Record<string, never>>;

export type Component = {
  Props: Props;
  State: State;
  RootState: RootState;
  RootTaskPayloads: RootTaskPayloads;
};

export default component<Component>(({ rootTask }) => ({
  init: rootTask("SetDocTitle", { title: "Counter Page" }),

  view(id): VNode {
    return div(`#${id}`, [
      div(".content", [
        themeMenu("#theme-menu"),
        div(".nav", [
          span("counter page | "),
          a({ attrs: { href: "/list" + location.search, "data-navigo": true } }, "list page")
        ]),
        like("#counter-like", { page: "counterPage" })
      ]),
      counter("#counter-0", { start: 0 }),
      counter("#counter-1", { start: -1 })
    ]);
  }
}));
