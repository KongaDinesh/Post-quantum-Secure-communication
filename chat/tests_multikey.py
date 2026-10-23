
import base64
import hashlib
import json
import os

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import (
    Conversation,
    Message,
    MessageDeviceEnvelope,
    PQCDeviceKey,
)


class MultiKeyApiTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(
            username="alice_test",
            password="Test-password-123!",
        )
        self.bob = User.objects.create_user(
            username="bob_test",
            password="Test-password-456!",
        )
        self.other = User.objects.create_user(
            username="other_test",
            password="Test-password-789!",
        )

        self.conversation = Conversation.objects.create()
        self.conversation.participants.add(self.alice, self.bob)
        self.client.force_login(self.alice)

    @staticmethod
    def make_public_key():
        # Synthetic bytes for API tests, not a real ML-KEM key pair.
        raw = os.urandom(1184)
        return (
            base64.b64encode(raw).decode("ascii"),
            hashlib.sha256(raw).hexdigest(),
        )

    def create_device_key(self, user, device_id, device_name=None):
        public_key, fingerprint = self.make_public_key()
        return PQCDeviceKey.objects.create(
            user=user,
            device_id=device_id,
            device_name=device_name or f"{user.username} browser",
            algorithm="ML-KEM-768",
            public_key=public_key,
            fingerprint=fingerprint,
            is_active=True,
        )

    @staticmethod
    def make_envelope(device_key_id):
        # Correct encoded field sizes for API validation, not real crypto.
        return {
            "device_key_id": device_key_id,
            "algorithm": "ML-KEM-768+AES-256-GCM",
            "kem_ciphertext": base64.b64encode(
                os.urandom(1088)
            ).decode("ascii"),
            "salt": base64.b64encode(
                os.urandom(16)
            ).decode("ascii"),
            "nonce": base64.b64encode(
                os.urandom(12)
            ).decode("ascii"),
            "ciphertext": base64.b64encode(
                os.urandom(32)
            ).decode("ascii"),
        }

    def post_json(self, url, payload):
        return self.client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
        )

    def register_device_payload(self, device_id, public_key):
        return {
            "device_id": device_id,
            "device_name": "Test Browser",
            "algorithm": "ML-KEM-768",
            "public_key": public_key,
        }

    def test_register_device_key(self):
        public_key, fingerprint = self.make_public_key()
        response = self.post_json(
            reverse("register_device_key"),
            self.register_device_payload("test-device-1", public_key),
        )

        self.assertEqual(response.status_code, 201)
        key = PQCDeviceKey.objects.get(
            user=self.alice,
            device_id="test-device-1",
        )
        self.assertEqual(key.fingerprint, fingerprint)

    def test_same_device_key_is_idempotent(self):
        public_key, _ = self.make_public_key()
        payload = self.register_device_payload(
            "test-device-1", public_key
        )

        first = self.post_json(reverse("register_device_key"), payload)
        second = self.post_json(reverse("register_device_key"), payload)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(
            PQCDeviceKey.objects.filter(user=self.alice).count(),
            1,
        )

    def test_different_key_for_same_device_is_rejected(self):
        public_key, _ = self.make_public_key()
        payload = self.register_device_payload(
            "test-device-1", public_key
        )
        first = self.post_json(reverse("register_device_key"), payload)
        self.assertEqual(first.status_code, 201)

        replacement_key, _ = self.make_public_key()
        payload["public_key"] = replacement_key
        response = self.post_json(reverse("register_device_key"), payload)

        self.assertEqual(response.status_code, 409)

    def test_conversation_returns_participant_device_keys(self):
        alice_key, alice_fingerprint = self.make_public_key()
        bob_key, bob_fingerprint = self.make_public_key()

        PQCDeviceKey.objects.create(
            user=self.alice,
            device_id="alice-device",
            device_name="Alice Browser",
            algorithm="ML-KEM-768",
            public_key=alice_key,
            fingerprint=alice_fingerprint,
        )
        PQCDeviceKey.objects.create(
            user=self.bob,
            device_id="bob-device",
            device_name="Bob Laptop",
            algorithm="ML-KEM-768",
            public_key=bob_key,
            fingerprint=bob_fingerprint,
        )

        response = self.client.get(
            reverse(
                "conversation_device_keys",
                kwargs={"conversation_id": self.conversation.id},
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["device_keys"]), 2)

    def test_nonparticipant_cannot_get_conversation_keys(self):
        self.client.force_login(self.other)
        response = self.client.get(
            reverse(
                "conversation_device_keys",
                kwargs={"conversation_id": self.conversation.id},
            )
        )
        self.assertEqual(response.status_code, 404)

    def test_send_creates_one_envelope_for_each_active_device(self):
        alice_key = self.create_device_key(self.alice, "alice-device")
        bob_key = self.create_device_key(self.bob, "bob-device")
        alice_package = self.make_envelope(alice_key.id)
        bob_package = self.make_envelope(bob_key.id)

        response = self.post_json(
            reverse(
                "send_device_encrypted_message",
                kwargs={"conversation_id": self.conversation.id},
            ),
            {
                "sender_device_id": "alice-device",
                "device_envelopes": [alice_package, bob_package],
            },
        )

        self.assertEqual(response.status_code, 201, response.content.decode())
        body = response.json()
        self.assertEqual(body["status"], "stored")
        self.assertEqual(body["envelope_count"], 2)

        message = Message.objects.get(pk=body["message_id"])
        self.assertEqual(message.sender_user, self.alice)
        self.assertEqual(message.encryption_version, "device-v1")
        self.assertEqual(message.device_envelopes.count(), 2)

        alice_saved = MessageDeviceEnvelope.objects.get(
            message=message, device_key=alice_key
        )
        bob_saved = MessageDeviceEnvelope.objects.get(
            message=message, device_key=bob_key
        )
        self.assertEqual(alice_saved.ciphertext, alice_package["ciphertext"])
        self.assertEqual(bob_saved.ciphertext, bob_package["ciphertext"])

    def test_send_rejects_incomplete_device_envelope_list(self):
        alice_key = self.create_device_key(self.alice, "alice-device")
        self.create_device_key(self.bob, "bob-device")

        response = self.post_json(
            reverse(
                "send_device_encrypted_message",
                kwargs={"conversation_id": self.conversation.id},
            ),
            {
                "sender_device_id": "alice-device",
                "device_envelopes": [self.make_envelope(alice_key.id)],
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(Message.objects.count(), 0)
        self.assertEqual(MessageDeviceEnvelope.objects.count(), 0)

    def test_nonparticipant_cannot_send_device_message(self):
        self.client.force_login(self.other)
        response = self.post_json(
            reverse(
                "send_device_encrypted_message",
                kwargs={"conversation_id": self.conversation.id},
            ),
            {"sender_device_id": "unknown", "device_envelopes": []},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(Message.objects.count(), 0)

    def test_retrieval_returns_only_the_requesting_devices_envelope(self):
        alice_key = self.create_device_key(self.alice, "alice-device")
        bob_key = self.create_device_key(self.bob, "bob-device")
        alice_package = self.make_envelope(alice_key.id)
        bob_package = self.make_envelope(bob_key.id)

        sent = self.post_json(
            reverse(
                "send_device_encrypted_message",
                kwargs={"conversation_id": self.conversation.id},
            ),
            {
                "sender_device_id": "alice-device",
                "device_envelopes": [alice_package, bob_package],
            },
        )
        self.assertEqual(sent.status_code, 201, sent.content.decode())
        message_id = sent.json()["message_id"]

        messages_url = reverse(
            "get_device_encrypted_messages",
            kwargs={"conversation_id": self.conversation.id},
        )

        alice_response = self.client.get(
            messages_url, {"device_id": "alice-device"}
        )
        self.assertEqual(alice_response.status_code, 200)
        alice_message = next(
            item for item in alice_response.json()["messages"]
            if item["id"] == message_id
        )
        self.assertTrue(alice_message["delivery_available"])
        self.assertTrue(alice_message["has_device_envelopes"])
        self.assertEqual(
            alice_message["ciphertext"], alice_package["ciphertext"]
        )
        self.assertIsNotNone(alice_message["sender_copy"])

        self.client.force_login(self.bob)
        bob_response = self.client.get(
            messages_url, {"device_id": "bob-device"}
        )
        self.assertEqual(bob_response.status_code, 200)
        bob_message = next(
            item for item in bob_response.json()["messages"]
            if item["id"] == message_id
        )
        self.assertTrue(bob_message["delivery_available"])
        self.assertTrue(bob_message["has_device_envelopes"])
        self.assertEqual(
            bob_message["ciphertext"], bob_package["ciphertext"]
        )
        self.assertIsNone(bob_message["sender_copy"])
        self.assertNotEqual(
            alice_message["ciphertext"], bob_message["ciphertext"]
        )

    def test_retrieval_requires_device_id(self):
        response = self.client.get(
            reverse(
                "get_device_encrypted_messages",
                kwargs={"conversation_id": self.conversation.id},
            )
        )
        self.assertEqual(response.status_code, 400)

    def test_nonparticipant_cannot_retrieve_device_messages(self):
        self.client.force_login(self.other)
        response = self.client.get(
            reverse(
                "get_device_encrypted_messages",
                kwargs={"conversation_id": self.conversation.id},
            ),
            {"device_id": "alice-device"},
        )
        self.assertEqual(response.status_code, 404)
