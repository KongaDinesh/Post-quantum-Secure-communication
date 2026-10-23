from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    path("", views.index, name="chat_home"),
    path("register/", views.register, name="register"),
    path("login/", auth_views.LoginView.as_view(template_name="chat/login.html"), name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("keys/register/", views.register_pqc_key, name="register_pqc_key"),
    path("keys/<int:user_id>/", views.get_pqc_public_key, name="get_pqc_public_key"),
    path("conversation/start/<int:user_id>/", views.start_conversation, name="start_conversation"),
    path("conversation/<int:conversation_id>/", views.conversation_detail, name="conversation_detail"),
    path("conversation/<int:conversation_id>/send/", views.send_encrypted_message, name="send_encrypted_message"),
    path("conversation/<int:conversation_id>/messages/", views.get_encrypted_messages, name="get_encrypted_messages"),
    path("conversation/<int:conversation_id>/clear/", views.clear_conversation, name="clear_conversation"),
    path("conversation/<int:conversation_id>/messages/<int:message_id>/unsend/", views.unsend_message, name="unsend_message"),
]
