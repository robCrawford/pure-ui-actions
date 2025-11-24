import { component, html } from "pure-ui-actions";
import themeMenu from "../components/themeMenu";
import like from "../components/like";
import { RootState, RootTasks } from "../app";
const { div, h1, a } = html;

export type Component = {
  RootState: RootState;
  RootTasks: RootTasks;
};


export default component<Component>(
  ({ rootTask }) => ({

    init: rootTask("SetDocTitle", { title: "About" }),

    view(id, { rootState }) {
      return div(`#${id}`,
        div(".content", [
          themeMenu("#theme-menu"),
          a({ attrs: {href: "/counter" + location.search, "data-navigo": true} }, "Counter page"),
          div(".visits", ["Likes: ", rootState.likes.aboutPage]),
          h1("About"),
          like('#about-like', { page: 'aboutPage'}),
          div(".intro", "Lorem ipsum dolor sit amet.")
        ])
      );
    }

  }))
;
