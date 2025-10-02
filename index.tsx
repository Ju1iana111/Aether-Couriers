import { applyAllContent } from './modules/apply-content';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const loadingScreen = document.getElementById('loading-screen') as HTMLDivElement;

  if (!canvas || !loadingScreen) {
    console.error("Essential HTML elements are missing!");
    document.body.innerHTML = '<div style="color: red; font-family: sans-serif; padding: 20px;">Critical Error: Required HTML elements for the game are missing.</div>';
    return;
  }

  // The new content loading and game initialization logic
  applyAllContent(canvas, loadingScreen).catch(error => {
      console.error("Game initialization failed:", error);
      // The error is already displayed on the loading screen by apply-content
  });

  // Optional: Handle graceful shutdown
  window.addEventListener('beforeunload', () => {
      // Any cleanup logic can go here
      console.log("Game shutting down.");
  });
});
