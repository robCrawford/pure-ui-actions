import { isNegative } from "./validation";

describe("Validation service", function() {

  it("should detect negative numbers", () => {
    expect(isNegative(1)).toBe(false);
    expect(isNegative(0)).toBe(false);
    expect(isNegative(-1)).toBe(true);
  });

});
