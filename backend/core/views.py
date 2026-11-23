from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.utils import timezone
from datetime import timedelta
from establishments.models import Etablissement
from accounts.models import User
from patients.models import Patient
from consultations.models import Consultation
from care_management.models import PriseEnCharge, Transfert
from emergencies.models import InterventionUrgence
from notifications.models import Notification
from audit.models import JournalAcces


class DashboardStatsView(APIView):
    """
    Statistiques dynamiques calculées depuis la base de données centralisée PostgreSQL,
    adaptées au rôle spécifique de l'utilisateur connecté.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        role = user.role
        etab = user.etablissement
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        data = {
            'role': role,
            'user': {
                'id': user.id,
                'nom_complet': f"{user.first_name} {user.last_name}".strip() or user.username,
                'etablissement_nom': etab.nom if etab else "Administration Centrale"
            }
        }

        # 1. ESPACE ADMINISTRATEUR TECHNIQUE
        if user.is_admin_user:
            data['stats'] = {
                'total_etablissements': Etablissement.objects.count(),
                'total_utilisateurs': User.objects.count(),
                'demandes_en_attente': User.objects.filter(statut_validation='PENDING').count(),
                'total_patients': Patient.objects.count(),
                'total_consultations': Consultation.objects.count(),
                'total_prises_en_charge_actives': PriseEnCharge.objects.filter(statut='ACTIF').count(),
                'total_transferts': Transfert.objects.count(),
                'total_interventions_urgence': InterventionUrgence.objects.count(),
                'total_journaux_audit': JournalAcces.objects.count()
            }
            # Événements récents pour le dashboard admin
            data['activite_recente'] = list(JournalAcces.objects.select_related('utilisateur').values(
                'id', 'action', 'statut', 'timestamp', 'utilisateur__username'
            )[:8])

        # 1bis. ESPACE DIRECTEUR D'ÉTABLISSEMENT
        elif user.is_director:
            qs_etab_users = User.objects.filter(etablissement=etab).exclude(role='ADMIN') if etab else User.objects.none()
            data['stats'] = {
                'demandes_en_attente': qs_etab_users.filter(statut_validation='PENDING').count(),
                'comptes_valides': qs_etab_users.filter(statut_validation='APPROVED').exclude(role='DIRECTEUR').count(),
                'comptes_refuses': qs_etab_users.filter(statut_validation='REJECTED').count(),
                'comptes_suspendus': qs_etab_users.filter(statut_validation='SUSPENDED').count(),
                'medecins_actifs': qs_etab_users.filter(role='MEDECIN', statut_validation='APPROVED', is_actif=True).count(),
                'agents_actifs': qs_etab_users.filter(role='AGENT', statut_validation='APPROVED', is_actif=True).count(),
            }
            data['demandes_recentes'] = list(qs_etab_users.filter(statut_validation='PENDING').values(
                'id', 'first_name', 'last_name', 'email', 'role', 'matricule_professionnel', 'specialite', 'date_joined'
            )[:10])

        # 2. ESPACE AGENT D'ACCUEIL
        elif user.is_receptionist:
            data['stats'] = {
                'patients_enregistres_total': Patient.objects.count(),
                'patients_enregistres_aujourdhui': Patient.objects.filter(created_at__gte=today_start).count(),
                'patients_a_confirmer': Patient.objects.filter(status_identite='A_CONFIRMER').count(),
                'patients_mon_etablissement': Patient.objects.filter(etablissement_creation=etab).count() if etab else 0
            }
            # Fiches d'identité provisoires urgentes à régulariser
            data['fiches_a_verifier'] = list(Patient.objects.filter(status_identite='A_CONFIRMER').values(
                'id', 'medtransfer_id', 'nom', 'prenom', 'created_at', 'motif_identite_provisoire'
            )[:5])

        # 3. ESPACE MÉDECIN
        elif user.is_doctor:
            from django.db.models import Q
            from medical_records.access_control import MedicalRecordAccessService
            authorized_patient_ids = MedicalRecordAccessService.get_authorized_patient_ids(user)
            data['stats'] = {
                'mes_consultations': Consultation.objects.filter(medecin=user).count(),
                'consultations_mon_etablissement': Consultation.objects.filter(etablissement=etab, medecin=user).count() if etab else 0,
                'prises_en_charge_actives_mon_etab': PriseEnCharge.objects.filter(
                    etablissement=etab, medecin_responsable=user, statut='ACTIF'
                ).count() if etab else 0,
                'transferts_en_attente_recus': Transfert.objects.filter(etablissement_destination=etab, statut='DEMANDE').count() if etab else 0,
                'transferts_en_attente_emis': Transfert.objects.filter(etablissement_origine=etab, statut='DEMANDE').count() if etab else 0,
                'urgences_recentes': InterventionUrgence.objects.filter(etablissement=etab, medecin=user).count() if etab else 0,
                'notifications_non_lues': Notification.objects.filter(destinataire=user, is_read=False).count()
            }
            # Dernières consultations enregistrées par ce médecin ou sur ses patients autorisés
            data['dernieres_consultations'] = list(Consultation.objects.filter(
                Q(medecin=user) | Q(dossier__patient_id__in=authorized_patient_ids)
            ).order_by('-date_consultation').values(
                'id', 'date_consultation', 'dossier__patient__id', 'dossier__patient__nom', 'dossier__patient__prenom',
                'dossier__patient__medtransfer_id', 'motif', 'diagnostic', 'is_emergency'
            )[:6])
            # Transferts entrants en attente d'action
            data['transferts_entrants_urgents'] = list(Transfert.objects.filter(
                etablissement_destination=etab, statut='DEMANDE'
            ).values(
                'id', 'patient__nom', 'patient__prenom', 'etablissement_origine__nom',
                'priorite', 'motif_transfert', 'date_demande'
            )[:5])

        return Response(data)
