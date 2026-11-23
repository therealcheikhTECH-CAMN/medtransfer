import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import dj_database_url

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables
load_dotenv(BASE_DIR.parent / '.env')
load_dotenv(BASE_DIR / '.env')

# ------------------------------------------------------------------------------
# 1. SÉCURITÉ & ENVIRONNEMENT D'EXÉCUTION
# ------------------------------------------------------------------------------
DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')

# Mode test & identification de l'environnement (staging / test / production)
MEDTRANSFER_ENV = os.getenv('MEDTRANSFER_ENV', 'development' if DEBUG else 'production')
MEDTRANSFER_TEST_MODE = os.getenv('MEDTRANSFER_TEST_MODE', 'False').lower() in ('true', '1', 'yes')

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if DEBUG:
        # Clé de repli locale pour le développement uniquement
        SECRET_KEY = 'medtransfer-dev-secret-key-medical-platform-local-only'
    else:
        from django.core.exceptions import ImproperlyConfigured
        raise ImproperlyConfigured(
            "CRITIQUE : La variable d'environnement DJANGO_SECRET_KEY est strictement obligatoire en production (DEBUG=False)."
        )

allowed_hosts_env = os.getenv('ALLOWED_HOSTS', '*' if DEBUG else 'localhost,127.0.0.1')
ALLOWED_HOSTS = [h.strip() for h in allowed_hosts_env.split(',') if h.strip()]

# Intégration dynamique du domaine public Railway si présent
railway_domain = os.getenv('RAILWAY_PUBLIC_DOMAIN')
if railway_domain and railway_domain not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(railway_domain)

# Sécurité HTTPS & En-tête Proxy Railway
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not DEBUG:
    SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'True').lower() in ('true', '1', 'yes')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'

# ------------------------------------------------------------------------------
# 2. APPLICATIONS DU PROJET
# ------------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Packages tiers indispensables
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Modules domaine MEDTRANSFER (Monolithe Modulaire)
    'establishments.apps.EstablishmentsConfig',
    'accounts.apps.AccountsConfig',
    'patients.apps.PatientsConfig',
    'medical_records.apps.MedicalRecordsConfig',
    'consultations.apps.ConsultationsConfig',
    'care_management.apps.CareManagementConfig',
    'emergencies.apps.EmergenciesConfig',
    'ai_assistant.apps.AiAssistantConfig',
    'notifications.apps.NotificationsConfig',
    'audit.apps.AuditConfig',
    'core.apps.CoreConfig',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Gestion haute performance des assets statiques
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ------------------------------------------------------------------------------
# 3. BASE DE DONNÉES (POSTGRESQL NEON AVEC SSL & POOLING)
# ------------------------------------------------------------------------------
USE_SQLITE = os.getenv('USE_SQLITE', 'False').lower() in ('true', '1', 'yes')
DATABASE_URL = os.getenv('DATABASE_URL')

if USE_SQLITE and not DATABASE_URL:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'medtransfer_dev.sqlite3',
        }
    }
elif DATABASE_URL:
    # Détection de l'utilisation de PgBouncer (Neon Pooler)
    is_pooler = 'pooler' in DATABASE_URL or os.getenv('USE_PGBOUNCER', 'False').lower() in ('true', '1', 'yes')

    # Avec PgBouncer en mode transaction pooling : conn_max_age=0 pour éviter les connexions fantômes
    conn_age = 0 if is_pooler else int(os.getenv('DB_CONN_MAX_AGE', '600'))

    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=conn_age,
            ssl_require=True,
        )
    }

    # Configuration des options PostgreSQL Neon
    if DATABASES['default'].get('ENGINE') == 'django.db.backends.postgresql':
        opts = DATABASES['default'].setdefault('OPTIONS', {})
        opts.setdefault('sslmode', 'require')
        opts.setdefault('connect_timeout', 10)
        # Si connexion via Pooler Neon (PgBouncer), désactivation des prepared statements côté serveur
        if is_pooler:
            opts['prepare_threshold'] = None
else:
    # Configuration discrète (Docker Compose ou PostgreSQL local)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'medtransfer_db'),
            'USER': os.getenv('DB_USER', 'medtransfer_user'),
            'PASSWORD': os.getenv('DB_PASSWORD', 'medtransfer_pass2026'),
            'HOST': os.getenv('DB_HOST', 'localhost'),
            'PORT': os.getenv('DB_PORT', '5432'),
            'OPTIONS': {
                'connect_timeout': 10,
                'sslmode': os.getenv('DB_SSLMODE', 'prefer'),
            }
        }
    }

# ------------------------------------------------------------------------------
# 4. MODÈLE UTILISATEUR & MOTS DE PASSE
# ------------------------------------------------------------------------------
AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ------------------------------------------------------------------------------
# 5. ASSETS STATIQUES & WHITENOISE
# ------------------------------------------------------------------------------
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage" if not DEBUG else "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ------------------------------------------------------------------------------
# 6. REST FRAMEWORK & SIMPLE JWT
# ------------------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'accounts.authentication.CustomJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ------------------------------------------------------------------------------
# 7. SÉCURITÉ CORS ET CSRF
# ------------------------------------------------------------------------------
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
CORS_ALLOW_CREDENTIALS = True

cors_origins_env = os.getenv('CORS_ALLOWED_ORIGINS')
if cors_origins_env:
    CORS_ALLOWED_ORIGINS = [orig.strip() for orig in cors_origins_env.split(',') if orig.strip()]
    CORS_ALLOW_ALL_ORIGINS = False
elif FRONTEND_URL and not DEBUG:
    CORS_ALLOWED_ORIGINS = [orig.strip() for orig in FRONTEND_URL.split(',') if orig.strip()]
    CORS_ALLOW_ALL_ORIGINS = False
else:
    CORS_ALLOW_ALL_ORIGINS = True  # Mode développement / local

csrf_trusted_env = os.getenv('CSRF_TRUSTED_ORIGINS')
if csrf_trusted_env:
    CSRF_TRUSTED_ORIGINS = [orig.strip() for orig in csrf_trusted_env.split(',') if orig.strip()]
elif FRONTEND_URL:
    CSRF_TRUSTED_ORIGINS = [orig.strip() for orig in FRONTEND_URL.split(',') if orig.strip()]
else:
    CSRF_TRUSTED_ORIGINS = []

if railway_domain:
    railway_origin = f"https://{railway_domain}"
    if railway_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(railway_origin)

# ------------------------------------------------------------------------------
# 8. SERVICES MÉTIER & NOTIFICATIONS
# ------------------------------------------------------------------------------
# En mode test (staging / test), neutralisation sécurisée de l'envoi SMTP réel vers un backend mémoire
if MEDTRANSFER_TEST_MODE and not os.getenv('EMAIL_BACKEND'):
    EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
else:
    EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 'yes')
EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'False').lower() in ('true', '1', 'yes')
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'MEDTRANSFER <no-reply@medtransfer.sn>')
EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '10'))

PASSWORD_RESET_TIMEOUT = int(os.getenv('PASSWORD_RESET_TIMEOUT', '3600'))

# Intelligence Artificielle (OpenAI)
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')

# Durée par défaut et plafond d'une autorisation exceptionnelle d'urgence (en minutes)
EMERGENCY_ACCESS_DURATION_MINUTES = int(os.getenv('EMERGENCY_ACCESS_DURATION_MINUTES', '120'))
EMERGENCY_ACCESS_MAX_DURATION_MINUTES = int(os.getenv('EMERGENCY_ACCESS_MAX_DURATION_MINUTES', '240'))
