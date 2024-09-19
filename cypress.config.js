const { defineConfig } = require("cypress");
const dotenv = require('dotenv'); // Importamos dotenv
const { approveAndLockTokens } = require("./src/main");

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // Cargar variables desde el archivo .env
      const env = dotenv.config().parsed;
      config.env = { ...config.env, ...env };

      // Definir tarea personalizada approveAndLockTokens
      on('task', {
        approveAndLockTokens: async ({ withdrawalAddress, tokenAddress }) => {
          try {
            const result = await approveAndLockTokens(withdrawalAddress, tokenAddress);
            return { lockId: result.toString() };
          } catch (error) {
            return { error: error.message };
          }
        },
      });

      return config; // Retornar la configuración
    },
    defaultCommandTimeout: 180000,
    taskTimeout: 300000,
  }
});
