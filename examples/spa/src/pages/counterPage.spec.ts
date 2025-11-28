import { componentTest } from "pure-ui-actions";
import counterPage, { Component } from "./counterPage";

describe("Counter Page component", () => {
  const { config } = componentTest<Component>(counterPage);

  it("should run initial action", () => {
    expect(config.init).toEqual({ name: "SetDocTitle", data: { title: "Counter Page" } });
  });
});
