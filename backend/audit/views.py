import csv
from django.http import HttpResponse
from rest_framework import viewsets, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import JournalAcces, enregistrer_journal
from .serializers import JournalAccesSerializer
from accounts.permissions import IsAdminOrDirector
from core.search_utils import build_multi_token_q


class JournalAccesViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consultation des journaux d'audit et de traçabilité médicolégale :
    - L'administrateur général a accès à la totalité des journaux d'audit.
    - Le directeur d'établissement a accès aux journaux d'audit de son établissement uniquement.
    - Aucun utilisateur (admin ou directeur) ne peut modifier ou supprimer les journaux (ReadOnlyModelViewSet).
    - Exportation des journaux autorisés au format CSV.
    """
    queryset = JournalAcces.objects.all().select_related('utilisateur', 'etablissement').order_by('-timestamp')
    serializer_class = JournalAccesSerializer
    permission_classes = [IsAdminOrDirector]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'action',
        'statut',
        'utilisateur__username',
        'utilisateur__first_name',
        'utilisateur__last_name',
        'utilisateur__email',
        'etablissement__nom',
        'entite_type',
        'entite_id',
    ]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Confinement strict du directeur à son propre établissement
        if user.is_director and not user.is_admin_user:
            if not user.etablissement:
                return qs.none()
            qs = qs.filter(etablissement=user.etablissement)

        # Filtres avancés
        action_filter = self.request.query_params.get('action')
        statut_filter = self.request.query_params.get('statut')
        utilisateur_id = self.request.query_params.get('utilisateur') or self.request.query_params.get('utilisateur_id')
        entite_type = self.request.query_params.get('entite_type') or self.request.query_params.get('module')
        entite_id = self.request.query_params.get('entite_id') or self.request.query_params.get('patient') or self.request.query_params.get('patient_id')
        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        query = (self.request.query_params.get('q') or self.request.query_params.get('search') or '').strip()

        if query:
            audit_fields = [
                'action',
                'statut',
                'utilisateur__username',
                'utilisateur__first_name',
                'utilisateur__last_name',
                'utilisateur__email',
                'etablissement__nom',
                'entite_type',
                'entite_id',
            ]
            qs = qs.filter(build_multi_token_q(query, audit_fields))

        if action_filter:
            qs = qs.filter(action=action_filter)
        if statut_filter:
            qs = qs.filter(statut=statut_filter)
        if utilisateur_id:
            qs = qs.filter(utilisateur_id=utilisateur_id)
        if entite_type:
            qs = qs.filter(entite_type__iexact=entite_type)
        if entite_id:
            qs = qs.filter(entite_id=str(entite_id))
        if date_debut:
            qs = qs.filter(timestamp__gte=date_debut)
        if date_fin:
            qs = qs.filter(timestamp__lte=date_fin)

        return qs

    @action(detail=False, methods=['get'], url_path='export')
    def export_csv(self, request):
        """Exporte les journaux d'audit filtrés sous format CSV tabulaire."""
        qs = self.get_queryset()[:2000]  # Limite de sécurité raisonnable pour l'export
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="audit_logs.csv"'

        # Écriture UTF-8 BOM pour compatibilité Excel
        response.write('\ufeff')
        writer = csv.writer(response, delimiter=';')
        writer.writerow([
            'Horodatage', 'Action', 'Action Libellé', 'Statut',
            'Utilisateur Identifiant', 'Utilisateur Nom', 'Établissement Code',
            'Établissement Nom', 'Entité Type', 'Entité ID', 'Adresse IP', 'Détails'
        ])

        for log in qs:
            writer.writerow([
                log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                log.action,
                log.get_action_display(),
                log.statut,
                log.utilisateur.username if log.utilisateur else 'Système',
                f"{log.utilisateur.first_name} {log.utilisateur.last_name}".strip() if log.utilisateur else 'Système',
                log.etablissement.code if log.etablissement else '—',
                log.etablissement.nom if log.etablissement else '—',
                log.entite_type or '—',
                log.entite_id or '—',
                log.adresse_ip or '—',
                str(log.details)
            ])

        return response

    @action(detail=False, methods=['post'], url_path='email-action', permission_classes=[permissions.IsAuthenticated])
    def log_email_action(self, request):
        """
        Enregistre un événement technique de composition ou de sollicitation du client de messagerie.
        Ne stocke JAMAIS le corps ni le contenu textuel complet du message.
        """
        if not request.user or not request.user.is_authenticated or not request.user.is_active:
            return Response({'detail': "Utilisateur non autorisé ou inactif."}, status=403)

        action_type = request.data.get('action')
        valid_actions = {'EMAIL_COMPOSER_OPENED', 'EMAIL_CLIENT_OPEN_REQUESTED', 'EMAIL_CONTENT_COPIED'}
        if action_type not in valid_actions:
            return Response({'detail': "Type d'action de messagerie non valide."}, status=400)

        context_info = request.data.get('context', {})
        if not isinstance(context_info, dict):
            context_info = {}

        # Nettoyage et sanitisation stricts des métadonnées (anti injection CRLF / limitation taille)
        recipient_raw = str(context_info.get('recipient_email', '')).strip().replace('\r', '').replace('\n', '')[:120]
        template_raw = str(context_info.get('template_key', '')).strip().replace('\r', '').replace('\n', '')[:60]
        module_raw = str(context_info.get('module', '')).strip().replace('\r', '').replace('\n', '')[:60]
        entite_type_raw = str(context_info.get('entity_type', 'Email')).strip()[:50]
        entite_id_raw = str(context_info.get('entity_id', '')).strip()[:50]

        sanitized_details = {
            'action': action_type,
            'recipient_email': recipient_raw,
            'template_key': template_raw,
            'module': module_raw,
        }

        enregistrer_journal(
            action=action_type,
            utilisateur=request.user,
            etablissement=getattr(request.user, 'etablissement', None),
            statut='SUCCES',
            entite_type=entite_type_raw,
            entite_id=entite_id_raw,
            details=sanitized_details,
            request=request,
        )
        return Response({'status': 'logged'})

