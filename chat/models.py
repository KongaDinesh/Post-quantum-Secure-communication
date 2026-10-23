
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
