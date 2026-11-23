from rest_framework import permissions


def _is_account_active_and_valid(user):
    """
    Vérifie de manière systématique que l'utilisateur est authentifié, actif,
    validé (APPROVED) et rattaché à un établissement actif (hors administrateur système).
    """
    if not (user and user.is_authenticated):
        return False
    if not (user.is_active and getattr(user, 'is_actif', True)):
        return False
    if getattr(user, 'statut_validation', 'APPROVED') != 'APPROVED':
        return False
    if not user.is_admin_user:
        etab = getattr(user, 'etablissement', None)
        if not etab or not getattr(etab, 'is_active', True):
            return False
    return True


class IsAdminUser(permissions.BasePermission):
    """Autorise uniquement les administrateurs système / techniques actifs."""
    def has_permission(self, request, view):
        return bool(_is_account_active_and_valid(request.user) and request.user.is_admin_user)


class IsDirector(permissions.BasePermission):
    """Autorise uniquement les directeurs d'établissement actifs et validés."""
    def has_permission(self, request, view):
        return bool(_is_account_active_and_valid(request.user) and request.user.is_director)


class IsAdminOrDirector(permissions.BasePermission):
    """Autorise les administrateurs système et les directeurs d'établissement actifs."""
    def has_permission(self, request, view):
        return bool(
            _is_account_active_and_valid(request.user) and (
                request.user.is_admin_user or request.user.is_director
            )
        )


class IsDoctor(permissions.BasePermission):
    """Autorise uniquement les médecins en exercice actifs, validés et rattachés à un établissement actif."""
    def has_permission(self, request, view):
        return bool(_is_account_active_and_valid(request.user) and request.user.is_doctor)


class IsDoctorOrDirector(permissions.BasePermission):
    """Autorise les médecins en exercice et les directeurs d'établissement actifs (ainsi que les admins)."""
    def has_permission(self, request, view):
        return bool(
            _is_account_active_and_valid(request.user) and (
                request.user.is_doctor or request.user.is_director or request.user.is_admin_user
            )
        )


class IsReceptionist(permissions.BasePermission):
    """Autorise uniquement les agents d'accueil administratifs actifs et validés."""
    def has_permission(self, request, view):
        return bool(_is_account_active_and_valid(request.user) and request.user.is_receptionist)


class IsDoctorOrReceptionist(permissions.BasePermission):
    """
    Autorise exclusivement les agents d'accueil et les médecins actifs et validés
    pour l'identification administrative des patients.
    Les administrateurs techniques et les directeurs sont exclus.
    """
    def has_permission(self, request, view):
        return bool(
            _is_account_active_and_valid(request.user) and (
                request.user.is_doctor or request.user.is_receptionist
            )
        )


class CanAccessMedicalRecord(permissions.BasePermission):
    """
    RÈGLE ABSOLUE DE SÉGRÉGATION MÉDICALE ET DE CONTRÔLE DE RELATION DE SOIN :
    - Au niveau vue : un médecin en exercice actif OU un directeur d'établissement
      (exclusivement en lecture seule via SAFE_METHODS) peut accéder aux endpoints de dossiers.
    - Au niveau objet : évalué par MedicalRecordAccessService (relation de soin pour le médecin,
      confinement à l'établissement pour le directeur).
    """
    def has_permission(self, request, view):
        if not _is_account_active_and_valid(request.user):
            return False
        if request.user.is_doctor:
            return True
        if getattr(request.user, 'role', None) == 'DIRECTEUR' and request.method in permissions.SAFE_METHODS:
            return True
        return False

    def has_object_permission(self, request, view, obj):
        from medical_records.access_control import CanAccessPatientMedicalRecord
        return CanAccessPatientMedicalRecord().has_object_permission(request, view, obj)


class IsActiveProfessionalUser(permissions.BasePermission):
    """Autorise tout utilisateur actif, validé et rattaché à un établissement actif (Admin, Directeur, Médecin, Agent)."""
    def has_permission(self, request, view):
        return bool(_is_account_active_and_valid(request.user))

