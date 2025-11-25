export function validateCount(num: number): Promise<{ text: string }> {
  return new Promise((resolve) => {
    // Mock async
    setTimeout(
      () =>
        resolve({
          text: num % 2 === 0 ? "✓ Even" : "x Odd"
        }),
      500
    );
  });
}
