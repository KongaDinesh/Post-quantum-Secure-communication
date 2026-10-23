import base64
import binascii
import json

from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from .models import Conversation, Message, UserPQCKey


def register(request):
    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("login")
    else:
        form = UserCreationForm()

    return render(request, "chat/register.html", {"form": form})


@login_required
def index(request):
    users = User.objects.exclude(id=request.user.id).order_by("username")
    conversations = (
        Conversation.objects
        .filter(participants=request.user)
        .distinct()
        .order_by("-created_at")
    )
    return render(request, "chat/index.html", {
        "users": users,
        "conversations": conversations,
    })


@login_required
def start_conversation(request, user_id):
    recipient = get_object_or_404(User, id=user_id)
    if recipient == request.user:
        return redirect("chat_home")

    expected_participant_ids = {request.user.id, recipient.id}
    candidates = (
        Conversation.objects
        .filter(participants=request.user)
        .filter(participants=recipient)
        .distinct()
        .order_by("-created_at", "-id")
    )

    matching_conversations = []
    for candidate in candidates:
        participant_ids = set(
            candidate.participants.values_list("id", flat=True)
        )
        if participant_ids == expected_participant_ids:
            matching_conversations.append(candidate)

    # Prefer a conversation that already contains messages, to preserve history.
    conversation = next(
        (
            candidate for candidate in matching_conversations
            if candidate.messages.exists()
        ),
        None,
    )
    if conversation is None and matching_conversations:
        conversation = matching_conversations[0]

    if conversation is None:
        conversation = Conversation.objects.create()
        conversation.participants.add(request.user, recipient)

    return redirect(
        "conversation_detail",
        conversation_id=conversation.id,
    )


@login_required
@require_POST
@csrf_protect
def register_pqc_key(request):
    """Register the logged-in user's ML-KEM-768 public key.

    WARNING: update_or_create permits key replacement and is only a temporary
    local-development behavior. Production key changes need a verified rotation
    procedure to prevent impersonation and loss of access to old messages.
    """
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    if not isinstance(data, dict):
        return JsonResponse({"error": "JSON object required."}, status=400)
    if data.get("algorithm") != "ML-KEM-768":
        return JsonResponse({"error": "Unsupported algorithm."}, status=400)

    encoded_key = data.get("public_key")
    if not isinstance(encoded_key, str) or not encoded_key:
        return JsonResponse({"error": "Public key is required."}, status=400)

    try:
        public_key = base64.b64decode(encoded_key, validate=True)
    except (binascii.Error, ValueError):
        return JsonResponse(
            {"error": "Public key must be valid Base64."}, status=400
        )

    # ML-KEM-768 public keys are exactly 1184 bytes.
    if len(public_key) != 1184:
        return JsonResponse(
            {"error": "Invalid ML-KEM-768 public key length."}, status=400
        )

    key_record, created = UserPQCKey.objects.update_or_create(
        user=request.user,
        defaults={
            "public_key": encoded_key,
            "algorithm": "ML-KEM-768",
        },
    )
    return JsonResponse({
        "status": "registered" if created else "updated",
        "algorithm": key_record.algorithm,
    })


@login_required
def conversation_detail(request, conversation_id):
    conversation = get_object_or_404(
        Conversation.objects.filter(participants=request.user).distinct(),
        id=conversation_id,
    )
    if request.method == "POST":
        return render(request, "chat/conversation.html", {
            "conversation": conversation,
            "messages": conversation.messages.order_by("created_at"),
            "error": "Message sending is handled by the encrypted-message endpoint.",
        }, status=400)

    return render(request, "chat/conversation.html", {
        "conversation": conversation,
        "messages": conversation.messages.order_by("created_at"),
    })


@login_required
def get_pqc_public_key(request, user_id):
    """Return another user's registered ML-KEM-768 public key."""
    recipient = get_object_or_404(User, id=user_id)
    expected_participant_ids = {request.user.id, recipient.id}
    shared_conversation = False

    candidate_conversations = (
        Conversation.objects
        .filter(participants=request.user)
        .filter(participants=recipient)
        .distinct()
    )
    for conversation in candidate_conversations:
        participant_ids = set(
            conversation.participants.values_list("id", flat=True)
        )
        if participant_ids == expected_participant_ids:
            shared_conversation = True
            break

    if not shared_conversation:
        return JsonResponse(
            {"error": "You do not share a conversation with this user."},
            status=403,
        )

    try:
        key_record = recipient.pqc_key
    except UserPQCKey.DoesNotExist:
        return JsonResponse(
            {"error": "This user has not registered a PQC public key."},
            status=404,
        )

    return JsonResponse({
        "username": recipient.username,
        "algorithm": key_record.algorithm,
        "public_key": key_record.public_key,
    })


def logout_view(request):
    if request.method == "POST":
        logout(request)
        return redirect("login")
    return redirect("chat_home")


@login_required
@require_POST
@csrf_protect
def send_encrypted_message(request, conversation_id):
    """Validate and store encrypted packages; never receives plaintext."""
    conversation = get_object_or_404(
        Conversation.objects.filter(participants=request.user).distinct(),
        id=conversation_id,
    )

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({"error": "JSON object required."}, status=400)

    required_fields = [
        "algorithm", "kem_ciphertext", "salt", "nonce", "ciphertext"
    ]
    if any(
        not isinstance(data.get(field), str) or not data[field]
        for field in required_fields
    ):
        return JsonResponse(
            {"error": "All encrypted-message fields are required."},
            status=400,
        )
    if data["algorithm"] != "ML-KEM-768+AES-256-GCM":
        return JsonResponse({"error": "Unsupported encryption algorithm."}, status=400)

    try:
        kem_ciphertext = base64.b64decode(data["kem_ciphertext"], validate=True)
        salt = base64.b64decode(data["salt"], validate=True)
        nonce = base64.b64decode(data["nonce"], validate=True)
        ciphertext = base64.b64decode(data["ciphertext"], validate=True)
    except (binascii.Error, ValueError):
        return JsonResponse(
            {"error": "Encrypted fields must use valid Base64."}, status=400
        )

    if len(kem_ciphertext) != 1088:
        return JsonResponse(
            {"error": "Invalid ML-KEM-768 ciphertext length."}, status=400
        )
    if len(salt) != 16 or len(nonce) != 12:
        return JsonResponse(
            {"error": "Invalid encryption salt or nonce length."}, status=400
        )
    if len(ciphertext) < 16 or len(ciphertext) > 10000:
        return JsonResponse(
            {"error": "Encrypted message size is invalid."}, status=400
        )

    sender_copy = data.get("sender_copy")
    sender_copy_values = {
        "sender_copy_ciphertext": "",
        "sender_copy_kem_ciphertext": "",
        "sender_copy_salt": "",
        "sender_copy_nonce": "",
        "sender_copy_algorithm": "",
    }

    if sender_copy is not None:
        if not isinstance(sender_copy, dict):
            return JsonResponse({"error": "Invalid sender-copy package."}, status=400)

        sender_fields = [
            "algorithm", "kem_ciphertext", "salt", "nonce", "ciphertext"
        ]
        if any(
            not isinstance(sender_copy.get(field), str) or not sender_copy[field]
            for field in sender_fields
        ):
            return JsonResponse(
                {"error": "Sender-copy fields are required."}, status=400
            )
        if sender_copy["algorithm"] != "ML-KEM-768+AES-256-GCM":
            return JsonResponse(
                {"error": "Unsupported sender-copy algorithm."}, status=400
            )

        try:
            sender_kem = base64.b64decode(
                sender_copy["kem_ciphertext"], validate=True
            )
            sender_salt = base64.b64decode(sender_copy["salt"], validate=True)
            sender_nonce = base64.b64decode(sender_copy["nonce"], validate=True)
            sender_ciphertext = base64.b64decode(
                sender_copy["ciphertext"], validate=True
            )
        except (binascii.Error, ValueError):
            return JsonResponse(
                {"error": "Invalid Base64 in sender-copy package."}, status=400
            )

        if (
            len(sender_kem) != 1088
            or len(sender_salt) != 16
            or len(sender_nonce) != 12
            or not 16 <= len(sender_ciphertext) <= 10000
        ):
            return JsonResponse(
                {"error": "Invalid sender-copy package lengths."}, status=400
            )

        sender_copy_values = {
            "sender_copy_ciphertext": sender_copy["ciphertext"],
            "sender_copy_kem_ciphertext": sender_copy["kem_ciphertext"],
            "sender_copy_salt": sender_copy["salt"],
            "sender_copy_nonce": sender_copy["nonce"],
            "sender_copy_algorithm": sender_copy["algorithm"],
        }

    message = Message.objects.create(
        conversation=conversation,
        sender=request.user.username,
        sender_user=request.user,
        content="",
        encrypted_content=data["ciphertext"],
        kem_ciphertext=data["kem_ciphertext"],
        encryption_salt=data["salt"],
        encryption_nonce=data["nonce"],
        encryption_version=data["algorithm"],
        **sender_copy_values,
    )
    return JsonResponse({
        "status": "stored",
        "message_id": message.id,
        "created_at": message.created_at.isoformat(),
    }, status=201)


@login_required
def get_encrypted_messages(request, conversation_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET requests are allowed."}, status=405)

    conversation = get_object_or_404(
        Conversation.objects.filter(participants=request.user).distinct(),
        id=conversation_id,
    )
    messages = (
        conversation.messages
        .select_related("sender_user")
        .order_by("created_at")
    )

    result = []
    for message in messages:
        sender_copy = None
        if (
            message.sender_user_id == request.user.id
            and message.sender_copy_ciphertext
        ):
            sender_copy = {
                "algorithm": message.sender_copy_algorithm,
                "kem_ciphertext": message.sender_copy_kem_ciphertext,
                "salt": message.sender_copy_salt,
                "nonce": message.sender_copy_nonce,
                "ciphertext": message.sender_copy_ciphertext,
            }

        result.append({
            "id": message.id,
            "sender": message.sender,
            "sender_user_id": message.sender_user_id,
            "created_at": message.created_at.isoformat(),
            "algorithm": message.encryption_version,
            "kem_ciphertext": message.kem_ciphertext,
            "salt": message.encryption_salt,
            "nonce": message.encryption_nonce,
            "ciphertext": message.encrypted_content,
            "sender_copy": sender_copy,
        })

    return JsonResponse({"messages": result})


@login_required
@require_POST
@csrf_protect
def clear_conversation(request, conversation_id):
    """Delete all messages in this conversation for both participants."""
    conversation = get_object_or_404(
        Conversation.objects.filter(participants=request.user).distinct(),
        id=conversation_id,
    )
    deleted_count, _ = conversation.messages.all().delete()
    return JsonResponse({"status": "cleared", "deleted_count": deleted_count})


@login_required
@require_POST
@csrf_protect
def unsend_message(request, conversation_id, message_id):
    """Delete a message only if the logged-in user sent it."""
    conversation = get_object_or_404(
        Conversation.objects.filter(participants=request.user).distinct(),
        id=conversation_id,
    )
    message = get_object_or_404(
        Message,
        id=message_id,
        conversation=conversation,
        sender_user=request.user,
    )
    message.delete()
    return JsonResponse({"status": "unsent", "message_id": message_id})
