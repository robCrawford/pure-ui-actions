import { testComponent, NextData } from "pure-ui-actions";
import notification, { State } from "./notification";

describe("Notification component", () => {
  const { initialState, action } = testComponent(notification, {
    text: "test",
    onDismiss: "passedInAction"
  });

  it("should set initial state", () => {
    expect(initialState).toEqual({ show: true });
  });

  describe("'Dismiss' action", () => {
    const { state, next } = action<State>("Dismiss");

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        show: false
      });
    });

    it("should return next", () => {
      expect(next).toBe("passedInAction");
    });
  });

});
