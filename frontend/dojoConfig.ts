import { createDojoConfig } from "@dojoengine/core";
import manifest from "../contract/manifest_sepolia.json";

export const dojoConfig = createDojoConfig({
  manifest,
  rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia",
  toriiUrl: "https://api.cartridge.gg/x/your-slot-deployment-name/torii", // Replace with your Torii server URL
  relayUrl: "/dns4/api.cartridge.gg/tcp/443/x-parity-wss/%2Fx%2Fyour-slot-deployment-name%2Ftorii%2Fwss", // Replace with your relay URL
});

