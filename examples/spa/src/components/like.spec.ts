import { testComponent } from "pure-ui-actions";
import like, { Component } from "./like";
import { RootState } from "../app";

describe("Like component", () => {
  const { testAction } = testComponent<Component>(like, { page: "counterPage" });

  describe("'Like' action", () => {
    const { state, next } = testAction<RootState>("Like");

    it("should not update state", () => {
      // Stateless component - initialState is undefined, but context defaults to {}
      expect(state).toEqual({});
    });

    it("should return next", () => {
      expect(Array.isArray(next)).toBe(true);

      if (Array.isArray(next)) {
        expect(next.length).toBe(2);

        expect(next[0].name).toBe("Like");
        expect(next[0].data).toEqual({ page: "counterPage" });

        expect(next[1].name).toBe("SetDocTitle");
        expect(next[1].data).toEqual({ title: "You like this!" });
      }
    });
  });
});
