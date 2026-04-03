import { VibesCodedClient, signerFromWallet } from "../sdk";
import type { WalletOrKeypair } from "../types";

export function createVibesCodedSolanaAgentKitClient(
  walletOrKeypair: WalletOrKeypair,
  options?: ConstructorParameters<typeof VibesCodedClient>[0]
) {
  return new VibesCodedClient({
    ...options,
    walletSigner: signerFromWallet(walletOrKeypair),
  });
}
