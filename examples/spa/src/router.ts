import { mount, subscribe, RunAction } from "pure-ui-actions";
import Navigo from "navigo";
import app, { RootActions, RootProps } from "./app";

const router = new Navigo("/");

document.addEventListener("DOMContentLoaded", () => mount<RootActions, RootProps>({
  app,
  props: {},

  // Manually invoking an action is an error, so `runRootAction` is provided
  // by `mount` for wiring up events to root actions (e.g. routing)
  init: (runRootAction: RunAction<RootActions>) => {

    const about = () => runRootAction("SetPage", { page: "aboutPage" });
    const counter = () => runRootAction("SetPage", { page: "counterPage" });

    router.on({ about, counter, "*": counter }).resolve();

    subscribe("patch", () => {
      router.updatePageLinks();
    });
  }
}));
