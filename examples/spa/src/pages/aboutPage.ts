import { component, html, VNode } from "pure-ui-actions";
import themeMenu from "../components/themeMenu";
import like from "../components/like";
import { RootState, RootTaskPayloads } from "../app";
const { div, span, a } = html;

export type Component = {
  RootState: RootState;
  RootTaskPayloads: RootTaskPayloads;
};

export default component<Component>(({ rootTask }) => ({
  init: rootTask("SetDocTitle", { title: "About Page" }),

  view(id): VNode {
    return div(
      `#${id}`,
      div(".content", [
        themeMenu("#theme-menu"),
        div(".nav", [
          a({ attrs: { href: "/counter" + location.search, "data-navigo": true } }, "counter page"),
          span(" | about page")
        ]),
        like("#about-like", { page: "aboutPage" }),
        div(".intro", "This is the about page.")
      ])
    );
  }
}));
