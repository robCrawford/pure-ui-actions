export function isNegative(n: number): boolean {
  return n < 0;
}

export function validateCount(n: number): Promise<{ text: string }> {
  // Mock async
  return new Promise((resolve) => {
    setTimeout(() => resolve({ text: isNegative(n) ? "x Invalid" : "✓ Valid" }), 500);
  });
}
