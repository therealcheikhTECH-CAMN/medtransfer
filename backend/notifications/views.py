from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """Centre de notifications internes pour les soignants et équipes d'établissement."""
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Notification.objects.filter(
            Q(destinataire=user) |
            (Q(destinataire__isnull=True) & Q(etablissement_cible=user.etablissement))
        ).order_by('-created_at')
        return qs

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.marquer_comme_lu()
        return Response({'detail': "Notification marquée comme lue."})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'detail': "Toutes les notifications ont été marquées comme lues."})
