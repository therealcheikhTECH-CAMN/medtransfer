from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_notification_display', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'type_notification', 'type_display', 'titre',
            'message', 'reference_objet_type', 'reference_objet_id',
            'is_read', 'created_at'
        ]
