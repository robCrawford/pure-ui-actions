
export function setDocTitle(title: string): Promise<void> {
  document.title = title;

  // Mock async
  return new Promise((resolve): void => {
    setTimeout(resolve, 1000)
  });

}
