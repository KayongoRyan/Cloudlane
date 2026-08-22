from __future__ import annotations

from services.secrets_crypto import decrypt_secret, encrypt_secret


class LocalSecretVaultProvider:
    """Encrypts secret values at rest using SECRETS_MASTER_KEY / JWT_SECRET."""

    def is_ready(self) -> bool:
        return True

    def seal(self, plaintext: str) -> str:
        return encrypt_secret(plaintext)

    def unseal(self, ciphertext: str) -> str:
        return decrypt_secret(ciphertext)


def get_secret_vault_provider() -> LocalSecretVaultProvider:
    return LocalSecretVaultProvider()
