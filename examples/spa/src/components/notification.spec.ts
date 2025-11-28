import { componentTest, ThunkType, ActionThunk } from "pure-ui-actions";
import notification, { State, Component } from "./notification";

const passedInActionThunk: ActionThunk = () => {};
passedInActionThunk.type = ThunkType.Action;

describe("Notification component", () => {
  const { initialState, actionTest } = componentTest<Component>(notification, {
    text: "test",
    onDismiss: passedInActionThunk
  });

  it("should set initial state", () => {
    expect(initialState).toEqual({ show: true });
  });

  describe("'Dismiss' action", () => {
    const { state, next } = actionTest<State>("Dismiss");

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        show: false
      });
    });

    it("should return next", () => {
      expect(next).toBe(passedInActionThunk);
    });
  });
});
