<script lang="ts">
  import { onMount } from "svelte";
  import { type Game, startGame } from "./core/game";
  import { hud } from "./ui/hudStore";
  import Hud from "./ui/Hud.svelte";

  let canvas: HTMLCanvasElement | undefined = $state();
  let bootError: string | undefined = $state();

  onMount(() => {
    let game: Game | undefined;
    let disposed = false;
    if (canvas) {
      startGame(canvas)
        .then((g) => {
          if (disposed) {
            g.dispose();
          } else {
            game = g;
          }
        })
        .catch((err: unknown) => {
          bootError = err instanceof Error ? err.message : String(err);
          console.error("Game startup failed:", err);
        });
    }
    return () => {
      disposed = true;
      game?.dispose();
    };
  });
</script>

<canvas bind:this={canvas} id="game-canvas"></canvas>
<div id="overlay-root">
  <div class="fps">{Math.round(hud.fps)} FPS</div>
  <Hud />
  {#if bootError}
    <div class="boot-error" role="alert">Failed to start: {bootError}</div>
  {/if}
</div>

<style>
  #game-canvas {
    width: 100%;
    height: 100%;
    display: block;
    outline: none;
  }

  #overlay-root {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .fps {
    position: absolute;
    top: 8px;
    right: 12px;
    color: #fff;
    font-size: 12px;
    opacity: 0.7;
  }

  .boot-error {
    position: absolute;
    top: 40%;
    width: 100%;
    text-align: center;
    color: #f66;
    font-size: 16px;
  }
</style>
