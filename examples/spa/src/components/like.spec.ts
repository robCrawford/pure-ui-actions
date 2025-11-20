import { testComponent, NextData } from "pure-ui-actions";
import like, { Component } from "./like";
import { RootState } from "../app";

describe("Like component", () => {
  const { initialState, testAction } = testComponent<Component>(like, { page: "test" });

  describe("'Like' action", () => {
    const { state, next } = testAction<RootState>("Like");

    it("should not update state", () => {
      expect(state).toEqual(initialState);
    });

    it("should return next", () => {
      expect(Array.isArray(next)).toBe(true);

      if (Array.isArray(next)) {
        expect(next.length).toBe(2);

        expect(next[0].name).toBe("Like");
        expect(next[0].data).toEqual({ page: "test" });

        expect(next[1].name).toBe("SetDocTitle");
        expect(next[1].data).toEqual({ title: "You like this!" });
      }
    });
  });

});
