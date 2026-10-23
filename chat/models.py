
from django.db import models
from django.contrib.auth.models import User


class UserPQCKey(models.Model):
    # Each user has one ML-KEM-768 public key.
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="pqc_key",
    )

    # Base64-encoded ML-KEM-768 public key.
    public_key = models.TextField()

    # Identifies the algorithm and key format.
    algorithm = models.CharField(
        max_length=30,
        default="ML-KEM-768",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"PQC public key for {self.user.username}"


class Conversation(models.Model):
    participants = models.ManyToManyField(
        User,
        related_name="conversations",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Conversation {self.id}"


class Message(models.Model):

    # KEM ciphertext and HKDF salt required for recipient decryption.
    kem_ciphertext = models.TextField(blank=True, default="")
    encryption_salt = models.CharField(max_length=100, blank=True, default="")

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
        null=True,
        blank=True,
    )

    sender = models.CharField(max_length=100)

    sender_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_messages",
    )

    # Legacy plaintext field for existing messages.
    content = models.TextField(
        max_length=2000,
        blank=True,
        default="",
    )

        # Client-encrypted message data.
    encrypted_content = models.TextField(blank=True, default="")
    encryption_nonce = models.CharField(max_length=100, blank=True, default="")
    encryption_version = models.CharField(max_length=20, blank=True, default="")

    # Separate encrypted copy for the sender's own message history.
    sender_copy_ciphertext = models.TextField(blank=True, default="")
    sender_copy_kem_ciphertext = models.TextField(blank=True, default="")
    sender_copy_salt = models.CharField(max_length=100, blank=True, default="")
    sender_copy_nonce = models.CharField(max_length=100, blank=True, default="")
    sender_copy_algorithm = models.CharField(max_length=50, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)




    def __str__(self):
        if self.encrypted_content:
            return f"{self.sender}: [encrypted message]"
        return f"{self.sender}: {self.content[:40]}"

class PQCDeviceKey(models.Model):
    """An ML-KEM-768 public key registered for one user's device."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="pqc_device_keys",
    )

    device_id = models.CharField(max_length=64)
    device_name = models.CharField(max_length=80, default="Browser")
    algorithm = models.CharField(max_length=30, default="ML-KEM-768")

    # Base64-encoded public key. Never store the private key here.
    public_key = models.TextField()
    fingerprint = models.CharField(max_length=64)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_seen = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "device_id"],
                name="uniq_pqc_user_device",
            ),
        ]
        indexes = [
            models.Index(
                fields=["user", "is_active"],
                name="pqcdev_user_active",
            ),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.device_name}"


class MessageDeviceEnvelope(models.Model):
    """An encrypted message package addressed to one device."""

    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="device_envelopes",
    )

    device_key = models.ForeignKey(
        PQCDeviceKey,
        on_delete=models.CASCADE,
        related_name="message_envelopes",
    )

    algorithm = models.CharField(
        max_length=50,
        default="ML-KEM-768+AES-256-GCM",
    )

    kem_ciphertext = models.TextField()
    salt = models.CharField(max_length=64)
    nonce = models.CharField(max_length=64)
    ciphertext = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["message", "device_key"],
                name="uniq_message_device_envelope",
            ),
        ]

    def __str__(self):
        return (
            f"Envelope for message {self.message_id} "
            f"and device {self.device_key.device_name}"
        )
