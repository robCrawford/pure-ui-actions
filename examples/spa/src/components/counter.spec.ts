import { testComponent, NextData } from "pure-ui-actions";
import counter, { State, Component } from "./counter";

describe("Counter component", () => {
  const { initialState, testAction, testTask, config } = testComponent<Component>(counter, {
    start: 0
  });

  it("should set initial state", () => {
    expect(initialState).toEqual({ counter: 0, feedback: "" });
  });

  it("should run initial action", () => {
    expect(config.init).toEqual({ name: "Validate" });
  });

  describe("'Increment' action", () => {
    const { state, next } = testAction<State>("Increment", { step: 1 });

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        counter: 1
      });
    });

    it("should return next", () => {
      const { name, data } = next as NextData;
      expect(name).toBe("Validate");
      expect(data).toBeUndefined();
    });
  });

  describe("'Decrement' action", () => {
    const { state, next } = testAction<State>("Decrement", { step: 1 });

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        counter: -1
      });
    });

    it("should return next", () => {
      const { name, data } = next as NextData;
      expect(name).toBe("Validate");
      expect(data).toBeUndefined();
    });
  });

  describe("'Validate' action", () => {
    const { state, next } = testAction<State>("Validate");

    it("should not update state", () => {
      expect(state).toEqual(initialState);
    });

    it("should return next", () => {
      expect(Array.isArray(next)).toBe(true);

      if (Array.isArray(next)) {
        expect(next.length).toBe(2);

        expect(next[0].name).toBe("SetFeedback");
        expect(next[0].data).toEqual({ text: "Validating..." });

        expect(next[1].name).toBe("ValidateCount");
        expect(next[1].data).toEqual({ count: 0 });
      }
    });
  });

  describe("'SetFeedback' action", () => {
    const { state, next } = testAction<State>("SetFeedback", { text: "test" });

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        feedback: "test"
      });
    });

    it("should not return next", () => {
      expect(next).toBeUndefined();
    });
  });

  describe("'ValidateCount' task", () => {
    const { perform, success, failure } = testTask("ValidateCount", { count: 0 });

    it("should provide perform", () => {
      expect(perform).toBeDefined();
    });

    it("should handle success", () => {
      const { name, data } = success?.({ text: "Success test" }) as NextData;
      expect(name).toBe("SetFeedback");
      expect(data).toEqual({ text: "Success test" });
    });

    it("should handle failure", () => {
      const { name, data } = failure?.("") as NextData;
      expect(name).toBe("SetFeedback");
      expect(data).toEqual({ text: "Unavailable" });
    });
  });
});
