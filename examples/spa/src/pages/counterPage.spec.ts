import { testComponent } from "pure-ui-actions";
import counterPage from "./counterPage";

describe("Counter Page component", () => {
  const { config } = testComponent(counterPage);

  it("should run initial action", () => {
    expect(config.init).toEqual({ name: "SetDocTitle", data: { title: "Counter" } });
  });

});
