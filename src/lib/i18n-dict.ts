/** UI string catalogue (v2.1). Keys are stable; add a locale by adding a column. Pure module. */

export const LOCALES = ["en", "es", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_LABELS: Record<Locale, string> = { en: "English", es: "Español", fr: "Français" };

type Dict = Record<string, string>;

const en: Dict = {
  "nav.catalog": "Catalog",
  "nav.paths": "Paths",
  "nav.myLearning": "My Learning",
  "nav.author": "Author",
  "nav.organization": "Organization",
  "nav.integrations": "Integrations",
  "nav.admin": "Admin",
  "nav.signIn": "Sign in",
  "nav.getStarted": "Get started",
  "nav.signOut": "Sign out",
  "nav.notifications": "Notifications",
  "nav.unread": "{n} unread notifications",
  "nav.skip": "Skip to content",
  "catalog.title": "Course catalog",
  "catalog.subtitle": "Learn at your own pace. Enroll in a course to start tracking your progress.",
  "catalog.paths": "Learning paths",
  "catalog.allPaths": "All paths →",
  "catalog.searchPlaceholder": "Search courses…",
  "catalog.searchLabel": "Search courses",
  "catalog.search": "Search",
  "catalog.clear": "Clear",
  "catalog.level": "Level",
  "catalog.sort": "Sort by",
  "catalog.create": "Create a course",
  "catalog.noMatch": "No courses match",
  "catalog.noMatchBody": "Try a different keyword or clear the filters.",
  "catalog.clearFilters": "Clear filters",
  "catalog.empty": "No courses published yet",
  "catalog.denied": "You don't have access to that page.",
  "learn.title": "My Learning",
  "learn.welcome": "Welcome back, {name}.",
  "learn.browse": "Browse catalog",
  "learn.inProgress": "In progress",
  "learn.completed": "Completed",
  "learn.emptyTitle": "You're not enrolled in any courses yet",
  "learn.emptyBody": "Pick something from the catalog to get started.",
  "learn.browseCta": "Browse the catalog",
  "learn.streak": "{n}-day streak",
  "learn.points": "points",
  "learn.badges": "badges",
  "learn.profile": "View profile →",
  "auth.welcomeBack": "Welcome back",
  "auth.createAccount": "Create your account",
  "footer.tagline": "build courses, learn anywhere",
  "footer.language": "Language",
  "brand.poweredBy": "Powered by e-learner",
};

const es: Dict = {
  "nav.catalog": "Catálogo",
  "nav.paths": "Rutas",
  "nav.myLearning": "Mi aprendizaje",
  "nav.author": "Autor",
  "nav.organization": "Organización",
  "nav.integrations": "Integraciones",
  "nav.admin": "Admin",
  "nav.signIn": "Iniciar sesión",
  "nav.getStarted": "Empezar",
  "nav.signOut": "Cerrar sesión",
  "nav.notifications": "Notificaciones",
  "nav.unread": "{n} notificaciones sin leer",
  "nav.skip": "Saltar al contenido",
  "catalog.title": "Catálogo de cursos",
  "catalog.subtitle": "Aprende a tu ritmo. Inscríbete en un curso para seguir tu progreso.",
  "catalog.paths": "Rutas de aprendizaje",
  "catalog.allPaths": "Todas las rutas →",
  "catalog.searchPlaceholder": "Buscar cursos…",
  "catalog.searchLabel": "Buscar cursos",
  "catalog.search": "Buscar",
  "catalog.clear": "Limpiar",
  "catalog.level": "Nivel",
  "catalog.sort": "Ordenar por",
  "catalog.create": "Crear un curso",
  "catalog.noMatch": "Ningún curso coincide",
  "catalog.noMatchBody": "Prueba otra palabra clave o limpia los filtros.",
  "catalog.clearFilters": "Limpiar filtros",
  "catalog.empty": "Aún no hay cursos publicados",
  "catalog.denied": "No tienes acceso a esa página.",
  "learn.title": "Mi aprendizaje",
  "learn.welcome": "Hola de nuevo, {name}.",
  "learn.browse": "Ver catálogo",
  "learn.inProgress": "En curso",
  "learn.completed": "Completados",
  "learn.emptyTitle": "Todavía no estás inscrito en ningún curso",
  "learn.emptyBody": "Elige algo del catálogo para empezar.",
  "learn.browseCta": "Ver el catálogo",
  "learn.streak": "racha de {n} días",
  "learn.points": "puntos",
  "learn.badges": "insignias",
  "learn.profile": "Ver perfil →",
  "auth.welcomeBack": "Bienvenido de nuevo",
  "auth.createAccount": "Crea tu cuenta",
  "footer.tagline": "crea cursos, aprende donde quieras",
  "footer.language": "Idioma",
  "brand.poweredBy": "Con la tecnología de e-learner",
};

const fr: Dict = {
  "nav.catalog": "Catalogue",
  "nav.paths": "Parcours",
  "nav.myLearning": "Mon apprentissage",
  "nav.author": "Auteur",
  "nav.organization": "Organisation",
  "nav.integrations": "Intégrations",
  "nav.admin": "Admin",
  "nav.signIn": "Se connecter",
  "nav.getStarted": "Commencer",
  "nav.signOut": "Se déconnecter",
  "nav.notifications": "Notifications",
  "nav.unread": "{n} notifications non lues",
  "nav.skip": "Aller au contenu",
  "catalog.title": "Catalogue des cours",
  "catalog.subtitle": "Apprenez à votre rythme. Inscrivez-vous à un cours pour suivre votre progression.",
  "catalog.paths": "Parcours d'apprentissage",
  "catalog.allPaths": "Tous les parcours →",
  "catalog.searchPlaceholder": "Rechercher des cours…",
  "catalog.searchLabel": "Rechercher des cours",
  "catalog.search": "Rechercher",
  "catalog.clear": "Effacer",
  "catalog.level": "Niveau",
  "catalog.sort": "Trier par",
  "catalog.create": "Créer un cours",
  "catalog.noMatch": "Aucun cours ne correspond",
  "catalog.noMatchBody": "Essayez un autre mot-clé ou effacez les filtres.",
  "catalog.clearFilters": "Effacer les filtres",
  "catalog.empty": "Aucun cours publié pour l'instant",
  "catalog.denied": "Vous n'avez pas accès à cette page.",
  "learn.title": "Mon apprentissage",
  "learn.welcome": "Bon retour, {name}.",
  "learn.browse": "Parcourir le catalogue",
  "learn.inProgress": "En cours",
  "learn.completed": "Terminés",
  "learn.emptyTitle": "Vous n'êtes inscrit à aucun cours",
  "learn.emptyBody": "Choisissez un cours dans le catalogue pour commencer.",
  "learn.browseCta": "Parcourir le catalogue",
  "learn.streak": "série de {n} jours",
  "learn.points": "points",
  "learn.badges": "badges",
  "learn.profile": "Voir le profil →",
  "auth.welcomeBack": "Bon retour",
  "auth.createAccount": "Créez votre compte",
  "footer.tagline": "créez des cours, apprenez partout",
  "footer.language": "Langue",
  "brand.poweredBy": "Propulsé par e-learner",
};

export const DICTS: Record<Locale, Dict> = { en, es, fr };

export function isLocale(x: unknown): x is Locale {
  return typeof x === "string" && (LOCALES as readonly string[]).includes(x);
}

/** Translates `key` in `locale`, falling back to English, then to the key itself; `{name}` placeholders are interpolated. */
export function translate(locale: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const raw = DICTS[locale]?.[key] ?? DICTS.en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] === undefined ? `{${k}}` : String(vars[k])));
}

/** Picks the best locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return "en";
  const prefs = acceptLanguage
    .split(",")
    .map((p) => {
      const [tag, q] = p.trim().split(";q=");
      return { tag: (tag ?? "").toLowerCase().slice(0, 2), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const p of prefs) if (isLocale(p.tag)) return p.tag;
  return "en";
}
