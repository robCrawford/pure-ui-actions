import { testComponent, NextData } from "pure-ui-actions";
import app, { RootState } from "./app";

describe("App", () => {

  const { testAction, testTask, initialState } = testComponent(app);

  it("should set initial state", () => {
    expect(initialState).toEqual({
      theme: "light",
      page: undefined,
      likes: {
        counterPage: 0,
        aboutPage: 0
      }
    });
  });

  describe("'SetPage' action", () => {
    const { state, next } = testAction<RootState>("SetPage", { page: "test" });

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        page: "test"
      });
    });

    it("should not return next", () => {
      expect(next).toBeUndefined();
    });
  });

  describe("'SetTheme' action", () => {
    const { state, next } = testAction<RootState>("SetTheme", { theme: "test" });

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        theme: "test"
      });
    });

    it("should not return next", () => {
      expect(next).toBeUndefined();
    });
  });

  describe("'Like' action", () => {
    const { state, next } = testAction<RootState>("Like", { page: "aboutPage" });

    it("should update state", () => {

      expect(state).toEqual({
        ...initialState,
        likes: {
          ...(initialState.likes as Record<string, number>),
          aboutPage: 1
        }
      });
    });

    it("should not return next", () => {
      expect(next).toBeUndefined();
    });
  });

  describe("'SetDocTitle' task", () => {
    const { perform, success, failure } = testTask("SetDocTitle", { count: 0 });

    it("should provide perform", () => {
      expect(perform).toBeDefined();
    });

    it("should not provide success", () => {
      expect(success).toBeUndefined();
    });

    it("should not provide failure", () => {
      expect(failure).toBeUndefined();
    });
  });

});
