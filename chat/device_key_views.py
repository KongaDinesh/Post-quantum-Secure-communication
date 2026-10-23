
import base64
import binascii
import hashlib
import json

from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import Exists, OuterRef, Prefetch
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .models import (
    Conversation,
    Message,
    MessageDeviceEnvelope,
    PQCDeviceKey,
)


ML_KEM_768_PUBLIC_KEY_BYTES = 1184
ML_KEM_768_CIPHERTEXT_BYTES = 1088
AES_GCM_NONCE_BYTES = 12
HKDF_SALT_BYTES = 16
MAX_ENVELOPE_BYTES = 10000
MAX_DEVICE_ENVELOPES = 100


def _json_body(request):
    """Return a JSON object or None for an invalid request body."""
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None

    return data if isinstance(data, dict) else None


def _decode_base64(value, field_name, max_length=20000):
    """Validate and decode a bounded Base64 string."""
    if not isinstance(value, str) or not value:
        raise ValueError(f"{field_name} must be a non-empty Base64 string.")

    if len(value) > max_length:
        raise ValueError(f"{field_name} is too large.")

    try:
        decoded = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError(f"{field_name} must be valid Base64.") from exc

    return decoded


def _validate_envelope(item):
    """Validate the format and lengths of one encrypted device envelope."""
    if not isinstance(item, dict):
        raise ValueError("Each device envelope must be a JSON object.")

    required = (
        "algorithm",
        "kem_ciphertext",
        "salt",
        "nonce",
        "ciphertext",
    )

    if any(
        not isinstance(item.get(field), str) or not item[field]
        for field in required
    ):
        raise ValueError("Encrypted package fields are missing.")

    if item["algorithm"] != "ML-KEM-768+AES-256-GCM":
        raise ValueError("Unsupported message encryption algorithm.")

    kem = _decode_base64(
        item["kem_ciphertext"],
        "kem_ciphertext",
        max_length=2000,
    )
    salt = _decode_base64(item["salt"], "salt", max_length=100)
    nonce = _decode_base64(item["nonce"], "nonce", max_length=100)
    ciphertext = _decode_base64(
        item["ciphertext"],
        "ciphertext",
        max_length=14000,
    )

    if len(kem) != ML_KEM_768_CIPHERTEXT_BYTES:
        raise ValueError("Invalid ML-KEM-768 ciphertext length.")

    if len(salt) != HKDF_SALT_BYTES:
        raise ValueError("Invalid HKDF salt length.")

    if len(nonce) != AES_GCM_NONCE_BYTES:
        raise ValueError("Invalid AES-GCM nonce length.")

    if not 16 <= len(ciphertext) <= MAX_ENVELOPE_BYTES:
        raise ValueError("Invalid AES-GCM ciphertext length.")

    # Require a canonical Base64 representation.
    for field, raw in (
        ("kem_ciphertext", kem),
        ("salt", salt),
        ("nonce", nonce),
        ("ciphertext", ciphertext),
    ):
        if base64.b64encode(raw).decode("ascii") != item[field]:
            raise ValueError(f"{field} is not canonically Base64 encoded.")

    return {
        "algorithm": item["algorithm"],
        "kem_ciphertext": item["kem_ciphertext"],
        "salt": item["salt"],
        "nonce": item["nonce"],
        "ciphertext": item["ciphertext"],
    }


@login_required
@require_POST
def register_device_key(request):
    """Register an ML-KEM-768 public key for the authenticated user's device."""
    data = _json_body(request)
    if data is None:
        return JsonResponse(
            {"error": "A valid JSON object is required."},
            status=400,
        )

    device_id = data.get("device_id")
    device_name = data.get("device_name", "Browser")
    algorithm = data.get("algorithm", "ML-KEM-768")
    public_key_b64 = data.get("public_key")

    if not isinstance(device_id, str) or not device_id.strip():
        return JsonResponse({"error": "device_id is required."}, status=400)

    if len(device_id) > 64:
        return JsonResponse({"error": "device_id is too long."}, status=400)

    if not isinstance(device_name, str) or not device_name.strip():
        return JsonResponse({"error": "A device name is required."}, status=400)

    if len(device_name) > 80:
        return JsonResponse({"error": "device_name is too long."}, status=400)

    if algorithm != "ML-KEM-768":
        return JsonResponse(
            {"error": "Unsupported key algorithm."},
            status=400,
        )

    try:
        raw_public_key = _decode_base64(
            public_key_b64,
            "public_key",
            max_length=2000,
        )
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    if len(raw_public_key) != ML_KEM_768_PUBLIC_KEY_BYTES:
        return JsonResponse(
            {"error": "Invalid ML-KEM-768 public key length."},
            status=400,
        )

    public_key_b64 = base64.b64encode(raw_public_key).decode("ascii")
    fingerprint = hashlib.sha256(raw_public_key).hexdigest()

    existing = PQCDeviceKey.objects.filter(
        user=request.user,
        device_id=device_id,
    ).first()

    if existing:
        # Never silently replace a registered key.
        if existing.public_key != public_key_b64:
            return JsonResponse(
                {
                    "error": (
                        "This device ID is registered with a different "
                        "public key. Use an explicit key-rotation process."
                    )
                },
                status=409,
            )

        existing.device_name = device_name.strip()
        existing.last_seen = timezone.now()
        existing.is_active = True
        existing.save(
            update_fields=[
                "device_name",
                "last_seen",
                "is_active",
                "updated_at",
            ]
        )
        device_key = existing
        created = False
    else:
        device_key = PQCDeviceKey.objects.create(
            user=request.user,
            device_id=device_id,
            device_name=device_name.strip(),
            algorithm=algorithm,
            public_key=public_key_b64,
            fingerprint=fingerprint,
            is_active=True,
            last_seen=timezone.now(),
        )
        created = True

    return JsonResponse(
        {
            "status": "registered" if created else "already_registered",
            "device_key_id": device_key.pk,
            "device_id": device_key.device_id,
            "algorithm": device_key.algorithm,
            "fingerprint": device_key.fingerprint,
            "created": created,
        },
        status=201 if created else 200,
    )


@login_required
@require_GET
def conversation_device_keys(request, conversation_id):
    """Return active public keys for all devices in the conversation."""
    conversation = get_object_or_404(
        Conversation,
        pk=conversation_id,
        participants=request.user,
    )

    participant_ids = conversation.participants.values_list("id", flat=True)

    device_keys = (
        PQCDeviceKey.objects.filter(
            user_id__in=participant_ids,
            is_active=True,
            algorithm="ML-KEM-768",
        )
        .select_related("user")
        .order_by("user_id", "created_at", "id")
    )

    return JsonResponse(
        {
            "conversation_id": conversation.pk,
            "device_keys": [
                {
                    "id": key.pk,
                    "user_id": key.user_id,
                    "username": key.user.username,
                    "device_id": key.device_id,
                    "device_name": key.device_name,
                    "algorithm": key.algorithm,
                    "public_key": key.public_key,
                    "fingerprint": key.fingerprint,
                }
                for key in device_keys
            ],
        }
    )


@transaction.atomic
@login_required
@require_POST
def send_device_encrypted_message(request, conversation_id):
    """Store a separate encrypted envelope for each active conversation device."""
    if len(request.body) > 2_000_000:
        return JsonResponse({"error": "Request body is too large."}, status=413)

    conversation = get_object_or_404(
        Conversation.objects.filter(participants=request.user).distinct(),
        pk=conversation_id,
    )

    data = _json_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON object."}, status=400)

    sender_device_id = data.get("sender_device_id")
    envelopes = data.get("device_envelopes")

    if not isinstance(sender_device_id, str) or not sender_device_id:
        return JsonResponse(
            {"error": "sender_device_id is required."},
            status=400,
        )

    if len(sender_device_id) > 64:
        return JsonResponse({"error": "sender_device_id is too long."}, status=400)

    if (
        not isinstance(envelopes, list)
        or not 1 <= len(envelopes) <= MAX_DEVICE_ENVELOPES
    ):
        return JsonResponse(
            {
                "error": (
                    f"Provide between 1 and {MAX_DEVICE_ENVELOPES} "
                    "device envelopes."
                )
            },
            status=400,
        )

    participant_ids = conversation.participants.values_list("id", flat=True)

    active_keys = list(
        PQCDeviceKey.objects.filter(
            user_id__in=participant_ids,
            is_active=True,
            algorithm="ML-KEM-768",
        )
        .select_related("user")
        .order_by("id")
    )
    keys_by_id = {key.id: key for key in active_keys}

    sender_key = next(
        (
            key for key in active_keys
            if key.user_id == request.user.id
            and key.device_id == sender_device_id
        ),
        None,
    )

    if sender_key is None:
        return JsonResponse(
            {"error": "The sending device is not registered or active."},
            status=409,
        )

    supplied_ids = []

    for item in envelopes:
        if not isinstance(item, dict):
            return JsonResponse(
                {"error": "Each device envelope must be an object."},
                status=400,
            )

        key_id = item.get("device_key_id")
        if isinstance(key_id, bool) or not isinstance(key_id, int):
            return JsonResponse(
                {"error": "Each envelope needs an integer device_key_id."},
                status=400,
            )

        supplied_ids.append(key_id)

    if len(supplied_ids) != len(set(supplied_ids)):
        return JsonResponse(
            {"error": "Duplicate device envelopes are not allowed."},
            status=400,
        )

    # Prevent partial delivery if devices were added or deactivated after
    # the browser fetched the device-key list.
    if set(supplied_ids) != set(keys_by_id):
        return JsonResponse(
            {
                "error": (
                    "The active device list changed or is incomplete. "
                    "Fetch the current device keys and encrypt again."
                )
            },
            status=409,
        )

    packages_by_key = {}

    for item in envelopes:
        key_id = item["device_key_id"]

        if key_id not in keys_by_id:
            return JsonResponse(
                {"error": "Unknown or inactive device key."},
                status=400,
            )

        try:
            packages_by_key[key_id] = _validate_envelope(item)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=400)

    own_package = packages_by_key[sender_key.id]

    recipient_package = next(
        (
            packages_by_key[key.id]
            for key in active_keys
            if key.user_id != request.user.id
        ),
        None,
    )

    if recipient_package is None:
        return JsonResponse(
            {"error": "No active recipient device key is registered."},
            status=409,
        )

    # These legacy fields allow existing message records to remain readable
    # by the old API. New multi-device clients should use envelopes instead.
    message = Message.objects.create(
        conversation=conversation,
        sender=request.user.username,
        sender_user=request.user,
        content="",
        encrypted_content=recipient_package["ciphertext"],
        kem_ciphertext=recipient_package["kem_ciphertext"],
        encryption_salt=recipient_package["salt"],
        encryption_nonce=recipient_package["nonce"],
        encryption_version="device-v1",
        sender_copy_ciphertext=own_package["ciphertext"],
        sender_copy_kem_ciphertext=own_package["kem_ciphertext"],
        sender_copy_salt=own_package["salt"],
        sender_copy_nonce=own_package["nonce"],
        sender_copy_algorithm=own_package["algorithm"],
    )

    MessageDeviceEnvelope.objects.bulk_create(
        [
            MessageDeviceEnvelope(
                message=message,
                device_key=keys_by_id[key_id],
                algorithm=package["algorithm"],
                kem_ciphertext=package["kem_ciphertext"],
                salt=package["salt"],
                nonce=package["nonce"],
                ciphertext=package["ciphertext"],
            )
            for key_id, package in packages_by_key.items()
        ]
    )

    return JsonResponse(
        {
            "status": "stored",
            "message_id": message.id,
            "envelope_count": len(packages_by_key),
            "created_at": message.created_at.isoformat(),
        },
        status=201,
    )


@login_required
@require_GET
def get_device_encrypted_messages(request, conversation_id):
    """Return envelopes addressed to the requesting active device."""
    conversation = get_object_or_404(
        Conversation.objects.filter(participants=request.user).distinct(),
        pk=conversation_id,
    )

    device_id = request.GET.get("device_id")
    if not device_id:
        return JsonResponse({"error": "device_id is required."}, status=400)

    device_key = get_object_or_404(
        PQCDeviceKey,
        user=request.user,
        device_id=device_id,
        is_active=True,
        algorithm="ML-KEM-768",
    )

    messages = (
        conversation.messages
        .annotate(
            has_device_envelopes=Exists(
                MessageDeviceEnvelope.objects.filter(
                    message_id=OuterRef("pk")
                )
            )
        )
        .prefetch_related(
            Prefetch(
                "device_envelopes",
                queryset=MessageDeviceEnvelope.objects.filter(
                    device_key=device_key
                ),
                to_attr="current_device_envelopes",
            )
        )
        .order_by("created_at", "id")
    )

    result = []

    for message in messages:
        is_mine = message.sender_user_id == request.user.id
        envelopes = message.current_device_envelopes
        package = None

        if envelopes:
            envelope = envelopes[0]
            package = {
                "algorithm": envelope.algorithm,
                "kem_ciphertext": envelope.kem_ciphertext,
                "salt": envelope.salt,
                "nonce": envelope.nonce,
                "ciphertext": envelope.ciphertext,
            }

        if package:
            fields = package
            sender_copy = package if is_mine else None
            delivery_available = True
        else:
            # Do not attempt decryption using an envelope addressed to
            # another device, or assume legacy messages target this key.
            fields = {
                "algorithm": "",
                "kem_ciphertext": "",
                "salt": "",
                "nonce": "",
                "ciphertext": "",
            }
            sender_copy = None
            delivery_available = False

        result.append(
            {
                "id": message.id,
                "sender": message.sender,
                "sender_user_id": message.sender_user_id,
                "created_at": message.created_at.isoformat(),
                **fields,
                "sender_copy": sender_copy,
                "delivery_available": delivery_available,"has_device_envelopes": message.has_device_envelopes,
            }
        )

    return JsonResponse({"messages": result})
