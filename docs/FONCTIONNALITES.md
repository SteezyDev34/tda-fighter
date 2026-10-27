# TDA Fighter : fonctionnalités par interface

Mis à jour à chaque nouvelle fonctionnalité demandée.
Statuts : ✅ codé · 🧪 codé, IA à brancher · 🎨 prototype seulement · 📋 prévu

Dernière mise à jour : 27/10/2026

## Nutrition

### Écran Journal
| Fonctionnalité | Statut |
|---|---|
| Noter ce que j'ai mangé pour 5 repas (petit-déjeuner, collation du matin, déjeuner, collation de l'après-midi, dîner) | ✅ |
| Repas proposé automatiquement selon l'heure | ✅ |
| Barre de recherche d'aliments et de produits dans Open Food Facts, sans IA : les apports viennent directement de la base | ✅ |
| Scan du code-barres (caméra sur Android/Chrome, sinon saisie du code) | ✅ |
| Créer un aliment introuvable (nom, marque, code-barres scanné sur le produit, valeurs pour 100 g de l'étiquette) : il ressort ensuite dans la recherche, au scan et dans les repas générés | ✅ |
| Choix de la quantité en grammes (raccourcis 50, 100, 150, 200 g ou portion du produit) avec aperçu des apports | ✅ |
| Aliments déjà utilisés en tête de liste, le dernier en premier, avec la dernière quantité | ✅ |
| Enregistrer un repas (plusieurs aliments) sous un nom et le retrouver dans la recherche « Mes repas » | ✅ |
| Graphique des apports du jour comparés aux objectifs, mis à jour à chaque aliment noté | ✅ |
| Détail par repas au survol ou au tap sur une barre du graphique | ✅ |
| Un repas généré ajouté au journal garde son nom, ses apports, sa recette et l'explication de l'IA (bouton « Recette et explication ») | ✅ |
| Agenda : revoir l'historique jour par jour (semaine, flèches, choix d'une date), avec les calories de chaque jour | ✅ |
| Noter un aliment oublié sur un jour passé | ✅ |
| Rappel doux si un repas n'est pas noté | 📋 |

### Écran Repas et courses
| Fonctionnalité | Statut |
|---|---|
| Générer un repas ou une journée complète (5 repas) à partir du journal, des critères et des ressources | 🧪 |
| Générer les repas de la semaine : je coche mes jours d'entraînement, l'app crée des journées types (comme la fiche « Mon plan de repas de la semaine »), les répartit sur les 7 jours et fait la liste de courses de la semaine ; chaque repas s'ajoute au journal du bon jour | 🧪 |
| Recette simple et explication de pourquoi le repas me convient | 🧪 |
| Choix « jour d'entraînement » ou « jour de repos » avant de générer, pour appliquer les bons apports du protocole | ✅ |
| Heure du lever et heure de la séance : chaque repas généré affiche son heure conseillée (2 à 5 h entre deux prises, rien de lourd juste avant le sport, une prise protéinée après) ; les heures sont gardées sur l'appareil | 🧪 |
| Repas composés selon la méthode des apports (TP, BH, MM, E, BG) et les quantités de « 1 apport » des ressources, apports affichés sur chaque repas | 🧪 |
| Liste de courses générée depuis les repas, regroupée par rayon, cochable | 🧪 |
| Historique des plans générés (journée, repas, semaine) : une nouvelle génération n'efface plus l'ancienne, je peux rouvrir ou supprimer un plan | ✅ |
| Bouton « Ajouter au journal » sur un repas généré : chaque ingrédient est retrouvé dans Open Food Facts, je vérifie le produit et les grammes, je choisis le jour et le repas, puis j'ajoute (et je peux le rajouter si je l'ai retiré) | ✅ |
| « Changer ce repas » : regénérer un seul repas qui ne plaît pas, en gardant les autres ; le nouveau complète leurs apports et la liste de courses est refaite (aussi dans le plan de la semaine) | 🧪 |
| Retirer de la liste ce que j'ai déjà à la maison | 📋 |

### Écran Coach
| Fonctionnalité | Statut |
|---|---|
| Chat nutrition qui répond en direct (ex. « j'ai une fringale, qu'est-ce que je peux manger ? ») | 🧪 |
| Réponses basées sur les ressources .md, mes critères et mon journal | 🧪 |
| Questions suggérées pour démarrer | ✅ |
| Mise en forme des réponses (gras et titres affichés proprement) | ✅ |
| Historique des conversations : les reprendre plus tard, en démarrer une nouvelle, en supprimer | ✅ |
| Ajouter un aliment au journal ou à la liste de courses depuis le chat | 📋 |

### Écran Critères
| Fonctionnalité | Statut |
|---|---|
| Objectif, aliments aimés et évités, allergies, budget, temps pour cuisiner | ✅ |
| Champ « Moi » (sexe, âge, poids, taille, activité, protocole) pour calculer mes besoins et mon profil d'apports | ✅ |
| Calcul automatique de mes besoins et de mes apports par catégorie, avec la grille de la semaine | 📋 |
| Objectifs journaliers (calories, protéines, glucides, lipides) utilisés par le graphique | ✅ |

## Bilan

### Onglet Jour
| Fonctionnalité | Statut |
|---|---|
| Bilan quotidien : apports du jour face aux objectifs, repas non notés, séances et calories dépensées | ✅ |
| Avis du coach sur la journée (réussi, à ajuster, une action pour demain), croisant nutrition et sport, gardé par jour | 🧪 |

### À venir
| Fonctionnalité | Statut |
|---|---|
| Bilan de la semaine : régularité, repas sautés, hydratation | 📋 |

## Tâches
Reliée à ClickUp : les tâches viennent de ClickUp et chaque changement y est enregistré. Il faut CLICKUP_TOKEN et TDAF_ACCESS_CODE dans Vercel.

### Onglet Maintenant
| Fonctionnalité | Statut |
|---|---|
| Une seule tâche affichée : celle choisie, sinon le top 3, sinon la plus urgente | ✅ |
| Prochaine micro-étape mise en avant, sous-tâches à cocher | ✅ |
| Minuteur focus 5 / 15 / 25 min, temps enregistré dans ClickUp | ✅ |
| Bouton « Je bloque » : découper en micro-étapes (IA, ajoutées en sous-tâches), juste 5 minutes, reporter à demain, passer à une autre | 🧪 |
| Bouton « C'est fait » avec message d'encouragement et série | ✅ |

### Onglet Aujourd'hui
| Fonctionnalité | Statut |
|---|---|
| Capture rapide « Vider ma tête » (pro ou perso, pour aujourd'hui) envoyée dans ClickUp | ✅ |
| Rangement auto par l'IA : choix du projet ClickUp, reformulation, date (« demain », « vendredi ») et priorité repérées | 🧪 |
| Choix de la destination : l'IA range, projet existant, nouveau projet (dossier ClickUp + liste « Tâches ») ou nouvelle liste | ✅ |
| Top 3 du jour (3 maximum) | ✅ |
| Tâches en retard, pour aujourd'hui, cette semaine, sans date, plus tard | ✅ |
| Compteur de tâches faites aujourd'hui et série de jours | ✅ |
| Filtre Tout / Pro / Perso | ✅ |

### Onglet Semaine (rituel de planification)
| Fonctionnalité | Statut |
|---|---|
| Rituel guidé en 6 étapes : vider sa tête, projets, prioriser, estimer, temps dispo, plan | ✅ |
| Étape projet par projet : objectif de la semaine, tâches qui y mènent, ajout des tâches manquantes, « ce projet attend » | ✅ |
| Tri urgent / important (matrice d'Eisenhower), enregistré comme priorité dans ClickUp | ✅ |
| Estimation du temps de chaque tâche (enregistrée dans ClickUp), marge TDAH de 50 % | ✅ |
| Heures disponibles par jour, 70 % planifiés pour garder de la marge, jauge « ce qui tient » | ✅ |
| Plan de la semaine par l'IA (objectifs des projets, priorités, échéances, règle 1-3-5, énergie) avec conseils et tâches mises de côté | 🧪 |
| Application du plan : chaque tâche reçoit son jour comme échéance dans ClickUp | ✅ |
| Tâches datées mises de côté (« Pas cette semaine ») décalées automatiquement au lundi suivant | ✅ |
| Envoi du plan dans Google Agenda : un bloc par tâche (durée avec marge) dans les créneaux libres des heures de travail, une couleur par projet | 🧪 |
| Blocs liés à leur tâche : renvoi sans doublon (mise à jour, déplacement ou retrait), bloc déplacé à la main gardé s'il est sur le bon jour | 🧪 |
| Le bloc suit la tâche : retiré quand elle est terminée, déplacé si elle change de jour, mis à jour si l'estimation change | 🧪 |
| Aujourd'hui : temps prévu face au temps possible, alerte si c'est trop | ✅ |

### Onglet Projets
| Fonctionnalité | Statut |
|---|---|
| Espaces et listes ClickUp classés en pro et perso, avec le nombre de tâches ouvertes | ✅ |
| Ouvrir une liste et y ajouter des tâches | ✅ |
| Réglages : espace pro ou perso, liste qui reçoit les captures | ✅ |
| Couleur de chaque projet dans Google Agenda (pastille à toucher pour changer) | ✅ |

### À venir
| Fonctionnalité | Statut |
|---|---|
| Points d'XP et niveaux | 📋 |
| Rappels et notifications | 📋 |

## Sport

### Onglets Séances et Exercices
| Fonctionnalité | Statut |
|---|---|
| Calendrier des séances (passées et à venir), avec le type de séance sur chaque jour | ✅ |
| Séance de musculation : exercices avec séries, répétitions, charge (kg) et repos | ✅ |
| Rappel « La dernière fois » et séries pré-remplies avec celles de la dernière séance | ✅ |
| Séance de cardio : activité, durée, distance, intensité | ✅ |
| Autre activité sportive (foot, boxe, yoga…) : durée, intensité, notes | ✅ |
| Bibliothèque de 876 exercices en français avec images départ/arrivée (Free Exercise DB, domaine public), recherche et filtre par muscle | ✅ |
| Ajout d'un exercice absent de la bibliothèque | ✅ |
| Exercices déjà faits en haut de la liste (le plus récent d'abord), marqués « Déjà fait » | ✅ |
| Calories dépensées estimées pour chaque séance (type, durée, intensité, poids, méthode MET) | ✅ |
| Saisie des calories affichées par la montre (Fitbit), qui remplacent l'estimation | ✅ |
| Repas adaptés automatiquement aux séances enregistrées (jour d'entraînement, heure) | 📋 |

### À venir
| Fonctionnalité | Statut |
|---|---|
| Check-in énergie (basse, moyenne, haute) | 🎨 |
| Séance du jour adaptée à l'énergie | 🎨 |
| Séance guidée avec minuteur par exercice | 🎨 |
| Rattrapage sans culpabilité si je rate un jour | 🎨 |

## Commun à toute l'app
| Fonctionnalité | Statut |
|---|---|
| App web installable sur téléphone (PWA) | ✅ |
| Menu latéral pour passer d'une section à l'autre (Nutrition, Sport, Bilan, Tâches), chaque section avec son propre menu en bas | ✅ |
| Retour sur la dernière section et le dernier onglet ouverts | ✅ |
| Base de connaissances : lecture des .md du dossier Google Drive « TDA Fighter - Nutrition » | 🧪 |
| Bascule automatique sur un autre modèle d'IA si une question est refusée | 🧪 |
| Synchronisation entre appareils : données gardées en ligne (Upstash Redis sur Vercel), appareil relié avec le code d'accès de l'app | ✅ |
| Reprise automatique des données déjà saisies sur chaque appareil, fusionnées sans rien perdre à la première synchro | ✅ |
| Fonctionne hors ligne : les changements partent au retour du réseau | ✅ |
| Notifications de rappel | 📋 |
