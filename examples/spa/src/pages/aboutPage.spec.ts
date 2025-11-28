import { componentTest } from "pure-ui-actions";
import aboutPage, { Component } from "./aboutPage";

describe("About Page component", () => {
  const { config } = componentTest<Component>(aboutPage);

  it("should run initial action", () => {
    expect(config.init).toEqual({ name: "SetDocTitle", data: { title: "About Page" } });
  });
});
