<script lang="ts">
  import { onMount } from "svelte";
  import { type Game, startGame } from "./core/game";

  let canvas: HTMLCanvasElement | undefined = $state();

  onMount(() => {
    let game: Game | undefined;
    if (canvas) {
      startGame(canvas).then((g) => {
        game = g;
      });
    }
    return () => game?.dispose();
  });
</script>

<canvas bind:this={canvas} id="game-canvas"></canvas>
<div id="overlay-root"></div>

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
</style>
