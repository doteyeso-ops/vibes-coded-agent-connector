import { VibesCodedClient, signerFromWallet } from "../sdk.js";
import type { WalletOrKeypair } from "../types.js";

export function createVibesCodedSolanaAgentKitClient(
  walletOrKeypair: WalletOrKeypair,
  options?: ConstructorParameters<typeof VibesCodedClient>[0]
) {
  return new VibesCodedClient({
    ...options,
    walletSigner: signerFromWallet(walletOrKeypair),
  });
}
