# TDA Fighter : fonctionnalités par interface

Mis à jour à chaque nouvelle fonctionnalité demandée.
Statuts : ✅ codé · 🧪 codé, IA à brancher · 🎨 prototype seulement · 📋 prévu

Dernière mise à jour : 26/10/2026

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
Section présente dans le menu, avec la liste de ce qui arrive.

| Fonctionnalité | Statut |
|---|---|
| Écran « Une seule chose maintenant » | 🎨 |
| Capture rapide d'une tâche | 🎨 |
| Découpage d'une tâche en micro-étapes par l'IA | 🎨 |
| Top 3 des priorités du jour (3 max) | 🎨 |
| Minuteur focus avec bouton « Je bloque » | 🎨 |
| Points d'XP, niveaux et séries | 🎨 |

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
| Comptes et synchronisation entre appareils | 📋 |
| Notifications de rappel | 📋 |
