from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from accounts.views import (
    ProfessionalRegistrationView,
    DirectorRegistrationView,
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    CurrentUserView,
    ChangePasswordView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    UserViewSet,
)
from establishments.views import EtablissementViewSet
from patients.views import PatientViewSet
from medical_records.views import (
    DossierMedicalViewSet,
    AntecedentViewSet,
    AllergieViewSet,
    TraitementActuelViewSet,
    ExamenComplementaireViewSet
)
from consultations.views import ConsultationViewSet
from care_management.views import PriseEnChargeViewSet, TransfertViewSet
from emergencies.views import InterventionUrgenceViewSet
from ai_assistant.views import SyntheseIAViewSet
from notifications.views import NotificationViewSet
from audit.views import JournalAccesViewSet
from core.views import DashboardStatsView

# Router configuration
router = DefaultRouter()
router.register(r'accounts/users', UserViewSet, basename='user')
router.register(r'establishments', EtablissementViewSet, basename='etablissement')
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'medical-records', DossierMedicalViewSet, basename='medical-record')
router.register(r'antecedents', AntecedentViewSet, basename='antecedent')
router.register(r'allergies', AllergieViewSet, basename='allergie')
router.register(r'traitements', TraitementActuelViewSet, basename='traitement')
router.register(r'examens', ExamenComplementaireViewSet, basename='examen')
router.register(r'consultations', ConsultationViewSet, basename='consultation')
router.register(r'care-management', PriseEnChargeViewSet, basename='care-management')
router.register(r'transfers', TransfertViewSet, basename='transfer')
router.register(r'emergencies', InterventionUrgenceViewSet, basename='emergency')
router.register(r'ai/summaries', SyntheseIAViewSet, basename='ai-summary')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'audit', JournalAccesViewSet, basename='audit')

urlpatterns = [
    path('admin/', admin.site.urls),

    # Authentification JWT, Inscription & Sécurité du mot de passe
    path('api/auth/register/', ProfessionalRegistrationView.as_view(), name='auth_register'),
    path('api/auth/register-director/', DirectorRegistrationView.as_view(), name='auth_register_director'),
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/me/', CurrentUserView.as_view(), name='current_user'),
    path('api/auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('api/auth/password-reset/request/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('api/auth/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),

    # Tableaux de bord & statistiques
    path('api/stats/dashboard/', DashboardStatsView.as_view(), name='dashboard_stats'),

    # API REST MEDTRANSFER
    path('api/', include(router.urls)),
]
