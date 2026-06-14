<script lang="ts">
  import { hud } from "./hudStore.svelte";

  const signs = [
    { kind: "igni", label: "Igni", key: "1" },
    { kind: "aard", label: "Aard", key: "2" },
    { kind: "quen", label: "Quen", key: "3" },
  ] as const;
</script>

<div class="bars">
  <div class="bar">
    <div
      class="fill health"
      style:width={`${(hud.health / hud.maxHealth) * 100}%`}
    ></div>
  </div>
  <div class="bar">
    <div
      class="fill stamina"
      style:width={`${(hud.stamina / hud.maxStamina) * 100}%`}
    ></div>
  </div>
</div>

<div class="signs">
  {#each signs as sign (sign.kind)}
    <div
      class="sign"
      class:selected={hud.selectedSign === sign.kind}
      class:lit={sign.kind === "quen" && hud.quenActive}
    >
      <span class="sign-label">{sign.label}</span>
      <span class="sign-key">{sign.key}</span>
      {#if hud.cooldowns[sign.kind] > 0}
        <div
          class="cooldown"
          style:height={`${hud.cooldowns[sign.kind] * 100}%`}
        ></div>
      {/if}
    </div>
  {/each}
</div>

{#if hud.dead}
  <div class="death" role="alert">
    <p class="death-title">You died</p>
    <p class="death-hint">Press Enter to try again</p>
  </div>
{/if}

<style>
  .bars {
    position: absolute;
    left: 16px;
    bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 220px;
  }

  .bar {
    height: 12px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 3px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    transition: width 120ms linear;
  }

  .fill.health {
    background: #c0392b;
  }

  .fill.stamina {
    background: #27ae60;
  }

  .signs {
    position: absolute;
    right: 16px;
    bottom: 16px;
    display: flex;
    gap: 8px;
  }

  .sign {
    position: relative;
    width: 56px;
    height: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-radius: 6px;
    color: #ddd;
    overflow: hidden;
  }

  .sign.selected {
    border-color: #f1c40f;
    color: #fff;
  }

  .sign.lit {
    box-shadow: 0 0 10px rgba(241, 196, 15, 0.8);
  }

  .sign-label {
    font-size: 13px;
    font-weight: 600;
  }

  .sign-key {
    font-size: 10px;
    opacity: 0.7;
  }

  .cooldown {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.65);
  }

  .death {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(20, 0, 0, 0.55);
    color: #eee;
  }

  .death-title {
    font-size: 42px;
    margin: 0 0 8px;
    color: #e74c3c;
  }

  .death-hint {
    font-size: 16px;
    margin: 0;
    opacity: 0.8;
  }
</style>
