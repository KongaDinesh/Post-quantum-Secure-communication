
from django.urls import path
from django.contrib.auth import views as auth_views

from . import views
from . import device_key_views


urlpatterns = [
    # Home, registration, login and logout
    path("", views.index, name="chat_home"),
    path("register/", views.register, name="register"),
    path(
        "login/",
        auth_views.LoginView.as_view(template_name="chat/login.html"),
        name="login",
    ),
    path("logout/", views.logout_view, name="logout"),

    # Existing single-key endpoints
    path("keys/register/", views.register_pqc_key, name="register_pqc_key"),
    path(
        "keys/<int:user_id>/",
        views.get_pqc_public_key,
        name="get_pqc_public_key",
    ),

    # Conversations and existing message endpoints
    path(
        "conversation/start/<int:user_id>/",
        views.start_conversation,
        name="start_conversation",
    ),
    path(
        "conversation/<int:conversation_id>/",
        views.conversation_detail,
        name="conversation_detail",
    ),
    path(
        "conversation/<int:conversation_id>/send/",
        views.send_encrypted_message,
        name="send_encrypted_message",
    ),
    path(
        "conversation/<int:conversation_id>/messages/",
        views.get_encrypted_messages,
        name="get_encrypted_messages",
    ),
    path(
        "conversation/<int:conversation_id>/clear/",
        views.clear_conversation,
        name="clear_conversation",
    ),
    path(
        "conversation/<int:conversation_id>/messages/<int:message_id>/unsend/",
        views.unsend_message,
        name="unsend_message",
    ),

    # Multi-device key registration and distribution
    path(
        "api/device-keys/register/",
        device_key_views.register_device_key,
        name="register_device_key",
    ),
    path(
        "api/conversations/<int:conversation_id>/device-keys/",
        device_key_views.conversation_device_keys,
        name="conversation_device_keys",
    ),

    # Multi-device encrypted message envelopes
    path(
        "api/conversations/<int:conversation_id>/device-messages/send/",
        device_key_views.send_device_encrypted_message,
        name="send_device_encrypted_message",
    ),
    path(
        "api/conversations/<int:conversation_id>/device-messages/",
        device_key_views.get_device_encrypted_messages,
        name="get_device_encrypted_messages",
    ),
]
