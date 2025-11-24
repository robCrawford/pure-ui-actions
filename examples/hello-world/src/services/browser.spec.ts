import { setDocTitle } from "./browser";

describe("Browser service", function() {

  it("should set document title", () => {
    return setDocTitle("testTitle").then(() => {
      expect(document.title).toEqual("testTitle");
    });
  });

});
