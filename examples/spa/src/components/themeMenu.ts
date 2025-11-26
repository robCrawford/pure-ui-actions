import { component, html } from "pure-ui-actions";
import { RootActionPayloads } from "../app";
const { div, button } = html;

type Component = {
  RootActionPayloads: RootActionPayloads;
};

export default component<Component>(({ rootAction }) => ({
  view(id) {
    return div(`#${id}`, [
      button({ on: { click: rootAction("SetTheme", { theme: "light" }) } }, "Light theme"),
      button({ on: { click: rootAction("SetTheme", { theme: "dark" }) } }, "Dark theme")
    ]);
  }
}));
