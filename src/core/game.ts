export interface Game {
  dispose(): void;
}

export async function startGame(canvas: HTMLCanvasElement): Promise<Game> {
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#223";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  console.log("Wolfsbane: game stub started");
  return { dispose() {} };
}
