// main.js
import { Application } from './controllers/Application';

async function startApp() {
  try {
    const app = new Application();
    await app.init();
    app.start();
  } catch (error) {
    console.error("Error starting application:", error);
  }
}

// Start the application
startApp();